/* ============================================================
   commands-misc.js — Vista, capas, consulta, archivo, ajustes
   ============================================================ */
(function () {
  'use strict';
  var CAD = window.CAD, G = CAD.G, E = CAD.E, Cmd = CAD.Cmd;
  var isKw = CAD.CU.isKw;
  function pt(v) { return v && v.x !== undefined ? v : null; }

  /* ============================================================
     VISTA
     ============================================================ */
  Cmd.add(['ZOOM', 'Z'], { group: 'view', icon: 'zoom', title: 'Zoom', transparent: true }, async function (ctx, args) {
    var app = ctx.app, r = app.r;
    var opt = args && args[0] ? { kw: args[0] } : null;
    if (!opt) {
      opt = await ctx.getPoint('Precise esquina de ventana, indique un factor de escala (nX o nXP), o', {
        keywords: ['Todo', 'CEntro', 'Dinámico', 'Extensión', 'Previo', 'Escala', 'Ventana', 'Objeto'],
        def: 'tiempo real', allowNone: true
      });
    }
    if (opt === null) { return; }
    if (pt(opt)) {
      var p2 = await ctx.getCorner('Precise esquina opuesta', opt);
      if (!pt(p2)) return;
      r.zoomBox(G.bboxFromPts([opt, p2]), 1);
      app.refresh();
      return;
    }
    if (typeof opt === 'number') { r.pushView(); r.view.zoom *= opt; app.refresh(); return; }
    switch (opt.kw) {
      case 'T': {
        var b = E.extentsAll(ctx.doc.entities, ctx.doc);
        var lim = { x1: ctx.doc.vars.LIMMIN.x, y1: ctx.doc.vars.LIMMIN.y, x2: ctx.doc.vars.LIMMAX.x, y2: ctx.doc.vars.LIMMAX.y };
        if (G.bboxValid(b)) G.bboxMerge(lim, b);
        r.zoomBox(lim);
        break;
      }
      case 'E': {
        var be = E.extentsAll(ctx.doc.entities, ctx.doc);
        if (!G.bboxValid(be)) be = { x1: 0, y1: 0, x2: 420, y2: 297 };
        r.zoomBox(be);
        break;
      }
      case 'P': if (!r.prevView()) ctx.err('No hay ninguna vista previa guardada.'); break;
      case 'V': {
        var q1 = await ctx.getPoint('Precise primera esquina'); if (!pt(q1)) return;
        var q2 = await ctx.getCorner('Precise esquina opuesta', q1); if (!pt(q2)) return;
        r.zoomBox(G.bboxFromPts([q1, q2]), 1);
        break;
      }
      case 'CE': {
        var c = await ctx.getPoint('Precise punto central'); if (!pt(c)) return;
        var h = await ctx.getReal('Indique altura o factor de aumento (nX)', { def: G.fmt(r.H / r.view.zoom, 4) });
        r.pushView();
        r.view.cx = c.x; r.view.cy = c.y;
        if (typeof h === 'number' && h > 0) r.view.zoom = r.H / h;
        break;
      }
      case 'O': {
        var sel = await ctx.getSelection('Designe objetos', { force: true });
        if (sel && sel.length) r.zoomBox(E.extentsAll(sel, ctx.doc));
        app.selSet = [];
        break;
      }
      case 'ES': {
        var f = await ctx.getReal('Indique factor de escala (nX o nXP)', { def: 1 });
        if (typeof f === 'number' && f > 0) { r.pushView(); r.view.zoom *= f; }
        break;
      }
      default: {
        app.realtimeZoom = true;
        ctx.out('Pulse Esc o Intro para salir, o haga clic con el botón derecho para ver el menú contextual.');
        await new Promise(function (res) { app.realtimeDone = res; });
        app.realtimeZoom = false;
      }
    }
    app.refresh();
  });

  Cmd.add(['ENCUADRE', 'PAN', 'P'], { group: 'view', icon: 'pan', title: 'Encuadre', transparent: true }, async function (ctx) {
    var app = ctx.app;
    app.realtimePan = true;
    ctx.out('Pulse Esc o Intro para salir, o haga clic con el botón derecho para ver el menú contextual.');
    try {
      await new Promise(function (res) { app.realtimeDone = res; });
    } finally { app.realtimePan = false; }
  });

  Cmd.add(['REGEN', 'RE', 'REDIBUJA', 'REDRAW', 'R'], { group: 'view', title: 'Regenerar' }, async function (ctx) {
    ctx.out('Regenerando modelo.');
    ctx.app.refresh(true);
  });

  /* ============================================================
     CAPAS
     ============================================================ */
  Cmd.add(['CAPA', 'LAYER', 'LA', 'DDLMODES'], { group: 'layer', icon: 'layer', title: 'Capa' }, async function (ctx) {
    await ctx.app.ui.layerDialog();
    ctx.app.refresh();
  });

  Cmd.add(['CAPAACT', 'LAYMCUR'], { group: 'layer', title: 'Definir capa actual por objeto' }, async function (ctx) {
    var e = await ctx.getEntity('Designe el objeto cuya capa se convertirá en la actual');
    if (!e) return;
    ctx.doc.vars.CLAYER = e.ent.layer;
    ctx.out('"' + e.ent.layer + '" es ahora la capa actual.');
    ctx.app.refresh();
  });

  function layerOp(names, title, fn, msg) {
    Cmd.add(names, { group: 'layer', title: title }, async function (ctx) {
      var sel = await ctx.getSelection('Designe objetos en la(s) capa(s) afectada(s)', { force: true });
      if (!sel || !sel.length) return;
      ctx.doc.mark(title);
      ctx.app.pushLayerState();
      var done = {};
      sel.forEach(function (e) {
        if (done[e.layer]) return;
        done[e.layer] = 1;
        fn(ctx.doc, ctx.doc.layer(e.layer), sel);
      });
      ctx.app.selSet = [];
      ctx.out(msg);
      ctx.app.refresh();
    });
  }
  layerOp(['DESACTCAPA', 'LAYOFF'], 'Desactivar capa', function (doc, l) { if (l.name !== doc.vars.CLAYER) l.on = false; }, 'Capa(s) desactivada(s).');
  layerOp(['INUTCAPA', 'LAYFRZ'], 'Inutilizar capa', function (doc, l) { if (l.name !== doc.vars.CLAYER) l.frozen = true; }, 'Capa(s) inutilizada(s).');
  layerOp(['BLOQUEACAPA', 'LAYLCK'], 'Bloquear capa', function (doc, l) { l.locked = true; }, 'Capa(s) bloqueada(s).');
  layerOp(['DESBLOQUEACAPA', 'LAYULK'], 'Desbloquear capa', function (doc, l) { l.locked = false; }, 'Capa(s) desbloqueada(s).');

  Cmd.add(['AISLACAPA', 'LAYISO'], { group: 'layer', title: 'Aislar capa' }, async function (ctx) {
    var sel = await ctx.getSelection('Designe objetos en la(s) capa(s) que se aislarán', { force: true });
    if (!sel || !sel.length) return;
    ctx.doc.mark('AISLACAPA');
    ctx.app.pushLayerState();
    var keep = {};
    sel.forEach(function (e) { keep[e.layer] = 1; });
    ctx.doc.layerList().forEach(function (l) { if (!keep[l.name]) l.on = false; });
    ctx.app.selSet = [];
    ctx.out('Capas aisladas: ' + Object.keys(keep).join(', '));
    ctx.app.refresh();
  });

  Cmd.add(['ACTCAPAS', 'LAYON'], { group: 'layer', title: 'Activar todas las capas' }, async function (ctx) {
    ctx.doc.mark('ACTCAPAS');
    ctx.app.pushLayerState();
    ctx.doc.layerList().forEach(function (l) { l.on = true; });
    ctx.out('Se han activado todas las capas.');
    ctx.app.refresh();
  });
  Cmd.add(['REUTCAPAS', 'LAYTHW'], { group: 'layer', title: 'Reutilizar todas las capas' }, async function (ctx) {
    ctx.doc.mark('REUTCAPAS');
    ctx.app.pushLayerState();
    ctx.doc.layerList().forEach(function (l) { l.frozen = false; });
    ctx.out('Se han reutilizado todas las capas.');
    ctx.app.refresh();
  });

  /* ============================================================
     PROPIEDADES
     ============================================================ */
  Cmd.add(['PROPIEDADES', 'PROPERTIES', 'PR', 'CH', 'MO', 'DDMODIFY'], { group: 'props', icon: 'props', title: 'Propiedades' }, async function (ctx) {
    ctx.app.ui.togglePalette('props', true);
  });
  Cmd.add(['CERRARPROPIEDADES', 'PROPERTIESCLOSE', 'PRCLOSE'], { group: 'props' }, async function (ctx) {
    ctx.app.ui.togglePalette('props', false);
  });

  Cmd.add(['IGUALARPROP', 'MATCHPROP', 'MA', 'PAINTER'], { group: 'props', icon: 'matchprop', title: 'Igualar propiedades' }, async function (ctx) {
    var src = await ctx.getEntity('Designe objeto de origen');
    if (!src) return;
    var s = src.ent;
    ctx.out('Parámetros actuales:  Color, Capa, Tipo de línea, Escala de tipo de línea, Grosor de línea, Espesor, Estilo de trazado, Cota, Texto, Sombreado');
    ctx.doc.mark('IGUALARPROP');
    var n = 0;
    while (true) {
      var d = await ctx.getEntity('Designe objeto(s) de destino o <salir>', { allowNone: true });
      if (!d) break;
      var t = d.ent;
      t.layer = s.layer; t.color = s.color; t.ltype = s.ltype; t.lw = s.lw; t.ltscale = s.ltscale;
      if (t.type === 'TEXT' || t.type === 'MTEXT') { if (s.style) t.style = s.style; if (s.h) t.h = s.h; }
      if (t.type === 'DIMENSION' && s.style) t.style = s.style;
      if (t.type === 'HATCH' && s.type === 'HATCH') { t.pattern = s.pattern; t.scale = s.scale; t.angle = s.angle; t.solid = s.solid; }
      n++;
      ctx.app.refresh();
    }
    if (!n) ctx.doc.undoStack.pop();
  });

  Cmd.add(['COLOR', 'COL', 'DDCOLOR'], { group: 'props', title: 'Color' }, async function (ctx) {
    var c = await ctx.app.ui.colorDialog(ctx.doc.vars.CECOLOR);
    if (c === null) return;
    ctx.doc.vars.CECOLOR = c;
    if (ctx.app.selSet.length) {
      ctx.doc.mark('COLOR');
      ctx.app.selSet.forEach(function (e) { e.color = c; });
    }
    ctx.app.ui.syncPropBar();
    ctx.app.refresh();
  });

  Cmd.add(['TIPOLIN', 'LINETYPE', 'LT', 'DDLTYPE'], { group: 'props', title: 'Tipo de línea' }, async function (ctx) {
    var t = await ctx.app.ui.listDialog('Administrador de tipos de línea',
      ['ByLayer'].concat(Object.keys(ctx.doc.ltypes)), ctx.doc.vars.CELTYPE);
    if (t === null) return;
    ctx.doc.vars.CELTYPE = t;
    if (ctx.app.selSet.length) {
      ctx.doc.mark('TIPOLIN');
      ctx.app.selSet.forEach(function (e) { e.ltype = t; });
    }
    ctx.app.ui.syncPropBar();
    ctx.app.refresh();
  });

  Cmd.add(['ESCALATL', 'LTSCALE', 'LTS'], { group: 'props', title: 'Escala de tipo de línea' }, async function (ctx) {
    var v = await ctx.getReal('Indique nuevo factor de escala de tipo de línea', { def: G.fmt(ctx.doc.vars.LTSCALE, 4) });
    if (typeof v !== 'number' || v <= 0) return;
    ctx.doc.vars.LTSCALE = v;
    ctx.out('Regenerando modelo.');
    ctx.app.refresh();
  });

  Cmd.add(['GROSORLIN', 'LWEIGHT', 'LW'], { group: 'props', title: 'Grosor de línea' }, async function (ctx) {
    var v = await ctx.app.ui.lweightDialog(ctx.doc.vars.CELWEIGHT);
    if (v === null) return;
    ctx.doc.vars.CELWEIGHT = v;
    if (ctx.app.selSet.length) {
      ctx.doc.mark('GROSORLIN');
      ctx.app.selSet.forEach(function (e) { e.lw = v; });
    }
    ctx.app.ui.syncPropBar();
    ctx.app.refresh();
  });

  /* ============================================================
     CONSULTA
     ============================================================ */
  Cmd.add(['LISTA', 'LIST', 'LI', 'LS'], { group: 'inquiry', icon: 'list', title: 'Lista' }, async function (ctx) {
    var sel = await ctx.getSelection('Designe objetos');
    if (!sel || !sel.length) return;
    var lines = [];
    sel.slice(0, 60).forEach(function (e) {
      lines = lines.concat(E.describe(e, ctx.doc), ['']);
    });
    ctx.app.ui.textWindow('Lista de objetos', lines.join('\n'));
    ctx.app.selSet = [];
  });

  Cmd.add(['DISTANCIA', 'DIST', 'DI'], { group: 'inquiry', icon: 'dist', title: 'Distancia', transparent: true }, async function (ctx) {
    var p1 = await ctx.getPoint('Precise primer punto'); if (!pt(p1)) return;
    var p2 = await ctx.getPoint('Precise segundo punto o', {
      base: p1, rubber: 'line', keywords: ['Múltiples puntos']
    });
    if (!pt(p2)) return;
    var d = G.dist(p1, p2), a = G.deg(G.na(G.ang(p1, p2)));
    var pr = ctx.doc.vars.LUPREC;
    ctx.out('Distancia = ' + G.fmt(d, pr) + ', Ángulo en plano XY = ' + G.fmt(a, 0) +
      ', Ángulo desde plano XY = 0');
    ctx.out('Incremento X = ' + G.fmt(p2.x - p1.x, pr) + ', Incremento Y = ' + G.fmt(p2.y - p1.y, pr) + ', Incremento Z = 0.0000');
  });

  Cmd.add(['AREA', 'AA'], { group: 'inquiry', icon: 'area', title: 'Área', transparent: true }, async function (ctx) {
    var opt = await ctx.getPoint('Precise primer punto de esquina o', {
      keywords: ['Objeto', 'Añadir área', 'Sustraer área'], allowNone: true
    });
    if (opt === null) return;
    var pr = ctx.doc.vars.LUPREC;
    if (isKw(opt) && opt.kw === 'O') {
      var e = await ctx.getEntity('Designe objetos');
      if (!e) return;
      var ss = E.segs(e.ent, ctx.doc, 3)[0];
      if (!ss) return;
      var ar = Math.abs(G.polyArea(ss.pts)), per = G.polyLen(ss.pts, ss.closed);
      ctx.out('Área = ' + G.fmt(ar, pr) + ', Perímetro = ' + G.fmt(per, pr));
      ctx.app.ui.flashResult('Área = ' + G.fmt(ar, pr));
      return;
    }
    if (!pt(opt)) return;
    var pts = [opt];
    while (true) {
      var p = await ctx.getPoint('Precise el punto de esquina siguiente o pulse INTRO para el total', {
        base: pts[pts.length - 1], allowNone: true,
        preview: function (c) { return pts.length >= 2 ? [E.pline(pts.concat([c]), true)] : [E.line(pts[0], c)]; }
      });
      if (!pt(p)) break;
      pts.push(p);
      ctx.app.refresh();
    }
    if (pts.length < 3) { ctx.err('Se requieren al menos tres puntos.'); return; }
    var area = Math.abs(G.polyArea(pts)), perim = G.polyLen(pts, true);
    ctx.out('Área = ' + G.fmt(area, pr) + ', Perímetro = ' + G.fmt(perim, pr));
    ctx.app.ui.flashResult('Área = ' + G.fmt(area, pr));
  });

  Cmd.add(['ID', 'IDPOINT'], { group: 'inquiry', title: 'Coordenada', transparent: true }, async function (ctx) {
    var p = await ctx.getPoint('Precise punto');
    if (!pt(p)) return;
    var pr = ctx.doc.vars.LUPREC;
    ctx.out('X = ' + G.fmt(p.x, pr) + '   Y = ' + G.fmt(p.y, pr) + '   Z = ' + G.fmt(0, pr));
  });

  /* ============================================================
     DESHACER / REHACER
     ============================================================ */
  Cmd.add(['H', 'U', 'DESHACER', 'UNDO'], { group: 'edit', icon: 'undo', title: 'Deshacer' }, async function (ctx) {
    var l = ctx.doc.undo();
    if (l === null) ctx.out('Nada que deshacer', 'warn');
    else ctx.out(l || 'Todo');
    ctx.app.selSet = [];
    ctx.app.refresh();
  });
  Cmd.add(['REHACER', 'REDO', 'MREDO'], { group: 'edit', icon: 'redo', title: 'Rehacer' }, async function (ctx) {
    var l = ctx.doc.redo();
    if (l === null) ctx.out('Nada que rehacer', 'warn');
    ctx.app.selSet = [];
    ctx.app.refresh();
  });
  Cmd.add(['OOPS'], { group: 'edit', title: 'Recuperar borrados' }, async function (ctx) {
    var l = ctx.doc.undo();
    if (l === null) ctx.out('Nada que recuperar', 'warn');
    ctx.app.refresh();
  });

  /* ============================================================
     PORTAPAPELES
     ============================================================ */
  Cmd.add(['COPIAPP', 'COPYCLIP'], { group: 'edit', title: 'Copiar al Portapapeles' }, async function (ctx) {
    var sel = await ctx.getSelection('Designe objetos');
    if (!sel || !sel.length) return;
    var b = E.extentsAll(sel, ctx.doc);
    CAD.clipboard = { base: { x: b.x1, y: b.y1 }, ents: sel.map(E.copyEnt) };
    ctx.out(sel.length + ' objeto(s) copiado(s) al Portapapeles.');
    ctx.app.selSet = [];
    ctx.app.refresh();
  });
  Cmd.add(['CORTARPP', 'CUTCLIP'], { group: 'edit', title: 'Cortar al Portapapeles' }, async function (ctx) {
    var sel = await ctx.getSelection('Designe objetos');
    if (!sel || !sel.length) return;
    var b = E.extentsAll(sel, ctx.doc);
    CAD.clipboard = { base: { x: b.x1, y: b.y1 }, ents: sel.map(E.copyEnt) };
    ctx.doc.mark('CORTARPP');
    ctx.doc.removeAll(sel);
    ctx.app.selSet = [];
    ctx.app.refresh();
  });
  Cmd.add(['PEGARPP', 'PASTECLIP'], { group: 'edit', title: 'Pegar' }, async function (ctx) {
    if (!CAD.clipboard || !CAD.clipboard.ents.length) { ctx.err('El Portapapeles está vacío.'); return; }
    var cb = CAD.clipboard;
    var p = await ctx.getPoint('Precise punto de inserción', {
      preview: function (c) {
        return cb.ents.map(function (e) {
          var n = E.copyEnt(e);
          E.transform(n, G.mTrans(c.x - cb.base.x, c.y - cb.base.y), ctx.doc);
          return n;
        });
      }
    });
    if (!pt(p)) return;
    ctx.doc.mark('PEGARPP');
    var added = [];
    cb.ents.forEach(function (e) {
      var n = E.copyEnt(e);
      E.transform(n, G.mTrans(p.x - cb.base.x, p.y - cb.base.y), ctx.doc);
      if (!ctx.doc.layers[n.layer]) ctx.doc.addLayer({ name: n.layer });
      ctx.doc.add(n);
      added.push(n);
    });
    ctx.app.selSet = added;
    ctx.app.refresh();
  });

  /* ============================================================
     DESIGNACIÓN
     ============================================================ */
  Cmd.add(['DESIGNA', 'SELECT'], { group: 'edit', title: 'Designar' }, async function (ctx) {
    var sel = await ctx.getSelection('Designe objetos', { force: true });
    ctx.app.selSet = sel || [];
    ctx.out((sel ? sel.length : 0) + ' encontrado(s)');
    ctx.app.refresh();
  });

  Cmd.add(['DESIGNARAPIDO', 'QSELECT'], { group: 'edit', title: 'Designación rápida' }, async function (ctx) {
    var cfg = await ctx.app.ui.qselectDialog();
    if (!cfg) return;
    var sel = ctx.doc.selectable().filter(function (e) {
      if (cfg.type && e.type !== cfg.type) return false;
      if (cfg.layer && e.layer !== cfg.layer) return false;
      if (cfg.color !== undefined && cfg.color !== null && E.effColor(e, ctx.doc) !== cfg.color) return false;
      return true;
    });
    ctx.app.selSet = sel;
    ctx.out(sel.length + ' elemento(s) seleccionado(s).');
    ctx.app.refresh();
  });

  /* ============================================================
     ARCHIVO
     ============================================================ */
  Cmd.add(['NUEVO', 'NEW', 'QNEW'], { group: 'file', icon: 'new', title: 'Nuevo' }, async function (ctx) {
    if (ctx.doc.entities.length) {
      var ok = await ctx.app.ui.confirmDialog('¿Desea guardar los cambios en ' + ctx.doc.name + '?', ['Guardar', 'No guardar', 'Cancelar']);
      if (ok === null) return;
      if (ok === 'Guardar') await ctx.app.saveDrawing();
    }
    ctx.app.newDrawing();
  });

  Cmd.add(['ABRE', 'OPEN'], { group: 'file', icon: 'open', title: 'Abrir' }, async function (ctx) {
    await ctx.app.openDrawing();
  });

  Cmd.add(['GUARDAR', 'SAVE', 'QSAVE'], { group: 'file', icon: 'save', title: 'Guardar' }, async function (ctx) {
    await ctx.app.saveDrawing();
  });

  Cmd.add(['GUARDARCOMO', 'SAVEAS'], { group: 'file', icon: 'saveas', title: 'Guardar como' }, async function (ctx) {
    await ctx.app.saveDrawing(true);
  });

  Cmd.add(['EXPORTAR', 'EXPORT', 'EXP', 'DXFOUT'], { group: 'file', icon: 'export', title: 'Exportar' }, async function (ctx) {
    await ctx.app.exportDrawing();
  });

  Cmd.add(['TRAZAR', 'PLOT', 'PRINT', 'IMPRIMIR'], { group: 'file', icon: 'plot', title: 'Trazar' }, async function (ctx) {
    await ctx.app.ui.plotDialog();
  });

  Cmd.add(['BLOQUEDISC', 'WBLOCK', 'W'], { group: 'file', title: 'Guardar bloque' }, async function (ctx) {
    var sel = await ctx.getSelection('Designe objetos a exportar', { force: true });
    if (!sel || !sel.length) return;
    var sub = new CAD.Doc();
    sub.layers = E.deep(ctx.doc.layers);
    sub.layerOrder = ctx.doc.layerOrder.slice();
    sub.ltypes = E.deep(ctx.doc.ltypes);
    sub.blocks = E.deep(ctx.doc.blocks);
    sel.forEach(function (e) { sub.add(E.copyEnt(e)); });
    var name = await ctx.app.ui.promptDialog('Escribir bloque', 'Nombre de archivo:', 'bloque');
    if (!name) return;
    await CAD.Exporter.saveFile(ctx.app, name + '.dxf', CAD.DXF.write(sub, { version: 'AC1015' }), 'dxf');
    ctx.app.selSet = [];
  });

  /* ============================================================
     AJUSTES
     ============================================================ */
  Cmd.add(['REFENT', 'OSNAP', 'OS', 'DDOSNAP'], { group: 'settings', title: 'Referencia a objetos', transparent: true }, async function (ctx) {
    await ctx.app.ui.settingsDialog('osnap');
    ctx.app.ui.syncStatus();
  });
  Cmd.add(['PARAMDIB', 'DSETTINGS', 'DS', 'SE', 'RM'], { group: 'settings', title: 'Parámetros de dibujo', transparent: true }, async function (ctx) {
    await ctx.app.ui.settingsDialog('snap');
    ctx.app.ui.syncStatus();
  });
  Cmd.add(['OPCIONES', 'OPTIONS', 'OP', 'PREFERENCES'], { group: 'settings', title: 'Opciones' }, async function (ctx) {
    await ctx.app.ui.optionsDialog();
    ctx.app.refresh();
  });
  Cmd.add(['UNIDADES', 'UNITS', 'UN', 'DDUNITS'], { group: 'settings', title: 'Unidades', transparent: true }, async function (ctx) {
    await ctx.app.ui.unitsDialog();
    ctx.app.ui.syncStatus();
  });

  Cmd.add(['LIMITES', 'LIMITS'], { group: 'settings', title: 'Límites' }, async function (ctx) {
    var v = ctx.doc.vars;
    var p1 = await ctx.getPoint('Precise esquina inferior izquierda o', { keywords: ['ACT', 'DES'], def: G.fmt(v.LIMMIN.x, 4) + ',' + G.fmt(v.LIMMIN.y, 4) });
    if (isKw(p1)) { v.LIMCHECK = p1.kw === 'A' ? 1 : 0; return; }
    if (!pt(p1)) return;
    var p2 = await ctx.getPoint('Precise esquina superior derecha', { def: G.fmt(v.LIMMAX.x, 4) + ',' + G.fmt(v.LIMMAX.y, 4) });
    if (!pt(p2)) return;
    ctx.doc.mark('LIMITES');
    v.LIMMIN = { x: Math.min(p1.x, p2.x), y: Math.min(p1.y, p2.y) };
    v.LIMMAX = { x: Math.max(p1.x, p2.x), y: Math.max(p1.y, p2.y) };
    ctx.app.refresh();
  });

  Cmd.add(['REJILLA', 'GRID'], { group: 'settings', title: 'Rejilla', transparent: true }, async function (ctx) {
    var r = await ctx.getReal('Precise intervalo de rejilla(X) o', {
      keywords: ['ACT', 'DES', 'Forzcursor'], def: G.fmt(ctx.doc.vars.GRIDUNIT, 4)
    });
    if (isKw(r)) { ctx.doc.vars.GRIDMODE = r.kw === 'A' ? 1 : 0; }
    else if (typeof r === 'number' && r > 0) { ctx.doc.vars.GRIDUNIT = r; ctx.doc.vars.GRIDMODE = 1; }
    ctx.app.ui.syncStatus();
    ctx.app.refresh();
  });

  Cmd.add(['FORZCURSOR', 'SNAP', 'SN'], { group: 'settings', title: 'Forzar cursor', transparent: true }, async function (ctx) {
    var r = await ctx.getReal('Precise intervalo de resolución o', {
      keywords: ['ACT', 'DES', 'Aspecto', 'Rotar', 'Estilo'], def: G.fmt(ctx.doc.vars.SNAPUNIT, 4)
    });
    if (isKw(r)) { ctx.doc.vars.SNAPMODE = r.kw === 'A' ? 1 : 0; }
    else if (typeof r === 'number' && r > 0) { ctx.doc.vars.SNAPUNIT = r; ctx.doc.vars.SNAPMODE = 1; }
    ctx.app.ui.syncStatus();
    ctx.app.refresh();
  });

  Cmd.add(['ORTO', 'ORTHO'], { group: 'settings', title: 'Orto', transparent: true }, async function (ctx) {
    var r = await ctx.getKeyword('Indique modo', ['ACT', 'DES'], { def: ctx.doc.vars.ORTHOMODE ? 'DES' : 'ACT' });
    if (!r) return;
    ctx.doc.vars.ORTHOMODE = r.kw === 'A' ? 1 : 0;
    ctx.app.ui.syncStatus();
  });

  Cmd.add(['MODIVAR', 'SETVAR', 'SET'], { group: 'settings', title: 'Variables de sistema', transparent: true }, async function (ctx, args) {
    var doc = ctx.doc;
    var name = args && args[0] ? args[0] : await ctx.getString('Indique nombre de variable o [?]');
    if (!name) return;
    var up = String(name).trim().toUpperCase();
    if (up === '?') {
      var lines = Object.keys(doc.vars).sort().map(function (k) {
        var v = doc.vars[k];
        return k.padEnd(18) + (typeof v === 'object' ? JSON.stringify(v) : String(v));
      });
      ctx.app.ui.textWindow('Variables de sistema', lines.join('\n'));
      return;
    }
    if (doc.vars[up] === undefined) { ctx.err('*Variable desconocida*  Escriba MODIVAR ? para obtener una lista de variables.'); return; }
    var cur = doc.vars[up];
    if (typeof cur === 'object') { ctx.out(up + ' = ' + JSON.stringify(cur)); return; }
    var nv = await ctx.getString('Indique nuevo valor para ' + up + ' <' + cur + '>', { allowNone: true });
    if (nv === null || nv === '') { ctx.out(up + ' = ' + cur); return; }
    var num = CAD.num(nv);
    doc.vars[up] = isNaN(num) ? nv : num;
    ctx.app.ui.syncStatus();
    ctx.app.refresh();
  });

  /* ============================================================
     LIMPIAR / RENOMBRAR
     ============================================================ */
  Cmd.add(['LIMPIA', 'PURGE', 'PU'], { group: 'file', title: 'Limpiar' }, async function (ctx) {
    var doc = ctx.doc;
    var usedLayers = {}, usedBlocks = {};
    doc.entities.forEach(function (e) {
      usedLayers[e.layer] = 1;
      if (e.type === 'INSERT') usedBlocks[e.name] = 1;
    });
    Object.keys(doc.blocks).forEach(function (bn) {
      doc.blocks[bn].entities.forEach(function (e) {
        usedLayers[e.layer] = 1;
        if (e.type === 'INSERT') usedBlocks[e.name] = 1;
      });
    });
    var delLayers = doc.layerOrder.filter(function (n) { return !usedLayers[n] && n !== '0' && n !== doc.vars.CLAYER && n !== 'Defpoints'; });
    var delBlocks = Object.keys(doc.blocks).filter(function (n) { return !usedBlocks[n] && n[0] !== '*'; });
    if (!delLayers.length && !delBlocks.length) { ctx.out('No hay elementos no utilizados que eliminar.'); return; }
    var ok = await ctx.app.ui.confirmDialog('Se eliminarán ' + delLayers.length + ' capa(s) y ' + delBlocks.length + ' bloque(s) no utilizados. ¿Continuar?');
    if (!ok) return;
    ctx.doc.mark('LIMPIA');
    delLayers.forEach(function (n) { doc.deleteLayer(n); });
    delBlocks.forEach(function (n) { delete doc.blocks[n]; });
    ctx.out('Se han eliminado ' + delLayers.length + ' capa(s) y ' + delBlocks.length + ' bloque(s).');
    ctx.app.ui.syncStatus();
    ctx.app.refresh();
  });

  /* ============================================================
     AYUDA
     ============================================================ */
  Cmd.add(['AYUDA', 'HELP', '?'], { group: 'help', title: 'Ayuda', transparent: true }, async function (ctx) {
    ctx.app.ui.helpDialog();
  });
  Cmd.add(['ACERCADE', 'ABOUT'], { group: 'help', title: 'Acerca de' }, async function (ctx) {
    ctx.app.ui.aboutDialog();
  });

  Cmd.add(['LIMPIAPANTALLA', 'CLEANSCREENON', 'CLEANSCREEN'], { group: 'view', title: 'Pantalla limpia', transparent: true }, async function (ctx) {
    ctx.app.ui.toggleCleanScreen();
  });
})();
