/* ============================================================
   pick3d.js — Designación y captura de referencias en el espacio 3D.

   Es lo que permite modelar de verdad dentro de la vista 3D: señalar
   un sólido, capturar un vértice, el punto medio de una arista, el
   centro de una cara o un punto sobre la propia cara, igual que en
   SolidWorks o CATIA.  Sin esto, dentro del 3D sólo se podía apuntar al
   plano de trabajo y ningún comando de edición era utilizable.
   ============================================================ */
(function () {
  'use strict';
  var CAD = window.CAD, G3 = CAD.G3, S = CAD.Solid, M = CAD.Mesh;
  var v3 = G3.v;

  var P3 = (CAD.Pick3D = {});

  /* Apertura de captura, en píxeles */
  P3.APERTURE = 12;

  /* Prioridad de las referencias, de más a menos específica */
  var PRIO = ['ver', 'mid', 'cen', 'int', 'ari', 'car', 'pla'];
  P3.LABEL = {
    ver: 'Vértice', mid: 'Punto medio', cen: 'Centro de cara', int: 'Intersección',
    ari: 'Arista', car: 'Cara', pla: 'Plano de trabajo'
  };

  /* --------- Proyección mundo -> pantalla --------- */
  P3.projector = function (view) {
    var VP = view.cam.vp(view.W, view.H, view.cam.radius);
    var W = view.W, H = view.H;
    return function (p) {
      var q = G3.apply4(VP, p);
      if (!q || q[3] <= 1e-9) return null;
      return { x: (q[0] / q[3] * 0.5 + 0.5) * W, y: (0.5 - q[1] / q[3] * 0.5) * H, w: q[3] };
    };
  };

  function sqd(a, b) { var dx = a.x - b.x, dy = a.y - b.y; return dx * dx + dy * dy; }

  /* Sólidos y mallas visibles */
  function solids(app) {
    var list = app.doc.visible ? app.doc.visible() : app.doc.entities;
    var out = [];
    for (var i = 0; i < list.length; i++) {
      var e = list[i];
      if (e.hidden) continue;
      if (e.type !== 'SOLID3D' && e.type !== 'MESH') continue;
      out.push(e);
    }
    return out;
  }

  /* --------- Entidad bajo el cursor --------- */
  P3.hover = function (app, sx, sy) {
    if (!app.view3d) return null;
    var hit = app.view3d.pick(app, sx, sy);
    return hit && hit.ent ? hit.ent : null;
  };

  /* --------- Captura de referencias -----------------------------------
     Devuelve {p, type, label, ent} o null.  Se examinan sólo los sólidos
     cuya proyección cae cerca del cursor, de modo que el coste no
     depende del tamaño del modelo sino de lo que hay bajo la mira.
     ------------------------------------------------------------------ */
  P3.snap = function (app, sx, sy, opts) {
    opts = opts || {};
    var view = app.view3d;
    if (!view || !view.ok) return null;
    var doc = app.doc;
    var on = opts.force || (app.osnapOn && (doc.vars.OSMODE || 0) !== 0);
    var tol = P3.APERTURE, tol2 = tol * tol;
    var prj = P3.projector(view);
    var ojo = view.cam.eye ? view.cam.eye() : v3(0, 0, 0);
    function prof(p) { return G3.dist(ojo, p); }
    var cands = [];

    if (on) {
      var ents = solids(app), presu = 0;
      for (var i = 0; i < ents.length && presu < 400000; i++) {
        var ent = ents[i];
        var mesh = S.meshOf(ent);
        if (!mesh || !mesh.verts.length) continue;
        /* descarte rápido: si la caja envolvente proyectada no roza el
           cursor, este sólido no puede aportar capturas */
        var bb = mesh.bbox();
        if (!boxNearScreen(prj, bb, sx, sy, tol)) continue;
        presu += mesh.verts.length;

        /* vértices */
        for (var j = 0; j < mesh.verts.length; j++) {
          var s = prj(mesh.verts[j]);
          if (!s) continue;
          var d = sqd(s, { x: sx, y: sy });
          if (d <= tol2) cands.push({ type: 'ver', p: mesh.verts[j], ent: ent, d: d, w: prof(mesh.verts[j]) });
        }
        /* aristas: punto medio y punto más próximo */
        var ed = mesh.edges();
        for (j = 0; j < ed.length; j++) {
          var a = mesh.verts[ed[j].a], b = mesh.verts[ed[j].b];
          if (!a || !b) continue;
          var sa = prj(a), sb = prj(b);
          if (!sa || !sb) continue;
          var mp = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2, z: (a.z + b.z) / 2 };
          var sm = prj(mp);
          if (sm) { d = sqd(sm, { x: sx, y: sy }); if (d <= tol2) cands.push({ type: 'mid', p: mp, ent: ent, d: d, w: prof(mp) }); }
          var t = segT(sx, sy, sa, sb);
          if (t !== null) {
            var q = { x: sa.x + (sb.x - sa.x) * t, y: sa.y + (sb.y - sa.y) * t };
            d = sqd(q, { x: sx, y: sy });
            if (d <= tol2) {
              var pe = { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t, z: a.z + (b.z - a.z) * t };
              cands.push({ type: 'ari', ent: ent, d: d + tol2 * 0.35, p: pe, w: prof(pe) });
            }
          }
        }
        /* centro de cara */
        for (j = 0; j < mesh.faces.length; j++) {
          var c = mesh.faceCenter(mesh.faces[j]);
          var sc = prj(c);
          if (!sc) continue;
          d = sqd(sc, { x: sx, y: sy });
          if (d <= tol2) cands.push({ type: 'cen', p: c, ent: ent, d: d + tol2 * 0.2, w: prof(c) });
        }
      }
    }

    /* punto sobre la propia cara apuntada */
    var rh = view.pick(app, sx, sy);
    if (rh && rh.ent && rh.p) {
      cands.push({ type: 'car', p: { x: rh.p.x, y: rh.p.y, z: rh.p.z }, ent: rh.ent,
                   d: tol2 * 0.9, w: prof(rh.p) });
    }

    if (cands.length) {
      cands.sort(function (x, y) {
        var px = PRIO.indexOf(x.type), py = PRIO.indexOf(y.type);
        if (px !== py) return px - py;
        /* a igualdad de tipo y de distancia en pantalla (al píxel), manda
           lo que está más cerca del observador: si no, se capturaba un
           vértice de la cara de atrás que casualmente se proyecta ahí */
        var ex = Math.round(Math.sqrt(x.d)), ey = Math.round(Math.sqrt(y.d));
        if (ex !== ey) return ex - ey;
        return x.w - y.w;
      });
      /* el tabulador recorre las capturas solapadas, como en 2D */
      var uniq = [];
      for (i = 0; i < cands.length; i++) {
        var cu = cands[i], dup = false;
        for (var k = 0; k < uniq.length; k++)
          if (uniq[k].type === cu.type && G3.dist2(uniq[k].p, cu.p) < 1e-12) { dup = true; break; }
        if (!dup) uniq.push(cu);
        if (uniq.length >= 10) break;
      }
      app.snap3dCands = uniq;
      var idx = app.snapTab ? (app.snapTab % uniq.length) : 0;
      var best = uniq[idx];
      return { p: best.p, type: best.type, ent: best.ent,
               label: P3.LABEL[best.type] + (uniq.length > 1 ? '   (' + (idx + 1) + '/' + uniq.length + ', Tab)' : '') };
    }
    app.snap3dCands = [];

    /* sin geometría bajo la mira: el plano de trabajo */
    var gp = view.groundPoint(sx, sy, doc.vars.ELEVATION || 0, doc);
    if (!gp) return null;
    return { p: gp, type: 'pla', ent: null, label: null };
  };

  /* ¿la caja envolvente proyectada pasa cerca del cursor? */
  function boxNearScreen(prj, bb, sx, sy, tol) {
    if (!bb || !isFinite(bb.x1)) return false;
    var x1 = Infinity, y1 = Infinity, x2 = -Infinity, y2 = -Infinity, vis = false;
    for (var i = 0; i < 8; i++) {
      var s = prj(v3(i & 1 ? bb.x2 : bb.x1, i & 2 ? bb.y2 : bb.y1, i & 4 ? bb.z2 : bb.z1));
      if (!s) continue;
      vis = true;
      if (s.x < x1) x1 = s.x; if (s.x > x2) x2 = s.x;
      if (s.y < y1) y1 = s.y; if (s.y > y2) y2 = s.y;
    }
    if (!vis) return false;
    return sx >= x1 - tol && sx <= x2 + tol && sy >= y1 - tol && sy <= y2 + tol;
  }

  /* parámetro del punto más próximo de un segmento de pantalla */
  function segT(px, py, a, b) {
    var vx = b.x - a.x, vy = b.y - a.y;
    var L2 = vx * vx + vy * vy;
    if (L2 < 1e-9) return null;
    var t = ((px - a.x) * vx + (py - a.y) * vy) / L2;
    return Math.max(0, Math.min(1, t));
  }

  /* --------- Designación por ventana en 3D -----------------------------
     Se proyecta la geometría de cada objeto y se comprueba contra el
     rectángulo: ventana (todo dentro) o captura (basta con tocar).
     ------------------------------------------------------------------ */
  P3.boxSelect = function (app, r1, r2, crossing) {
    var view = app.view3d;
    if (!view || !view.ok) return [];
    var prj = P3.projector(view);
    var x1 = Math.min(r1.x, r2.x), x2 = Math.max(r1.x, r2.x);
    var y1 = Math.min(r1.y, r2.y), y2 = Math.max(r1.y, r2.y);
    var list = app.doc.selectable ? app.doc.selectable() : (app.doc.visible ? app.doc.visible() : app.doc.entities);
    var out = [];
    for (var i = 0; i < list.length; i++) {
      var e = list[i];
      if (e.hidden) continue;
      var pts = P3.screenPoints(app, e, prj);
      if (!pts || !pts.length) continue;
      var dentro = 0, fuera = 0;
      for (var j = 0; j < pts.length; j++) {
        var s = pts[j];
        if (s.x >= x1 && s.x <= x2 && s.y >= y1 && s.y <= y2) dentro++; else fuera++;
      }
      if (crossing) {
        if (dentro) { out.push(e); continue; }
        /* captura: también vale que una arista cruce el rectángulo */
        if (segsCruzan(pts, x1, y1, x2, y2)) out.push(e);
      } else if (dentro && !fuera) out.push(e);
    }
    return out;
  };

  /* Puntos representativos de una entidad proyectados a pantalla */
  P3.screenPoints = function (app, e, prj) {
    var out = [];
    if (e.type === 'SOLID3D' || e.type === 'MESH') {
      var mesh = S.meshOf(e);
      if (!mesh) return out;
      var paso = Math.max(1, Math.floor(mesh.verts.length / 240));
      for (var i = 0; i < mesh.verts.length; i += paso) {
        var s = prj(mesh.verts[i]);
        if (s) out.push(s);
      }
      return out;
    }
    var segs = CAD.E.segs ? CAD.E.segs(e, app.doc) : null;
    if (!segs) return out;
    var z = e.elev || 0;
    for (i = 0; i < segs.length; i++) {
      var pts = segs[i] && segs[i].pts ? segs[i].pts : segs[i];
      if (!pts) continue;
      for (var j = 0; j < pts.length; j++) {
        var q = prj(v3(pts[j].x, pts[j].y, pts[j].z === undefined ? z : pts[j].z));
        if (q) out.push(q);
      }
    }
    return out;
  };

  function segsCruzan(pts, x1, y1, x2, y2) {
    for (var i = 0; i + 1 < pts.length; i++) {
      var a = pts[i], b = pts[i + 1];
      if (Math.max(a.x, b.x) < x1 || Math.min(a.x, b.x) > x2) continue;
      if (Math.max(a.y, b.y) < y1 || Math.min(a.y, b.y) > y2) continue;
      return true;
    }
    return false;
  }

  /* --------- Marcador de captura sobre la superposición --------- */
  var COLOR = { ver: '#ffd166', mid: '#7ee787', cen: '#79c0ff', ari: '#c9a0ff', car: '#8be9fd', int: '#ff9f9f' };

  P3.drawSnap = function (ctx, app) {
    var h = app.snap3d;
    if (!h || !h.p || h.type === 'pla' || !app.view3d) return;
    var prj = P3.projector(app.view3d);
    var s = prj(h.p);
    if (!s) return;
    var c = COLOR[h.type] || '#ffd166';
    ctx.save();
    ctx.strokeStyle = c; ctx.lineWidth = 1.8; ctx.setLineDash([]);
    var r = 7;
    if (h.type === 'ver') ctx.strokeRect(s.x - r, s.y - r, r * 2, r * 2);
    else if (h.type === 'mid') {
      ctx.beginPath(); ctx.moveTo(s.x, s.y - r); ctx.lineTo(s.x + r, s.y + r);
      ctx.lineTo(s.x - r, s.y + r); ctx.closePath(); ctx.stroke();
    } else if (h.type === 'cen') { ctx.beginPath(); ctx.arc(s.x, s.y, r, 0, Math.PI * 2); ctx.stroke(); }
    else if (h.type === 'ari') {
      ctx.beginPath(); ctx.moveTo(s.x - r, s.y); ctx.lineTo(s.x + r, s.y); ctx.stroke();
      ctx.beginPath(); ctx.arc(s.x, s.y, 3, 0, Math.PI * 2); ctx.stroke();
    } else {
      ctx.beginPath(); ctx.moveTo(s.x, s.y - r); ctx.lineTo(s.x + r, s.y);
      ctx.lineTo(s.x, s.y + r); ctx.lineTo(s.x - r, s.y); ctx.closePath(); ctx.stroke();
    }
    if (h.label) {
      ctx.font = '11px system-ui,sans-serif';
      var w = ctx.measureText(h.label).width + 12;
      ctx.fillStyle = 'rgba(18,22,30,0.85)';
      ctx.fillRect(s.x + 14, s.y - 26, w, 18);
      ctx.fillStyle = c;
      ctx.textBaseline = 'top';
      ctx.fillText(h.label, s.x + 20, s.y - 23);
    }
    ctx.restore();
  };

  /* --------- Rectángulo de designación sobre la superposición --------- */
  P3.drawBox = function (ctx, app) {
    var b = app.box3d;
    if (!b) return;
    var x1 = Math.min(b.a.x, b.b.x), x2 = Math.max(b.a.x, b.b.x);
    var y1 = Math.min(b.a.y, b.b.y), y2 = Math.max(b.a.y, b.b.y);
    ctx.save();
    var cross = b.b.x < b.a.x;
    ctx.fillStyle = cross ? 'rgba(110,220,140,0.14)' : 'rgba(110,170,255,0.14)';
    ctx.strokeStyle = cross ? 'rgba(130,240,160,0.9)' : 'rgba(140,190,255,0.9)';
    ctx.lineWidth = 1;
    ctx.setLineDash(cross ? [6, 4] : []);
    ctx.fillRect(x1, y1, x2 - x1, y2 - y1);
    ctx.strokeRect(x1, y1, x2 - x1, y2 - y1);
    ctx.restore();
  };

  /* --------- Realce del objeto bajo el cursor --------- */
  P3.drawHover = function (ctx, app) {
    var e = app.hoverEnt;
    if (!e || !app.view3d || !S.is3D(e)) return;
    /* el objeto pudo desaparecer (lo consumió un booleano): sin esta
       comprobación su contorno seguía pintado sobre la escena */
    var vivos = app.doc.visible ? app.doc.visible() : app.doc.entities;
    if (vivos.indexOf(e) < 0) { app.hoverEnt = null; return; }
    var mesh = S.meshOf(e);
    if (!mesh) return;
    var prj = P3.projector(app.view3d);
    /* sólo la silueta vista desde la cámara: marcar todas las aristas
       vivas ensucia la escena y deja ver las de detrás */
    var ojo = app.view3d.cam.eye ? app.view3d.cam.eye() : v3(0, 0, 1);
    var dir = G3.norm(G3.sub(ojo, app.view3d.cam.target || v3(0, 0, 0)));
    var sil = M.silhouette(mesh, dir, false);
    if (!sil || !sil.length) return;
    ctx.save();
    ctx.strokeStyle = 'rgba(210,230,255,0.9)';
    ctx.lineWidth = 2.2;
    ctx.setLineDash([]);
    ctx.beginPath();
    var n = Math.min(sil.length, 4000);
    for (var i = 0; i < n; i++) {
      var a = prj(mesh.verts[sil[i][0]]), b = prj(mesh.verts[sil[i][1]]);
      if (!a || !b) continue;
      ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y);
    }
    ctx.stroke();
    ctx.restore();
  };
})();
