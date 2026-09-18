/* ============================================================
   commands-draw.js — Comandos de dibujo
   ============================================================ */
(function () {
  'use strict';
  var CAD = window.CAD, G = CAD.G, E = CAD.E, Cmd = CAD.Cmd;

  function isKw(v) { return !!(v && v.kw); }
  function pt(v) { return v && v.x !== undefined ? v : null; }
  var CU = CAD.CU = {
    isKw: isKw,
    add: function (ctx, ents) {
      var a = Array.isArray(ents) ? ents : [ents];
      a.forEach(function (e) { ctx.doc.add(e); });
      ctx.app.refresh();
      return a;
    }
  };

  /* ============================================================
     LÍNEA
     ============================================================ */
  Cmd.add(['LINEA', 'LINE', 'L'], { group: 'draw', icon: 'line', title: 'Línea' }, async function (ctx) {
    var first = await ctx.getPoint('Precise primer punto');
    if (!pt(first)) return;
    ctx.doc.mark('LINEA');
    var prev = first, start = first, created = [];
    while (true) {
      var kws = created.length >= 1 ? ['Cerrar', 'desHacer'] : ['desHacer'];
      var p = await ctx.getPoint('Precise punto siguiente o', {
        base: prev, rubber: 'line', keywords: kws, allowNone: true,
        preview: function (c) { return [E.line(prev, c, { color: undefined })]; }
      });
      if (p === null) break;
      if (isKw(p)) {
        if (p.kw === 'C') {
          if (created.length >= 1) { CU.add(ctx, E.line(prev, start)); }
          break;
        }
        if (p.kw === 'H') {
          if (created.length) { ctx.doc.remove(created.pop()); prev = created.length ? created[created.length - 1].p2 : start; ctx.app.refresh(); }
          else prev = start;
          continue;
        }
        continue;
      }
      var ln = E.line(prev, p);
      ctx.doc.add(ln); created.push(ln);
      prev = p;
      ctx.app.refresh();
    }
    if (!created.length) ctx.doc.discardTx();
  });

  /* ============================================================
     POLILÍNEA
     ============================================================ */
  Cmd.add(['POL', 'POLILINEA', 'PLINE', 'PL'], { group: 'draw', icon: 'pline', title: 'Polilínea' }, async function (ctx) {
    var first = await ctx.getPoint('Precise punto inicial');
    if (!pt(first)) return;
    ctx.doc.mark('POLILINEA');
    var verts = [{ x: first.x, y: first.y, b: 0 }];
    var arcMode = false, width = 0;
    var ent = E.pline(verts, false);
    ctx.doc.add(ent);
    ctx.out('La anchura actual de línea es ' + G.fmt(width, 4));
    while (true) {
      var kws = arcMode
        ? ['Ángulo', 'CEntro', 'Cerrar', 'Dirección', 'Línea', 'Radio', 'Segundo pto', 'desHacer', 'Grosor']
        : (verts.length > 2 ? ['Arco', 'Cerrar', 'LOngitud', 'desHacer', 'Grosor'] : ['Arco', 'LOngitud', 'desHacer', 'Grosor']);
      var last = verts[verts.length - 1];
      var p = await ctx.getPoint(arcMode ? 'Precise extremo del arco o' : 'Precise punto siguiente o', {
        base: last, keywords: kws, allowNone: true,
        preview: function (c) {
          var tmp = E.pline(verts.concat([{ x: c.x, y: c.y, b: 0 }]), false);
          if (arcMode) {
            var t = tangentBulge(verts, c);
            tmp.verts[tmp.verts.length - 2].b = t;
          }
          tmp.width = width;
          return [tmp];
        }
      });
      if (p === null) break;
      if (isKw(p)) {
        switch (p.kw) {
          case 'A': arcMode = true; continue;
          case 'L': arcMode = false; continue;
          case 'C':
            if (verts.length > 2) { ent.closed = true; ctx.app.refresh(); }
            return;
          case 'H':
            if (verts.length > 1) { verts.pop(); ent.verts = verts; ctx.app.refresh(); }
            continue;
          case 'G': {
            var w1 = await ctx.getReal('Precise anchura inicial', { def: width });
            var w2 = await ctx.getReal('Precise anchura final', { def: w1 });
            width = (w1 + w2) / 2; ent.width = width;
            ctx.app.refresh();
            continue;
          }
          case 'LO': {
            var len = await ctx.getReal('Precise longitud de la línea');
            if (typeof len === 'number' && verts.length >= 2) {
              var a0 = G.ang(verts[verts.length - 2], verts[verts.length - 1]);
              var np = G.polar(last, a0, len);
              verts.push({ x: np.x, y: np.y, b: 0 });
              ent.verts = verts; ctx.app.refresh();
            }
            continue;
          }
          case 'R': {
            var rad = await ctx.getReal('Precise radio del arco');
            var pe = await ctx.getPoint('Precise extremo del arco', { base: last });
            if (pt(pe) && typeof rad === 'number') {
              var ch = G.dist(last, pe) / 2;
              if (ch <= rad) {
                var inc = 2 * Math.asin(Math.min(1, ch / rad));
                verts[verts.length - 1].b = Math.tan(inc / 4);
                verts.push({ x: pe.x, y: pe.y, b: 0 });
                ent.verts = verts; ctx.app.refresh();
              }
            }
            continue;
          }
          default: continue;
        }
      }
      if (arcMode) verts[verts.length - 1].b = tangentBulge(verts, p);
      verts.push({ x: p.x, y: p.y, b: 0 });
      ent.verts = verts;
      ctx.app.refresh();
    }
    if (verts.length < 2) { ctx.doc.remove(ent); ctx.doc.discardTx(); }
  });

  /* bulge tangente a la dirección del segmento anterior */
  function tangentBulge(verts, target) {
    var n = verts.length;
    var last = verts[n - 1];
    if (n < 2) return G.arcBulge(0, 0, true) || 0.0;
    var prev = verts[n - 2];
    var dirIn = prev.b ? tangentOut(prev, last, prev.b) : G.ang(prev, last);
    var chord = G.ang(last, target);
    var inc = 2 * G.na(chord - dirIn);
    if (inc > Math.PI * 2) inc -= Math.PI * 4;
    if (inc > Math.PI * 2 - 1e-9) inc -= Math.PI * 2;
    return Math.tan(Math.max(-Math.PI * 0.999, Math.min(Math.PI * 0.999, inc)) / 4);
  }
  function tangentOut(p1, p2, b) {
    var arc = G.bulgeArc(p1, p2, b);
    if (!arc) return G.ang(p1, p2);
    return G.ang(arc.c, p2) + (arc.ccw ? Math.PI / 2 : -Math.PI / 2);
  }

  /* ============================================================
     CÍRCULO
     ============================================================ */
  Cmd.add(['CIRCULO', 'CIRCLE', 'C'], { group: 'draw', icon: 'circle', title: 'Círculo' }, async function (ctx, args) {
    var mode = args && args[0];
    var c = null;
    if (!mode) {
      var r0 = await ctx.getPoint('Precise punto central para círculo o', { keywords: ['3P', '2P', 'Ttr (tan tan radio)'] });
      if (r0 === null) return;
      if (isKw(r0)) mode = r0.kw; else c = r0;
    }
    ctx.doc.mark('CIRCULO');
    if (mode === '3P') {
      var a = await ctx.getPoint('Precise primer punto del círculo'); if (!pt(a)) return;
      var b = await ctx.getPoint('Precise segundo punto del círculo', { base: a }); if (!pt(b)) return;
      var d = await ctx.getPoint('Precise tercer punto del círculo', {
        base: b, preview: function (p) { var cc = circ3(a, b, p); return cc ? [E.circle(cc.c, cc.r)] : []; }
      });
      if (!pt(d)) return;
      var cc = circ3(a, b, d);
      if (!cc) { ctx.err('Los puntos son colineales.'); return; }
      CU.add(ctx, E.circle(cc.c, cc.r));
      return;
    }
    if (mode === '2P') {
      var p1 = await ctx.getPoint('Precise primer extremo del diámetro del círculo'); if (!pt(p1)) return;
      var p2 = await ctx.getPoint('Precise segundo extremo del diámetro del círculo', {
        base: p1, preview: function (p) { return [E.circle(G.mid(p1, p), G.dist(p1, p) / 2)]; }
      });
      if (!pt(p2)) return;
      CU.add(ctx, E.circle(G.mid(p1, p2), G.dist(p1, p2) / 2));
      return;
    }
    if (mode === 'T') {
      var e1 = await ctx.getEntity('Precise punto en objeto para primera tangente del círculo'); if (!e1) return;
      var e2 = await ctx.getEntity('Precise punto en objeto para segunda tangente del círculo'); if (!e2) return;
      var rad = await ctx.getReal('Precise radio del círculo', { def: ctx.app.lastRadius || 10 });
      if (typeof rad !== 'number') return;
      var sol = tanTanRadius(ctx, e1, e2, rad);
      if (!sol) { ctx.err('El círculo no existe.'); return; }
      ctx.app.lastRadius = rad;
      CU.add(ctx, E.circle(sol, rad));
      return;
    }
    if (!c) return;
    var res = await ctx.getPoint('Precise radio del círculo o', {
      base: c, keywords: ['Diámetro'], def: ctx.app.lastRadius ? G.fmt(ctx.app.lastRadius, 4) : undefined,
      preview: function (p) { return [E.circle(c, Math.max(1e-9, G.dist(c, p)))]; }
    });
    var r;
    if (res === null) { r = ctx.app.lastRadius; }
    else if (isKw(res)) {
      if (res.kw === 'D') {
        var dia = await ctx.getReal('Precise diámetro del círculo', { base: c });
        if (typeof dia !== 'number') return;
        r = dia / 2;
      }
    } else if (typeof res === 'number') r = res;
    else r = G.dist(c, res);
    if (!r || r <= 0) return;
    ctx.app.lastRadius = r;
    CU.add(ctx, E.circle(c, r));
  });

  function circ3(a, b, c) {
    var ax = a.x, ay = a.y, bx = b.x, by = b.y, cx = c.x, cy = c.y;
    var d = 2 * (ax * (by - cy) + bx * (cy - ay) + cx * (ay - by));
    if (Math.abs(d) < 1e-12) return null;
    var ux = ((ax * ax + ay * ay) * (by - cy) + (bx * bx + by * by) * (cy - ay) + (cx * cx + cy * cy) * (ay - by)) / d;
    var uy = ((ax * ax + ay * ay) * (cx - bx) + (bx * bx + by * by) * (ax - cx) + (cx * cx + cy * cy) * (bx - ax)) / d;
    return { c: { x: ux, y: uy }, r: Math.hypot(ax - ux, ay - uy) };
  }
  CAD.circ3 = circ3;

  CAD.tanTanRadius = tanTanRadius;
  function tanTanRadius(ctx, e1, e2, r) {
    var doc = ctx.doc;
    var p1 = CAD.Prim.of(e1.ent, doc)[0], p2 = CAD.Prim.of(e2.ent, doc)[0];
    if (!p1 || !p2) return null;
    var cands = [];
    function offsetsOf(pr, side) {
      if (pr.t === 'seg') {
        var d = G.norm(G.sub(pr.b, pr.a)), nn = { x: -d.y, y: d.x };
        return { type: 'line', a: G.add(pr.a, G.mul(nn, side * r)), b: G.add(pr.b, G.mul(nn, side * r)) };
      }
      return { type: 'cir', c: pr.c, r: Math.max(1e-9, pr.r + side * r) };
    }
    [-1, 1].forEach(function (s1) {
      [-1, 1].forEach(function (s2) {
        var o1 = offsetsOf(p1, s1), o2 = offsetsOf(p2, s2), ints = [];
        if (o1.type === 'line' && o2.type === 'line') ints = G.interLine(o1.a, o1.b, o2.a, o2.b, true, true);
        else if (o1.type === 'line') ints = G.interLineCircle(o1.a, o1.b, o2.c, o2.r, true);
        else if (o2.type === 'line') ints = G.interLineCircle(o2.a, o2.b, o1.c, o1.r, true);
        else ints = G.interCircleCircle(o1.c, o1.r, o2.c, o2.r);
        ints.forEach(function (q) { cands.push({ x: q.x, y: q.y }); });
      });
    });
    if (!cands.length) return null;
    var ref = G.mid(e1.p, e2.p);
    cands.sort(function (a, b) { return G.dist(a, ref) - G.dist(b, ref); });
    return cands[0];
  }

  /* ============================================================
     ARCO
     ============================================================ */
  Cmd.add(['ARCO', 'ARC', 'A'], { group: 'draw', icon: 'arc', title: 'Arco' }, async function (ctx, args) {
    var mode = args && args[0];
    var p1 = null, center = null;
    if (mode === 'CE') {
      center = await ctx.getPoint('Precise punto central del arco'); if (!pt(center)) return;
    } else {
      var r0 = await ctx.getPoint('Precise punto inicial del arco o', { keywords: ['CEntro'] });
      if (r0 === null) return;
      if (isKw(r0)) { center = await ctx.getPoint('Precise punto central del arco'); if (!pt(center)) return; }
      else p1 = r0;
    }
    ctx.doc.mark('ARCO');
    if (center) {
      var s = await ctx.getPoint('Precise punto inicial del arco', { base: center }); if (!pt(s)) return;
      var rr = G.dist(center, s), a0 = G.ang(center, s);
      var e = await ctx.getPoint('Precise extremo del arco o', {
        base: center, keywords: ['Ángulo', 'Longitud de cuerda'],
        preview: function (p) { return [E.arc(center, rr, a0, G.ang(center, p))]; }
      });
      if (e === null) return;
      if (isKw(e)) {
        var ang = await ctx.getAngle('Precise ángulo incluido', { base: center });
        if (typeof ang !== 'number') return;
        CU.add(ctx, E.arc(center, rr, a0, a0 + ang));
        return;
      }
      CU.add(ctx, E.arc(center, rr, a0, G.ang(center, e)));
      return;
    }
    var p2 = await ctx.getPoint('Precise segundo punto del arco o', {
      base: p1, keywords: ['CEntro', 'Fin'],
      preview: function (p) { return [E.line(p1, p)]; }
    });
    if (p2 === null) return;
    if (isKw(p2)) {
      if (p2.kw === 'CE') {
        var cc = await ctx.getPoint('Precise punto central del arco', { base: p1 }); if (!pt(cc)) return;
        var r2 = G.dist(cc, p1), aa0 = G.ang(cc, p1);
        var e2 = await ctx.getPoint('Precise extremo del arco o', {
          base: cc, keywords: ['Ángulo', 'Longitud de cuerda'],
          preview: function (p) { return [E.arc(cc, r2, aa0, G.ang(cc, p))]; }
        });
        if (e2 === null) return;
        if (isKw(e2)) {
          var an2 = await ctx.getAngle('Precise ángulo incluido', { base: cc });
          if (typeof an2 !== 'number') return;
          CU.add(ctx, E.arc(cc, r2, aa0, aa0 + an2));
          return;
        }
        CU.add(ctx, E.arc(cc, r2, aa0, G.ang(cc, e2)));
        return;
      }
      if (p2.kw === 'F') {
        var pe = await ctx.getPoint('Precise extremo del arco', { base: p1 }); if (!pt(pe)) return;
        var opt = await ctx.getKeyword('Precise punto central del arco o', ['Ángulo', 'Dirección', 'Radio'], { def: 'Radio' });
        if (opt && opt.kw === 'R') {
          var rad = await ctx.getReal('Precise radio del arco');
          if (typeof rad !== 'number') return;
          var arcE = arcFromEndsRadius(p1, pe, rad);
          if (!arcE) { ctx.err('Radio insuficiente.'); return; }
          CU.add(ctx, arcE);
          return;
        }
        if (opt && opt.kw === 'A') {
          var ang3 = await ctx.getAngle('Precise ángulo incluido');
          if (typeof ang3 !== 'number') return;
          var ch = G.dist(p1, pe) / 2;
          var rad3 = ch / Math.sin(Math.abs(ang3) / 2);
          var arcE3 = arcFromEndsRadius(p1, pe, ang3 > 0 ? rad3 : -rad3);
          if (arcE3) CU.add(ctx, arcE3);
          return;
        }
        return;
      }
    }
    var p3 = await ctx.getPoint('Precise extremo del arco', {
      base: p2, preview: function (p) {
        var a = arc3(p1, p2, p); return a ? [a] : [E.line(p1, p2), E.line(p2, p)];
      }
    });
    if (!pt(p3)) return;
    var arcRes = arc3(p1, p2, p3);
    if (!arcRes) { ctx.err('Los puntos son colineales.'); return; }
    CU.add(ctx, arcRes);
  });

  function arc3(a, b, c) {
    var cc = circ3(a, b, c);
    if (!cc) return null;
    var a0 = G.ang(cc.c, a), am = G.ang(cc.c, b), a1 = G.ang(cc.c, c);
    var ccw = G.sweep(a0, am) < G.sweep(a0, a1);
    return ccw ? E.arc(cc.c, cc.r, a0, a1) : E.arc(cc.c, cc.r, a1, a0);
  }
  CAD.arc3 = arc3;

  function arcFromEndsRadius(p1, p2, r) {
    var ch = G.dist(p1, p2);
    var ar = Math.abs(r);
    if (ch > 2 * ar || ch < 1e-9) return null;
    var apo = Math.sqrt(ar * ar - (ch / 2) * (ch / 2));
    var m = G.mid(p1, p2), dir = G.ang(p1, p2);
    var c = G.polar(m, dir + Math.PI / 2, r > 0 ? apo : -apo);
    return E.arc(c, ar, G.ang(c, p1), G.ang(c, p2));
  }

  /* ============================================================
     RECTÁNGULO
     ============================================================ */
  Cmd.add(['RECTANG', 'RECTANGULO', 'RECTANGLE', 'REC'], { group: 'draw', icon: 'rect', title: 'Rectángulo' }, async function (ctx) {
    var fillet = ctx.app.recFillet || 0, chamfer = ctx.app.recChamfer || 0, width = 0;
    var p1;
    while (true) {
      p1 = await ctx.getPoint('Precise primer punto de esquina o', { keywords: ['Chaflán', 'Elevación', 'EMpalme', 'Grosor'] });
      if (p1 === null) return;
      if (!isKw(p1)) break;
      if (p1.kw === 'C') {
        var c1 = await ctx.getReal('Precise primera distancia de chaflán', { def: chamfer });
        chamfer = typeof c1 === 'number' ? c1 : 0; fillet = 0;
        ctx.app.recChamfer = chamfer;
      } else if (p1.kw === 'EM') {
        var f1 = await ctx.getReal('Precise radio de empalme', { def: fillet });
        fillet = typeof f1 === 'number' ? f1 : 0; chamfer = 0;
        ctx.app.recFillet = fillet;
      } else if (p1.kw === 'G') {
        var g1 = await ctx.getReal('Precise grosor de línea', { def: 0 });
        width = typeof g1 === 'number' ? g1 : 0;
      }
    }
    var p2 = await ctx.getPoint('Precise esquina opuesta o', {
      base: p1, rubber: 'rect', keywords: ['Área', 'Cotas', 'Rotación'],
      preview: function (p) { return [makeRect(p1, p, fillet, chamfer, width)]; }
    });
    if (p2 === null) return;
    ctx.doc.mark('RECTANG');
    if (isKw(p2)) {
      if (p2.kw === 'C') {
        var L = await ctx.getReal('Precise longitud del rectángulo', { def: 10 });
        var A = await ctx.getReal('Precise anchura del rectángulo', { def: 10 });
        if (typeof L !== 'number' || typeof A !== 'number') return;
        var dirP = await ctx.getPoint('Precise otra esquina', { base: p1, allowNone: true });
        var sx = 1, sy = 1;
        if (pt(dirP)) { sx = dirP.x < p1.x ? -1 : 1; sy = dirP.y < p1.y ? -1 : 1; }
        CU.add(ctx, makeRect(p1, { x: p1.x + L * sx, y: p1.y + A * sy }, fillet, chamfer, width));
        return;
      }
      if (p2.kw === 'A') {
        var area = await ctx.getReal('Introduzca área del rectángulo', { def: 100 });
        var kw = await ctx.getKeyword('Calcular cotas del rectángulo basándose en', ['Longitud', 'Anchura'], { def: 'Longitud' });
        var val = await ctx.getReal(kw.kw === 'L' ? 'Introduzca longitud del rectángulo' : 'Introduzca anchura del rectángulo', { def: 10 });
        if (!area || !val) return;
        var Lx = kw.kw === 'L' ? val : area / val, Ly = kw.kw === 'L' ? area / val : val;
        CU.add(ctx, makeRect(p1, { x: p1.x + Lx, y: p1.y + Ly }, fillet, chamfer, width));
        return;
      }
      return;
    }
    CU.add(ctx, makeRect(p1, p2, fillet, chamfer, width));
  });

  function makeRect(p1, p2, fillet, chamfer, width) {
    var x1 = Math.min(p1.x, p2.x), x2 = Math.max(p1.x, p2.x);
    var y1 = Math.min(p1.y, p2.y), y2 = Math.max(p1.y, p2.y);
    var w = x2 - x1, h = y2 - y1;
    var r = Math.min(fillet || 0, w / 2, h / 2);
    var c = Math.min(chamfer || 0, w / 2, h / 2);
    var v;
    if (r > 1e-9) {
      var b = Math.tan(Math.PI / 8);
      v = [
        { x: x1 + r, y: y1, b: 0 }, { x: x2 - r, y: y1, b: b },
        { x: x2, y: y1 + r, b: 0 }, { x: x2, y: y2 - r, b: b },
        { x: x2 - r, y: y2, b: 0 }, { x: x1 + r, y: y2, b: b },
        { x: x1, y: y2 - r, b: 0 }, { x: x1, y: y1 + r, b: b }
      ];
    } else if (c > 1e-9) {
      v = [
        { x: x1 + c, y: y1 }, { x: x2 - c, y: y1 }, { x: x2, y: y1 + c }, { x: x2, y: y2 - c },
        { x: x2 - c, y: y2 }, { x: x1 + c, y: y2 }, { x: x1, y: y2 - c }, { x: x1, y: y1 + c }
      ];
    } else {
      v = [{ x: x1, y: y1 }, { x: x2, y: y1 }, { x: x2, y: y2 }, { x: x1, y: y2 }];
    }
    var pl = E.pline(v, true);
    pl.width = width || 0;
    return pl;
  }
  CAD.makeRect = makeRect;

  /* ============================================================
     POLÍGONO
     ============================================================ */
  Cmd.add(['POLIGONO', 'POLYGON', 'POL2'], { group: 'draw', icon: 'polygon', title: 'Polígono' }, async function (ctx) {
    var n = await ctx.getInt('Indique número de lados', { def: ctx.app.lastPolySides || 6 });
    if (typeof n !== 'number' || n < 3 || n > 1024) { if (n) ctx.err('Se requiere un valor entre 3 y 1024.'); return; }
    ctx.app.lastPolySides = n;
    var c = await ctx.getPoint('Precise centro de polígono o', { keywords: ['Lado'] });
    if (c === null) return;
    ctx.doc.mark('POLIGONO');
    if (isKw(c)) {
      var e1 = await ctx.getPoint('Precise primer extremo del lado'); if (!pt(e1)) return;
      var e2 = await ctx.getPoint('Precise segundo extremo del lado', {
        base: e1, preview: function (p) { return [polyFromEdge(e1, p, n)]; }
      });
      if (!pt(e2)) return;
      CU.add(ctx, polyFromEdge(e1, e2, n));
      return;
    }
    var mode = await ctx.getKeyword('Indique una opción', ['Inscrito en el círculo', 'Circunscrito alrededor del círculo'], { def: 'Inscrito en el círculo' });
    var insc = !mode || mode.kw === 'IEC' || mode.kw === 'I';
    var rp = await ctx.getPoint('Precise radio del círculo', {
      base: c, preview: function (p) { return [polyFromCenter(c, G.dist(c, p), n, insc, G.ang(c, p))]; }
    });
    if (rp === null) return;
    var rad = typeof rp === 'number' ? rp : G.dist(c, rp);
    var ang = typeof rp === 'number' ? Math.PI / 2 : G.ang(c, rp);
    CU.add(ctx, polyFromCenter(c, rad, n, insc, ang));
  });

  function polyFromCenter(c, r, n, inscribed, startAng) {
    var R = inscribed ? r : r / Math.cos(Math.PI / n);
    var v = [];
    for (var i = 0; i < n; i++) v.push(G.polar(c, startAng + (i * G.TAU) / n, R));
    return E.pline(v, true);
  }
  function polyFromEdge(e1, e2, n) {
    var side = G.dist(e1, e2), ang = G.ang(e1, e2);
    var R = side / (2 * Math.sin(Math.PI / n));
    var apo = Math.sqrt(Math.max(0, R * R - (side / 2) * (side / 2)));
    var c = G.polar(G.mid(e1, e2), ang + Math.PI / 2, apo);
    return polyFromCenter(c, R, n, true, G.ang(c, e1));
  }

  /* ============================================================
     ELIPSE
     ============================================================ */
  Cmd.add(['ELIPSE', 'ELLIPSE', 'EL'], { group: 'draw', icon: 'ellipse', title: 'Elipse' }, async function (ctx, args) {
    var first = args && args[0] === 'C'
      ? { kw: 'C' }
      : await ctx.getPoint('Precise extremo de eje de elipse o', { keywords: ['Arco', 'Centro'] });
    if (first === null) return;
    ctx.doc.mark('ELIPSE');
    var arcMode = false, c, a1, a2;
    if (isKw(first) && first.kw === 'A') { arcMode = true; first = await ctx.getPoint('Precise extremo de eje de arco elíptico o', { keywords: ['Centro'] }); }
    if (first === null) return;
    if (isKw(first) && first.kw === 'C') {
      c = await ctx.getPoint('Precise centro de elipse'); if (!pt(c)) return;
      a1 = await ctx.getPoint('Precise extremo de eje', { base: c, preview: function (p) { return [E.ellipse(c, G.sub(p, c), 0.5)]; } });
      if (!pt(a1)) return;
    } else {
      a1 = first;
      a2 = await ctx.getPoint('Precise otro extremo de eje', { base: a1, preview: function (p) { return [E.ellipse(G.mid(a1, p), G.mul(G.sub(p, a1), 0.5), 0.4)]; } });
      if (!pt(a2)) return;
      c = G.mid(a1, a2);
    }
    var maj = G.sub(a1, c);
    var half = G.len(maj);
    var d2 = await ctx.getPoint('Precise distancia al otro eje o', {
      base: c, keywords: ['Rotación'],
      preview: function (p) { return [E.ellipse(c, maj, Math.min(1, perpDist(c, maj, p) / half))]; }
    });
    if (d2 === null) return;
    var ratio;
    if (isKw(d2)) {
      var rot = await ctx.getAngle('Precise rotación alrededor del eje mayor');
      if (typeof rot !== 'number') return;
      ratio = Math.abs(Math.cos(rot));
    } else ratio = Math.min(1, (typeof d2 === 'number' ? d2 : perpDist(c, maj, d2)) / half);
    if (!(ratio > 0)) ratio = 0.0001;
    var el = E.ellipse(c, maj, ratio);
    if (arcMode) {
      var s = await ctx.getAngle('Precise ángulo inicial', { base: c, def: 0 });
      var e = await ctx.getAngle('Precise ángulo final', { base: c, def: Math.PI });
      el.t0 = typeof s === 'number' ? s : 0;
      el.t1 = typeof e === 'number' ? e : Math.PI;
    }
    CU.add(ctx, el);
  });
  function perpDist(c, maj, p) {
    var u = G.norm(maj), nn = { x: -u.y, y: u.x };
    return Math.abs(G.dot(G.sub(p, c), nn));
  }

  /* ============================================================
     SPLINE
     ============================================================ */
  Cmd.add(['SPLINE', 'SPL'], { group: 'draw', icon: 'spline', title: 'Spline' }, async function (ctx) {
    var pts = [];
    var p0 = await ctx.getPoint('Precise primer punto o', { keywords: ['Método', 'Objeto'] });
    if (!pt(p0)) return;
    pts.push(p0);
    ctx.doc.mark('SPLINE');
    while (true) {
      var p = await ctx.getPoint('Precise punto siguiente o', {
        base: pts[pts.length - 1], keywords: pts.length > 2 ? ['Cerrar', 'desHacer'] : ['desHacer'], allowNone: true,
        preview: function (c) { return [E.spline(pts.concat([c]), false)]; }
      });
      if (p === null) break;
      if (isKw(p)) {
        if (p.kw === 'C' && pts.length > 2) { CU.add(ctx, E.spline(pts, true)); return; }
        if (p.kw === 'H' && pts.length > 1) { pts.pop(); ctx.app.refresh(); }
        continue;
      }
      pts.push(p);
      ctx.app.refresh();
    }
    if (pts.length >= 2) CU.add(ctx, E.spline(pts, false));
    else ctx.doc.discardTx();
  });

  /* ============================================================
     PUNTO
     ============================================================ */
  Cmd.add(['PUNTO', 'POINT', 'PO'], { group: 'draw', icon: 'point', title: 'Punto' }, async function (ctx) {
    ctx.out('Modos de punto actuales:  PDMODE=' + ctx.doc.vars.PDMODE + '  PDSIZE=' + G.fmt(ctx.doc.vars.PDSIZE, 4));
    ctx.doc.mark('PUNTO');
    var any = false;
    while (true) {
      var p = await ctx.getPoint('Precise un punto', { allowNone: true });
      if (!pt(p)) break;
      ctx.doc.add(E.point(p)); any = true;
      ctx.app.refresh();
    }
    if (!any) ctx.doc.discardTx();
  });

  /* ============================================================
     ARANDELA
     ============================================================ */
  Cmd.add(['ARANDELA', 'DONUT', 'DO'], { group: 'draw', icon: 'donut', title: 'Arandela' }, async function (ctx) {
    var di = await ctx.getReal('Precise diámetro interior de arandela', { def: ctx.app.donutIn === undefined ? 5 : ctx.app.donutIn });
    if (typeof di !== 'number') return;
    var de = await ctx.getReal('Precise diámetro exterior de arandela', { def: ctx.app.donutOut === undefined ? 10 : ctx.app.donutOut });
    if (typeof de !== 'number') return;
    ctx.app.donutIn = di; ctx.app.donutOut = de;
    ctx.doc.mark('ARANDELA');
    var any = false;
    while (true) {
      var c = await ctx.getPoint('Precise centro de arandela o <salir>', {
        allowNone: true,
        preview: function (p) { return [donutAt(p, di, de)]; }
      });
      if (!pt(c)) break;
      ctx.doc.add(donutAt(c, di, de)); any = true;
      ctx.app.refresh();
    }
    if (!any) ctx.doc.discardTx();
  });
  function donutAt(c, di, de) {
    var r = (di + de) / 4, w = (de - di) / 2;
    var pl = E.pline([{ x: c.x - r, y: c.y, b: 1 }, { x: c.x + r, y: c.y, b: 1 }], true);
    pl.width = w;
    return pl;
  }

  /* ============================================================
     LÍNEA AUXILIAR / RAYO
     ============================================================ */
  Cmd.add(['LINEAX', 'XLINE', 'XL'], { group: 'draw', icon: 'xline', title: 'Línea auxiliar' }, async function (ctx) {
    var p = await ctx.getPoint('Precise un punto o', { keywords: ['Hor', 'Ver', 'Ángulo', 'Bisectriz', 'Desfase'] });
    if (p === null) return;
    ctx.doc.mark('LINEAX');
    if (isKw(p)) {
      if (p.kw === 'H' || p.kw === 'V') {
        var d = { x: p.kw === 'H' ? 1 : 0, y: p.kw === 'H' ? 0 : 1 };
        while (true) {
          var q = await ctx.getPoint('Precise punto de paso', { allowNone: true });
          if (!pt(q)) break;
          ctx.doc.add(E.xline(q, d)); ctx.app.refresh();
        }
        return;
      }
      if (p.kw === 'A') {
        var a = await ctx.getAngle('Precise ángulo de línea auxiliar (0)', { def: 0 });
        while (true) {
          var q2 = await ctx.getPoint('Precise punto de paso', { allowNone: true });
          if (!pt(q2)) break;
          ctx.doc.add(E.xline(q2, { x: Math.cos(a), y: Math.sin(a) })); ctx.app.refresh();
        }
        return;
      }
      return;
    }
    while (true) {
      var t = await ctx.getPoint('Precise punto de paso', {
        base: p, allowNone: true,
        preview: function (c) { return [E.xline(p, G.sub(c, p))]; }
      });
      if (!pt(t)) break;
      ctx.doc.add(E.xline(p, G.sub(t, p)));
      ctx.app.refresh();
    }
  });

  Cmd.add(['RAYO', 'RAY'], { group: 'draw', icon: 'ray', title: 'Rayo' }, async function (ctx) {
    var p = await ctx.getPoint('Precise punto inicial'); if (!pt(p)) return;
    ctx.doc.mark('RAYO');
    while (true) {
      var t = await ctx.getPoint('Precise punto de paso', {
        base: p, allowNone: true,
        preview: function (c) { return [E.ray(p, G.sub(c, p))]; }
      });
      if (!pt(t)) break;
      ctx.doc.add(E.ray(p, G.sub(t, p)));
      ctx.app.refresh();
    }
  });

  /* ============================================================
     TEXTO (una línea)
     ============================================================ */
  Cmd.add(['TEXTO', 'TEXT', 'DTEXT', 'DT'], { group: 'annot', icon: 'text', title: 'Texto' }, async function (ctx) {
    var doc = ctx.doc;
    ctx.out('Estilo de texto actual: "' + doc.vars.TEXTSTYLE + '"  Altura de texto: ' + G.fmt(doc.vars.TEXTSIZE, 4));
    var p = await ctx.getPoint('Precise punto inicial de texto o', { keywords: ['jUstificar', 'Estilo'] });
    if (p === null) return;
    var halign = 0, valign = 0;
    while (isKw(p)) {
      if (p.kw === 'U') {
        var j = await ctx.getKeyword('Indique una opción', ['Izquierda', 'Centro', 'Derecha', 'MEdio', 'SUperiorIzquierda', 'MedioCentro', 'INFerior'], { def: 'Izquierda' });
        var map = { I: [0, 0], C: [1, 0], D: [2, 0], ME: [4, 2], SUI: [0, 3], MC: [1, 2], INF: [0, 1] };
        var mm = map[j && j.kw] || [0, 0];
        halign = mm[0]; valign = mm[1];
      } else if (p.kw === 'E') {
        var st = await ctx.getString('Indique nombre de estilo de texto o [?]', { def: doc.vars.TEXTSTYLE });
        if (st && doc.textStyles[st]) doc.vars.TEXTSTYLE = st;
      }
      p = await ctx.getPoint('Precise punto inicial de texto');
    }
    if (!pt(p)) return;
    var h = await ctx.getReal('Precise altura', { def: G.fmt(doc.vars.TEXTSIZE, 4), base: p });
    if (typeof h !== 'number') h = doc.vars.TEXTSIZE;
    doc.vars.TEXTSIZE = h;
    var rot = await ctx.getAngle('Precise ángulo de rotación de texto', { def: 0, base: p });
    if (typeof rot !== 'number') rot = 0;
    doc.mark('TEXTO');
    var line = 0, any = false;
    while (true) {
      var s = await ctx.getString('Escriba texto', { allowNone: true });
      if (s === null || s === '') break;
      var te = E.text({ x: p.x - Math.sin(rot) * (-line * h * 1.6), y: p.y - Math.cos(rot) * (line * h * 1.6) }, h, s, rot);
      te.style = doc.vars.TEXTSTYLE; te.halign = halign; te.valign = valign;
      if (halign || valign) te.p2 = { x: te.p.x, y: te.p.y };
      doc.add(te); any = true; line++;
      ctx.app.refresh();
    }
    if (!any) doc.discardTx();
  });

  /* ============================================================
     TEXTOM (multilínea)
     ============================================================ */
  Cmd.add(['TEXTOM', 'MTEXT', 'MT', 'T'], { group: 'annot', icon: 'mtext', title: 'Texto múltiple' }, async function (ctx) {
    var doc = ctx.doc;
    ctx.out('Estilo de texto actual: "' + doc.vars.TEXTSTYLE + '"  Altura de texto: ' + G.fmt(doc.vars.TEXTSIZE, 4));
    var p1 = await ctx.getPoint('Precise primera esquina'); if (!pt(p1)) return;
    var p2 = await ctx.getPoint('Precise esquina opuesta o', {
      base: p1, rubber: 'rect', keywords: ['Altura', 'Justificación', 'Interlineado', 'Rotación', 'Estilo', 'Anchura']
    });
    var w = 0, h = doc.vars.TEXTSIZE;
    if (isKw(p2)) {
      if (p2.kw === 'A' || p2.kw === 'AL') { var hh = await ctx.getReal('Precise altura', { def: h }); if (typeof hh === 'number') h = hh; }
      p2 = await ctx.getPoint('Precise esquina opuesta', { base: p1, rubber: 'rect' });
    }
    if (!pt(p2)) return;
    w = Math.abs(p2.x - p1.x);
    var txt = await ctx.app.ui.textDialog('', { title: 'Editor de texto múltiple', height: h });
    if (txt === null || txt === '') return;
    doc.mark('TEXTOM');
    var mt = E.mtext({ x: Math.min(p1.x, p2.x), y: Math.max(p1.y, p2.y) }, h, txt, w);
    mt.style = doc.vars.TEXTSTYLE;
    mt.attach = 1;
    CU.add(ctx, mt);
  });

  /* ============================================================
     SOMBREADO
     ============================================================ */
  Cmd.add(['SOMBREA', 'HATCH', 'H', 'BHATCH'], { group: 'draw', icon: 'hatch', title: 'Sombreado' }, async function (ctx) {
    var doc = ctx.doc;
    var cfg = await ctx.app.ui.hatchDialog({
      pattern: doc.vars.HPNAME, scale: doc.vars.HPSCALE, angle: G.deg(doc.vars.HPANG),
      color: 256, transparency: 0
    });
    if (!cfg) return;
    doc.vars.HPNAME = cfg.pattern; doc.vars.HPSCALE = cfg.scale; doc.vars.HPANG = G.rad(cfg.angle);
    var loopsAll = [];
    if (cfg.mode === 'select') {
      var sel = await ctx.getSelection('Designe objetos', { force: true });
      if (!sel || !sel.length) return;
      var res = CAD.Boundary.fromEntities(ctx.app, sel);
      if (res.error) { ctx.err(res.error); return; }
      loopsAll = [res.loops];
    } else {
      while (true) {
        var p = await ctx.getPoint('Designe un punto interno o', { keywords: ['Designar objetos', 'parÁmetros'], allowNone: true });
        if (p === null) break;
        if (isKw(p)) {
          if (p.kw === 'DO') {
            var sel2 = await ctx.getSelection('Designe objetos', { force: true });
            if (sel2 && sel2.length) {
              var r2 = CAD.Boundary.fromEntities(ctx.app, sel2);
              if (r2.error) ctx.err(r2.error); else loopsAll.push(r2.loops);
            }
          }
          continue;
        }
        ctx.out('Seleccionando todo...');
        var r3 = CAD.Boundary.trace(ctx.app, p);
        if (r3.error) { ctx.err(r3.error); continue; }
        loopsAll.push(r3.loops);
        ctx.out('Analizando el contorno seleccionado...');
        var tmpl = [];
        loopsAll.forEach(function (ls) {
          var hh = E.hatch(ls, { layer: doc.vars.CLAYER });
          hh.pattern = cfg.pattern; hh.solid = cfg.pattern === 'SOLID';
          hh.scale = cfg.scale; hh.angle = G.rad(cfg.angle);
          tmpl.push(hh);
        });
        ctx.setPreview(tmpl);
      }
    }
    if (!loopsAll.length) return;
    doc.mark('SOMBREA');
    loopsAll.forEach(function (ls) {
      var h = E.hatch(ls);
      h.pattern = cfg.pattern;
      h.solid = cfg.pattern === 'SOLID';
      h.scale = cfg.scale;
      h.angle = G.rad(cfg.angle);
      h.transparency = cfg.transparency || 0;
      if (cfg.color !== undefined && cfg.color !== 256) h.color = cfg.color;
      doc.add(h);
    });
    ctx.app.refresh();
  });

  Cmd.add(['SOLIDO', 'SOLID', 'SO'], { group: 'draw', icon: 'solid', title: 'Sólido 2D' }, async function (ctx) {
    var p1 = await ctx.getPoint('Precise primer punto'); if (!pt(p1)) return;
    var p2 = await ctx.getPoint('Precise segundo punto', { base: p1 }); if (!pt(p2)) return;
    var p3 = await ctx.getPoint('Precise tercer punto', { base: p2 }); if (!pt(p3)) return;
    var p4 = await ctx.getPoint('Precise cuarto punto o <salir>', {
      base: p3, allowNone: true,
      preview: function (c) { return [E.solid([p1, p2, c, p3])]; }
    });
    ctx.doc.mark('SOLIDO');
    CU.add(ctx, pt(p4) ? E.solid([p1, p2, p4, p3]) : E.solid([p1, p2, p3]));
  });

  /* ============================================================
     NUBE DE REVISIÓN
     ============================================================ */
  Cmd.add(['NUBEREV', 'REVCLOUD'], { group: 'draw', icon: 'cloud', title: 'Nube de revisión' }, async function (ctx) {
    var arc = ctx.app.cloudArc || 15;
    var p1 = await ctx.getPoint('Precise primera esquina o', { keywords: ['LOngitud de arco'] });
    if (p1 === null) return;
    if (isKw(p1)) {
      var a = await ctx.getReal('Precise longitud de arco mínima', { def: arc });
      if (typeof a === 'number') { arc = a; ctx.app.cloudArc = a; }
      p1 = await ctx.getPoint('Precise primera esquina');
    }
    if (!pt(p1)) return;
    var p2 = await ctx.getPoint('Precise esquina opuesta', {
      base: p1, rubber: 'rect',
      preview: function (c) { return [cloudRect(p1, c, arc)]; }
    });
    if (!pt(p2)) return;
    ctx.doc.mark('NUBEREV');
    CU.add(ctx, cloudRect(p1, p2, arc));
  });
  function cloudRect(p1, p2, arc) {
    var x1 = Math.min(p1.x, p2.x), x2 = Math.max(p1.x, p2.x);
    var y1 = Math.min(p1.y, p2.y), y2 = Math.max(p1.y, p2.y);
    var corners = [{ x: x1, y: y1 }, { x: x2, y: y1 }, { x: x2, y: y2 }, { x: x1, y: y2 }];
    var verts = [];
    for (var i = 0; i < 4; i++) {
      var a = corners[i], b = corners[(i + 1) % 4];
      var L = G.dist(a, b);
      var n = Math.max(1, Math.round(L / arc));
      for (var k = 0; k < n; k++) verts.push({ x: a.x + ((b.x - a.x) * k) / n, y: a.y + ((b.y - a.y) * k) / n, b: -0.52 });
    }
    return E.pline(verts, true);
  }

  /* ============================================================
     BLOQUES
     ============================================================ */
  Cmd.add(['BLOQUE', 'BLOCK', 'B'], { group: 'block', icon: 'block', title: 'Crear bloque' }, async function (ctx) {
    var doc = ctx.doc;
    var name = await ctx.app.ui.promptDialog('Definición de bloque', 'Nombre del bloque:', '');
    if (!name) return;
    if (doc.blocks[name]) {
      var ok = await ctx.app.ui.confirmDialog('El bloque "' + name + '" ya existe. ¿Desea redefinirlo?');
      if (!ok) return;
    }
    var base = await ctx.getPoint('Precise punto base de inserción');
    if (!pt(base)) return;
    var sel = await ctx.getSelection('Designe objetos', { force: true });
    if (!sel || !sel.length) { ctx.err('No se han designado objetos.'); return; }
    doc.mark('BLOQUE');
    var ents = sel.map(function (e) {
      var c = E.copyEnt(e);
      E.transform(c, G.mTrans(-base.x, -base.y), doc);
      return c;
    });
    doc.blocks[name] = { name: name, base: { x: 0, y: 0 }, entities: ents };
    doc.removeAll(sel);
    doc.add(E.insert(name, base, { layer: doc.vars.CLAYER }));
    ctx.app.selSet = [];
    ctx.out('Bloque "' + name + '" definido con ' + ents.length + ' objeto(s).');
    ctx.app.refresh();
  });

  Cmd.add(['INSERT', 'INSERTAR', 'I'], { group: 'block', icon: 'insert', title: 'Insertar bloque' }, async function (ctx) {
    var doc = ctx.doc;
    var names = Object.keys(doc.blocks).filter(function (n) { return n[0] !== '*'; });
    CAD.Blocks.defs.forEach(function (b) { if (names.indexOf(b.n) < 0) names.push(b.n); });
    names.sort();
    if (!names.length) { ctx.err('No hay bloques definidos en este dibujo.'); return; }
    var cfg = await ctx.app.ui.insertDialog(names);
    if (!cfg) return;
    CAD.Blocks.ensure(doc, cfg.name);
    var blk = doc.blocks[cfg.name];
    if (!blk) { ctx.err('Bloque no encontrado.'); return; }
    var p = await ctx.getPoint('Precise punto base de inserción o', {
      keywords: ['Escala', 'Girar'],
      preview: function (c) {
        var ins = E.insert(cfg.name, c, { layer: doc.vars.CLAYER });
        ins.sx = cfg.sx; ins.sy = cfg.sy; ins.rot = G.rad(cfg.rot);
        return [ins];
      }
    });
    if (!pt(p)) return;
    doc.mark('INSERT');
    var ins = E.insert(cfg.name, p);
    ins.sx = cfg.sx; ins.sy = cfg.sy; ins.rot = G.rad(cfg.rot);
    if (CAD.attachAttribs) await CAD.attachAttribs(ctx, ins, blk);
    if (cfg.explode) {
      E.insertChildren(ins, doc).forEach(function (c) { delete c.__inBlock; doc.add(c); });
    } else doc.add(ins);
    ctx.app.refresh();
  });

  /* ============================================================
     DIVIDIR / GRADUAR
     ============================================================ */
  Cmd.add(['DIVIDE', 'DIVIDIR'], { group: 'draw', icon: 'divide', title: 'Dividir' }, async function (ctx) {
    var e = await ctx.getEntity('Designe objeto a dividir'); if (!e) return;
    var n = await ctx.getInt('Indique número de segmentos o [Bloque]', { def: 4 });
    if (typeof n !== 'number' || n < 2) return;
    ctx.doc.mark('DIVIDE');
    var pts = alongEntity(ctx, e.ent, n, true);
    pts.forEach(function (p) { ctx.doc.add(E.point(p, { layer: ctx.doc.vars.CLAYER })); });
    ctx.app.refresh();
  });

  Cmd.add(['GRADUA', 'MEASURE', 'ME'], { group: 'draw', icon: 'measure', title: 'Graduar' }, async function (ctx) {
    var e = await ctx.getEntity('Designe objeto a graduar'); if (!e) return;
    var d = await ctx.getReal('Precise longitud de segmento o [Bloque]', { def: 10 });
    if (typeof d !== 'number' || d <= 0) return;
    ctx.doc.mark('GRADUA');
    var pts = alongEntityDist(ctx, e.ent, d);
    pts.forEach(function (p) { ctx.doc.add(E.point(p, { layer: ctx.doc.vars.CLAYER })); });
    ctx.app.refresh();
  });

  function polyOf(ctx, ent) {
    var ss = E.segs(ent, ctx.doc, 3);
    if (!ss.length) return null;
    var pts = ss[0].pts.slice();
    if (ss[0].closed) pts.push(pts[0]);
    return pts;
  }
  function alongEntity(ctx, ent, n, skipEnds) {
    var pts = polyOf(ctx, ent);
    if (!pts || pts.length < 2) return [];
    var total = G.polyLen(pts, false);
    var out = [];
    for (var i = 1; i < n; i++) out.push(atLength(pts, (total * i) / n));
    return out.filter(Boolean);
  }
  function alongEntityDist(ctx, ent, d) {
    var pts = polyOf(ctx, ent);
    if (!pts || pts.length < 2) return [];
    var total = G.polyLen(pts, false);
    var out = [];
    for (var L = d; L < total - 1e-9; L += d) out.push(atLength(pts, L));
    return out.filter(Boolean);
  }
  function atLength(pts, L) {
    var acc = 0;
    for (var i = 1; i < pts.length; i++) {
      var d = G.dist(pts[i - 1], pts[i]);
      if (acc + d >= L) return G.lerp(pts[i - 1], pts[i], (L - acc) / (d || 1));
      acc += d;
    }
    return pts[pts.length - 1];
  }
  CAD.atLength = atLength;
  CAD.polyOf = polyOf;
})();
