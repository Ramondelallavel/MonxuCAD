/* ============================================================
   geom.js — Núcleo geométrico 2D
   Vectores, matrices, intersecciones, arcos por bulge,
   tabla de colores ACI y definiciones de tipos de línea.
   ============================================================ */
(function () {
  'use strict';
  var CAD = (window.CAD = window.CAD || {});
  var G = (CAD.G = {});

  var EPS = 1e-10;
  var TOL = 1e-7;
  var TAU = Math.PI * 2;

  G.EPS = EPS;
  G.TOL = TOL;
  G.TAU = TAU;

  G.deg = function (r) { return (r * 180) / Math.PI; };
  G.rad = function (d) { return (d * Math.PI) / 180; };

  /* ---------- Vectores ---------- */
  function P(x, y) { return { x: x, y: y }; }
  G.P = P;
  G.clone = function (p) { return { x: p.x, y: p.y }; };
  G.add = function (a, b) { return { x: a.x + b.x, y: a.y + b.y }; };
  G.sub = function (a, b) { return { x: a.x - b.x, y: a.y - b.y }; };
  G.mul = function (a, k) { return { x: a.x * k, y: a.y * k }; };
  G.dot = function (a, b) { return a.x * b.x + a.y * b.y; };
  G.cross = function (a, b) { return a.x * b.y - a.y * b.x; };
  G.len = function (a) { return Math.hypot(a.x, a.y); };
  G.dist = function (a, b) { return Math.hypot(b.x - a.x, b.y - a.y); };
  G.dist2 = function (a, b) { var dx = b.x - a.x, dy = b.y - a.y; return dx * dx + dy * dy; };
  G.mid = function (a, b) { return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }; };
  G.lerp = function (a, b, t) { return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t }; };
  G.norm = function (a) { var l = Math.hypot(a.x, a.y); return l < EPS ? { x: 0, y: 0 } : { x: a.x / l, y: a.y / l }; };
  G.perp = function (a) { return { x: -a.y, y: a.x }; };
  G.ang = function (a, b) { return Math.atan2(b.y - a.y, b.x - a.x); };
  G.polar = function (p, ang, d) { return { x: p.x + Math.cos(ang) * d, y: p.y + Math.sin(ang) * d }; };
  G.eq = function (a, b, t) { return Math.abs(a.x - b.x) <= (t || TOL) && Math.abs(a.y - b.y) <= (t || TOL); };
  G.rotAbout = function (p, c, a) {
    var s = Math.sin(a), co = Math.cos(a), dx = p.x - c.x, dy = p.y - c.y;
    return { x: c.x + dx * co - dy * s, y: c.y + dx * s + dy * co };
  };

  /* Normaliza a [0, 2PI) */
  G.na = function (a) { a = a % TAU; return a < 0 ? a + TAU : a; };
  /* Diferencia angular CCW desde a0 hasta a1, en [0, 2PI) */
  G.sweep = function (a0, a1) { var d = G.na(a1) - G.na(a0); return d < 0 ? d + TAU : d; };
  /* ¿El ángulo a está dentro del arco CCW a0→a1? */
  G.inArc = function (a, a0, a1) {
    var s = G.sweep(a0, a1);
    if (s < TOL) s = TAU;
    var d = G.sweep(a0, a);
    return d <= s + 1e-9;
  };

  /* ---------- Matriz afín 2D [a c e / b d f] ---------- */
  function M(a, b, c, d, e, f) { return { a: a, b: b, c: c, d: d, e: e, f: f }; }
  G.M = M;
  G.mIdent = function () { return M(1, 0, 0, 1, 0, 0); };
  G.mMul = function (m, n) { /* aplica n despues de m  => n*m */
    return M(
      n.a * m.a + n.c * m.b, n.b * m.a + n.d * m.b,
      n.a * m.c + n.c * m.d, n.b * m.c + n.d * m.d,
      n.a * m.e + n.c * m.f + n.e, n.b * m.e + n.d * m.f + n.f
    );
  };
  G.mTrans = function (dx, dy) { return M(1, 0, 0, 1, dx, dy); };
  G.mRot = function (a, c) {
    c = c || P(0, 0);
    var s = Math.sin(a), co = Math.cos(a);
    return M(co, s, -s, co, c.x - c.x * co + c.y * s, c.y - c.x * s - c.y * co);
  };
  G.mScale = function (sx, sy, c) {
    c = c || P(0, 0);
    return M(sx, 0, 0, sy, c.x - c.x * sx, c.y - c.y * sy);
  };
  G.mMirror = function (p1, p2) {
    var dx = p2.x - p1.x, dy = p2.y - p1.y, d = dx * dx + dy * dy;
    if (d < EPS) return G.mIdent();
    var a = (dx * dx - dy * dy) / d, b = (2 * dx * dy) / d;
    return M(a, b, b, -a, p1.x - a * p1.x - b * p1.y, p1.y - b * p1.x + a * p1.y);
  };
  G.mApply = function (m, p) { return { x: m.a * p.x + m.c * p.y + m.e, y: m.b * p.x + m.d * p.y + m.f }; };
  G.mApplyVec = function (m, p) { return { x: m.a * p.x + m.c * p.y, y: m.b * p.x + m.d * p.y }; };
  G.mDet = function (m) { return m.a * m.d - m.b * m.c; };
  G.mScaleFactor = function (m) { return Math.sqrt(Math.abs(G.mDet(m))) || 1; };
  G.mRotation = function (m) { return Math.atan2(m.b, m.a); };
  G.mIsMirror = function (m) { return G.mDet(m) < 0; };

  /* ---------- Punto más cercano ---------- */
  G.closestOnSeg = function (p, a, b) {
    var dx = b.x - a.x, dy = b.y - a.y, l2 = dx * dx + dy * dy;
    if (l2 < EPS) return { p: { x: a.x, y: a.y }, t: 0 };
    var t = ((p.x - a.x) * dx + (p.y - a.y) * dy) / l2;
    var tc = Math.max(0, Math.min(1, t));
    return { p: { x: a.x + dx * tc, y: a.y + dy * tc }, t: tc, tRaw: t };
  };
  G.distToSeg = function (p, a, b) { return G.dist(p, G.closestOnSeg(p, a, b).p); };

  /* ---------- Intersecciones ---------- */
  /* Segmento/recta. inf1/inf2 permiten prolongar. Devuelve [] o [pt] con t/u */
  G.interLine = function (p1, p2, p3, p4, inf1, inf2) {
    var d1x = p2.x - p1.x, d1y = p2.y - p1.y;
    var d2x = p4.x - p3.x, d2y = p4.y - p3.y;
    var den = d1x * d2y - d1y * d2x;
    if (Math.abs(den) < 1e-12) return [];
    var t = ((p3.x - p1.x) * d2y - (p3.y - p1.y) * d2x) / den;
    var u = ((p3.x - p1.x) * d1y - (p3.y - p1.y) * d1x) / den;
    if (!inf1 && (t < -TOL || t > 1 + TOL)) return [];
    if (!inf2 && (u < -TOL || u > 1 + TOL)) return [];
    return [{ x: p1.x + d1x * t, y: p1.y + d1y * t, t: t, u: u }];
  };

  /* Recta/círculo */
  G.interLineCircle = function (p1, p2, c, r, inf) {
    var dx = p2.x - p1.x, dy = p2.y - p1.y;
    var a = dx * dx + dy * dy;
    if (a < EPS) return [];
    var fx = p1.x - c.x, fy = p1.y - c.y;
    var b = 2 * (fx * dx + fy * dy);
    var cc = fx * fx + fy * fy - r * r;
    var disc = b * b - 4 * a * cc;
    if (disc < -1e-9) return [];
    if (disc < 0) disc = 0;
    var sq = Math.sqrt(disc);
    var out = [];
    [(-b - sq) / (2 * a), (-b + sq) / (2 * a)].forEach(function (t, i) {
      if (i === 1 && sq < 1e-9) return;
      if (!inf && (t < -TOL || t > 1 + TOL)) return;
      out.push({ x: p1.x + dx * t, y: p1.y + dy * t, t: t });
    });
    return out;
  };

  /* Círculo/círculo */
  G.interCircleCircle = function (c1, r1, c2, r2) {
    var d = G.dist(c1, c2);
    if (d < EPS || d > r1 + r2 + TOL || d < Math.abs(r1 - r2) - TOL) return [];
    var a = (r1 * r1 - r2 * r2 + d * d) / (2 * d);
    var h2 = r1 * r1 - a * a;
    var h = h2 < 0 ? 0 : Math.sqrt(h2);
    var px = c1.x + (a * (c2.x - c1.x)) / d, py = c1.y + (a * (c2.y - c1.y)) / d;
    if (h < 1e-9) return [{ x: px, y: py }];
    var rx = (-(c2.y - c1.y) * h) / d, ry = ((c2.x - c1.x) * h) / d;
    return [{ x: px + rx, y: py + ry }, { x: px - rx, y: py - ry }];
  };

  /* ---------- Arcos por bulge (polilíneas) ---------- */
  /* bulge = tan(angulo_incluido/4); >0 = CCW */
  G.bulgeArc = function (p1, p2, bulge) {
    if (!bulge || Math.abs(bulge) < 1e-12) return null;
    var chord = G.dist(p1, p2);
    if (chord < EPS) return null;
    var inc = 4 * Math.atan(bulge);           // ángulo incluido con signo
    var r = chord / (2 * Math.sin(Math.abs(inc) / 2));
    var chAng = G.ang(p1, p2);
    var apo = Math.sqrt(Math.max(0, r * r - (chord / 2) * (chord / 2)));
    var sign = Math.abs(inc) > Math.PI ? -1 : 1;
    var dir = bulge > 0 ? 1 : -1;
    var m = G.mid(p1, p2);
    var c = G.polar(m, chAng + dir * Math.PI / 2, sign * apo);
    var a0 = G.ang(c, p1), a1 = G.ang(c, p2);
    return { c: c, r: r, a0: a0, a1: a1, ccw: bulge > 0, inc: inc };
  };
  G.arcBulge = function (a0, a1, ccw) {
    var s = ccw ? G.sweep(a0, a1) : -G.sweep(a1, a0);
    return Math.tan(s / 4);
  };

  /* Puntos a lo largo de un arco */
  G.arcPts = function (c, r, a0, a1, ccw, n) {
    var s = ccw ? G.sweep(a0, a1) : -G.sweep(a1, a0);
    if (Math.abs(s) < 1e-9) s = ccw ? TAU : -TAU;
    n = n || Math.max(6, Math.ceil((Math.abs(s) / TAU) * 72));
    var out = [];
    for (var i = 0; i <= n; i++) {
      var a = a0 + (s * i) / n;
      out.push({ x: c.x + Math.cos(a) * r, y: c.y + Math.sin(a) * r });
    }
    return out;
  };

  /* Elipse: punto paramétrico */
  G.ellPt = function (c, majx, majy, ratio, t) {
    var ca = Math.cos(t), sa = Math.sin(t);
    var ma = Math.hypot(majx, majy);
    var rot = Math.atan2(majy, majx);
    var x = ma * ca, y = ma * ratio * sa;
    return { x: c.x + x * Math.cos(rot) - y * Math.sin(rot), y: c.y + x * Math.sin(rot) + y * Math.cos(rot) };
  };
  G.ellPts = function (c, majx, majy, ratio, t0, t1, n) {
    n = n || 96;
    var s = t1 - t0;
    if (Math.abs(s) < 1e-9) s = TAU;
    var out = [];
    for (var i = 0; i <= n; i++) out.push(G.ellPt(c, majx, majy, ratio, t0 + (s * i) / n));
    return out;
  };

  /* ---------- Polígonos ---------- */
  G.polyArea = function (pts) {
    var a = 0;
    for (var i = 0, n = pts.length; i < n; i++) {
      var p = pts[i], q = pts[(i + 1) % n];
      a += p.x * q.y - q.x * p.y;
    }
    return a / 2;
  };
  G.polyLen = function (pts, closed) {
    var l = 0;
    for (var i = 1; i < pts.length; i++) l += G.dist(pts[i - 1], pts[i]);
    if (closed && pts.length > 2) l += G.dist(pts[pts.length - 1], pts[0]);
    return l;
  };
  G.polyCentroid = function (pts) {
    var a = G.polyArea(pts), cx = 0, cy = 0;
    if (Math.abs(a) < EPS) {
      pts.forEach(function (p) { cx += p.x; cy += p.y; });
      return { x: cx / pts.length, y: cy / pts.length };
    }
    for (var i = 0, n = pts.length; i < n; i++) {
      var p = pts[i], q = pts[(i + 1) % n], f = p.x * q.y - q.x * p.y;
      cx += (p.x + q.x) * f; cy += (p.y + q.y) * f;
    }
    return { x: cx / (6 * a), y: cy / (6 * a) };
  };
  G.ptInPoly = function (p, pts) {
    var inside = false;
    for (var i = 0, j = pts.length - 1; i < pts.length; j = i++) {
      var a = pts[i], b = pts[j];
      if ((a.y > p.y) !== (b.y > p.y) && p.x < ((b.x - a.x) * (p.y - a.y)) / (b.y - a.y) + a.x) inside = !inside;
    }
    return inside;
  };

  /* Simplificación Douglas–Peucker */
  G.simplify = function (pts, tol) {
    if (pts.length < 3) return pts.slice();
    var keep = new Array(pts.length).fill(false);
    keep[0] = keep[pts.length - 1] = true;
    (function rec(i, j) {
      if (j <= i + 1) return;
      var maxd = -1, idx = -1;
      for (var k = i + 1; k < j; k++) {
        var d = G.distToSeg(pts[k], pts[i], pts[j]);
        if (d > maxd) { maxd = d; idx = k; }
      }
      if (maxd > tol) { keep[idx] = true; rec(i, idx); rec(idx, j); }
    })(0, pts.length - 1);
    return pts.filter(function (_, i) { return keep[i]; });
  };

  /* ---------- Cuadros delimitadores ---------- */
  G.bboxNew = function () { return { x1: Infinity, y1: Infinity, x2: -Infinity, y2: -Infinity }; };
  G.bboxAdd = function (b, p) {
    if (p.x < b.x1) b.x1 = p.x; if (p.y < b.y1) b.y1 = p.y;
    if (p.x > b.x2) b.x2 = p.x; if (p.y > b.y2) b.y2 = p.y;
    return b;
  };
  G.bboxMerge = function (b, o) {
    if (!o || o.x1 > o.x2) return b;
    if (o.x1 < b.x1) b.x1 = o.x1; if (o.y1 < b.y1) b.y1 = o.y1;
    if (o.x2 > b.x2) b.x2 = o.x2; if (o.y2 > b.y2) b.y2 = o.y2;
    return b;
  };
  G.bboxValid = function (b) { return !!b && b.x1 <= b.x2 && b.y1 <= b.y2; };
  G.bboxGrow = function (b, d) { return { x1: b.x1 - d, y1: b.y1 - d, x2: b.x2 + d, y2: b.y2 + d }; };
  G.bboxHit = function (b, o) { return !(o.x2 < b.x1 || o.x1 > b.x2 || o.y2 < b.y1 || o.y1 > b.y2); };
  G.bboxIn = function (outer, inner) {
    return inner.x1 >= outer.x1 && inner.x2 <= outer.x2 && inner.y1 >= outer.y1 && inner.y2 <= outer.y2;
  };
  G.bboxFromPts = function (pts) {
    var b = G.bboxNew();
    for (var i = 0; i < pts.length; i++) G.bboxAdd(b, pts[i]);
    return b;
  };
  /* bbox exacto de arco (considera cuadrantes cruzados) */
  G.bboxArc = function (c, r, a0, a1, ccw) {
    var b = G.bboxNew();
    G.bboxAdd(b, { x: c.x + Math.cos(a0) * r, y: c.y + Math.sin(a0) * r });
    G.bboxAdd(b, { x: c.x + Math.cos(a1) * r, y: c.y + Math.sin(a1) * r });
    for (var q = 0; q < 4; q++) {
      var a = (q * Math.PI) / 2;
      var inside = ccw ? G.inArc(a, a0, a1) : G.inArc(a, a1, a0);
      if (inside) G.bboxAdd(b, { x: c.x + Math.cos(a) * r, y: c.y + Math.sin(a) * r });
    }
    return b;
  };

  /* ---------- Segmento/segmento con solape ---------- */
  G.segCross = function (a1, a2, b1, b2) { return G.interLine(a1, a2, b1, b2, false, false).length > 0; };
  /* ¿Cruza el segmento un rectángulo? */
  G.segHitBox = function (a, b, box) {
    var bb = G.bboxFromPts([a, b]);
    if (!G.bboxHit(box, bb)) return false;
    if (a.x >= box.x1 && a.x <= box.x2 && a.y >= box.y1 && a.y <= box.y2) return true;
    if (b.x >= box.x1 && b.x <= box.x2 && b.y >= box.y1 && b.y <= box.y2) return true;
    var c1 = { x: box.x1, y: box.y1 }, c2 = { x: box.x2, y: box.y1 },
        c3 = { x: box.x2, y: box.y2 }, c4 = { x: box.x1, y: box.y2 };
    return G.segCross(a, b, c1, c2) || G.segCross(a, b, c2, c3) ||
           G.segCross(a, b, c3, c4) || G.segCross(a, b, c4, c1);
  };

  /* ============================================================
     Tabla de colores AutoCAD (ACI 0..256)
     ============================================================ */
  var ACI = new Array(257);
  (function buildACI() {
    var fixed = {
      0: [0, 0, 0], 1: [255, 0, 0], 2: [255, 255, 0], 3: [0, 255, 0], 4: [0, 255, 255],
      5: [0, 0, 255], 6: [255, 0, 255], 7: [255, 255, 255], 8: [65, 65, 65], 9: [128, 128, 128],
      250: [51, 51, 51], 251: [91, 91, 91], 252: [132, 132, 132],
      253: [173, 173, 173], 254: [214, 214, 214], 255: [255, 255, 255], 256: [255, 255, 255]
    };
    var vLev = [1.0, 1.0, 0.7647, 0.7647, 0.5647, 0.5647, 0.4353, 0.4353, 0.3059, 0.3059];
    var sLev = [1.0, 0.5, 1.0, 0.5, 1.0, 0.5, 1.0, 0.5, 1.0, 0.5];
    function hsv(h, s, v) {
      var c = v * s, x = c * (1 - Math.abs(((h / 60) % 2) - 1)), m = v - c, r = 0, g = 0, b = 0;
      if (h < 60) { r = c; g = x; } else if (h < 120) { r = x; g = c; }
      else if (h < 180) { g = c; b = x; } else if (h < 240) { g = x; b = c; }
      else if (h < 300) { r = x; b = c; } else { r = c; b = x; }
      return [Math.round((r + m) * 255), Math.round((g + m) * 255), Math.round((b + m) * 255)];
    }
    for (var i = 0; i <= 256; i++) {
      if (fixed[i]) { ACI[i] = fixed[i]; continue; }
      if (i >= 10 && i <= 249) {
        var grp = Math.floor((i - 10) / 10), lev = (i - 10) % 10;
        ACI[i] = hsv((grp * 15) % 360, sLev[lev], vLev[lev]);
      } else ACI[i] = [255, 255, 255];
    }
  })();
  G.ACI = ACI;
  G.aciRGB = function (i) { return ACI[Math.max(0, Math.min(256, i | 0))]; };
  G.aciCSS = function (i) { var c = ACI[Math.max(0, Math.min(256, i | 0))]; return 'rgb(' + c[0] + ',' + c[1] + ',' + c[2] + ')'; };
  G.aciHex = function (i) {
    var c = ACI[Math.max(0, Math.min(256, i | 0))];
    return '#' + [c[0], c[1], c[2]].map(function (v) { return ('0' + v.toString(16)).slice(-2); }).join('');
  };
  /* Color más cercano del índice ACI a un RGB dado */
  G.rgbToACI = function (r, g, b) {
    var best = 7, bd = Infinity;
    for (var i = 1; i <= 255; i++) {
      var c = ACI[i], d = (c[0] - r) * (c[0] - r) + (c[1] - g) * (c[1] - g) + (c[2] - b) * (c[2] - b);
      if (d < bd) { bd = d; best = i; }
    }
    return best;
  };

  /* ============================================================
     Tipos de línea (patrones en unidades de dibujo)
     ============================================================ */
  G.LTYPES = {
    CONTINUOUS: { desc: 'Solid line', pat: [] },
    HIDDEN:     { desc: 'Hidden __ __ __ __ __ __ __ __ __ __ __ __', pat: [6.35, -3.175] },
    HIDDEN2:    { desc: 'Hidden (.5x) _ _ _ _ _ _ _ _ _ _ _ _ _ _ _', pat: [3.175, -1.5875] },
    CENTER:     { desc: 'Center ____ _ ____ _ ____ _ ____ _ ____', pat: [31.75, -6.35, 6.35, -6.35] },
    CENTER2:    { desc: 'Center (.5x) ___ _ ___ _ ___ _ ___ _ ___', pat: [19.05, -3.175, 3.175, -3.175] },
    DASHED:     { desc: 'Dashed __ __ __ __ __ __ __ __ __ __ __', pat: [12.7, -6.35] },
    DASHED2:    { desc: 'Dashed (.5x) _ _ _ _ _ _ _ _ _ _ _ _ _', pat: [6.35, -3.175] },
    DASHDOT:    { desc: 'Dash dot __ . __ . __ . __ . __ . __ . __', pat: [12.7, -6.35, 0.0001, -6.35] },
    DOT:        { desc: 'Dot . . . . . . . . . . . . . . . . . . . ', pat: [0.0001, -6.35] },
    DIVIDE:     { desc: 'Divide ____ . . ____ . . ____ . . ____', pat: [25.4, -6.35, 0.0001, -6.35, 0.0001, -6.35] },
    BORDER:     { desc: 'Border __ __ . __ __ . __ __ . __ __ . ', pat: [12.7, -6.35, 12.7, -6.35, 0.0001, -6.35] },
    PHANTOM:    { desc: 'Phantom ____ __ __ ____ __ __ ____', pat: [31.75, -6.35, 6.35, -6.35, 6.35, -6.35] }
  };

  /* ============================================================
     Patrones de sombreado (ángulo, origen, delta, trazos)
     ============================================================ */
  G.HPATTERNS = {
    SOLID:   null,
    ANSI31:  [{ a: 45, x: 0, y: 0, dx: 0, dy: 3.175, dash: [] }],
    ANSI32:  [{ a: 45, x: 0, y: 0, dx: 0, dy: 9.525, dash: [] }, { a: 45, x: 4.49, y: 0, dx: 0, dy: 9.525, dash: [] }],
    ANSI33:  [{ a: 45, x: 0, y: 0, dx: 0, dy: 6.35, dash: [] }, { a: 45, x: 4.49, y: 0, dx: 0, dy: 6.35, dash: [3.175, -1.5875] }],
    ANSI37:  [{ a: 45, x: 0, y: 0, dx: 0, dy: 3.175, dash: [] }, { a: 135, x: 0, y: 0, dx: 0, dy: 3.175, dash: [] }],
    NET:     [{ a: 0, x: 0, y: 0, dx: 0, dy: 3.175, dash: [] }, { a: 90, x: 0, y: 0, dx: 0, dy: 3.175, dash: [] }],
    LINE:    [{ a: 0, x: 0, y: 0, dx: 0, dy: 3.175, dash: [] }],
    DOTS:    [{ a: 0, x: 0, y: 0, dx: 3.175, dy: 3.175, dash: [0.0001, -3.175] }],
    GRASS:   [{ a: 45, x: 0, y: 0, dx: 6.35, dy: 6.35, dash: [3.175, -3.175] }, { a: 135, x: 0, y: 0, dx: 6.35, dy: 6.35, dash: [3.175, -3.175] }],
    BRICK:   [{ a: 0, x: 0, y: 0, dx: 0, dy: 6.35, dash: [] }, { a: 90, x: 0, y: 0, dx: 6.35, dy: 12.7, dash: [6.35, -6.35] }, { a: 90, x: 6.35, y: 0, dx: 6.35, dy: 12.7, dash: [-6.35, 6.35] }],
    CONCRETE:[{ a: 45, x: 0, y: 0, dx: 0, dy: 6.35, dash: [3.175, -4.7625] }, { a: 0, x: 0, y: 0, dx: 6.35, dy: 6.35, dash: [0.0001, -6.35] }],
    EARTH:   [{ a: 45, x: 0, y: 0, dx: 6.35, dy: 6.35, dash: [] }, { a: 45, x: 0, y: 3.175, dx: 6.35, dy: 6.35, dash: [] }],
    STEEL:   [{ a: 45, x: 0, y: 0, dx: 0, dy: 3.175, dash: [] }, { a: 45, x: 1.5875, y: 0, dx: 0, dy: 3.175, dash: [] }],
    HONEY:   [{ a: 0, x: 0, y: 0, dx: 5.5, dy: 3.175, dash: [3.175, -3.175] }, { a: 120, x: 0, y: 0, dx: 5.5, dy: 3.175, dash: [3.175, -3.175] }, { a: 60, x: 3.175, y: 0, dx: 5.5, dy: 3.175, dash: [3.175, -3.175] }]
  };

  /* ---------- Formateo de unidades ---------- */
  G.fmt = function (v, prec) {
    if (prec === undefined) prec = 4;
    if (!isFinite(v)) return '0';
    var s = v.toFixed(prec);
    if (s === '-' + (0).toFixed(prec)) s = (0).toFixed(prec);
    return s;
  };
  G.fmtArch = function (v) { /* pies-pulgadas fraccionarias */
    var neg = v < 0; v = Math.abs(v);
    var ft = Math.floor(v / 12), inch = v - ft * 12;
    var whole = Math.floor(inch), frac = Math.round((inch - whole) * 16);
    if (frac === 16) { whole++; frac = 0; }
    if (whole === 12) { ft++; whole = 0; }
    var s = ft + "'-" + whole;
    if (frac) {
      var g = (function gcd(a, b) { return b ? gcd(b, a % b) : a; })(frac, 16);
      s += ' ' + frac / g + '/' + 16 / g;
    }
    return (neg ? '-' : '') + s + '"';
  };
})();
