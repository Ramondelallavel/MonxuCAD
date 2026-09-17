/* ============================================================
   track.js — Rastreo de referencia a objetos (OTRACK)
   Se adquiere un punto notable manteniendo el cursor sobre él;
   a partir de ese punto salen trayectorias de alineación en los
   ángulos polares, y sus cruces también son puntos de captura.
   ============================================================ */
(function () {
  'use strict';
  var CAD = window.CAD, G = CAD.G;

  var T = (CAD.Track = {
    pts: [],
    hover: null,
    HOVER_MS: 420,
    MAX: 7,
    TOL: 11
  });

  T.clear = function () { T.pts.length = 0; T.hover = null; };

  T.angles = function (doc) {
    var out;
    if (doc.vars.POLARMODE) {
      var inc = G.rad(doc.vars.POLARANG || 90);
      out = [];
      if (inc > 0.01) for (var a = 0; a < G.TAU - 1e-9; a += inc) out.push(a);
      else out = [0, Math.PI / 2, Math.PI, 1.5 * Math.PI];
    } else {
      out = [0, Math.PI / 2, Math.PI, 1.5 * Math.PI];
    }
    var ub = doc.vars.UCSANG || 0;
    return ub ? out.map(function (v) { return v + ub; }) : out;
  };

  /* Adquisición por permanencia del cursor sobre una referencia */
  T.update = function (app, snapHit) {
    var doc = app.doc;
    if (!doc.vars.OTRACK || !app.osnapOn || !app.pending || app.pending.kind !== 'point') {
      T.hover = null;
      return;
    }
    if (!snapHit) { T.hover = null; return; }
    var now = Date.now();
    if (!T.hover || G.dist(T.hover.p, snapHit.p) > 1e-6) {
      T.hover = { p: { x: snapHit.p.x, y: snapHit.p.y }, type: snapHit.type, label: snapHit.label, t0: now, done: false };
      return;
    }
    if (T.hover.done || now - T.hover.t0 < T.HOVER_MS) return;
    T.hover.done = true;
    T.toggle(T.hover);
    app.out(T.pts.length ? 'Punto de rastreo adquirido: ' + (T.hover.label || '') : 'Punto de rastreo liberado.');
  };

  T.toggle = function (h) {
    for (var i = 0; i < T.pts.length; i++) {
      if (G.dist(T.pts[i], h.p) < 1e-6) { T.pts.splice(i, 1); return false; }
    }
    T.pts.push({ x: h.p.x, y: h.p.y, type: h.type, label: h.label || 'Rastreo' });
    if (T.pts.length > T.MAX) T.pts.shift();
    return true;
  };

  function labelOf(a, q) {
    var d = G.dist(a, q), ang = G.deg(G.na(G.ang(a, q)));
    return (a.label || 'Rastreo') + ':  ' + G.fmt(d, 2) + ' < ' + G.fmt(ang, 0) + '°';
  }

  /* Devuelve {p, tracks, label} si el cursor cae sobre una trayectoria */
  T.resolve = function (app, sp, base) {
    var doc = app.doc, r = app.r;
    if (!doc.vars.OTRACK) return null;
    var origins = T.pts.slice();
    if (!origins.length) return null;
    var wp = r.s2w(sp);
    var tolW = T.TOL / r.view.zoom;
    var big = (r.W + r.H) / r.view.zoom;
    var angs = T.angles(doc);
    var cands = [];

    origins.forEach(function (a) {
      angs.forEach(function (ang) {
        var ux = Math.cos(ang), uy = Math.sin(ang);
        var t = (wp.x - a.x) * ux + (wp.y - a.y) * uy;
        if (t < tolW) return;                       /* sólo hacia delante */
        var q = { x: a.x + ux * t, y: a.y + uy * t };
        var d = G.dist(q, wp);
        if (d > tolW) return;
        cands.push({ a: a, ang: ang, ux: ux, uy: uy, p: q, d: d });
      });
    });
    if (!cands.length) return null;
    cands.sort(function (x, y) { return x.d - y.d; });

    function line(a, through) {
      var ang = G.ang(a, through);
      return { p1: { x: a.x, y: a.y }, p2: G.polar(a, ang, G.dist(a, through) + big * 0.25), color: CAD.THEME.track, dash: [7, 5] };
    }

    /* cruce de dos trayectorias */
    for (var i = 0; i < cands.length && i < 6; i++) {
      for (var j = i + 1; j < cands.length && j < 8; j++) {
        var c1 = cands[i], c2 = cands[j];
        if (Math.abs(Math.sin(c1.ang - c2.ang)) < 1e-6) continue;
        var ii = G.interLine(c1.a, { x: c1.a.x + c1.ux, y: c1.a.y + c1.uy },
                             c2.a, { x: c2.a.x + c2.ux, y: c2.a.y + c2.uy }, true, true);
        if (!ii.length) continue;
        var q = { x: ii[0].x, y: ii[0].y };
        if (G.dist(q, wp) > tolW * 1.7) continue;
        return {
          p: q,
          tracks: [line(c1.a, q), line(c2.a, q)],
          label: labelOf(c1.a, q) + '\n' + labelOf(c2.a, q)
        };
      }
    }
    var c = cands[0];
    return { p: c.p, tracks: [line(c.a, c.p)], label: labelOf(c.a, c.p) };
  };

  /* Marcadores de los puntos adquiridos */
  T.draw = function (r, ctx) {
    if (!T.pts.length) return;
    ctx.save();
    ctx.setLineDash([]);
    ctx.strokeStyle = CAD.THEME.track;
    ctx.lineWidth = 1.6;
    T.pts.forEach(function (a) {
      var s = r.w2s(a);
      ctx.beginPath();
      ctx.moveTo(s.x - 6, s.y); ctx.lineTo(s.x + 6, s.y);
      ctx.moveTo(s.x, s.y - 6); ctx.lineTo(s.x, s.y + 6);
      ctx.stroke();
      ctx.globalAlpha = 0.55;
      ctx.strokeRect(s.x - 4.5, s.y - 4.5, 9, 9);
      ctx.globalAlpha = 1;
    });
    ctx.restore();
  };
})();
