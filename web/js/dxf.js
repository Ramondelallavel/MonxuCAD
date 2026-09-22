/* ============================================================
   dxf.js — Lectura y escritura de DXF (AC1009 / R12 y AC1015 / R2000)
   ============================================================ */
(function () {
  'use strict';
  var CAD = (window.CAD = window.CAD || {});
  var G = CAD.G, E = CAD.E;
  var DXF = (CAD.DXF = {});

  /* ============================================================
     ESCRITURA
     ============================================================ */
  function Writer(version) {
    this.v = version || 'AC1015';
    this.r2000 = this.v !== 'AC1009';
    this.out = [];
    this.hSeed = 0x30;
    this.fixed = { nod: 'C', groupDict: 'D', psDict: 'E', placeholder: 'F' };
  }
  Writer.prototype.h = function () { return (this.hSeed++).toString(16).toUpperCase(); };
  Writer.prototype.p = function (code, val) {
    this.out.push(String(code));
    if (typeof val === 'number') {
      if (code >= 10 && code < 60 || (code >= 110 && code < 150) || (code >= 210 && code < 240) || code === 1040) {
        this.out.push(fixNum(val));
      } else this.out.push(String(Math.round(val)));
    } else this.out.push(String(val === undefined || val === null ? '' : val));
    return this;
  };
  function fixNum(v) {
    if (!isFinite(v)) v = 0;
    var s = v.toFixed(10);
    s = s.replace(/(\.\d*?)0+$/, '$1').replace(/\.$/, '.0');
    if (s.indexOf('.') < 0) s += '.0';
    return s;
  }
  Writer.prototype.pt = function (base, p, z) {
    /* Un punto que falta no puede tumbar la exportación entera */
    var x = p && isFinite(p.x) ? p.x : 0, y = p && isFinite(p.y) ? p.y : 0;
    if (z === undefined && p && isFinite(p.z)) z = p.z;
    this.p(base, x); this.p(base + 10, y); this.p(base + 20, z || 0);
    return this;
  };

  /* Un objeto con datos incompletos no debe echar a perder el archivo
     entero: se descarta él solo y se corta lo que hubiera escrito a
     medias, para que el DXF no quede partido. */
  Writer.prototype.seguro = function (fn) {
    var n = this.out.length;
    try { fn(); return true; }
    catch (err) {
      this.out.length = n;
      this.saltados = (this.saltados || 0) + 1;
      this.motivo = err && err.message;
      return false;
    }
  };
  Writer.prototype.text = function () { return this.out.join('\r\n') + '\r\n'; };

  /* -------- Cabeceras de entidad -------- */
  Writer.prototype.entHead = function (type, ent, doc, owner, subclass) {
    this.p(0, type);
    if (this.r2000) {
      this.lastHandle = this.h();
      this.p(5, this.lastHandle);
      if (owner) this.p(330, owner);
      this.p(100, 'AcDbEntity');
    }
    this.p(8, layerName(ent.layer, this.r2000));
    var col = ent.color;
    if (col !== undefined && col !== 256) {
      if (typeof col === 'object' && col.rgb) {
        this.p(62, G.rgbToACI(col.rgb[0], col.rgb[1], col.rgb[2]));
        if (this.r2000) this.p(420, (col.rgb[0] << 16) | (col.rgb[1] << 8) | col.rgb[2]);
      } else this.p(62, col | 0);
    }
    var lt = ent.ltype;
    if (lt && lt !== 'ByLayer' && lt !== 'BYLAYER') this.p(6, ltName(lt, this.r2000));
    if (ent.lw !== undefined && ent.lw !== -1 && this.r2000) this.p(370, ent.lw);
    if (ent.ltscale && ent.ltscale !== 1) this.p(48, ent.ltscale);
    if (this.r2000 && ent.transparency) this.p(440, transCodigo(ent.transparency));
    if (this.r2000 && subclass) this.p(100, subclass);
    return this;
  };

  function layerName(n, r2000) {
    if (!n) return '0';
    if (r2000) return n;
    return String(n).toUpperCase().replace(/[^A-Z0-9_$\-]/g, '_').slice(0, 31) || '0';
  }
  function ltName(n, r2000) {
    if (!n) return 'CONTINUOUS';
    if (r2000) return n;
    return String(n).toUpperCase().replace(/[^A-Z0-9_$\-]/g, '_').slice(0, 31);
  }

  /* ============================================================
     Entidades
     ============================================================ */
  /* POLYFACE MESH: una entidad POLYLINE con bandera 64, seguida de los
     vértices (bandera 192) y de los registros de cara (bandera 128).
     El formato admite como máximo 4 vértices por cara, así que las caras
     con más lados se triangulan. */
  Writer.prototype.polyface = function (mesh, ent, doc, owner) {
    var W = this, i, j;
    var faces = [];
    for (i = 0; i < mesh.faces.length; i++) {
      var f = mesh.faces[i];
      if (f.length < 3) continue;
      if (f.length <= 4) { faces.push(f.slice()); continue; }
      var pts = f.map(function (k) { return mesh.verts[k]; });
      var tri = CAD.G3.triangulate(pts);
      if (!tri.length) { for (j = 1; j < f.length - 1; j++) faces.push([f[0], f[j], f[j + 1]]); continue; }
      for (j = 0; j < tri.length; j++) faces.push([f[tri[j][0]], f[tri[j][1]], f[tri[j][2]]]);
    }
    if (!faces.length) return;
    if (mesh.verts.length > 32767 || faces.length > 32767) { W.faces3d(mesh, faces, ent, doc, owner); return; }

    W.entHead('POLYLINE', ent, doc, owner, 'AcDbPolyFaceMesh');
    var polyH = W.lastHandle;
    W.p(66, 1);
    W.p(10, 0); W.p(20, 0); W.p(30, 0);
    W.p(70, 64);
    W.p(71, mesh.verts.length);
    W.p(72, faces.length);
    var lay = ent.layer || '0';
    for (i = 0; i < mesh.verts.length; i++) {
      var v = mesh.verts[i];
      W.p(0, 'VERTEX');
      if (W.r2000) { W.p(5, W.h()); W.p(330, polyH); W.p(100, 'AcDbEntity'); }
      W.p(8, lay);
      if (W.r2000) { W.p(100, 'AcDbVertex'); W.p(100, 'AcDbPolyFaceMeshVertex'); }
      W.p(10, v.x); W.p(20, v.y); W.p(30, v.z);
      W.p(70, 192);
    }
    for (i = 0; i < faces.length; i++) {
      var g = faces[i];
      W.p(0, 'VERTEX');
      if (W.r2000) { W.p(5, W.h()); W.p(330, polyH); W.p(100, 'AcDbEntity'); }
      W.p(8, lay);
      if (W.r2000) { W.p(100, 'AcDbVertex'); W.p(100, 'AcDbFaceRecord'); }
      W.p(10, 0); W.p(20, 0); W.p(30, 0);
      W.p(70, 128);
      W.p(71, g[0] + 1); W.p(72, g[1] + 1); W.p(73, g[2] + 1);
      if (g.length > 3) W.p(74, g[3] + 1);
    }
    W.p(0, 'SEQEND');
    if (W.r2000) { W.p(5, W.h()); W.p(330, polyH); W.p(100, 'AcDbEntity'); }
    W.p(8, lay);
  };

  /* Malla muy grande: se trocea en entidades 3DFACE sueltas */
  Writer.prototype.faces3d = function (mesh, faces, ent, doc, owner) {
    var W = this;
    for (var i = 0; i < faces.length; i++) {
      var g = faces[i];
      var a = mesh.verts[g[0]], b = mesh.verts[g[1]], c = mesh.verts[g[2]];
      var d = g.length > 3 ? mesh.verts[g[3]] : c;
      W.entHead('3DFACE', ent, doc, owner, 'AcDbFace');
      W.p(10, a.x); W.p(20, a.y); W.p(30, a.z);
      W.p(11, b.x); W.p(21, b.y); W.p(31, b.z);
      W.p(12, c.x); W.p(22, c.y); W.p(32, c.z);
      W.p(13, d.x); W.p(23, d.y); W.p(33, d.z);
    }
  };

  Writer.prototype.entity = function (ent, doc, owner) {
    var W = this;
    switch (ent.type) {
      case 'SOLID3D': case 'MESH': {
        /* Un sólido ACIS no se puede escribir sin la biblioteca de Spatial,
           así que se exporta la malla teselada como POLYFACE MESH, que es
           lo que AutoCAD lee sin ningún complemento. */
        var mesh = CAD.Solid && CAD.Solid.meshOf(ent);
        if (!mesh || !mesh.faces.length) break;
        try { mesh = mesh.triangulated(1e-5); } catch (err) { }
        W.polyface(mesh, ent, doc, owner);
        break;
      }
      case 'LINE':
        W.entHead('LINE', ent, doc, owner, 'AcDbLine');
        W.pt(10, ent.p1); W.pt(11, ent.p2);
        break;
      case 'XLINE': case 'RAY':
        if (W.r2000) {
          W.entHead(ent.type, ent, doc, owner, ent.type === 'XLINE' ? 'AcDbXline' : 'AcDbRay');
          W.pt(10, ent.p); W.pt(11, ent.d);
        } else {
          var big = 1e5, a = Math.atan2(ent.d.y, ent.d.x);
          W.entHead('LINE', ent, doc, owner, 'AcDbLine');
          W.pt(10, ent.type === 'XLINE' ? G.polar(ent.p, a, -big) : ent.p);
          W.pt(11, G.polar(ent.p, a, big));
        }
        break;
      case 'CIRCLE':
        W.entHead('CIRCLE', ent, doc, owner, 'AcDbCircle');
        W.pt(10, ent.c); W.p(40, ent.r);
        break;
      case 'ARC':
        W.entHead('ARC', ent, doc, owner, 'AcDbCircle');
        W.pt(10, ent.c); W.p(40, ent.r);
        if (W.r2000) W.p(100, 'AcDbArc');
        W.p(50, G.deg(G.na(ent.a0))); W.p(51, G.deg(G.na(ent.a1)));
        break;
      case 'POINT':
        W.entHead('POINT', ent, doc, owner, 'AcDbPoint');
        W.pt(10, ent.p);
        break;
      case 'ELLIPSE':
        if (W.r2000) {
          W.entHead('ELLIPSE', ent, doc, owner, 'AcDbEllipse');
          W.pt(10, ent.c); W.pt(11, ent.maj);
          W.p(210, 0); W.p(220, 0); W.p(230, 1);
          W.p(40, ent.ratio); W.p(41, ent.t0); W.p(42, ent.t1);
        } else {
          W.polyFromPts(E.segs(ent, doc, 2)[0], ent, doc, owner);
        }
        break;
      case 'LWPOLYLINE':
        if (W.r2000) {
          W.entHead('LWPOLYLINE', ent, doc, owner, 'AcDbPolyline');
          W.p(90, ent.verts.length);
          W.p(70, ent.closed ? 1 : 0);
          if (ent.width) W.p(43, ent.width);
          ent.verts.forEach(function (v) {
            W.p(10, v.x); W.p(20, v.y);
            if (v.sw || v.ew) { W.p(40, v.sw || 0); W.p(41, v.ew || 0); }
            if (v.b) W.p(42, v.b);
          });
        } else {
          W.p(0, 'POLYLINE'); W.p(8, layerName(ent.layer, false));
          if (ent.color !== undefined && ent.color !== 256) W.p(62, ent.color | 0);
          if (ent.ltype && ent.ltype !== 'ByLayer') W.p(6, ltName(ent.ltype, false));
          W.p(66, 1); W.p(10, 0); W.p(20, 0); W.p(30, 0);
          W.p(70, ent.closed ? 1 : 0);
          if (ent.width) { W.p(40, ent.width); W.p(41, ent.width); }
          ent.verts.forEach(function (v) {
            W.p(0, 'VERTEX'); W.p(8, layerName(ent.layer, false));
            W.p(10, v.x); W.p(20, v.y); W.p(30, 0); W.p(70, 0);
            if (v.b) W.p(42, v.b);
          });
          W.p(0, 'SEQEND'); W.p(8, layerName(ent.layer, false));
        }
        break;
      case 'SPLINE': {
        /* R12 no conoce la entidad SPLINE: allí sí hay que aplanarla.
           Si la entidad ya es una B-spline de verdad —viene de un
           fichero— se devuelve con sus nudos y sus pesos intactos, sin
           pasarla por la conversión a Bézier. */
        var nb = E.splineNurbs(ent);
        var bz = W.r2000 ? (nb ? { knots: nb.knots, ctrl: nb.ctrl, fit: (ent.fit || []),
                                   degree: nb.degree, weights: nb.weights }
                               : splineBezier(ent)) : null;
        if (!bz) { W.polyFromPts({ pts: E.splinePts(ent), closed: ent.closed }, ent, doc, owner); break; }
        W.entHead('SPLINE', ent, doc, owner, 'AcDbSpline');
        W.p(210, 0); W.p(220, 0); W.p(230, 1);
        /* 8 = plana, 1 = cerrada, 2 = periódica, 4 = racional */
        W.p(70, 8 | (ent.closed ? 3 : 0) | (bz.weights ? 4 : 0));
        W.p(71, bz.degree || 3);
        W.p(72, bz.knots.length);
        W.p(73, bz.ctrl.length);
        W.p(74, bz.fit.length);
        W.p(42, 1e-7); W.p(43, 1e-7); W.p(44, 1e-10);
        bz.knots.forEach(function (k) { W.p(40, k); });
        bz.ctrl.forEach(function (c, i) {
          W.p(10, c.x); W.p(20, c.y); W.p(30, 0);
          if (bz.weights) W.p(41, bz.weights[i]);
        });
        bz.fit.forEach(function (c) { W.p(11, c.x); W.p(21, c.y); W.p(31, 0); });
        break;
      }
      case 'SOLID': {
        W.entHead('SOLID', ent, doc, owner, 'AcDbTrace');
        var q = ent.pts;
        W.pt(10, q[0]); W.pt(11, q[1]);
        W.pt(12, q[3] || q[2]); W.pt(13, q[2]);
        break;
      }
      case 'TEXT': {
        W.entHead('TEXT', ent, doc, owner, 'AcDbText');
        W.pt(10, ent.p);
        W.p(40, ent.h);
        W.p(1, sanitize(ent.text));
        if (ent.rot) W.p(50, G.deg(ent.rot));
        if (ent.wfac && ent.wfac !== 1) W.p(41, ent.wfac);
        if (ent.oblique) W.p(51, ent.oblique);
        W.p(7, ent.style || 'Standard');
        if (ent.halign) W.p(72, ent.halign);
        if (ent.p2 || ent.halign || ent.valign) W.pt(11, ent.p2 || ent.p);
        if (W.r2000) W.p(100, 'AcDbText');
        if (ent.valign) W.p(73, ent.valign);
        break;
      }
      case 'MTEXT':
        if (W.r2000) {
          W.entHead('MTEXT', ent, doc, owner, 'AcDbMText');
          W.pt(10, ent.p);
          W.p(40, ent.h);
          W.p(41, ent.width || 0);
          W.p(71, ent.attach || 1);
          W.p(72, 5);
          var t = sanitize(String(ent.text || '').replace(/\n/g, '\\P'));
          while (t.length > 250) { W.p(3, t.slice(0, 250)); t = t.slice(250); }
          W.p(1, t);
          W.p(7, ent.style || 'Standard');
          if (ent.rot) W.p(50, G.deg(ent.rot));
        } else {
          var lay = E.mtextLayout(ent, doc);
          lay.lines.forEach(function (line, i) {
            var te = E.text({ x: lay.o.x, y: lay.o.y - (i + 0.85) * lay.lh }, ent.h, line, ent.rot,
              { layer: ent.layer, color: ent.color, ltype: ent.ltype, style: ent.style });
            W.entity(te, doc, owner);
          });
        }
        break;
      case 'INSERT': {
        var atts = (ent.attribs || []).filter(function (a) { return a && a.tag; });
        W.entHead('INSERT', ent, doc, owner, 'AcDbBlockReference');
        if (atts.length) W.p(66, 1);
        W.p(2, ent.name);
        W.pt(10, ent.p);
        W.p(41, ent.sx); W.p(42, ent.sy); W.p(43, 1);
        if (ent.rot) W.p(50, G.deg(ent.rot));
        if (atts.length) {
          var blk0 = doc.blocks[ent.name] || { base: { x: 0, y: 0 } };
          var m = G.mMul(G.mMul(G.mTrans(-blk0.base.x, -blk0.base.y), G.mScale(ent.sx, ent.sy)),
            G.mMul(G.mRot(ent.rot), G.mTrans(ent.p.x, ent.p.y)));
          atts.forEach(function (at) {
            var w = E.deep(at);
            E.transform(w, m, doc);
            w.layer = at.layer || ent.layer;
            W.attrib(w, doc, owner);
          });
          W.p(0, 'SEQEND');
          if (W.r2000) { W.p(5, W.h()); if (owner) W.p(330, owner); W.p(100, 'AcDbEntity'); }
          W.p(8, layerName(ent.layer, W.r2000));
        }
        break;
      }
      case 'ATTDEF': {
        W.entHead('ATTDEF', ent, doc, owner, 'AcDbText');
        W.pt(10, ent.p);
        W.p(40, ent.h);
        W.p(1, sanitize(ent.def === undefined ? '' : ent.def));
        if (ent.rot) W.p(50, G.deg(ent.rot));
        W.p(7, ent.style || 'Standard');
        if (ent.halign) W.p(72, ent.halign);
        W.pt(11, ent.p2 || ent.p);
        if (W.r2000) W.p(100, 'AcDbAttributeDefinition');
        W.p(3, sanitize(ent.prompt || ent.tag));
        W.p(2, ent.tag);
        W.p(70, ent.flags || 0);
        if (ent.valign) W.p(74, ent.valign);
        break;
      }
      case 'ATTRIB':
        W.attrib(ent, doc, owner);
        break;
      case 'HATCH':
        if (W.r2000) W.hatch(ent, doc, owner);
        else {
          ent.loops.forEach(function (l) {
            W.polyFromPts({ pts: l, closed: true }, ent, doc, owner);
          });
        }
        break;
      case 'DIMENSION': case 'LEADER':
        /* gestionado aparte mediante bloque anónimo */
        break;
    }
  };

  Writer.prototype.attrib = function (ent, doc, owner) {
    var W = this;
    W.entHead('ATTRIB', ent, doc, owner, 'AcDbText');
    W.pt(10, ent.p);
    W.p(40, ent.h);
    W.p(1, sanitize(ent.text));
    if (ent.rot) W.p(50, G.deg(ent.rot));
    W.p(7, ent.style || 'Standard');
    if (ent.halign) W.p(72, ent.halign);
    W.pt(11, ent.p2 || ent.p);
    if (W.r2000) W.p(100, 'AcDbAttribute');
    W.p(2, ent.tag);
    W.p(70, ent.flags || 0);
    if (ent.valign) W.p(74, ent.valign);
  };

  /* Convierte la spline —que se dibuja como Catmull-Rom por los puntos de
     ajuste— en una B-spline de grado 3 en forma de Bézier: nudos interiores
     triples, de modo que cada tramo es exactamente la curva que se ve en
     pantalla.  Así el DXF lleva una SPLINE de verdad y cualquier programa
     la reproduce igual, en vez de la polilínea aplanada de antes. */
  function splineBezier(ent) {
    var f = (ent.fit && ent.fit.length >= 2) ? ent.fit : ent.ctrl;
    if (!f || f.length < 2) return null;
    if (f.length === 2) {
      return { knots: [0, 0, 0, 0, 1, 1, 1, 1], fit: f.slice(),
               ctrl: [f[0],
                      { x: f[0].x + (f[1].x - f[0].x) / 3, y: f[0].y + (f[1].y - f[0].y) / 3 },
                      { x: f[0].x + 2 * (f[1].x - f[0].x) / 3, y: f[0].y + 2 * (f[1].y - f[0].y) / 3 },
                      f[1]] };
    }
    var ext = ent.closed ? [f[f.length - 1]].concat(f, [f[0], f[1]])
                         : [f[0]].concat(f, [f[f.length - 1]]);
    var ctrl = [], n = 0;
    for (var i = 1; i < ext.length - 2; i++) {
      var p0 = ext[i - 1], p1 = ext[i], p2 = ext[i + 1], p3 = ext[i + 2];
      if (!n) ctrl.push({ x: p1.x, y: p1.y });
      ctrl.push({ x: p1.x + (p2.x - p0.x) / 6, y: p1.y + (p2.y - p0.y) / 6 });
      ctrl.push({ x: p2.x - (p3.x - p1.x) / 6, y: p2.y - (p3.y - p1.y) / 6 });
      ctrl.push({ x: p2.x, y: p2.y });
      n++;
    }
    if (!n) return null;
    var knots = [0, 0, 0, 0];
    for (var j = 1; j < n; j++) { knots.push(j); knots.push(j); knots.push(j); }
    knots.push(n); knots.push(n); knots.push(n); knots.push(n);
    return { knots: knots, ctrl: ctrl, fit: f.slice() };
  }

  Writer.prototype.polyFromPts = function (seg, ent, doc, owner) {
    if (!seg || !seg.pts || seg.pts.length < 2) return;
    var proxy = { type: 'LWPOLYLINE', layer: ent.layer, color: ent.color, ltype: ent.ltype, lw: ent.lw, ltscale: ent.ltscale, closed: seg.closed, width: 0, verts: seg.pts.map(function (p) { return { x: p.x, y: p.y, b: 0 }; }) };
    this.entity(proxy, doc, owner);
  };

  /* Transparencia de una entidad, en el formato del grupo 440 */
  function transCodigo(t) {
    var pct = Math.max(0, Math.min(100, Number(t) || 0));
    return 0x02000000 | Math.round(255 - pct * 2.55);
  }

  function sanitize(s) {
    return String(s === undefined || s === null ? '' : s).replace(/\r/g, '').replace(/\n/g, '\\P');
  }

  /* -------- HATCH (sólo R2000+) -------- */
  Writer.prototype.hatch = function (ent, doc, owner) {
    var W = this;
    var solid = ent.solid || CAD.HatchLib.isSolid(ent.pattern);
    W.entHead('HATCH', ent, doc, owner, 'AcDbHatch');
    W.p(10, 0); W.p(20, 0); W.p(30, 0);
    W.p(210, 0); W.p(220, 0); W.p(230, 1);
    W.p(2, solid ? 'SOLID' : ent.pattern);
    W.p(70, solid ? 1 : 0);
    W.p(71, 0);
    W.p(91, ent.loops.length);
    ent.loops.forEach(function (loop, i) {
      W.p(92, i === 0 ? 3 : 2);      /* 1=externo, 2=polilínea */
      W.p(72, 0);                     /* sin bulges */
      W.p(73, 1);                     /* cerrado */
      W.p(93, loop.length);
      loop.forEach(function (p) { W.p(10, p.x); W.p(20, p.y); });
      W.p(97, 0);
    });
    W.p(75, 1);   /* estilo normal */
    W.p(76, 1);   /* predefinido */
    if (!solid) {
      W.p(52, G.deg(ent.angle || 0));
      W.p(41, ent.scale || 1);
      W.p(77, 0);
      var defs = CAD.HatchLib.defs(ent.pattern);
      var sc0 = ent.scale || 1, rot0 = G.deg(ent.angle || 0);
      W.p(78, defs.length);
      defs.forEach(function (d) {
        var ang = G.rad(d.a + rot0);
        W.p(53, d.a + rot0);
        W.p(43, (d.x || 0) * sc0);
        W.p(44, (d.y || 0) * sc0);
        W.p(45, (d.dx || 0) * sc0 * Math.cos(ang) - (d.dy || 0) * sc0 * Math.sin(ang));
        W.p(46, (d.dx || 0) * sc0 * Math.sin(ang) + (d.dy || 0) * sc0 * Math.cos(ang));
        var dash = d.dash || [];
        W.p(79, dash.length);
        dash.forEach(function (v) { W.p(49, v * sc0); });
      });
    }
    W.p(98, 1);
    var c = G.polyCentroid(ent.loops[0] || [{ x: 0, y: 0 }]);
    W.p(10, c.x); W.p(20, c.y);
  };

  /* -------- Cotas: bloque anónimo + entidad DIMENSION -------- */
  var DIMTYPE = { linear: 0, rotated: 0, aligned: 1, angular: 2, diameter: 3, radius: 4, arclen: 2, ordinate: 6 };

  /* Directriz: hasta ahora se descomponía en rectas y un triángulo al
     exportar, así que al volver a abrir el archivo ya no era una
     directriz.  LEADER es una entidad de la norma; se escribe tal cual y
     el texto que la acompaña va detrás como MTEXT. */
  Writer.prototype.leader = function (ent, doc, owner) {
    var W = this;
    var pts = ent.pts || [];
    if (pts.length < 2) return;
    W.entHead('LEADER', ent, doc, owner, 'AcDbLeader');
    W.p(3, ent.style || 'ISO-25');
    W.p(71, 1);                       /* con punta de flecha */
    W.p(72, 0);                       /* trazado recto */
    W.p(73, 3);                       /* sin anotación asociada */
    W.p(40, ent.h || 2.5);
    W.p(41, 0);
    W.p(76, pts.length);
    for (var i = 0; i < pts.length; i++) W.pt(10, pts[i]);
    if (ent.text) {
      var fin = pts[pts.length - 1];
      var t = E.mtext({ x: fin.x + (ent.h || 2.5) * 0.4, y: fin.y + (ent.h || 2.5) * 0.4 },
                      ent.h || 2.5, ent.text, 0,
                      { layer: ent.layer, color: ent.color, ltype: ent.ltype, lw: ent.lw });
      W.entity(t, doc, owner);
      /* marca para que al volver a leerlo se enganche a su directriz en
         vez de quedar como un texto suelto; otros programas la ignoran */
      W.p(1001, 'MONXUCAD'); W.p(1000, 'DIRECTRIZ');
    }
  };

  Writer.prototype.dimension = function (ent, doc, owner, blockName) {
    var W = this;
    var st = CAD.Dim.style(ent, doc);
    var geo = CAD.Dim.build(ent, doc);
    W.p(0, 'DIMENSION');
    if (W.r2000) { W.p(5, W.h()); if (owner) W.p(330, owner); W.p(100, 'AcDbEntity'); }
    W.p(8, layerName(ent.layer, W.r2000));
    if (ent.color !== undefined && ent.color !== 256) W.p(62, ent.color | 0);
    if (W.r2000) W.p(100, 'AcDbDimension');
    W.p(2, blockName);
    /* El punto 10 significa una cosa distinta en cada clase de cota; la
       norma lo fija así y otros programas cuentan con ello. */
    var cen = ent.center || { x: 0, y: 0 };
    var defPt;
    switch (ent.kind) {
      case 'radius': defPt = cen; break;
      /* en un diámetro, el 10 es el punto opuesto al 15 por el centro */
      case 'diameter': defPt = ent.p1
        ? { x: 2 * cen.x - ent.p1.x, y: 2 * cen.y - ent.p1.y } : cen; break;
      case 'angular': case 'arclen': defPt = ent.p3 || cen; break;
      case 'ordinate': defPt = ent.p1 || { x: 0, y: 0 }; break;
      /* en una lineal o alineada, el 10 es el punto por el que pasa la
         línea de cota, que en el modelo es p3 */
      default: defPt = ent.p3 || ent.textPos || ent.p2 || ent.p1 || { x: 0, y: 0 };
    }
    W.pt(10, defPt);
    var tp = ent.textPos || (geo.texts[0] && geo.texts[0].p) || defPt;
    W.pt(11, tp);
    var typ = DIMTYPE[ent.kind] === undefined ? 0 : DIMTYPE[ent.kind];
    W.p(70, typ + 32 + (ent.textPos ? 128 : 0));
    W.p(71, 5);
    if (ent.textOverride) W.p(1, sanitize(ent.textOverride));
    W.p(3, ent.style || 'ISO-25');
    switch (ent.kind) {
      case 'linear': case 'rotated':
        if (W.r2000) W.p(100, 'AcDbAlignedDimension');
        W.pt(13, ent.p1); W.pt(14, ent.p2);
        W.p(50, G.deg(ent.rot || 0));
        if (W.r2000) W.p(100, 'AcDbRotatedDimension');
        break;
      case 'aligned':
        if (W.r2000) W.p(100, 'AcDbAlignedDimension');
        W.pt(13, ent.p1); W.pt(14, ent.p2);
        break;
      case 'radius':
        if (W.r2000) W.p(100, 'AcDbRadialDimension');
        W.pt(15, ent.p1); W.p(40, 0);
        break;
      case 'diameter':
        if (W.r2000) W.p(100, 'AcDbDiametricDimension');
        W.pt(15, ent.p1); W.p(40, 0);
        break;
      case 'angular': case 'arclen':
        if (W.r2000) W.p(100, 'AcDb3PointAngularDimension');
        W.pt(13, ent.p1); W.pt(14, ent.p2); W.pt(15, cen); W.pt(16, ent.p3 || defPt);
        break;
      case 'ordinate':
        if (W.r2000) W.p(100, 'AcDbOrdinateDimension');
        W.pt(13, ent.p1); W.pt(14, ent.p2 || ent.textPos || ent.p1);
        break;
    }
    /* La norma no distingue una cota de longitud de arco de una angular
       de tres puntos, y el sentido de la ordenada tampoco viaja.  Se
       anota aparte, en datos extendidos: otros programas los ignoran y
       MonxuCAD recupera la cota tal cual estaba. */
    W.p(1001, 'MONXUCAD');
    W.p(1000, String(ent.kind || 'linear'));
    if (ent.kind === 'ordinate') W.p(1070, ent.ordX ? 1 : 0);
  };

  /* ============================================================
     Documento completo
     ============================================================ */
  DXF.write = function (doc, opts) {
    opts = opts || {};
    var W = new Writer(opts.version || 'AC1015');
    var r2000 = W.r2000;

    /* --- bloques anónimos de cota --- */
    var dimBlocks = [];
    var dimIdx = 0;
    doc.entities.forEach(function (e) {
      if (e.type === 'DIMENSION') {
        dimIdx++;
        var name = '*D' + dimIdx;
        var geo = [];
        try { geo = CAD.Dim.explode(e, doc) || []; } catch (err) { geo = []; }
        dimBlocks.push({ name: name, ent: e, geo: geo });
      }
    });

    /* --- reserva de manejadores --- */
    var handles = {};
    if (r2000) {
      handles.blockRecordTable = W.h();
      handles.layerTable = W.h();
      handles.ltypeTable = W.h();
      handles.styleTable = W.h();
      handles.viewTable = W.h();
      handles.ucsTable = W.h();
      handles.appidTable = W.h();
      handles.dimstyleTable = W.h();
      handles.vportTable = W.h();
      handles.modelRec = W.h();
      handles.paperRec = W.h();
      handles.blockRecs = {};
      Object.keys(doc.blocks).forEach(function (n) { handles.blockRecs[n] = W.h(); });
      dimBlocks.forEach(function (d) { handles.blockRecs[d.name] = W.h(); });
    }

    var bb = E.extentsAll(doc.entities, doc);
    if (!G.bboxValid(bb)) bb = { x1: 0, y1: 0, x2: 420, y2: 297 };

    /* ---------------- HEADER ---------------- */
    W.p(0, 'SECTION'); W.p(2, 'HEADER');
    W.p(9, '$ACADVER'); W.p(1, W.v);
    if (r2000) { W.p(9, '$HANDSEED'); W.p(5, 'FFFF'); }
    W.p(9, '$DWGCODEPAGE'); W.p(3, 'ANSI_1252');
    W.p(9, '$INSBASE'); W.p(10, 0); W.p(20, 0); W.p(30, 0);
    W.p(9, '$EXTMIN'); W.p(10, bb.x1); W.p(20, bb.y1); W.p(30, 0);
    W.p(9, '$EXTMAX'); W.p(10, bb.x2); W.p(20, bb.y2); W.p(30, 0);
    W.p(9, '$LIMMIN'); W.p(10, doc.vars.LIMMIN.x); W.p(20, doc.vars.LIMMIN.y);
    W.p(9, '$LIMMAX'); W.p(10, doc.vars.LIMMAX.x); W.p(20, doc.vars.LIMMAX.y);
    W.p(9, '$CLAYER'); W.p(8, layerName(doc.vars.CLAYER, r2000));
    W.p(9, '$LTSCALE'); W.p(40, doc.vars.LTSCALE);
    W.p(9, '$TEXTSIZE'); W.p(40, doc.vars.TEXTSIZE);
    W.p(9, '$TEXTSTYLE'); W.p(7, doc.vars.TEXTSTYLE || 'Standard');
    W.p(9, '$DIMSTYLE'); W.p(2, doc.vars.DIMSTYLE || 'ISO-25');
    W.p(9, '$DIMSCALE'); W.p(40, doc.vars.DIMSCALE || 1);
    W.p(9, '$DIMASZ'); W.p(40, 2.5);
    W.p(9, '$DIMTXT'); W.p(40, 2.5);
    W.p(9, '$INSUNITS'); W.p(70, doc.vars.INSUNITS || 4);
    W.p(9, '$MEASUREMENT'); W.p(70, 1);
    W.p(9, '$PDMODE'); W.p(70, doc.vars.PDMODE | 0);
    W.p(9, '$PDSIZE'); W.p(40, doc.vars.PDSIZE || 0);
    W.p(9, '$FILLMODE'); W.p(70, doc.vars.FILLMODE ? 1 : 0);
    W.p(9, '$LUNITS'); W.p(70, doc.vars.LUNITS || 2);
    W.p(9, '$LUPREC'); W.p(70, doc.vars.LUPREC || 4);
    W.p(9, '$AUNITS'); W.p(70, doc.vars.AUNITS || 0);
    W.p(9, '$AUPREC'); W.p(70, doc.vars.AUPREC || 2);
    W.p(9, '$ANGBASE'); W.p(50, doc.vars.ANGBASE || 0);
    W.p(9, '$ANGDIR'); W.p(70, doc.vars.ANGDIR || 0);
    W.p(9, '$ORTHOMODE'); W.p(70, doc.vars.ORTHOMODE || 0);
    W.p(9, '$MIRRTEXT'); W.p(70, doc.vars.MIRRTEXT || 0);
    W.p(9, '$CELTSCALE'); W.p(40, doc.vars.CELTSCALE || 1);
    W.p(0, 'ENDSEC');

    /* ---------------- CLASSES ---------------- */
    if (r2000) { W.p(0, 'SECTION'); W.p(2, 'CLASSES'); W.p(0, 'ENDSEC'); }

    /* ---------------- TABLES ---------------- */
    W.p(0, 'SECTION'); W.p(2, 'TABLES');

    /* VPORT */
    startTable(W, 'VPORT', handles.vportTable, 1);
    W.p(0, 'VPORT');
    if (r2000) { W.p(5, W.h()); W.p(330, handles.vportTable); W.p(100, 'AcDbSymbolTableRecord'); W.p(100, 'AcDbViewportTableRecord'); }
    W.p(2, '*ACTIVE'); W.p(70, 0);
    W.p(10, 0); W.p(20, 0); W.p(11, 1); W.p(21, 1);
    W.p(12, (bb.x1 + bb.x2) / 2); W.p(22, (bb.y1 + bb.y2) / 2);
    W.p(13, 0); W.p(23, 0); W.p(14, 10); W.p(24, 10);
    W.p(15, 0); W.p(25, 0); W.p(16, 0); W.p(26, 0); W.p(36, 1);
    W.p(17, 0); W.p(27, 0); W.p(37, 0);
    W.p(40, Math.max(1, bb.y2 - bb.y1) * 1.2); W.p(41, 1.5); W.p(42, 50); W.p(43, 0); W.p(44, 0);
    W.p(50, 0); W.p(51, 0); W.p(71, 0); W.p(72, 100); W.p(73, 1); W.p(74, 3);
    W.p(75, 0); W.p(76, 0); W.p(77, 0); W.p(78, 0);
    W.p(0, 'ENDTAB');

    /* LTYPE */
    var ltNames = Object.keys(doc.ltypes);
    startTable(W, 'LTYPE', handles.ltypeTable, ltNames.length + 2);
    ['ByBlock', 'ByLayer'].forEach(function (n) {
      W.p(0, 'LTYPE');
      if (r2000) { W.p(5, W.h()); W.p(330, handles.ltypeTable); W.p(100, 'AcDbSymbolTableRecord'); W.p(100, 'AcDbLinetypeTableRecord'); }
      W.p(2, r2000 ? n : n.toUpperCase()); W.p(70, 0); W.p(3, ''); W.p(72, 65); W.p(73, 0); W.p(40, 0);
    });
    ltNames.forEach(function (n) {
      var lt = doc.ltypes[n];
      W.p(0, 'LTYPE');
      if (r2000) { W.p(5, W.h()); W.p(330, handles.ltypeTable); W.p(100, 'AcDbSymbolTableRecord'); W.p(100, 'AcDbLinetypeTableRecord'); }
      W.p(2, ltName(n, r2000)); W.p(70, 0); W.p(3, lt.desc || '');
      W.p(72, 65); W.p(73, lt.pat.length);
      W.p(40, lt.pat.reduce(function (a, b) { return a + Math.abs(b); }, 0));
      lt.pat.forEach(function (d) { W.p(49, d); if (r2000) W.p(74, 0); });
    });
    W.p(0, 'ENDTAB');

    /* LAYER */
    var layers = doc.layerList();
    startTable(W, 'LAYER', handles.layerTable, layers.length);
    layers.forEach(function (l) {
      W.p(0, 'LAYER');
      if (r2000) { W.p(5, W.h()); W.p(330, handles.layerTable); W.p(100, 'AcDbSymbolTableRecord'); W.p(100, 'AcDbLayerTableRecord'); }
      W.p(2, layerName(l.name, r2000));
      W.p(70, (l.frozen ? 1 : 0) + (l.locked ? 4 : 0));
      W.p(62, l.on ? Math.abs(l.color | 0) : -Math.abs(l.color | 0));
      W.p(6, ltName(l.ltype, r2000));
      if (r2000) {
        W.p(370, l.lw === undefined ? -3 : l.lw);
        W.p(390, W.fixed.placeholder);
        if (!l.plot) W.p(290, 0);
        if (l.transparency) W.p(440, transCodigo(l.transparency));
      }
    });
    W.p(0, 'ENDTAB');

    /* STYLE */
    var styles = Object.keys(doc.textStyles);
    startTable(W, 'STYLE', handles.styleTable, styles.length);
    styles.forEach(function (n) {
      var s = doc.textStyles[n];
      W.p(0, 'STYLE');
      if (r2000) { W.p(5, W.h()); W.p(330, handles.styleTable); W.p(100, 'AcDbSymbolTableRecord'); W.p(100, 'AcDbTextStyleTableRecord'); }
      W.p(2, r2000 ? n : n.toUpperCase()); W.p(70, 0); W.p(40, s.h || 0);
      W.p(41, s.wfac || 1); W.p(50, s.oblique || 0); W.p(71, 0);
      W.p(42, 2.5); W.p(3, s.font || 'txt'); W.p(4, s.bigfont || '');
    });
    W.p(0, 'ENDTAB');

    /* VIEW / UCS */
    startTable(W, 'VIEW', handles.viewTable, 0); W.p(0, 'ENDTAB');
    startTable(W, 'UCS', handles.ucsTable, 0); W.p(0, 'ENDTAB');

    /* APPID */
    startTable(W, 'APPID', handles.appidTable, 1);
    W.p(0, 'APPID');
    if (r2000) { W.p(5, W.h()); W.p(330, handles.appidTable); W.p(100, 'AcDbSymbolTableRecord'); W.p(100, 'AcDbRegAppTableRecord'); }
    W.p(2, 'ACAD'); W.p(70, 0);
    W.p(0, 'ENDTAB');

    /* DIMSTYLE */
    var dss = Object.keys(doc.dimStyles);
    W.p(0, 'TABLE'); W.p(2, 'DIMSTYLE');
    if (r2000) { W.p(5, handles.dimstyleTable); W.p(330, 0); W.p(100, 'AcDbSymbolTable'); }
    W.p(70, dss.length);
    if (r2000) W.p(100, 'AcDbDimStyleTable'), W.p(71, 0);
    dss.forEach(function (n) {
      var d = doc.dimStyles[n];
      W.p(0, 'DIMSTYLE');
      if (r2000) { W.p(105, W.h()); W.p(330, handles.dimstyleTable); W.p(100, 'AcDbSymbolTableRecord'); W.p(100, 'AcDbDimStyleTableRecord'); }
      W.p(2, r2000 ? n : n.toUpperCase()); W.p(70, 0);
      if (d.DIMPOST) W.p(3, d.DIMPOST);
      if (d.DIMAPOST) W.p(4, d.DIMAPOST);
      /* se escribe la tabla entera, no media: lo que no se escribe se
         pierde al volver a abrir y las cotas cambian de aspecto */
      W.p(40, d.DIMSCALE || 1);
      W.p(41, d.DIMASZ); W.p(42, d.DIMEXO); W.p(43, d.DIMDLI); W.p(44, d.DIMEXE);
      W.p(45, d.DIMRND || 0);
      W.p(47, d.DIMTP || 0); W.p(48, d.DIMTM || 0);
      W.p(140, d.DIMTXT); W.p(143, d.DIMALTF || 0.0393701); W.p(144, d.DIMLFAC || 1);
      W.p(146, d.DIMTFAC || 0.7); W.p(147, d.DIMGAP);
      W.p(71, d.DIMTOL || 0); W.p(72, d.DIMLIM || 0);
      W.p(73, d.DIMTIH || 0); W.p(74, d.DIMTOH || 0);
      W.p(75, d.DIMSE1 || 0); W.p(76, d.DIMSE2 || 0);
      W.p(77, d.DIMTAD || 0); W.p(78, d.DIMZIN || 0);
      W.p(170, d.DIMALT || 0); W.p(171, d.DIMALTD === undefined ? 3 : d.DIMALTD);
      W.p(172, d.DIMTOFL === undefined ? 1 : d.DIMTOFL);
      W.p(176, d.DIMCLRD || 0); W.p(177, d.DIMCLRE || 0); W.p(178, d.DIMCLRT || 0);
      W.p(179, d.DIMADEC || 0);
      W.p(271, d.DIMDEC === undefined ? 2 : d.DIMDEC);
      W.p(272, d.DIMTDEC === undefined ? 2 : d.DIMTDEC);
      W.p(279, d.DIMTMOVE || 0); W.p(280, d.DIMJUST || 0);
      W.p(281, d.DIMSD1 || 0); W.p(282, d.DIMSD2 || 0);
      W.p(289, d.DIMATFIT === undefined ? 3 : d.DIMATFIT);
      if (r2000) { W.p(340, W.fixed.placeholder); }
    });
    W.p(0, 'ENDTAB');

    /* BLOCK_RECORD */
    if (r2000) {
      var brNames = Object.keys(handles.blockRecs);
      startTable(W, 'BLOCK_RECORD', handles.blockRecordTable, brNames.length + 2);
      [['*Model_Space', handles.modelRec], ['*Paper_Space', handles.paperRec]].forEach(function (pr) {
        W.p(0, 'BLOCK_RECORD'); W.p(5, pr[1]); W.p(330, handles.blockRecordTable);
        W.p(100, 'AcDbSymbolTableRecord'); W.p(100, 'AcDbBlockTableRecord'); W.p(2, pr[0]); W.p(70, 0);
      });
      brNames.forEach(function (n) {
        W.p(0, 'BLOCK_RECORD'); W.p(5, handles.blockRecs[n]); W.p(330, handles.blockRecordTable);
        W.p(100, 'AcDbSymbolTableRecord'); W.p(100, 'AcDbBlockTableRecord'); W.p(2, n); W.p(70, 0);
      });
      W.p(0, 'ENDTAB');
    }
    W.p(0, 'ENDSEC');

    /* ---------------- BLOCKS ---------------- */
    W.p(0, 'SECTION'); W.p(2, 'BLOCKS');
    writeBlock(W, doc, '*Model_Space', { x: 0, y: 0 }, [], r2000 ? handles.modelRec : null);
    writeBlock(W, doc, '*Paper_Space', { x: 0, y: 0 }, [], r2000 ? handles.paperRec : null);
    Object.keys(doc.blocks).forEach(function (n) {
      var b = doc.blocks[n];
      writeBlock(W, doc, n, b.base, b.entities, r2000 ? handles.blockRecs[n] : null);
    });
    dimBlocks.forEach(function (d) {
      writeBlock(W, doc, d.name, { x: 0, y: 0 }, d.geo, r2000 ? handles.blockRecs[d.name] : null, 1);
    });
    W.p(0, 'ENDSEC');

    /* ---------------- ENTITIES ---------------- */
    W.p(0, 'SECTION'); W.p(2, 'ENTITIES');
    var owner = r2000 ? handles.modelRec : null;
    var di = 0;
    doc.entities.forEach(function (e) {
      if (e.type === 'DIMENSION') {
        di++;
        W.seguro(function () { W.dimension(e, doc, owner, '*D' + di); });
        return;
      }
      if (e.type === 'LEADER') { W.seguro(function () { W.leader(e, doc, owner); }); return; }
      W.seguro(function () { W.entity(e, doc, owner); });
    });
    W.p(0, 'ENDSEC');

    /* ---------------- OBJECTS ---------------- */
    if (r2000) {
      W.p(0, 'SECTION'); W.p(2, 'OBJECTS');
      W.p(0, 'DICTIONARY'); W.p(5, W.fixed.nod); W.p(330, 0); W.p(100, 'AcDbDictionary'); W.p(281, 1);
      W.p(3, 'ACAD_GROUP'); W.p(350, W.fixed.groupDict);
      W.p(3, 'ACAD_PLOTSTYLENAME'); W.p(350, W.fixed.psDict);
      W.p(0, 'DICTIONARY'); W.p(5, W.fixed.groupDict); W.p(330, W.fixed.nod); W.p(100, 'AcDbDictionary'); W.p(281, 1);
      W.p(0, 'ACDBDICTIONARYWDFLT'); W.p(5, W.fixed.psDict); W.p(330, W.fixed.nod);
      W.p(100, 'AcDbDictionary'); W.p(281, 1); W.p(3, 'Normal'); W.p(350, W.fixed.placeholder);
      W.p(100, 'AcDbDictionaryWithDefault'); W.p(340, W.fixed.placeholder);
      W.p(0, 'ACDBPLACEHOLDER'); W.p(5, W.fixed.placeholder); W.p(330, W.fixed.psDict);
      W.p(0, 'ENDSEC');
    }

    W.p(0, 'EOF');
    DXF.saltados = W.saltados || 0;
    DXF.motivo = W.motivo || '';
    return W.text();
  };

  function startTable(W, name, handle, count) {
    W.p(0, 'TABLE'); W.p(2, name);
    if (W.r2000) { W.p(5, handle); W.p(330, 0); W.p(100, 'AcDbSymbolTable'); }
    W.p(70, count);
  }

  function writeBlock(W, doc, name, base, ents, recHandle, anon) {
    W.p(0, 'BLOCK');
    if (W.r2000) {
      W.p(5, W.h()); if (recHandle) W.p(330, recHandle);
      W.p(100, 'AcDbEntity'); W.p(8, '0'); W.p(100, 'AcDbBlockBegin');
    } else W.p(8, '0');
    W.p(2, W.r2000 ? name : name.toUpperCase());
    W.p(70, anon ? 1 : 0);
    W.p(10, base.x); W.p(20, base.y); W.p(30, 0);
    W.p(3, W.r2000 ? name : name.toUpperCase());
    W.p(1, '');
    ents.forEach(function (e) {
      if (e.type === 'DIMENSION' || e.type === 'LEADER') {
        if (e.type === 'LEADER') W.seguro(function () { W.leader(e, doc, recHandle); });
        else W.seguro(function () {
          CAD.Dim.explode(e, doc).forEach(function (g) { W.entity(g, doc, recHandle); });
        });
      } else W.seguro(function () { W.entity(e, doc, recHandle); });
    });
    W.p(0, 'ENDBLK');
    if (W.r2000) {
      W.p(5, W.h()); if (recHandle) W.p(330, recHandle);
      W.p(100, 'AcDbEntity'); W.p(8, '0'); W.p(100, 'AcDbBlockEnd');
    } else W.p(8, '0');
  }

  /* ============================================================
     LECTURA
     ============================================================ */
  /* Tabla de tipos por código: 0 = cadena, 1 = real, 2 = entero.
     Evita una cadena de comparaciones por cada par del archivo. */
  var KIND = (function () {
    var t = new Uint8Array(1100);
    function set(a, b, v) { for (var i = a; i <= b && i < t.length; i++) t[i] = v; }
    set(10, 59, 1); set(110, 149, 1); set(210, 239, 1); set(460, 469, 1); set(1010, 1059, 1);
    set(60, 79, 2); set(90, 99, 2); set(170, 179, 2); set(270, 289, 2);
    set(370, 389, 2); set(400, 409, 2); set(1060, 1070, 2);
    /* Faltaban los enteros largos: color verdadero (420), transparencia
       (440) y los identificadores de 450 en adelante llegaban como
       cadena.  El color colaba de milagro porque al desplazar bits se
       convierte solo; la transparencia no colaba. */
    set(420, 429, 2); set(440, 449, 2); set(450, 459, 2); set(1071, 1071, 2);
    return t;
  })();
  function isFloatCode(c) { return c < 1100 && KIND[c] === 1; }
  function isIntCode(c) { return c < 1100 && KIND[c] === 2; }

  function trimFast(s2) {
    if (!s2) return '';
    var a = 0, b = s2.length;
    while (a < b && s2.charCodeAt(a) <= 32) a++;
    while (b > a && s2.charCodeAt(b - 1) <= 32) b--;
    return (a === 0 && b === s2.length) ? s2 : s2.slice(a, b);
  }

  DXF.parsePairs = function (txt) {
    var lines = txt.split('\n');
    var n = lines.length;
    var pairs = new Array(n >> 1);
    var m = 0;
    for (var i = 0; i + 1 < n; i += 2) {
      var raw = lines[i];
      var c = parseInt(raw, 10);
      if (c !== c) { i--; continue; }            /* línea desalineada */
      var v = lines[i + 1];
      if (v === undefined) break;
      var last = v.length - 1;
      if (last >= 0 && v.charCodeAt(last) === 13) v = v.slice(0, last);
      var k = c < 1100 ? KIND[c] : 0;
      if (k === 1) v = +v;
      else if (k === 2) v = parseInt(v, 10) | 0;
      else if (v.length && (v.charCodeAt(0) <= 32 || v.charCodeAt(v.length - 1) <= 32)) v = trimFast(v);
      pairs[m++] = [c, v];
    }
    pairs.length = m;
    return pairs;
  };

  DXF.read = function (txt) {
    var pairs = DXF.parsePairs(txt);
    var doc = new CAD.Doc();
    doc.layerOrder = []; doc.layers = {}; doc.addLayer({ name: '0', color: 7, ltype: 'CONTINUOUS' });
    var i = 0, n = pairs.length;
    var warnings = [];

    function section(name) {
      /* devuelve el índice donde empieza la sección o -1 */
      for (var k = 0; k < n - 1; k++) {
        if (pairs[k][0] === 0 && pairs[k][1] === 'SECTION' && pairs[k + 1][0] === 2 && pairs[k + 1][1] === name) return k + 2;
      }
      return -1;
    }

    /* --- HEADER --- */
    var hs = section('HEADER');
    if (hs >= 0) {
      for (var k = hs; k < n; k++) {
        if (pairs[k][0] === 0 && pairs[k][1] === 'ENDSEC') break;
        if (pairs[k][0] === 9) {
          var vn = pairs[k][1], nx = pairs[k + 1];
          if (!nx) continue;
          /* Varias de las que el propio programa escribe no se volvían a
             leer: el estilo de cota y el de texto en curso, el relleno,
             las unidades y los ángulos.  Un dibujo ajeno perdía todo eso
             al abrirlo y seguía con los valores de fábrica. */
          if (vn === '$LTSCALE') doc.vars.LTSCALE = nx[1];
          else if (vn === '$CELTSCALE') doc.vars.CELTSCALE = nx[1];
          else if (vn === '$TEXTSIZE') doc.vars.TEXTSIZE = nx[1];
          else if (vn === '$TEXTSTYLE') doc.vars.TEXTSTYLE = String(nx[1]);
          else if (vn === '$CLAYER') doc.vars.CLAYER = String(nx[1]);
          else if (vn === '$DIMSTYLE') doc.vars.DIMSTYLE = String(nx[1]);
          else if (vn === '$INSUNITS') doc.vars.INSUNITS = nx[1];
          else if (vn === '$PDMODE') doc.vars.PDMODE = nx[1];
          else if (vn === '$PDSIZE') doc.vars.PDSIZE = nx[1];
          else if (vn === '$FILLMODE') doc.vars.FILLMODE = nx[1] ? 1 : 0;
          else if (vn === '$LUNITS') doc.vars.LUNITS = nx[1];
          else if (vn === '$LUPREC') doc.vars.LUPREC = nx[1];
          else if (vn === '$AUNITS') doc.vars.AUNITS = nx[1];
          else if (vn === '$AUPREC') doc.vars.AUPREC = nx[1];
          else if (vn === '$ANGBASE') doc.vars.ANGBASE = nx[1];
          else if (vn === '$ANGDIR') doc.vars.ANGDIR = nx[1];
          else if (vn === '$ORTHOMODE') doc.vars.ORTHOMODE = nx[1];
          else if (vn === '$DIMSCALE') doc.vars.DIMSCALE = nx[1];
          else if (vn === '$MIRRTEXT') doc.vars.MIRRTEXT = nx[1];
          else if (vn === '$LIMMIN') doc.vars.LIMMIN = { x: pairs[k + 1][1], y: pairs[k + 2][1] };
          else if (vn === '$LIMMAX') doc.vars.LIMMAX = { x: pairs[k + 1][1], y: pairs[k + 2][1] };
        }
      }
    }

    /* --- TABLES --- */
    var ts = section('TABLES');
    if (ts >= 0) {
      var cur = null, rec = null, curTable = null;
      for (var t = ts; t < n; t++) {
        var c = pairs[t][0], v = pairs[t][1];
        if (c === 0) {
          flushRec();
          if (v === 'ENDSEC') break;
          if (v === 'TABLE') { curTable = null; continue; }
          if (v === 'ENDTAB') { curTable = null; continue; }
          if (v === 'LAYER' || v === 'LTYPE' || v === 'STYLE' || v === 'DIMSTYLE') { rec = { t: v, codes: [] }; }
          else rec = null;
          continue;
        }
        if (!rec) {
          if (c === 2 && !curTable) curTable = v;
          continue;
        }
        rec.codes.push([c, v]);
        if (c === 2) rec.name = String(v);
        else if (c === 70) rec.flags = v;
        else if (c === 62) rec.color = v;
        else if (c === 6) rec.ltype = String(v);
        else if (c === 370) rec.lw = v;
        else if (c === 290) rec.plot = !!v;
        else if (c === 440) rec.trans = v;
        /* en un estilo de texto el grupo 3 es el fichero de fuente, no
           una descripción: como se guardaba siempre en `desc`, ningún
           estilo importado conservaba su tipo de letra y todos salían
           con la de palotes */
        else if (c === 3) { if (rec.t === 'STYLE') rec.font = String(v); else rec.desc = String(v); }
        else if (c === 4 && rec.t === 'STYLE') rec.bigfont = String(v);
        else if (c === 49) { (rec.pat = rec.pat || []).push(v); }
        else if (c === 40) rec.h = v;
        else if (c === 41) rec.wfac = v;
        else if (c === 50) rec.oblique = v;
        else if (c === 140) rec.DIMTXT = v;
        else if (c === 41 && rec.t === 'DIMSTYLE') rec.DIMASZ = v;
      }
      function flushRec() {
        if (!rec || !rec.name) { rec = null; return; }
        if (rec.t === 'LAYER') {
          doc.addLayer({
            name: rec.name,
            on: (rec.color === undefined ? 7 : rec.color) >= 0,
            frozen: !!(rec.flags & 1), locked: !!(rec.flags & 4),
            color: Math.abs(rec.color === undefined ? 7 : rec.color) || 7,
            ltype: rec.ltype || 'CONTINUOUS',
            lw: rec.lw === undefined ? -3 : rec.lw,
            plot: rec.plot === undefined ? true : rec.plot,
            transparency: (rec.trans !== undefined && (Number(rec.trans) & 0x02000000))
              ? Math.max(0, Math.min(100, Math.round((255 - (Number(rec.trans) & 255)) / 2.55))) : 0
          });
        } else if (rec.t === 'LTYPE') {
          if (rec.name !== 'ByLayer' && rec.name !== 'ByBlock' && rec.name.toUpperCase() !== 'BYLAYER' && rec.name.toUpperCase() !== 'BYBLOCK') {
            doc.ltypes[rec.name] = { name: rec.name, desc: rec.desc || '', pat: rec.pat || [] };
          }
        } else if (rec.t === 'STYLE') {
          doc.textStyles[rec.name] = {
            name: rec.name, font: rec.font || 'txt.shx', bigfont: rec.bigfont || '',
            h: rec.h || 0, wfac: rec.wfac || 1, oblique: rec.oblique || 0,
            css: fuenteCss(rec.font)
          };
        } else if (rec.t === 'DIMSTYLE') {
          doc.dimStyles[rec.name] = leeDimStyle(rec);
        }
        rec = null;
      }
    }

    /* --- BLOCKS --- */
    var bs = section('BLOCKS');
    if (bs >= 0) {
      var bi = bs;
      while (bi < n) {
        if (pairs[bi][0] === 0 && pairs[bi][1] === 'ENDSEC') break;
        if (pairs[bi][0] === 0 && pairs[bi][1] === 'BLOCK') {
          var hdr = {}, j = bi + 1;
          while (j < n && pairs[j][0] !== 0) {
            if (pairs[j][0] === 2) hdr.name = String(pairs[j][1]);
            else if (pairs[j][0] === 10) hdr.bx = pairs[j][1];
            else if (pairs[j][0] === 20) hdr.by = pairs[j][1];
            else if (pairs[j][0] === 70) hdr.flags = pairs[j][1];
            j++;
          }
          var endIdx = j;
          while (endIdx < n && !(pairs[endIdx][0] === 0 && pairs[endIdx][1] === 'ENDBLK')) endIdx++;
          var ents = readEntities(pairs, j, endIdx, doc, warnings);
          if (hdr.name && hdr.name.toUpperCase().indexOf('*MODEL_SPACE') < 0 && hdr.name.toUpperCase().indexOf('*PAPER_SPACE') < 0) {
            doc.blocks[hdr.name] = { name: hdr.name, base: { x: hdr.bx || 0, y: hdr.by || 0 }, entities: ents, anon: !!(hdr.flags & 1) };
          }
          bi = endIdx + 1;
        } else bi++;
      }
    }

    /* --- ENTITIES --- */
    var es = section('ENTITIES');
    if (es >= 0) {
      var ee = es;
      while (ee < n && !(pairs[ee][0] === 0 && pairs[ee][1] === 'ENDSEC')) ee++;
      readEntities(pairs, es, ee, doc, warnings).forEach(function (e) { doc.add(e); });
    }

    /* capas referenciadas pero no declaradas */
    doc.entities.forEach(function (e) { if (!doc.layers[e.layer]) doc.addLayer({ name: e.layer, color: 7 }); });
    doc.warnings = warnings;
    return doc;
  };

  /* POLYFACE MESH (70 & 64) y malla poligonal MxN (70 & 16) */
  function readMesh(pairs, idx, to, o, flags, codes) {
    if (!CAD.Solid || !CAD.Mesh) return null;
    var G3x = CAD.G3;
    var verts = [], faces = [];
    var k = idx + 1;
    while (k < to) {
      if (pairs[k][0] === 0) {
        if (pairs[k][1] === 'SEQEND') break;
        if (pairs[k][1] === 'VERTEX') {
          var vc = [], m = k + 1;
          while (m < to && pairs[m][0] !== 0) { vc.push(pairs[m]); m++; }
          var vf = get(vc, 70, 0);
          if (vf & 128 && !(vf & 64)) {
            /* registro de cara: índices con signo (negativo = arista oculta) */
            var f = [];
            [71, 72, 73, 74].forEach(function (c) {
              var v = get(vc, c, 0);
              if (v) f.push(Math.abs(v) - 1);
            });
            if (f.length >= 3) faces.push(f);
          } else {
            verts.push(G3x.v(get(vc, 10, 0), get(vc, 20, 0), get(vc, 30, 0)));
          }
          k = m; continue;
        }
      }
      k++;
    }
    if (!verts.length) return null;
    if (!faces.length && (flags & 16)) {
      /* malla poligonal MxN: las caras se deducen de la retícula */
      var M = get(codes, 71, 0), N = get(codes, 72, 0);
      if (M > 1 && N > 1 && M * N <= verts.length) {
        var closedM = !!(flags & 1), closedN = !!(flags & 32);
        var limM = closedM ? M : M - 1, limN = closedN ? N : N - 1;
        for (var i = 0; i < limM; i++)
          for (var j = 0; j < limN; j++) {
            var a = (i % M) * N + (j % N), b = ((i + 1) % M) * N + (j % N);
            var c = ((i + 1) % M) * N + ((j + 1) % N), d = (i % M) * N + ((j + 1) % N);
            faces.push([a, b, c, d]);
          }
      }
    }
    if (!faces.length) return null;
    /* descarta índices fuera de rango (archivos mal formados) */
    var ok = [];
    for (i = 0; i < faces.length; i++) {
      var g = faces[i], good = true;
      for (j = 0; j < g.length; j++) if (!(g[j] >= 0 && g[j] < verts.length)) { good = false; break; }
      if (good) ok.push(g);
    }
    if (!ok.length) return null;
    var mesh = CAD.Mesh.make(verts, ok);
    mesh.clean();
    if (!mesh.faces.length) return null;
    var ent = CAD.Solid.mesh(mesh, o);
    if (CAD.Mesh.check(mesh).estanco) {
      ent.type = 'SOLID3D';
      if (mesh.volume() < 0) { mesh.flip(); CAD.Solid.setMesh(ent, mesh); }
    }
    return ent;
  }

  /* Lee un rango de entidades */
  /* Comprueba que un objeto recién leído tiene números utilizables.
     Lo que se puede arreglar sin inventar nada (un radio negativo es el
     mismo círculo) se arregla; lo demás se descarta. */
  var LIM = 1e14;
  function numOk(v) { return typeof v !== 'number' || (isFinite(v) && Math.abs(v) < LIM); }
  function sano(ent, warnings) {
    if (!ent || !ent.type) return false;
    if (typeof ent.r === 'number') {
      if (!isFinite(ent.r)) return false;
      if (ent.r < 0) ent.r = -ent.r;
    }
    if (typeof ent.h === 'number' && (!isFinite(ent.h) || ent.h <= 0)) return false;
    var mal = false, visto = [];
    (function anda(o, hondo) {
      if (mal || !o || typeof o !== 'object' || hondo > 4 || visto.indexOf(o) >= 0) return;
      visto.push(o);
      for (var k in o) {
        if (k.charAt(0) === '_') continue;
        var v = o[k];
        if (typeof v === 'number') { if (!numOk(v)) { mal = true; return; } }
        else if (v && typeof v === 'object') anda(v, hondo + 1);
      }
    })(ent, 0);
    if (mal && warnings && warnings.indexOf('(coordenadas no válidas)') < 0) warnings.push('(coordenadas no válidas)');
    return !mal;
  }

  function readEntities(pairs, from, to, doc, warnings) {
    var out = [], i = from;
    while (i < to) {
      if (pairs[i][0] !== 0) { i++; continue; }
      var type = pairs[i][1];
      if (type === 'ENDSEC' || type === 'ENDBLK') break;
      var j = i + 1;
      var d = { _codes: [] };
      while (j < to && pairs[j][0] !== 0) { d._codes.push(pairs[j]); j++; }
      var ent = null;
      try {
        ent = buildEntity(type, d._codes, pairs, i, to, doc);
        ent = aplicaOCS(ent, d._codes, doc);
      } catch (err) { ent = null; }
      if (ent) {
        /* Un archivo de otro programa puede venir con coordenadas rotas.
           Dejar entrar un NaN o un infinito envenena la extensión del
           dibujo: ZOOM deja de funcionar y no se ve nada.  Mejor perder
           ese objeto que el dibujo entero. */
        if (Array.isArray(ent)) {
          ent.forEach(function (x) { if (sano(x, warnings)) out.push(x); });
        } else if (sano(ent, warnings)) {
          var ult = out.length ? out[out.length - 1] : null;
          /* Un atributo pertenece al INSERT que lo precede; suelto se
             queda como texto para que al menos se vea. */
          if (ent.type === 'ATTRIB') {
            if (ult && ult.type === 'INSERT') {
              if (!ult.attribs) ult.attribs = [];
              ult.attribs.push(ent);
            } else {
              var tx = E.text(ent.p, ent.h, ent.text, ent.rot, { layer: ent.layer, color: ent.color });
              tx.style = ent.style; tx.halign = ent.halign; tx.valign = ent.valign;
              out.push(tx);
            }
          } else if (ent.__dirTexto && ult && ult.type === 'LEADER') {
            ult.text = ent.text; ult.h = ent.h;
          } else out.push(ent);
        }
      } else if (type !== 'SEQEND' && type !== 'VERTEX' && warnings) {
        if (warnings.indexOf(type) < 0 && warnings.length < 12) warnings.push(type);
      }
      /* POLYLINE consume sus VERTEX */
      if (type === 'POLYLINE') {
        var k = j;
        while (k < to && !(pairs[k][0] === 0 && pairs[k][1] === 'SEQEND')) k++;
        i = k + 1;
      } else i = j;
    }
    return out;
  }

  function get(codes, code, def) {
    var n = codes.length;
    if (n > 40) {
      var m = codes._map;
      if (!m) {
        m = codes._map = new Map();
        for (var j = 0; j < n; j++) if (!m.has(codes[j][0])) m.set(codes[j][0], codes[j][1]);
      }
      return m.has(code) ? m.get(code) : def;
    }
    for (var i = 0; i < n; i++) if (codes[i][0] === code) return codes[i][1];
    return def;
  }
  function getAll(codes, code) {
    var o = [];
    for (var i = 0; i < codes.length; i++) if (codes[i][0] === code) o.push(codes[i][1]);
    return o;
  }
  /* ------------------------------------------------------------
     Estilo de acotación

     De toda la tabla sólo se leía la altura de texto: el resto —tamaño
     de flecha, salientes de las líneas de extensión, hueco del texto,
     escala general, decimales, tolerancias, colores— se tiraba y cada
     cota importada se dibujaba con el estilo de fábrica.  Un plano
     ajeno llegaba con todas las cotas cambiadas de aspecto.
     ------------------------------------------------------------ */
  var DIMMAP = {
    40: 'DIMSCALE', 41: 'DIMASZ', 42: 'DIMEXO', 43: 'DIMDLI', 44: 'DIMEXE',
    45: 'DIMRND', 46: 'DIMDLE', 47: 'DIMTP', 48: 'DIMTM',
    140: 'DIMTXT', 141: 'DIMCEN', 142: 'DIMTSZ', 143: 'DIMALTF', 144: 'DIMLFAC',
    145: 'DIMTVP', 146: 'DIMTFAC', 147: 'DIMGAP',
    71: 'DIMTOL', 72: 'DIMLIM', 73: 'DIMTIH', 74: 'DIMTOH', 75: 'DIMSE1', 76: 'DIMSE2',
    77: 'DIMTAD', 78: 'DIMZIN',
    170: 'DIMALT', 171: 'DIMALTD', 172: 'DIMTOFL', 174: 'DIMTIX', 175: 'DIMSOXD',
    176: 'DIMCLRD', 177: 'DIMCLRE', 178: 'DIMCLRT', 179: 'DIMADEC',
    271: 'DIMDEC', 272: 'DIMTDEC', 275: 'DIMAUNIT', 277: 'DIMLUNIT',
    279: 'DIMTMOVE', 280: 'DIMJUST', 281: 'DIMSD1', 282: 'DIMSD2',
    289: 'DIMATFIT'
  };

  function leeDimStyle(rec) {
    var ds = E.defaultDimStyle(rec.name);
    var cs = rec.codes || [];
    for (var i = 0; i < cs.length; i++) {
      var c = cs[i][0], v = cs[i][1];
      var k = DIMMAP[c];
      if (k !== undefined && typeof v === 'number') { ds[k] = v; continue; }
      if (c === 3) ds.DIMPOST = String(v || '');
      else if (c === 4) ds.DIMAPOST = String(v || '');
    }
    /* el grupo 2 de un DIMSTYLE es su nombre, no un sufijo */
    ds.name = rec.name;
    return ds;
  }

  /* A qué familia del navegador se parece cada fuente de AutoCAD.  Las
     .shx de trazos van con la de palotes; las de verdad, con la suya. */
  function fuenteCss(f) {
    var n = String(f || '').toLowerCase();
    if (/arial/.test(n)) return 'Arial';
    if (/times|romant/.test(n)) return 'Times New Roman';
    if (/courier|monotxt/.test(n)) return 'Courier New';
    if (/verdana/.test(n)) return 'Verdana';
    if (/tahoma/.test(n)) return 'Tahoma';
    if (/calibri/.test(n)) return 'Calibri';
    if (/century|cityblueprint/.test(n)) return 'Century Gothic';
    /* las de trazos más corrientes se ven bien con una sans normal */
    if (/simplex|romans|isocp|iso3098|gothic|txt/.test(n)) return 'AcadStick';
    if (/\.ttf$/.test(n)) return f.replace(/\.ttf$/i, '');
    return 'AcadStick';
  }

  function common(codes) {
    var o = { layer: String(get(codes, 8, '0')), ltscale: get(codes, 48, 1) };
    var c = get(codes, 62, undefined);
    o.color = c === undefined ? 256 : (c < 0 ? 256 : c);
    var tc = get(codes, 420, undefined);
    if (tc !== undefined) o.color = { rgb: [(tc >> 16) & 255, (tc >> 8) & 255, tc & 255] };
    var lt = get(codes, 6, undefined);
    o.ltype = lt === undefined ? 'ByLayer' : String(lt);
    var lw = get(codes, 370, undefined);
    o.lw = lw === undefined ? -1 : lw;
    /* Transparencia: el grupo 440 lleva 0x02000000 más el alfa en el
       byte bajo, de 0 (del todo transparente) a 255 (opaco).  El
       programa la guarda como porcentaje de transparencia, al revés.
       No se leía, así que un sombreado traslúcido llegaba opaco. */
    var tr = get(codes, 440, undefined);
    if (tr !== undefined && (Number(tr) & 0x02000000)) {
      var alfa = Number(tr) & 255;
      o.transparency = Math.max(0, Math.min(100, Math.round((255 - alfa) / 2.55)));
    }
    return o;
  }

  /* ------------------------------------------------------------
     DIRECTRIZ MÚLTIPLE (MULTILEADER)

     Es la directriz de los dibujos modernos: sustituyó a LEADER hace
     veinte años y cualquier plano de hoy viene lleno de ellas.  Antes se
     descartaban en silencio —se avisaba, pero el texto de todas las
     llamadas se perdía— y un plano importado quedaba mudo.

     Todo lo que interesa vive dentro del bloque CONTEXT_DATA, que va
     anidado con marcas de apertura y cierre repartidas por códigos
     distintos: 300 abre el contexto y 301 lo cierra, 302 abre cada
     directriz y 303 la cierra, y 304 sirve para DOS cosas —abre una
     línea de directriz cuando su valor es "LEADER_LINE{" y, si no, es el
     texto de la llamada—.  El 305 cierra la línea.
     ------------------------------------------------------------ */
  function leeMLeader(codes, o) {
    var texto = '', alto = 0, ctx = 0, enDir = 0, linea = null;
    var lineas = [], pendiente = null;
    var aterriza = null, codo = null, largoCodo = 0, posTexto = null;
    var i, c, v;
    for (i = 0; i < codes.length; i++) {
      c = codes[i][0]; v = codes[i][1];
      if (c === 300) { ctx = 1; continue; }
      if (c === 301) { ctx = 0; continue; }
      if (!ctx) continue;
      if (c === 302) { enDir = 1; continue; }
      if (c === 303) { enDir = 0; continue; }
      if (c === 304) {
        if (/LEADER_LINE/.test(String(v))) linea = [];
        else texto = unescapeTxt(String(v));
        continue;
      }
      if (c === 305) { if (linea && linea.length) lineas.push(linea); linea = null; continue; }
      if (c === 10) { pendiente = Number(v); continue; }
      if (c === 20) {
        if (pendiente === null) continue;
        var q = { x: pendiente, y: Number(v) };
        pendiente = null;
        if (linea) linea.push(q);
        else if (enDir) aterriza = q;         /* punto de aterrizaje */
        continue;
      }
      if (!enDir) {
        if (c === 41 && !alto) alto = Number(v) || 0;
        else if (c === 12) posTexto = { x: Number(v), y: 0 };
        else if (c === 22 && posTexto) posTexto.y = Number(v);
        continue;
      }
      /* dentro de LEADER{ */
      if (linea) continue;
      if (c === 11) codo = { x: Number(v), y: 0 };
      else if (c === 21 && codo) codo.y = Number(v);
      else if (c === 40 && !largoCodo) largoCodo = Number(v) || 0;
    }
    if (!lineas.length && !aterriza) return null;

    function remata(pts) {
      var out = [];
      pts.forEach(function (p) {
        if (!out.length || G.dist(out[out.length - 1], p) > 1e-9) out.push({ x: p.x, y: p.y });
      });
      return out;
    }
    var salida = [];
    lineas.forEach(function (pts, k) {
      var cam = pts.slice();
      if (aterriza) cam.push(aterriza);
      if (codo && largoCodo) {
        var n = Math.hypot(codo.x, codo.y) || 1;
        var base = aterriza || cam[cam.length - 1];
        cam.push({ x: base.x + codo.x / n * largoCodo, y: base.y + codo.y / n * largoCodo });
      }
      cam = remata(cam);
      if (cam.length < 2) return;
      /* el texto va en la primera: las demás son flechas extra de la
         misma llamada y comparten el rótulo */
      var d = E.leader(cam, k === 0 ? texto : '', o);
      if (alto) d.h = alto;
      salida.push(d);
    });
    if (!salida.length) {
      /* una llamada sin línea de directriz: al menos el texto no se pierde */
      if (texto && posTexto) return E.mtext(posTexto, alto || 2.5, texto, 0, o);
      return null;
    }
    return salida.length === 1 ? salida[0] : salida;
  }

  /* ------------------------------------------------------------
     WIPEOUT: el recuadro que tapa lo que hay debajo.  No se puede
     reproducir el tapado sin saber el orden de dibujo y el fondo, pero
     sí el contorno, que es lo que permite volver a colocarlo y volver a
     exportarlo.  Los vértices vienen en coordenadas de imagen, de -0,5 a
     0,5, y se llevan al dibujo con los vectores U y V.
     ------------------------------------------------------------ */
  function leeWipeout(codes, o) {
    var ins = { x: get(codes, 10, 0), y: get(codes, 20, 0) };
    var u = { x: get(codes, 11, 1), y: get(codes, 21, 0) };
    var vv = { x: get(codes, 12, 0), y: get(codes, 22, 1) };
    var sx = get(codes, 13, 1), sy = get(codes, 23, 1);
    var cx = getAll(codes, 14), cy = getAll(codes, 24);
    if (cx.length < 2) return null;
    var pts = [];
    for (var i = 0; i < cx.length; i++) {
      var a = cx[i] + 0.5, b = (cy[i] === undefined ? 0 : cy[i]) + 0.5;
      pts.push({ x: ins.x + u.x * a * sx + vv.x * b * sy,
                 y: ins.y + u.y * a * sx + vv.y * b * sy });
    }
    /* dos vértices son las esquinas opuestas de un rectángulo */
    if (pts.length === 2) {
      var p0 = pts[0], p1 = pts[1];
      pts = [p0, { x: p1.x, y: p0.y }, p1, { x: p0.x, y: p1.y }];
    }
    return E.pline(pts, true, o);
  }

  /* ------------------------------------------------------------
     Contornos de un sombreado

     Un contorno de HATCH viene de dos maneras: como polilínea —con sus
     bulges— o como una lista de bordes sueltos, y cada borde puede ser
     una recta, un arco, un arco de elipse o una spline.  Aquí se leían
     sólo las parejas 10/20 de cualquier cosa, así que:

       · un sombreado con el contorno circular —lo más corriente del
         mundo— se quedaba con un único punto, el centro del círculo, y
         como con menos de tres puntos no hay contorno, se perdía el
         sombreado entero;
       · una polilínea con bulges perdía las curvas;
       · lo mismo con las elipses y las splines.

     Ahora cada tipo de borde se convierte en los puntos que le
     corresponden.
     ------------------------------------------------------------ */
  function arcoPts(c, r, a0, a1, ccw, salida) {
    var sw = ccw ? G.sweep(a0, a1) : -G.sweep(a1, a0);
    if (Math.abs(sw) < 1e-9) sw = ccw ? G.TAU : -G.TAU;
    var n = Math.max(6, Math.ceil(Math.abs(sw) / G.TAU * 64));
    for (var i = 0; i <= n; i++) {
      var t = a0 + sw * i / n;
      salida.push({ x: c.x + r * Math.cos(t), y: c.y + r * Math.sin(t) });
    }
  }

  function elipsePts(c, maj, ratio, a0, a1, ccw, salida) {
    var sw = ccw ? G.sweep(a0, a1) : -G.sweep(a1, a0);
    if (Math.abs(sw) < 1e-9) sw = ccw ? G.TAU : -G.TAU;
    var n = Math.max(8, Math.ceil(Math.abs(sw) / G.TAU * 96));
    for (var i = 0; i <= n; i++)
      salida.push(G.ellPt(c, maj.x, maj.y, ratio, a0 + sw * i / n));
  }

  /* ------------------------------------------------------------
     Sistema de coordenadas del objeto (OCS)

     Una entidad plana no guarda sus puntos en el sistema del dibujo sino
     en el suyo, definido por la dirección de extrusión (210/220/230).
     Cuando vale (0,0,1) —lo normal— coinciden y no hay nada que hacer,
     pero AutoCAD escribe (0,0,-1) en cuanto algo se simetriza o se
     dibuja con un SCP volteado, y entonces la X va al revés.  Sin esto,
     parte de la geometría de un plano ajeno aparecía en espejo y en otro
     sitio, sin que nada avisara.

     La base se saca con el algoritmo del eje arbitrario, que es el que
     manda el formato. ------------------------------------------------------------ */
  function cruz3(a, b) {
    return [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
  }
  function norm3(a) {
    var l = Math.hypot(a[0], a[1], a[2]);
    return l < 1e-12 ? [0, 0, 0] : [a[0] / l, a[1] / l, a[2] / l];
  }

  function aplicaOCS(ent, codes, doc) {
    if (!ent) return ent;
    var ez = get(codes, 230, 1), ex = get(codes, 210, 0), ey = get(codes, 220, 0);
    if (Math.abs(ex) < 1e-12 && Math.abs(ey) < 1e-12 && ez >= 0) return ent;
    var az = norm3([ex, ey, ez]);
    if (!az[0] && !az[1] && !az[2]) return ent;
    var ax = norm3(Math.abs(az[0]) < 1 / 64 && Math.abs(az[1]) < 1 / 64
      ? cruz3([0, 1, 0], az) : cruz3([0, 0, 1], az));
    if (!ax[0] && !ax[1] && !ax[2]) return ent;
    var ay = norm3(cruz3(az, ax));
    var m = G.M(ax[0], ax[1], ay[0], ay[1], 0, 0);
    if (Math.abs(G.mDet(m)) < 1e-12) return ent;
    var lista = Array.isArray(ent) ? ent : [ent];
    for (var i = 0; i < lista.length; i++) {
      var x = lista[i];
      /* los sólidos y las mallas ya vienen en tres dimensiones */
      if (!x || x.type === 'SOLID3D' || x.type === 'MESH') continue;
      try { E.transform(x, m, doc); } catch (e) { }
    }
    return ent;
  }

  function contornosHatch(codes) {
    var loops = [], i, c, v;
    var pathFlag = null, esPoli = false, cerrada = true;
    var pts = null;          /* puntos del contorno en curso */
    var borde = null;        /* códigos del borde en curso */
    var poliVerts = null, pendiente = null;

    function cierraBorde() {
      if (!borde || !pts) { borde = null; return; }
      var t = borde.tipo;
      var q = function (k, d) { return borde[k] === undefined ? d : borde[k]; };
      if (t === 1) {
        pts.push({ x: q(10, 0), y: q(20, 0) });
        pts.push({ x: q(11, 0), y: q(21, 0) });
      } else if (t === 2) {
        arcoPts({ x: q(10, 0), y: q(20, 0) }, q(40, 1),
                G.rad(q(50, 0)), G.rad(q(51, 360)), q(73, 1) !== 0, pts);
      } else if (t === 3) {
        elipsePts({ x: q(10, 0), y: q(20, 0) }, { x: q(11, 1), y: q(21, 0) }, q(40, 1),
                  G.rad(q(50, 0)), G.rad(q(51, 360)), q(73, 1) !== 0, pts);
      } else if (t === 4 && borde.ctrl && borde.ctrl.length >= 2) {
        var nb = E.splineNurbs({ ctrl: borde.ctrl, knots: borde.knots, degree: borde.grado || 3,
                                 weights: borde.pesos });
        var sp = nb ? E.nurbsPts(nb) : borde.ctrl;
        for (var k = 0; k < sp.length; k++) pts.push({ x: sp[k].x, y: sp[k].y });
      }
      borde = null;
    }

    function cierraPoli() {
      if (!poliVerts || !pts) { poliVerts = null; return; }
      var n = poliVerts.length, last = cerrada ? n : n - 1;
      for (var k = 0; k < last; k++) {
        var a = poliVerts[k], b = poliVerts[(k + 1) % n];
        pts.push({ x: a.x, y: a.y });
        if (a.b) {
          var arc = G.bulgeArc(a, b, a.b);
          if (arc) {
            var tmp = [];
            arcoPts(arc.c, arc.r, arc.a0, arc.a1, arc.ccw, tmp);
            for (var j = 1; j < tmp.length - 1; j++) pts.push(tmp[j]);
          }
        }
      }
      if (!cerrada && n) pts.push({ x: poliVerts[n - 1].x, y: poliVerts[n - 1].y });
      poliVerts = null;
    }

    function cierraPath() {
      cierraBorde();
      cierraPoli();
      if (pts) {
        /* se quitan los puntos repetidos que dejan los bordes al
           encadenarse: el final de uno es el principio del siguiente */
        var limpio = [];
        for (var k = 0; k < pts.length; k++) {
          var p = pts[k];
          if (!limpio.length || G.dist(limpio[limpio.length - 1], p) > 1e-9) limpio.push(p);
        }
        while (limpio.length > 2 && G.dist(limpio[0], limpio[limpio.length - 1]) < 1e-9) limpio.pop();
        if (limpio.length > 2) loops.push(limpio);
      }
      pts = null;
    }

    for (i = 0; i < codes.length; i++) {
      c = codes[i][0]; v = codes[i][1];
      if (c === 92) {
        cierraPath();
        pathFlag = v | 0;
        esPoli = !!(pathFlag & 2);
        cerrada = true;
        pts = [];
        poliVerts = esPoli ? [] : null;
        pendiente = null;
        continue;
      }
      if (pts === null) continue;
      if (c === 97 || c === 330) { cierraPath(); continue; }
      if (esPoli) {
        if (c === 73) { cerrada = v !== 0; continue; }
        if (c === 10) { pendiente = v; continue; }
        if (c === 20) { if (pendiente !== null) { poliVerts.push({ x: pendiente, y: v, b: 0 }); pendiente = null; } continue; }
        if (c === 42 && poliVerts.length) { poliVerts[poliVerts.length - 1].b = v; continue; }
        continue;
      }
      if (c === 72) { cierraBorde(); borde = { tipo: v | 0, ctrl: [], knots: [], pesos: [] }; continue; }
      if (!borde) continue;
      if (borde.tipo === 4) {
        if (c === 94) borde.grado = v | 0;
        else if (c === 40) borde.knots.push(v);
        else if (c === 10) pendiente = v;
        else if (c === 20) { if (pendiente !== null) { borde.ctrl.push({ x: pendiente, y: v }); pendiente = null; } }
        else if (c === 42) borde.pesos.push(v);
        continue;
      }
      if (borde[c] === undefined) borde[c] = v;
    }
    cierraPath();
    return loops;
  }

  function buildEntity(type, codes, pairs, idx, to, doc) {
    var o = common(codes);
    switch (type) {
      case 'LINE':
        return E.line({ x: get(codes, 10, 0), y: get(codes, 20, 0) }, { x: get(codes, 11, 0), y: get(codes, 21, 0) }, o);
      case 'CIRCLE':
        return E.circle({ x: get(codes, 10, 0), y: get(codes, 20, 0) }, get(codes, 40, 1), o);
      case 'ARC':
        return E.arc({ x: get(codes, 10, 0), y: get(codes, 20, 0) }, get(codes, 40, 1),
          G.rad(get(codes, 50, 0)), G.rad(get(codes, 51, 90)), o);
      case 'POINT':
        return E.point({ x: get(codes, 10, 0), y: get(codes, 20, 0) }, o);
      case 'XLINE': case 'RAY': {
        var dr = { x: get(codes, 11, 1), y: get(codes, 21, 0) };
        if (!dr.x && !dr.y) dr = { x: 1, y: 0 };
        var org = { x: get(codes, 10, 0), y: get(codes, 20, 0) };
        return type === 'XLINE' ? E.xline(org, dr, o) : E.ray(org, dr, o);
      }
      case 'ELLIPSE':
        return E.ellipse({ x: get(codes, 10, 0), y: get(codes, 20, 0) },
          { x: get(codes, 11, 1), y: get(codes, 21, 0) }, get(codes, 40, 1),
          get(codes, 41, 0), get(codes, 42, G.TAU), o);
      case 'LWPOLYLINE': {
        /* los anchos de cada vértice (40 inicial, 41 final) se perdían:
           una polilínea que va de gruesa a fina —una flecha, una pista,
           una marca vial— llegaba como una raya de grosor cero */
        var verts = [], cur = null;
        codes.forEach(function (c) {
          if (c[0] === 10) { cur = { x: c[1], y: 0, b: 0, sw: 0, ew: 0 }; verts.push(cur); return; }
          if (!cur) return;
          if (c[0] === 20) cur.y = c[1];
          else if (c[0] === 42) cur.b = c[1];
          else if (c[0] === 40) cur.sw = c[1];
          else if (c[0] === 41) cur.ew = c[1];
        });
        if (verts.length < 2) return null;
        var pl = E.pline(verts, !!(get(codes, 70, 0) & 1), o);
        pl.width = get(codes, 43, 0);
        return pl;
      }
      case 'POLYLINE': {
        var flags = get(codes, 70, 0);
        /* bandera 64 = POLYFACE MESH, 16 = malla poligonal: se leen como
           malla 3D en vez de como polilínea plana */
        if ((flags & 64) || (flags & 16)) return readMesh(pairs, idx, to, o, flags, codes);
        var vs = [], k = idx + 1;
        while (k < to) {
          if (pairs[k][0] === 0) {
            if (pairs[k][1] === 'SEQEND') break;
            if (pairs[k][1] === 'VERTEX') {
              var vc = [], m = k + 1;
              while (m < to && pairs[m][0] !== 0) { vc.push(pairs[m]); m++; }
              var vf = get(vc, 70, 0);
              if (!(vf & 16) && !(vf & 8) || true) {
                vs.push({ x: get(vc, 10, 0), y: get(vc, 20, 0), b: get(vc, 42, 0),
                          sw: get(vc, 40, 0), ew: get(vc, 41, 0) });
              }
              k = m; continue;
            }
          }
          k++;
        }
        if (vs.length < 2) return null;
        return E.pline(vs, !!(flags & 1), o);
      }
      case 'SPLINE': {
        /* La curva la definen los puntos de CONTROL con su vector de
           nudos (40) y, si es racional, sus pesos (41).  Los puntos de
           ajuste (11/21) son opcionales y sólo cuentan por dónde pasó
           quien la dibujó.  Meterlos todos en el mismo saco —que es lo
           que se hacía— deformaba cualquier spline importada. */
        var fx = [], fy = [], cx = [], cy = [], kn = [], wg = [];
        codes.forEach(function (c) {
          if (c[0] === 11) fx.push(c[1]); else if (c[0] === 21) fy.push(c[1]);
          else if (c[0] === 10) cx.push(c[1]); else if (c[0] === 20) cy.push(c[1]);
          else if (c[0] === 40) kn.push(c[1]); else if (c[0] === 41) wg.push(c[1]);
        });
        var fit = fx.map(function (x, k2) { return { x: x, y: fy[k2] || 0 }; });
        var ctrl = cx.map(function (x, k2) { return { x: x, y: cy[k2] || 0 }; });
        if (fit.length < 2 && ctrl.length < 2) return null;
        var flags = get(codes, 70, 0);
        var sp = E.spline(fit.length >= 2 ? fit : [], !!(flags & 1), o);
        sp.ctrl = ctrl;
        sp.degree = Math.max(1, get(codes, 71, 3));
        sp.knots = kn.length ? kn : null;
        /* los pesos sólo valen si vienen uno por punto de control: hay
           programas que escriben el grupo 41 sólo en los que no son 1 */
        sp.weights = (wg.length === ctrl.length && wg.some(function (w) { return w !== 1; })) ? wg : null;
        sp.periodica = !!(flags & 2);
        if (!sp.fit.length && !ctrl.length) return null;
        return sp;
      }
      case 'TEXT': {
        var ha = get(codes, 72, 0), va = get(codes, 73, 0);
        var p = { x: get(codes, 10, 0), y: get(codes, 20, 0) };
        var p2 = { x: get(codes, 11, undefined), y: get(codes, 21, undefined) };
        if ((ha || va) && p2.x !== undefined) p = p2;
        var te = E.text(p, get(codes, 40, 2.5), unescapeTxt(String(get(codes, 1, ''))), G.rad(get(codes, 50, 0)), o);
        te.style = String(get(codes, 7, 'Standard'));
        te.halign = ha; te.valign = va;
        te.wfac = get(codes, 41, 1); te.oblique = get(codes, 51, 0);
        return te;
      }
      case 'MTEXT': {
        var mx = getAll(codes, 1001), mk = getAll(codes, 1000);
        var esDir = false;
        for (var mi = 0; mi < mx.length; mi++)
          if (String(mx[mi]) === 'MONXUCAD' && String(mk[mi]) === 'DIRECTRIZ') esDir = true;
        var chunks = getAll(codes, 3).join('') + String(get(codes, 1, ''));
        var mt = E.mtext({ x: get(codes, 10, 0), y: get(codes, 20, 0) }, get(codes, 40, 2.5),
          unescapeTxt(chunks), get(codes, 41, 0), o);
        mt.attach = get(codes, 71, 1);
        mt.style = String(get(codes, 7, 'Standard'));
        var rx = get(codes, 11, undefined);
        mt.rot = rx !== undefined && get(codes, 50, undefined) === undefined
          ? Math.atan2(get(codes, 21, 0), rx) : G.rad(get(codes, 50, 0));
        if (esDir) mt.__dirTexto = true;
        return mt;
      }
      case 'INSERT': {
        var ins = E.insert(String(get(codes, 2, '')), { x: get(codes, 10, 0), y: get(codes, 20, 0) }, o);
        ins.sx = get(codes, 41, 1); ins.sy = get(codes, 42, 1);
        ins.rot = G.rad(get(codes, 50, 0));
        /* Una inserción puede traer su propia matriz (filas y columnas);
           se reparte en inserciones sueltas, que es lo que se puede
           editar después una a una.  El paso va por los ejes girados,
           como en AutoCAD. */
        var cols = Math.max(1, get(codes, 70, 1) | 0);
        var rows = Math.max(1, get(codes, 71, 1) | 0);
        if (cols === 1 && rows === 1) return ins;
        var dc = get(codes, 44, 0), dr = get(codes, 45, 0);
        if (cols * rows > 10000) return ins;     /* algo va mal en el fichero */
        var co = Math.cos(ins.rot), si = Math.sin(ins.rot), salida = [];
        for (var fr = 0; fr < rows; fr++) for (var cl = 0; cl < cols; cl++) {
          var dx = cl * dc, dy = fr * dr;
          var q = E.deep(ins);
          q.p = { x: ins.p.x + dx * co - dy * si, y: ins.p.y + dx * si + dy * co };
          salida.push(q);
        }
        return salida;
      }
      case 'SOLID': case 'TRACE': case '3DFACE': {
        var q0 = { x: get(codes, 10, 0), y: get(codes, 20, 0) };
        var q1 = { x: get(codes, 11, 0), y: get(codes, 21, 0) };
        var q2 = { x: get(codes, 12, 0), y: get(codes, 22, 0) };
        var q3 = { x: get(codes, 13, undefined), y: get(codes, 23, undefined) };
        var pts;
        if (type === '3DFACE') {
          /* si tiene relieve se conserva como malla 3D, no como sólido plano */
          var zz = [get(codes, 30, 0), get(codes, 31, 0), get(codes, 32, 0), get(codes, 33, 0)];
          if (CAD.Solid && zz.some(function (v) { return Math.abs(v) > 1e-9; })) {
            var G3x = CAD.G3;
            var mv = [G3x.v(q0.x, q0.y, zz[0]), G3x.v(q1.x, q1.y, zz[1]), G3x.v(q2.x, q2.y, zz[2])];
            var mf = [[0, 1, 2]];
            if (q3.x !== undefined && (Math.abs(q3.x - q2.x) > 1e-9 || Math.abs(q3.y - q2.y) > 1e-9 ||
                                       Math.abs(zz[3] - zz[2]) > 1e-9)) {
              mv.push(G3x.v(q3.x, q3.y, zz[3]));
              mf = [[0, 1, 2, 3]];
            }
            return CAD.Solid.mesh(CAD.Mesh.make(mv, mf), o);
          }
          pts = q3.x === undefined ? [q0, q1, q2] : [q0, q1, q2, q3];
        }
        if (!pts) pts = (q3.x === undefined || (Math.abs(q3.x - q2.x) < 1e-9 && Math.abs(q3.y - q2.y) < 1e-9))
          ? [q0, q1, q2] : [q0, q1, q3, q2];
        return E.solid(pts, o);
      }
      case 'HATCH': {
        var pattern = String(get(codes, 2, 'ANSI31'));
        var isSolid = !!get(codes, 70, 0);
        var loops = contornosHatch(codes);
        if (!loops.length) return null;
        var ha2 = E.hatch(loops, o);
        ha2.pattern = isSolid ? 'SOLID' : pattern;
        ha2.solid = isSolid;
        ha2.angle = G.rad(get(codes, 52, 0));
        ha2.scale = get(codes, 41, 1) || 1;
        return ha2;
      }
      case 'DIMENSION': {
        /* Se reconstruye la cota de verdad, no una referencia al bloque
           de geometría: así se puede seguir editando y sigue midiendo
           sola.  El tipo viene del código 70 y, cuando lo hay, de los
           datos extendidos que escribe MonxuCAD. */
        var flags = get(codes, 70, 0) | 0;
        var base = flags & 15;
        var KIND = { 0: 'linear', 1: 'aligned', 2: 'angular', 3: 'diameter',
                     4: 'radius', 5: 'angular', 6: 'ordinate', 7: 'arclen' };
        var kind = KIND[base] || 'linear';
        var xs = getAll(codes, 1001), xk = getAll(codes, 1000);
        for (var xi = 0; xi < xs.length; xi++)
          if (String(xs[xi]) === 'MONXUCAD' && xk[xi] !== undefined) {
            var kk = String(xk[xi]);
            if (/^(linear|rotated|aligned|angular|radius|diameter|arclen|ordinate)$/.test(kk)) kind = kk;
          }
        var P = function (c) { return { x: get(codes, c, 0), y: get(codes, c + 10, 0) }; };
        var tiene = function (c) { return get(codes, c, undefined) !== undefined; };
        var d10 = P(10), d11 = P(11), d13 = P(13), d14 = P(14), d15 = P(15), d16 = P(16);
        var dm = E.dim(kind, o);
        dm.style = String(get(codes, 3, 'ISO-25'));
        var ov = get(codes, 1, undefined);
        if (ov !== undefined && String(ov)) dm.textOverride = String(ov);
        if (tiene(11)) dm.textPos = d11;
        switch (kind) {
          case 'linear': case 'rotated':
            dm.p1 = d13; dm.p2 = d14; dm.rot = G.rad(get(codes, 50, 0));
            dm.p3 = tiene(10) ? d10 : d11;
            break;
          case 'aligned':
            dm.p1 = d13; dm.p2 = d14; dm.p3 = tiene(10) ? d10 : d11;
            break;
          case 'radius':
            dm.center = d10; dm.p1 = tiene(15) ? d15 : d10;
            break;
          case 'diameter':
            dm.center = { x: (d10.x + d15.x) / 2, y: (d10.y + d15.y) / 2 };
            dm.p1 = tiene(15) ? d15 : d10;
            break;
          case 'angular': case 'arclen':
            dm.center = d15; dm.p1 = d13; dm.p2 = d14; dm.p3 = tiene(16) ? d16 : d10;
            break;
          case 'ordinate': {
            dm.p1 = d13; dm.p2 = tiene(14) ? d14 : d11;
            var xo = getAll(codes, 1070);
            dm.ordX = xo.length ? !!xo[0] : Math.abs(dm.p2.y - dm.p1.y) > Math.abs(dm.p2.x - dm.p1.x);
            break;
          }
        }
        try { CAD.Dim.build(dm, doc); } catch (err) { }
        return dm;
      }
      case 'LEADER': {
        var lx = getAll(codes, 10), ly = getAll(codes, 20);
        if (lx.length < 2) return null;
        var pts2 = lx.map(function (x, k3) { return { x: x, y: ly[k3] || 0 }; });
        return E.leader(pts2, '', o);
      }
      case 'MULTILEADER': case 'MLEADER':
        return leeMLeader(codes, o);
      case 'WIPEOUT':
        return leeWipeout(codes, o);
      case 'ATTDEF': {
        var ad = E.attdef({ x: get(codes, 10, 0), y: get(codes, 20, 0) }, get(codes, 40, 2.5),
          String(get(codes, 2, 'ETIQUETA')), unescapeTxt(String(get(codes, 3, ''))),
          unescapeTxt(String(get(codes, 1, ''))), o);
        ad.rot = G.rad(get(codes, 50, 0));
        ad.style = String(get(codes, 7, 'Standard'));
        ad.halign = get(codes, 72, 0); ad.valign = get(codes, 74, 0);
        ad.flags = get(codes, 70, 0);
        if (ad.halign || ad.valign) {
          var q = { x: get(codes, 11, undefined), y: get(codes, 21, undefined) };
          if (q.x !== undefined) ad.p = q;
        }
        return ad;
      }
      case 'ATTRIB': {
        /* Atributo de verdad: quien lo lee lo engancha a su INSERT.  Si
           llega suelto, el lector lo convierte en texto para que al menos
           se vea. */
        var av = E.attrib({ x: get(codes, 10, 0), y: get(codes, 20, 0) }, get(codes, 40, 2.5),
          String(get(codes, 2, '')), unescapeTxt(String(get(codes, 1, ''))), o);
        av.rot = G.rad(get(codes, 50, 0));
        av.style = String(get(codes, 7, 'Standard'));
        av.halign = get(codes, 72, 0); av.valign = get(codes, 74, 0);
        av.flags = get(codes, 70, 0);
        if (av.halign || av.valign) {
          var q2 = { x: get(codes, 11, undefined), y: get(codes, 21, undefined) };
          if (q2.x !== undefined) av.p = q2;
        }
        return av;
      }
      default: return null;
    }
  }

  /* Texto con formato de AutoCAD a texto llano.

     El barrido de códigos era demasiado goloso: el patrón que borra
     «\f...;» se llevaba por delante también «\S+0,05^-0,05;», que no es
     formato sino contenido —una tolerancia apilada—, y la dejaba en
     nada.  Los caracteres escritos como \U+00B0 tampoco se traducían.
     Se resuelven primero las fracciones y los escapes, y sólo después
     se barre lo que de verdad es formato. */
  function unescapeTxt(s) {
    var t = String(s === undefined || s === null ? '' : s);
    /* los escapes de barra se apartan para que no los pise nada */
    t = t.replace(/\\\\/g, '\u0001').replace(/\\\{/g, '\u0002').replace(/\\\}/g, '\u0003');
    t = t.replace(/\\P/g, '\n').replace(/\\p[^;]*;/g, '\n').replace(/\\~/g, ' ');
    /* fracciones apiladas: numerador, separador ^ / o #, denominador */
    t = t.replace(/\\S([^;]*);/g, function (_, cuerpo) {
      var m = cuerpo.match(/^(.*?)[\^#\/](.*)$/);
      if (!m) return cuerpo;
      if (!m[2]) return m[1];
      if (!m[1]) return m[2];
      return m[1] + '/' + m[2];
    });
    t = t.replace(/\\U\+([0-9A-Fa-f]{4})/g, function (_, h) { return String.fromCharCode(parseInt(h, 16)); });
    t = t.replace(/\\M\+[0-9A-Fa-f]{5}/g, '');
    /* ahora sí, los códigos de formato y las llaves de agrupación */
    t = t.replace(/\\[A-Za-z][^;\\]*;/g, '').replace(/\\[LlOoKk]/g, '').replace(/[{}]/g, '');
    t = t.replace(/%%(\d{3})/g, function (_, n) { return String.fromCharCode(parseInt(n, 10)); })
         .replace(/%%[dD]/g, '°').replace(/%%[cC]/g, 'Ø').replace(/%%[pP]/g, '±')
         .replace(/%%[uUoO]/g, '').replace(/%%%/g, '%');
    return t.replace(/\u0001/g, '\\').replace(/\u0002/g, '{').replace(/\u0003/g, '}');
  }
  DXF.unescapeTxt = unescapeTxt;
})();
