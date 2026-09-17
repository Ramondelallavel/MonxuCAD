/* ============================================================
   region.js — Operaciones booleanas sobre contornos cerrados
   Trocea las aristas de ambos contornos en sus intersecciones,
   clasifica cada trozo por dentro/fuera y vuelve a encadenarlos.
   ============================================================ */
(function () {
  'use strict';
  var CAD = window.CAD, G = CAD.G, E = CAD.E;
  var R = (CAD.Region = {});

  var TOL = 1e-7;

  /* Contorno cerrado de una entidad, como lista de puntos */
  R.loopOf = function (ent, doc) {
    var ss = E.segs(ent, doc, 3);
    if (!ss.length) return null;
    var s = ss[0];
    if (!s.closed && G.dist(s.pts[0], s.pts[s.pts.length - 1]) > 1e-6) return null;
    var pts = s.pts.slice();
    if (!s.closed) pts.pop();
    if (pts.length < 3) return null;
    if (G.polyArea(pts) < 0) pts.reverse();      /* orientación antihoraria */
    return pts;
  };

  R.isClosed = function (ent, doc) { return !!R.loopOf(ent, doc); };

  /* --- troceado de un contorno en los cruces con el otro --- */
  function splitLoop(a, b) {
    var out = [];
    for (var i = 0; i < a.length; i++) {
      var p1 = a[i], p2 = a[(i + 1) % a.length];
      var cuts = [];
      for (var j = 0; j < b.length; j++) {
        var q1 = b[j], q2 = b[(j + 1) % b.length];
        var ii = G.interLine(p1, p2, q1, q2, false, false);
        if (!ii.length) continue;
        var t = ii[0].t;
        if (t > TOL && t < 1 - TOL) cuts.push({ t: t, p: { x: ii[0].x, y: ii[0].y } });
      }
      cuts.sort(function (x, y) { return x.t - y.t; });
      out.push(p1);
      cuts.forEach(function (c) {
        if (G.dist(out[out.length - 1], c.p) > TOL) out.push(c.p);
      });
    }
    /* limpia duplicados consecutivos */
    var clean = [];
    out.forEach(function (p) {
      if (clean.length && G.dist(clean[clean.length - 1], p) < TOL) return;
      clean.push(p);
    });
    if (clean.length > 1 && G.dist(clean[0], clean[clean.length - 1]) < TOL) clean.pop();
    return clean;
  }

  /* --- clasifica cada arista por su punto medio --- */
  function fragments(loop, other, wantInside) {
    var out = [];
    for (var i = 0; i < loop.length; i++) {
      var p1 = loop[i], p2 = loop[(i + 1) % loop.length];
      if (G.dist(p1, p2) < TOL) continue;
      var mid = G.mid(p1, p2);
      var inside = G.ptInPoly(mid, other);
      if (inside === wantInside) out.push([p1, p2]);
    }
    return out;
  }

  /* --- encadena aristas sueltas en anillos cerrados --- */
  function chain(edges) {
    var used = new Array(edges.length).fill(false);
    var loops = [];
    var tol = 1e-6;
    for (var i = 0; i < edges.length; i++) {
      if (used[i]) continue;
      used[i] = true;
      var loop = [edges[i][0], edges[i][1]];
      var guard = 0;
      while (guard++ < edges.length * 4) {
        var tail = loop[loop.length - 1];
        if (G.dist(tail, loop[0]) < tol && loop.length > 2) break;
        var found = -1, rev = false;
        for (var j = 0; j < edges.length; j++) {
          if (used[j]) continue;
          if (G.dist(edges[j][0], tail) < tol) { found = j; rev = false; break; }
          if (G.dist(edges[j][1], tail) < tol) { found = j; rev = true; break; }
        }
        if (found < 0) break;
        used[found] = true;
        loop.push(rev ? edges[found][0] : edges[found][1]);
      }
      if (loop.length > 3) {
        if (G.dist(loop[0], loop[loop.length - 1]) < tol) loop.pop();
        if (loop.length >= 3 && Math.abs(G.polyArea(loop)) > 1e-9) loops.push(loop);
      }
    }
    return loops;
  }

  function reverseEdges(edges) {
    return edges.map(function (e) { return [e[1], e[0]]; });
  }

  /* op: 'union' | 'diff' | 'inter' */
  R.boolean = function (loopA, loopB, op) {
    var A = splitLoop(loopA, loopB);
    var B = splitLoop(loopB, loopA);
    if (A.length < 3 || B.length < 3) return null;
    var edges;
    if (op === 'union') {
      edges = fragments(A, loopB, false).concat(fragments(B, loopA, false));
    } else if (op === 'inter') {
      edges = fragments(A, loopB, true).concat(fragments(B, loopA, true));
    } else {
      edges = fragments(A, loopB, false).concat(reverseEdges(fragments(B, loopA, true)));
    }
    if (!edges.length) return [];
    var loops = chain(edges);
    /* simplifica los vértices alineados */
    return loops.map(function (l) {
      var s = G.simplify(l.concat([l[0]]), 1e-9);
      if (s.length > 3 && G.dist(s[0], s[s.length - 1]) < 1e-9) s.pop();
      return s;
    }).filter(function (l) { return l.length >= 3; });
  };

  /* Aplica una operación sobre un conjunto de entidades cerradas */
  R.apply = function (doc, ents, op) {
    var loops = [];
    for (var i = 0; i < ents.length; i++) {
      var l = R.loopOf(ents[i], doc);
      if (!l) return { error: 'Todos los objetos deben ser contornos cerrados.' };
      loops.push(l);
    }
    if (loops.length < 2) return { error: 'Se requieren al menos dos contornos.' };
    var acc = [loops[0]];
    for (var k = 1; k < loops.length; k++) {
      var next = [];
      for (var j = 0; j < acc.length; j++) {
        var res = R.boolean(acc[j], loops[k], op);
        if (res === null) return { error: 'No se pudo resolver la operación.' };
        if (op === 'union' && !res.length) {
          /* sin cruces: se conservan ambos por separado */
          next.push(acc[j]);
          if (k === 1 || j === acc.length - 1) next.push(loops[k]);
        } else {
          res.forEach(function (r) { next.push(r); });
        }
      }
      acc = next;
      if (!acc.length) break;
    }
    return { loops: acc };
  };
})();
