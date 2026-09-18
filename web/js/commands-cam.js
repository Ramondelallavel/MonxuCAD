/* ============================================================
   commands-cam.js — Comandos de exportación 3D y de fabricación
   Exportación a formatos de impresión 3D e intercambio, y el
   módulo de CAM: definición de bruto, operaciones de fresado y
   de torneado, simulación y postprocesado a código G.
   ============================================================ */
(function () {
  'use strict';
  var CAD = window.CAD, G = CAD.G, G3 = CAD.G3, E = CAD.E, Cmd = CAD.Cmd;
  var M = CAD.Mesh, S = CAD.Solid, CAM = CAD.CAM, P = CAD.Post, X3 = CAD.Export3D;
  var v3 = G3.v;

  function isKw(v) { return !!(v && v.kw); }
  function pt(v) { return v && v.x !== undefined ? v : null; }
  /* Predicado: 0 es un valor válido, así que nunca se devuelve el número. */
  function num(v) { return typeof v === 'number' && isFinite(v); }
  function kwOf(v) { return v && v.kw ? v.kw : null; }

  async function pick3D(ctx, msg) {
    var sel = await ctx.getSelection(msg || 'Designe sólidos');
    if (!sel) return null;
    var out = sel.filter(S.is3D);
    if (!out.length) { ctx.err('No se han designado sólidos ni mallas.'); return null; }
    return out;
  }
  function baseName(ctx) {
    return (ctx.doc.name || 'Pieza').replace(/\.[^.]+$/, '');
  }

  /* ============================================================
     EXPORTACIÓN 3D
     ============================================================ */
  var FORMATS = {
    STL:   { ext: 'stl',   label: 'STL (impresión 3D)',           bin: true },
    OBJ:   { ext: 'obj',   label: 'Wavefront OBJ + MTL' },
    PLY:   { ext: 'ply',   label: 'Stanford PLY',                 bin: true },
    '3MF': { ext: '3mf',   label: '3MF (fabricación aditiva)' },
    GLTF:  { ext: 'gltf',  label: 'glTF 2.0' },
    GLB:   { ext: 'glb',   label: 'glTF binario (GLB)' },
    OFF:   { ext: 'off',   label: 'OFF (Object File Format)' },
    AMF:   { ext: 'amf',   label: 'AMF' },
    VRML:  { ext: 'wrl',   label: 'VRML 2.0' },
    X3D:   { ext: 'x3d',   label: 'X3D' }
  };

  Cmd.add(['EXPORTA3D', 'EXPORT3D', '3DEXPORT'], { group: 'output', icon: 'export3d', title: 'Exportar modelo 3D' },
  async function (ctx, args) {
    var sel = await pick3D(ctx, 'Designe sólidos a exportar (Intro = todos)');
    if (!sel) {
      sel = ctx.doc.ents().filter(S.is3D);
      if (!sel.length) { ctx.err('El dibujo no contiene sólidos 3D.'); return; }
    }
    var keys = Object.keys(FORMATS);
    var fmt = args && args[0] ? String(args[0]).toUpperCase() : null;
    if (!fmt) {
      var rf = await ctx.getKeyword('Formato de salida', keys, { def: 'STL' });
      if (!rf) return;
      fmt = String(rf.keyword || rf.kw).toUpperCase();
    }
    if (!fmt || !FORMATS[fmt]) { ctx.err('Formato desconocido.'); return; }
    var def = FORMATS[fmt];
    var bin = false;
    if (def.bin) {
      var k = await ctx.getKeyword('Codificación', ['Binario', 'Texto'], { def: 'Binario' });
      if (!k) return;
      bin = (k.kw === 'B');
    }
    var parts = X3.collect(sel, ctx.doc, ctx.app);
    if (!parts.length) { ctx.err('Nada que exportar.'); return; }
    var name = baseName(ctx);
    var tris = parts.reduce(function (s, p) { return s + p.mesh.triangles().length; }, 0);
    ctx.out('Exportando ' + parts.length + ' sólido(s), ' + tris + ' triángulos…');

    var data, fn = name + '.' + def.ext;
    switch (fmt) {
      case 'STL': data = bin ? X3.stlBinary(parts, name) : X3.stlAscii(parts, name); break;
      case 'OBJ':
        await CAD.Exporter.saveFile(ctx.app, name + '.mtl', X3.mtl(parts), 'text');
        data = X3.obj(parts, name); break;
      case 'PLY': data = X3.ply(parts, bin); break;
      case '3MF': data = CAD.Exporter.zip(X3.files3mf(parts)); fn = name + '.3mf'; break;
      case 'GLTF': data = X3.gltf(parts, name, false); break;
      case 'GLB': data = X3.gltf(parts, name, true); break;
      case 'OFF': data = X3.off(parts); break;
      case 'AMF': data = X3.amf(parts); break;
      case 'VRML': data = X3.wrl(parts); break;
      case 'X3D': data = X3.x3d(parts); break;
    }
    if (data === undefined) { ctx.err('No se ha podido generar el archivo.'); return; }
    await CAD.Exporter.saveFile(ctx.app, fn, data, typeof data === 'string' ? 'text' : 'bin');
    var size = typeof data === 'string' ? data.length : data.byteLength;
    ctx.out(def.label + ': ' + fn + '   ' + (size / 1024).toFixed(1) + ' kB');
  });

  Cmd.add(['IMPORTA3D', 'IMPORT3D'], { group: 'insert', icon: 'import3d', title: 'Importar modelo 3D' },
  async function (ctx) {
    var file = await ctx.app.ui.pickFile('.stl,.obj,.ply,.off');
    if (!file) return;
    var name = (file.name || '').toLowerCase();
    var mesh = null;
    try {
      if (/\.stl$/.test(name)) mesh = X3.readStl(await file.arrayBuffer());
      else if (/\.obj$/.test(name)) mesh = X3.readObj(await file.text());
      else if (/\.ply$/.test(name)) mesh = X3.readPly(await file.text());
      else if (/\.off$/.test(name)) mesh = readOff(await file.text());
    } catch (err) { ctx.err('Error al leer el archivo: ' + err.message); return; }
    if (!mesh || !mesh.faces.length) { ctx.err('No se ha podido interpretar el archivo.'); return; }
    ctx.doc.mark('IMPORTA3D');
    var e = S.fromMesh(mesh, { layer: ctx.doc.vars.CLAYER });
    e.name = file.name;
    ctx.doc.add(e);
    ctx.app.set3D(true);
    ctx.app.zoom3dExtents();
    ctx.app.refresh(true);
    var chk = M.check(mesh);
    ctx.out('Importado ' + file.name + ': ' + mesh.faces.length + ' caras, ' +
            mesh.verts.length + ' vértices' + (chk.estanco ? ', estanco.' : ', malla abierta.'));
  });

  function readOff(txt) {
    var L = txt.split('\n').map(function (s) { return s.trim(); }).filter(function (s) { return s && s[0] !== '#'; });
    if (!/^OFF/.test(L[0])) return null;
    var hdr = (L[0] === 'OFF' ? L[1] : L[0].slice(3)).trim().split(/\s+/);
    var start = (L[0] === 'OFF' ? 2 : 1);
    var nv = +hdr[0], nf = +hdr[1];
    var mesh = new M.Mesh([], []), i;
    for (i = 0; i < nv; i++) {
      var p = L[start + i].split(/\s+/);
      mesh.verts.push(v3(+p[0], +p[1], +p[2]));
    }
    for (i = 0; i < nf; i++) {
      var q = L[start + nv + i].split(/\s+/);
      var n = +q[0], f = [];
      for (var k = 1; k <= n; k++) f.push(+q[k]);
      if (f.length >= 3) mesh.faces.push(f);
    }
    return mesh.clean();
  }

  /* ============================================================
     CAM — estado del proyecto
     ============================================================ */
  function camState(app) {
    if (!app.cam) {
      app.cam = {
        tools: CAM.defaultTools(),
        paths: [],
        post: 'fanuc',
        material: 'Acero S235',
        stock: null,          /* {x1,y1,z1,x2,y2,z2} */
        clearance: 25,
        program: '1000',
        lathe: false,
        diameterMode: true,
        maxRpm: 12000
      };
    }
    return app.cam;
  }
  CAD.camState = camState;

  async function pickTool(ctx, filterClass, msg) {
    var st = camState(ctx.app);
    var list = st.tools.filter(function (t) {
      if (!filterClass) return true;
      return (CAM.TOOLTYPES[t.type] || {}).c === filterClass;
    });
    if (!list.length) { ctx.err('No hay herramientas de ese tipo en la biblioteca.'); return null; }
    ctx.out('Herramientas disponibles:');
    list.forEach(function (t) {
      ctx.out('   T' + t.num + '  ' + t.name + '  Ø' + G.fmt(t.d, 3) +
              '  vc ' + t.vc + ' m/min  fz ' + t.fz);
    });
    var n = await ctx.getReal(msg || 'Introduzca el número de herramienta', { def: list[0].num });
    if (!num(n)) return null;
    for (var i = 0; i < st.tools.length; i++) if (st.tools[i].num === Math.round(n)) return st.tools[i];
    ctx.err('Herramienta T' + Math.round(n) + ' no encontrada.');
    return null;
  }

  /* Ajusta las condiciones de corte al material seleccionado */
  function matTool(tool, material) {
    var f = CAM.MATERIALS[material];
    if (!f) return tool;
    var t = Object.assign({}, tool);
    t.vc = tool.vc * f.vc;
    t.fz = tool.fz * f.fz;
    return t;
  }

  /* Obtiene los contornos 2D de la selección */
  function loopsOf(ctx, sel) {
    var out = [];
    for (var i = 0; i < sel.length; i++) {
      var pr = S.profileOf(sel[i], ctx.doc, 'high');
      if (!pr || pr.length < 2) continue;
      var flat = pr.map(function (p) { return { x: p.x, y: p.y }; });
      flat.closed = pr.closed;
      out.push(flat);
    }
    return out;
  }

  /* ============================================================
     CAMBRUTO — define el material de partida
     ============================================================ */
  Cmd.add(['CAMBRUTO', 'CAMSTOCK'], { group: 'cam', icon: 'stock', title: 'Definir material bruto' },
  async function (ctx) {
    var st = camState(ctx.app);
    var k0 = await ctx.getKeyword('Definir bruto', ['Caja', 'Automático', 'Cilindro'], { def: 'Automático' });
    if (!k0) return;
    var k = k0.kw;
    if (k === 'A') {
      var sel = ctx.doc.ents().filter(S.is3D);
      if (!sel.length) { ctx.err('No hay sólidos en el dibujo.'); return; }
      var b = null;
      sel.forEach(function (e) { b = G3.boxMerge(b, S.box3(e)); });
      var m = await ctx.getDist('Sobremedida del bruto', { def: 1 });
      if (!num(m)) m = 1;
      st.stock = { x1: b.x1 - m, y1: b.y1 - m, z1: b.z1 - m, x2: b.x2 + m, y2: b.y2 + m, z2: b.z2 + m };
    } else if (k === 'C') {
      var c = await ctx.getPoint('Precise el centro del bruto cilíndrico'); if (!pt(c)) return;
      var r = await ctx.getDist('Precise el radio', { base: c }); if (!num(r)) return;
      var h = await ctx.getDist('Precise la altura'); if (!num(h)) return;
      st.stock = { x1: c.x - r, y1: c.y - r, z1: 0, x2: c.x + r, y2: c.y + r, z2: h, cyl: { c: c, r: r, h: h } };
    } else {
      var p1 = await ctx.getPoint('Precise primera esquina del bruto'); if (!pt(p1)) return;
      var p2 = await ctx.getPoint('Precise esquina opuesta', { base: p1 }); if (!pt(p2)) return;
      var z1 = await ctx.getDist('Precise Z inferior', { def: -20 }); if (!num(z1)) return;
      var z2 = await ctx.getDist('Precise Z superior', { def: 0 }); if (!num(z2)) return;
      st.stock = { x1: Math.min(p1.x, p2.x), y1: Math.min(p1.y, p2.y), z1: Math.min(z1, z2),
                   x2: Math.max(p1.x, p2.x), y2: Math.max(p1.y, p2.y), z2: Math.max(z1, z2) };
    }
    var s = st.stock;
    ctx.out('Bruto: ' + G.fmt(s.x2 - s.x1, 3) + ' × ' + G.fmt(s.y2 - s.y1, 3) + ' × ' +
            G.fmt(s.z2 - s.z1, 3) + '  (X ' + G.fmt(s.x1, 2) + '…' + G.fmt(s.x2, 2) +
            ', Y ' + G.fmt(s.y1, 2) + '…' + G.fmt(s.y2, 2) + ', Z ' + G.fmt(s.z1, 2) + '…' + G.fmt(s.z2, 2) + ')');
    var f = CAM.MATERIALS[st.material];
    if (f) {
      var vol = (s.x2 - s.x1) * (s.y2 - s.y1) * (s.z2 - s.z1);
      ctx.out('Masa del bruto (' + st.material + '): ' + G.fmt(vol * f.dens, 1) + ' g');
    }
  });

  Cmd.add(['CAMMATERIAL'], { group: 'cam', icon: 'material', title: 'Material de la pieza' },
  async function (ctx) {
    var st = camState(ctx.app);
    var names = Object.keys(CAM.MATERIALS);
    ctx.out('Materiales: ' + names.join(', '));
    var s = await ctx.getString('Introduzca el material', { def: st.material });
    if (!s) return;
    var found = names.filter(function (n) { return n.toLowerCase().indexOf(String(s).toLowerCase()) === 0; })[0];
    if (!found) { ctx.err('Material desconocido.'); return; }
    st.material = found;
    var f = CAM.MATERIALS[found];
    ctx.out('Material: ' + found + '   factor vc ×' + f.vc + '   factor fz ×' + f.fz +
            '   densidad ' + f.dens + ' g/mm³');
  });

  /* ============================================================
     FRESADO
     ============================================================ */
  Cmd.add(['CAMCONTORNO', 'CAMCONTOUR'], { group: 'cam', icon: 'camcontour', title: 'Contorneado' },
  async function (ctx) {
    var st = camState(ctx.app);
    var sel = await ctx.getSelection('Designe los contornos a mecanizar');
    if (!sel || !sel.length) return;
    var loops = loopsOf(ctx, sel);
    if (!loops.length) { ctx.err('Los objetos designados no forman contornos.'); return; }
    var tool = await pickTool(ctx, 'mill', 'Herramienta de contorneado'); if (!tool) return;
    var side = await ctx.getKeyword('Lado de la compensación', ['Exterior', 'Interior', 'Sobre el contorno'], { def: 'Exterior' });
    var zTop = await ctx.getDist('Z superior', { def: 0 }); if (!num(zTop)) return;
    var zBot = await ctx.getDist('Z de profundidad final', { def: -5 }); if (!num(zBot)) return;
    var step = await ctx.getDist('Profundidad de pasada', { def: Math.min(tool.d * 0.5, Math.abs(zTop - zBot)) });
    if (!num(step)) return;
    var stock = await ctx.getDist('Creces laterales', { def: 0 }); if (!num(stock)) stock = 0;
    var comp = await ctx.getKeyword('Compensación de radio', ['Ordenador', 'Control', 'Desactivada'], { def: 'Ordenador' });
    var dir = await ctx.getKeyword('Sentido de fresado', ['Concordante', 'Opuesto'], { def: 'Concordante' });
    var entry = await ctx.getKeyword('Modo de entrada', ['Vertical', 'Rampa', 'Helice'], { def: 'Vertical' });

    var path = CAM.contour(loops, {
      tool: matTool(tool, st.material), name: 'Contorneado ' + (st.paths.length + 1),
      zTop: zTop, zBottom: zBot, stepDown: Math.abs(step), stock: stock,
      side: kwOf(side) === 'I' ? 'INTERIOR' : (kwOf(side) === 'S' ? 'SOBRE' : 'EXTERIOR'),
      comp: kwOf(comp) === 'C' ? 'CONTROL' : (kwOf(comp) === 'D' ? 'DESACTIVADA' : 'ORDENADOR'),
      dir: kwOf(dir) === 'O' ? 'OPUESTO' : 'CONCORDANTE',
      entry: kwOf(entry) === 'R' ? 'RAMPA' : (kwOf(entry) === 'H' ? 'HELICE' : 'VERTICAL'),
      clearance: st.clearance, maxRpm: st.maxRpm
    });
    st.paths.push(path);
    ctx.app.refresh();
    report(ctx, path);
  });

  Cmd.add(['CAMVACIADO', 'CAMPOCKET'], { group: 'cam', icon: 'campocket', title: 'Vaciado' },
  async function (ctx) {
    var st = camState(ctx.app);
    var sel = await ctx.getSelection('Designe el contorno exterior del vaciado');
    if (!sel || !sel.length) return;
    var loops = loopsOf(ctx, sel);
    if (!loops.length) { ctx.err('Contorno no válido.'); return; }
    /* el mayor es el exterior, el resto son islas */
    var areas = loops.map(function (l) { return Math.abs(CAM.signedArea(l)); });
    var bi = 0;
    for (var i = 1; i < areas.length; i++) if (areas[i] > areas[bi]) bi = i;
    var outer = loops[bi];
    var holes = loops.filter(function (_, k) { return k !== bi; });

    var tool = await pickTool(ctx, 'mill', 'Herramienta de vaciado'); if (!tool) return;
    var zTop = await ctx.getDist('Z superior', { def: 0 }); if (!num(zTop)) return;
    var zBot = await ctx.getDist('Z de profundidad final', { def: -5 }); if (!num(zBot)) return;
    var step = await ctx.getDist('Profundidad de pasada', { def: Math.min(tool.d * 0.5, Math.abs(zTop - zBot)) });
    if (!num(step)) return;
    var so = await ctx.getReal('Incremento lateral (fracción del diámetro)', { def: 0.45 });
    if (!num(so)) so = 0.45;
    var stock = await ctx.getDist('Creces para acabado', { def: 0.2 }); if (!num(stock)) stock = 0;
    var pat = await ctx.getKeyword('Trayectoria', ['Concentrico', 'Zigzag'], { def: 'Concentrico' });
    var entry = await ctx.getKeyword('Modo de entrada', ['Helice', 'Rampa', 'Vertical'], { def: 'Helice' });

    var path = CAM.pocket(outer, holes, {
      tool: matTool(tool, st.material), name: 'Vaciado ' + (st.paths.length + 1),
      zTop: zTop, zBottom: zBot, stepDown: Math.abs(step), stepOver: so, stock: stock,
      pattern: kwOf(pat) === 'Z' ? 'ZIGZAG' : 'CONCENTRICO',
      entry: kwOf(entry) === 'R' ? 'RAMPA' : (kwOf(entry) === 'V' ? 'VERTICAL' : 'HELICE'),
      clearance: st.clearance, maxRpm: st.maxRpm, finishPass: stock > 0
    });
    st.paths.push(path);
    ctx.app.refresh();
    report(ctx, path);
  });

  Cmd.add(['CAMPLANEADO', 'CAMFACE'], { group: 'cam', icon: 'camface', title: 'Planeado' },
  async function (ctx) {
    var st = camState(ctx.app);
    if (!st.stock) { ctx.err('Defina primero el bruto con CAMBRUTO.'); return; }
    var tool = await pickTool(ctx, 'mill', 'Herramienta de planeado'); if (!tool) return;
    var zTop = await ctx.getDist('Z superior del bruto', { def: st.stock.z2 }); if (!num(zTop)) return;
    var zBot = await ctx.getDist('Z final del planeado', { def: st.stock.z2 - 1 }); if (!num(zBot)) return;
    var step = await ctx.getDist('Profundidad de pasada', { def: 1 }); if (!num(step)) return;
    var so = await ctx.getReal('Incremento lateral (fracción del diámetro)', { def: 0.7 });
    if (!num(so)) so = 0.7;
    var path = CAM.facing(st.stock, {
      tool: matTool(tool, st.material), name: 'Planeado ' + (st.paths.length + 1),
      zTop: zTop, zBottom: zBot, stepDown: Math.abs(step), stepOver: so,
      clearance: st.clearance, maxRpm: st.maxRpm
    });
    st.paths.push(path);
    ctx.app.refresh();
    report(ctx, path);
  });

  Cmd.add(['CAMTALADRO', 'CAMDRILL'], { group: 'cam', icon: 'camdrill', title: 'Taladrado' },
  async function (ctx) {
    var st = camState(ctx.app);
    var sel = await ctx.getSelection('Designe círculos o puntos como posiciones de taladro');
    if (!sel || !sel.length) return;
    var pts = [], dias = [];
    sel.forEach(function (e) {
      if (e.type === 'CIRCLE') { pts.push({ x: e.c.x, y: e.c.y }); dias.push(e.r * 2); }
      else if (e.type === 'POINT') pts.push({ x: e.p.x, y: e.p.y });
      else if (e.type === 'ARC') { pts.push({ x: e.c.x, y: e.c.y }); dias.push(e.r * 2); }
    });
    if (!pts.length) { ctx.err('No se han encontrado posiciones de taladro.'); return; }
    if (dias.length) {
      var dmin = Math.min.apply(null, dias), dmax = Math.max.apply(null, dias);
      ctx.out(pts.length + ' posición(es).  Ø entre ' + G.fmt(dmin, 3) + ' y ' + G.fmt(dmax, 3));
    }
    var tool = await pickTool(ctx, 'drill', 'Herramienta de taladrado'); if (!tool) return;
    var cyc = await ctx.getKeyword('Ciclo', ['G81 simple', 'G82 con espera', 'G83 picoteo', 'G73 rotura viruta', 'G84 roscado', 'G85 escariado'], { def: 'G81 simple' });
    if (!cyc) return;
    var cycTxt = String(cyc.keyword || '');
    var cycle = cycTxt.indexOf('82') >= 0 ? 'G82' : cycTxt.indexOf('83') >= 0 ? 'G83' :
                cycTxt.indexOf('73') >= 0 ? 'G73' : cycTxt.indexOf('84') >= 0 ? 'G84' :
                cycTxt.indexOf('85') >= 0 ? 'G85' : 'G81';
    var zTop = await ctx.getDist('Z de la superficie', { def: 0 }); if (!num(zTop)) return;
    var depth = await ctx.getDist('Profundidad del taladro', { def: 20 }); if (!num(depth)) return;
    var peck = (cycle === 'G83' || cycle === 'G73') ? await ctx.getDist('Incremento de picoteo', { def: tool.d * 0.6 }) : 0;
    var thru = await ctx.getKeyword('¿Agujero pasante?', ['Sí', 'No'], { def: 'No' });
    var pitch = cycle === 'G84' ? await ctx.getReal('Paso de rosca', { def: 1.5 }) : 0;

    var path = CAM.drilling(pts, {
      tool: matTool(tool, st.material), name: 'Taladrado ' + (st.paths.length + 1),
      zTop: zTop, depth: Math.abs(depth), cycle: cycle, peck: num(peck) ? Math.abs(peck) : 3,
      throughExtra: kwOf(thru) === 'S' ? 1.5 : 0, pitch: num(pitch) ? pitch : 1.5,
      clearance: st.clearance, maxRpm: st.maxRpm, dwell: cycle === 'G82' ? 0.3 : 0
    });
    st.paths.push(path);
    ctx.app.refresh();
    report(ctx, path);
  });

  Cmd.add(['CAMGRABADO', 'CAMENGRAVE'], { group: 'cam', icon: 'camengrave', title: 'Grabado' },
  async function (ctx) {
    var st = camState(ctx.app);
    var sel = await ctx.getSelection('Designe la geometría a grabar');
    if (!sel || !sel.length) return;
    var polys = [];
    sel.forEach(function (e) {
      var segs = E.segs(e, ctx.doc, 'high');
      if (!segs) return;
      segs.forEach(function (s) {
        var pts = (s.pts || s).map(function (p) { return { x: p.x, y: p.y }; });
        if (pts.length > 1) { pts.closed = s.closed; polys.push(pts); }
      });
    });
    if (!polys.length) { ctx.err('Nada que grabar.'); return; }
    var tool = await pickTool(ctx, 'mill', 'Herramienta de grabado'); if (!tool) return;
    var zTop = await ctx.getDist('Z de la superficie', { def: 0 }); if (!num(zTop)) return;
    var depth = await ctx.getDist('Profundidad de grabado', { def: 0.4 }); if (!num(depth)) return;
    var path = CAM.engrave(polys, {
      tool: matTool(tool, st.material), name: 'Grabado ' + (st.paths.length + 1),
      zTop: zTop, depth: Math.abs(depth), stepDown: Math.abs(depth),
      clearance: st.clearance, maxRpm: st.maxRpm
    });
    st.paths.push(path);
    ctx.app.refresh();
    report(ctx, path);
  });

  Cmd.add(['CAMDESBASTE', 'CAMROUGH'], { group: 'cam', icon: 'camrough', title: 'Desbaste 3D' },
  async function (ctx) {
    var st = camState(ctx.app);
    var sel = await pick3D(ctx, 'Designe el sólido a desbastar');
    if (!sel) return;
    var mesh = S.meshOf(sel[0]).clone();
    for (var i = 1; i < sel.length; i++) mesh.append(S.meshOf(sel[i]));
    var tool = await pickTool(ctx, 'mill', 'Herramienta de desbaste'); if (!tool) return;
    var step = await ctx.getDist('Profundidad de pasada', { def: tool.d * 0.4 }); if (!num(step)) return;
    var so = await ctx.getReal('Incremento lateral (fracción del diámetro)', { def: 0.5 });
    if (!num(so)) so = 0.5;
    var stock = await ctx.getDist('Creces para acabado', { def: 0.3 }); if (!num(stock)) stock = 0.3;
    ctx.out('Calculando trayectoria de desbaste…');
    var t0 = performance.now();
    var path = CAM.roughing3D(mesh, {
      tool: matTool(tool, st.material), name: 'Desbaste 3D ' + (st.paths.length + 1),
      stepDown: Math.abs(step), stepOver: so, stock: stock,
      clearance: st.clearance, maxRpm: st.maxRpm,
      stockBox: st.stock || null
    });
    st.paths.push(path);
    ctx.app.refresh();
    ctx.out('Calculado en ' + Math.round(performance.now() - t0) + ' ms.');
    report(ctx, path);
  });

  Cmd.add(['CAMACABADO', 'CAMFINISH'], { group: 'cam', icon: 'camfinish', title: 'Acabado 3D' },
  async function (ctx) {
    var st = camState(ctx.app);
    var sel = await pick3D(ctx, 'Designe el sólido a acabar');
    if (!sel) return;
    var mesh = S.meshOf(sel[0]).clone();
    for (var i = 1; i < sel.length; i++) mesh.append(S.meshOf(sel[i]));
    var tool = await pickTool(ctx, 'mill', 'Herramienta de acabado'); if (!tool) return;
    var so = await ctx.getReal('Incremento lateral (fracción del diámetro)', { def: 0.12 });
    if (!num(so)) so = 0.12;
    var ang = await ctx.getAngle('Ángulo de las pasadas', { def: 0 });
    ctx.out('Calculando trayectoria de acabado (puede tardar)…');
    var t0 = performance.now();
    var path = CAM.finishing3D(mesh, {
      tool: matTool(tool, st.material), name: 'Acabado 3D ' + (st.paths.length + 1),
      stepOver: so, angle: ang === null ? 0 : ang * 180 / Math.PI,
      clearance: st.clearance, maxRpm: st.maxRpm
    });
    st.paths.push(path);
    ctx.app.refresh();
    ctx.out('Calculado en ' + Math.round(performance.now() - t0) + ' ms.');
    report(ctx, path);
  });

  /* ============================================================
     TORNEADO
     ============================================================ */
  Cmd.add(['CAMPERFILTORNO', 'CAMLATHEPROFILE'], { group: 'cam', icon: 'camlathe', title: 'Perfil de torneado' },
  async function (ctx) {
    var st = camState(ctx.app);
    var sel = await pick3D(ctx, 'Designe el sólido de revolución');
    if (!sel) return;
    var prof = CAM.latheProfile(S.meshOf(sel[0]));
    if (!prof.length) { ctx.err('No se ha podido extraer el perfil (¿el sólido está centrado en el eje Z?).'); return; }
    st.latheProfile = prof;
    st.lathe = true;
    var rmax = Math.max.apply(null, prof.map(function (p) { return p.x; }));
    var zmin = Math.min.apply(null, prof.map(function (p) { return p.z; }));
    var zmax = Math.max.apply(null, prof.map(function (p) { return p.z; }));
    ctx.out('Perfil extraído: ' + prof.length + ' puntos.  Ø máx ' + G.fmt(rmax * 2, 3) +
            '   Z de ' + G.fmt(zmin, 3) + ' a ' + G.fmt(zmax, 3));
    var k = await ctx.getKeyword('¿Dibujar el perfil en el modelo?', ['Sí', 'No'], { def: 'No' });
    if (kwOf(k) === 'S') {
      ctx.doc.mark('CAMPERFILTORNO');
      ctx.doc.add(E.pline(prof.map(function (p) { return { x: p.z, y: p.x }; }), false,
                          { layer: ctx.doc.vars.CLAYER, color: 3 }));
      ctx.app.refresh(true);
    }
  });

  async function needProfile(ctx) {
    var st = camState(ctx.app);
    if (st.latheProfile && st.latheProfile.length) return st.latheProfile;
    var sel = await pick3D(ctx, 'Designe el sólido de revolución');
    if (!sel) return null;
    var prof = CAM.latheProfile(S.meshOf(sel[0]));
    if (!prof.length) { ctx.err('No se ha podido extraer el perfil.'); return null; }
    st.latheProfile = prof;
    st.lathe = true;
    return prof;
  }

  Cmd.add(['CAMCILINDRAR', 'CAMTURN'], { group: 'cam', icon: 'camturn', title: 'Cilindrado (desbaste)' },
  async function (ctx) {
    var st = camState(ctx.app);
    var prof = await needProfile(ctx); if (!prof) return;
    var tool = await pickTool(ctx, 'turn', 'Cuchilla de cilindrar'); if (!tool) return;
    var rmax = Math.max.apply(null, prof.map(function (p) { return p.x; }));
    var stockR = await ctx.getDist('Radio del bruto', { def: rmax + 2 }); if (!num(stockR)) return;
    var depth = await ctx.getDist('Profundidad de pasada radial', { def: 2 }); if (!num(depth)) return;
    var stockD = await ctx.getDist('Creces radiales para acabado', { def: 0.3 }); if (!num(stockD)) stockD = 0;
    var useCyc = await ctx.getKeyword('¿Emitir ciclo G71 del control?', ['Sí', 'No'], { def: 'No' });
    var t2 = matTool(tool, st.material);
    t2.workDia = stockR * 2;
    var path = CAM.turnRough(prof, {
      tool: t2, name: 'Cilindrado ' + (st.paths.length + 1),
      stockR: stockR, depth: Math.abs(depth), stockD: stockD,
      useCycle: kwOf(useCyc) === 'S', maxRpm: st.maxRpm
    });
    st.paths.push(path);
    st.lathe = true;
    ctx.app.refresh();
    report(ctx, path);
  });

  Cmd.add(['CAMACABADOTORNO', 'CAMTURNFINISH'], { group: 'cam', icon: 'camturnf', title: 'Acabado de torneado' },
  async function (ctx) {
    var st = camState(ctx.app);
    var prof = await needProfile(ctx); if (!prof) return;
    var tool = await pickTool(ctx, 'turn', 'Cuchilla de acabado'); if (!tool) return;
    var rmax = Math.max.apply(null, prof.map(function (p) { return p.x; }));
    var t2 = matTool(tool, st.material);
    t2.workDia = rmax * 2;
    var path = CAM.turnFinish(prof, {
      tool: t2, name: 'Acabado torno ' + (st.paths.length + 1), maxRpm: st.maxRpm
    });
    st.paths.push(path);
    st.lathe = true;
    ctx.app.refresh();
    report(ctx, path);
  });

  Cmd.add(['CAMREFRENTAR', 'CAMFACING'], { group: 'cam', icon: 'camfacing', title: 'Refrentado' },
  async function (ctx) {
    var st = camState(ctx.app);
    var tool = await pickTool(ctx, 'turn', 'Cuchilla de refrentar'); if (!tool) return;
    var rOut = await ctx.getDist('Radio exterior', { def: 25 }); if (!num(rOut)) return;
    var rIn = await ctx.getDist('Radio interior', { def: 0 }); if (!num(rIn)) rIn = 0;
    var zS = await ctx.getDist('Z inicial', { def: 1 }); if (!num(zS)) return;
    var zE = await ctx.getDist('Z final', { def: 0 }); if (!num(zE)) return;
    var dp = await ctx.getDist('Profundidad de pasada', { def: 0.5 }); if (!num(dp)) dp = 0.5;
    var t2 = matTool(tool, st.material); t2.workDia = rOut * 2;
    var path = CAM.turnFace({
      tool: t2, name: 'Refrentado ' + (st.paths.length + 1),
      rOuter: rOut, rInner: rIn, zStart: zS, zEnd: zE, depth: Math.abs(dp), maxRpm: st.maxRpm
    });
    st.paths.push(path);
    st.lathe = true;
    ctx.app.refresh();
    report(ctx, path);
  });

  Cmd.add(['CAMRANURAR', 'CAMGROOVE'], { group: 'cam', icon: 'camgroove', title: 'Ranurado' },
  async function (ctx) {
    var st = camState(ctx.app);
    var tool = await pickTool(ctx, 'turn', 'Cuchilla de ranurar'); if (!tool) return;
    var z = await ctx.getDist('Z del borde derecho de la ranura', { def: 0 }); if (!num(z)) return;
    var w = await ctx.getDist('Anchura de la ranura', { def: Math.max(tool.d, 3) }); if (!num(w)) return;
    var rOut = await ctx.getDist('Radio exterior', { def: 25 }); if (!num(rOut)) return;
    var rBot = await ctx.getDist('Radio de fondo', { def: 20 }); if (!num(rBot)) return;
    var t2 = matTool(tool, st.material); t2.workDia = rOut * 2;
    var path = CAM.turnGroove({
      tool: t2, name: 'Ranurado ' + (st.paths.length + 1),
      z: z, width: Math.abs(w), rOuter: rOut, rBottom: rBot,
      peck: tool.d * 0.5, maxRpm: st.maxRpm
    });
    st.paths.push(path);
    st.lathe = true;
    ctx.app.refresh();
    report(ctx, path);
  });

  Cmd.add(['CAMROSCAR', 'CAMTHREAD'], { group: 'cam', icon: 'camthread', title: 'Roscado' },
  async function (ctx) {
    var st = camState(ctx.app);
    var tool = await pickTool(ctx, 'turn', 'Cuchilla de roscar'); if (!tool) return;
    var d = await ctx.getDist('Diámetro nominal de la rosca', { def: 20 }); if (!num(d)) return;
    var p2 = await ctx.getReal('Paso de la rosca', { def: 1.5 }); if (!num(p2)) return;
    var zS = await ctx.getDist('Z inicial', { def: 2 }); if (!num(zS)) return;
    var zE = await ctx.getDist('Z final', { def: -20 }); if (!num(zE)) return;
    var intK = await ctx.getKeyword('Tipo de rosca', ['Exterior', 'Interior'], { def: 'Exterior' });
    var np = await ctx.getReal('Número de pasadas', { def: 6 }); if (!num(np)) np = 6;
    var useCyc = await ctx.getKeyword('¿Emitir ciclo G76 del control?', ['Sí', 'No'], { def: 'Sí' });
    var t2 = matTool(tool, st.material); t2.workDia = d;
    var path = CAM.turnThread({
      tool: t2, name: 'Roscado ' + (st.paths.length + 1),
      dMajor: d, pitch: p2, zStart: zS, zEnd: zE,
      internal: kwOf(intK) === 'I', passes: Math.max(2, Math.round(np)),
      useCycle: kwOf(useCyc) === 'S', maxRpm: st.maxRpm
    });
    st.paths.push(path);
    st.lathe = true;
    ctx.app.refresh();
    ctx.out('Rosca M' + G.fmt(d, 2) + '×' + G.fmt(p2, 2) +
            '   profundidad ' + G.fmt(0.6134 * p2, 4) + ' mm');
    report(ctx, path);
  });

  Cmd.add(['CAMTRONZAR', 'CAMCUTOFF'], { group: 'cam', icon: 'camcutoff', title: 'Tronzado' },
  async function (ctx) {
    var st = camState(ctx.app);
    var tool = await pickTool(ctx, 'turn', 'Cuchilla de tronzar'); if (!tool) return;
    var z = await ctx.getDist('Z del corte', { def: -30 }); if (!num(z)) return;
    var rOut = await ctx.getDist('Radio exterior', { def: 25 }); if (!num(rOut)) return;
    var t2 = matTool(tool, st.material); t2.workDia = rOut * 2;
    var path = CAM.turnCutoff({
      tool: t2, name: 'Tronzado ' + (st.paths.length + 1),
      z: z, rOuter: rOut, peck: tool.d * 0.8, maxRpm: st.maxRpm
    });
    st.paths.push(path);
    st.lathe = true;
    ctx.app.refresh();
    report(ctx, path);
  });

  /* ============================================================
     GESTIÓN DE OPERACIONES Y SALIDA
     ============================================================ */
  function report(ctx, path) {
    var t = path.time();
    ctx.out('▸ ' + path.name + ': ' + path.moves.length + ' movimientos, ' +
            'recorrido de corte ' + G.fmt(path.cutLen, 1) + ' mm, ' +
            'tiempo ' + P.fmtTime(t));
    var w = CAM.checkRapids(path, (camState(ctx.app).stock ? camState(ctx.app).stock.z2 : 0) + 0.5);
    if (w.length) ctx.out('  ⚠ ' + w.length + ' movimiento(s) rápido(s) por debajo del plano de seguridad.', 'warn');
  }

  Cmd.add(['CAMLISTA', 'CAMOPS'], { group: 'cam', icon: 'camlist', title: 'Operaciones de mecanizado' },
  async function (ctx) {
    var st = camState(ctx.app);
    if (!st.paths.length) { ctx.out('No hay operaciones definidas.'); return; }
    ctx.out('=== OPERACIONES DE MECANIZADO ===');
    var total = 0;
    st.paths.forEach(function (p, i) {
      var t = p.time();
      total += t;
      var tool = p.meta && p.meta.tool;
      ctx.out(' ' + (i + 1) + '. ' + p.name +
              (tool ? '   T' + tool.num + ' Ø' + G.fmt(tool.d, 2) : '') +
              '   S' + Math.round(p.meta.rpm || 0) + '   F' + G.fmt(p.meta.feed || 0, 2) +
              '   ' + P.fmtTime(t));
    });
    ctx.out('Tiempo total estimado: ' + P.fmtTime(total));
    ctx.out('Material: ' + st.material + '   Control: ' + P.byId(st.post).name);
  });

  Cmd.add(['CAMBORRAOP', 'CAMDELETEOP'], { group: 'cam', icon: 'camdel', title: 'Borrar operación' },
  async function (ctx) {
    var st = camState(ctx.app);
    if (!st.paths.length) { ctx.out('No hay operaciones.'); return; }
    st.paths.forEach(function (p, i) { ctx.out(' ' + (i + 1) + '. ' + p.name); });
    var n = await ctx.getReal('Número de la operación a borrar (0 = todas)', { def: st.paths.length });
    if (!num(n)) return;
    n = Math.round(n);
    if (n === 0) { st.paths = []; ctx.out('Todas las operaciones borradas.'); }
    else if (n >= 1 && n <= st.paths.length) {
      var d = st.paths.splice(n - 1, 1)[0];
      ctx.out('Borrada: ' + d.name);
    } else ctx.err('Número fuera de rango.');
    ctx.app.refresh();
  });

  Cmd.add(['CAMCONTROL', 'CAMPOST'], { group: 'cam', icon: 'campost', title: 'Control numérico' },
  async function (ctx) {
    var st = camState(ctx.app);
    ctx.out('Controles disponibles:');
    P.LIST.forEach(function (p, i) { ctx.out('  ' + (i + 1) + '. ' + p.name + '  (.' + p.ext + ')'); });
    var n = await ctx.getReal('Elija el control', { def: P.LIST.map(function (p) { return p.id; }).indexOf(st.post) + 1 });
    if (!num(n)) return;
    n = Math.round(n);
    if (n < 1 || n > P.LIST.length) { ctx.err('Fuera de rango.'); return; }
    st.post = P.LIST[n - 1].id;
    ctx.out('Control: ' + P.LIST[n - 1].name);
  });

  Cmd.add(['CAMGENERAR', 'CAMPOSTPROCESS', 'GENERARCN'], { group: 'cam', icon: 'camgen', title: 'Generar código CN' },
  async function (ctx) {
    var st = camState(ctx.app);
    if (!st.paths.length) { ctx.err('No hay operaciones. Cree alguna con CAMCONTORNO, CAMVACIADO, CAMTALADRO…'); return; }
    var post = P.byId(st.post);
    var prog = await ctx.getString('Número de programa', { def: st.program });
    if (prog) st.program = String(prog).replace(/\D/g, '') || '1000';
    var lathe = st.lathe || st.paths.some(function (p) { return p.meta && p.meta.lathe; });
    var dia = true;
    if (lathe) {
      var k = await ctx.getKeyword('Programación del eje X', ['Diámetro', 'Radio'], { def: 'Diámetro' });
      dia = (kwOf(k) !== 'R');
    }
    var code = P.generate(st.paths, post, {
      name: baseName(ctx), program: st.program, material: st.material,
      clearance: st.clearance, lathe: lathe, diameterMode: dia,
      maxRpm: st.maxRpm, latheMaxRpm: 3000
    });
    var fn = baseName(ctx) + '.' + post.ext;
    await CAD.Exporter.saveFile(ctx.app, fn, code, 'text');
    var lines = code.split('\n').length;
    ctx.out('Código CN generado para ' + post.name + ': ' + fn +
            '   ' + lines + ' bloques, ' + (code.length / 1024).toFixed(1) + ' kB');
    var total = st.paths.reduce(function (s, p) { return s + p.time(); }, 0);
    ctx.out('Tiempo de mecanizado estimado: ' + P.fmtTime(total));
    var k2 = await ctx.getKeyword('¿Ver el código en pantalla?', ['Sí', 'No'], { def: 'No' });
    if (kwOf(k2) === 'S') ctx.app.ui.textViewer('Código CN — ' + post.name, code);
  });

  Cmd.add(['CAMHOJA', 'CAMSETUP'], { group: 'cam', icon: 'camsheet', title: 'Hoja de preparación' },
  async function (ctx) {
    var st = camState(ctx.app);
    if (!st.paths.length) { ctx.err('No hay operaciones.'); return; }
    var sheet = P.setupSheet(st.paths, {
      name: baseName(ctx), material: st.material, postName: P.byId(st.post).name
    });
    ctx.app.ui.textViewer('Hoja de preparación', sheet);
    var k = await ctx.getKeyword('¿Guardar en un archivo?', ['Sí', 'No'], { def: 'No' });
    if (kwOf(k) === 'S') await CAD.Exporter.saveFile(ctx.app, baseName(ctx) + '_preparacion.txt', sheet, 'text');
  });

  Cmd.add(['CAMHERRAMIENTAS', 'CAMTOOLS'], { group: 'cam', icon: 'camtools', title: 'Biblioteca de herramientas' },
  async function (ctx) {
    var st = camState(ctx.app);
    if (ctx.app.ui.camToolsDialog) { await ctx.app.ui.camToolsDialog(st); return; }
    ctx.out('=== BIBLIOTECA DE HERRAMIENTAS ===');
    st.tools.forEach(function (t) {
      var c = CAM.cutting(t);
      ctx.out(' T' + String(t.num).padStart(2) + '  ' + t.name.padEnd(28) +
              ' Ø' + G.fmt(t.d, 2).padStart(6) + '  ' + (CAM.TOOLTYPES[t.type] || {}).label +
              '   S' + c.rpm + '  F' + G.fmt(c.feed, 2));
    });
  });

  Cmd.add(['CAMSIMULAR', 'CAMSIM'], { group: 'cam', icon: 'camsim', title: 'Simular mecanizado' },
  async function (ctx) {
    var st = camState(ctx.app);
    if (!st.paths.length) { ctx.err('No hay operaciones.'); return; }
    ctx.app.camShow = !ctx.app.camShow;
    ctx.app.refresh(true);
    ctx.out(ctx.app.camShow ? 'Trayectorias visibles en la vista.' : 'Trayectorias ocultas.');
    if (ctx.app.camShow) {
      var tot = st.paths.reduce(function (s, p) { return s + p.cutLen; }, 0);
      var vol = st.paths.reduce(function (s, p) { return s + CAM.stockRemoved(p, p.meta.tool); }, 0);
      ctx.out('Recorrido total de corte: ' + G.fmt(tot, 1) + ' mm.  Material arrancado ≈ ' +
              G.fmt(vol / 1000, 2) + ' cm³');
    }
  });

  /* Trayectorias como entidades del dibujo, para verlas y acotarlas */
  Cmd.add(['CAMAENTIDADES', 'CAMTOENTS'], { group: 'cam', icon: 'caments', title: 'Trayectorias a entidades' },
  async function (ctx) {
    var st = camState(ctx.app);
    if (!st.paths.length) { ctx.err('No hay operaciones.'); return; }
    ctx.doc.mark('CAMAENTIDADES');
    var lay = 'CAM-Trayectorias';
    if (!ctx.doc.layers[lay]) ctx.doc.addLayer({ name: lay, color: 4 });
    var n = 0, last = null;
    st.paths.forEach(function (p) {
      var run = [];
      p.moves.forEach(function (m) {
        if (m.x === undefined && m.y === undefined && m.z === undefined) return;
        var cur = { x: m.x === undefined ? (last ? last.x : 0) : m.x,
                    y: m.y === undefined ? (last ? last.y : 0) : m.y,
                    z: m.z === undefined ? (last ? last.z : 0) : m.z };
        if (m.t === 'feed' || m.t === 'arc') run.push(cur);
        else {
          if (run.length > 1) { ctx.doc.add(E.pline(run, false, { layer: lay })); n++; }
          run = [cur];
        }
        last = cur;
      });
      if (run.length > 1) { ctx.doc.add(E.pline(run, false, { layer: lay })); n++; }
    });
    ctx.app.refresh(true);
    ctx.out(n + ' polilínea(s) de trayectoria creada(s) en la capa "' + lay + '".');
  });
})();
