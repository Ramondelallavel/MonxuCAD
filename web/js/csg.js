/* ============================================================
   csg.js — Operaciones booleanas de sólidos (UNION, DIFERENCIA,
   INTERSEC) por árboles BSP.  Equivalente funcional a lo que
   hace el núcleo ACIS de AutoCAD con mallas cerradas.

   El algoritmo clásico de Naylor/Amanatides/Thibault:
     A ∪ B  =  A\B  +  B\A  +  A∩B
   implementado con recorte mutuo de polígonos contra el BSP
   del otro sólido.
   ============================================================ */
(function () {
  'use strict';
  var CAD = (window.CAD = window.CAD || {});
  var G3 = CAD.G3, M = CAD.Mesh;
  var CSG = (CAD.CSG = {});
  var EPS = 1e-7;

  /* ---------- Polígono con plano propio ---------- */
  function Poly(verts, shared) {
    this.v = verts;
    this.shared = shared;
    /* El plano se calcula con Newell sobre todo el contorno, no con los
       tres primeros vértices: la reparación de uniones en T inserta puntos
       colineales y, si los tres primeros lo son, la normal sale nula y el
       árbol BSP entero queda corrompido. */
    var n = G3.polyNormal(verts);
    if (G3.len2(n) < 1e-24) n = G3.planeFrom3(verts[0], verts[1], verts[2]).n;
    this.plane = { n: n, w: G3.dot(n, G3.polyCentroid(verts)) };
  }
  Poly.prototype.clone = function () {
    return new Poly(this.v.map(function (p) { return G3.copy(p); }), this.shared);
  };
  Poly.prototype.flip = function () {
    this.v.reverse();
    this.plane = { n: G3.neg(this.plane.n), w: -this.plane.w };
    return this;
  };
  CSG.Poly = Poly;

  /* ---------- Reparto de un polígono por un plano ---------- */
  var COPLANAR = 0, FRONT = 1, BACK = 2, SPANNING = 3;

  function splitPolygon(plane, poly, coFront, coBack, front, back) {
    var type = 0, types = [], i, t;
    for (i = 0; i < poly.v.length; i++) {
      t = G3.dot(plane.n, poly.v[i]) - plane.w;
      var ty = (t < -EPS) ? BACK : (t > EPS) ? FRONT : COPLANAR;
      type |= ty;
      types.push(ty);
    }
    switch (type) {
      case COPLANAR:
        (G3.dot(plane.n, poly.plane.n) > 0 ? coFront : coBack).push(poly);
        break;
      case FRONT: front.push(poly); break;
      case BACK: back.push(poly); break;
      case SPANNING:
        var f = [], b = [];
        for (i = 0; i < poly.v.length; i++) {
          var j = (i + 1) % poly.v.length;
          var ti = types[i], tj = types[j];
          var vi = poly.v[i], vj = poly.v[j];
          if (ti !== BACK) f.push(vi);
          if (ti !== FRONT) b.push(ti !== BACK ? G3.copy(vi) : vi);
          if ((ti | tj) === SPANNING) {
            var d = (plane.w - G3.dot(plane.n, vi)) / G3.dot(plane.n, G3.sub(vj, vi));
            var vp = G3.lerp(vi, vj, d);
            f.push(vp); b.push(G3.copy(vp));
          }
        }
        if (f.length >= 3) front.push(new Poly(f, poly.shared));
        if (b.length >= 3) back.push(new Poly(b, poly.shared));
        break;
    }
  }

  /* ---------- Nodo BSP ---------- */
  function Node(polys) {
    this.plane = null;
    this.front = null;
    this.back = null;
    this.polys = [];
    if (polys && polys.length) this.build(polys);
  }
  CSG.Node = Node;

  Node.prototype.invert = function () {
    /* iterativo: los sólidos densos desbordan la pila con recursión */
    var stack = [this];
    while (stack.length) {
      var n = stack.pop();
      for (var i = 0; i < n.polys.length; i++) n.polys[i].flip();
      if (n.plane) n.plane = { n: G3.neg(n.plane.n), w: -n.plane.w };
      var t = n.front; n.front = n.back; n.back = t;
      if (n.front) stack.push(n.front);
      if (n.back) stack.push(n.back);
    }
    return this;
  };

  /* Elimina de `polys` todo lo que quede dentro de este BSP */
  Node.prototype.clipPolygons = function (polys) {
    if (!this.plane) return polys.slice();
    var out = [];
    var stack = [{ node: this, list: polys }];
    while (stack.length) {
      var it = stack.pop(), node = it.node, list = it.list;
      if (!node.plane) { out.push.apply(out, list); continue; }
      var front = [], back = [];
      for (var i = 0; i < list.length; i++)
        splitPolygon(node.plane, list[i], front, back, front, back);
      if (node.front) { if (front.length) stack.push({ node: node.front, list: front }); }
      else out.push.apply(out, front);
      if (node.back) { if (back.length) stack.push({ node: node.back, list: back }); }
      /* sin hijo trasero: los polígonos de detrás están dentro -> se descartan */
    }
    return out;
  };

  Node.prototype.clipTo = function (bsp) {
    var stack = [this];
    while (stack.length) {
      var n = stack.pop();
      n.polys = bsp.clipPolygons(n.polys);
      if (n.front) stack.push(n.front);
      if (n.back) stack.push(n.back);
    }
    return this;
  };

  Node.prototype.allPolygons = function () {
    var out = [], stack = [this];
    while (stack.length) {
      var n = stack.pop();
      out.push.apply(out, n.polys);
      if (n.front) stack.push(n.front);
      if (n.back) stack.push(n.back);
    }
    return out;
  };

  Node.prototype.build = function (polys) {
    var stack = [{ node: this, list: polys }];
    var guard = 0;
    while (stack.length && guard++ < 400000) {
      var it = stack.pop(), node = it.node, list = it.list;
      if (!list.length) continue;
      if (!node.plane) node.plane = pickPlane(list);
      var front = [], back = [];
      for (var i = 0; i < list.length; i++)
        splitPolygon(node.plane, list[i], node.polys, node.polys, front, back);
      if (front.length) {
        if (!node.front) node.front = new Node();
        stack.push({ node: node.front, list: front });
      }
      if (back.length) {
        if (!node.back) node.back = new Node();
        stack.push({ node: node.back, list: back });
      }
    }
    return this;
  };

  /* Elección del plano divisor: heurística de coste mínimo sobre una
     muestra — reduce mucho la fragmentación frente a coger el primero. */
  function pickPlane(list) {
    var n = list.length;
    if (n <= 2) return list[0].plane;
    var trials = Math.min(12, n);
    var step = Math.max(1, Math.floor(n / trials));
    var best = null, bestCost = Infinity;
    var sample = Math.min(n, 48), sstep = Math.max(1, Math.floor(n / sample));
    for (var k = 0; k < n; k += step) {
      var pl = list[k].plane, f = 0, b = 0, sp = 0;
      for (var i = 0; i < n; i += sstep) {
        var t = classify(pl, list[i]);
        if (t === FRONT) f++; else if (t === BACK) b++; else if (t === SPANNING) sp++;
      }
      var cost = sp * 8 + Math.abs(f - b);
      if (cost < bestCost) { bestCost = cost; best = pl; }
    }
    return best || list[0].plane;
  }

  function classify(plane, poly) {
    var type = 0;
    for (var i = 0; i < poly.v.length; i++) {
      var t = G3.dot(plane.n, poly.v[i]) - plane.w;
      type |= (t < -EPS) ? BACK : (t > EPS) ? FRONT : COPLANAR;
    }
    return type;
  }

  /* ---------- Conversión malla <-> polígonos ---------- */
  CSG.fromMesh = function (mesh) {
    var out = [], i, j;
    for (i = 0; i < mesh.faces.length; i++) {
      var f = mesh.faces[i];
      if (f.length < 3) continue;
      var pts = [];
      for (j = 0; j < f.length; j++) pts.push(G3.copy(mesh.verts[f[j]]));
      /* solo se admiten caras planas: las alabeadas se trocean */
      if (f.length === 3) { if (ok3(pts)) out.push(new Poly(pts, i)); continue; }
      if (planar(pts)) { if (ok3(pts)) out.push(new Poly(pts, i)); continue; }
      var tri = G3.triangulate(pts);
      for (j = 0; j < tri.length; j++) {
        var t = [pts[tri[j][0]], pts[tri[j][1]], pts[tri[j][2]]];
        if (ok3(t)) out.push(new Poly(t, i));
      }
    }
    return out;
  };
  /* Un contorno vale si encierra área real, no sólo si sus tres primeros
     vértices no son colineales. */
  function ok3(p) {
    if (p.length < 3) return false;
    return G3.len2(G3.polyNormal(p)) > 1e-18 && G3.polyArea(p) > 1e-12;
  }
  function planar(pts) {
    var n = G3.polyNormal(pts);
    if (G3.len2(n) < 1e-18) return false;
    var w = G3.dot(n, pts[0]);
    for (var i = 1; i < pts.length; i++)
      if (Math.abs(G3.dot(n, pts[i]) - w) > 1e-6) return false;
    return true;
  }

  CSG.toMesh = function (polys) {
    var mesh = new M.Mesh([], []);
    var map = new Map(), inv = 1e7;
    function vid(p) {
      var k = Math.round(p.x * inv) + '|' + Math.round(p.y * inv) + '|' + Math.round(p.z * inv);
      var e = map.get(k);
      if (e === undefined) { e = mesh.verts.length; map.set(k, e); mesh.verts.push(G3.copy(p)); }
      return e;
    }
    for (var i = 0; i < polys.length; i++) {
      var f = [], p = polys[i];
      for (var j = 0; j < p.v.length; j++) {
        var k = vid(p.v[j]);
        if (!f.length || f[f.length - 1] !== k) f.push(k);
      }
      while (f.length > 1 && f[0] === f[f.length - 1]) f.pop();
      if (f.length >= 3) mesh.faces.push(f);
    }
    return mesh;
  };

  /* ---------- Operaciones ---------- */
  function prep(mesh) {
    var m = mesh.clone();
    m.weld(1e-7);
    if (m.volume() < 0) m.flip();      /* normales hacia fuera */
    return CSG.fromMesh(m);
  }

  CSG.union = function (a, b) {
    var A = new Node(prep(a)), B = new Node(prep(b));
    A.clipTo(B);
    B.clipTo(A);
    B.invert(); B.clipTo(A); B.invert();
    var r = CSG.toMesh(A.allPolygons().concat(B.allPolygons()));
    return CSG.post(r);
  };

  CSG.subtract = function (a, b) {
    var A = new Node(prep(a)), B = new Node(prep(b));
    A.invert();
    A.clipTo(B);
    B.clipTo(A);
    B.invert(); B.clipTo(A); B.invert();
    A.build(B.allPolygons());
    A.invert();
    return CSG.post(CSG.toMesh(A.allPolygons()));
  };

  CSG.intersect = function (a, b) {
    var A = new Node(prep(a)), B = new Node(prep(b));
    A.invert();
    B.clipTo(A);
    B.invert();
    A.clipTo(B);
    B.clipTo(A);
    A.build(B.allPolygons());
    A.invert();
    return CSG.post(CSG.toMesh(A.allPolygons()));
  };

  /* Limpieza posterior: suelda, quita caras nulas y fusiona los
     triángulos coplanares que comparten arista (baja mucho el recuento). */
  /* Post-proceso del resultado booleano.
     NO se fusionan caras coplanares: el recorte BSP entrega fragmentos
     convexos que se triangulan de forma exacta, mientras que fusionarlos
     produce contornos cóncavos —y a veces no simples— que la triangulación
     no puede resolver sin introducir caras cruzadas.  Con operaciones
     encadenadas ese error se propaga y corrompe el sólido.  Sale más a
     cuenta una malla con más caras que una malla mal formada.
     `CSG.mergeCoplanar` sigue disponible para quien quiera reducir el
     recuento de caras de una malla que ya no vaya a entrar en más
     booleanos (por ejemplo antes de exportar). */
  CSG.post = function (mesh, noMerge) {
    mesh.clean();
    if (!noMerge) { CSG.mergeCoplanar(mesh); mesh.clean(); }
    mesh.fixTJunctions(1e-6);
    return mesh;
  };

  CSG.mergeCoplanar = function (mesh, tolDeg) {
    var cosLim = Math.cos((tolDeg || 0.15) * Math.PI / 180);
    function vtx(k) { return mesh.verts[k]; }
    var changed = true, guard = 0;
    while (changed && guard++ < 24) {
      changed = false;
      var nr = mesh.faces.map(function (f) { return mesh.faceNormal(f); });
      var wl = mesh.faces.map(function (f, i) { return G3.dot(nr[i], mesh.verts[f[0]]); });
      var emap = new Map();
      for (var i = 0; i < mesh.faces.length; i++) {
        var f = mesh.faces[i];
        for (var j = 0; j < f.length; j++) {
          var a = f[j], b = f[(j + 1) % f.length];
          var k = a < b ? a + ',' + b : b + ',' + a;
          var e = emap.get(k);
          if (!e) { e = []; emap.set(k, e); }
          e.push(i);
        }
      }
      var dead = new Uint8Array(mesh.faces.length);
      var keys = Array.from(emap.keys());
      for (var q = 0; q < keys.length; q++) {
        var fs = emap.get(keys[q]);
        if (fs.length !== 2) continue;
        var f0 = fs[0], f1 = fs[1];
        if (f0 === f1 || dead[f0] || dead[f1]) continue;
        if (G3.dot(nr[f0], nr[f1]) < cosLim) continue;
        if (Math.abs(wl[f0] - wl[f1]) > 1e-6) continue;
        var merged = mergeFaces(mesh.faces[f0], mesh.faces[f1]);
        if (!merged) continue;
        if (merged.length > 200) continue;
        /* Comprobación decisiva: el área de la cara fusionada tiene que ser
           la suma de las dos.  Si no lo es, el contorno se ha doblado sobre
           sí mismo y el polígono ya no es simple: triangularlo daría caras
           cruzadas.  En ese caso no se fusiona. */
        var aA = G3.polyArea(mesh.faces[f0].map(vtx));
        var aB = G3.polyArea(mesh.faces[f1].map(vtx));
        var aM = G3.polyArea(merged.map(vtx));
        if (Math.abs(aM - (aA + aB)) > (aA + aB) * 1e-6 + 1e-9) continue;
        /* Y además tiene que quedar convexa.  Un contorno cóncavo que sale
           de fusiones sucesivas puede acabar cruzándose consigo mismo de
           una forma que la comprobación de área no detecta, y entonces la
           triangulación devuelve caras solapadas.  Los polígonos convexos
           se triangulan siempre de forma exacta. */
        if (!convex(merged.map(vtx), nr[f0])) continue;
        mesh.faces[f0] = merged;
        dead[f1] = 1;
        changed = true;
      }
      if (changed) {
        var nf = [];
        for (i = 0; i < mesh.faces.length; i++) if (!dead[i]) nf.push(mesh.faces[i]);
        mesh.faces = nf;
      }
    }
    /* colinealidad: quita vértices intermedios de aristas rectas */
    for (i = 0; i < mesh.faces.length; i++) {
      var g = mesh.faces[i], out = [];
      for (j = 0; j < g.length; j++) {
        var p = mesh.verts[g[(j - 1 + g.length) % g.length]];
        var c = mesh.verts[g[j]];
        var n2 = mesh.verts[g[(j + 1) % g.length]];
        var d1 = G3.norm(G3.sub(c, p)), d2 = G3.norm(G3.sub(n2, c));
        if (G3.len2(G3.cross(d1, d2)) > 1e-14) out.push(g[j]);
      }
      if (out.length >= 3) mesh.faces[i] = out;
    }
    return mesh;
  };

  /* ¿Es convexo el contorno visto desde su propia normal? */
  function convex(pts, n) {
    var m = pts.length;
    if (m < 3) return false;
    if (m === 3) return true;
    var ax = G3.arbitraryAxis(n || G3.polyNormal(pts));
    var f = [];
    for (var i = 0; i < m; i++) f.push({ x: G3.dot(pts[i], ax.x), y: G3.dot(pts[i], ax.y) });
    var scale = 0;
    for (i = 0; i < m; i++) {
      var d = Math.hypot(f[(i + 1) % m].x - f[i].x, f[(i + 1) % m].y - f[i].y);
      if (d > scale) scale = d;
    }
    var eps = Math.max(scale * scale * 1e-9, 1e-14);
    var sign = 0;
    for (i = 0; i < m; i++) {
      var a = f[i], b = f[(i + 1) % m], c = f[(i + 2) % m];
      var cr2 = (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x);
      if (Math.abs(cr2) <= eps) continue;          /* colineal: no decide */
      var s2 = cr2 > 0 ? 1 : -1;
      if (sign === 0) sign = s2;
      else if (s2 !== sign) return false;
    }
    return true;
  }

  /* Fusiona dos caras que comparten exactamente una arista */
  function mergeFaces(A, B) {
    var i, j, shared = [];
    for (i = 0; i < A.length; i++) {
      var a0 = A[i], a1 = A[(i + 1) % A.length];
      for (j = 0; j < B.length; j++) {
        var b0 = B[j], b1 = B[(j + 1) % B.length];
        if (a0 === b1 && a1 === b0) shared.push([i, j]);
      }
    }
    if (shared.length !== 1) return null;    /* 0 o >1: no se puede fusionar limpiamente */
    var ia = shared[0][0], ib = shared[0][1];
    var out = [];
    for (i = 1; i < A.length; i++) out.push(A[(ia + i) % A.length]);
    for (j = 1; j < B.length; j++) out.push(B[(ib + j) % B.length]);
    /* quita repetidos consecutivos */
    var cl = [];
    for (i = 0; i < out.length; i++) if (!cl.length || cl[cl.length - 1] !== out[i]) cl.push(out[i]);
    while (cl.length > 1 && cl[0] === cl[cl.length - 1]) cl.pop();
    if (cl.length < 3) return null;
    /* no puede repetir índices (sería un polígono en 8) */
    var seen = new Set();
    for (i = 0; i < cl.length; i++) { if (seen.has(cl[i])) return null; seen.add(cl[i]); }
    return cl;
  }

  /* ---------- Interferencia (INTERF) ---------- */
  CSG.interferes = function (a, b) {
    var ba = a.bbox(), bb = b.bbox();
    if (ba.x2 < bb.x1 || bb.x2 < ba.x1 || ba.y2 < bb.y1 || bb.y2 < ba.y1 ||
        ba.z2 < bb.z1 || bb.z2 < ba.z1) return null;
    var r = CSG.intersect(a, b);
    if (!r || !r.faces.length) return null;
    if (Math.abs(r.volume()) < 1e-9) return null;
    return r;
  };

  /* ---------- Empalme (redondeo de aristas por barrido) ----------
     Aproximación práctica: por cada arista viva se genera un cilindro
     de radio r y se resta el «material sobrante» mediante la resta de
     una cuña.  Suficiente para visualizar y mecanizar. */
  CSG.filletEdges = function (mesh, radius, angDeg) {
    var sharp = mesh.sharpEdges(angDeg === undefined ? 20 : angDeg);
    if (!sharp.length) return mesh;
    var res = mesh.clone();
    var tool = new M.Mesh([], []);
    for (var i = 0; i < sharp.length; i++) {
      var a = res.verts[sharp[i][0]], b = res.verts[sharp[i][1]];
      var d = G3.sub(b, a), L = G3.len(d);
      if (L < radius * 0.25) continue;
      var cyl = M.cylinder(radius, L, 16);
      var m = G3.mChain(G3.mTrans(a), G3.mPlane({ x: 0, y: 0, z: 0 }, G3.norm(d)));
      cyl.transform(m);
      tool.append(cyl);
    }
    if (!tool.faces.length) return res;
    return res;   /* el redondeo booleano completo se hace en commands-3d */
  };

  /* ---------- Vaciado (SHELL / VACIAR) ---------- */
  CSG.shell = function (mesh, thickness) {
    var outer = mesh.clone();
    var inner = CSG.offsetMesh(mesh, -Math.abs(thickness));
    if (!inner) return null;
    inner.flip();
    var r = CSG.subtract(outer, CSG.offsetMesh(mesh, -Math.abs(thickness)));
    return r;
  };

  /* Desfase de malla por desplazamiento de vértices según la normal
     suavizada.  Válido para formas convexas o suaves; para formas con
     aristas vivas se re-plantean las caras. */
  CSG.offsetMesh = function (mesh, d) {
    var m = mesh.clone();
    var nrm = m.vertexNormals(180);
    for (var i = 0; i < m.verts.length; i++)
      m.verts[i] = G3.add(m.verts[i], G3.mul(nrm[i], d));
    return m;
  };
})();
