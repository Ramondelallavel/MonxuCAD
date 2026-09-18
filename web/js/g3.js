/* ============================================================
   g3.js — Álgebra 3D
   Vectores, matrices 4x4, cuaternios, planos, rayos y cajas.
   Convenio: matrices en orden columna (como OpenGL), vectores
   fila-columna v' = M · v.  Array de 16 en orden columna:
     m[0] m[4] m[8]  m[12]
     m[1] m[5] m[9]  m[13]
     m[2] m[6] m[10] m[14]
     m[3] m[7] m[11] m[15]
   ============================================================ */
(function () {
  'use strict';
  var CAD = (window.CAD = window.CAD || {});
  var G3 = (CAD.G3 = {});
  var EPS = 1e-9;
  G3.EPS = EPS;

  /* ---------- Vectores ---------- */
  function v3(x, y, z) { return { x: x || 0, y: y || 0, z: z || 0 }; }
  G3.v = v3;
  G3.from2 = function (p, z) { return { x: p.x, y: p.y, z: z || p.z || 0 }; };
  G3.add = function (a, b) { return v3(a.x + b.x, a.y + b.y, a.z + b.z); };
  G3.sub = function (a, b) { return v3(a.x - b.x, a.y - b.y, a.z - b.z); };
  G3.mul = function (a, s) { return v3(a.x * s, a.y * s, a.z * s); };
  G3.neg = function (a) { return v3(-a.x, -a.y, -a.z); };
  G3.dot = function (a, b) { return a.x * b.x + a.y * b.y + a.z * b.z; };
  G3.cross = function (a, b) {
    return v3(a.y * b.z - a.z * b.y, a.z * b.x - a.x * b.z, a.x * b.y - a.y * b.x);
  };
  G3.len = function (a) { return Math.sqrt(a.x * a.x + a.y * a.y + a.z * a.z); };
  G3.len2 = function (a) { return a.x * a.x + a.y * a.y + a.z * a.z; };
  G3.dist = function (a, b) { var dx = a.x - b.x, dy = a.y - b.y, dz = a.z - b.z; return Math.sqrt(dx * dx + dy * dy + dz * dz); };
  G3.dist2 = function (a, b) { var dx = a.x - b.x, dy = a.y - b.y, dz = a.z - b.z; return dx * dx + dy * dy + dz * dz; };
  G3.norm = function (a) { var l = G3.len(a); return l < EPS ? v3(0, 0, 0) : v3(a.x / l, a.y / l, a.z / l); };
  G3.lerp = function (a, b, t) { return v3(a.x + (b.x - a.x) * t, a.y + (b.y - a.y) * t, a.z + (b.z - a.z) * t); };
  G3.eq = function (a, b, tol) { return G3.dist2(a, b) <= (tol || 1e-8) * (tol || 1e-8); };
  G3.copy = function (a) { return v3(a.x, a.y, a.z); };
  G3.mid = function (a, b) { return v3((a.x + b.x) / 2, (a.y + b.y) / 2, (a.z + b.z) / 2); };

  /* Un vector cualquiera no paralelo a n (para construir bases) */
  G3.perp = function (n) {
    var ax = Math.abs(n.x), ay = Math.abs(n.y), az = Math.abs(n.z);
    var o = (ax <= ay && ax <= az) ? v3(1, 0, 0) : (ay <= az ? v3(0, 1, 0) : v3(0, 0, 1));
    return G3.norm(G3.cross(n, o));
  };

  /* Sistema de coordenadas del objeto arbitrario (ARBITRARY AXIS, igual que AutoCAD) */
  G3.arbitraryAxis = function (n) {
    n = G3.norm(n);
    var ax;
    if (Math.abs(n.x) < 1 / 64 && Math.abs(n.y) < 1 / 64) ax = G3.cross(v3(0, 1, 0), n);
    else ax = G3.cross(v3(0, 0, 1), n);
    ax = G3.norm(ax);
    return { x: ax, y: G3.norm(G3.cross(n, ax)), z: n };
  };

  /* ---------- Matrices 4x4 ---------- */
  function ident() { return [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]; }
  G3.ident = ident;

  G3.mMul = function (a, b) {   /* aplica b y después a  (resultado = a · b) */
    var o = new Array(16);
    for (var c = 0; c < 4; c++) {
      var b0 = b[c * 4], b1 = b[c * 4 + 1], b2 = b[c * 4 + 2], b3 = b[c * 4 + 3];
      o[c * 4]     = a[0] * b0 + a[4] * b1 + a[8]  * b2 + a[12] * b3;
      o[c * 4 + 1] = a[1] * b0 + a[5] * b1 + a[9]  * b2 + a[13] * b3;
      o[c * 4 + 2] = a[2] * b0 + a[6] * b1 + a[10] * b2 + a[14] * b3;
      o[c * 4 + 3] = a[3] * b0 + a[7] * b1 + a[11] * b2 + a[15] * b3;
    }
    return o;
  };
  G3.mChain = function () {
    var m = ident();
    for (var i = 0; i < arguments.length; i++) if (arguments[i]) m = G3.mMul(m, arguments[i]);
    return m;
  };
  G3.mTrans = function (x, y, z) {
    if (typeof x === 'object') { z = x.z; y = x.y; x = x.x; }
    return [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, x || 0, y || 0, z || 0, 1];
  };
  G3.mScale = function (x, y, z) {
    if (typeof x === 'object') { z = x.z; y = x.y; x = x.x; }
    if (y === undefined) { y = x; z = x; }
    return [x, 0, 0, 0, 0, y, 0, 0, 0, 0, z, 0, 0, 0, 0, 1];
  };
  G3.mRotX = function (a) { var c = Math.cos(a), s = Math.sin(a); return [1, 0, 0, 0, 0, c, s, 0, 0, -s, c, 0, 0, 0, 0, 1]; };
  G3.mRotY = function (a) { var c = Math.cos(a), s = Math.sin(a); return [c, 0, -s, 0, 0, 1, 0, 0, s, 0, c, 0, 0, 0, 0, 1]; };
  G3.mRotZ = function (a) { var c = Math.cos(a), s = Math.sin(a); return [c, s, 0, 0, -s, c, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]; };

  /* Rotación alrededor de un eje arbitrario que pasa por un punto */
  G3.mRotAxis = function (pt, dir, ang) {
    var d = G3.norm(dir), c = Math.cos(ang), s = Math.sin(ang), t = 1 - c;
    var x = d.x, y = d.y, z = d.z;
    var r = [
      t * x * x + c,     t * x * y + s * z, t * x * z - s * y, 0,
      t * x * y - s * z, t * y * y + c,     t * y * z + s * x, 0,
      t * x * z + s * y, t * y * z - s * x, t * z * z + c,     0,
      0, 0, 0, 1
    ];
    if (!pt) return r;
    return G3.mChain(G3.mTrans(pt), r, G3.mTrans(G3.neg(pt)));
  };

  /* Matriz que lleva el plano XY al plano definido por origen+normal */
  G3.mPlane = function (org, normal, xdir) {
    var z = G3.norm(normal);
    var x = xdir ? G3.norm(xdir) : G3.arbitraryAxis(z).x;
    x = G3.norm(G3.sub(x, G3.mul(z, G3.dot(x, z))));
    var y = G3.cross(z, x);
    return [x.x, x.y, x.z, 0, y.x, y.y, y.z, 0, z.x, z.y, z.z, 0, org.x, org.y, org.z, 1];
  };

  G3.mDet = function (m) {
    var a00 = m[0], a01 = m[1], a02 = m[2], a03 = m[3],
        a10 = m[4], a11 = m[5], a12 = m[6], a13 = m[7],
        a20 = m[8], a21 = m[9], a22 = m[10], a23 = m[11],
        a30 = m[12], a31 = m[13], a32 = m[14], a33 = m[15];
    var b00 = a00 * a11 - a01 * a10, b01 = a00 * a12 - a02 * a10,
        b02 = a00 * a13 - a03 * a10, b03 = a01 * a12 - a02 * a11,
        b04 = a01 * a13 - a03 * a11, b05 = a02 * a13 - a03 * a12,
        b06 = a20 * a31 - a21 * a30, b07 = a20 * a32 - a22 * a30,
        b08 = a20 * a33 - a23 * a30, b09 = a21 * a32 - a22 * a31,
        b10 = a21 * a33 - a23 * a31, b11 = a22 * a33 - a23 * a32;
    return b00 * b11 - b01 * b10 + b02 * b09 + b03 * b08 - b04 * b07 + b05 * b06;
  };

  G3.mInv = function (m) {
    var a00 = m[0], a01 = m[1], a02 = m[2], a03 = m[3],
        a10 = m[4], a11 = m[5], a12 = m[6], a13 = m[7],
        a20 = m[8], a21 = m[9], a22 = m[10], a23 = m[11],
        a30 = m[12], a31 = m[13], a32 = m[14], a33 = m[15];
    var b00 = a00 * a11 - a01 * a10, b01 = a00 * a12 - a02 * a10,
        b02 = a00 * a13 - a03 * a10, b03 = a01 * a12 - a02 * a11,
        b04 = a01 * a13 - a03 * a11, b05 = a02 * a13 - a03 * a12,
        b06 = a20 * a31 - a21 * a30, b07 = a20 * a32 - a22 * a30,
        b08 = a20 * a33 - a23 * a30, b09 = a21 * a32 - a22 * a31,
        b10 = a21 * a33 - a23 * a31, b11 = a22 * a33 - a23 * a32;
    var det = b00 * b11 - b01 * b10 + b02 * b09 + b03 * b08 - b04 * b07 + b05 * b06;
    if (Math.abs(det) < 1e-14) return null;
    var d = 1 / det;
    return [
      (a11 * b11 - a12 * b10 + a13 * b09) * d, (a02 * b10 - a01 * b11 - a03 * b09) * d,
      (a31 * b05 - a32 * b04 + a33 * b03) * d, (a22 * b04 - a21 * b05 - a23 * b03) * d,
      (a12 * b08 - a10 * b11 - a13 * b07) * d, (a00 * b11 - a02 * b08 + a03 * b07) * d,
      (a32 * b02 - a30 * b05 - a33 * b01) * d, (a20 * b05 - a22 * b02 + a23 * b01) * d,
      (a10 * b10 - a11 * b08 + a13 * b06) * d, (a01 * b08 - a00 * b10 - a03 * b06) * d,
      (a30 * b04 - a31 * b02 + a33 * b00) * d, (a21 * b02 - a20 * b04 - a23 * b00) * d,
      (a11 * b07 - a10 * b09 - a12 * b06) * d, (a00 * b09 - a01 * b07 + a02 * b06) * d,
      (a31 * b01 - a30 * b03 - a32 * b00) * d, (a20 * b03 - a21 * b01 + a22 * b00) * d
    ];
  };

  G3.mTranspose = function (m) {
    return [m[0], m[4], m[8], m[12], m[1], m[5], m[9], m[13],
            m[2], m[6], m[10], m[14], m[3], m[7], m[11], m[15]];
  };

  /* Matriz normal: inversa traspuesta de la 3x3 */
  G3.mNormal = function (m) {
    var i = G3.mInv(m);
    if (!i) return ident();
    return [i[0], i[4], i[8], 0, i[1], i[5], i[9], 0, i[2], i[6], i[10], 0, 0, 0, 0, 1];
  };

  G3.apply = function (m, p) {
    var x = p.x, y = p.y, z = p.z || 0;
    var w = m[3] * x + m[7] * y + m[11] * z + m[15];
    if (Math.abs(w) < EPS) w = 1;
    return v3((m[0] * x + m[4] * y + m[8] * z + m[12]) / w,
              (m[1] * x + m[5] * y + m[9] * z + m[13]) / w,
              (m[2] * x + m[6] * y + m[10] * z + m[14]) / w);
  };
  G3.applyDir = function (m, p) {   /* ignora la traslación */
    var x = p.x, y = p.y, z = p.z || 0;
    return v3(m[0] * x + m[4] * y + m[8] * z,
              m[1] * x + m[5] * y + m[9] * z,
              m[2] * x + m[6] * y + m[10] * z);
  };
  /* Devuelve [x,y,z,w] sin dividir — para recorte en el espacio de recorte */
  G3.apply4 = function (m, p) {
    var x = p.x, y = p.y, z = p.z || 0;
    return [m[0] * x + m[4] * y + m[8] * z + m[12],
            m[1] * x + m[5] * y + m[9] * z + m[13],
            m[2] * x + m[6] * y + m[10] * z + m[14],
            m[3] * x + m[7] * y + m[11] * z + m[15]];
  };

  /* ---------- Cámara ---------- */
  G3.lookAt = function (eye, target, up) {
    var z = G3.norm(G3.sub(eye, target));
    if (G3.len2(z) < EPS) z = v3(0, 0, 1);
    var x = G3.cross(up || v3(0, 0, 1), z);
    if (G3.len2(x) < 1e-12) x = G3.perp(z);
    x = G3.norm(x);
    var y = G3.cross(z, x);
    return [x.x, y.x, z.x, 0, x.y, y.y, z.y, 0, x.z, y.z, z.z, 0,
            -G3.dot(x, eye), -G3.dot(y, eye), -G3.dot(z, eye), 1];
  };
  G3.perspective = function (fovy, aspect, near, far) {
    var f = 1 / Math.tan(fovy / 2), nf = 1 / (near - far);
    return [f / aspect, 0, 0, 0, 0, f, 0, 0, 0, 0, (far + near) * nf, -1, 0, 0, 2 * far * near * nf, 0];
  };
  G3.ortho = function (l, r, bo, t, n, f) {
    var lr = 1 / (l - r), bt = 1 / (bo - t), nf = 1 / (n - f);
    return [-2 * lr, 0, 0, 0, 0, -2 * bt, 0, 0, 0, 0, 2 * nf, 0,
            (l + r) * lr, (t + bo) * bt, (f + n) * nf, 1];
  };

  /* ---------- Cuaternios (para el orbitado suave) ---------- */
  G3.qFromAxis = function (axis, ang) {
    var a = G3.norm(axis), s = Math.sin(ang / 2);
    return { x: a.x * s, y: a.y * s, z: a.z * s, w: Math.cos(ang / 2) };
  };
  G3.qMul = function (a, b) {
    return {
      x: a.w * b.x + a.x * b.w + a.y * b.z - a.z * b.y,
      y: a.w * b.y - a.x * b.z + a.y * b.w + a.z * b.x,
      z: a.w * b.z + a.x * b.y - a.y * b.x + a.z * b.w,
      w: a.w * b.w - a.x * b.x - a.y * b.y - a.z * b.z
    };
  };
  G3.qMat = function (q) {
    var x = q.x, y = q.y, z = q.z, w = q.w;
    var n = Math.sqrt(x * x + y * y + z * z + w * w) || 1;
    x /= n; y /= n; z /= n; w /= n;
    return [1 - 2 * (y * y + z * z), 2 * (x * y + z * w), 2 * (x * z - y * w), 0,
            2 * (x * y - z * w), 1 - 2 * (x * x + z * z), 2 * (y * z + x * w), 0,
            2 * (x * z + y * w), 2 * (y * z - x * w), 1 - 2 * (x * x + y * y), 0,
            0, 0, 0, 1];
  };
  G3.qSlerp = function (a, b, t) {
    var d = a.x * b.x + a.y * b.y + a.z * b.z + a.w * b.w;
    var bb = b;
    if (d < 0) { d = -d; bb = { x: -b.x, y: -b.y, z: -b.z, w: -b.w }; }
    if (d > 0.9995) {
      return { x: a.x + (bb.x - a.x) * t, y: a.y + (bb.y - a.y) * t,
               z: a.z + (bb.z - a.z) * t, w: a.w + (bb.w - a.w) * t };
    }
    var th = Math.acos(d), s = Math.sin(th);
    var w1 = Math.sin((1 - t) * th) / s, w2 = Math.sin(t * th) / s;
    return { x: a.x * w1 + bb.x * w2, y: a.y * w1 + bb.y * w2,
             z: a.z * w1 + bb.z * w2, w: a.w * w1 + bb.w * w2 };
  };

  /* ---------- Planos ---------- */
  G3.plane = function (normal, w) { return { n: G3.norm(normal), w: w }; };
  G3.planeFrom3 = function (a, b, c) {
    var n = G3.norm(G3.cross(G3.sub(b, a), G3.sub(c, a)));
    return { n: n, w: G3.dot(n, a) };
  };
  G3.planeDist = function (pl, p) { return G3.dot(pl.n, p) - pl.w; };
  G3.planeProject = function (pl, p) { return G3.sub(p, G3.mul(pl.n, G3.planeDist(pl, p))); };

  /* ---------- Rayos ---------- */
  G3.rayPlane = function (org, dir, pl) {
    var dn = G3.dot(dir, pl.n);
    if (Math.abs(dn) < 1e-12) return null;
    var t = (pl.w - G3.dot(org, pl.n)) / dn;
    return { t: t, p: G3.add(org, G3.mul(dir, t)) };
  };

  /* Möller–Trumbore */
  G3.rayTri = function (org, dir, a, b, c, twoSided) {
    var e1 = G3.sub(b, a), e2 = G3.sub(c, a);
    var pv = G3.cross(dir, e2), det = G3.dot(e1, pv);
    if (twoSided === false ? det < 1e-12 : Math.abs(det) < 1e-12) return null;
    var inv = 1 / det, tv = G3.sub(org, a);
    var u = G3.dot(tv, pv) * inv;
    if (u < -1e-7 || u > 1 + 1e-7) return null;
    var qv = G3.cross(tv, e1);
    var v = G3.dot(dir, qv) * inv;
    if (v < -1e-7 || u + v > 1 + 1e-7) return null;
    var t = G3.dot(e2, qv) * inv;
    if (t < 1e-7) return null;
    return { t: t, u: u, v: v, p: G3.add(org, G3.mul(dir, t)) };
  };

  /* Distancia mínima entre dos rectas; devuelve los parámetros y los puntos */
  G3.lineLine = function (p1, d1, p2, d2) {
    var r = G3.sub(p1, p2);
    var a = G3.dot(d1, d1), b = G3.dot(d1, d2), c = G3.dot(d2, d2);
    var d = G3.dot(d1, r), e = G3.dot(d2, r);
    var den = a * c - b * b;
    var s, t;
    if (Math.abs(den) < 1e-12) { s = 0; t = (b > c ? d / b : e / c); }
    else { s = (b * e - c * d) / den; t = (a * e - b * d) / den; }
    var q1 = G3.add(p1, G3.mul(d1, s)), q2 = G3.add(p2, G3.mul(d2, t));
    return { s: s, t: t, p1: q1, p2: q2, d: G3.dist(q1, q2) };
  };

  G3.distToSeg = function (p, a, b) {
    var ab = G3.sub(b, a), l2 = G3.len2(ab);
    if (l2 < 1e-18) return G3.dist(p, a);
    var t = G3.dot(G3.sub(p, a), ab) / l2;
    t = t < 0 ? 0 : (t > 1 ? 1 : t);
    return G3.dist(p, G3.add(a, G3.mul(ab, t)));
  };

  /* ---------- Cajas ---------- */
  G3.box = function () { return { x1: Infinity, y1: Infinity, z1: Infinity, x2: -Infinity, y2: -Infinity, z2: -Infinity }; };
  G3.boxAdd = function (b, p) {
    if (p.x < b.x1) b.x1 = p.x; if (p.x > b.x2) b.x2 = p.x;
    if (p.y < b.y1) b.y1 = p.y; if (p.y > b.y2) b.y2 = p.y;
    var z = p.z || 0;
    if (z < b.z1) b.z1 = z; if (z > b.z2) b.z2 = z;
    return b;
  };
  G3.boxMerge = function (a, b) {
    if (!a) return b; if (!b) return a;
    return { x1: Math.min(a.x1, b.x1), y1: Math.min(a.y1, b.y1), z1: Math.min(a.z1, b.z1),
             x2: Math.max(a.x2, b.x2), y2: Math.max(a.y2, b.y2), z2: Math.max(a.z2, b.z2) };
  };
  G3.boxValid = function (b) { return !!b && b.x2 >= b.x1 && b.y2 >= b.y1 && b.z2 >= b.z1; };
  G3.boxCenter = function (b) { return v3((b.x1 + b.x2) / 2, (b.y1 + b.y2) / 2, (b.z1 + b.z2) / 2); };
  G3.boxSize = function (b) { return v3(b.x2 - b.x1, b.y2 - b.y1, b.z2 - b.z1); };
  G3.boxDiag = function (b) { return G3.len(G3.boxSize(b)); };
  G3.boxCorners = function (b) {
    var o = [];
    for (var i = 0; i < 8; i++)
      o.push(v3(i & 1 ? b.x2 : b.x1, i & 2 ? b.y2 : b.y1, i & 4 ? b.z2 : b.z1));
    return o;
  };
  G3.boxHit = function (b, org, dir) {   /* slab test */
    var t0 = -Infinity, t1 = Infinity;
    var ax = ['x', 'y', 'z'], lo = [b.x1, b.y1, b.z1], hi = [b.x2, b.y2, b.z2];
    for (var i = 0; i < 3; i++) {
      var d = dir[ax[i]], o = org[ax[i]] || 0;
      if (Math.abs(d) < 1e-12) { if (o < lo[i] || o > hi[i]) return false; continue; }
      var ta = (lo[i] - o) / d, tb = (hi[i] - o) / d;
      if (ta > tb) { var s = ta; ta = tb; tb = s; }
      if (ta > t0) t0 = ta;
      if (tb < t1) t1 = tb;
      if (t0 > t1) return false;
    }
    return t1 >= 0;
  };

  /* ---------- Polígonos en el espacio ---------- */
  G3.polyNormal = function (pts) {   /* Newell: robusto con polígonos no planos */
    var n = v3(0, 0, 0), m = pts.length;
    for (var i = 0; i < m; i++) {
      var a = pts[i], b = pts[(i + 1) % m];
      n.x += (a.y - b.y) * (a.z + b.z);
      n.y += (a.z - b.z) * (a.x + b.x);
      n.z += (a.x - b.x) * (a.y + b.y);
    }
    return G3.norm(n);
  };
  G3.polyArea = function (pts) {
    var n = v3(0, 0, 0), m = pts.length;
    for (var i = 0; i < m; i++) {
      var c = G3.cross(pts[i], pts[(i + 1) % m]);
      n.x += c.x; n.y += c.y; n.z += c.z;
    }
    return G3.len(n) / 2;
  };
  G3.polyCentroid = function (pts) {
    var c = v3(0, 0, 0);
    for (var i = 0; i < pts.length; i++) { c.x += pts[i].x; c.y += pts[i].y; c.z += pts[i].z || 0; }
    var k = pts.length || 1;
    return v3(c.x / k, c.y / k, c.z / k);
  };

  /* Triangulación por recorte de orejas sobre el plano del polígono.
     Tiene que aguantar polígonos con muchos vértices colineales: la
     reparación de uniones en T los inserta a propósito, y una prueba de
     oreja ingenua los toma por vértices reflejos y se atasca. */
  G3.triangulate = function (pts) {
    var n = pts.length;
    if (n < 3) return [];
    if (n === 3) return [[0, 1, 2]];
    var nrm = G3.polyNormal(pts);
    if (G3.len2(nrm) < 1e-20) return [];
    var ax = G3.arbitraryAxis(nrm);
    var flat = new Array(n);
    var i, j, k;
    for (i = 0; i < n; i++) flat[i] = { x: G3.dot(pts[i], ax.x), y: G3.dot(pts[i], ax.y) };

    /* escala del polígono: los umbrales son relativos, no absolutos */
    var minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
    for (i = 0; i < n; i++) {
      if (flat[i].x < minX) minX = flat[i].x;
      if (flat[i].x > maxX) maxX = flat[i].x;
      if (flat[i].y < minY) minY = flat[i].y;
      if (flat[i].y > maxY) maxY = flat[i].y;
    }
    var scale = Math.max(maxX - minX, maxY - minY, 1e-12);
    var EPSA = scale * scale * 1e-10;   /* área (producto vectorial) */
    var EPSD = scale * 1e-7;            /* distancia */

    function cr(o, a, b) { return (a.x - o.x) * (b.y - o.y) - (a.y - o.y) * (b.x - o.x); }

    /* orientación antihoraria */
    var area2 = 0;
    for (i = 0; i < n; i++) {
      var a0 = flat[i], b0 = flat[(i + 1) % n];
      area2 += a0.x * b0.y - b0.x * a0.y;
    }
    var idx = [];
    for (i = 0; i < n; i++) idx.push(i);
    if (area2 < 0) idx.reverse();

    /* quita vértices repetidos consecutivos: nunca forman oreja */
    var clean = [];
    for (i = 0; i < idx.length; i++) {
      var pc = flat[idx[i]], pp = clean.length ? flat[clean[clean.length - 1]] : null;
      if (pp && Math.abs(pc.x - pp.x) < EPSD && Math.abs(pc.y - pp.y) < EPSD) continue;
      clean.push(idx[i]);
    }
    while (clean.length > 2) {
      var f0 = flat[clean[0]], fl = flat[clean[clean.length - 1]];
      if (Math.abs(f0.x - fl.x) < EPSD && Math.abs(f0.y - fl.y) < EPSD) clean.pop();
      else break;
    }
    idx = clean;
    if (idx.length < 3) return [];

    var tri = [];
    var guard = 0, maxGuard = idx.length * idx.length + 32;

    while (idx.length > 3 && guard++ < maxGuard) {
      var m = idx.length;
      var cut = -1, bestQ = -Infinity;
      for (k = 0; k < m; k++) {
        var i0 = idx[(k + m - 1) % m], i1 = idx[k], i2 = idx[(k + 1) % m];
        var p0 = flat[i0], p1 = flat[i1], p2 = flat[i2];
        var c = cr(p0, p1, p2);
        if (c <= EPSA) continue;                  /* reflejo o degenerado */
        var bad = false;
        for (j = 0; j < m; j++) {
          var ij = idx[j];
          if (ij === i0 || ij === i1 || ij === i2) continue;
          var q = flat[ij];
          /* un punto que coincide con una esquina de la oreja no estorba */
          if ((Math.abs(q.x - p0.x) < EPSD && Math.abs(q.y - p0.y) < EPSD) ||
              (Math.abs(q.x - p1.x) < EPSD && Math.abs(q.y - p1.y) < EPSD) ||
              (Math.abs(q.x - p2.x) < EPSD && Math.abs(q.y - p2.y) < EPSD)) continue;
          /* estrictamente dentro: los que caen en el borde tampoco estorban */
          if (cr(p0, p1, q) > EPSA && cr(p1, p2, q) > EPSA && cr(p2, p0, q) > EPSA) { bad = true; break; }
        }
        if (bad) continue;
        /* de todas las orejas válidas se corta la más "gorda": produce
           triángulos mejor formados y evita astillas */
        var l0 = dist2(p0, p1), l1 = dist2(p1, p2), l2 = dist2(p2, p0);
        var q2 = c / Math.max(l0, l1, l2, 1e-30);
        if (q2 > bestQ) { bestQ = q2; cut = k; }
      }
      if (cut < 0) {
        /* Ninguna oreja válida: casi siempre porque quedan vértices
           colineales.  Se corta igualmente la oreja más plana en vez de
           borrar el vértice: el triángulo sale casi sin área, pero el
           vértice se conserva y el contorno sigue coincidiendo con el de
           la cara vecina.  Si se borrase, esa cara sí lo usaría y la
           superficie se abriría por ahí. */
        var worst = -1, worstC = Infinity;
        for (k = 0; k < m; k++) {
          var j0 = idx[(k + m - 1) % m], j1 = idx[k], j2 = idx[(k + 1) % m];
          var cc = Math.abs(cr(flat[j0], flat[j1], flat[j2]));
          if (cc < worstC) { worstC = cc; worst = k; }
        }
        if (worst < 0) break;
        tri.push([idx[(worst + m - 1) % m], idx[worst], idx[(worst + 1) % m]]);
        idx.splice(worst, 1);
        continue;
      }
      var m2 = idx.length;
      tri.push([idx[(cut + m2 - 1) % m2], idx[cut], idx[(cut + 1) % m2]]);
      idx.splice(cut, 1);
    }
    if (idx.length === 3) tri.push([idx[0], idx[1], idx[2]]);
    else if (idx.length > 3) {
      /* último recurso: abanico desde el vértice más convexo */
      var bi = 0, bc = -Infinity;
      for (k = 0; k < idx.length; k++) {
        var c2 = cr(flat[idx[(k + idx.length - 1) % idx.length]], flat[idx[k]], flat[idx[(k + 1) % idx.length]]);
        if (c2 > bc) { bc = c2; bi = k; }
      }
      for (k = 1; k < idx.length - 1; k++)
        tri.push([idx[bi], idx[(bi + k) % idx.length], idx[(bi + k + 1) % idx.length]]);
    }
    return tri;
  };
  function dist2(a, b) { var dx = a.x - b.x, dy = a.y - b.y; return dx * dx + dy * dy; }

  /* ---------- Muestreo de curvas 2D del dibujo hacia 3D ---------- */
  G3.arcPoints = function (cx, cy, r, a0, a1, seg) {
    var out = [], d = a1 - a0;
    seg = seg || Math.max(8, Math.ceil(Math.abs(d) / (Math.PI / 24)));
    for (var i = 0; i <= seg; i++) {
      var a = a0 + d * (i / seg);
      out.push(v3(cx + r * Math.cos(a), cy + r * Math.sin(a), 0));
    }
    return out;
  };

  G3.fmt = function (v, p) {
    if (!isFinite(v)) return '0';
    var s = v.toFixed(p === undefined ? 4 : p);
    if (/\./.test(s)) s = s.replace(/0+$/, '').replace(/\.$/, '');
    return s === '-0' ? '0' : s;
  };
})();
