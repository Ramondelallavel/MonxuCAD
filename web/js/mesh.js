/* ============================================================
   mesh.js — Núcleo de modelado de sólidos por malla
   Estructura de malla indexada, primitivas 3D, extrusión,
   revolución, barrido, solevado y utilidades (soldado,
   normales, volumen, sección, arista de silueta).
   ============================================================ */
(function () {
  'use strict';
  var CAD = (window.CAD = window.CAD || {});
  var G3 = CAD.G3;
  var M = (CAD.Mesh = {});
  var v3 = G3.v;
  var TAU = Math.PI * 2;

  /* ============================================================
     Estructura
       verts : [{x,y,z}, ...]
       faces : [[i0,i1,i2,...], ...]   índices, sentido antihorario visto
                                       desde fuera (normal saliente)
     ============================================================ */
  function Mesh(verts, faces) {
    this.verts = verts || [];
    this.faces = faces || [];
  }
  M.Mesh = Mesh;
  M.make = function (v, f) { return new Mesh(v, f); };

  Mesh.prototype.clone = function () {
    return new Mesh(this.verts.map(function (p) { return v3(p.x, p.y, p.z); }),
                    this.faces.map(function (f) { return f.slice(); }));
  };
  Mesh.prototype.transform = function (m) {
    for (var i = 0; i < this.verts.length; i++) this.verts[i] = G3.apply(m, this.verts[i]);
    if (G3.mDet(m) < 0) this.flip();
    return this;
  };
  Mesh.prototype.flip = function () {
    for (var i = 0; i < this.faces.length; i++) this.faces[i].reverse();
    return this;
  };
  Mesh.prototype.append = function (o) {
    var base = this.verts.length, i;
    for (i = 0; i < o.verts.length; i++) this.verts.push(v3(o.verts[i].x, o.verts[i].y, o.verts[i].z));
    for (i = 0; i < o.faces.length; i++)
      this.faces.push(o.faces[i].map(function (k) { return k + base; }));
    return this;
  };
  Mesh.prototype.bbox = function () {
    var b = G3.box();
    for (var i = 0; i < this.verts.length; i++) G3.boxAdd(b, this.verts[i]);
    return b;
  };
  Mesh.prototype.faceNormal = function (f) {
    var p = [];
    for (var i = 0; i < f.length; i++) p.push(this.verts[f[i]]);
    return G3.polyNormal(p);
  };
  Mesh.prototype.faceCenter = function (f) {
    var c = v3(0, 0, 0);
    for (var i = 0; i < f.length; i++) { var p = this.verts[f[i]]; c.x += p.x; c.y += p.y; c.z += p.z; }
    var k = f.length || 1;
    return v3(c.x / k, c.y / k, c.z / k);
  };

  /* Triángulos de toda la malla, con índices al array de vértices.
     La triangulación puede descartar vértices colineales (los que deja la
     reparación de uniones en T).  Si se quedan fuera, el triángulo vecino
     sí los usa y aparece una grieta: la malla deja de ser estanca al
     exportarla.  Por eso se vuelven a insertar partiendo el triángulo
     sobre cuya arista caen. */
  Mesh.prototype.triangles = function () {
    var out = [], i, j;
    for (i = 0; i < this.faces.length; i++) {
      var f = this.faces[i];
      if (f.length < 3) continue;
      if (f.length === 3) { out.push([f[0], f[1], f[2]]); continue; }
      var pts = [];
      for (j = 0; j < f.length; j++) pts.push(this.verts[f[j]]);
      var t = G3.triangulate(pts);
      var tri;
      if (!t.length) {
        tri = [];
        for (j = 1; j < f.length - 1; j++) tri.push([f[0], f[j], f[j + 1]]);
      } else {
        tri = [];
        for (j = 0; j < t.length; j++) tri.push([f[t[j][0]], f[t[j][1]], f[t[j][2]]]);
      }
      reinsertDropped(this, f, tri);
      for (j = 0; j < tri.length; j++) out.push(tri[j]);
    }
    return out;
  };

  /* ------------------------------------------------------------
     Cara señalada por un rayo.  rayHit devuelve el triángulo; para el
     modelado directo hace falta el polígono original, que es lo que el
     usuario percibe como "una cara".
     ------------------------------------------------------------ */
  Mesh.prototype.pickFace = function (org, dir) {
    if (!G3.boxHit(this.bbox(), org, dir)) return null;
    var best = null;
    for (var i = 0; i < this.faces.length; i++) {
      var f = this.faces[i];
      if (f.length < 3) continue;
      for (var j = 1; j + 1 < f.length; j++) {
        var h = G3.rayTri(org, dir, this.verts[f[0]], this.verts[f[j]], this.verts[f[j + 1]], true);
        if (h && (!best || h.t < best.t)) { best = { t: h.t, p: h.p, face: i }; }
      }
    }
    return best;
  };

  /* Región plana conexa a la que pertenece una cara: todas las caras
     vecinas que comparten su plano.  Es lo que empuja o tira el modelado
     directo, no un único triángulo. */
  Mesh.prototype.planarRegion = function (fi, tolDeg) {
    var lim = Math.cos((tolDeg === undefined ? 0.5 : tolDeg) * Math.PI / 180);
    var n0 = this.faceNormal(this.faces[fi]);
    var w0 = G3.dot(n0, this.verts[this.faces[fi][0]]);
    /* mapa de arista -> caras */
    var em = new Map();
    for (var i = 0; i < this.faces.length; i++) {
      var f = this.faces[i];
      for (var j = 0; j < f.length; j++) {
        var a = f[j], b = f[(j + 1) % f.length];
        var k = a < b ? a + ',' + b : b + ',' + a;
        var e = em.get(k); if (!e) { e = []; em.set(k, e); }
        e.push(i);
      }
    }
    var visto = {}, pila = [fi], out = [];
    visto[fi] = 1;
    while (pila.length) {
      var ci = pila.pop();
      out.push(ci);
      var cf = this.faces[ci];
      for (j = 0; j < cf.length; j++) {
        var aa = cf[j], bb = cf[(j + 1) % cf.length];
        var kk = aa < bb ? aa + ',' + bb : bb + ',' + aa;
        var vec = em.get(kk) || [];
        for (var q = 0; q < vec.length; q++) {
          var vi = vec[q];
          if (visto[vi]) continue;
          var nv = this.faceNormal(this.faces[vi]);
          if (G3.dot(nv, n0) < lim) continue;
          if (Math.abs(G3.dot(nv, this.verts[this.faces[vi][0]]) - w0) > 1e-6 * Math.max(1, Math.abs(w0))) continue;
          visto[vi] = 1; pila.push(vi);
        }
      }
    }
    return { faces: out, n: n0, w: w0 };
  };

  /* Contornos de una región plana: las aristas que sólo pertenecen a una
     cara de la región, encadenadas en bucles. */
  Mesh.prototype.regionLoops = function (faces) {
    var dentro = {}; faces.forEach(function (i) { dentro[i] = 1; });
    var cuenta = new Map();
    var self = this;
    faces.forEach(function (i) {
      var f = self.faces[i];
      for (var j = 0; j < f.length; j++) {
        var a = f[j], b = f[(j + 1) % f.length];
        var k = a < b ? a + ',' + b : b + ',' + a;
        var e = cuenta.get(k); if (!e) { e = { n: 0, a: a, b: b, dir: null }; cuenta.set(k, e); }
        e.n++;
        if (e.n === 1) e.dir = [a, b];
      }
    });
    var bordes = [];
    cuenta.forEach(function (e) { if (e.n === 1) bordes.push(e.dir); });
    if (!bordes.length) return [];
    /* encadena */
    var porIni = new Map();
    bordes.forEach(function (e) {
      var l = porIni.get(e[0]); if (!l) { l = []; porIni.set(e[0], l); }
      l.push(e);
    });
    var usados = new Set(), loops = [];
    for (var i = 0; i < bordes.length; i++) {
      if (usados.has(bordes[i])) continue;
      var loop = [bordes[i][0]], cur = bordes[i], guard = 0;
      usados.add(cur);
      while (guard++ < 100000) {
        loop.push(cur[1]);
        var sig = (porIni.get(cur[1]) || []).filter(function (x) { return !usados.has(x); })[0];
        if (!sig) break;
        usados.add(sig); cur = sig;
        if (cur[1] === loop[0]) { break; }
      }
      if (loop.length >= 3) loops.push(loop);
    }
    return loops;
  };

  /* Reinserta los vértices de la cara que la triangulación descartó.
     Sólo se parten aristas del CONTORNO del polígono, nunca diagonales
     interiores: el contorno lo comparte la cara vecina, que hace el mismo
     corte en el mismo punto, así que la superficie sigue cerrada.  Partir
     una diagonal interior, en cambio, dejaría un triángulo a un lado y
     dos medias aristas al otro. */
  function reinsertDropped(mesh, face, tri) {
    var n = face.length, i, j;
    var used = new Set();
    for (i = 0; i < tri.length; i++)
      for (j = 0; j < 3; j++) used.add(tri[i][j]);
    var missing = false;
    for (i = 0; i < n; i++) if (!used.has(face[i])) { missing = true; break; }
    if (!missing) return;

    /* se recorre el contorno en orden: cada vértice ausente se inserta
       en la arista que va del último presente al siguiente presente */
    for (var pass = 0; pass < n; pass++) {
      var idx = -1;
      for (i = 0; i < n; i++) if (!used.has(face[i])) { idx = i; break; }
      if (idx < 0) break;
      var vi = face[idx];
      /* vecinos presentes a un lado y otro del contorno */
      var a = -1, b = -1;
      for (i = 1; i < n; i++) {
        var k = face[(idx - i + n) % n];
        if (used.has(k)) { a = k; break; }
      }
      for (i = 1; i < n; i++) {
        var k2 = face[(idx + i) % n];
        if (used.has(k2)) { b = k2; break; }
      }
      used.add(vi);                       /* aunque falle, no se reintenta */
      if (a < 0 || b < 0 || a === b) continue;
      /* el vértice tiene que caer realmente sobre esa arista */
      var pa = mesh.verts[a], pb = mesh.verts[b], pv = mesh.verts[vi];
      var L2 = G3.dist2(pa, pb);
      if (L2 < 1e-18) continue;
      var t = G3.dot(G3.sub(pv, pa), G3.sub(pb, pa)) / L2;
      if (t <= 1e-9 || t >= 1 - 1e-9) continue;
      if (G3.distToSeg(pv, pa, pb) > Math.sqrt(L2) * 1e-4) continue;
      /* triángulos que usan esa arista (en el contorno hay exactamente uno) */
      var hits = [];
      for (i = 0; i < tri.length; i++) {
        var T = tri[i];
        for (j = 0; j < 3; j++) {
          var x = T[j], y = T[(j + 1) % 3];
          if ((x === a && y === b) || (x === b && y === a)) { hits.push({ t: i, e: j }); break; }
        }
      }
      if (hits.length !== 1) continue;    /* diagonal interior: no se toca */
      var h = hits[0], TT = tri[h.t];
      var i0 = TT[h.e], i1 = TT[(h.e + 1) % 3], i2 = TT[(h.e + 2) % 3];
      tri[h.t] = [i0, vi, i2];
      tri.push([vi, i1, i2]);
    }
  }

  /* Malla equivalente formada sólo por triángulos, con las uniones en T
     reparadas sobre los propios triángulos.  Triangular cada cara por
     separado puede dejar microgrietas entre caras vecinas cuando un
     vértice queda a una distancia de la arista mayor que la tolerancia;
     esta pasada las cierra.  Es la malla que se escribe a STL, DXF y
     demás formatos que exigen una superficie cerrada. */
  Mesh.prototype.triangulated = function (tol) {
    tol = tol || 1e-5;
    var tris = this.triangles();
    var m = new Mesh(this.verts.map(function (p) { return G3.copy(p); }),
                     tris.map(function (t) { return t.slice(); }));
    /* Se sueldan los vértices coincidentes, pero NO se descartan los
       triángulos muy finos: aunque no aporten área, forman parte de la
       superficie y quitarlos abre agujeros. */
    m.weld(tol * 0.1);
    dropDegenerate(m);
    if (M.check(m).abiertas) {
      m.fixTJunctions(tol);
      m = new Mesh(m.verts, m.triangles().map(function (t) { return t.slice(); }));
      m.weld(tol * 0.1);
      dropDegenerate(m);
    }
    return m;
  };

  /* Sólo caras con índices repetidos: esas sí son basura */
  function dropDegenerate(m) {
    var keep = [];
    for (var i = 0; i < m.faces.length; i++) {
      var f = m.faces[i];
      if (f.length < 3) continue;
      var bad = false;
      for (var j = 0; j < f.length && !bad; j++)
        for (var k = j + 1; k < f.length; k++) if (f[j] === f[k]) { bad = true; break; }
      if (!bad) keep.push(f);
    }
    m.faces = keep;
  }

  /* Aristas únicas -> [[i,j], ...] con las caras adyacentes */
  Mesh.prototype.edges = function () {
    var map = new Map(), i, j;
    for (i = 0; i < this.faces.length; i++) {
      var f = this.faces[i];
      for (j = 0; j < f.length; j++) {
        var a = f[j], b = f[(j + 1) % f.length];
        if (a === b) continue;
        var k = a < b ? a + ',' + b : b + ',' + a;
        var e = map.get(k);
        if (e) e.f.push(i); else map.set(k, { a: Math.min(a, b), b: Math.max(a, b), f: [i] });
      }
    }
    return Array.from(map.values());
  };

  /* Aristas «vivas»: borde abierto o ángulo diedro mayor que el umbral */
  Mesh.prototype.sharpEdges = function (angDeg) {
    var lim = Math.cos((angDeg === undefined ? 30 : angDeg) * Math.PI / 180);
    var ed = this.edges(), out = [], nr = [], i;
    for (i = 0; i < this.faces.length; i++) nr.push(this.faceNormal(this.faces[i]));
    for (i = 0; i < ed.length; i++) {
      var e = ed[i];
      if (e.f.length !== 2) { out.push([e.a, e.b]); continue; }
      if (G3.dot(nr[e.f[0]], nr[e.f[1]]) < lim) out.push([e.a, e.b]);
    }
    return out;
  };

  /* Volumen con signo (teorema de la divergencia) y área total */
  Mesh.prototype.volume = function () {
    var t = this.triangles(), v = 0;
    for (var i = 0; i < t.length; i++) {
      var a = this.verts[t[i][0]], b = this.verts[t[i][1]], c = this.verts[t[i][2]];
      v += G3.dot(a, G3.cross(b, c));
    }
    return v / 6;
  };
  Mesh.prototype.area = function () {
    var t = this.triangles(), s = 0;
    for (var i = 0; i < t.length; i++) {
      var a = this.verts[t[i][0]], b = this.verts[t[i][1]], c = this.verts[t[i][2]];
      s += G3.len(G3.cross(G3.sub(b, a), G3.sub(c, a))) / 2;
    }
    return s / 1;
  };
  /* Centro de masas del sólido */
  Mesh.prototype.centroid = function () {
    var t = this.triangles(), vol = 0, c = v3(0, 0, 0);
    for (var i = 0; i < t.length; i++) {
      var a = this.verts[t[i][0]], b = this.verts[t[i][1]], d = this.verts[t[i][2]];
      var vv = G3.dot(a, G3.cross(b, d)) / 6;
      vol += vv;
      c.x += (a.x + b.x + d.x) * vv / 4;
      c.y += (a.y + b.y + d.y) * vv / 4;
      c.z += (a.z + b.z + d.z) * vv / 4;
    }
    if (Math.abs(vol) < 1e-12) return G3.boxCenter(this.bbox());
    return v3(c.x / vol, c.y / vol, c.z / vol);
  };

  /* Soldado de vértices coincidentes */
  Mesh.prototype.weld = function (tol) {
    tol = tol || 1e-7;
    var inv = 1 / tol, map = new Map(), nv = [], remap = new Array(this.verts.length), i;
    for (i = 0; i < this.verts.length; i++) {
      var p = this.verts[i];
      var k = Math.round(p.x * inv) + '|' + Math.round(p.y * inv) + '|' + Math.round(p.z * inv);
      var e = map.get(k);
      if (e === undefined) { e = nv.length; map.set(k, e); nv.push(p); }
      remap[i] = e;
    }
    var nf = [];
    for (i = 0; i < this.faces.length; i++) {
      var f = this.faces[i], g = [];
      for (var j = 0; j < f.length; j++) {
        var x = remap[f[j]];
        if (!g.length || g[g.length - 1] !== x) g.push(x);
      }
      while (g.length > 1 && g[0] === g[g.length - 1]) g.pop();
      if (g.length >= 3) nf.push(g);
    }
    this.verts = nv; this.faces = nf;
    return this;
  };

  /* Elimina caras degeneradas y vértices huérfanos */
  /* Suelda vértices coincidentes, descarta las caras que ya no describen
     nada y renumera.

     `keepSlivers` decide qué hacer con las caras de área casi nula, que
     aparecen al triangular contornos con vértices colineales:
       - true  : se conservan.  Forman parte de la superficie y tirarlas
                 abriría un agujero.  Es lo que necesitan la extrusión, la
                 revolución, el barrido y el solevado para salir cerrados.
       - false : se tiran (valor por omisión).  Es lo que necesitan los
                 booleanos: una cara sin área no define plano y sólo
                 ensucia el árbol BSP. */
  Mesh.prototype.clean = function (keepSlivers) {
    this.weld(1e-7);
    var keep = [], i, j;
    for (i = 0; i < this.faces.length; i++) {
      var f = this.faces[i];
      if (f.length < 3) continue;
      /* al menos tres vértices distintos, si no la cara no existe */
      var mark = {}, uniq = 0;
      for (j = 0; j < f.length; j++) if (!mark[f[j]]) { mark[f[j]] = 1; uniq++; }
      if (uniq < 3) continue;
      if (!keepSlivers) {
        var pts = [];
        for (j = 0; j < f.length; j++) pts.push(this.verts[f[j]]);
        if (G3.polyArea(pts) < 1e-12) continue;
      }
      keep.push(f);
    }
    this.faces = keep;
    var used = new Int32Array(this.verts.length).fill(-1), nv = [];
    for (i = 0; i < this.faces.length; i++)
      for (var j = 0; j < this.faces[i].length; j++) {
        var k = this.faces[i][j];
        if (used[k] < 0) { used[k] = nv.length; nv.push(this.verts[k]); }
        this.faces[i][j] = used[k];
      }
    this.verts = nv;
    return this;
  };

  /* Reparación de uniones en T: inserta en cada arista los vértices que
     caen sobre ella.  El recorte BSP deja estas uniones y sin repararlas
     la malla no es estanca (STL y CAM lo exigen). */
  /* ------------------------------------------------------------
     Caras "pellizcadas": un polígono que recorre la misma arista dos
     veces (sale y vuelve por el mismo sitio).  Los booleanos y la
     fusión de caras coplanares los producen de vez en cuando, y dejan
     aristas con más de dos caras, lo que rompe la validez de un STL.
     Se parte el polígono en los dos bucles que realmente lo forman.
     ------------------------------------------------------------ */
  Mesh.prototype.unpinch = function () {
    var out = [], split = 0, i;
    for (i = 0; i < this.faces.length; i++) {
      var stack = [this.faces[i]], guard = 0;
      while (stack.length && guard++ < 200) {
        var f = stack.pop();
        if (!f || f.length < 3) continue;
        var seen = new Map(), cut = null, j;
        for (j = 0; j < f.length; j++) {
          var a = f[j], b = f[(j + 1) % f.length];
          if (a === b) continue;
          var k = a < b ? a + ',' + b : b + ',' + a;
          if (seen.has(k)) { cut = { i: seen.get(k), j: j }; break; }
          seen.set(k, j);
        }
        if (!cut) { out.push(f); continue; }
        /* arista repetida entre las posiciones cut.i y cut.j */
        var l1 = [], l2 = [], n = f.length;
        for (j = cut.i + 1; j <= cut.j; j++) l1.push(f[j % n]);
        for (j = cut.j + 1; j <= cut.i + n; j++) l2.push(f[j % n]);
        /* el primer y el último vértice de cada bucle coinciden */
        if (l1.length && l1[0] === l1[l1.length - 1]) l1.pop();
        if (l2.length && l2[0] === l2[l2.length - 1]) l2.pop();
        if (l1.length >= 3) stack.push(l1);
        if (l2.length >= 3) stack.push(l2);
        split++;
      }
    }
    this.faces = out;
    this.pinchFixes = split;
    return this;
  };

  /* Reparación de uniones en T.

     Un recorte BSP deja de vez en cuando un vértice justo en mitad de la
     arista de la cara vecina: la grieta no se ve, pero la malla deja de
     ser estanca y no se puede imprimir ni mecanizar.  Aquí se mete ese
     vértice también en la cara de al lado.

     Localizar las grietas es puro recuento: en una malla cerrada cada
     arista la comparten exactamente dos caras, y un vértice metido en
     medio deja SIEMPRE con un solo uso a las tres aristas implicadas.
     Así que basta contar usos para saber qué aristas hay que mirar y
     qué vértices pueden partirlas — y si no hay ninguna, se sale en el
     acto sin tocar geometría.

     Antes se rejillaba la malla entera y se recorría el tubo de cada
     arista de cada cara contra todos los vértices, con claves de celda
     construidas como cadenas de texto.  En un empalme de doscientos
     prismas eso era, él solo, más de la mitad del tiempo total. */
  Mesh.prototype.fixTJunctions = function (tol) {
    tol = tol || 1e-6;
    var V = this.verts, n = V.length, F = this.faces, i, j, fi, f, ia, ib, k, c;
    this.tFixes = 0;
    if (!n || !F.length) return this;
    /* la clave de arista empaqueta dos índices en un entero exacto */
    if (n > 4000000) return this;

    var uso = new Map();
    for (fi = 0; fi < F.length; fi++) {
      f = F[fi];
      for (j = 0; j < f.length; j++) {
        ia = f[j]; ib = f[(j + 1) % f.length];
        if (ia === ib) continue;
        k = ia < ib ? ia * n + ib : ib * n + ia;
        uso.set(k, (uso.get(k) || 0) + 1);
      }
    }
    var rotas = new Set(), sosp = new Uint8Array(n);
    uso.forEach(function (veces, kk) {
      if (veces === 2) return;
      rotas.add(kk);
      var a = Math.floor(kk / n);
      sosp[a] = 1; sosp[kk - a * n] = 1;
    });
    if (!rotas.size) return this;      /* cerrada y sin grietas */

    /* ---- rejilla uniforme, sólo con los vértices sospechosos ---- */
    var b = this.bbox();
    var diag = Math.max(1e-9, G3.boxDiag(b));
    var cell = Math.max(diag / 64, tol * 8);
    var inv = 1 / cell, x0 = b.x1, y0 = b.y1, z0 = b.z1;
    /* con cell >= diag/64 los índices caben de sobra en 0..64; el +2 deja
       sitio al vecindario de radio uno sin que se solapen las claves */
    var grid = new Map();
    for (i = 0; i < n; i++) {
      if (!sosp[i]) continue;
      var p = V[i];
      k = ((Math.floor((p.x - x0) * inv) + 2) * 1024 + Math.floor((p.y - y0) * inv) + 2) * 1024
        + Math.floor((p.z - z0) * inv) + 2;
      var a1 = grid.get(k); if (!a1) { a1 = []; grid.set(k, a1); }
      a1.push(i);
    }

    var vistas = new Set(), cand = [];
    function cerca(pa, pb) {
      cand.length = 0; vistas.clear();
      var pasos = Math.max(1, Math.ceil(G3.dist(pa, pb) * inv) + 1);
      for (var s = 0; s <= pasos; s++) {
        var t = s / pasos;
        var cx = Math.floor((pa.x + (pb.x - pa.x) * t - x0) * inv) + 2;
        var cy = Math.floor((pa.y + (pb.y - pa.y) * t - y0) * inv) + 2;
        var cz = Math.floor((pa.z + (pb.z - pa.z) * t - z0) * inv) + 2;
        for (var dx = -1; dx <= 1; dx++) for (var dy = -1; dy <= 1; dy++) for (var dz = -1; dz <= 1; dz++) {
          var kk = ((cx + dx) * 1024 + cy + dy) * 1024 + cz + dz;
          if (vistas.has(kk)) continue;
          vistas.add(kk);
          var lst = grid.get(kk);
          if (lst) for (var q = 0; q < lst.length; q++) cand.push(lst[q]);
        }
      }
    }

    var VACIO = [], cache = new Map(), tol2 = tol * tol;
    function listaPara(men, may) {          /* vértices a meter, de men a may */
      var pa = V[men], pb = V[may];
      var ex = pb.x - pa.x, ey = pb.y - pa.y, ez = pb.z - pa.z;
      var L2 = ex * ex + ey * ey + ez * ez;
      if (L2 < tol2) return VACIO;
      cerca(pa, pb);
      var res = [], q;
      for (q = 0; q < cand.length; q++) {
        var iv = cand[q];
        if (iv === men || iv === may) continue;
        var pv = V[iv];
        var vx = pv.x - pa.x, vy = pv.y - pa.y, vz = pv.z - pa.z;
        var t = (vx * ex + vy * ey + vz * ez) / L2;
        if (t <= 1e-9 || t >= 1 - 1e-9) continue;
        var rx = vx - ex * t, ry = vy - ey * t, rz = vz - ez * t;
        if (rx * rx + ry * ry + rz * rz > tol2) continue;
        res.push({ t: t, i: iv });
      }
      if (!res.length) return VACIO;
      res.sort(function (u, w) { return u.t - w.t; });
      var out = [], last = -1;
      for (q = 0; q < res.length; q++) {
        if (res[q].i === last) continue;
        out.push(res[q].i); last = res[q].i;
      }
      return out;
    }

    var changed = 0;
    for (fi = 0; fi < F.length; fi++) {
      f = F[fi];
      var nf = null;
      for (j = 0; j < f.length; j++) {
        ia = f[j]; ib = f[(j + 1) % f.length];
        var ins = VACIO;
        if (ia !== ib) {
          var men = ia < ib ? ia : ib, may = ia < ib ? ib : ia;
          k = men * n + may;
          if (rotas.has(k)) {
            ins = cache.get(k);
            if (ins === undefined) { ins = listaPara(men, may); cache.set(k, ins); }
          }
        }
        if (!ins.length) { if (nf) nf.push(ia); continue; }
        if (!nf) nf = f.slice(0, j);
        nf.push(ia);
        if (ia < ib) for (c = 0; c < ins.length; c++) { nf.push(ins[c]); changed++; }
        else for (c = ins.length - 1; c >= 0; c--) { nf.push(ins[c]); changed++; }
      }
      if (nf) F[fi] = nf;
    }
    this.tFixes = changed;
    return this;
  };

  /* Normales suavizadas por vértice (para el sombreado) */
  Mesh.prototype.vertexNormals = function (angDeg) {
    var lim = Math.cos((angDeg === undefined ? 35 : angDeg) * Math.PI / 180);
    var tris = this.triangles(), i;
    var acc = new Array(this.verts.length);
    for (i = 0; i < acc.length; i++) acc[i] = v3(0, 0, 0);
    var tn = [];
    for (i = 0; i < tris.length; i++) {
      var a = this.verts[tris[i][0]], b = this.verts[tris[i][1]], c = this.verts[tris[i][2]];
      var n = G3.cross(G3.sub(b, a), G3.sub(c, a));
      tn.push(n);
    }
    /* primera pasada: promedio bruto para conocer la dirección dominante */
    for (i = 0; i < tris.length; i++)
      for (var j = 0; j < 3; j++) {
        var k = tris[i][j];
        acc[k].x += tn[i].x; acc[k].y += tn[i].y; acc[k].z += tn[i].z;
      }
    for (i = 0; i < acc.length; i++) acc[i] = G3.norm(acc[i]);
    /* segunda pasada: solo contribuyen las caras dentro del ángulo límite */
    var acc2 = new Array(this.verts.length);
    for (i = 0; i < acc2.length; i++) acc2[i] = v3(0, 0, 0);
    for (i = 0; i < tris.length; i++) {
      var u = G3.norm(tn[i]);
      for (j = 0; j < 3; j++) {
        k = tris[i][j];
        if (G3.dot(u, acc[k]) < lim) { acc2[k].x += u.x * 0.001; acc2[k].y += u.y * 0.001; acc2[k].z += u.z * 0.001; }
        else { acc2[k].x += tn[i].x; acc2[k].y += tn[i].y; acc2[k].z += tn[i].z; }
      }
    }
    for (i = 0; i < acc2.length; i++) {
      var q = G3.norm(acc2[i]);
      acc2[i] = G3.len2(q) < 0.5 ? acc[i] : q;
    }
    return acc2;
  };

  /* Normales de sombreado por ESQUINA de triángulo.
     Devuelve {tris, normals} con una normal por vértice de cada triángulo.
     En cada esquina sólo promedian las caras vecinas cuya normal está
     dentro del ángulo de arista viva respecto de la cara actual, que es
     como funcionan los grupos de suavizado: las aristas de 90° quedan
     marcadas y las superficies curvas, suaves. */
  Mesh.prototype.shadingNormals = function (angDeg) {
    var lim = Math.cos((angDeg === undefined ? 32 : angDeg) * Math.PI / 180);
    var tris = this.triangles();
    var nt = tris.length, i, j;
    var fn = new Array(nt);
    for (i = 0; i < nt; i++) {
      var a = this.verts[tris[i][0]], b = this.verts[tris[i][1]], c = this.verts[tris[i][2]];
      fn[i] = G3.norm(G3.cross(G3.sub(b, a), G3.sub(c, a)));
    }
    /* Triángulos que tocan cada vértice, agrupados POR POSICIÓN y no por
       índice: después de un booleano dos vértices que ocupan el mismo
       sitio pueden tener índices distintos, y agrupando por índice el
       suavizado no los unía, de modo que las superficies curvas salían
       facetadas en cuanto se les hacía un taladro. */
    var bb = this.bbox();
    var esc = Math.max(1e-9, G3.boxDiag(bb));
    var tol = esc * 1e-6;
    var mapa = new Map();
    var claveDe = new Array(this.verts.length);
    for (i = 0; i < this.verts.length; i++) {
      var v = this.verts[i];
      var k2 = Math.round(v.x / tol) + '|' + Math.round(v.y / tol) + '|' + Math.round(v.z / tol);
      claveDe[i] = k2;
    }
    for (i = 0; i < nt; i++)
      for (j = 0; j < 3; j++) {
        var k = claveDe[tris[i][j]];
        var l2 = mapa.get(k);
        if (!l2) { l2 = []; mapa.set(k, l2); }
        l2.push(i);
      }
    var out = new Array(nt * 3);
    for (i = 0; i < nt; i++) {
      for (j = 0; j < 3; j++) {
        var list = mapa.get(claveDe[tris[i][j]]) || [i];
        var acc = G3.v(0, 0, 0), used = 0;
        for (var q = 0; q < list.length; q++) {
          var t = list[q];
          if (t !== i && G3.dot(fn[t], fn[i]) < lim) continue;   /* arista viva */
          acc.x += fn[t].x; acc.y += fn[t].y; acc.z += fn[t].z;
          used++;
        }
        var n = used ? G3.norm(acc) : fn[i];
        out[i * 3 + j] = G3.len2(n) < 0.25 ? fn[i] : n;
      }
    }
    return { tris: tris, normals: out, faceNormals: fn };
  };

  /* Punto más cercano del rayo a la malla (para designar en 3D) */
  Mesh.prototype.rayHit = function (org, dir) {
    if (!G3.boxHit(this.bbox(), org, dir)) return null;
    var tris = this.triangles(), best = null;
    for (var i = 0; i < tris.length; i++) {
      var h = G3.rayTri(org, dir, this.verts[tris[i][0]], this.verts[tris[i][1]], this.verts[tris[i][2]], true);
      if (h && (!best || h.t < best.t)) { best = h; best.face = i; }
    }
    return best;
  };

  /* ============================================================
     Primitivas
     ============================================================ */
  /* Una medida nula, negativa o no finita no da sólido: se devuelve null
     y quien llama avisa, en lugar de fabricar una malla degenerada. */
  function dim(v) { return typeof v === 'number' && isFinite(v) && Math.abs(v) > 1e-12; }
  function rad(v) { return typeof v === 'number' && isFinite(v) && v > 1e-12; }

  /* Una primitiva con medida negativa (una altura hacia abajo, por
     ejemplo) salía con las caras del revés: las normales apuntaban hacia
     dentro y el programa la tomaba por un sólido vuelto, de modo que sus
     facetas se dibujaban como aristas vivas.  Se comprueba el signo del
     volumen y se voltea si hace falta. */
  function haciaFuera(m) {
    if (m && m.faces.length && m.volume() < 0) m.flip();
    return m;
  }

  M.box = function (l, w, h, centered) {
    if (!dim(l) || !dim(w) || !dim(h)) return null;
    var x0 = centered ? -l / 2 : 0, y0 = centered ? -w / 2 : 0, z0 = centered ? -h / 2 : 0;
    var x1 = x0 + l, y1 = y0 + w, z1 = z0 + h;
    var v = [v3(x0, y0, z0), v3(x1, y0, z0), v3(x1, y1, z0), v3(x0, y1, z0),
             v3(x0, y0, z1), v3(x1, y0, z1), v3(x1, y1, z1), v3(x0, y1, z1)];
    var f = [[3, 2, 1, 0], [4, 5, 6, 7], [0, 1, 5, 4], [1, 2, 6, 5], [2, 3, 7, 6], [3, 0, 4, 7]];
    return haciaFuera(new Mesh(v, f));
  };

  M.cylinder = function (r, h, seg, r2) {
    if (r2 === undefined) r2 = r;
    /* un cono admite radio superior 0, pero no los dos a la vez */
    if (!dim(h) || !isFinite(r) || !isFinite(r2) || r < 0 || r2 < 0) return null;
    if (!rad(r) && !rad(r2)) return null;
    seg = Math.max(3, seg || M.segFor(Math.max(r, r2)));
    var v = [], bot = [], top = [], i;
    for (i = 0; i < seg; i++) {
      var a = TAU * i / seg;
      v.push(v3(r * Math.cos(a), r * Math.sin(a), 0)); bot.push(i);
    }
    var apex = (Math.abs(r2) < 1e-12);
    if (apex) { v.push(v3(0, 0, h)); }
    else for (i = 0; i < seg; i++) {
      a = TAU * i / seg;
      v.push(v3(r2 * Math.cos(a), r2 * Math.sin(a), h)); top.push(seg + i);
    }
    var f = [bot.slice().reverse()];
    if (apex) {
      for (i = 0; i < seg; i++) f.push([i, (i + 1) % seg, seg]);
    } else {
      f.push(top.slice());
      for (i = 0; i < seg; i++) f.push([i, (i + 1) % seg, seg + (i + 1) % seg, seg + i]);
    }
    return haciaFuera(new Mesh(v, f));
  };

  M.cone = function (r, h, seg, rTop) { return M.cylinder(r, h, seg, rTop || 0); };

  M.sphere = function (r, seg, ring) {
    if (!rad(r)) return null;
    seg = Math.max(4, seg || M.segFor(r));
    ring = Math.max(2, ring || Math.ceil(seg / 2));
    var v = [v3(0, 0, -r)], f = [], i, j;
    for (j = 1; j < ring; j++) {
      var ph = Math.PI * j / ring - Math.PI / 2;
      var cz = r * Math.sin(ph), cr = r * Math.cos(ph);
      for (i = 0; i < seg; i++) {
        var a = TAU * i / seg;
        v.push(v3(cr * Math.cos(a), cr * Math.sin(a), cz));
      }
    }
    v.push(v3(0, 0, r));
    var top = v.length - 1;
    function idx(j, i) { return 1 + (j - 1) * seg + (i % seg); }
    for (i = 0; i < seg; i++) f.push([0, idx(1, i + 1), idx(1, i)]);
    for (j = 1; j < ring - 1; j++)
      for (i = 0; i < seg; i++)
        f.push([idx(j, i), idx(j, i + 1), idx(j + 1, i + 1), idx(j + 1, i)]);
    for (i = 0; i < seg; i++) f.push([idx(ring - 1, i), idx(ring - 1, i + 1), top]);
    return haciaFuera(new Mesh(v, f));
  };

  M.torus = function (R, r, seg, segT) {
    if (!rad(R) || !rad(r)) return null;
    seg = Math.max(4, seg || M.segFor(R));
    segT = Math.max(4, segT || M.segFor(r));
    var v = [], f = [], i, j;
    for (i = 0; i < seg; i++) {
      var a = TAU * i / seg, ca = Math.cos(a), sa = Math.sin(a);
      for (j = 0; j < segT; j++) {
        var b = TAU * j / segT;
        var rr = R + r * Math.cos(b);
        v.push(v3(rr * ca, rr * sa, r * Math.sin(b)));
      }
    }
    function id(i, j) { return (i % seg) * segT + (j % segT); }
    for (i = 0; i < seg; i++)
      for (j = 0; j < segT; j++)
        f.push([id(i, j), id(i + 1, j), id(i + 1, j + 1), id(i, j + 1)]);
    return haciaFuera(new Mesh(v, f));
  };

  M.wedge = function (l, w, h, centered) {
    if (!dim(l) || !dim(w) || !dim(h)) return null;
    var x0 = centered ? -l / 2 : 0, y0 = centered ? -w / 2 : 0, z0 = centered ? -h / 2 : 0;
    var x1 = x0 + l, y1 = y0 + w, z1 = z0 + h;
    var v = [v3(x0, y0, z0), v3(x1, y0, z0), v3(x1, y1, z0), v3(x0, y1, z0),
             v3(x0, y0, z1), v3(x0, y1, z1)];
    var f = [[3, 2, 1, 0], [0, 1, 4], [2, 3, 5], [1, 2, 5, 4], [0, 4, 5, 3]];
    return haciaFuera(new Mesh(v, f));
  };

  M.pyramid = function (r, h, sides, rTop) {
    if (!rad(r) || !dim(h)) return null;
    if (!(sides >= 3)) sides = 4;
    sides = Math.max(3, sides || 4);
    var v = [], i, a;
    for (i = 0; i < sides; i++) {
      a = TAU * i / sides + Math.PI / 2;
      v.push(v3(r * Math.cos(a), r * Math.sin(a), 0));
    }
    var f = [], bot = [];
    for (i = 0; i < sides; i++) bot.push(i);
    f.push(bot.slice().reverse());
    if (rTop && rTop > 1e-12) {
      for (i = 0; i < sides; i++) {
        a = TAU * i / sides + Math.PI / 2;
        v.push(v3(rTop * Math.cos(a), rTop * Math.sin(a), h));
      }
      var top = [];
      for (i = 0; i < sides; i++) top.push(sides + i);
      f.push(top.slice());
      for (i = 0; i < sides; i++) f.push([i, (i + 1) % sides, sides + (i + 1) % sides, sides + i]);
    } else {
      v.push(v3(0, 0, h));
      for (i = 0; i < sides; i++) f.push([i, (i + 1) % sides, sides]);
    }
    return haciaFuera(new Mesh(v, f));
  };

  /* Toroide/cilindro elíptico para EXTRUSIONES de elipse: se resuelve con
     el perfil muestreado, así que no hace falta primitiva propia. */

  M.segFor = function (r) {
    r = Math.abs(r) || 1;
    var n = Math.round(Math.max(12, Math.min(96, 8 * Math.pow(r, 0.35) + 12)));
    return n;
  };

  /* ============================================================
     Operaciones de barrido
     ============================================================ */

  /* ------------------------------------------------------------
     ¿El contorno se cruza a sí mismo?
     Un perfil en ocho no define un sólido: extruirlo daba una malla
     abierta, de volumen cero y sin avisar de nada.  Más vale decir que el
     croquis está mal, como hace cualquier programa de modelado.
     Se comprueba sobre el plano del propio contorno; los extremos
     compartidos de segmentos contiguos no cuentan como cruce.
     ------------------------------------------------------------ */
  function seCruza(prof) {
    var n = prof.length;
    if (n < 4 || n > 3000) return false;        /* muy corto o muy fino: no compensa */
    /* Se proyecta tirando el eje de menor recorrido.  No vale apoyarse en
       la normal del contorno: la de un perfil en ocho es justo cero, que
       es precisamente el caso que hay que cazar. */
    var mn = { x: Infinity, y: Infinity, z: Infinity }, mx = { x: -Infinity, y: -Infinity, z: -Infinity };
    for (var i0 = 0; i0 < n; i0++) {
      var pt0 = prof[i0];
      var z0 = pt0.z || 0;
      if (pt0.x < mn.x) mn.x = pt0.x; if (pt0.x > mx.x) mx.x = pt0.x;
      if (pt0.y < mn.y) mn.y = pt0.y; if (pt0.y > mx.y) mx.y = pt0.y;
      if (z0 < mn.z) mn.z = z0; if (z0 > mx.z) mx.z = z0;
    }
    var ex = mx.x - mn.x, ey = mx.y - mn.y, ez = mx.z - mn.z;
    var fuera = (ez <= ex && ez <= ey) ? 'z' : ((ey <= ex) ? 'y' : 'x');
    var q = [];
    for (var i = 0; i < n; i++) {
      var pp = prof[i], pz = pp.z || 0;
      if (fuera === 'z') q.push({ x: pp.x, y: pp.y });
      else if (fuera === 'y') q.push({ x: pp.x, y: pz });
      else q.push({ x: pp.y, y: pz });
    }
    function lado(a, b, c) { return (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x); }
    function cruzan(a, b, c, d) {
      var d1 = lado(c, d, a), d2 = lado(c, d, b), d3 = lado(a, b, c), d4 = lado(a, b, d);
      /* sólo cruce propio: si alguno es cero es que se tocan, y tocarse vale */
      return ((d1 > 0) !== (d2 > 0)) && ((d3 > 0) !== (d4 > 0)) &&
             Math.abs(d1) > 1e-12 && Math.abs(d2) > 1e-12 &&
             Math.abs(d3) > 1e-12 && Math.abs(d4) > 1e-12;
    }
    for (var i2 = 0; i2 < n; i2++) {
      var a1 = q[i2], b1 = q[(i2 + 1) % n];
      for (var j = i2 + 2; j < n; j++) {
        if (i2 === 0 && j === n - 1) continue;   /* contiguos por el cierre */
        if (cruzan(a1, b1, q[j], q[(j + 1) % n])) return true;
      }
    }
    return false;
  }
  M.seCruza = seCruza;

  /* Extrusión recta de un perfil cerrado.
     prof  : [{x,y,z}] cerrado (sin repetir el primero)
     dir   : vector de extrusión
     taper : ángulo de inclinación en radianes (positivo = se cierra)
     holes : [[pts], ...] contornos interiores (mismo plano) */
  M.extrude = function (prof, dir, taper, holes) {
    if (!prof || prof.length < 3) return null;
    if (G3.len2(dir) < 1e-18) return null;      /* altura nula: no hay sólido */
    if (seCruza(prof)) return null;             /* el croquis se cruza a sí mismo */
    for (var ih = 0; holes && ih < holes.length; ih++) if (seCruza(holes[ih])) return null;
    var n = G3.polyNormal(prof);
    if (G3.dot(n, dir) < 0) { prof = prof.slice().reverse(); n = G3.neg(n); }
    var H = G3.len(dir);
    var cen = G3.polyCentroid(prof);
    var loops = [prof].concat((holes || []).map(function (h) {
      var hn = G3.polyNormal(h);
      return G3.dot(hn, n) > 0 ? h.slice().reverse() : h.slice();   /* agujeros al revés */
    }));
    var mesh = new Mesh([], []);
    var base = [], topIdx = [];
    var i, j, k;
    for (k = 0; k < loops.length; k++) {
      var lp = loops[k], bi = [], ti = [];
      var lcen = k === 0 ? cen : G3.polyCentroid(lp);
      for (i = 0; i < lp.length; i++) {
        bi.push(mesh.verts.length); mesh.verts.push(G3.copy(lp[i]));
      }
      for (i = 0; i < lp.length; i++) {
        var p = lp[i], q = G3.add(p, dir);
        if (taper) {
          var rad = G3.sub(p, k === 0 ? cen : lcen);
          var f = Math.tan(taper) * H;
          var rl = G3.len(rad);
          if (rl > 1e-9) q = G3.add(q, G3.mul(G3.norm(rad), -f));
        }
        ti.push(mesh.verts.length); mesh.verts.push(q);
      }
      base.push(bi); topIdx.push(ti);
      /* pared lateral */
      for (i = 0; i < lp.length; i++) {
        j = (i + 1) % lp.length;
        mesh.faces.push([bi[i], bi[j], ti[j], ti[i]]);
      }
    }
    /* tapas: con agujeros se triangula el polígono con puentes */
    var capB = M.capFaces(mesh.verts, base, true);
    var capT = M.capFaces(mesh.verts, topIdx, false);
    mesh.faces = mesh.faces.concat(capB, capT);
    return mesh.clean(true);
  };

  /* Tapas con agujeros: une los contornos interiores al exterior por el
     par de vértices más cercano (técnica del puente) y luego triangula. */
  M.capFaces = function (verts, loops, reverse) {
    if (!loops.length) return [];
    if (loops.length === 1) {
      var pts = loops[0].map(function (k) { return verts[k]; });
      var tri = G3.triangulate(pts);
      return tri.map(function (t) {
        var f = [loops[0][t[0]], loops[0][t[1]], loops[0][t[2]]];
        return reverse ? f.reverse() : f;
      });
    }
    var outer = loops[0].slice();
    for (var h = 1; h < loops.length; h++) {
      var hole = loops[h];
      var bi = 0, bj = 0, bd = Infinity;
      for (var i = 0; i < outer.length; i++)
        for (var j = 0; j < hole.length; j++) {
          var d = G3.dist2(verts[outer[i]], verts[hole[j]]);
          if (d < bd) { bd = d; bi = i; bj = j; }
        }
      var bridged = outer.slice(0, bi + 1);
      for (var k = 0; k <= hole.length; k++) bridged.push(hole[(bj + k) % hole.length]);
      bridged.push(outer[bi]);
      outer = bridged.concat(outer.slice(bi + 1));
    }
    var P = outer.map(function (k) { return verts[k]; });
    var T = G3.triangulate(P);
    return T.map(function (t) {
      var f = [outer[t[0]], outer[t[1]], outer[t[2]]];
      return reverse ? f.reverse() : f;
    });
  };

  /* Revolución de un perfil (abierto o cerrado) alrededor de un eje */
  M.revolve = function (prof, axisPt, axisDir, angle, seg, closedProfile, noCaps) {
    if (!prof || prof.length < 2) return null;
    /* Un eje nulo o un ángulo nulo no generan sólido: antes salía una
       malla degenerada de volumen cero en lugar de un aviso. */
    if (!axisDir || G3.len2(axisDir) < 1e-18) return null;
    if (!isFinite(angle) || Math.abs(angle) < 1e-9) return null;
    var full = Math.abs(Math.abs(angle) - TAU) < 1e-9;
    seg = Math.max(3, seg || Math.ceil(Math.abs(angle) / (Math.PI / 18)));
    var steps = full ? seg : seg;
    var ad = G3.norm(axisDir);
    var rings = [], i, j;
    var nRing = full ? steps : steps + 1;
    for (i = 0; i < nRing; i++) {
      var a = angle * (i / steps);
      var m = G3.mRotAxis(axisPt, ad, a);
      rings.push(prof.map(function (p) { return G3.apply(m, p); }));
    }
    var mesh = new Mesh([], []);
    var np = prof.length;
    for (i = 0; i < rings.length; i++)
      for (j = 0; j < np; j++) mesh.verts.push(rings[i][j]);
    function id(r, p) { return (r % rings.length) * np + p; }
    var lim = full ? rings.length : rings.length - 1;
    var pl = closedProfile ? np : np - 1;
    for (i = 0; i < lim; i++)
      for (j = 0; j < pl; j++) {
        var j2 = (j + 1) % np;
        mesh.faces.push([id(i, j), id(i, j2), id(i + 1, j2), id(i + 1, j)]);
      }
    if (!full && !noCaps) {
      /* tapas planas en los extremos */
      var f0 = [], f1 = [];
      for (j = 0; j < np; j++) { f0.push(id(0, j)); f1.push(id(rings.length - 1, j)); }
      if (closedProfile) { mesh.faces.push(f0.slice().reverse()); mesh.faces.push(f1); }
      else {
        /* perfil abierto: se cierra contra el eje */
        var pr0 = f0.map(function (k) { return mesh.verts[k]; });
        var onAxis = pr0.every(function (p) { return G3.distToSeg(p, axisPt, G3.add(axisPt, ad)) < 1e-7; });
        if (!onAxis) {
          var a0 = mesh.verts.length;
          mesh.verts.push(projAxis(mesh.verts[f0[0]], axisPt, ad));
          var a1 = mesh.verts.length;
          mesh.verts.push(projAxis(mesh.verts[f0[np - 1]], axisPt, ad));
          var cap0 = f0.concat([a1, a0]);
          mesh.faces.push(cap0.slice().reverse());
          var b0 = mesh.verts.length; mesh.verts.push(projAxis(mesh.verts[f1[0]], axisPt, ad));
          var b1 = mesh.verts.length; mesh.verts.push(projAxis(mesh.verts[f1[np - 1]], axisPt, ad));
          mesh.faces.push(f1.concat([b1, b0]));
        }
      }
    }
    /* si el perfil es abierto y la revolución es completa, se cierra la
       superficie contra el eje para obtener un sólido */
    if (full && !closedProfile && !noCaps) {
      var p0 = prof[0], pN = prof[np - 1];
      var d0 = G3.distToSeg(p0, axisPt, G3.add(axisPt, ad));
      var dN = G3.distToSeg(pN, axisPt, G3.add(axisPt, ad));
      if (d0 > 1e-7) {
        var c0 = mesh.verts.length; mesh.verts.push(projAxis(p0, axisPt, ad));
        for (i = 0; i < rings.length; i++) mesh.faces.push([id(i, 0), c0, id(i + 1, 0)]);
      }
      if (dN > 1e-7) {
        var cN = mesh.verts.length; mesh.verts.push(projAxis(pN, axisPt, ad));
        for (i = 0; i < rings.length; i++) mesh.faces.push([id(i, np - 1), id(i + 1, np - 1), cN]);
      }
    }
    mesh.clean(true);
    if (mesh.volume() < 0) mesh.flip();
    return mesh;
  };
  function projAxis(p, o, d) {
    var t = G3.dot(G3.sub(p, o), d);
    return G3.add(o, G3.mul(d, t));
  }

  /* Barrido de un perfil a lo largo de una trayectoria, con marcos
     paralelos mínimos (evita el retorcimiento). */
  M.sweep = function (prof, path, opts) {
    opts = opts || {};
    if (!prof || prof.length < 3 || !path || path.length < 2) return null;
    var closedPath = !!opts.closedPath;
    var twist = opts.twist || 0;
    var scaleEnd = opts.scale === undefined ? 1 : opts.scale;
    var bank = opts.bank !== false;

    /* longitud acumulada para repartir giro y escala */
    var acc = [0], i, j;
    for (i = 1; i < path.length; i++) acc.push(acc[i - 1] + G3.dist(path[i - 1], path[i]));
    var total = acc[acc.length - 1] || 1;

    /* tangentes */
    var tan = [];
    for (i = 0; i < path.length; i++) {
      var a = path[Math.max(0, i - 1)], b = path[Math.min(path.length - 1, i + 1)];
      if (closedPath) { a = path[(i - 1 + path.length) % path.length]; b = path[(i + 1) % path.length]; }
      var t = G3.sub(b, a);
      if (G3.len2(t) < 1e-18) t = G3.sub(path[Math.min(path.length - 1, i + 1)], path[i]);
      tan.push(G3.norm(t));
    }

    /* marco inicial: el perfil está en su propio plano */
    var pn = G3.polyNormal(prof);
    var cen = G3.polyCentroid(prof);
    var base = G3.arbitraryAxis(pn);
    /* lleva el perfil a coordenadas locales 2D */
    var loc = prof.map(function (p) {
      var d = G3.sub(p, cen);
      return { u: G3.dot(d, base.x), v: G3.dot(d, base.y) };
    });

    var frames = [], X = base.x, Y = base.y, Z = tan[0];
    /* alinea el marco inicial con la primera tangente */
    var rot0 = rotBetween(pn, Z);
    X = G3.applyDir(rot0, base.x); Y = G3.applyDir(rot0, base.y);
    for (i = 0; i < path.length; i++) {
      if (i > 0) {
        var r = rotBetween(tan[i - 1], tan[i]);
        X = G3.norm(G3.applyDir(r, X)); Y = G3.norm(G3.applyDir(r, Y));
      }
      frames.push({ o: path[i], x: X, y: Y, z: tan[i] });
    }
    if (!bank) for (i = 0; i < frames.length; i++) {
      var ax = G3.arbitraryAxis(tan[i]);
      frames[i].x = ax.x; frames[i].y = ax.y;
    }

    var mesh = new Mesh([], []);
    var np = prof.length;
    for (i = 0; i < frames.length; i++) {
      var f = frames[i], s = acc[i] / total;
      var sc = 1 + (scaleEnd - 1) * s;
      var tw = twist * s;
      var ct = Math.cos(tw), st = Math.sin(tw);
      for (j = 0; j < np; j++) {
        var u = loc[j].u * sc, v = loc[j].v * sc;
        var uu = u * ct - v * st, vv = u * st + v * ct;
        mesh.verts.push(G3.add(f.o, G3.add(G3.mul(f.x, uu), G3.mul(f.y, vv))));
      }
    }
    function id(r, p) { return (r % frames.length) * np + (p % np); }
    var lim = closedPath ? frames.length : frames.length - 1;
    for (i = 0; i < lim; i++)
      for (j = 0; j < np; j++)
        mesh.faces.push([id(i, j), id(i, j + 1), id(i + 1, j + 1), id(i + 1, j)]);
    if (!closedPath) {
      var c0 = [], c1 = [];
      for (j = 0; j < np; j++) { c0.push(id(0, j)); c1.push(id(frames.length - 1, j)); }
      var n0 = G3.polyNormal(c0.map(function (k) { return mesh.verts[k]; }));
      if (G3.dot(n0, tan[0]) > 0) c0.reverse();
      var n1 = G3.polyNormal(c1.map(function (k) { return mesh.verts[k]; }));
      if (G3.dot(n1, tan[frames.length - 1]) < 0) c1.reverse();
      mesh.faces.push(c0); mesh.faces.push(c1);
    }
    return mesh.clean(true);
  };

  function rotBetween(a, b) {
    a = G3.norm(a); b = G3.norm(b);
    /* Si alguno es nulo no hay giro que deducir: identidad. */
    if (G3.len2(a) < 0.5 || G3.len2(b) < 0.5) return G3.ident();
    var d = G3.dot(a, b);
    if (d > 1 - 1e-12) return G3.ident();
    if (d < -1 + 1e-12) return G3.mRotAxis(null, G3.perp(a), Math.PI);
    var ax = G3.cross(a, b);
    return G3.mRotAxis(null, ax, Math.acos(Math.max(-1, Math.min(1, d))));
  }
  M.rotBetween = rotBetween;

  /* Solevado entre secciones transversales.
     secs : [[pts], [pts], ...] todos con el mismo número de puntos tras
     el remuestreo; se remuestrean automáticamente y se alinean por el
     punto de arranque más cercano para evitar el retorcimiento. */
  M.loft = function (secs, opts) {
    opts = opts || {};
    if (!secs || secs.length < 2) return null;
    var closed = opts.closedSections !== false;
    var R, n;
    if (opts.samples) {
      n = Math.max(3, Math.min(400, opts.samples));
      R = secs.map(function (s) { return resample(s, n, closed); });
    } else {
      /* Se muestrean todas las secciones en la UNIÓN de sus parámetros de
         longitud de arco.  Así cada vértice original cae exactamente en la
         malla y las esquinas no se redondean: solevar dos rectángulos da un
         tronco de pirámide exacto, como en AutoCAD.  El remuestreo uniforme
         anterior se saltaba las esquinas. */
      var us = unionParams(secs, closed);
      n = us.length;
      R = secs.map(function (s) { return sampleAt(s, us, closed); });
    }
    /* una sección abierta puede tener sólo dos puntos (superficie reglada) */
    if (n < (closed ? 3 : 2)) return null;
    /* alineación por rotación del índice de arranque */
    for (var i = 1; i < R.length; i++) R[i] = alignStart(R[i - 1], R[i], closed);
    var mesh = new Mesh([], []), j;
    for (i = 0; i < R.length; i++) for (j = 0; j < n; j++) mesh.verts.push(R[i][j]);
    function id(r, p) { return r * n + (p % n); }
    var pl = closed ? n : n - 1;
    for (i = 0; i < R.length - 1; i++)
      for (j = 0; j < pl; j++)
        mesh.faces.push([id(i, j), id(i, j + 1), id(i + 1, j + 1), id(i + 1, j)]);
    if (closed && opts.caps !== false) {
      var c0 = [], c1 = [];
      for (j = 0; j < n; j++) { c0.push(id(0, j)); c1.push(id(R.length - 1, j)); }
      var dir = G3.sub(G3.polyCentroid(R[R.length - 1]), G3.polyCentroid(R[0]));
      var n0 = G3.polyNormal(c0.map(function (k) { return mesh.verts[k]; }));
      if (G3.dot(n0, dir) > 0) c0.reverse();
      var n1 = G3.polyNormal(c1.map(function (k) { return mesh.verts[k]; }));
      if (G3.dot(n1, dir) < 0) c1.reverse();
      mesh.faces.push(c0); mesh.faces.push(c1);
    }
    return mesh.clean(true);
  };

  /* Parámetros normalizados [0,1) de los vértices de un contorno */
  function paramsOf(pts, closed) {
    var P = pts.slice();
    if (closed && P.length > 1 && G3.eq(P[0], P[P.length - 1], 1e-9)) P.pop();
    var m = P.length, seg = closed ? m : m - 1, L = [0], i;
    for (i = 0; i < seg; i++) L.push(L[i] + G3.dist(P[i], P[(i + 1) % m]));
    var total = L[seg] || 1, out = [];
    for (i = 0; i < m; i++) out.push(L[i] / total);
    return out;
  }
  /* Unión ordenada de los parámetros de todas las secciones */
  function unionParams(secs, closed) {
    var all = [], i, j;
    for (i = 0; i < secs.length; i++) {
      var ps = paramsOf(secs[i], closed);
      for (j = 0; j < ps.length; j++) all.push(ps[j]);
    }
    all.sort(function (a, b) { return a - b; });
    var out = [], TOL = 1e-9;
    for (i = 0; i < all.length; i++)
      if (!out.length || all[i] - out[out.length - 1] > TOL) out.push(all[i]);
    if (!closed && out[out.length - 1] < 1 - TOL) out.push(1);
    if (out.length > 400) {           /* tope de seguridad */
      var red = [], step = out.length / 400;
      for (i = 0; i < 400; i++) red.push(out[Math.floor(i * step)]);
      out = red;
    }
    return out;
  }
  /* Punto de un contorno en un parámetro de longitud de arco */
  function sampleAt(pts, us, closed) {
    var P = pts.slice();
    if (closed && P.length > 1 && G3.eq(P[0], P[P.length - 1], 1e-9)) P.pop();
    var m = P.length, seg = closed ? m : m - 1, L = [0], i;
    for (i = 0; i < seg; i++) L.push(L[i] + G3.dist(P[i], P[(i + 1) % m]));
    var total = L[seg] || 1, out = [], k = 0;
    for (i = 0; i < us.length; i++) {
      var d = Math.min(total, us[i] * total);
      while (k < seg - 1 && L[k + 1] < d - 1e-12) k++;
      while (k > 0 && L[k] > d + 1e-12) k--;
      var den = Math.max(1e-12, L[k + 1] - L[k]);
      var t = Math.max(0, Math.min(1, (d - L[k]) / den));
      out.push(G3.lerp(P[k], P[(k + 1) % m], t));
    }
    return out;
  }

  function resample(pts, n, closed) {
    var P = pts.slice();
    if (closed && G3.eq(P[0], P[P.length - 1], 1e-9)) P.pop();
    var m = P.length, seg = closed ? m : m - 1;
    var L = [0], i;
    for (i = 0; i < seg; i++) L.push(L[i] + G3.dist(P[i], P[(i + 1) % m]));
    var total = L[seg] || 1;
    var out = [], step = total / (closed ? n : n - 1);
    var k = 0;
    for (i = 0; i < n; i++) {
      var d = Math.min(total - 1e-12, i * step);
      while (k < seg - 1 && L[k + 1] < d) k++;
      var t = (d - L[k]) / Math.max(1e-12, L[k + 1] - L[k]);
      out.push(G3.lerp(P[k], P[(k + 1) % m], Math.max(0, Math.min(1, t))));
    }
    return out;
  }
  M.resample = resample;

  function alignStart(ref, cur, closed) {
    if (!closed) return cur;
    var n = cur.length, best = 0, bd = Infinity, i, j;
    /* orientación: si el sentido es opuesto, se invierte */
    var na = G3.polyNormal(ref), nb = G3.polyNormal(cur);
    if (G3.dot(na, nb) < 0) cur = cur.slice().reverse();
    for (i = 0; i < n; i++) {
      var d = 0;
      for (j = 0; j < n; j += Math.max(1, n >> 3)) d += G3.dist2(ref[j], cur[(j + i) % n]);
      if (d < bd) { bd = d; best = i; }
    }
    var out = [];
    for (i = 0; i < n; i++) out.push(cur[(i + best) % n]);
    return out;
  }

  /* ============================================================
     Sección plana (para SECCION y para la generación de trayectorias)
     Devuelve polilíneas cerradas en el plano.
     ============================================================ */
  M.section = function (mesh, plane) {
    var tris = mesh.triangles(), segs = [], i;
    for (i = 0; i < tris.length; i++) {
      var a = mesh.verts[tris[i][0]], b = mesh.verts[tris[i][1]], c = mesh.verts[tris[i][2]];
      var s = triPlane(a, b, c, plane);
      if (s) segs.push(s);
    }
    return M.chain(segs);
  };

  function triPlane(a, b, c, pl) {
    var da = G3.planeDist(pl, a), db = G3.planeDist(pl, b), dc = G3.planeDist(pl, c);
    var pts = [];
    function ed(p, q, dp, dq) {
      if ((dp > 0 && dq > 0) || (dp < 0 && dq < 0)) return;
      if (Math.abs(dp - dq) < 1e-14) return;
      var t = dp / (dp - dq);
      if (t < -1e-9 || t > 1 + 1e-9) return;
      pts.push(G3.lerp(p, q, t));
    }
    if (Math.abs(da) < 1e-12) pts.push(a);
    if (Math.abs(db) < 1e-12) pts.push(b);
    if (Math.abs(dc) < 1e-12) pts.push(c);
    ed(a, b, da, db); ed(b, c, db, dc); ed(c, a, dc, da);
    /* deduplica */
    var u = [];
    for (var i = 0; i < pts.length; i++) {
      var dup = false;
      for (var j = 0; j < u.length; j++) if (G3.dist2(pts[i], u[j]) < 1e-16) { dup = true; break; }
      if (!dup) u.push(pts[i]);
    }
    if (u.length < 2) return null;
    return [u[0], u[1]];
  }

  /* Encadena segmentos sueltos en polilíneas */
  M.chain = function (segs, tol) {
    tol = tol || 1e-6;
    var inv = 1 / tol;
    function key(p) { return Math.round(p.x * inv) + '|' + Math.round(p.y * inv) + '|' + Math.round(p.z * inv); }
    var map = new Map(), i;
    for (i = 0; i < segs.length; i++) {
      var s = segs[i];
      if (G3.dist2(s[0], s[1]) < tol * tol) continue;
      [[key(s[0]), i, 0], [key(s[1]), i, 1]].forEach(function (e) {
        var a = map.get(e[0]); if (!a) { a = []; map.set(e[0], a); }
        a.push({ seg: e[1], end: e[2] });
      });
    }
    var used = new Uint8Array(segs.length), out = [];
    for (i = 0; i < segs.length; i++) {
      if (used[i]) continue;
      used[i] = 1;
      var poly = [segs[i][0], segs[i][1]];
      var grow = true;
      while (grow) {
        grow = false;
        var kEnd = key(poly[poly.length - 1]);
        var cand = map.get(kEnd) || [];
        for (var j = 0; j < cand.length; j++) {
          var c = cand[j];
          if (used[c.seg]) continue;
          used[c.seg] = 1;
          poly.push(segs[c.seg][c.end === 0 ? 1 : 0]);
          grow = true; break;
        }
        if (!grow) {
          var kSt = key(poly[0]);
          var cand2 = map.get(kSt) || [];
          for (j = 0; j < cand2.length; j++) {
            var c2 = cand2[j];
            if (used[c2.seg]) continue;
            used[c2.seg] = 1;
            poly.unshift(segs[c2.seg][c2.end === 0 ? 1 : 0]);
            grow = true; break;
          }
        }
      }
      if (poly.length >= 2) {
        var cl = G3.dist2(poly[0], poly[poly.length - 1]) < tol * tol;
        if (cl) poly.pop();
        poly.closed = cl;
        out.push(poly);
      }
    }
    return out;
  };

  /* ============================================================
     Aristas de silueta y contorno visible (para estilo Oculto)
     ============================================================ */
  M.silhouette = function (mesh, eye, persp) {
    var nr = mesh.faces.map(function (f) { return mesh.faceNormal(f); });
    var ct = mesh.faces.map(function (f) { return mesh.faceCenter(f); });
    var ed = mesh.edges(), out = [];
    for (var i = 0; i < ed.length; i++) {
      var e = ed[i];
      if (e.f.length !== 2) { out.push([e.a, e.b]); continue; }
      var f0 = e.f[0], f1 = e.f[1];
      var v0 = persp ? G3.sub(eye, ct[f0]) : eye;
      var v1 = persp ? G3.sub(eye, ct[f1]) : eye;
      var s0 = G3.dot(nr[f0], v0), s1 = G3.dot(nr[f1], v1);
      if ((s0 > 0) !== (s1 > 0)) out.push([e.a, e.b]);
    }
    return out;
  };

  /* Subdivisión de Catmull-Clark (para SUAVIZARMALLA) */
  M.subdivide = function (mesh) {
    var V = mesh.verts, F = mesh.faces, i, j;
    var fp = F.map(function (f) { return mesh.faceCenter(f); });
    var emap = new Map();
    function ekey(a, b) { return a < b ? a + ',' + b : b + ',' + a; }
    for (i = 0; i < F.length; i++) {
      var f = F[i];
      for (j = 0; j < f.length; j++) {
        var k = ekey(f[j], f[(j + 1) % f.length]);
        var e = emap.get(k);
        if (!e) { e = { a: f[j], b: f[(j + 1) % f.length], f: [] }; emap.set(k, e); }
        e.f.push(i);
      }
    }
    var nv = V.map(function (p) { return G3.copy(p); });
    var fpIdx = [], epIdx = new Map();
    for (i = 0; i < fp.length; i++) { fpIdx.push(nv.length); nv.push(fp[i]); }
    emap.forEach(function (e, k) {
      var p;
      if (e.f.length === 2) {
        p = G3.mul(G3.add(G3.add(V[e.a], V[e.b]), G3.add(fp[e.f[0]], fp[e.f[1]])), 0.25);
      } else p = G3.mid(V[e.a], V[e.b]);
      epIdx.set(k, nv.length); nv.push(p);
    });
    /* reposiciona los vértices originales */
    var Fn = new Array(V.length).fill(null).map(function () { return { f: [], e: [], n: 0 }; });
    for (i = 0; i < F.length; i++) for (j = 0; j < F[i].length; j++) Fn[F[i][j]].f.push(fp[i]);
    emap.forEach(function (e) {
      Fn[e.a].e.push(G3.mid(V[e.a], V[e.b]));
      Fn[e.b].e.push(G3.mid(V[e.a], V[e.b]));
    });
    for (i = 0; i < V.length; i++) {
      var n = Fn[i].f.length;
      if (n < 3) continue;
      var Favg = G3.v(0, 0, 0), Ravg = G3.v(0, 0, 0);
      Fn[i].f.forEach(function (p) { Favg = G3.add(Favg, p); });
      Fn[i].e.forEach(function (p) { Ravg = G3.add(Ravg, p); });
      Favg = G3.mul(Favg, 1 / n);
      Ravg = G3.mul(Ravg, 1 / Math.max(1, Fn[i].e.length));
      nv[i] = G3.mul(G3.add(G3.add(Favg, G3.mul(Ravg, 2)), G3.mul(V[i], n - 3)), 1 / n);
    }
    var nf = [];
    for (i = 0; i < F.length; i++) {
      var ff = F[i];
      for (j = 0; j < ff.length; j++) {
        var prev = ff[(j - 1 + ff.length) % ff.length], cur = ff[j], next = ff[(j + 1) % ff.length];
        nf.push([cur, epIdx.get(ekey(cur, next)), fpIdx[i], epIdx.get(ekey(prev, cur))]);
      }
    }
    return new Mesh(nv, nf).clean(true);
  };

  /* Comprobación de estanqueidad: toda arista debe tener 2 caras */
  /* Diagnóstico de la malla.
       estanco  : ninguna arista libre -> la superficie cierra un volumen.
                  Es la condición que exigen los laminadores y el CAM.
       manifold : además ninguna arista con más de dos caras.  Una malla
                  estanca pero no manifold sigue siendo utilizable; sólo
                  significa que en alguna arista concurren tres caras. */
  M.check = function (mesh) {
    var ed = mesh.edges(), open = 0, nonMan = 0;
    for (var i = 0; i < ed.length; i++) {
      if (ed[i].f.length === 1) open++;
      else if (ed[i].f.length > 2) nonMan++;
    }
    return { aristas: ed.length, abiertas: open, noManifold: nonMan,
             estanco: open === 0,
             manifold: open === 0 && nonMan === 0,
             caras: mesh.faces.length, vertices: mesh.verts.length };
  };
})();
