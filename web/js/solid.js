/* ============================================================
   solid.js — Entidades 3D en el documento
   Tipos SOLID3D (sólido) y MESH (malla).  La geometría se
   guarda como historia paramétrica cuando existe (primitiva,
   extrusión, revolución…) y se teseliza en caché bajo demanda,
   igual que hace AutoCAD con los sólidos ACIS.
   ============================================================ */
(function () {
  'use strict';
  var CAD = (window.CAD = window.CAD || {});
  var G = CAD.G, G3 = CAD.G3, M = CAD.Mesh, E = CAD.E;
  var S = (CAD.Solid = {});
  var v3 = G3.v;

  /* ---------- Caché de teselación ---------- */
  var CACHE = new WeakMap();
  S.drop = function (ent) { CACHE.delete(ent); };
  S.clearCache = function () { CACHE = new WeakMap(); };

  /* Construye (o recupera) la malla evaluada de una entidad 3D */
  S.meshOf = function (ent) {
    if (!ent || (ent.type !== 'SOLID3D' && ent.type !== 'MESH')) return null;
    var c = CACHE.get(ent);
    if (c && c.sig === ent.sig) return c.mesh;
    var mesh = S.evaluate(ent);
    if (!mesh) return null;
    if (ent.m) { mesh = mesh.clone(); mesh.transform(ent.m); }
    CACHE.set(ent, { sig: ent.sig, mesh: mesh });
    return mesh;
  };

  /* Evalúa la historia paramétrica en el sistema local */
  S.evaluate = function (ent) {
    var h = ent.hist;
    if (!h) return ent.mesh ? M.make(ent.mesh.verts, ent.mesh.faces) : null;
    var q = h.seg || 0;
    switch (h.op) {
      case 'box':      return M.box(h.l, h.w, h.h, h.centered);
      case 'cylinder': return M.cylinder(h.r, h.h, q || M.segFor(h.r), h.r2);
      case 'cone':     return M.cone(h.r, h.h, q || M.segFor(h.r), h.r2);
      case 'sphere':   return M.sphere(h.r, q || M.segFor(h.r));
      case 'torus':    return M.torus(h.R, h.r, q || M.segFor(h.R), 0);
      case 'wedge':    return M.wedge(h.l, h.w, h.h, h.centered);
      case 'pyramid':  return M.pyramid(h.r, h.h, h.sides, h.r2);
      case 'extrude':  return M.extrude(pts(h.prof), vec(h.dir), h.taper || 0, (h.holes || []).map(pts));
      case 'revolve':  return M.revolve(pts(h.prof), vec(h.axisPt), vec(h.axisDir), h.angle, h.seg, h.closed);
      case 'sweep':    return M.sweep(pts(h.prof), pts(h.path), h.opts || {});
      case 'loft':     return M.loft((h.secs || []).map(pts), h.opts || {});
      case 'mesh':     return M.make(pts(h.verts), h.faces.map(function (f) { return f.slice(); }));
      case 'bool':     return evalBool(h);
      case 'fillet':   return evalRedondeo(h, true);
      case 'chamfer':  return evalRedondeo(h, false);
      default:         return ent.mesh ? M.make(pts(ent.mesh.verts), ent.mesh.faces) : null;
    }
  };

  /* ------------------------------------------------------------------
     Operación booleana con historial.  Cada operando conserva su propia
     historia y su matriz, de modo que el árbol se puede recorrer y
     reconstruir cambiando un parámetro, como en SolidWorks o CATIA.
     Antes el resultado se cocía en una malla y los parámetros de las
     piezas que lo formaban se perdían para siempre.
     ------------------------------------------------------------------ */
  function evalBool(h) {
    var CSG = CAD.CSG;
    var nodos = h.nodes || [];
    var acc = null;
    for (var i = 0; i < nodos.length; i++) {
      var nd = nodos[i];
      if (nd.suprimido) continue;                /* operación suprimida */
      var m = S.evaluate({ hist: nd.hist, mesh: nd.mesh });
      if (!m) continue;
      if (nd.m) { m = m.clone(); m.transform(nd.m); }
      if (!acc) { acc = m.clone(); continue; }
      try {
        if (h.kind === 'union') acc = CSG.union(acc, m);
        else if (h.kind === 'inter') acc = CSG.intersect(acc, m);
        else acc = CSG.subtract(acc, m);
      } catch (e) { return acc; }
      if (!acc || !acc.faces.length) return acc;
    }
    return acc;
  }

  /* Empalme o chaflán de aristas como operación del árbol: se reconstruye
     sobre el sólido de origen, así que se le puede cambiar el radio. */
  function evalRedondeo(h, round) {
    if (!h.src) return null;
    var base = S.evaluate({ hist: h.src.hist, mesh: h.src.mesh });
    if (!base) return null;
    if (h.src.m) { base = base.clone(); base.transform(h.src.m); }
    var CSG = CAD.CSG;
    var fn = round ? CSG.filletMesh : CSG.chamferMesh;
    if (typeof fn !== 'function') return base;
    var r = round ? h.r : h.d;
    if (!(r > 0)) return base;
    var res = null;
    try { res = fn(base, r, h.ang); } catch (e) { res = null; }
    return (res && res.faces.length) ? res : base;
  }

  /* Nodo de árbol a partir de una entidad 3D */
  S.nodeOf = function (ent) {
    var nd = { hist: ent.hist ? JSON.parse(JSON.stringify(ent.hist)) : null,
               m: ent.m ? ent.m.slice() : null,
               nombre: S.opName(ent.hist) };
    if (!nd.hist && ent.mesh) nd.mesh = ent.mesh;
    return nd;
  };

  var OPNAMES = {
    box: 'Prisma', cylinder: 'Cilindro', cone: 'Cono', sphere: 'Esfera',
    torus: 'Toroide', wedge: 'Cuña', pyramid: 'Pirámide',
    extrude: 'Extrusión', revolve: 'Revolución', sweep: 'Barrido',
    loft: 'Solevado', mesh: 'Malla', bool: 'Operación booleana',
    fillet: 'Empalme de aristas', chamfer: 'Chaflán de aristas'
  };
  var BOOLNAMES = { union: 'Unión', diff: 'Diferencia', inter: 'Intersección' };
  S.opName = function (h) {
    if (!h) return 'Malla';
    if (h.op === 'bool') return BOOLNAMES[h.kind] || 'Booleana';
    return OPNAMES[h.op] || h.op;
  };

  /* Parámetros editables de una operación, con su rótulo y unidad */
  var PARAMS = {
    box: [['l', 'Longitud'], ['w', 'Anchura'], ['h', 'Altura']],
    wedge: [['l', 'Longitud'], ['w', 'Anchura'], ['h', 'Altura']],
    cylinder: [['r', 'Radio'], ['h', 'Altura'], ['r2', 'Radio superior']],
    cone: [['r', 'Radio'], ['h', 'Altura'], ['r2', 'Radio superior']],
    sphere: [['r', 'Radio']],
    torus: [['R', 'Radio mayor'], ['r', 'Radio del tubo']],
    pyramid: [['r', 'Radio'], ['h', 'Altura'], ['sides', 'Lados'], ['r2', 'Radio superior']],
    revolve: [['angle', 'Ángulo'], ['seg', 'Segmentos']],
    extrude: [['taper', 'Conicidad']],
    fillet: [['r', 'Radio'], ['ang', 'Ángulo mínimo']],
    chamfer: [['d', 'Distancia'], ['ang', 'Ángulo mínimo']]
  };
  S.paramsOf = function (h) {
    if (!h) return [];
    var def = PARAMS[h.op] || [];
    var out = [];
    for (var i = 0; i < def.length; i++) {
      var k = def[i][0];
      if (h[k] === undefined || typeof h[k] !== 'number') continue;
      out.push({ key: k, label: def[i][1], value: h[k] });
    }
    return out;
  };

  /* --------- Recorrido del árbol ---------
     Devuelve una lista plana [{nivel, nombre, hist, params, ruta}] donde
     "ruta" es la sucesión de índices para llegar al nodo. */
  S.featureTree = function (ent) {
    var out = [];
    function rec(h, nivel, ruta, etiq) {
      if (!h) return;
      out.push({ nivel: nivel, nombre: etiq || S.opName(h), op: h.op,
                 kind: h.kind, params: S.paramsOf(h), ruta: ruta.slice() });
      if (h.op === 'bool' && h.nodes) {
        for (var i = 0; i < h.nodes.length; i++) {
          var nd = h.nodes[i];
          var pref = (h.kind === 'diff' && i > 0) ? 'Resta: ' : '';
          rec(nd.hist, nivel + 1, ruta.concat(i), pref + (nd.nombre || S.opName(nd.hist)));
        }
      } else if ((h.op === 'fillet' || h.op === 'chamfer') && h.src) {
        rec(h.src.hist, nivel + 1, ruta.concat(0), h.src.nombre || S.opName(h.src.hist));
      }
    }
    rec(ent.hist, 0, [], null);
    return out;
  };

  /* Historia que hay al final de una ruta de índices */
  S.histAt = function (ent, ruta) {
    var h = ent.hist;
    for (var i = 0; i < ruta.length; i++) {
      if (!h) return null;
      if (h.op === 'bool' && h.nodes && h.nodes[ruta[i]]) { h = h.nodes[ruta[i]].hist; continue; }
      if ((h.op === 'fillet' || h.op === 'chamfer') && h.src && ruta[i] === 0) { h = h.src.hist; continue; }
      return null;
    }
    return h;
  };

  /* Cambia un parámetro dentro del árbol y fuerza la reconstrucción */
  S.setParam = function (ent, ruta, key, value, doc) {
    var h = S.histAt(ent, ruta);
    if (!h || typeof value !== 'number' || !isFinite(value)) return false;
    h[key] = value;
    if (doc && doc.touch) doc.touch(ent);
    ent.sig = newSig();
    CACHE.delete(ent);
    return true;
  };

  /* Suprime o restituye un operando (como en el árbol de SolidWorks) */
  S.toggleNode = function (ent, ruta, doc) {
    if (!ruta.length) return false;
    var padre = ent.hist;
    for (var i = 0; i < ruta.length - 1; i++) {
      if (!padre || padre.op !== 'bool') return false;
      padre = padre.nodes[ruta[i]].hist;
    }
    if (!padre || padre.op !== 'bool' || !padre.nodes) return false;
    var nd = padre.nodes[ruta[ruta.length - 1]];
    nd.suprimido = !nd.suprimido;
    if (doc && doc.touch) doc.touch(ent);
    ent.sig = newSig();
    CACHE.delete(ent);
    return nd.suprimido;
  };
  function pts(a) { return (a || []).map(function (p) { return v3(p.x, p.y, p.z || 0); }); }
  function vec(p) { return p ? v3(p.x, p.y, p.z || 0) : v3(0, 0, 0); }

  /* ---------- Constructores ---------- */
  var sigCounter = 1;
  function newSig() { return 's' + (sigCounter++) + '-' + Date.now().toString(36); }
  S.newSig = newSig;

  S.solid = function (hist, o) {
    return Object.assign({
      id: 0, type: 'SOLID3D', hist: hist, sig: newSig(), m: null,
      color: undefined, layer: undefined, ltype: undefined, lw: undefined,
      material: undefined
    }, o || {});
  };

  /* Sólido a partir de una malla ya calculada (booleanos, importación…) */
  S.fromMesh = function (mesh, o) {
    var e = S.solid({ op: 'mesh',
      verts: mesh.verts.map(function (p) { return { x: r6(p.x), y: r6(p.y), z: r6(p.z) }; }),
      faces: mesh.faces.map(function (f) { return f.slice(); }) }, o);
    return e;
  };
  function r6(v) { return Math.abs(v) < 1e-12 ? 0 : +v.toFixed(9); }

  S.mesh = function (mesh, o) {
    var e = S.fromMesh(mesh, o);
    e.type = 'MESH';
    return e;
  };

  /* Sustituye la geometría de una entidad (invalida la caché) */
  S.setMesh = function (ent, mesh, doc) {
    if (doc && doc.touch) doc.touch(ent);
    ent.hist = { op: 'mesh',
      verts: mesh.verts.map(function (p) { return { x: r6(p.x), y: r6(p.y), z: r6(p.z) }; }),
      faces: mesh.faces.map(function (f) { return f.slice(); }) };
    ent.m = null;
    ent.sig = newSig();
    CACHE.delete(ent);
    return ent;
  };
  S.reparam = function (ent, patch, doc) {
    if (doc && doc.touch) doc.touch(ent);
    Object.assign(ent.hist, patch);
    ent.sig = newSig();
    CACHE.delete(ent);
    return ent;
  };

  /* Aplica una matriz 4x4 acumulándola en la entidad */
  S.xform = function (ent, m, doc) {
    if (doc && doc.touch) doc.touch(ent);
    ent.m = ent.m ? G3.mMul(m, ent.m) : m.slice();
    ent.sig = newSig();
    CACHE.delete(ent);
    return ent;
  };

  S.is3D = function (e) { return e && (e.type === 'SOLID3D' || e.type === 'MESH'); };

  /* ---------- Integración con el resto del documento ---------- */

  /* Caja envolvente 3D */
  S.box3 = function (ent) {
    var m = S.meshOf(ent);
    return m ? m.bbox() : null;
  };

  /* Proyección al plano XY para el motor 2D (extents, designación…) */
  E.extents3 = function (ent) { return S.box3(ent); };

  /* Segmentos de la silueta y aristas, proyectados a 2D.  Lo usa el
     renderizador 2D para que el sólido se vea también en el modelo. */
  S.segs2d = function (ent) {
    var mesh = S.meshOf(ent);
    if (!mesh) return [];
    var ed = mesh.sharpEdges(18), out = [];
    for (var i = 0; i < ed.length; i++) {
      var a = mesh.verts[ed[i][0]], b = mesh.verts[ed[i][1]];
      out.push([{ x: a.x, y: a.y }, { x: b.x, y: b.y }]);
    }
    return out;
  };

  /* ---------- Puntos de referencia (OSNAP en 3D) ---------- */
  S.snapPoints = function (ent) {
    var mesh = S.meshOf(ent);
    if (!mesh) return [];
    var out = [], i;
    var nv = mesh.verts.length;
    var stepV = nv > 2000 ? Math.ceil(nv / 2000) : 1;
    for (i = 0; i < nv; i += stepV) out.push({ type: 'end', p: mesh.verts[i] });
    var ed = mesh.sharpEdges(18);
    var stepE = ed.length > 1500 ? Math.ceil(ed.length / 1500) : 1;
    for (i = 0; i < ed.length; i += stepE) {
      var a = mesh.verts[ed[i][0]], b = mesh.verts[ed[i][1]];
      out.push({ type: 'mid', p: G3.mid(a, b) });
    }
    out.push({ type: 'cen', p: mesh.centroid() });
    return out;
  };

  /* ---------- Pinzamientos ---------- */
  S.grips = function (ent) {
    var b = S.box3(ent);
    if (!b) return [];
    var c = G3.boxCenter(b);
    var g = [{ x: c.x, y: c.y, z: c.z, kind: 'center' }];
    var co = G3.boxCorners(b);
    for (var i = 0; i < co.length; i++) g.push({ x: co[i].x, y: co[i].y, z: co[i].z, kind: 'corner', i: i });
    return g;
  };

  /* ---------- Propiedades de masa (MASSPROP) ---------- */
  S.massProps = function (ent, density) {
    var mesh = S.meshOf(ent);
    if (!mesh) return null;
    var vol = Math.abs(mesh.volume());
    var area = mesh.area();
    var c = mesh.centroid();
    var b = mesh.bbox();
    var tris = mesh.triangles();
    /* tensor de inercia por el método de Tonon sobre tetraedros al origen */
    var Ixx = 0, Iyy = 0, Izz = 0, Ixy = 0, Iyz = 0, Ixz = 0;
    for (var i = 0; i < tris.length; i++) {
      var p1 = mesh.verts[tris[i][0]], p2 = mesh.verts[tris[i][1]], p3 = mesh.verts[tris[i][2]];
      var det = G3.dot(p1, G3.cross(p2, p3));
      var vx = [p1.x, p2.x, p3.x], vy = [p1.y, p2.y, p3.y], vz = [p1.z, p2.z, p3.z];
      function f2(a) { return a[0] * a[0] + a[1] * a[1] + a[2] * a[2] + a[0] * a[1] + a[1] * a[2] + a[2] * a[0]; }
      function f11(a, bq) {
        return 2 * (a[0] * bq[0] + a[1] * bq[1] + a[2] * bq[2]) +
               a[0] * bq[1] + a[1] * bq[0] + a[1] * bq[2] + a[2] * bq[1] + a[0] * bq[2] + a[2] * bq[0];
      }
      Ixx += det * (f2(vy) + f2(vz));
      Iyy += det * (f2(vx) + f2(vz));
      Izz += det * (f2(vx) + f2(vy));
      Ixy += det * f11(vx, vy);
      Iyz += det * f11(vy, vz);
      Ixz += det * f11(vx, vz);
    }
    var k = 1 / 60, k2 = 1 / 120;
    var rho = density === undefined ? 1 : density;
    return {
      volumen: vol, area: area, centroide: c, bbox: b, masa: vol * rho,
      Ixx: Ixx * k * rho, Iyy: Iyy * k * rho, Izz: Izz * k * rho,
      Ixy: Ixy * k2 * rho, Iyz: Iyz * k2 * rho, Ixz: Ixz * k2 * rho,
      radioGiro: {
        x: Math.sqrt(Math.abs(Ixx * k) / Math.max(vol, 1e-12)),
        y: Math.sqrt(Math.abs(Iyy * k) / Math.max(vol, 1e-12)),
        z: Math.sqrt(Math.abs(Izz * k) / Math.max(vol, 1e-12))
      }
    };
  };

  /* ---------- Descripción para la paleta de propiedades ---------- */
  S.describe = function (ent) {
    var h = ent.hist || {};
    var names = {
      box: 'Prisma', cylinder: 'Cilindro', cone: 'Cono', sphere: 'Esfera',
      torus: 'Toroide', wedge: 'Cuña', pyramid: 'Pirámide',
      extrude: 'Extrusión', revolve: 'Revolución', sweep: 'Barrido',
      loft: 'Solevado', mesh: 'Malla'
    };
    var r = [['Tipo', ent.type === 'MESH' ? 'Malla' : 'Sólido 3D'],
             ['Historia', names[h.op] || 'Compuesto']];
    var mesh = S.meshOf(ent);
    if (mesh) {
      r.push(['Caras', mesh.faces.length]);
      r.push(['Vértices', mesh.verts.length]);
      r.push(['Volumen', G.fmt(Math.abs(mesh.volume()), 4)]);
      r.push(['Área', G.fmt(mesh.area(), 4)]);
    }
    if (h.op === 'box') { r.push(['Longitud', G.fmt(h.l, 4)], ['Anchura', G.fmt(h.w, 4)], ['Altura', G.fmt(h.h, 4)]); }
    if (h.op === 'cylinder' || h.op === 'cone') { r.push(['Radio', G.fmt(h.r, 4)], ['Altura', G.fmt(h.h, 4)]); }
    if (h.op === 'sphere') r.push(['Radio', G.fmt(h.r, 4)]);
    if (h.op === 'torus') r.push(['Radio mayor', G.fmt(h.R, 4)], ['Radio menor', G.fmt(h.r, 4)]);
    return r;
  };

  /* ---------- Perfiles 2D -> contornos 3D (para extruir/revolucionar) ---------- */
  /* Convierte una entidad 2D cerrada en una lista de puntos 3D. */
  S.profileOf = function (ent, doc, quality) {
    if (!ent) return null;
    var z = ent.elev || 0;
    if (ent.type === 'CIRCLE') {
      var n = M.segFor(ent.r);
      var o = [], oc = ent.ocs;
      for (var i = 0; i < n; i++) {
        var a = Math.PI * 2 * i / n;
        var px = ent.c.x + ent.r * Math.cos(a), py = ent.c.y + ent.r * Math.sin(a);
        if (oc) o.push(v3(oc.org.x + oc.x.x * px + oc.y.x * py,
                          oc.org.y + oc.x.y * px + oc.y.y * py,
                          oc.org.z + oc.x.z * px + oc.y.z * py));
        else o.push(v3(px, py, z));
      }
      o.closed = true;
      return o;
    }
    var segs = E.segs(ent, doc, quality || 'high');
    if (!segs || !segs.length) return null;
    /* E.segs devuelve [{pts, closed}]; se toma el contorno más largo */
    function ptsOf(s2) { return (s2 && s2.pts) ? s2.pts : s2; }
    var best = segs[0], bestN = ptsOf(segs[0]).length;
    for (i = 1; i < segs.length; i++) {
      var n2 = ptsOf(segs[i]).length;
      if (n2 > bestN) { best = segs[i]; bestN = n2; }
    }
    var bpts = ptsOf(best);
    if (!bpts || bpts.length < 2) return null;
    /* si la entidad nació sobre un plano de trabajo inclinado, sus
       coordenadas son las de ese plano */
    var ocs = ent.ocs;
    var pts3 = bpts.map(function (p) {
      if (ocs) {
        var u = p.x, v = p.y, w = p.z === undefined ? 0 : p.z;
        return v3(ocs.org.x + ocs.x.x * u + ocs.y.x * v + ocs.n.x * w,
                  ocs.org.y + ocs.x.y * u + ocs.y.y * v + ocs.n.y * w,
                  ocs.org.z + ocs.x.z * u + ocs.y.z * v + ocs.n.z * w);
      }
      return v3(p.x, p.y, p.z === undefined ? z : p.z);
    });
    var closed = !!(best && best.closed);
    if (pts3.length > 2 && G3.dist2(pts3[0], pts3[pts3.length - 1]) < 1e-12) { pts3.pop(); closed = true; }
    if (ent.type === 'LWPOLYLINE' && ent.closed) closed = true;
    else if (ent.type === 'ELLIPSE' && Math.abs(Math.abs(ent.t1 - ent.t0) - Math.PI * 2) < 1e-6) closed = true;
    pts3.closed = closed;
    /* quita puntos repetidos consecutivos */
    var cl = [pts3[0]];
    for (i = 1; i < pts3.length; i++) if (G3.dist2(pts3[i], cl[cl.length - 1]) > 1e-14) cl.push(pts3[i]);
    cl.closed = pts3.closed;
    return cl;
  };

  /* Agrupa varios perfiles en exterior + agujeros (el mayor área manda) */
  S.groupProfiles = function (list) {
    if (!list.length) return null;
    var areas = list.map(function (p) { return G3.polyArea(p); });
    var bi = 0;
    for (var i = 1; i < list.length; i++) if (areas[i] > areas[bi]) bi = i;
    var holes = [];
    for (i = 0; i < list.length; i++) if (i !== bi) holes.push(list[i]);
    return { outer: list[bi], holes: holes };
  };

  /* ---------- Conversión a entidades 2D (APLANAR / SOLPERFIL) ---------- */
  S.flatten = function (ent, doc, plane) {
    var mesh = S.meshOf(ent);
    if (!mesh) return [];
    var pl = plane || { n: v3(0, 0, 1), w: 0 };
    var ax = G3.arbitraryAxis(pl.n);
    var ed = mesh.sharpEdges(18), out = [], seen = new Set();
    for (var i = 0; i < ed.length; i++) {
      var a = mesh.verts[ed[i][0]], b = mesh.verts[ed[i][1]];
      var pa = { x: G3.dot(a, ax.x), y: G3.dot(a, ax.y) };
      var pb = { x: G3.dot(b, ax.x), y: G3.dot(b, ax.y) };
      var k = Math.round(pa.x * 1e4) + ',' + Math.round(pa.y * 1e4) + '|' +
              Math.round(pb.x * 1e4) + ',' + Math.round(pb.y * 1e4);
      var k2 = Math.round(pb.x * 1e4) + ',' + Math.round(pb.y * 1e4) + '|' +
               Math.round(pa.x * 1e4) + ',' + Math.round(pa.y * 1e4);
      if (seen.has(k) || seen.has(k2)) continue;
      seen.add(k);
      if (G.dist(pa, pb) < 1e-9) continue;
      out.push(E.line(pa, pb, { layer: ent.layer, color: ent.color }));
    }
    return out;
  };

  /* Sección de un sólido -> polilíneas 2D en el plano dado */
  S.sectionEnts = function (ent, plane, doc) {
    var mesh = S.meshOf(ent);
    if (!mesh) return [];
    var loops = M.section(mesh, plane);
    var ax = G3.arbitraryAxis(plane.n);
    return loops.map(function (lp) {
      var verts = lp.map(function (p) {
        var d = G3.sub(p, G3.mul(plane.n, plane.w));
        return { x: G3.dot(d, ax.x), y: G3.dot(d, ax.y) };
      });
      return E.pline(verts, !!lp.closed, { layer: ent.layer });
    });
  };
  /* ============================================================
     Enganches en el motor 2D
     Se envuelven las funciones de doc.js para que las entidades 3D
     participen en extents, designación, pinzamientos y referencias.
     ============================================================ */
  function wrap(name, fn) {
    var orig = E[name];
    E[name] = function (ent) {
      if (ent && (ent.type === 'SOLID3D' || ent.type === 'MESH'))
        return fn.apply(null, arguments);
      return orig.apply(null, arguments);
    };
    E[name].__orig = orig;
  }

  wrap('segs', function (ent) {
    var segs = S.segs2d(ent);
    return segs.map(function (s2) { return { pts: s2, closed: false }; });
  });

  wrap('extents', function (ent) {
    var b = S.box3(ent);
    if (!b) return G.bboxNew();
    return { x1: b.x1, y1: b.y1, x2: b.x2, y2: b.y2, z1: b.z1, z2: b.z2 };
  });

  wrap('transform', function (ent, m, doc) {
    /* matriz 2D (6 valores a,b,c,d,e,f) -> matriz 4x4 */
    var m4 = m.length === 16 ? m
      : [m[0], m[1], 0, 0, m[2], m[3], 0, 0, 0, 0, 1, 0, m[4], m[5], 0, 1];
    return S.xform(ent, m4, doc);
  });

  wrap('snapPoints', function (ent) {
    return S.snapPoints(ent).map(function (s2) {
      return { type: s2.type, p: s2.p, ent: ent };
    });
  });

  wrap('grips', function (ent) {
    return S.grips(ent).map(function (g, i) { return { p: g, k: 'v' + i }; });
  });

  wrap('moveGrip', function (ent, k, p, doc) {
    if (doc && doc.touch) doc.touch(ent);
    var g = S.grips(ent);
    var i = parseInt(String(k).slice(1), 10) || 0;
    var old = g[i];
    if (!old) return ent;
    if (i === 0) {   /* centro: traslada */
      return S.xform(ent, G3.mTrans(p.x - old.x, p.y - old.y, (p.z || old.z) - old.z), doc);
    }
    /* esquina: escala respecto a la esquina opuesta */
    var b = S.box3(ent);
    var co = G3.boxCorners(b);
    var opp = co[7 - (i - 1)];
    var s2 = {
      x: Math.abs(old.x - opp.x) > 1e-9 ? (p.x - opp.x) / (old.x - opp.x) : 1,
      y: Math.abs(old.y - opp.y) > 1e-9 ? (p.y - opp.y) / (old.y - opp.y) : 1,
      z: 1
    };
    if (!isFinite(s2.x) || Math.abs(s2.x) < 1e-6) s2.x = 1;
    if (!isFinite(s2.y) || Math.abs(s2.y) < 1e-6) s2.y = 1;
    var m = G3.mChain(G3.mTrans(opp), G3.mScale(s2.x, s2.y, 1), G3.mTrans(G3.neg(opp)));
    return S.xform(ent, m, doc);
  });

  wrap('hit', function (ent, p, tol, doc) {
    var b = S.box3(ent);
    if (!b) return false;
    if (p.x < b.x1 - tol || p.x > b.x2 + tol || p.y < b.y1 - tol || p.y > b.y2 + tol) return false;
    var segs = S.segs2d(ent);
    for (var i = 0; i < segs.length; i++)
      if (G.distToSeg(p, segs[i][0], segs[i][1]) <= tol) return true;
    /* relleno: el rayo vertical corta un número impar de aristas de silueta */
    return false;
  });

  wrap('describe', function (ent, doc) {
    var rows = S.describe(ent);
    var L = [(ent.type === 'MESH' ? 'MALLA' : 'SÓLIDO 3D') + '   Capa: ' + ent.layer];
    rows.forEach(function (r) { L.push('  ' + r[0] + ': ' + r[1]); });
    return L;
  });
})();
