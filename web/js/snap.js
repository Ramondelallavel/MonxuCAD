/* ============================================================
   snap.js — Primitivas analíticas, referencias a objetos (OSNAP),
             rastreo polar y modo ortogonal.
   ============================================================ */
(function () {
  'use strict';
  var CAD = (window.CAD = window.CAD || {});
  var G = CAD.G, E = CAD.E;
  var PR = (CAD.Prim = {});
  var S = (CAD.Snap = {});

  /* ============================================================
     Descomposición en primitivas exactas
     ============================================================ */
  PR.of = function (ent, doc) {
    var out = [];
    switch (ent.type) {
      case 'LINE': out.push({ t: 'seg', a: ent.p1, b: ent.p2, ent: ent }); break;
      case 'XLINE': out.push({ t: 'seg', a: ent.p, b: G.add(ent.p, ent.d), inf1: true, inf2: true, ent: ent }); break;
      case 'RAY': out.push({ t: 'seg', a: ent.p, b: G.add(ent.p, ent.d), inf2: true, ent: ent }); break;
      case 'CIRCLE': out.push({ t: 'cir', c: ent.c, r: ent.r, ent: ent }); break;
      case 'ARC': out.push({ t: 'arc', c: ent.c, r: ent.r, a0: ent.a0, a1: ent.a1, ent: ent }); break;
      case 'LWPOLYLINE': {
        var v = ent.verts, n = v.length, last = ent.closed ? n : n - 1;
        for (var i = 0; i < last; i++) {
          var a = v[i], b = v[(i + 1) % n];
          if (a.b) {
            var arc = G.bulgeArc(a, b, a.b);
            if (arc) {
              out.push(arc.ccw
                ? { t: 'arc', c: arc.c, r: arc.r, a0: arc.a0, a1: arc.a1, ent: ent, seg: i }
                : { t: 'arc', c: arc.c, r: arc.r, a0: arc.a1, a1: arc.a0, ent: ent, seg: i });
              continue;
            }
          }
          out.push({ t: 'seg', a: { x: a.x, y: a.y }, b: { x: b.x, y: b.y }, ent: ent, seg: i });
        }
        break;
      }
      default: {
        E.segs(ent, doc, 1).forEach(function (s) {
          var pts = s.pts, n2 = pts.length, lim = s.closed ? n2 : n2 - 1;
          for (var k = 0; k < lim; k++) out.push({ t: 'seg', a: pts[k], b: pts[(k + 1) % n2], ent: ent, approx: true });
        });
      }
    }
    return out;
  };

  function inArcP(p, pr) {
    if (pr.t !== 'arc') return true;
    return G.inArc(G.ang(pr.c, p), pr.a0, pr.a1);
  }

  /* Intersección entre dos primitivas. ext = permitir prolongación */
  PR.inter = function (p, q, ext) {
    var out = [];
    if (p.t === 'seg' && q.t === 'seg') {
      out = G.interLine(p.a, p.b, q.a, q.b, ext || p.inf1 || p.inf2, ext || q.inf1 || q.inf2);
    } else if (p.t === 'seg' && (q.t === 'cir' || q.t === 'arc')) {
      out = G.interLineCircle(p.a, p.b, q.c, q.r, ext || p.inf1 || p.inf2).filter(function (r) { return ext || inArcP(r, q); });
    } else if ((p.t === 'cir' || p.t === 'arc') && q.t === 'seg') {
      out = G.interLineCircle(q.a, q.b, p.c, p.r, ext || q.inf1 || q.inf2).filter(function (r) { return ext || inArcP(r, p); });
    } else {
      out = G.interCircleCircle(p.c, p.r, q.c, q.r).filter(function (r) { return (ext || inArcP(r, p)) && (ext || inArcP(r, q)); });
    }
    if (!ext) {
      out = out.filter(function (r) {
        if (p.t === 'arc' && !inArcP(r, p)) return false;
        if (q.t === 'arc' && !inArcP(r, q)) return false;
        return true;
      });
    }
    return out;
  };

  /* Punto más cercano de una primitiva */
  PR.closest = function (pr, p) {
    if (pr.t === 'seg') return G.closestOnSeg(p, pr.a, pr.b).p;
    var a = G.ang(pr.c, p);
    if (pr.t === 'arc' && !G.inArc(a, pr.a0, pr.a1)) {
      var e0 = G.polar(pr.c, pr.a0, pr.r), e1 = G.polar(pr.c, pr.a1, pr.r);
      return G.dist(p, e0) < G.dist(p, e1) ? e0 : e1;
    }
    return G.polar(pr.c, a, pr.r);
  };

  /* Perpendicular desde base a la primitiva */
  PR.perp = function (pr, base) {
    if (pr.t === 'seg') {
      var r = G.closestOnSeg(base, pr.a, pr.b);
      if (pr.inf1 || pr.inf2) {
        var d = G.sub(pr.b, pr.a), l2 = G.dot(d, d);
        if (l2 < 1e-12) return null;
        var t = G.dot(G.sub(base, pr.a), d) / l2;
        return G.add(pr.a, G.mul(d, t));
      }
      return r.p;
    }
    if (G.dist(base, pr.c) < 1e-9) return null;
    var p = G.polar(pr.c, G.ang(pr.c, base), pr.r);
    if (pr.t === 'arc' && !G.inArc(G.ang(pr.c, p), pr.a0, pr.a1)) {
      p = G.polar(pr.c, G.ang(pr.c, base) + Math.PI, pr.r);
      if (!G.inArc(G.ang(pr.c, p), pr.a0, pr.a1)) return null;
    }
    return p;
  };

  /* Tangentes desde base a círculo/arco */
  PR.tangents = function (pr, base) {
    if (pr.t === 'seg') return [];
    var d = G.dist(base, pr.c);
    if (d <= pr.r + 1e-9) return [];
    var a = Math.acos(pr.r / d), b = G.ang(pr.c, base);
    var out = [G.polar(pr.c, b + a, pr.r), G.polar(pr.c, b - a, pr.r)];
    if (pr.t === 'arc') out = out.filter(function (p) { return G.inArc(G.ang(pr.c, p), pr.a0, pr.a1); });
    return out;
  };

  /* ============================================================
     OSNAP
     ============================================================ */
  S.MODES = [
    { bit: 1, key: 'end', label: 'Punto final' },
    { bit: 2, key: 'mid', label: 'Punto medio' },
    { bit: 4, key: 'cen', label: 'Centro' },
    { bit: 8, key: 'nod', label: 'Nodo' },
    { bit: 16, key: 'qua', label: 'Cuadrante' },
    { bit: 32, key: 'int', label: 'Intersección' },
    { bit: 64, key: 'ins', label: 'Inserción' },
    { bit: 128, key: 'per', label: 'Perpendicular' },
    { bit: 256, key: 'tan', label: 'Tangente' },
    { bit: 512, key: 'nea', label: 'Cercano' },
    { bit: 2048, key: 'app', label: 'Intersección ficticia' },
    { bit: 4096, key: 'ext', label: 'Extensión' },
    { bit: 8192, key: 'par', label: 'Paralelo' },
    { bit: 16384, key: 'geo', label: 'Centro geométrico' }
  ];
  var PRIORITY = ['end', 'mid', 'cen', 'nod', 'qua', 'int', 'ins', 'per', 'tan', 'geo', 'ext', 'nea'];

  /* Busca la referencia bajo el cursor.
     opts: {base} punto base para per/tan, {override} clave forzada */
  S.find = function (app, sp, opts) {
    opts = opts || {};
    var doc = app.doc, r = app.r;
    if (opts.override === 'none') return null;
    if (!app.osnapOn && !opts.override) return null;
    var ap = (doc.vars.APERTURE || 10);
    var wp = r.s2w(sp);
    var tolW = ap / r.view.zoom;
    var mode = opts.override ? null : doc.vars.OSMODE;
    var active = {};
    if (opts.override) { active[opts.override] = true; }
    else S.MODES.forEach(function (m) { if (mode & m.bit) active[m.key] = true; });
    if (!Object.keys(active).length) return null;

    var box = { x1: wp.x - tolW, y1: wp.y - tolW, x2: wp.x + tolW, y2: wp.y + tolW };
    var cand = CAD.queryVisible(app, box);
    var near = [];
    for (var ci = 0; ci < cand.length && near.length < 220; ci++) {
      var ce = cand[ci];
      if (ce.type === 'HATCH') continue;
      var cb = E.bboxOf(ce, doc);
      if (!G.bboxValid(cb)) { near.push(ce); continue; }
      if (G.bboxHit(G.bboxGrow(cb, tolW), box)) near.push(ce);
    }

    var cands = [];
    /* Con una sustitución forzada (se ha tecleado CEN, MID, END…) no se
       exige que el punto caiga bajo la mira: basta con apuntar al objeto
       y se devuelve su punto notable, esté donde esté.  Es como se usa
       en AutoCAD: para capturar el centro de un círculo se señala el
       círculo, no el hueco del medio. */
    var forced = opts.override && opts.override !== 'none';
    var overEnts = null;
    if (forced) {
      overEnts = [];
      near.forEach(function (e) {
        if (E.hit(e, wp, tolW, doc)) overEnts.push(e);
      });
    }

    /* puntos notables */
    near.forEach(function (e) {
      E.snapPoints(e, doc).forEach(function (s) {
        if (!active[s.type]) return;
        var d = G.dist(s.p, wp);
        if (d <= tolW) { cands.push({ type: s.type, p: s.p, ent: e, d: d }); return; }
        /* objeto señalado y referencia forzada: vale aunque esté lejos */
        if (forced && overEnts.indexOf(e) >= 0) cands.push({ type: s.type, p: s.p, ent: e, d: d + tolW * 10 });
      });
    });

    var prims = null;
    function getPrims() {
      if (!prims) {
        prims = [];
        near.forEach(function (e) { PR.of(e, doc).forEach(function (p) { prims.push(p); }); });
        if (prims.length > 1500) prims = prims.slice(0, 1500);
      }
      return prims;
    }

    /* intersección */
    if (active.int || active.app) {
      var ps = getPrims();
      for (var i = 0; i < ps.length && cands.length < 60; i++) {
        var bi = primBox(ps[i]);
        if (bi && !G.bboxHit(G.bboxGrow(bi, tolW), box)) continue;
        for (var j = i + 1; j < ps.length; j++) {
          if (ps[i].ent === ps[j].ent) continue;
          var bj = primBox(ps[j]);
          if (bj && !G.bboxHit(G.bboxGrow(bj, tolW), box)) continue;
          PR.inter(ps[i], ps[j], !!active.app && !active.int).forEach(function (q) {
            var d = G.dist(q, wp);
            if (d <= tolW) cands.push({ type: active.int ? 'int' : 'app', p: { x: q.x, y: q.y }, ent: ps[i].ent, d: d });
          });
        }
      }
    }

    /* perpendicular / tangente respecto al punto base */
    if ((active.per || active.tan) && opts.base) {
      var lim = forced ? tolW * 1e6 : tolW * 1.6;
      getPrims().forEach(function (pr) {
        if (forced && overEnts.indexOf(pr.ent) < 0 && overEnts.length) return;
        if (active.per) {
          var q = PR.perp(pr, opts.base);
          if (q && G.dist(q, wp) <= lim) cands.push({ type: 'per', p: q, ent: pr.ent, d: G.dist(q, wp) * 0.9 });
        }
        if (active.tan) {
          PR.tangents(pr, opts.base).forEach(function (q2) {
            if (G.dist(q2, wp) <= lim) cands.push({ type: 'tan', p: q2, ent: pr.ent, d: G.dist(q2, wp) * 0.9 });
          });
        }
      });
    }

    /* centro geométrico de polilíneas cerradas */
    if (active.geo) {
      near.forEach(function (e) {
        if ((e.type === 'LWPOLYLINE' && e.closed) || e.type === 'SOLID' || e.type === 'HATCH') {
          var pts = E.segs(e, doc, 1)[0];
          if (!pts) return;
          var c = G.polyCentroid(pts.pts);
          if (G.dist(c, wp) <= tolW) cands.push({ type: 'geo', p: c, ent: e, d: G.dist(c, wp) });
        }
      });
    }

    /* cercano */
    if (active.nea && !cands.length) {
      getPrims().forEach(function (pr) {
        var q = PR.closest(pr, wp);
        if (q && G.dist(q, wp) <= tolW) cands.push({ type: 'nea', p: q, ent: pr.ent, d: G.dist(q, wp) + tolW * 0.5 });
      });
    }

    if (!cands.length) { app.snapCands = []; return null; }
    cands.sort(function (a, b) {
      var pa = PRIORITY.indexOf(a.type), pb = PRIORITY.indexOf(b.type);
      if (pa !== pb) return pa - pb;
      return a.d - b.d;
    });
    /* Se quitan los repetidos: dos objetos que comparten un extremo dan
       la misma captura y el recorrido con el tabulador se atascaría. */
    var uniq = [];
    for (var ui = 0; ui < cands.length; ui++) {
      var cu = cands[ui], dup = false;
      for (var uj = 0; uj < uniq.length; uj++) {
        if (uniq[uj].type === cu.type && G.dist(uniq[uj].p, cu.p) < 1e-9) { dup = true; break; }
      }
      if (!dup) uniq.push(cu);
      if (uniq.length >= 12) break;
    }
    app.snapCands = uniq;
    /* El tabulador recorre las capturas bajo la mira, como en AutoCAD */
    var idx = app.snapTab ? (app.snapTab % uniq.length) : 0;
    var best = uniq[idx];
    return { type: best.type, p: { x: best.p.x, y: best.p.y }, ent: best.ent,
             label: (CAD.SNAP_LABEL[best.type] || best.type) +
                    (uniq.length > 1 ? '   (' + (idx + 1) + '/' + uniq.length + ', Tab)' : '') };
  };

  function primBox(pr) {
    if (pr.t === 'seg') { if (pr.inf1 || pr.inf2) return null; return G.bboxFromPts([pr.a, pr.b]); }
    if (pr.t === 'cir') return { x1: pr.c.x - pr.r, y1: pr.c.y - pr.r, x2: pr.c.x + pr.r, y2: pr.c.y + pr.r };
    return G.bboxArc(pr.c, pr.r, pr.a0, pr.a1, true);
  }

  /* ============================================================
     Ortogonal / polar / forzado de rejilla
     ============================================================ */
  S.applyOrtho = function (doc, base, p) {
    var a = doc.vars.UCSANG || 0;
    if (!a) {
      var dx0 = p.x - base.x, dy0 = p.y - base.y;
      if (Math.abs(dx0) >= Math.abs(dy0)) return { x: p.x, y: base.y };
      return { x: base.x, y: p.y };
    }
    var c = Math.cos(-a), s2 = Math.sin(-a);
    var vx = p.x - base.x, vy = p.y - base.y;
    var dx = vx * c - vy * s2, dy = vx * s2 + vy * c;
    if (Math.abs(dx) >= Math.abs(dy)) dy = 0; else dx = 0;
    var c2 = Math.cos(a), s3 = Math.sin(a);
    return { x: base.x + dx * c2 - dy * s3, y: base.y + dx * s3 + dy * c2 };
  };

  S.applyPolar = function (doc, base, p) {
    var inc = G.rad(doc.vars.POLARANG || 90);
    if (inc <= 0) return null;
    var ub = doc.vars.UCSANG || 0;
    var a = G.ang(base, p), d = G.dist(base, p);
    var k = Math.round((a - ub) / inc) * inc + ub;
    var diff = Math.abs(G.na(a - k));
    diff = Math.min(diff, G.TAU - diff);
    if (diff * d > 14 / 1) { /* tolerancia se aplica fuera en píxeles */ }
    return { p: G.polar(base, k, d), ang: k, diff: diff };
  };

  S.applyGridSnap = function (doc, p) {
    var u = doc.vars.SNAPUNIT || 10;
    if (u <= 0) return p;
    var q = CAD.UCS.w2u(doc, p);
    return CAD.UCS.u2w(doc, { x: Math.round(q.x / u) * u, y: Math.round(q.y / u) * u });
  };

  /* Resolución completa del punto del cursor.
     Devuelve {p, snap, tracks} */
  S.resolve = function (app, sp, base, opts) {
    opts = opts || {};
    var doc = app.doc, r = app.r;
    var raw = r.s2w(sp);
    var tracks = [];
    var snap = null;

    if (!opts.noOsnap) snap = S.find(app, sp, { base: base, override: app.osnapOverride });
    if (CAD.Track) CAD.Track.update(app, snap);
    if (snap) return { p: snap.p, snap: snap, tracks: tracks };

    /* rastreo de referencia a objetos */
    if (CAD.Track && !opts.noConstraint) {
      var tr = CAD.Track.resolve(app, sp, base);
      if (tr) {
        if (base) tr.tracks.push({ p1: base, p2: tr.p, color: CAD.THEME.polar, dash: [5, 5] });
        return { p: tr.p, snap: null, tracks: tr.tracks, label: tr.label, tracking: true };
      }
    }

    if (doc.vars.SNAPMODE && !opts.noGrid) raw = S.applyGridSnap(doc, raw);

    if (base && !opts.noConstraint) {
      if (doc.vars.ORTHOMODE) {
        var op = S.applyOrtho(doc, base, raw);
        tracks.push({ p1: base, p2: op, color: CAD.THEME.polar });
        return { p: op, snap: null, tracks: tracks, ang: G.ang(base, op) };
      }
      if (doc.vars.POLARMODE) {
        var pol = S.applyPolar(doc, base, raw);
        if (pol) {
          var scr = r.w2s(pol.p), cur = sp;
          if (G.dist(scr, cur) <= 12) {
            var far = G.polar(base, pol.ang, Math.max(G.dist(base, pol.p) * 1.35, (r.W + r.H) / r.view.zoom * 0.08));
            tracks.push({ p1: base, p2: far, color: CAD.THEME.polar, dash: [7, 5] });
            return {
              p: pol.p, snap: null, tracks: tracks, ang: pol.ang, polar: true,
              label: 'Polar:  ' + G.fmt(G.dist(base, pol.p), 2) + ' < ' +
                G.fmt(G.deg(G.na(pol.ang - (doc.vars.UCSANG || 0))), 0) + '\u00b0'
            };
          }
        }
      }
    }
    return { p: raw, snap: null, tracks: tracks };
  };
})();
