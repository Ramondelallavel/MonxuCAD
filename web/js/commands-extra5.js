/* ============================================================
   commands-extra5.js — Superficies malladas clásicas, aplanado,
   primitivas de malla y utilidades de edición y consulta.
   Nomenclatura y flujo de peticiones equivalentes a los de AutoCAD.
   ============================================================ */
(function () {
  'use strict';
  var CAD = window.CAD, G = CAD.G, G3 = CAD.G3, E = CAD.E, Cmd = CAD.Cmd;
  var M = CAD.Mesh, S = CAD.Solid;
  var v3 = G3.v;

  function isKw(v) { return !!(v && v.kw); }
  function pt(v) { return v && v.x !== undefined ? v : null; }
  function num(v) { return typeof v === 'number' && isFinite(v); }

  function addMesh(ctx, mesh, nombre) {
    if (!mesh || !mesh.faces.length) { ctx.err('No se pudo generar la superficie.'); return null; }
    var e = S.mesh(mesh, { layer: ctx.doc.vars.CLAYER });
    ctx.doc.add(e);
    if (ctx.app.is3D) ctx.app.v3dDirty();
    ctx.app.refresh();
    var chk = M.check(mesh);
    ctx.out((nombre || 'Superficie') + ': ' + mesh.faces.length + ' caras, ' +
            mesh.verts.length + ' vértices' + (chk.estanco ? ', estanca' : ''));
    return e;
  }

  /* Puntos 3D de una curva designada */
  function curveOf(ctx, ent) {
    var p = S.profileOf(ent, ctx.doc, 'high');
    if (!p || p.length < 2) return null;
    return p;
  }

  /* Remuestrea una curva a n puntos por longitud de arco */
  function resample(pts, n, closed) {
    return M.resample ? M.resample(pts, n, !!closed) : pts;
  }

  /* ============================================================
     SUPERFICIEREGLA — malla reglada entre dos curvas (RULESURF)
     ============================================================ */
  Cmd.add(['SUPERFICIEREGLA', 'RULESURF', 'SUPREGLA'],
  { group: '3d', icon: 'loft', title: 'Superficie reglada' },
  async function (ctx) {
    var a = await ctx.getEntity('Designe la primera curva de definición'); if (!a) return;
    var b = await ctx.getEntity('Designe la segunda curva de definición'); if (!b) return;
    var c1 = curveOf(ctx, a.ent), c2 = curveOf(ctx, b.ent);
    if (!c1 || !c2) { ctx.err('Las curvas no son válidas.'); return; }
    var cerrada = !!(c1.closed && c2.closed);
    var n = Math.max(ctx.doc.vars.SURFTAB1 || 24, 6);
    var q1 = resample(c1, n, cerrada), q2 = resample(c2, n, cerrada);
    /* si los sentidos son opuestos la superficie sale retorcida */
    if (!cerrada && G3.dist(q1[0], q2[0]) > G3.dist(q1[0], q2[n - 1])) q2 = q2.slice().reverse();
    ctx.doc.mark('SUPERFICIEREGLA');
    var mesh = M.loft([q1, q2], { closedSections: cerrada, caps: false, samples: n });
    addMesh(ctx, mesh, 'Superficie reglada');
  });

  /* ============================================================
     SUPERFICIETAB — malla por traslación de una curva (TABSURF)
     ============================================================ */
  Cmd.add(['SUPERFICIETAB', 'TABSURF', 'SUPTAB'],
  { group: '3d', icon: 'extrude', title: 'Superficie tabulada' },
  async function (ctx) {
    var a = await ctx.getEntity('Designe el objeto para la curva de trayectoria'); if (!a) return;
    var c = curveOf(ctx, a.ent);
    if (!c) { ctx.err('La curva no es válida.'); return; }
    var p1 = await ctx.getPoint('Precise el origen del vector de dirección'); if (!pt(p1)) return;
    var p2 = await ctx.getPoint('Precise el extremo del vector de dirección', { base: p1 }); if (!pt(p2)) return;
    var dir = v3(p2.x - p1.x, p2.y - p1.y, (p2.z || 0) - (p1.z || 0));
    if (G3.len2(dir) < 1e-18) { ctx.err('El vector de dirección es nulo.'); return; }
    ctx.doc.mark('SUPERFICIETAB');
    var b = c.map(function (q) { return G3.add(q, dir); });
    var mesh = M.loft([c.slice(), b], { closedSections: !!c.closed, caps: false });
    addMesh(ctx, mesh, 'Superficie tabulada');
  });

  /* ============================================================
     SUPERFICIEREVOL — malla de revolución (REVSURF)
     ============================================================ */
  Cmd.add(['SUPERFICIEREVOL', 'REVSURF', 'SUPREVOL'],
  { group: '3d', icon: 'revolve', title: 'Superficie de revolución' },
  async function (ctx) {
    var a = await ctx.getEntity('Designe el objeto que se va a revolucionar'); if (!a) return;
    var c = curveOf(ctx, a.ent);
    if (!c) { ctx.err('La curva no es válida.'); return; }
    var e2 = await ctx.getEntity('Designe el objeto que define el eje de revolución', {
      filter: function (x) { return x.type === 'LINE' || x.type === 'LWPOLYLINE'; }
    });
    var ap, ad;
    if (e2 && e2.ent.type === 'LINE') {
      ap = v3(e2.ent.p1.x, e2.ent.p1.y, e2.ent.p1.z || 0);
      ad = G3.sub(v3(e2.ent.p2.x, e2.ent.p2.y, e2.ent.p2.z || 0), ap);
    } else if (e2) {
      var vv = e2.ent.verts;
      if (!vv || vv.length < 2) { ctx.err('El eje no es válido.'); return; }
      ap = v3(vv[0].x, vv[0].y, e2.ent.elev || 0);
      ad = G3.sub(v3(vv[vv.length - 1].x, vv[vv.length - 1].y, e2.ent.elev || 0), ap);
    } else return;
    if (G3.len2(ad) < 1e-18) { ctx.err('El eje es nulo.'); return; }
    var a0 = await ctx.getAngle('Precise el ángulo inicial', { def: 0 });
    if (a0 === null) a0 = 0;
    var ai = await ctx.getAngle('Precise el ángulo incluido (+=antihorario, -=horario)', { def: Math.PI * 2 });
    if (ai === null || Math.abs(ai) < 1e-9) { ctx.err('El ángulo incluido no puede ser nulo.'); return; }
    ctx.doc.mark('SUPERFICIEREVOL');
    var prof = c.slice();
    if (a0) { var m0 = G3.mRotAxis(ap, ad, a0); prof = prof.map(function (q) { return G3.apply(m0, q); }); }
    var seg = Math.max(8, ctx.doc.vars.SURFTAB2 || 32);
    /* REVSURF genera la superficie, no un sólido: sin tapas contra el eje */
    var mesh = M.revolve(prof, ap, ad, ai, seg, !!c.closed, true);
    addMesh(ctx, mesh, 'Superficie de revolución');
  });

  /* ============================================================
     SUPERFICIEARISTA — parche de Coons entre cuatro bordes (EDGESURF)
     ============================================================ */
  Cmd.add(['SUPERFICIEARISTA', 'EDGESURF', 'SUPARISTA'],
  { group: '3d', icon: 'surf', title: 'Superficie de arista' },
  async function (ctx) {
    var bordes = [];
    for (var i = 0; i < 4; i++) {
      var e = await ctx.getEntity('Designe el objeto ' + (i + 1) + ' de los cuatro bordes');
      if (!e) return;
      var c = curveOf(ctx, e.ent);
      if (!c) { ctx.err('El borde ' + (i + 1) + ' no es válido.'); return; }
      bordes.push(c.slice());
    }
    /* se encadenan los cuatro bordes en un circuito cerrado */
    var orden = [bordes[0]], resto = bordes.slice(1);
    function extremo(c) { return c[c.length - 1]; }
    for (var k = 0; k < 3; k++) {
      var fin = extremo(orden[orden.length - 1]);
      var mejor = -1, inv = false, dmin = Infinity;
      for (var j = 0; j < resto.length; j++) {
        var d0 = G3.dist(fin, resto[j][0]);
        var d1 = G3.dist(fin, extremo(resto[j]));
        if (d0 < dmin) { dmin = d0; mejor = j; inv = false; }
        if (d1 < dmin) { dmin = d1; mejor = j; inv = true; }
      }
      if (mejor < 0) { ctx.err('Los bordes no forman un circuito cerrado.'); return; }
      var c2 = resto.splice(mejor, 1)[0];
      orden.push(inv ? c2.slice().reverse() : c2);
    }
    var n = Math.max(6, ctx.doc.vars.SURFTAB1 || 24);
    var m2 = Math.max(6, ctx.doc.vars.SURFTAB2 || 24);
    var C0 = resample(orden[0], n, false);                       /* u: v = 0 */
    var C1 = resample(orden[1], m2, false);                      /* v: u = 1 */
    var C2 = resample(orden[2].slice().reverse(), n, false);     /* u: v = 1 */
    var C3 = resample(orden[3].slice().reverse(), m2, false);    /* v: u = 0 */
    var P00 = C0[0], P10 = C0[n - 1], P11 = C2[n - 1], P01 = C2[0];
    ctx.doc.mark('SUPERFICIEARISTA');
    var verts = [], faces = [], iu, iv;
    for (iv = 0; iv < m2; iv++) {
      var tv = m2 === 1 ? 0 : iv / (m2 - 1);
      for (iu = 0; iu < n; iu++) {
        var tu = n === 1 ? 0 : iu / (n - 1);
        /* interpolación bilineal de Coons */
        var Lu = G3.lerp(C3[iv], C1[iv], tu);
        var Lv = G3.lerp(C0[iu], C2[iu], tv);
        var B = G3.add(
          G3.mul(G3.lerp(G3.lerp(P00, P10, tu), G3.lerp(P01, P11, tu), tv), 1), v3(0, 0, 0));
        verts.push(v3(Lu.x + Lv.x - B.x, Lu.y + Lv.y - B.y, Lu.z + Lv.z - B.z));
      }
    }
    for (iv = 0; iv < m2 - 1; iv++)
      for (iu = 0; iu < n - 1; iu++) {
        var i0 = iv * n + iu;
        faces.push([i0, i0 + 1, i0 + n + 1, i0 + n]);
      }
    addMesh(ctx, M.make(verts, faces), 'Superficie de arista');
  });

  /* ============================================================
     APLANAROBJETOS — proyección 2D del modelo 3D (FLATSHOT)
     ============================================================ */
  Cmd.add(['APLANAROBJETOS', 'FLATSHOT', 'APLANAR'],
  { group: '3d', icon: 'flatshot', title: 'Aplanar objetos' },
  async function (ctx) {
    var sel = await ctx.getSelection('Designe los sólidos que se van a aplanar');
    if (!sel || !sel.length) return;
    var sol = sel.filter(function (e) { return S.is3D(e); });
    if (!sol.length) { ctx.err('No hay ningún sólido ni malla en la designación.'); return; }
    var k = await ctx.getKeyword('Precise la dirección de proyección',
      ['Planta', 'Alzado', 'Perfil', 'Vista actual'], { def: 'Planta' });
    var kw = k && k.kw, eye;
    if (kw === 'A') eye = v3(0, -1, 0);
    else if (kw === 'P' && k.keyword === 'Perfil') eye = v3(1, 0, 0);
    else if (kw === 'V') {
      var v = ctx.app.view3d && ctx.app.view3d.eyeDir ? ctx.app.view3d.eyeDir() : null;
      eye = v || v3(0, 0, 1);
    } else eye = v3(0, 0, 1);
    var base = await ctx.getPoint('Precise el punto de inserción del dibujo plano', { def: { x: 0, y: 0 } });
    if (!pt(base)) base = { x: 0, y: 0 };
    ctx.doc.mark('APLANAROBJETOS');
    var creadas = 0;
    /* base ortonormal de la proyección */
    var z = G3.norm(eye), x = G3.perp(z), y = G3.cross(z, x);
    sol.forEach(function (ent) {
      var mesh = S.meshOf(ent);
      if (!mesh) return;
      var sil = M.silhouette(mesh, z, false);
      sil.forEach(function (ed) {
        var a = mesh.verts[ed[0]], b = mesh.verts[ed[1]];
        var pa = { x: base.x + G3.dot(a, x), y: base.y + G3.dot(a, y) };
        var pb = { x: base.x + G3.dot(b, x), y: base.y + G3.dot(b, y) };
        if (G.dist(pa, pb) < 1e-9) return;
        ctx.doc.add(E.line(pa, pb, { layer: ctx.doc.vars.CLAYER }));
        creadas++;
      });
    });
    ctx.app.refresh(true);
    ctx.out(creadas + ' línea(s) generadas a partir de ' + sol.length + ' objeto(s).');
  });

  /* ============================================================
     MALLA — primitivas de malla (MESH)
     ============================================================ */
  Cmd.add(['MALLA', 'MESH', 'MALLAPRIM'],
  { group: '3d', icon: 'mesh', title: 'Primitiva de malla' },
  async function (ctx) {
    var k = await ctx.getKeyword('Precise una opción',
      ['Caja', 'Cono', 'CIlindro', 'Pirámide', 'Esfera', 'Cuña', 'Toroide'], { def: 'Caja' });
    if (!k) return;
    var c = await ctx.getPoint('Precise el centro de la base'); if (!pt(c)) return;
    var n = ctx.doc.vars.FACETRES ? Math.max(8, Math.round(ctx.doc.vars.FACETRES * 8)) : 16;
    var mesh = null, nombre = k.keyword;
    var kw = k.kw;
    if (kw === 'C' && k.keyword === 'Caja') {
      var l = await ctx.getDist('Precise la longitud', { base: c }); if (!num(l)) return;
      var w = await ctx.getDist('Precise la anchura', { base: c }); if (!num(w)) return;
      var h = await ctx.getDist('Precise la altura', { base: c }); if (!num(h)) return;
      mesh = M.box(l, w, h, true);
    } else if (kw === 'C' && k.keyword === 'Cono') {
      var rc = await ctx.getDist('Precise el radio de la base', { base: c }); if (!num(rc)) return;
      var hc = await ctx.getDist('Precise la altura', { base: c }); if (!num(hc)) return;
      mesh = M.cone(rc, hc, n);
    } else if (kw === 'CI') {
      var ri = await ctx.getDist('Precise el radio de la base', { base: c }); if (!num(ri)) return;
      var hi = await ctx.getDist('Precise la altura', { base: c }); if (!num(hi)) return;
      mesh = M.cylinder(ri, hi, n);
    } else if (kw === 'P') {
      var rp = await ctx.getDist('Precise el radio de la base', { base: c }); if (!num(rp)) return;
      var hp = await ctx.getDist('Precise la altura', { base: c }); if (!num(hp)) return;
      var lados = await ctx.getInt('Precise el número de lados', { def: 4 }); if (!num(lados)) lados = 4;
      mesh = M.pyramid(rp, hp, Math.max(3, lados));
    } else if (kw === 'E') {
      var re = await ctx.getDist('Precise el radio', { base: c }); if (!num(re)) return;
      mesh = M.sphere(re, n);
    } else if (kw === 'CU') {
      var lw = await ctx.getDist('Precise la longitud', { base: c }); if (!num(lw)) return;
      var ww = await ctx.getDist('Precise la anchura', { base: c }); if (!num(ww)) return;
      var hw = await ctx.getDist('Precise la altura', { base: c }); if (!num(hw)) return;
      mesh = M.wedge(lw, ww, hw, true);
    } else if (kw === 'T') {
      var RR = await ctx.getDist('Precise el radio del toroide', { base: c }); if (!num(RR)) return;
      var rr = await ctx.getDist('Precise el radio del tubo', { base: c }); if (!num(rr)) return;
      mesh = M.torus(RR, rr, n, Math.max(8, n / 2));
    }
    if (!mesh) { ctx.err('Opción no válida.'); return; }
    mesh = mesh.clone().transform(G3.mTrans(c.x, c.y, c.z || ctx.doc.vars.ELEVATION || 0));
    ctx.doc.mark('MALLA');
    addMesh(ctx, mesh, 'Malla de tipo ' + nombre);
  });

  /* ============================================================
     BUSCAR — buscar y reemplazar texto (FIND)
     ============================================================ */
  Cmd.add(['BUSCAR', 'FIND', 'BUSCARTEXTO'],
  { group: 'annot', icon: 'find', title: 'Buscar y reemplazar' },
  async function (ctx) {
    var q = await ctx.getString('Indique el texto que desea buscar');
    if (!q) return;
    var rep = await ctx.getString('Indique el texto de sustitución o <sólo buscar>', { allowNone: true });
    var doc = ctx.doc;
    var enc = [];
    function textoDe(e) {
      if (e.type === 'TEXT' || e.type === 'MTEXT') return e.s !== undefined ? e.s : e.text;
      if (e.type === 'DIMENSION') return e.text;
      if (e.type === 'LEADER') return e.text;
      return null;
    }
    function ponTexto(e, s) {
      if (e.s !== undefined) e.s = s; else e.text = s;
    }
    var ql = String(q).toLowerCase();
    doc.entities.forEach(function (e) {
      var t = textoDe(e);
      if (typeof t === 'string' && t.toLowerCase().indexOf(ql) >= 0) enc.push(e);
      if (e.type === 'INSERT' && e.attribs) {
        e.attribs.forEach(function (at) {
          if (String(at.value || '').toLowerCase().indexOf(ql) >= 0) enc.push(e);
        });
      }
    });
    if (!enc.length) { ctx.out('No se ha encontrado "' + q + '".'); return; }
    if (rep === null || rep === undefined) {
      ctx.app.selSet = enc.slice();
      ctx.app.refresh(true);
      ctx.out(enc.length + ' objeto(s) contienen "' + q + '".  Quedan designados.');
      return;
    }
    ctx.doc.mark('BUSCAR');
    var n = 0;
    var re = new RegExp(String(q).replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi');
    enc.forEach(function (e) {
      var t = textoDe(e);
      if (typeof t === 'string') { doc.touch(e); ponTexto(e, t.replace(re, rep)); n++; }
      if (e.type === 'INSERT' && e.attribs) {
        doc.touch(e);
        e.attribs.forEach(function (at) {
          if (String(at.value || '').match(re)) { at.value = String(at.value).replace(re, rep); n++; }
        });
      }
    });
    ctx.app.refresh(true);
    ctx.out(n + ' sustitución(es) de "' + q + '" por "' + rep + '".');
  });

  /* ============================================================
     TEXTOALFRENTE — trae las anotaciones al frente (TEXTTOFRONT)
     ============================================================ */
  Cmd.add(['TEXTOALFRENTE', 'TEXTTOFRONT'],
  { group: 'annot', icon: 'order', title: 'Texto al frente' },
  async function (ctx) {
    var k = await ctx.getKeyword('Traer al frente', ['Texto', 'Cotas', 'Directrices', 'Todo'], { def: 'Todo' });
    var kw = k && k.kw;
    var quiere = {
      T: ['TEXT', 'MTEXT'], C: ['DIMENSION'], D: ['LEADER'],
      TO: ['TEXT', 'MTEXT', 'DIMENSION', 'LEADER']
    }[kw] || ['TEXT', 'MTEXT', 'DIMENSION', 'LEADER'];
    var lista = ctx.doc.ents();
    var mover = lista.filter(function (e) { return quiere.indexOf(e.type) >= 0; });
    if (!mover.length) { ctx.out('No hay nada que traer al frente.'); return; }
    ctx.doc.mark('TEXTOALFRENTE');
    ctx.doc.touchOrder(lista);
    mover.forEach(function (e) {
      var i = lista.indexOf(e);
      if (i >= 0) { lista.splice(i, 1); lista.push(e); }
    });
    ctx.doc.rev++;
    ctx.app.refresh(true);
    ctx.out(mover.length + ' objeto(s) traídos al frente.');
  });

  /* ============================================================
     RECORRERCAPAS — muestra las capas una a una (LAYWALK)
     ============================================================ */
  Cmd.add(['RECORRERCAPAS', 'LAYWALK'],
  { group: 'layer', icon: 'layer', title: 'Recorrer capas' },
  async function (ctx) {
    var doc = ctx.doc;
    var capas = doc.layerList();
    var nombres = capas.map(function (l) { return l.name; });
    if (!nombres.length) { ctx.err('El dibujo no tiene capas.'); return; }
    var guardado = capas.map(function (l) { return { n: l.name, on: l.on !== false, frozen: !!l.frozen }; });
    var i = 0;
    while (true) {
      var cur = nombres[i];
      capas.forEach(function (l) { l.on = l.name === cur; });
      doc.rev++;
      ctx.app.refresh(true);
      var k = await ctx.getKeyword('Capa "' + cur + '" (' + (i + 1) + '/' + nombres.length +
        ').  Indique una opción', ['Siguiente', 'Anterior', 'Fijar', 'Salir'], { def: 'Siguiente' });
      var kw = k && k.kw;
      if (!k || kw === 'S' && k.keyword === 'Salir') break;
      if (kw === 'F') {
        doc.vars.CLAYER = cur;
        guardado.forEach(function (g) {
          var l = doc.layers[g.n];
          if (l) { l.on = g.on; l.frozen = g.frozen; }
        });
        doc.rev++; ctx.app.refresh(true);
        ctx.out('Capa actual: ' + cur);
        return;
      }
      if (kw === 'A') i = (i - 1 + nombres.length) % nombres.length;
      else i = (i + 1) % nombres.length;
    }
    guardado.forEach(function (g) {
      var l = doc.layers[g.n];
      if (l) { l.on = g.on; l.frozen = g.frozen; }
    });
    doc.rev++;
    ctx.app.refresh(true);
    ctx.out('Se ha restablecido el estado de las capas.');
  });

  /* ============================================================
     ACOTASALTO — símbolo de salto en una cota de radio (DIMJOGLINE)
     ============================================================ */
  Cmd.add(['ACOTASALTO', 'DIMJOGLINE', 'COTASALTO'],
  { group: 'annot', icon: 'dimrad', title: 'Salto en cota' },
  async function (ctx) {
    var e = await ctx.getEntity('Designe la cota a la que añadir el salto', {
      filter: function (x) { return x.type === 'DIMENSION'; }
    });
    if (!e) return;
    var d = e.ent;
    var p = await ctx.getPoint('Precise la posición del salto o <centro>', { allowNone: true });
    ctx.doc.mark('ACOTASALTO');
    ctx.doc.touch(d);
    if (p && p.x !== undefined) d.jog = { x: p.x, y: p.y };
    else {
      var a = d.p1 || d.def1, b = d.p2 || d.def2 || d.txtPos;
      d.jog = (a && b) ? G.mid(a, b) : null;
    }
    ctx.app.refresh(true);
    ctx.out(d.jog ? 'Salto añadido a la cota.' : 'No se pudo situar el salto.');
  });

  /* ============================================================
     TRAZO — trazo de anchura constante (TRACE)
     ============================================================ */
  Cmd.add(['TRAZO', 'TRACE'],
  { group: 'draw', icon: 'pline', title: 'Trazo' },
  async function (ctx) {
    var w = await ctx.getDist('Precise la anchura del trazo', { def: ctx.doc.vars.TRACEWID || 1 });
    if (!num(w) || w <= 0) return;
    ctx.doc.vars.TRACEWID = w;
    var p1 = await ctx.getPoint('Precise el punto inicial'); if (!pt(p1)) return;
    ctx.doc.mark('TRAZO');
    var prev = p1, n = 0;
    while (true) {
      var p2 = await ctx.getPoint('Precise el punto siguiente', {
        base: prev, rubber: 'line', allowNone: true
      });
      if (!pt(p2)) break;
      ctx.doc.add(E.pline([{ x: prev.x, y: prev.y, sw: w, ew: w },
                           { x: p2.x, y: p2.y, sw: w, ew: w }], false,
                          { layer: ctx.doc.vars.CLAYER }));
      n++;
      prev = p2;
      ctx.app.refresh();
    }
    ctx.app.refresh(true);
    ctx.out(n + ' trazo(s) de anchura ' + G.fmt(w, 4) + '.');
  });

  /* ============================================================
     SUSTITUIRBLOQUE — cambia todas las referencias de un bloque
     ============================================================ */
  Cmd.add(['SUSTITUIRBLOQUE', 'BLOCKREPLACE', 'CAMBIABLOQUE'],
  { group: 'block', icon: 'block', title: 'Sustituir bloque' },
  async function (ctx) {
    var doc = ctx.doc;
    var nombres = Object.keys(doc.blocks || {});
    if (nombres.length < 2) { ctx.err('Hacen falta al menos dos bloques definidos.'); return; }
    var viejo = await ctx.getString('Indique el bloque que se va a sustituir');
    if (!viejo || !doc.blocks[viejo.toUpperCase()] && !doc.blocks[viejo]) {
      ctx.err('No existe el bloque "' + viejo + '".'); return;
    }
    var nuevo = await ctx.getString('Indique el bloque que lo sustituye');
    if (!nuevo || !doc.blocks[nuevo.toUpperCase()] && !doc.blocks[nuevo]) {
      ctx.err('No existe el bloque "' + nuevo + '".'); return;
    }
    var kA = doc.blocks[viejo] ? viejo : viejo.toUpperCase();
    var kB = doc.blocks[nuevo] ? nuevo : nuevo.toUpperCase();
    ctx.doc.mark('SUSTITUIRBLOQUE');
    var n = 0;
    doc.entities.forEach(function (e) {
      if (e.type === 'INSERT' && e.name === kA) { doc.touch(e); e.name = kB; n++; }
    });
    doc.rev++;
    ctx.app.refresh(true);
    ctx.out(n + ' referencia(s) de "' + kA + '" sustituidas por "' + kB + '".');
  });

  /* ============================================================
     EDITSPLINE — edición de una spline (SPLINEDIT)
     ============================================================ */
  Cmd.add(['EDITSPLINE', 'SPLINEDIT', 'EDITSPL'],
  { group: 'modify', icon: 'spline', title: 'Editar spline' },
  async function (ctx) {
    var e = await ctx.getEntity('Designe la spline', {
      filter: function (x) { return x.type === 'SPLINE'; }
    });
    if (!e) return;
    var sp = e.ent;
    while (true) {
      var k = await ctx.getKeyword('Indique una opción',
        ['Cerrar', 'Abrir', 'Precisión', 'Invertir', 'Convertir en polilínea', 'salir'], { def: 'salir' });
      var kw = k && k.kw;
      if (!k || kw === 'S') break;
      if (kw === 'C' && k.keyword === 'Cerrar') {
        if (sp.closed) { ctx.out('La spline ya está cerrada.'); continue; }
        ctx.doc.mark('EDITSPLINE'); ctx.doc.touch(sp); sp.closed = true;
      } else if (kw === 'A') {
        if (!sp.closed) { ctx.out('La spline ya está abierta.'); continue; }
        ctx.doc.mark('EDITSPLINE'); ctx.doc.touch(sp); sp.closed = false;
      } else if (kw === 'P') {
        var n = await ctx.getInt('Precise el número de segmentos por tramo', { def: sp.seg || 16 });
        if (!num(n)) continue;
        ctx.doc.mark('EDITSPLINE'); ctx.doc.touch(sp); sp.seg = Math.max(2, Math.min(200, n));
      } else if (kw === 'I') {
        ctx.doc.mark('EDITSPLINE'); ctx.doc.touch(sp);
        sp.pts = (sp.pts || sp.fit || []).slice().reverse();
        if (sp.fit) sp.fit = sp.fit.slice().reverse();
      } else if (kw === 'CE') {
        var pts = S.profileOf(sp, ctx.doc, 'high');
        if (!pts || pts.length < 2) { ctx.err('No se pudo convertir.'); continue; }
        ctx.doc.mark('EDITSPLINE');
        var pl = E.pline(pts.map(function (q) { return { x: q.x, y: q.y }; }), !!sp.closed,
                         { layer: sp.layer, color: sp.color, ltype: sp.ltype, lw: sp.lw });
        ctx.doc.add(pl);
        ctx.doc.remove(sp);
        ctx.app.refresh(true);
        ctx.out('Spline convertida en polilínea de ' + pts.length + ' vértices.');
        return;
      }
      ctx.app.refresh(true);
    }
    ctx.out('EDITSPLINE terminado.');
  });

  /* ============================================================
     RECUPERAR — repara y abre el dibujo actual (RECOVER)
     ============================================================ */
  Cmd.add(['RECUPERAR', 'RECOVER', 'REPARAR'],
  { group: 'file', icon: 'audit', title: 'Recuperar dibujo' },
  async function (ctx) {
    var doc = ctx.doc, malas = [], i;
    var lista = doc.entities.slice();
    function finito(p) { return p && isFinite(p.x) && isFinite(p.y) && (p.z === undefined || isFinite(p.z)); }
    lista.forEach(function (e) {
      var mal = false;
      if (!e.type) mal = true;
      else {
        var ex = E.extents(e, doc);
        if (ex && (!isFinite(ex.x1) || !isFinite(ex.y1) || !isFinite(ex.x2) || !isFinite(ex.y2))) mal = true;
        if (e.p1 && !finito(e.p1)) mal = true;
        if (e.p2 && !finito(e.p2)) mal = true;
        if (e.c && !finito(e.c)) mal = true;
        if (e.r !== undefined && !isFinite(e.r)) mal = true;
        if (e.verts && e.verts.some(function (v) { return !finito(v); })) mal = true;
      }
      if (mal) malas.push(e);
    });
    /* capas huérfanas */
    var capas = doc.layers;
    var huerfanas = 0;
    doc.entities.forEach(function (e) {
      if (e.layer && !capas[e.layer]) { e.layer = '0'; huerfanas++; }
    });
    if (!malas.length && !huerfanas) {
      ctx.out('No se han encontrado errores.  ' + doc.entities.length + ' objeto(s) revisados.');
      return;
    }
    ctx.doc.mark('RECUPERAR');
    malas.forEach(function (e) { doc.remove(e); });
    doc.rev++;
    ctx.app.refresh(true);
    ctx.out('Recuperación terminada: ' + malas.length + ' objeto(s) dañados eliminados, ' +
            huerfanas + ' referencia(s) a capas inexistentes corregidas.');
  });

  /* ============================================================
     PERFILSOLIDO2D — vistas ortográficas planas de un sólido
     ============================================================ */
  Cmd.add(['VISTAS2D', 'SOLVIEW2D', 'TRESVISTAS'],
  { group: '3d', icon: 'flatshot', title: 'Tres vistas del sólido' },
  async function (ctx) {
    var sel = await ctx.getSelection('Designe los sólidos');
    if (!sel || !sel.length) return;
    var sol = sel.filter(function (e) { return S.is3D(e); });
    if (!sol.length) { ctx.err('No hay ningún sólido en la designación.'); return; }
    var base = await ctx.getPoint('Precise el punto de inserción de la planta');
    if (!pt(base)) return;
    var sep = await ctx.getDist('Precise la separación entre vistas', { def: null, base: base });
    ctx.doc.mark('VISTAS2D');
    /* extensión conjunta para repartir las vistas */
    var bb = null;
    sol.forEach(function (e) {
      var m = S.meshOf(e); if (!m) return;
      var b = m.bbox();
      bb = bb ? { x1: Math.min(bb.x1, b.x1), y1: Math.min(bb.y1, b.y1), z1: Math.min(bb.z1, b.z1),
                  x2: Math.max(bb.x2, b.x2), y2: Math.max(bb.y2, b.y2), z2: Math.max(bb.z2, b.z2) } : b;
    });
    if (!bb) { ctx.err('No se pudo calcular la extensión.'); return; }
    var dx = bb.x2 - bb.x1, dy = bb.y2 - bb.y1, dz = bb.z2 - bb.z1;
    var cx = (bb.x1 + bb.x2) / 2, cy = (bb.y1 + bb.y2) / 2, cz = (bb.z1 + bb.z2) / 2;
    var d = num(sep) && sep > 0 ? sep : Math.max(dx, dy, dz) * 0.35 + 1;
    /* Los ejes de cada vista son los de la norma, no una perpendicular
       cualquiera: con G3.perp el alzado y el perfil salían girados y de
       un tamaño que no era el de la pieza.  Y las vistas van alineadas:
       el alzado debajo de la planta compartiendo la X, y el perfil a la
       derecha del alzado compartiendo la altura. */
    var bajada = (dy + dz) / 2 + d;
    var vistas = [
      { n: 'Planta', z: v3(0, 0, 1),  x: v3(1, 0, 0), y: v3(0, 1, 0),
        cu: cx, cv: cy, o: { x: 0, y: 0 } },
      { n: 'Alzado', z: v3(0, -1, 0), x: v3(1, 0, 0), y: v3(0, 0, 1),
        cu: cx, cv: cz, o: { x: 0, y: -bajada } },
      { n: 'Perfil', z: v3(1, 0, 0),  x: v3(0, 1, 0), y: v3(0, 0, 1),
        cu: cy, cv: cz, o: { x: (dx + dy) / 2 + d, y: -bajada } }
    ];
    var total = 0;
    vistas.forEach(function (v) {
      var hechas = {};
      sol.forEach(function (ent) {
        var mesh = S.meshOf(ent); if (!mesh) return;
        M.silhouette(mesh, v.z, false).forEach(function (ed) {
          var a = mesh.verts[ed[0]], b = mesh.verts[ed[1]];
          var pa = { x: base.x + v.o.x + G3.dot(a, v.x) - v.cu,
                     y: base.y + v.o.y + G3.dot(a, v.y) - v.cv };
          var pb = { x: base.x + v.o.x + G3.dot(b, v.x) - v.cu,
                     y: base.y + v.o.y + G3.dot(b, v.y) - v.cv };
          if (G.dist(pa, pb) < 1e-9) return;
          /* al proyectar, muchas aristas caen una encima de otra */
          var k1 = pa.x.toFixed(5) + ',' + pa.y.toFixed(5);
          var k2 = pb.x.toFixed(5) + ',' + pb.y.toFixed(5);
          var k = k1 < k2 ? k1 + '|' + k2 : k2 + '|' + k1;
          if (hechas[k]) return;
          hechas[k] = 1;
          ctx.doc.add(E.line(pa, pb, { layer: ctx.doc.vars.CLAYER }));
          total++;
        });
      });
    });
    ctx.app.refresh(true);
    ctx.out('Planta, alzado y perfil generados: ' + total + ' líneas.');
  });

})();
