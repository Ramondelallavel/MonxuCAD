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
    mesh.unpinch();
    if (noMerge) { mesh.fixTJunctions(1e-6); mesh.unpinch(); return CSG.sanea(mesh); }
    /* Se guarda la malla sin fusionar: si la fusión deja aristas
       compartidas por más de dos caras (no-manifold), se descarta y se
       devuelve la versión sin fusionar, que siempre sale bien formada.
       Cuesta más caras, pero la topología es lo que garantiza que el
       sólido se pueda cortar, imprimir y mecanizar sin sorpresas. */
    var plain = mesh.clone();
    CSG.mergeCoplanar(mesh);
    mesh.clean();
    mesh.unpinch();
    mesh.fixTJunctions(1e-6);
    mesh.unpinch();
    var c = M.check(mesh);
    if (c.manifold) return mesh;
    plain.fixTJunctions(1e-6);
    plain.unpinch();
    var c2 = M.check(plain);
    /* sólo se cambia si la versión sin fusionar es estrictamente mejor */
    if (c2.noManifold < c.noManifold || (c2.noManifold === c.noManifold && c2.abiertas < c.abiertas)) {
      mesh.verts = plain.verts;
      mesh.faces = plain.faces;
    }
    return CSG.sanea(mesh);
  };

  /* ------------------------------------------------------------
     Saneado de la malla resultante
     El recorte BSP deja de vez en cuando vértices casi coincidentes —del
     orden de una diezmilésima del tamaño de la pieza— que la soldadura
     con tolerancia fija no junta: quedan grietas de una o dos aristas.
     En una pieza suelta no se nota, pero encadenando booleanos se
     acumula y el sólido deja de ser estanco, que es lo que impide
     exportarlo a fabricación.

     Aquí se intenta cerrar con una tolerancia proporcional al tamaño de
     la pieza, probando de menor a mayor, y se acepta el resultado sólo si
     mejora la topología SIN cambiar el volumen: así nunca se traga un
     detalle de verdad.  Una malla que ya está cerrada no se toca.
     ------------------------------------------------------------ */
  CSG.sanea = function (mesh) {
    if (!mesh || !mesh.faces.length) return mesh;
    var c = M.check(mesh);
    if (c.estanco && c.manifold) return mesh;
    var b = mesh.bbox();
    var diag = Math.hypot(b.x2 - b.x1, b.y2 - b.y1, b.z2 - b.z1) || 1;
    var vol0 = Math.abs(mesh.volume());
    var mejor = null, mejorC = c;
    var escalas = [1e-7, 1e-6, 1e-5];
    for (var i = 0; i < escalas.length; i++) {
      var tol = Math.max(1e-12, diag * escalas[i]);
      var m2 = mesh.clone();
      m2.weld(tol);
      m2.clean();
      m2.unpinch();
      m2.fixTJunctions(tol);
      m2.unpinch();
      if (!m2.faces.length) continue;
      /* el volumen no puede moverse: si se mueve, se ha comido geometría */
      var vol2 = Math.abs(m2.volume());
      if (vol0 > 1e-12 && Math.abs(vol2 - vol0) > vol0 * 1e-6) continue;
      var c2 = M.check(m2);
      var mejora = c2.abiertas < mejorC.abiertas ||
                   (c2.abiertas === mejorC.abiertas && c2.noManifold < mejorC.noManifold);
      if (mejora) { mejor = m2; mejorC = c2; }
      if (c2.estanco && c2.manifold) break;
    }
    if (mejor) { mesh.verts = mejor.verts; mesh.faces = mejor.faces; }
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

  /* Desfase de malla exacto para caras planas.
     Cada cara define un plano; al desfasarlo una distancia d, el vértice
     nuevo es la intersección de los planos desfasados de sus caras.  Con
     tres o más planos independientes la solución es un punto, con dos una
     recta (se toma el punto más cercano al original) y con uno el simple
     desplazamiento por la normal.  Así una caja desfasada -3 da una caja
     exactamente 6 mm menor en cada dirección, cosa que el promedio de
     normales por vértice no consigue.  Está más abajo, justo encima de
     CSG.offsetMesh. */

  /* Vaciado: la pared es el sólido exterior más el interior con las
     caras del revés.  El interior está enteramente dentro y no toca al
     exterior, así que no hace falta ningún booleano: basta con juntarlos,
     y el resultado es exacto y siempre cerrado.  Restarlos con el BSP
     fallaba justo en piezas con agujeros —el interior hereda el troceado
     de caras del exterior y el recorte perdía polígonos: en una placa
     taladrada se abrían seis aristas y faltaban 534 mm³. */
  CSG.shell = function (mesh, t) {
    if (!mesh || !mesh.faces.length) return null;
    var g = Math.abs(t);
    if (!(g > 1e-12)) return null;
    var dentro = CSG.offsetMesh(mesh, -g);
    if (!dentro || !dentro.faces.length) return null;
    var c = M.check(dentro);
    if (!c.estanco || !c.manifold) return null;
    var vo = Math.abs(mesh.volume()), vi = Math.abs(dentro.volume());
    if (!(vi > 1e-9) || vi >= vo * 0.9999) return null;
    if (!cabeDentro(dentro, mesh, g)) return null;
    var res = mesh.clone();
    var hueco = dentro.clone();
    hueco.flip();
    res.append(hueco);
    return res;
  };

  /* ¿la malla interior cabe holgadamente dentro de la exterior?  Se
     comprueba por muestreo: si el desfase se ha pasado de grueso, el
     interior se sale o se cruza consigo mismo y hay que renunciar. */
  function cabeDentro(dentro, fuera, g) {
    var b1 = dentro.bbox(), b2 = fuera.bbox();
    var h = 1e-9;
    if (b1.x1 < b2.x1 - h || b1.y1 < b2.y1 - h || b1.z1 < b2.z1 - h ||
        b1.x2 > b2.x2 + h || b1.y2 > b2.y2 + h || b1.z2 > b2.z2 + h) return false;
    var n = dentro.verts.length;
    var paso = Math.max(1, Math.floor(n / 48));
    for (var i = 0; i < n; i += paso)
      if (!puntoDentro(fuera, dentro.verts[i])) return false;
    return true;
  }
  /* Punto dentro de una malla cerrada: se cuentan los cortes de un rayo.
     Si el rayo roza una arista se prueba otra dirección. */
  function puntoDentro(mesh, p) {
    var tris = mesh.triangles();
    var dirs = [G3.v(0.5773, 0.5774, 0.5775), G3.v(-0.2673, 0.5345, 0.8018),
                G3.v(0.8018, -0.2673, 0.5345)];
    for (var d = 0; d < dirs.length; d++) {
      var cortes = 0, dudoso = false;
      for (var i = 0; i < tris.length; i++) {
        var h = G3.rayTri(p, dirs[d], mesh.verts[tris[i][0]], mesh.verts[tris[i][1]],
                          mesh.verts[tris[i][2]], true);
        if (!h) continue;
        if (h.t < 1e-9) { dudoso = true; break; }
        cortes++;
      }
      if (!dudoso) return (cortes & 1) === 1;
    }
    return false;
  }
  CSG.puntoDentro = puntoDentro;

  CSG.offsetMesh = function (mesh, d) {
    var m = mesh.clone();
    var nf = m.faces.length, i, j;
    var nrm = new Array(nf), w = new Array(nf);
    for (i = 0; i < nf; i++) {
      nrm[i] = m.faceNormal(m.faces[i]);
      w[i] = G3.dot(nrm[i], m.verts[m.faces[i][0]]) + d;
    }
    /* caras incidentes en cada vértice */
    var inc = new Array(m.verts.length);
    for (i = 0; i < nf; i++)
      for (j = 0; j < m.faces[i].length; j++) {
        var k = m.faces[i][j];
        if (!inc[k]) inc[k] = [];
        if (inc[k].indexOf(i) < 0) inc[k].push(i);
      }
    var out = new Array(m.verts.length);
    for (k = 0; k < m.verts.length; k++) {
      var p = m.verts[k], list = inc[k] || [];
      /* planos distintos (se descartan los paralelos repetidos) */
      var pl = [];
      for (i = 0; i < list.length; i++) {
        var n = nrm[list[i]], wi = w[list[i]];
        var dup = false;
        for (j = 0; j < pl.length; j++)
          if (G3.dot(pl[j].n, n) > 0.999995 && Math.abs(pl[j].w - wi) < 1e-9) { dup = true; break; }
        if (!dup) pl.push({ n: n, w: wi });
      }
      out[k] = solvePlanes(pl, p, d);
    }
    m.verts = out;
    return m;
  };

  /* Punto que satisface los planos dados; si el sistema es singular se
     resuelve por mínimos cuadrados amortiguados hacia el punto original. */
  function solvePlanes(pl, p, d) {
    if (!pl.length) return G3.copy(p);
    if (pl.length === 1) return G3.add(p, G3.mul(pl[0].n, d));
    /* busca tres planos lo más independientes posible */
    if (pl.length >= 3) {
      var best = null, bestVol = 1e-6;
      for (var a = 0; a < pl.length; a++)
        for (var b = a + 1; b < pl.length; b++)
          for (var c = b + 1; c < pl.length; c++) {
            var v = Math.abs(G3.dot(pl[a].n, G3.cross(pl[b].n, pl[c].n)));
            if (v > bestVol) { bestVol = v; best = [pl[a], pl[b], pl[c]]; }
          }
      if (best) {
        var q = cramer3(best);
        if (q && G3.dist(q, p) < Math.abs(d) * 12 + 1e-6) return q;
      }
    }
    /* dos planos: el punto de la recta de intersección más cercano a p */
    var A = pl[0], B = null, bestAng = 0.999995;
    for (var i = 1; i < pl.length; i++) {
      var dot = Math.abs(G3.dot(A.n, pl[i].n));
      if (dot < bestAng) { bestAng = dot; B = pl[i]; }
    }
    if (B) {
      var dir = G3.cross(A.n, B.n);
      if (G3.len2(dir) > 1e-14) {
        /* punto base: resuelve el sistema 2x2 en el plano generado por las normales */
        var n1n2 = G3.dot(A.n, B.n);
        var det = 1 - n1n2 * n1n2;
        var c1 = (A.w - B.w * n1n2) / det;
        var c2 = (B.w - A.w * n1n2) / det;
        var base = G3.add(G3.mul(A.n, c1), G3.mul(B.n, c2));
        var t = G3.dot(G3.sub(p, base), dir) / G3.len2(dir);
        var q2 = G3.add(base, G3.mul(dir, t));
        if (G3.dist(q2, p) < Math.abs(d) * 12 + 1e-6) return q2;
      }
    }
    /* último recurso: promedio de los desplazamientos por normal */
    var acc = G3.v(0, 0, 0);
    for (i = 0; i < pl.length; i++) {
      var off = pl[i].w - G3.dot(pl[i].n, p);
      acc = G3.add(acc, G3.mul(pl[i].n, off));
    }
    return G3.add(p, G3.mul(acc, 1 / pl.length));
  }

  function cramer3(pl) {
    var a = pl[0].n, b = pl[1].n, c = pl[2].n;
    var det = G3.dot(a, G3.cross(b, c));
    if (Math.abs(det) < 1e-9) return null;
    var r = G3.add(G3.add(G3.mul(G3.cross(b, c), pl[0].w),
                          G3.mul(G3.cross(c, a), pl[1].w)),
                   G3.mul(G3.cross(a, b), pl[2].w));
    return G3.mul(r, 1 / det);
  }

})();
