/* ============================================================
   view3d.js — Ventana gráfica 3D (WebGL) con órbita, estilos
   visuales, ViewCube, iluminación y designación por rayo.
   Reproduce el comportamiento de ORBIT/3DORBIT, SOMBRA,
   ESTILOSVISUALES y las vistas predefinidas de AutoCAD.
   ============================================================ */
(function () {
  'use strict';
  var CAD = (window.CAD = window.CAD || {});
  var G3 = CAD.G3, M = CAD.Mesh;
  var V3 = (CAD.View3D = {});
  var v3 = G3.v;

  /* ---------- Estilos visuales (igual nomenclatura que AutoCAD) ---------- */
  var STYLES = V3.STYLES = {
    '2DESTRUCTURA':  { id: 'w2d',    label: 'Estructura alámbrica 2D', faces: false, edges: true,  depth: false },
    'ESTRUCTURA':    { id: 'wire',   label: 'Estructura alámbrica 3D', faces: false, edges: true,  depth: false },
    'OCULTA':        { id: 'hidden', label: 'Oculto',                  faces: true,  edges: true,  depth: true, flat: 'bg' },
    'SOMBREADO':     { id: 'shaded', label: 'Sombreado',               faces: true,  edges: false, depth: true },
    'ARISTASSOMBRA': { id: 'shedge', label: 'Sombreado con aristas',   faces: true,  edges: true,  depth: true },
    'GRISES':        { id: 'gray',   label: 'Tonos de gris',           faces: true,  edges: true,  depth: true, gray: true },
    'CONCEPTUAL':    { id: 'concept',label: 'Conceptual',              faces: true,  edges: true,  depth: true, gooch: true },
    'REALISTA':      { id: 'real',   label: 'Realista',                faces: true,  edges: false, depth: true, spec: true },
    'BOCETO':        { id: 'sketch', label: 'Boceto',                  faces: true,  edges: true,  depth: true, jitter: true },
    'RAYOSX':        { id: 'xray',   label: 'Rayos X',                 faces: true,  edges: true,  depth: true, alpha: 0.45 }
  };

  /* ---------- Vistas predefinidas ---------- */
  V3.VIEWS = {
    SUPERIOR:  { dir: [0, 0, 1],  up: [0, 1, 0] },
    INFERIOR:  { dir: [0, 0, -1], up: [0, -1, 0] },
    IZQUIERDA: { dir: [-1, 0, 0], up: [0, 0, 1] },
    DERECHA:   { dir: [1, 0, 0],  up: [0, 0, 1] },
    FRONTAL:   { dir: [0, -1, 0], up: [0, 0, 1] },
    POSTERIOR: { dir: [0, 1, 0],  up: [0, 0, 1] },
    SWISO:     { dir: [-1, -1, 1], up: [0, 0, 1] },
    SEISO:     { dir: [1, -1, 1],  up: [0, 0, 1] },
    NEISO:     { dir: [1, 1, 1],   up: [0, 0, 1] },
    NWISO:     { dir: [-1, 1, 1],  up: [0, 0, 1] }
  };

  /* ============================================================
     Cámara
     ============================================================ */
  function Cam() {
    this.target = v3(0, 0, 0);
    this.dist = 1000;
    this.dir = G3.norm(v3(-1, -1, 1));   /* de la mira al ojo */
    this.up = v3(0, 0, 1);
    this.persp = false;
    this.fov = 40 * Math.PI / 180;
    this.near = 0.1;
    this.far = 1e6;
  }
  V3.Cam = Cam;
  Cam.prototype.eye = function () { return G3.add(this.target, G3.mul(this.dir, this.dist)); };
  Cam.prototype.view = function () { return G3.lookAt(this.eye(), this.target, this.up); };
  /* El rango de profundidad se ajusta a la escena: si se deja un margen
     enorme, la precisión del búfer Z se desmorona y las caras se rompen. */
  Cam.prototype.proj = function (w, h, radius) {
    var asp = w / Math.max(1, h);
    var R = radius || this.radius || Math.max(this.dist, 1);
    R = Math.max(R, this.dist * 0.02, 1e-3);
    if (this.persp) {
      var n = Math.max(this.dist - R * 1.6, this.dist * 0.004, 1e-4);
      var f = this.dist + R * 2.4;
      return G3.perspective(this.fov, asp, n, f);
    }
    var hh = this.dist * Math.tan(this.fov / 2);
    var hw = hh * asp;
    /* glOrtho: el rango visible en el espacio de la cámara es [-far, -near],
       así que ambos planos se miden a lo largo de la dirección de vista. */
    var m = R * 1.8 + this.dist * 0.02;
    return G3.ortho(-hw, hw, -hh, hh, this.dist - m, this.dist + m);
  };
  Cam.prototype.vp = function (w, h, radius) { return G3.mMul(this.proj(w, h, radius), this.view()); };

  Cam.prototype.orbit = function (dx, dy) {
    var e = this.eye();
    var right = G3.norm(G3.cross(this.dir, this.up));
    if (G3.len2(right) < 1e-12) right = G3.perp(this.dir);
    /* giro alrededor del eje Z global (acimut) y del eje derecha (elevación) */
    var mz = G3.mRotAxis(null, v3(0, 0, 1), -dx);
    this.dir = G3.norm(G3.applyDir(mz, this.dir));
    this.up = G3.norm(G3.applyDir(mz, this.up));
    right = G3.norm(G3.cross(this.dir, this.up));
    var mr = G3.mRotAxis(null, right, -dy);
    var nd = G3.norm(G3.applyDir(mr, this.dir));
    var nu = G3.norm(G3.applyDir(mr, this.up));
    /* evita el vuelco sobre los polos */
    if (Math.abs(G3.dot(nd, v3(0, 0, 1))) < 0.9995) { this.dir = nd; this.up = nu; }
    this.up = G3.norm(G3.sub(this.up, G3.mul(this.dir, G3.dot(this.up, this.dir))));
  };
  Cam.prototype.pan = function (dx, dy, w, h) {
    var hh = this.dist * Math.tan(this.fov / 2) * 2;
    var hw = hh * (w / Math.max(1, h));
    var right = G3.norm(G3.cross(this.dir, this.up));
    var up = G3.norm(G3.cross(right, this.dir));
    this.target = G3.add(this.target, G3.add(G3.mul(right, -dx / w * hw), G3.mul(up, dy / h * hh)));
  };
  Cam.prototype.zoom = function (f) { this.dist = Math.max(1e-4, Math.min(1e9, this.dist * f)); };
  /* Zoom hacia el cursor: el punto señalado se queda quieto en pantalla,
     como en SolidWorks y CATIA.  Se corrige el objetivo con el
     desplazamiento que el cambio de distancia introduce. */
  Cam.prototype.zoomAt = function (f, sx, sy, w, h) {
    var antes = this.ray(sx, sy, w, h);
    var d0 = this.dist;
    this.zoom(f);
    if (!antes) return;
    var despues = this.ray(sx, sy, w, h);
    if (!despues) return;
    /* punto de referencia: el plano perpendicular a la vista que pasa
       por el objetivo, que es lo que el usuario percibe como "lo que hay
       bajo el ratón" */
    var pl = { n: G3.norm(this.dir), w: G3.dot(G3.norm(this.dir), this.target) };
    var a = G3.rayPlane(antes.org, antes.dir, pl);
    var b = G3.rayPlane(despues.org, despues.dir, pl);
    if (!a || !b) { this.dist = d0 * f; return; }
    this.target = G3.add(this.target, G3.sub(a.p, b.p));
  };
  Cam.prototype.setView = function (name) {
    var v = V3.VIEWS[name];
    if (!v) return;
    this.dir = G3.norm(v3(v.dir[0], v.dir[1], v.dir[2]));
    this.up = G3.norm(v3(v.up[0], v.up[1], v.up[2]));
    this.up = G3.norm(G3.sub(this.up, G3.mul(this.dir, G3.dot(this.up, this.dir))));
    if (G3.len2(this.up) < 1e-9) this.up = G3.perp(this.dir);
  };
  Cam.prototype.fit = function (box, w, h) {
    if (!G3.boxValid(box)) return;
    this.target = G3.boxCenter(box);
    var d = G3.boxDiag(box) || 100;
    this.radius = d / 2;
    this.dist = d / (2 * Math.tan(this.fov / 2)) * 1.12;
    if (this.dist < 1e-3) this.dist = 1;
  };
  /* Rayo del cursor en coordenadas de mundo */
  Cam.prototype.ray = function (sx, sy, w, h) {
    var inv = G3.mInv(this.vp(w, h, this.radius));
    if (!inv) return null;
    var nx = (sx / w) * 2 - 1, ny = 1 - (sy / h) * 2;
    var a = G3.apply(inv, v3(nx, ny, -1)), b = G3.apply(inv, v3(nx, ny, 1));
    return { org: a, dir: G3.norm(G3.sub(b, a)) };
  };

  /* ============================================================
     Sombreadores
     ============================================================ */
  var VS = [
    'attribute vec3 aPos; attribute vec3 aNrm; attribute vec3 aCol;',
    'uniform mat4 uVP; uniform mat4 uM; uniform mat4 uN;',
    'varying vec3 vN; varying vec3 vC; varying vec3 vP;',
    'void main(){',
    '  vec4 wp = uM * vec4(aPos,1.0);',
    '  vP = wp.xyz;',
    '  vN = normalize((uN * vec4(aNrm,0.0)).xyz);',
    '  vC = aCol;',
    '  gl_Position = uVP * wp;',
    '}'
  ].join('\n');

  var FS = [
    'precision highp float;',
    'varying vec3 vN; varying vec3 vC; varying vec3 vP;',
    'uniform vec3 uEye; uniform int uMode; uniform float uAlpha;',
    'uniform vec3 uFlat;',
    'void main(){',
    '  vec3 N = normalize(vN);',
    '  vec3 V = normalize(uEye - vP);',
    '  if (dot(N,V) < 0.0) N = -N;',
    '  vec3 L1 = normalize(vec3(0.35,-0.55,0.75));',
    '  vec3 L2 = normalize(vec3(-0.6,0.4,0.35));',
    '  float d1 = max(dot(N,L1),0.0), d2 = max(dot(N,L2),0.0);',
    '  vec3 base = vC;',
    '  vec3 col;',
    '  if (uMode == 0) {            /* oculto: relleno plano del fondo */',
    '    col = uFlat;',
    '  } else if (uMode == 1) {     /* sombreado normal */',
    '    col = base * (0.32 + 0.62*d1 + 0.24*d2);',
    '  } else if (uMode == 2) {     /* conceptual (Gooch) */',
    '    float t = dot(N,L1)*0.5+0.5;',
    '    vec3 cool = vec3(0.10,0.22,0.42) + 0.22*base;',
    '    vec3 warm = vec3(0.86,0.72,0.34) + 0.48*base;',
    '    col = mix(cool, warm, t);',
    '  } else if (uMode == 3) {     /* realista con especular */',
    '    vec3 H = normalize(L1+V);',
    '    float s = pow(max(dot(N,H),0.0), 42.0);',
    '    col = base*(0.26 + 0.66*d1 + 0.22*d2) + vec3(0.9)*s*0.35;',
    '  } else if (uMode == 4) {     /* tonos de gris */',
    '    float g = dot(base, vec3(0.299,0.587,0.114));',
    '    col = vec3(g) * (0.34 + 0.60*d1 + 0.22*d2);',
    '  } else {                     /* rayos X */',
    '    col = base * (0.45 + 0.50*d1);',
    '  }',
    '  gl_FragColor = vec4(col, uAlpha);',
    '}'
  ].join('\n');

  var VSL = [
    'attribute vec3 aPos; attribute vec3 aCol;',
    'uniform mat4 uVP; uniform mat4 uM; uniform float uOff;',
    'varying vec3 vC;',
    'void main(){',
    '  vC = aCol;',
    '  vec4 q = uVP * uM * vec4(aPos,1.0);',
    '  q.z -= uOff * q.w;',     /* desplazamiento de profundidad para las aristas */
    '  gl_Position = q;',
    '}'
  ].join('\n');
  var FSL = [
    'precision mediump float; varying vec3 vC; uniform float uAlpha;',
    'void main(){ gl_FragColor = vec4(vC, uAlpha); }'
  ].join('\n');

  function compile(gl, type, src) {
    var s = gl.createShader(type);
    gl.shaderSource(s, src); gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) {
      console.error('shader:', gl.getShaderInfoLog(s));
      return null;
    }
    return s;
  }
  function program(gl, vs, fs) {
    var p = gl.createProgram();
    var a = compile(gl, gl.VERTEX_SHADER, vs), b = compile(gl, gl.FRAGMENT_SHADER, fs);
    if (!a || !b) return null;
    gl.attachShader(p, a); gl.attachShader(p, b); gl.linkProgram(p);
    if (!gl.getProgramParameter(p, gl.LINK_STATUS)) { console.error(gl.getProgramInfoLog(p)); return null; }
    return p;
  }

  /* ============================================================
     Vista 3D
     ============================================================ */
  /* Caché de geometría de GPU por entidad, invalidada por su firma */
  var GEO = new WeakMap();
  V3.dropGeo = function (ent) { if (ent) GEO.delete(ent); else GEO = new WeakMap(); };

  function View(canvas) {
    this.cv = canvas;
    this.cam = new Cam();
    this.style = 'ARISTASSOMBRA';
    this.gl = null;
    this.ok = false;
    this.buffers = { tri: null, line: null };
    this.counts = { tri: 0, line: 0 };
    this.showGrid = true;
    this.showUcs = true;
    this.showCube = true;
    this.bg = [0.129, 0.145, 0.169];
    this.rev = -1;
    this.dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.init();
  }
  V3.View = View;

  View.prototype.init = function () {
    var opt = { antialias: true, alpha: true, depth: true, preserveDrawingBuffer: true, powerPreference: 'high-performance' };
    var gl = null;
    try { gl = this.cv.getContext('webgl2', opt) || this.cv.getContext('webgl', opt) || this.cv.getContext('experimental-webgl', opt); }
    catch (e) { gl = null; }
    if (!gl) { this.ok = false; return; }
    this.gl = gl;
    this.pTri = program(gl, VS, FS);
    this.pLine = program(gl, VSL, FSL);
    if (!this.pTri || !this.pLine) { this.ok = false; return; }
    this.aTri = {
      pos: gl.getAttribLocation(this.pTri, 'aPos'),
      nrm: gl.getAttribLocation(this.pTri, 'aNrm'),
      col: gl.getAttribLocation(this.pTri, 'aCol')
    };
    this.uTri = {
      VP: gl.getUniformLocation(this.pTri, 'uVP'), M: gl.getUniformLocation(this.pTri, 'uM'),
      N: gl.getUniformLocation(this.pTri, 'uN'), eye: gl.getUniformLocation(this.pTri, 'uEye'),
      mode: gl.getUniformLocation(this.pTri, 'uMode'), alpha: gl.getUniformLocation(this.pTri, 'uAlpha'),
      flat: gl.getUniformLocation(this.pTri, 'uFlat')
    };
    this.aLine = { pos: gl.getAttribLocation(this.pLine, 'aPos'), col: gl.getAttribLocation(this.pLine, 'aCol') };
    this.uLine = {
      VP: gl.getUniformLocation(this.pLine, 'uVP'), M: gl.getUniformLocation(this.pLine, 'uM'),
      off: gl.getUniformLocation(this.pLine, 'uOff'), alpha: gl.getUniformLocation(this.pLine, 'uAlpha')
    };
    this.buffers.tri = { pos: gl.createBuffer(), nrm: gl.createBuffer(), col: gl.createBuffer() };
    this.buffers.line = { pos: gl.createBuffer(), col: gl.createBuffer() };
    this.buffers.aux = { pos: gl.createBuffer(), col: gl.createBuffer() };
    this.ok = true;
  };

  View.prototype.resize = function (w, h) {
    var dpr = this.dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.W = w; this.H = h;
    this.cv.width = Math.max(1, Math.round(w * dpr));
    this.cv.height = Math.max(1, Math.round(h * dpr));
    this.cv.style.width = w + 'px';
    this.cv.style.height = h + 'px';
  };

  /* ---------- Construcción de los búferes a partir del documento ---------- */
  View.prototype.build = function (app) {
    if (!this.ok) return;
    var doc = app.doc, gl = this.gl;
    var TP = [], TN = [], TC = [], LP = [], LC = [];
    var chunks = [], edgeChunks = [];
    var ents = doc.visible ? doc.visible() : doc.entities;
    var style = STYLES[this.style] || STYLES.ARISTASSOMBRA;
    var i, j, k;
    var self = this;

    function colOf(e) {
      var rgb = CAD.Render && CAD.Render.rgbOf ? CAD.Render.rgbOf(doc, e) : null;
      if (rgb) return rgb;
      var hex = app.r && app.r.colorOf ? app.r.colorOf(e, doc) : '#ffffff';
      return hex2rgb(hex);
    }

    var box = G3.box();

    for (i = 0; i < ents.length; i++) {
      var e = ents[i];
      if (e.hidden) continue;
      var c = colOf(e);
      if (e.type === 'SOLID3D' || e.type === 'MESH') {
        var mesh = CAD.Solid ? CAD.Solid.meshOf(e) : null;
        if (!mesh) continue;
        var sel = app.selSet && app.selSet.indexOf(e) >= 0;
        var cc = sel ? [0.20, 0.72, 1.0] : c;
        pushMesh(mesh, cc, style, e);
        var bb = mesh.bbox();
        box = G3.boxMerge(box, bb);
        continue;
      }
      /* entidades 2D: se dibujan como líneas a su elevación */
      var segs = CAD.E.segs ? CAD.E.segs(e, doc) : null;
      if (!segs) continue;
      var z = e.elev || 0;
      for (j = 0; j < segs.length; j++) {
        var pts = segs[j] && segs[j].pts ? segs[j].pts : segs[j];
        if (!pts || pts.length < 2) continue;
        if (segs[j] && segs[j].closed && pts.length > 2) pts = pts.concat([pts[0]]);
        for (k = 0; k + 1 < pts.length; k++) {
          var pa = pts[k], pb = pts[k + 1];
          LP.push(pa.x, pa.y, pa.z === undefined ? z : pa.z, pb.x, pb.y, pb.z === undefined ? z : pb.z);
          LC.push(c[0], c[1], c[2], c[0], c[1], c[2]);
          G3.boxAdd(box, { x: pa.x, y: pa.y, z: pa.z === undefined ? z : pa.z });
          G3.boxAdd(box, { x: pb.x, y: pb.y, z: pb.z === undefined ? z : pb.z });
        }
      }
    }

    /* La teselación y las normales de cada sólido se guardan en caché por
       entidad: sin ella, mover un objeto obliga a recalcular la malla de
       todos los demás y con cientos de sólidos eso se nota. */
    function pushMesh(mesh, c, st, ent) {
      var cache = ent ? GEO.get(ent) : null;
      if (!cache || cache.sig !== ent.sig) {
        var sh = mesh.shadingNormals(32);
        var tris = sh.tris, NR = sh.normals;
        var n = tris.length;
        var pos = new Float32Array(n * 9), nor = new Float32Array(n * 9);
        for (var t = 0; t < n; t++) {
          var A = mesh.verts[tris[t][0]], B = mesh.verts[tris[t][1]], C = mesh.verts[tris[t][2]];
          var na = NR[t * 3], nb = NR[t * 3 + 1], nc = NR[t * 3 + 2];
          var o = t * 9;
          pos[o] = A.x; pos[o + 1] = A.y; pos[o + 2] = A.z;
          pos[o + 3] = B.x; pos[o + 4] = B.y; pos[o + 5] = B.z;
          pos[o + 6] = C.x; pos[o + 7] = C.y; pos[o + 8] = C.z;
          nor[o] = na.x; nor[o + 1] = na.y; nor[o + 2] = na.z;
          nor[o + 3] = nb.x; nor[o + 4] = nb.y; nor[o + 5] = nb.z;
          nor[o + 6] = nc.x; nor[o + 7] = nc.y; nor[o + 8] = nc.z;
        }
        var ed = mesh.sharpEdges(18);
        var ep = new Float32Array(ed.length * 6);
        for (var q = 0; q < ed.length; q++) {
          var P = mesh.verts[ed[q][0]], Q = mesh.verts[ed[q][1]];
          var o2 = q * 6;
          ep[o2] = P.x; ep[o2 + 1] = P.y; ep[o2 + 2] = P.z;
          ep[o2 + 3] = Q.x; ep[o2 + 4] = Q.y; ep[o2 + 5] = Q.z;
        }
        cache = { sig: ent ? ent.sig : null, pos: pos, nor: nor, edge: ep };
        if (ent) GEO.set(ent, cache);
      }
      chunks.push({ pos: cache.pos, nor: cache.nor, col: c });
      if (st.edges && cache.edge.length) {
        var ec;
        if (st.id === 'hidden' || st.id === 'wire' || st.id === 'w2d') ec = c;
        else if (st.id === 'concept') ec = [0.05, 0.07, 0.11];
        else if (st.id === 'gray') ec = [0.10, 0.10, 0.10];
        else ec = [c[0] * 0.16, c[1] * 0.16, c[2] * 0.18];
        edgeChunks.push({ pos: cache.edge, col: ec });
      }
    }

    this.box = G3.boxValid(box) ? box : null;
    if (this.box) this.cam.radius = Math.max(G3.boxDiag(this.box) / 2, 1e-3);
    var F = Float32Array;

    /* un solo búfer con todos los trozos, sin volver a teselar nada */
    var nT = 0, ii;
    for (ii = 0; ii < chunks.length; ii++) nT += chunks[ii].pos.length;
    var aPos = new F(nT + TP.length), aNor = new F(nT + TN.length), aCol = new F(nT + TC.length);
    var off = 0;
    for (ii = 0; ii < chunks.length; ii++) {
      var ch = chunks[ii];
      aPos.set(ch.pos, off);
      aNor.set(ch.nor, off);
      for (var k2 = 0; k2 < ch.pos.length; k2 += 3) {
        aCol[off + k2] = ch.col[0]; aCol[off + k2 + 1] = ch.col[1]; aCol[off + k2 + 2] = ch.col[2];
      }
      off += ch.pos.length;
    }
    if (TP.length) { aPos.set(TP, off); aNor.set(TN, off); aCol.set(TC, off); }

    var nE = 0;
    for (ii = 0; ii < edgeChunks.length; ii++) nE += edgeChunks[ii].pos.length;
    var ePos = new F(nE + LP.length), eCol = new F(nE + LC.length);
    off = 0;
    for (ii = 0; ii < edgeChunks.length; ii++) {
      var eh = edgeChunks[ii];
      ePos.set(eh.pos, off);
      for (k2 = 0; k2 < eh.pos.length; k2 += 3) {
        eCol[off + k2] = eh.col[0]; eCol[off + k2 + 1] = eh.col[1]; eCol[off + k2 + 2] = eh.col[2];
      }
      off += eh.pos.length;
    }
    if (LP.length) { ePos.set(LP, off); eCol.set(LC, off); }

    up(gl, this.buffers.tri.pos, aPos);
    up(gl, this.buffers.tri.nrm, aNor);
    up(gl, this.buffers.tri.col, aCol);
    up(gl, this.buffers.line.pos, ePos);
    up(gl, this.buffers.line.col, eCol);
    this.counts.tri = aPos.length / 3;
    this.counts.line = ePos.length / 3;
    this.rev = doc.rev;
    this.builtStyle = this.style;
  };

  function up(gl, buf, arr) {
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, arr, gl.STATIC_DRAW);
  }

  function hex2rgb(h) {
    if (!h) return [1, 1, 1];
    if (h[0] === '#') h = h.slice(1);
    if (h.length === 3) h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2];
    var n = parseInt(h, 16);
    if (!isFinite(n)) return [1, 1, 1];
    return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
  }
  V3.hex2rgb = hex2rgb;

  /* ---------- Dibujo ---------- */
  View.prototype.render = function (app) {
    if (!this.ok) return;
    var gl = this.gl, w = this.cv.width, h = this.cv.height;
    var st = STYLES[this.style] || STYLES.ARISTASSOMBRA;
    if (this.rev !== app.doc.rev || this.builtStyle !== this.style || this.dirty) {
      this.dirty = false;
      this.build(app);
    }
    gl.viewport(0, 0, w, h);
    gl.clearColor(this.bg[0], this.bg[1], this.bg[2], 1);
    gl.clearDepth(1);
    gl.enable(gl.DEPTH_TEST);
    gl.depthFunc(gl.LEQUAL);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    gl.enable(gl.CULL_FACE); gl.cullFace(gl.BACK);
    if (st.alpha) { gl.disable(gl.CULL_FACE); gl.enable(gl.BLEND); gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA); gl.depthMask(false); }
    else { gl.disable(gl.BLEND); gl.depthMask(true); }

    var VP = this.cam.vp(this.W || w, this.H || h, this.cam.radius);
    var Mm = G3.ident();
    var eye = this.cam.eye();

    /* Rejilla de suelo: se pinta la primera sin prueba ni escritura de
       profundidad, así los sólidos la ocultan siempre en vez de verse a
       través de cajeras y taladros. */
    gl.disable(gl.DEPTH_TEST);
    gl.depthMask(false);
    this.drawGrid(VP);
    gl.enable(gl.DEPTH_TEST);
    gl.depthMask(!st.alpha);

    if (st.faces && this.counts.tri) {
      gl.useProgram(this.pTri);
      gl.uniformMatrix4fv(this.uTri.VP, false, new Float32Array(VP));
      gl.uniformMatrix4fv(this.uTri.M, false, new Float32Array(Mm));
      gl.uniformMatrix4fv(this.uTri.N, false, new Float32Array(G3.mNormal(Mm)));
      gl.uniform3f(this.uTri.eye, eye.x, eye.y, eye.z);
      gl.uniform1f(this.uTri.alpha, st.alpha || 1);
      gl.uniform3f(this.uTri.flat, this.bg[0], this.bg[1], this.bg[2]);
      var mode = 1;
      if (st.id === 'hidden') mode = 0;
      else if (st.id === 'concept') mode = 2;
      else if (st.id === 'real') mode = 3;
      else if (st.id === 'gray') mode = 4;
      else if (st.id === 'xray') mode = 5;
      gl.uniform1i(this.uTri.mode, mode);
      bindA(gl, this.buffers.tri.pos, this.aTri.pos, 3);
      bindA(gl, this.buffers.tri.nrm, this.aTri.nrm, 3);
      bindA(gl, this.buffers.tri.col, this.aTri.col, 3);
      gl.drawArrays(gl.TRIANGLES, 0, this.counts.tri);
    }

    if (st.edges && this.counts.line) {
      gl.useProgram(this.pLine);
      gl.uniformMatrix4fv(this.uLine.VP, false, new Float32Array(VP));
      gl.uniformMatrix4fv(this.uLine.M, false, new Float32Array(Mm));
      gl.uniform1f(this.uLine.off, st.faces ? 0.0016 : 0);
      gl.uniform1f(this.uLine.alpha, st.alpha ? 0.85 : 1);
      if (st.alpha) { gl.enable(gl.BLEND); gl.depthMask(false); }
      bindA(gl, this.buffers.line.pos, this.aLine.pos, 3);
      bindA(gl, this.buffers.line.col, this.aLine.col, 3);
      gl.drawArrays(gl.LINES, 0, this.counts.line);
    }
    gl.depthMask(true);
  };

  function bindA(gl, buf, loc, n) {
    if (loc < 0) return;
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.enableVertexAttribArray(loc);
    gl.vertexAttribPointer(loc, n, gl.FLOAT, false, 0, 0);
  }

  View.prototype.drawGrid = function (VP) {
    if (!this.showGrid) return;
    var gl = this.gl;
    var d = this.cam.dist;
    var step = Math.pow(10, Math.round(Math.log10(d / 12)));
    if (!isFinite(step) || step <= 0) step = 10;
    var n = 26;
    var ext = step * n;
    var c = G3.boxCenter(this.box || { x1: 0, y1: 0, z1: 0, x2: 0, y2: 0, z2: 0 });
    var ox = Math.round(this.cam.target.x / step) * step;
    var oy = Math.round(this.cam.target.y / step) * step;
    var P = [], C = [];
    for (var i = -n; i <= n; i++) {
      var maj = (i % 5 === 0);
      var g = maj ? 0.30 : 0.19;
      var x = ox + i * step, y = oy + i * step;
      P.push(x, oy - ext, 0, x, oy + ext, 0); C.push(g, g, g + 0.02, g, g, g + 0.02);
      P.push(ox - ext, y, 0, ox + ext, y, 0); C.push(g, g, g + 0.02, g, g, g + 0.02);
    }
    /* ejes X (rojo) e Y (verde) */
    P.push(ox - ext, 0, 0, ox + ext, 0, 0); C.push(0.62, 0.20, 0.20, 0.62, 0.20, 0.20);
    P.push(0, oy - ext, 0, 0, oy + ext, 0); C.push(0.20, 0.55, 0.22, 0.20, 0.55, 0.22);
    gl.useProgram(this.pLine);
    gl.uniformMatrix4fv(this.uLine.VP, false, new Float32Array(VP));
    gl.uniformMatrix4fv(this.uLine.M, false, new Float32Array(G3.ident()));
    gl.uniform1f(this.uLine.off, 0);
    gl.uniform1f(this.uLine.alpha, 1);
    up(gl, this.buffers.aux.pos, new Float32Array(P));
    up(gl, this.buffers.aux.col, new Float32Array(C));
    bindA(gl, this.buffers.aux.pos, this.aLine.pos, 3);
    bindA(gl, this.buffers.aux.col, this.aLine.col, 3);
    gl.drawArrays(gl.LINES, 0, P.length / 3);
  };

  /* ---------- Designación ---------- */
  View.prototype.pick = function (app, sx, sy) {
    var r = this.cam.ray(sx, sy, this.W, this.H);
    if (!r) return null;
    var ents = app.doc.visible ? app.doc.visible() : app.doc.entities;
    var best = null;
    for (var i = 0; i < ents.length; i++) {
      var e = ents[i];
      if (e.hidden) continue;
      if (e.type !== 'SOLID3D' && e.type !== 'MESH') continue;
      var mesh = CAD.Solid ? CAD.Solid.meshOf(e) : null;
      if (!mesh) continue;
      var h = mesh.rayHit(r.org, r.dir);
      if (h && (!best || h.t < best.t)) { best = h; best.ent = e; }
    }
    if (best) return best;
    /* entidades 2D: distancia en pantalla */
    var tol = 8, bestD = tol, found = null;
    var VP = this.cam.vp(this.W, this.H, this.cam.radius), self = this;
    function s2(p) {
      var q = G3.apply4(VP, p);
      if (q[3] <= 0) return null;
      return { x: (q[0] / q[3] * 0.5 + 0.5) * self.W, y: (0.5 - q[1] / q[3] * 0.5) * self.H };
    }
    for (i = 0; i < ents.length; i++) {
      e = ents[i];
      if (e.hidden || e.type === 'SOLID3D' || e.type === 'MESH') continue;
      var segs = CAD.E.segs ? CAD.E.segs(e, app.doc) : null;
      if (!segs) continue;
      var z = e.elev || 0;
      for (var j = 0; j < segs.length; j++) {
        var pts = segs[j] && segs[j].pts ? segs[j].pts : segs[j];
        if (!pts) continue;
        for (var k = 0; k + 1 < pts.length; k++) {
          var a = s2({ x: pts[k].x, y: pts[k].y, z: pts[k].z === undefined ? z : pts[k].z });
          var b = s2({ x: pts[k + 1].x, y: pts[k + 1].y, z: pts[k + 1].z === undefined ? z : pts[k + 1].z });
          if (!a || !b) continue;
          var d = segDist(sx, sy, a.x, a.y, b.x, b.y);
          if (d < bestD) { bestD = d; found = { ent: e, p: pts[k] }; }
        }
      }
    }
    return found;
  };
  function segDist(px, py, x1, y1, x2, y2) {
    var dx = x2 - x1, dy = y2 - y1, l2 = dx * dx + dy * dy;
    var t = l2 < 1e-9 ? 0 : ((px - x1) * dx + (py - y1) * dy) / l2;
    t = t < 0 ? 0 : (t > 1 ? 1 : t);
    var qx = x1 + dx * t, qy = y1 + dy * t;
    return Math.hypot(px - qx, py - qy);
  }

  /* ---------- Proyección al plano de trabajo (para introducir puntos) ---------- */
  View.prototype.groundPoint = function (sx, sy, z, doc) {
    var r = this.cam.ray(sx, sy, this.W, this.H);
    if (!r) return null;
    /* si hay plano de trabajo, el punto cae sobre él */
    if (doc && CAD.WPlane && CAD.WPlane.get(doc))
      return CAD.WPlane.rayPoint(doc, r.org, r.dir, z || 0);
    var hit = G3.rayPlane(r.org, r.dir, { n: v3(0, 0, 1), w: z || 0 });
    return hit ? hit.p : null;
  };

  /* ============================================================
     ViewCube (se pinta en 2D sobre el lienzo de superposición)
     ============================================================ */
  V3.drawCube = function (ctx, cam, x, y, size) {
    var hs = size / 2;
    var cx = x + hs, cy = y + hs;
    var R = G3.lookAt(G3.mul(cam.dir, 3), v3(0, 0, 0), cam.up);
    var s = hs * 0.52;
    function pr(p) {
      var q = G3.apply(R, p);
      return { x: cx + q.x * s, y: cy - q.y * s, z: q.z };
    }
    var V = [];
    for (var i = 0; i < 8; i++) V.push(v3(i & 1 ? 1 : -1, i & 2 ? 1 : -1, i & 4 ? 1 : -1));
    var faces = [
      { i: [1, 3, 7, 5], n: v3(1, 0, 0), t: 'DER', view: 'DERECHA' },
      { i: [0, 4, 6, 2], n: v3(-1, 0, 0), t: 'IZQ', view: 'IZQUIERDA' },
      { i: [2, 6, 7, 3], n: v3(0, 1, 0), t: 'POS', view: 'POSTERIOR' },
      { i: [0, 1, 5, 4], n: v3(0, -1, 0), t: 'FRE', view: 'FRONTAL' },
      { i: [4, 5, 7, 6], n: v3(0, 0, 1), t: 'SUP', view: 'SUPERIOR' },
      { i: [0, 2, 3, 1], n: v3(0, 0, -1), t: 'INF', view: 'INFERIOR' }
    ];
    var hits = [];
    faces.forEach(function (f) {
      var vis = G3.dot(G3.applyDir(R, f.n), v3(0, 0, 1)) > 0.02;
      if (!vis) return;
      /* Sólo las caras que miran al observador: antes se pintaban las
         seis y los rótulos de las de atrás se encabalgaban con los de
         delante ("SUP IZQ FRENTE" superpuestos). */
      var nv = G3.applyDir(R, f.n);
      if (nv.z <= 0.02) return;
      var pts = f.i.map(function (k) { return pr(V[k]); });
      ctx.beginPath();
      ctx.moveTo(pts[0].x, pts[0].y);
      for (var k = 1; k < pts.length; k++) ctx.lineTo(pts[k].x, pts[k].y);
      ctx.closePath();
      var sh = 0.55 + 0.45 * Math.max(0, G3.dot(G3.applyDir(R, f.n), G3.norm(v3(0.3, 0.4, 1))));
      ctx.fillStyle = 'rgba(' + Math.round(150 * sh) + ',' + Math.round(162 * sh) + ',' + Math.round(178 * sh) + ',0.93)';
      ctx.fill();
      ctx.strokeStyle = 'rgba(30,36,46,0.85)'; ctx.lineWidth = 1; ctx.stroke();
      var c = { x: 0, y: 0 };
      pts.forEach(function (p) { c.x += p.x / 4; c.y += p.y / 4; });
      ctx.fillStyle = '#10151d';
      ctx.font = '600 ' + Math.max(9, Math.round(size * 0.105)) + 'px system-ui,sans-serif';
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText(f.t, c.x, c.y);
      hits.push({ poly: pts, view: f.view });
    });
    /* flechas de giro 90° */
    ctx.strokeStyle = 'rgba(190,200,215,0.75)'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(cx, cy, hs * 0.92, Math.PI * 1.15, Math.PI * 1.45); ctx.stroke();
    ctx.beginPath(); ctx.arc(cx, cy, hs * 0.92, Math.PI * 1.55, Math.PI * 1.85); ctx.stroke();
    return hits;
  };

  V3.cubeHit = function (hits, mx, my) {
    for (var i = 0; i < hits.length; i++) {
      var p = hits[i].poly, inside = false;
      for (var j = 0, k = p.length - 1; j < p.length; k = j++) {
        if (((p[j].y > my) !== (p[k].y > my)) &&
            (mx < (p[k].x - p[j].x) * (my - p[j].y) / (p[k].y - p[j].y) + p[j].x)) inside = !inside;
      }
      if (inside) return hits[i].view;
    }
    return null;
  };

  /* ---------- Icono SCP 3D ---------- */
  V3.drawUcsIcon = function (ctx, cam, w, h) {
    var ox = 62, oy = h - 62, L = 40;
    var R = G3.lookAt(G3.mul(cam.dir, 3), v3(0, 0, 0), cam.up);
    function pr(p) { var q = G3.apply(R, p); return { x: ox + q.x * L, y: oy - q.y * L }; }
    var o = pr(v3(0, 0, 0));
    [['X', v3(1, 0, 0), '#e05a55'], ['Y', v3(0, 1, 0), '#7bc043'], ['Z', v3(0, 0, 1), '#4f9df7']].forEach(function (a) {
      var p = pr(a[1]);
      ctx.strokeStyle = a[2]; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(o.x, o.y); ctx.lineTo(p.x, p.y); ctx.stroke();
      var ang = Math.atan2(p.y - o.y, p.x - o.x);
      ctx.fillStyle = a[2];
      ctx.beginPath();
      ctx.moveTo(p.x, p.y);
      ctx.lineTo(p.x - 7 * Math.cos(ang - 0.35), p.y - 7 * Math.sin(ang - 0.35));
      ctx.lineTo(p.x - 7 * Math.cos(ang + 0.35), p.y - 7 * Math.sin(ang + 0.35));
      ctx.closePath(); ctx.fill();
      ctx.font = '600 11px system-ui,sans-serif';
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText(a[0], p.x + 10 * Math.cos(ang), p.y + 10 * Math.sin(ang));
    });
  };
})();
