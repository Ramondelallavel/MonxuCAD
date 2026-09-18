/* ============================================================
   wplane.js — Plano de trabajo 3D

   Es el plano sobre el que se construye dentro del espacio 3D: se
   apoya en una cara de un sólido, en tres puntos o en uno de los planos
   principales, y a partir de ahí todo lo que se señala cae sobre él.
   Es el equivalente de los planos de referencia de SolidWorks y CATIA.
   ============================================================ */
(function () {
  'use strict';
  var CAD = window.CAD, G3 = CAD.G3;
  var v3 = G3.v;

  var W = (CAD.WPlane = {});

  /* Marco a partir de un origen y una normal */
  W.fromNormal = function (org, n, xhint) {
    var z = G3.norm(n);
    if (G3.len2(z) < 0.5) z = v3(0, 0, 1);
    var x = xhint ? G3.norm(xhint) : null;
    if (x) {
      x = G3.sub(x, G3.mul(z, G3.dot(x, z)));
      if (G3.len2(x) < 1e-12) x = null; else x = G3.norm(x);
    }
    if (!x) x = G3.perp(z);
    var y = G3.norm(G3.cross(z, x));
    return { org: { x: org.x, y: org.y, z: org.z || 0 },
             x: { x: x.x, y: x.y, z: x.z },
             y: { x: y.x, y: y.y, z: y.z },
             n: { x: z.x, y: z.y, z: z.z } };
  };

  W.from3Points = function (a, b, c) {
    var u = G3.sub(b, a), v = G3.sub(c, a);
    var n = G3.cross(u, v);
    if (G3.len2(n) < 1e-14) return null;
    return W.fromNormal(a, n, u);
  };

  W.principal = function (cual, org) {
    org = org || { x: 0, y: 0, z: 0 };
    if (cual === 'YZ') return W.fromNormal(org, v3(1, 0, 0), v3(0, 1, 0));
    if (cual === 'ZX') return W.fromNormal(org, v3(0, 1, 0), v3(0, 0, 1));
    return W.fromNormal(org, v3(0, 0, 1), v3(1, 0, 0));
  };

  W.get = function (doc) { return doc && doc.vars ? doc.vars.WPLANE || null : null; };
  W.set = function (doc, pl) { if (doc && doc.vars) doc.vars.WPLANE = pl || null; };
  W.clear = function (doc) { W.set(doc, null); };

  /* ¿es el plano XY del mundo a la altura de la elevación? */
  W.isWorld = function (doc) {
    var p = W.get(doc);
    if (!p) return true;
    return Math.abs(p.n.x) < 1e-12 && Math.abs(p.n.y) < 1e-12 && Math.abs(p.n.z - 1) < 1e-12;
  };

  /* Plano en la forma {n, w} que usan las intersecciones */
  W.asPlane = function (pl) {
    return { n: v3(pl.n.x, pl.n.y, pl.n.z), w: G3.dot(v3(pl.n.x, pl.n.y, pl.n.z), pl.org) };
  };

  /* Coordenadas del plano <-> mundo */
  W.toWorld = function (pl, u, v) {
    return v3(pl.org.x + pl.x.x * u + pl.y.x * v,
              pl.org.y + pl.x.y * u + pl.y.y * v,
              pl.org.z + pl.x.z * u + pl.y.z * v);
  };
  W.toPlane = function (pl, p) {
    var d = G3.sub(p, pl.org);
    return { u: G3.dot(d, pl.x), v: G3.dot(d, pl.y), w: G3.dot(d, pl.n) };
  };

  /* Matriz que lleva el plano XY local al plano de trabajo, trasladada
     al punto dado.  Es lo que coloca una primitiva sobre la cara. */
  W.matrixAt = function (pl, p) {
    return [pl.x.x, pl.x.y, pl.x.z, 0,
            pl.y.x, pl.y.y, pl.y.z, 0,
            pl.n.x, pl.n.y, pl.n.z, 0,
            p.x, p.y, p.z || 0, 1];
  };

  /* Punto del cursor sobre el plano de trabajo */
  W.rayPoint = function (doc, org, dir, zFallback) {
    var pl = W.get(doc);
    var plano = pl ? W.asPlane(pl) : { n: v3(0, 0, 1), w: zFallback || 0 };
    var h = G3.rayPlane(org, dir, plano);
    return h ? h.p : null;
  };

  /* Dibujo del plano sobre la superposición 3D */
  W.draw = function (ctx, app) {
    var pl = W.get(app.doc);
    if (!pl || !app.view3d || !CAD.Pick3D) return;
    var prj = CAD.Pick3D.projector(app.view3d);
    var r = app.view3d.cam.dist * 0.35;
    var n = 8, paso = r / n;
    ctx.save();
    ctx.strokeStyle = 'rgba(120,190,255,0.30)';
    ctx.lineWidth = 1;
    ctx.setLineDash([]);
    ctx.beginPath();
    for (var i = -n; i <= n; i++) {
      var a1 = prj(W.toWorld(pl, i * paso, -r)), b1 = prj(W.toWorld(pl, i * paso, r));
      if (a1 && b1) { ctx.moveTo(a1.x, a1.y); ctx.lineTo(b1.x, b1.y); }
      var a2 = prj(W.toWorld(pl, -r, i * paso)), b2 = prj(W.toWorld(pl, r, i * paso));
      if (a2 && b2) { ctx.moveTo(a2.x, a2.y); ctx.lineTo(b2.x, b2.y); }
    }
    ctx.stroke();
    /* ejes del plano */
    var o = prj(v3(pl.org.x, pl.org.y, pl.org.z));
    var ex = prj(W.toWorld(pl, r * 0.45, 0));
    var ey = prj(W.toWorld(pl, 0, r * 0.45));
    if (o && ex) { ctx.strokeStyle = 'rgba(255,120,120,0.85)'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(o.x, o.y); ctx.lineTo(ex.x, ex.y); ctx.stroke(); }
    if (o && ey) { ctx.strokeStyle = 'rgba(130,240,150,0.85)'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(o.x, o.y); ctx.lineTo(ey.x, ey.y); ctx.stroke(); }
    if (o) {
      ctx.fillStyle = 'rgba(120,190,255,0.95)';
      ctx.font = '11px system-ui,sans-serif';
      ctx.textBaseline = 'bottom';
      ctx.fillText('Plano de trabajo', o.x + 8, o.y - 6);
    }
    ctx.restore();
  };
})();
