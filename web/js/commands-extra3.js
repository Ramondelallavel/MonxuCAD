/* ============================================================
   commands-extra3.js — Anotación avanzada, gestión de capas,
   bloques, consulta y utilidades de sólidos.
   ============================================================ */
(function () {
  'use strict';
  var CAD = window.CAD, G = CAD.G, G3 = CAD.G3, E = CAD.E, Cmd = CAD.Cmd, CU = CAD.CU;
  var M = CAD.Mesh, S = CAD.Solid, CSG = CAD.CSG;
  var isKw = CU.isKw;
  function pt(v) { return v && v.x !== undefined ? v : null; }
  function num(v) { return typeof v === 'number' && isFinite(v); }
  function kw(v) { return v && v.kw ? v.kw : null; }
  var v3 = G3 ? G3.v : null;

  /* ============================================================
     TOLERANCIA — marco de control de tolerancia geométrica (GD&T)
     ============================================================ */
  var GDT = CAD.GDT = {
    /* símbolos ISO 1101 dibujados con trazos: no dependen de una fuente */
    RECTITUD:      { code: 'straight', label: 'Rectitud' },
    PLANITUD:      { code: 'flat', label: 'Planitud' },
    REDONDEZ:      { code: 'round', label: 'Redondez' },
    CILINDRICIDAD: { code: 'cyl', label: 'Cilindricidad' },
    PERFILLINEA:   { code: 'profline', label: 'Perfil de línea' },
    PERFILSUP:     { code: 'profsurf', label: 'Perfil de superficie' },
    ANGULARIDAD:   { code: 'angle', label: 'Angularidad' },
    PERPENDICULAR: { code: 'perp', label: 'Perpendicularidad' },
    PARALELISMO:   { code: 'para', label: 'Paralelismo' },
    POSICION:      { code: 'pos', label: 'Posición' },
    CONCENTRICIDAD:{ code: 'conc', label: 'Concentricidad' },
    SIMETRIA:      { code: 'sym', label: 'Simetría' },
    ALABEOCIRC:    { code: 'runout', label: 'Alabeo circular' },
    ALABEOTOTAL:   { code: 'trunout', label: 'Alabeo total' }
  };

  Cmd.add(['TOLERANCIA', 'TOLERANCE'], { group: 'annot', icon: 'gdt', title: 'Tolerancia geométrica' },
  async function (ctx) {
    var names = Object.keys(GDT);
    ctx.out('Características: ' + names.map(function (n) { return n.charAt(0) + n.slice(1).toLowerCase(); }).join(', '));
    var r = await ctx.getKeyword('Indique la característica', names, { def: 'POSICION' });
    if (!r) return;
    var sym = GDT[r.keyword] || GDT.POSICION;
    var val = await ctx.getString('Valor de la tolerancia', { def: '0.05' });
    if (val === null) return;
    var mod = await ctx.getKeyword('Modificador de material', ['Ninguno', 'Máximo material', 'mÍnimo material', 'Sin importar tamaño'], { def: 'Ninguno' });
    var dat = await ctx.getString('Referencias (separadas por comas, Intro si no hay)', { def: '' });
    var p = await ctx.getPoint('Precise la ubicación del marco');
    if (!pt(p)) return;
    ctx.doc.mark('TOLERANCIA');
    var h = ctx.doc.vars.TEXTSIZE || 2.5;
    var mk = kw(mod);
    var tol = String(val) + (mk === 'M' ? ' Ⓜ' : mk === 'Í' ? ' Ⓛ' : mk === 'S' ? ' Ⓢ' : '');
    var cells = [symText(sym.code), tol];
    if (dat) String(dat).split(/[,;]/).forEach(function (d) { if (d.trim()) cells.push(d.trim().toUpperCase()); });
    drawFrame(ctx, p, cells, h);
    ctx.app.refresh(true);
    ctx.out('Marco de tolerancia: ' + sym.label + ' ' + tol + (dat ? '  ref. ' + dat : ''));
  });

  function symText(code) {
    var T = {
      straight: '—', flat: '▱', round: '○', cyl: '⌭', profline: '⌒', profsurf: '⌓',
      angle: '∠', perp: '⊥', para: '∥', pos: '⊕', conc: '◎', sym: '⌯',
      runout: '↗', trunout: '⌰'
    };
    return T[code] || '⊕';
  }

  /* Dibuja el marco rectangular dividido en celdas */
  function drawFrame(ctx, p, cells, h) {
    var pad = h * 0.45;
    var x = p.x, y = p.y;
    var top = y + h / 2 + pad, bot = y - h / 2 - pad;
    var lay = ctx.doc.vars.CLAYER;
    var xs = [x];
    for (var i = 0; i < cells.length; i++) {
      var w = Math.max(h * 1.6, cells[i].length * h * 0.62) + pad * 2;
      var x2 = xs[i] + w;
      xs.push(x2);
      ctx.doc.add(E.text({ x: (xs[i] + x2) / 2, y: y }, h, cells[i], 0,
                         { layer: lay, attach: 5 }));
      if (i) ctx.doc.add(E.line({ x: xs[i], y: top }, { x: xs[i], y: bot }, { layer: lay }));
    }
    var xe = xs[xs.length - 1];
    ctx.doc.add(E.pline([{ x: x, y: bot }, { x: xe, y: bot }, { x: xe, y: top }, { x: x, y: top }],
                        true, { layer: lay }));
  }

  /* ============================================================
     DIRECTRIZM — directriz múltiple con línea de referencia
     ============================================================ */
  Cmd.add(['DIRECTRIZM', 'MLEADER', 'DIRM'], { group: 'annot', icon: 'leader', title: 'Directriz múltiple' },
  async function (ctx) {
    var a = await ctx.getPoint('Precise la ubicación de la punta de flecha o', { keywords: ['Contenido primero', 'Opciones'] });
    if (!pt(a)) return;
    var b = await ctx.getPoint('Precise la ubicación de la línea de referencia', { base: a });
    if (!pt(b)) return;
    var h = ctx.doc.vars.TEXTSIZE || 2.5;
    var txt = ctx.app.ui.textDialog ? await ctx.app.ui.textDialog('', { title: 'Texto de la directriz', height: h })
                                    : await ctx.getString('Texto');
    if (txt === null || txt === undefined) return;
    ctx.doc.mark('DIRECTRIZM');
    var lay = ctx.doc.vars.CLAYER;
    var right = b.x >= a.x;
    var land = h * 2.2;
    var c = { x: b.x + (right ? land : -land), y: b.y };
    var ld = E.leader([a, b, c], '', { layer: lay });
    ld.h = h;
    ctx.doc.add(ld);
    var lines = String(txt).split('\n');
    for (var i = 0; i < lines.length; i++) {
      ctx.doc.add(E.text({ x: c.x + (right ? h * 0.4 : -h * 0.4), y: b.y + (lines.length - 1) * h * 0.7 - i * h * 1.4 },
        h, lines[i], 0, { layer: lay, attach: right ? 4 : 6 }));
    }
    ctx.app.refresh(true);
    ctx.out('Directriz múltiple creada.');
  });

  /* ============================================================
     ACOTAESPACIO — reparte cotas paralelas a igual distancia
     ============================================================ */
  Cmd.add(['ACOTAESPACIO', 'DIMSPACE'], { group: 'annot', icon: 'dimlin', title: 'Espaciar cotas' },
  async function (ctx) {
    var base = await ctx.getEntity('Designe la cota base');
    if (!base || !base.ent || base.ent.type !== 'DIMENSION') { ctx.err('Debe designar una cota.'); return; }
    ctx.app.selSet = [];
    var sel = await ctx.getSelection('Designe las cotas a espaciar', { force: true });
    if (!sel || !sel.length) return;
    var dims = sel.filter(function (e) { return e.type === 'DIMENSION' && e !== base.ent; });
    if (!dims.length) { ctx.err('No se han designado cotas.'); return; }
    var d = await ctx.getDist('Precise el valor del espaciado o', { keywords: ['Automatico'], def: 0 });
    var auto = isKw(d) || !num(d) || d === 0;
    var st = ctx.doc.dimStyles[base.ent.style] || ctx.doc.dimStyles['ISO-25'];
    var gap = auto ? (st.DIMTXT * (st.DIMSCALE || 1) * 2) : Math.abs(d);
    ctx.doc.mark('ACOTAESPACIO');
    /* dirección perpendicular a la línea de cota base */
    var bd = base.ent;
    var dir = bd.p1 && bd.p2 ? G.norm({ x: bd.p2.x - bd.p1.x, y: bd.p2.y - bd.p1.y }) : { x: 1, y: 0 };
    var nrm = { x: -dir.y, y: dir.x };
    /* ordena por distancia con signo a la base */
    var org = bd.dimline || bd.p1;
    dims.forEach(function (e) {
      var o = e.dimline || e.p1;
      e._d = (o.x - org.x) * nrm.x + (o.y - org.y) * nrm.y;
    });
    dims.sort(function (a, b) { return Math.abs(a._d) - Math.abs(b._d); });
    var n = 0;
    dims.forEach(function (e, i) {
      var sgn = e._d < 0 ? -1 : 1;
      var target = gap * (i + 1) * sgn;
      var dd = target - e._d;
      if (Math.abs(dd) < 1e-9) { delete e._d; return; }
      E.transform(e, G.M(1, 0, 0, 1, nrm.x * dd, nrm.y * dd), ctx.doc);
      delete e._d;
      n++;
    });
    ctx.app.refresh(true);
    ctx.out(n + ' cota(s) espaciada(s) a ' + G.fmt(gap, 3) + '.');
  });

  /* ============================================================
     ACOTACORTE — rompe la línea de cota donde cruza otro objeto
     ============================================================ */
  Cmd.add(['ACOTACORTE', 'DIMBREAK'], { group: 'annot', icon: 'dimlin', title: 'Cortar cota' },
  async function (ctx) {
    var r = await ctx.getEntity('Designe la cota o directriz a la que añadir el corte');
    if (!r || !r.ent) return;
    var e = r.ent;
    if (e.type !== 'DIMENSION' && e.type !== 'LEADER') { ctx.err('Debe designar una cota o una directriz.'); return; }
    var k = await ctx.getKeyword('Designe el objeto que cruza o', ['Automatico', 'Manual', 'Eliminar'], { def: 'Automatico' });
    ctx.doc.mark('ACOTACORTE');
    if (kw(k) === 'E') {
      ctx.doc.touch(e);
      delete e.breaks;
      ctx.app.refresh(true);
      ctx.out('Cortes eliminados.');
      return;
    }
    var size = (ctx.doc.dimStyles[e.style] || ctx.doc.dimStyles['ISO-25']).DIMTXT * 1.5;
    var segs = E.segs(e, ctx.doc, 'high');
    var brk = [];
    var others = ctx.doc.ents().filter(function (o) {
      return o !== e && o.type !== 'DIMENSION' && !o.hidden;
    });
    segs.forEach(function (sg) {
      var pts = sg.pts || sg;
      for (var i = 0; i + 1 < pts.length; i++) {
        others.forEach(function (o) {
          var os = E.segs(o, ctx.doc, 'low');
          if (!os) return;
          os.forEach(function (s2) {
            var q = s2.pts || s2;
            for (var j = 0; j + 1 < q.length; j++) {
              var ip = G.interSeg ? G.interSeg(pts[i], pts[i + 1], q[j], q[j + 1])
                                  : segInter(pts[i], pts[i + 1], q[j], q[j + 1]);
              if (ip) brk.push({ p: ip, r: size / 2 });
            }
          });
        });
      }
    });
    if (!brk.length) { ctx.doc.discardTx(); ctx.out('No se han encontrado cruces.'); return; }
    ctx.doc.touch(e);
    e.breaks = brk;
    ctx.app.refresh(true);
    ctx.out(brk.length + ' corte(s) añadido(s) a la cota.');
  });

  function segInter(a, b, c, d) {
    var r = { x: b.x - a.x, y: b.y - a.y }, s = { x: d.x - c.x, y: d.y - c.y };
    var den = r.x * s.y - r.y * s.x;
    if (Math.abs(den) < 1e-12) return null;
    var t = ((c.x - a.x) * s.y - (c.y - a.y) * s.x) / den;
    var u = ((c.x - a.x) * r.y - (c.y - a.y) * r.x) / den;
    if (t < 0 || t > 1 || u < 0 || u > 1) return null;
    return { x: a.x + r.x * t, y: a.y + r.y * t };
  }

  /* ============================================================
     INVERTIR — invierte el sentido de una curva
     ============================================================ */
  Cmd.add(['INVERTIR', 'REVERSE'], { group: 'modify', icon: 'reverse', title: 'Invertir sentido' },
  async function (ctx) {
    var sel = await ctx.getSelection('Designe línea, polilínea, spline o arco a invertir');
    if (!sel || !sel.length) return;
    ctx.doc.mark('INVERTIR');
    var n = 0;
    sel.forEach(function (e) {
      if (e.type === 'LINE') {
        ctx.doc.touch(e);
        var t = e.p1; e.p1 = e.p2; e.p2 = t; n++;
      } else if (e.type === 'LWPOLYLINE') {
        ctx.doc.touch(e);
        var vs = e.verts.slice().reverse();
        /* los abombamientos se desplazan y cambian de signo */
        var bul = e.verts.map(function (v) { return v.b || 0; });
        for (var i = 0; i < vs.length; i++) {
          var src = e.closed ? bul[(e.verts.length - 1 - i - 1 + e.verts.length) % e.verts.length]
                             : (i < vs.length - 1 ? bul[e.verts.length - 2 - i] : 0);
          vs[i] = { x: vs[i].x, y: vs[i].y, b: -(src || 0), sw: vs[i].ew || 0, ew: vs[i].sw || 0 };
        }
        e.verts = vs;
        n++;
      } else if (e.type === 'ARC') {
        ctx.doc.touch(e);
        var a = e.a0; e.a0 = e.a1; e.a1 = a; n++;
      } else if (e.type === 'SPLINE') {
        ctx.doc.touch(e);
        e.fit = e.fit.slice().reverse();
        if (e.ctrl) e.ctrl = e.ctrl.slice().reverse();
        n++;
      } else if (e.type === 'ELLIPSE') {
        ctx.doc.touch(e);
        var t0 = e.t0; e.t0 = e.t1; e.t1 = t0; n++;
      }
    });
    if (!n) { ctx.doc.discardTx(); ctx.err('Ninguno de los objetos admite inversión.'); return; }
    ctx.app.refresh(true);
    ctx.out(n + ' objeto(s) invertido(s).');
  });

  /* ============================================================
     GESTIÓN DE CAPAS
     ============================================================ */
  Cmd.add(['CAPAFUS', 'LAYMRG', 'FUSIONARCAPA'], { group: 'layer', icon: 'layer', title: 'Fusionar capas' },
  async function (ctx) {
    var src = await ctx.getEntity('Designe un objeto de la capa a fusionar');
    if (!src || !src.ent) return;
    var from = src.ent.layer;
    if (from === '0') { ctx.err('La capa 0 no se puede fusionar.'); return; }
    var dst = await ctx.getEntity('Designe un objeto de la capa de destino o', { keywords: ['Nombre'] });
    var to;
    if (isKw(dst)) {
      to = await ctx.app.ui.listDialog('Capa de destino', ctx.doc.layerOrder, ctx.doc.vars.CLAYER);
      if (!to) return;
    } else {
      if (!dst || !dst.ent) return;
      to = dst.ent.layer;
    }
    if (to === from) { ctx.err('Las dos capas son la misma.'); return; }
    var k = await ctx.getKeyword('Se fusionará "' + from + '" en "' + to + '" y se eliminará. ¿Continuar?',
                                 ['Si', 'No'], { def: 'Si' });
    if (kw(k) !== 'S') return;
    ctx.doc.mark('CAPAFUS');
    var n = 0;
    ctx.doc.ents().forEach(function (e) {
      if (e.layer !== from) return;
      ctx.doc.touch(e);
      e.layer = to;
      n++;
    });
    if (ctx.doc.vars.CLAYER === from) ctx.doc.vars.CLAYER = to;
    ctx.doc.deleteLayer(from);
    ctx.app.refresh(true);
    ctx.out(n + ' objeto(s) movido(s) a "' + to + '". Capa "' + from + '" eliminada.');
  });

  Cmd.add(['CAPADEL', 'LAYDEL', 'ELIMINARCAPA'], { group: 'layer', icon: 'layer', title: 'Eliminar capa' },
  async function (ctx) {
    var src = await ctx.getEntity('Designe un objeto de la capa a eliminar o', { keywords: ['Nombre'] });
    var name;
    if (isKw(src)) {
      name = await ctx.app.ui.listDialog('Capa a eliminar', ctx.doc.layerOrder, ctx.doc.vars.CLAYER);
      if (!name) return;
    } else {
      if (!src || !src.ent) return;
      name = src.ent.layer;
    }
    var cnt = ctx.doc.ents().filter(function (e) { return e.layer === name; }).length;
    var k = await ctx.getKeyword('Se eliminarán la capa "' + name + '" y sus ' + cnt + ' objeto(s). ¿Continuar?',
                                 ['Si', 'No'], { def: 'No' });
    if (kw(k) !== 'S') return;
    ctx.doc.mark('CAPADEL');
    var doomed = ctx.doc.ents().filter(function (e) { return e.layer === name; });
    doomed.forEach(function (e) { ctx.doc.remove(e); });
    var err = ctx.doc.deleteLayer(name);
    if (err) { ctx.doc.discardTx(); ctx.err(err); return; }
    ctx.app.selSet = [];
    ctx.app.refresh(true);
    ctx.out('Capa "' + name + '" y ' + doomed.length + ' objeto(s) eliminados.');
  });

  Cmd.add(['COPIAACAPA', 'COPYTOLAYER'], { group: 'layer', icon: 'layer', title: 'Copiar a capa' },
  async function (ctx) {
    var sel = await ctx.getSelection('Designe los objetos a copiar');
    if (!sel || !sel.length) return;
    var to = await ctx.app.ui.listDialog('Capa de destino', ctx.doc.layerOrder, ctx.doc.vars.CLAYER);
    if (!to) return;
    var b = await ctx.getPoint('Precise punto base o (Intro para no desplazar)', { allowEmpty: true });
    var dx = 0, dy = 0;
    if (pt(b)) {
      var d = await ctx.getPoint('Precise segundo punto', { base: b });
      if (pt(d)) { dx = d.x - b.x; dy = d.y - b.y; }
    }
    ctx.doc.mark('COPIAACAPA');
    sel.forEach(function (e) {
      var c = E.deep(e);
      c.id = 0;
      c.layer = to;
      ctx.doc.add(c);
      if (dx || dy) E.transform(c, G.M(1, 0, 0, 1, dx, dy), ctx.doc);
    });
    ctx.app.refresh(true);
    ctx.out(sel.length + ' objeto(s) copiado(s) a la capa "' + to + '".');
  });

  Cmd.add(['CAMBIARACAPA', 'LAYMCH'], { group: 'layer', icon: 'layer', title: 'Cambiar a capa de' },
  async function (ctx) {
    var sel = await ctx.getSelection('Designe los objetos a cambiar');
    if (!sel || !sel.length) return;
    ctx.app.selSet = [];
    var dst = await ctx.getEntity('Designe un objeto de la capa de destino o', { keywords: ['Nombre'] });
    var to;
    if (isKw(dst)) {
      to = await ctx.app.ui.listDialog('Capa de destino', ctx.doc.layerOrder, ctx.doc.vars.CLAYER);
      if (!to) return;
    } else {
      if (!dst || !dst.ent) return;
      to = dst.ent.layer;
    }
    ctx.doc.mark('CAMBIARACAPA');
    sel.forEach(function (e) { ctx.doc.touch(e); e.layer = to; });
    ctx.app.refresh(true);
    ctx.out(sel.length + ' objeto(s) cambiado(s) a la capa "' + to + '".');
  });

  /* ============================================================
     BLOQUES
     ============================================================ */
  Cmd.add(['CONTARBLOQ', 'COUNT', 'CONTAR'], { group: 'insert', icon: 'block', title: 'Contar bloques' },
  async function (ctx) {
    var tally = {}, total = 0;
    ctx.doc.ents().forEach(function (e) {
      if (e.type !== 'INSERT') return;
      tally[e.name] = (tally[e.name] || 0) + 1;
      total++;
    });
    var names = Object.keys(tally).sort();
    if (!names.length) { ctx.out('El dibujo no contiene referencias a bloques.'); return; }
    ctx.out('=== RECUENTO DE BLOQUES ===');
    var w = Math.max.apply(null, names.map(function (n) { return n.length; }));
    names.forEach(function (n) {
      ctx.out('  ' + n + Array(Math.max(1, w - n.length + 3)).join(' ') + tally[n]);
    });
    ctx.out('  ' + names.length + ' bloque(s) distinto(s), ' + total + ' referencia(s) en total.');
    var k = await ctx.getKeyword('¿Insertar la tabla de recuento en el dibujo?', ['Si', 'No'], { def: 'No' });
    if (kw(k) !== 'S') return;
    var p = await ctx.getPoint('Precise la esquina superior izquierda de la tabla');
    if (!pt(p)) return;
    ctx.doc.mark('CONTARBLOQ');
    var rows = [['BLOQUE', 'CANTIDAD']].concat(names.map(function (n) { return [n, String(tally[n])]; }));
    rows.push(['TOTAL', String(total)]);
    makeTable(ctx, p, rows, ctx.doc.vars.TEXTSIZE || 2.5);
    ctx.app.refresh(true);
    ctx.out('Tabla de recuento insertada.');
  });

  /* Tabla sencilla con líneas y texto (sirve a varios comandos) */
  function makeTable(ctx, p, rows, h) {
    var lay = ctx.doc.vars.CLAYER;
    var cols = rows[0].length;
    var wid = [];
    for (var c = 0; c < cols; c++) {
      var w = 0;
      for (var r = 0; r < rows.length; r++) w = Math.max(w, String(rows[r][c] || '').length);
      wid.push(Math.max(h * 4, w * h * 0.65) + h * 1.2);
    }
    var rh = h * 2;
    var x0 = p.x, y0 = p.y;
    var totalW = wid.reduce(function (a, b) { return a + b; }, 0);
    for (r = 0; r <= rows.length; r++) {
      var y = y0 - r * rh;
      ctx.doc.add(E.line({ x: x0, y: y }, { x: x0 + totalW, y: y }, { layer: lay }));
    }
    var x = x0;
    for (c = 0; c <= cols; c++) {
      ctx.doc.add(E.line({ x: x, y: y0 }, { x: x, y: y0 - rows.length * rh }, { layer: lay }));
      if (c < cols) x += wid[c];
    }
    for (r = 0; r < rows.length; r++) {
      x = x0;
      for (c = 0; c < cols; c++) {
        var txt = String(rows[r][c] === undefined ? '' : rows[r][c]);
        ctx.doc.add(E.text({ x: x + h * 0.6, y: y0 - r * rh - rh / 2 }, h, txt, 0,
                           { layer: lay, attach: 4 }));
        x += wid[c];
      }
    }
    return { w: totalW, h: rows.length * rh };
  }
  CAD.makeTable = makeTable;

  Cmd.add(['ATRVISUAL', 'ATTDISP'], { group: 'insert', icon: 'attdef', title: 'Visualización de atributos' },
  async function (ctx) {
    var k = await ctx.getKeyword('Indique la visualización de atributos',
                                 ['Normal', 'ACtivado', 'DEsactivado'], { def: 'Normal' });
    if (!k) return;
    ctx.doc.mark('ATRVISUAL');
    var m = kw(k);
    ctx.doc.vars.ATTMODE = m === 'AC' ? 2 : (m === 'DE' ? 0 : 1);
    ctx.app.refresh(true);
    ctx.out('ATTMODE = ' + ctx.doc.vars.ATTMODE + ' (' +
            (m === 'AC' ? 'todos visibles' : m === 'DE' ? 'todos ocultos' : 'normal') + ')');
  });

  Cmd.add(['ATREXT', 'ATTEXT', 'EXTRAERATRIBUTOS'], { group: 'insert', icon: 'attdef', title: 'Extraer atributos' },
  async function (ctx) {
    var rows = [], tags = [];
    ctx.doc.ents().forEach(function (e) {
      if (e.type !== 'INSERT' || !e.attribs || !e.attribs.length) return;
      var rec = { BLOQUE: e.name, X: G.fmt(e.p.x, 4), Y: G.fmt(e.p.y, 4) };
      e.attribs.forEach(function (a) {
        rec[a.tag] = a.text === undefined ? '' : a.text;
        if (tags.indexOf(a.tag) < 0) tags.push(a.tag);
      });
      rows.push(rec);
    });
    if (!rows.length) { ctx.out('No hay bloques con atributos en el dibujo.'); return; }
    var cols = ['BLOQUE', 'X', 'Y'].concat(tags);
    var csv = [cols.join(';')];
    rows.forEach(function (r) {
      csv.push(cols.map(function (c) {
        var v = String(r[c] === undefined ? '' : r[c]);
        return /[;"\n]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v;
      }).join(';'));
    });
    var txt = csv.join('\n') + '\n';
    ctx.out(rows.length + ' bloque(s) con atributos, ' + tags.length + ' etiqueta(s): ' + tags.join(', '));
    var k = await ctx.getKeyword('Formato de salida', ['Csv a archivo', 'Tabla en el dibujo', 'Ver en pantalla'], { def: 'Csv a archivo' });
    var m = kw(k);
    if (m === 'V') { ctx.app.ui.textViewer('Atributos extraídos', txt); return; }
    if (m === 'C') {
      var base = (ctx.doc.name || 'Dibujo1').replace(/\.[^.]+$/, '');
      await CAD.Exporter.saveFile(ctx.app, base + '-atributos.csv', txt, 'text');
      return;
    }
    var p = await ctx.getPoint('Precise la esquina superior izquierda de la tabla');
    if (!pt(p)) return;
    ctx.doc.mark('ATREXT');
    var tr = [cols].concat(rows.map(function (r) {
      return cols.map(function (c) { return r[c] === undefined ? '' : r[c]; });
    }));
    makeTable(ctx, p, tr, ctx.doc.vars.TEXTSIZE || 2.5);
    ctx.app.refresh(true);
    ctx.out('Tabla de atributos insertada (' + rows.length + ' filas).');
  });

  /* ============================================================
     SÓLIDOS: HÉLICE, SUPERFICIE PLANA, VACIADO, ARISTAS
     ============================================================ */
  Cmd.add(['HELICE', 'HELIX'], { group: '3d', icon: 'helix', title: 'Hélice' },
  async function (ctx) {
    var c = await ctx.getPoint('Precise el punto central de la base');
    if (!pt(c)) return;
    var r1 = await ctx.getDist('Precise el radio de la base o', { base: c, keywords: ['Diametro'] });
    if (isKw(r1)) { var d1 = await ctx.getDist('Precise el diámetro de la base', { base: c }); if (!num(d1)) return; r1 = d1 / 2; }
    if (!num(r1)) return;
    var r2 = await ctx.getDist('Precise el radio superior o', { base: c, keywords: ['Diametro'], def: r1 });
    if (isKw(r2)) { var d2 = await ctx.getDist('Precise el diámetro superior', { base: c }); if (!num(d2)) return; r2 = d2 / 2; }
    if (!num(r2)) r2 = r1;
    var turns = await ctx.getReal('Introduzca el número de vueltas', { def: 3 });
    if (!num(turns) || turns <= 0) return;
    var hh = await ctx.getDist('Precise la altura de la hélice o', { keywords: ['Altura de vuelta', 'giro hOrario'], def: r1 * 2 });
    var pitch = null;
    if (isKw(hh) && hh.kw === 'A') {
      pitch = await ctx.getDist('Precise la altura de vuelta');
      if (!num(pitch)) return;
      hh = pitch * turns;
    }
    if (!num(hh)) return;
    var ccw = true;
    ctx.doc.mark('HELICE');
    var seg = Math.max(16, Math.round(turns * 32));
    var pts = [];
    for (var i = 0; i <= seg; i++) {
      var t = i / seg;
      var a = Math.PI * 2 * turns * t * (ccw ? 1 : -1);
      var rr = r1 + (r2 - r1) * t;
      pts.push({ x: c.x + rr * Math.cos(a), y: c.y + rr * Math.sin(a), z: (c.z || 0) + hh * t });
    }
    var sp = E.spline(pts.map(function (p) { return { x: p.x, y: p.y }; }), false, { layer: ctx.doc.vars.CLAYER });
    sp.helix = { c: { x: c.x, y: c.y, z: c.z || 0 }, r1: r1, r2: r2, turns: turns, h: hh, ccw: ccw };
    sp.pts3 = pts;
    ctx.doc.add(sp);
    ctx.app.refresh(true);
    ctx.out('Hélice: ' + G.fmt(turns, 2) + ' vueltas, altura ' + G.fmt(hh, 3) +
            ', altura de vuelta ' + G.fmt(hh / turns, 4) +
            ', longitud ≈ ' + G.fmt(helixLen(r1, r2, turns, hh), 3));
  });
  function helixLen(r1, r2, n, h) {
    var rm = (r1 + r2) / 2;
    return Math.sqrt(Math.pow(2 * Math.PI * rm * n, 2) + h * h);
  }

  Cmd.add(['SUPERFICIEPLANA', 'PLANESURF'], { group: '3d', icon: 'planesurf', title: 'Superficie plana' },
  async function (ctx) {
    var r = await ctx.getPoint('Precise la primera esquina o', { keywords: ['Objeto'] });
    ctx.doc.mark('SUPERFICIEPLANA');
    if (isKw(r)) {
      ctx.doc.discardTx();
      var sel = await ctx.getSelection('Designe los objetos que delimitan la superficie');
      if (!sel || !sel.length) return;
      ctx.doc.mark('SUPERFICIEPLANA');
      var made = 0;
      sel.forEach(function (e) {
        var pr = S.profileOf(e, ctx.doc, 'high');
        if (!pr || pr.length < 3) return;
        var mesh = new M.Mesh([], []);
        pr.forEach(function (p) { mesh.verts.push(G3.v(p.x, p.y, p.z || 0)); });
        var f = [];
        for (var i = 0; i < pr.length; i++) f.push(i);
        mesh.faces.push(f);
        ctx.doc.add(S.mesh(mesh, { layer: e.layer, color: e.color }));
        made++;
      });
      if (!made) { ctx.doc.discardTx(); ctx.err('Ningún objeto delimita un contorno cerrado.'); return; }
      ctx.app.refresh(true);
      ctx.out(made + ' superficie(s) plana(s) creada(s).');
      return;
    }
    if (!pt(r)) { ctx.doc.discardTx(); return; }
    var q = await ctx.getPoint('Precise la otra esquina', { base: r });
    if (!pt(q)) { ctx.doc.discardTx(); return; }
    var z = ctx.doc.vars.ELEVATION || 0;
    var mesh2 = M.make([G3.v(r.x, r.y, z), G3.v(q.x, r.y, z), G3.v(q.x, q.y, z), G3.v(r.x, q.y, z)], [[0, 1, 2, 3]]);
    ctx.doc.add(S.mesh(mesh2, { layer: ctx.doc.vars.CLAYER }));
    ctx.app.refresh(true);
    ctx.out('Superficie plana ' + G.fmt(Math.abs(q.x - r.x), 3) + ' × ' + G.fmt(Math.abs(q.y - r.y), 3) + '.');
  });

  Cmd.add(['VACIAR', 'SHELL', 'ENVOLVENTE'], { group: '3d', icon: 'shell', title: 'Vaciar sólido' },
  async function (ctx) {
    var sel = await ctx.getSelection('Designe el sólido a vaciar');
    if (!sel || !sel.length) return;
    var sol = sel.filter(S.is3D);
    if (!sol.length) { ctx.err('No se han designado sólidos.'); return; }
    var t = await ctx.getDist('Precise el grosor de pared', { def: 2 });
    if (!num(t) || t <= 0) return;
    ctx.doc.mark('VACIAR');
    var n = 0;
    for (var i = 0; i < sol.length; i++) {
      var mesh = S.meshOf(sol[i]);
      if (!mesh) continue;
      var inner = CSG.offsetMesh(mesh, -Math.abs(t));
      if (!inner || !inner.faces.length) continue;
      var res;
      try { res = CSG.subtract(mesh, inner); } catch (err) { continue; }
      if (!res || !res.faces.length) continue;
      var vOut = Math.abs(mesh.volume()), vRes = Math.abs(res.volume());
      if (vRes < 1e-9 || vRes >= vOut * 0.999) continue;
      S.setMesh(sol[i], res, ctx.doc);
      n++;
    }
    if (!n) { ctx.doc.discardTx(); ctx.err('No se ha podido vaciar (¿el grosor es mayor que la pieza?).'); return; }
    ctx.app.refresh(true);
    ctx.out(n + ' sólido(s) vaciado(s) con pared de ' + G.fmt(t, 3) + '.');
  });

  Cmd.add(['EXTRAERARISTAS', 'XEDGES'], { group: '3d', icon: 'xedges', title: 'Extraer aristas' },
  async function (ctx) {
    var sel = await ctx.getSelection('Designe los sólidos');
    if (!sel || !sel.length) return;
    var sol = sel.filter(S.is3D);
    if (!sol.length) { ctx.err('No se han designado sólidos.'); return; }
    var ang = await ctx.getReal('Ángulo de arista viva en grados', { def: 18 });
    if (!num(ang)) ang = 18;
    ctx.doc.mark('EXTRAERARISTAS');
    var n = 0;
    sol.forEach(function (e) {
      var mesh = S.meshOf(e);
      if (!mesh) return;
      var ed = mesh.sharpEdges(ang);
      ed.forEach(function (k) {
        var a = mesh.verts[k[0]], b = mesh.verts[k[1]];
        var ln = E.line({ x: a.x, y: a.y }, { x: b.x, y: b.y }, { layer: e.layer, color: e.color });
        ln.p1.z = a.z; ln.p2.z = b.z;
        ctx.doc.add(ln);
        n++;
      });
    });
    if (!n) { ctx.doc.discardTx(); ctx.err('Sin aristas que extraer.'); return; }
    ctx.app.refresh(true);
    ctx.out(n + ' arista(s) extraída(s) como líneas.');
  });

  Cmd.add(['SEPARAR', 'SEPARATE', 'SEPARA'], { group: '3d', icon: 'separate', title: 'Separar sólidos' },
  async function (ctx) {
    var sel = await ctx.getSelection('Designe los sólidos compuestos');
    if (!sel || !sel.length) return;
    var sol = sel.filter(S.is3D);
    if (!sol.length) { ctx.err('No se han designado sólidos.'); return; }
    ctx.doc.mark('SEPARAR');
    var made = 0;
    sol.forEach(function (e) {
      var mesh = S.meshOf(e);
      if (!mesh) return;
      var parts = splitLumps(mesh);
      if (parts.length < 2) return;
      ctx.doc.remove(e);
      parts.forEach(function (m2) {
        ctx.doc.add(S.fromMesh(m2, { layer: e.layer, color: e.color }));
        made++;
      });
    });
    if (!made) { ctx.doc.discardTx(); ctx.out('Los sólidos designados son de una sola pieza.'); return; }
    ctx.app.refresh(true);
    ctx.out(made + ' sólido(s) independiente(s) obtenido(s).');
  });

  /* Componentes conexas por aristas compartidas */
  function splitLumps(mesh) {
    var nf = mesh.faces.length;
    if (!nf) return [];
    var emap = new Map(), i, j;
    for (i = 0; i < nf; i++) {
      var f = mesh.faces[i];
      for (j = 0; j < f.length; j++) {
        var a = f[j], b = f[(j + 1) % f.length];
        var k = a < b ? a + ',' + b : b + ',' + a;
        var l = emap.get(k);
        if (!l) { l = []; emap.set(k, l); }
        l.push(i);
      }
    }
    var adj = new Array(nf);
    for (i = 0; i < nf; i++) adj[i] = [];
    emap.forEach(function (l) {
      for (var x = 0; x < l.length; x++)
        for (var y = x + 1; y < l.length; y++) { adj[l[x]].push(l[y]); adj[l[y]].push(l[x]); }
    });
    var comp = new Int32Array(nf).fill(-1), nc = 0;
    for (i = 0; i < nf; i++) {
      if (comp[i] >= 0) continue;
      var stack = [i];
      comp[i] = nc;
      while (stack.length) {
        var t = stack.pop();
        for (j = 0; j < adj[t].length; j++) if (comp[adj[t][j]] < 0) { comp[adj[t][j]] = nc; stack.push(adj[t][j]); }
      }
      nc++;
    }
    if (nc < 2) return [mesh];
    var out = [];
    for (var c = 0; c < nc; c++) {
      var m2 = new M.Mesh([], []);
      var remap = new Map();
      for (i = 0; i < nf; i++) {
        if (comp[i] !== c) continue;
        var g = mesh.faces[i].map(function (k2) {
          if (!remap.has(k2)) { remap.set(k2, m2.verts.length); m2.verts.push(G3.copy(mesh.verts[k2])); }
          return remap.get(k2);
        });
        m2.faces.push(g);
      }
      if (m2.faces.length) out.push(m2);
    }
    return out;
  }

  Cmd.add(['CAJADELIM', 'BOUNDINGBOX', 'CAJAENVOLVENTE'], { group: '3d', icon: 'box3d', title: 'Caja delimitadora' },
  async function (ctx) {
    var sel = await ctx.getSelection('Designe los objetos');
    if (!sel || !sel.length) return;
    var box = null;
    sel.forEach(function (e) {
      if (S.is3D(e)) box = G3.boxMerge(box, S.box3(e));
      else {
        var b = E.extents(e, ctx.doc);
        if (b && isFinite(b.x1)) {
          var z = e.elev || 0;
          box = G3.boxMerge(box, { x1: b.x1, y1: b.y1, z1: z, x2: b.x2, y2: b.y2, z2: z });
        }
      }
    });
    if (!G3.boxValid(box)) { ctx.err('No se ha podido calcular la caja.'); return; }
    var s2 = G3.boxSize(box), c = G3.boxCenter(box);
    ctx.out('Caja delimitadora:');
    ctx.out('   X  ' + G.fmt(box.x1, 4) + '  a  ' + G.fmt(box.x2, 4) + '   long. ' + G.fmt(s2.x, 4));
    ctx.out('   Y  ' + G.fmt(box.y1, 4) + '  a  ' + G.fmt(box.y2, 4) + '   long. ' + G.fmt(s2.y, 4));
    ctx.out('   Z  ' + G.fmt(box.z1, 4) + '  a  ' + G.fmt(box.z2, 4) + '   long. ' + G.fmt(s2.z, 4));
    ctx.out('   Centro  ' + G.fmt(c.x, 4) + ', ' + G.fmt(c.y, 4) + ', ' + G.fmt(c.z, 4));
    ctx.out('   Diagonal ' + G.fmt(G3.boxDiag(box), 4));
    var k = await ctx.getKeyword('¿Dibujar la caja?', ['No', 'Rectángulo', 'Sólido'], { def: 'No' });
    var m = kw(k);
    if (m === 'N' || !m) return;
    ctx.doc.mark('CAJADELIM');
    if (m === 'R') {
      ctx.doc.add(E.pline([{ x: box.x1, y: box.y1 }, { x: box.x2, y: box.y1 },
                           { x: box.x2, y: box.y2 }, { x: box.x1, y: box.y2 }], true,
                          { layer: ctx.doc.vars.CLAYER }));
    } else {
      var e2 = S.solid({ op: 'box', l: s2.x, w: s2.y, h: Math.max(s2.z, 1e-6) }, { layer: ctx.doc.vars.CLAYER });
      e2.m = G3.mTrans(box.x1, box.y1, box.z1);
      ctx.doc.add(e2);
    }
    ctx.app.refresh(true);
    ctx.out('Caja delimitadora dibujada.');
  });

  /* ============================================================
     CONSULTA
     ============================================================ */
  Cmd.add(['VOLUMEN', 'VOLUME'], { group: 'inquiry', icon: 'massprop', title: 'Volumen' },
  async function (ctx) {
    var sel = await ctx.getSelection('Designe sólidos o contornos cerrados');
    if (!sel || !sel.length) return;
    var vol = 0, area = 0, n = 0;
    var dens = ctx.doc.vars.DENSITY || 0.00785;
    sel.forEach(function (e) {
      if (S.is3D(e)) {
        var m = S.meshOf(e);
        if (!m) return;
        vol += Math.abs(m.volume());
        area += m.area();
        n++;
      } else {
        var pr = S.profileOf(e, ctx.doc, 'high');
        if (pr && pr.length > 2 && pr.closed) {
          var a = Math.abs(G3.polyArea(pr));
          area += a;
          n++;
        }
      }
    });
    if (!n) { ctx.err('Nada que medir.'); return; }
    ctx.out('Objetos medidos: ' + n);
    if (vol) {
      ctx.out('  Volumen total:  ' + G.fmt(vol, 4) + ' mm³   (' + G.fmt(vol / 1000, 4) + ' cm³)');
      ctx.out('  Masa (ρ=' + dens + ' g/mm³): ' + G.fmt(vol * dens, 3) + ' g   (' + G.fmt(vol * dens / 1000, 4) + ' kg)');
    }
    ctx.out('  Área total:     ' + G.fmt(area, 4) + ' mm²');
  });

  /* ============================================================
     SCRIPT — ejecuta una secuencia de comandos
     ============================================================ */
  Cmd.add(['SCRIPT', 'GUION'], { group: 'tools', icon: 'script', title: 'Ejecutar guion' },
  async function (ctx) {
    var file = ctx.app.ui.pickFile ? await ctx.app.ui.pickFile('.scr,.txt') : null;
    var text = null;
    if (file) text = await file.text();
    else {
      text = await ctx.getString('Introduzca los comandos separados por ";"');
      if (!text) return;
      text = String(text).split(';').join('\n');
    }
    if (!text) return;
    var lines = text.split(/\r?\n/).map(function (l) { return l.trim(); })
      .filter(function (l) { return l && l[0] !== ';'; });
    if (!lines.length) { ctx.err('El guion está vacío.'); return; }
    ctx.out('Ejecutando ' + lines.length + ' línea(s)…');
    ctx.app.scriptQueue = lines;
    runScript(ctx.app);
  });

  /* Ejecuta la cola del guion línea a línea, dejando que cada comando
     consuma los datos que necesite antes de pasar al siguiente. */
  function runScript(app) {
    if (!app.scriptQueue || !app.scriptQueue.length) {
      if (app.scriptQueue) { app.scriptQueue = null; app.out('Guion terminado.', 'ok'); }
      return;
    }
    var line = app.scriptQueue.shift();
    try {
      if (line === '') app.feedEnter(); else app.feedInput(line);
    } catch (err) {
      app.out('Error en el guion: ' + err.message, 'err');
      app.scriptQueue = null;
      return;
    }
    setTimeout(function () { runScript(app); }, 12);
  }
  CAD.runScript = runScript;

  /* ============================================================
     FILTRO — designación por criterios
     ============================================================ */
  Cmd.add(['FILTRO', 'FILTER'], { group: 'edit', icon: 'qselect', title: 'Filtro de designación' },
  async function (ctx) {
    var doc = ctx.doc;
    var k = await ctx.getKeyword('Filtrar por', ['Tipo', 'CApa', 'COlor', 'Tipo de LÍnea', 'Grosor', 'Área'], { def: 'Tipo' });
    if (!k) return;
    var pool = doc.selectable ? doc.selectable() : doc.ents();
    var out = [], label = '';
    var m = kw(k);
    if (m === 'T') {
      var types = {};
      pool.forEach(function (e) { types[e.type] = (types[e.type] || 0) + 1; });
      var tn = Object.keys(types).sort();
      ctx.out('Tipos presentes: ' + tn.map(function (t) { return t + '(' + types[t] + ')'; }).join('  '));
      var t2 = await ctx.getString('Introduzca el tipo');
      if (!t2) return;
      var T = String(t2).toUpperCase();
      out = pool.filter(function (e) { return e.type === T; });
      label = 'tipo ' + T;
    } else if (m === 'CA') {
      var lay = await ctx.app.ui.listDialog('Capa', doc.layerOrder, doc.vars.CLAYER);
      if (!lay) return;
      out = pool.filter(function (e) { return e.layer === lay; });
      label = 'capa ' + lay;
    } else if (m === 'CO') {
      var col = await ctx.app.ui.colorDialog(256);
      if (col === null) return;
      out = pool.filter(function (e) { return (e.color === undefined ? 256 : e.color) === col; });
      label = 'color ' + col;
    } else if (m === 'TLÍ') {
      var lt = await ctx.app.ui.listDialog('Tipo de línea', Object.keys(doc.ltypes), 'ByLayer');
      if (!lt) return;
      out = pool.filter(function (e) { return (e.ltype || 'ByLayer') === lt; });
      label = 'tipo de línea ' + lt;
    } else if (m === 'G') {
      var lw = await ctx.getReal('Grosor de línea (centésimas de mm, -1 = por capa)', { def: -1 });
      if (!num(lw)) return;
      out = pool.filter(function (e) { return (e.lw === undefined ? -1 : e.lw) === lw; });
      label = 'grosor ' + lw;
    } else if (m === 'Á') {
      var mn = await ctx.getReal('Área mínima', { def: 0 });
      var mx = await ctx.getReal('Área máxima', { def: 1e12 });
      if (!num(mn) || !num(mx)) return;
      out = pool.filter(function (e) {
        var pr = S.profileOf(e, doc, 'low');
        if (!pr || !pr.closed) return false;
        var a = Math.abs(G3.polyArea(pr));
        return a >= mn && a <= mx;
      });
      label = 'área entre ' + G.fmt(mn, 3) + ' y ' + G.fmt(mx, 3);
    }
    if (!out.length) { ctx.out('Ningún objeto cumple el filtro (' + label + ').'); return; }
    ctx.app.selSet = out;
    ctx.app.refresh();
    ctx.out(out.length + ' objeto(s) designado(s) por ' + label + '.');
  });

  /* ============================================================
     COPIARANIDADO — copia objetos desde dentro de un bloque
     ============================================================ */
  Cmd.add(['COPIARANIDADO', 'NCOPY'], { group: 'modify', icon: 'copy', title: 'Copiar objetos anidados' },
  async function (ctx) {
    var r = await ctx.getEntity('Designe la referencia a bloque que contiene los objetos');
    if (!r || !r.ent || r.ent.type !== 'INSERT') { ctx.err('Debe designar una referencia a bloque.'); return; }
    var ins = r.ent;
    var blk = ctx.doc.blocks[ins.name];
    if (!blk || !blk.entities.length) { ctx.err('El bloque está vacío.'); return; }
    ctx.doc.mark('COPIARANIDADO');
    /* misma composición que usa doc.js para explotar una referencia */
    var bx = blk.base ? blk.base.x : 0, by = blk.base ? blk.base.y : 0;
    var m = G.mMul(G.mMul(G.mTrans(-bx, -by),
                          G.mScale(ins.sx === undefined ? 1 : ins.sx, ins.sy === undefined ? 1 : ins.sy)),
                   G.mMul(G.mRot(ins.rot || 0), G.mTrans(ins.p.x, ins.p.y)));
    var made = [];
    blk.entities.forEach(function (e) {
      var c = E.deep(e);
      c.id = 0;
      if (c.layer === '0') c.layer = ins.layer;
      ctx.doc.add(c);
      E.transform(c, m, ctx.doc);
      made.push(c);
    });
    ctx.app.selSet = made;
    ctx.app.refresh(true);
    ctx.out(made.length + ' objeto(s) copiado(s) fuera del bloque "' + ins.name + '".');
  });

  /* ============================================================
     ACOTAINSPECCION — marco de inspección sobre una cota
     ============================================================ */
  Cmd.add(['ACOTAINSPECCION', 'DIMINSPECT'], { group: 'annot', icon: 'dimlin', title: 'Cota de inspección' },
  async function (ctx) {
    var sel = await ctx.getSelection('Designe las cotas');
    if (!sel || !sel.length) return;
    var dims = sel.filter(function (e) { return e.type === 'DIMENSION'; });
    if (!dims.length) { ctx.err('No se han designado cotas.'); return; }
    var k = await ctx.getKeyword('Acción', ['Anadir', 'Quitar'], { def: 'Anadir' });
    if (kw(k) === 'Q') {
      ctx.doc.mark('ACOTAINSPECCION');
      dims.forEach(function (e) { ctx.doc.touch(e); delete e.inspect; });
      ctx.app.refresh(true);
      ctx.out('Marcos de inspección eliminados de ' + dims.length + ' cota(s).');
      return;
    }
    var lbl = await ctx.getString('Etiqueta de inspección', { def: 'A' });
    var rate = await ctx.getString('Índice de inspección (%)', { def: '100' });
    ctx.doc.mark('ACOTAINSPECCION');
    dims.forEach(function (e) {
      ctx.doc.touch(e);
      e.inspect = { label: String(lbl || ''), rate: String(rate || '') };
    });
    ctx.app.refresh(true);
    ctx.out(dims.length + ' cota(s) marcada(s) para inspección (' + lbl + ', ' + rate + '%).');
  });

  /* ============================================================
     MEDIDA DE PERÍMETRO Y LONGITUD TOTAL
     ============================================================ */
  Cmd.add(['LONGITUDTOTAL', 'TOTALLENGTH', 'SUMALONG'], { group: 'inquiry', icon: 'dist', title: 'Longitud total' },
  async function (ctx) {
    var sel = await ctx.getSelection('Designe los objetos a medir');
    if (!sel || !sel.length) return;
    var total = 0, byLayer = {}, n = 0;
    sel.forEach(function (e) {
      var L = entLength(e, ctx.doc);
      if (!L) return;
      total += L;
      byLayer[e.layer] = (byLayer[e.layer] || 0) + L;
      n++;
    });
    if (!n) { ctx.err('Ninguno de los objetos tiene longitud.'); return; }
    ctx.out('Objetos medidos: ' + n);
    Object.keys(byLayer).sort().forEach(function (l) {
      ctx.out('   Capa ' + l + ': ' + G.fmt(byLayer[l], 4));
    });
    ctx.out('   LONGITUD TOTAL: ' + G.fmt(total, 4) + '   (' + G.fmt(total / 1000, 4) + ' m)');
  });

  function entLength(e, doc) {
    if (e.type === 'LINE') return G.dist(e.p1, e.p2);
    if (e.type === 'CIRCLE') return 2 * Math.PI * e.r;
    if (e.type === 'ARC') {
      var d = e.a1 - e.a0;
      while (d < 0) d += Math.PI * 2;
      return d * e.r;
    }
    var segs = E.segs(e, doc, 'high');
    if (!segs) return 0;
    var L = 0;
    segs.forEach(function (s) {
      var p = s.pts || s;
      for (var i = 0; i + 1 < p.length; i++) L += G.dist(p[i], p[i + 1]);
      if (s.closed && p.length > 2) L += G.dist(p[p.length - 1], p[0]);
    });
    return L;
  }
  CAD.entLength = entLength;

  /* ============================================================
     EMPALMEARISTA y CHAFLANARISTA (3D)
     ============================================================ */
  Cmd.add(['EMPALMEARISTA', 'FILLETEDGE'], { group: '3d', icon: 'filletedge', title: 'Empalmar arista' },
  async function (ctx) {
    var sel = await ctx.getSelection('Designe el sólido');
    if (!sel || !sel.length) return;
    var sol = sel.filter(S.is3D);
    if (!sol.length) { ctx.err('No se han designado sólidos.'); return; }
    var r = await ctx.getDist('Precise el radio de empalme', { def: 2 });
    if (!num(r) || r <= 0) return;
    var ang = await ctx.getReal('Ángulo mínimo de arista a empalmar (grados)', { def: 60 });
    if (!num(ang)) ang = 60;
    ctx.out('Calculando empalmes…');
    ctx.doc.mark('EMPALMEARISTA');
    var done = 0, aviso = null;
    for (var i = 0; i < sol.length; i++) {
      var mesh = S.meshOf(sol[i]);
      if (!mesh) continue;
      var inf = {};
      var res = filletByEdges(mesh, r, ang, inf);
      if (!res) continue;
      /* queda como una operación más del árbol: después se le puede
         cambiar el radio o suprimirla */
      var e2 = S.solid({ op: 'fillet', r: r, ang: ang, src: S.nodeOf(sol[i]) },
                       { layer: sol[i].layer, color: sol[i].color });
      ctx.doc.remove(sol[i]);
      ctx.doc.add(e2);
      if (ctx.app.is3D) ctx.app.v3dDirty();
      done++;
      aviso = inf;
    }
    if (!done) { ctx.doc.discardTx(); ctx.err('No se ha encontrado ninguna arista que empalmar.'); return; }
    ctx.app.refresh(true);
    ctx.out(done + ' sólido(s) con aristas empalmadas R' + G.fmt(r, 3) + '.' +
            (aviso && aviso.rechazados ? '   ' + aviso.hechos + ' de ' + aviso.total +
             ' cadenas de aristas; ' + aviso.rechazados + ' no admiten ese radio y se han dejado vivas.' : ''));
  });

  /* Genera el prisma de recorte de una arista viva.
     Para cada arista con dos caras se construye la sección transversal en
     el plano perpendicular a la arista y se extruye a lo largo de ella.
       - chaflán: triángulo entre la arista y los dos puntos de tangencia
       - empalme: ese triángulo menos el arco de radio r tangente a ambas
     Es la construcción exacta, no una aproximación: para un ángulo
     diedro θ la distancia de tangencia es r·tan(φ/2) con φ el ángulo
     entre las normales salientes. */
  function edgeCutters(mesh, size, angDeg, round) {
    var lim = Math.cos((angDeg === undefined ? 60 : angDeg) * Math.PI / 180);
    var ed = mesh.edges();
    var nr = mesh.faces.map(function (f) { return mesh.faceNormal(f); });
    var out = [];
    for (var i = 0; i < ed.length; i++) {
      var e = ed[i];
      if (e.f.length !== 2) continue;
      var no1 = nr[e.f[0]], no2 = nr[e.f[1]];
      var cosF = G3.dot(no1, no2);
      if (cosF > lim) continue;                 /* arista poco marcada */
      if (cosF < -0.999) continue;              /* caras opuestas: sin esquina */
      var a = mesh.verts[e.a], b = mesh.verts[e.b];
      var t = G3.sub(b, a), L = G3.len(t);
      if (L < 1e-9) continue;
      t = G3.mul(t, 1 / L);

      /* direcciones dentro de cada cara, alejándose de la arista */
      var w1 = G3.norm(G3.cross(no1, t));
      if (G3.dot(w1, no2) > 0) w1 = G3.neg(w1);
      var w2 = G3.norm(G3.cross(no2, t));
      if (G3.dot(w2, no1) > 0) w2 = G3.neg(w2);

      /* sólo se recorta una esquina convexa (material por dentro) */
      var bis = G3.norm(G3.add(no1, no2));
      if (G3.len2(bis) < 1e-12) continue;

      var phi = Math.acos(Math.max(-1, Math.min(1, cosF)));   /* entre normales */
      var tanHalf = Math.tan(phi / 2);
      var dist = round ? size * tanHalf : size;               /* tangencia */
      if (!isFinite(dist) || dist <= 1e-9) continue;
      if (dist > L * 4 + size * 4) continue;

      var P1 = G3.add(a, G3.mul(w1, dist));
      var P2 = G3.add(a, G3.mul(w2, dist));
      var sec = [G3.copy(a), P1];
      if (round) {
        /* centro del arco sobre la bisectriz interior */
        var cDist = size / Math.max(1e-9, Math.sin(phi / 2));
        var cen = G3.sub(a, G3.mul(bis, cDist));
        var u = G3.sub(P1, cen), v = G3.sub(P2, cen);
        var ang = Math.acos(Math.max(-1, Math.min(1, G3.dot(G3.norm(u), G3.norm(v)))));
        var steps = Math.max(3, Math.ceil(ang / 0.20));
        for (var k = 1; k < steps; k++) {
          var m = G3.mRotAxis(cen, G3.dot(G3.cross(u, v), t) > 0 ? t : G3.neg(t), ang * k / steps);
          sec.push(G3.apply(m, P1));
        }
      }
      sec.push(P2);
      /* la sección tiene que recorrerse en sentido coherente con +t */
      if (G3.dot(G3.polyNormal(sec), t) < 0) sec.reverse();
      /* extrusión con un pelín de holgura para que las esquinas casen */
      var ov = Math.max(size, dist) * 0.02 + 1e-6;
      var prism = M.extrude(sec.map(function (q) { return G3.sub(q, G3.mul(t, ov)); }),
                            G3.mul(t, L + ov * 2));
      if (prism && prism.faces.length) out.push({ mesh: prism, a: e.a, b: e.b });
    }
    return out;
  }

  /* Agrupa los recortes en cadenas de aristas conectadas: el borde de un
     taladro es una sola cadena y se recorta de una vez, en lugar de
     arista a arista.  Tratarlas sueltas hacía que los recortes vecinos se
     solaparan, que muchos se rechazaran y que el borde saliera desigual. */
  function agrupaCadenas(cutters) {
    var padre = {};
    function raiz(x) { while (padre[x] !== undefined && padre[x] !== x) x = padre[x]; return x; }
    function une(x, y) { var rx = raiz(x), ry = raiz(y); if (rx !== ry) padre[rx] = ry; }
    cutters.forEach(function (c) {
      if (padre[c.a] === undefined) padre[c.a] = c.a;
      if (padre[c.b] === undefined) padre[c.b] = c.b;
      une(c.a, c.b);
    });
    var grupos = {};
    cutters.forEach(function (c) {
      var k = raiz(c.a);
      if (!grupos[k]) grupos[k] = [];
      grupos[k].push(c.mesh);
    });
    var out = [];
    Object.keys(grupos).forEach(function (k) {
      var g = grupos[k];
      if (g.length === 1) { out.push(g[0]); return; }
      /* se unen los recortes de la cadena en una sola herramienta */
      var u = g[0];
      for (var i = 1; i < g.length; i++) {
        try { var n2 = CSG.union(u, g[i]); if (n2 && n2.faces.length) u = n2; }
        catch (e) { out.push(g[i]); }
      }
      out.push(u);
    });
    return out;
  }

  /* Aplica los prismas de recorte al sólido */
  /* Aplica los prismas de recorte uno a uno, comprobando cada paso.

     Encadenar cientos de booleanos sin mirar el resultado era peligroso:
     bastaba con que uno saliera mal para que los siguientes trabajaran
     sobre una malla rota y la pieza acabara con un volumen ridículo.
     Ahora cada recorte se acepta sólo si deja la malla cerrada y quita
     una cantidad de material razonable; si no, se descarta ese recorte y
     se sigue con el anterior, que sí era válido. */
  function applyCutters(mesh, cutters, informe) {
    if (!cutters.length) return null;
    var res = mesh, done = 0, rechazados = 0;
    var v0 = Math.abs(mesh.volume());
    var chk0 = CAD.Mesh.check(mesh);
    var exigirCerrada = chk0.estanco;
    var maxPorRecorte = v0 * 0.25;      /* un empalme nunca se come un cuarto de la pieza */
    for (var i = 0; i < cutters.length; i++) {
      var c = cutters[i];
      try {
        var vAntes = Math.abs(res.volume());
        var next = CSG.subtract(res, c);
        if (!next || !next.faces.length) { rechazados++; continue; }
        var vDespues = Math.abs(next.volume());
        if (!isFinite(vDespues) || vDespues <= 0) { rechazados++; continue; }
        if (vDespues > vAntes + 1e-6) { rechazados++; continue; }          /* añadir material: imposible */
        if (vAntes - vDespues > maxPorRecorte) { rechazados++; continue; } /* se come demasiado */
        if (exigirCerrada && !CAD.Mesh.check(next).estanco) { rechazados++; continue; }
        res = next;
        done++;
      } catch (err) { rechazados++; continue; }
    }
    if (informe) { informe.hechos = done; informe.rechazados = rechazados; informe.total = cutters.length; }
    return done ? res : null;
  }

  function filletByEdges(mesh, r, angDeg, informe) {
    return applyCutters(mesh, agrupaCadenas(edgeCutters(mesh, r, angDeg, true)), informe);
  }
  function chamferByEdges(mesh, d, angDeg, informe) {
    return applyCutters(mesh, agrupaCadenas(edgeCutters(mesh, d, angDeg, false)), informe);
  }
  /* se exponen para que el árbol de operaciones pueda rehacerlas */
  CAD.CSG.filletMesh = function (mesh, r, ang) { return filletByEdges(mesh, r, ang, null); };
  CAD.CSG.chamferMesh = function (mesh, d, ang) { return chamferByEdges(mesh, d, ang, null); };

  Cmd.add(['CHAFLANARISTA', 'CHAMFEREDGE'], { group: '3d', icon: 'chamferedge', title: 'Achaflanar arista' },
  async function (ctx) {
    var sel = await ctx.getSelection('Designe el sólido');
    if (!sel || !sel.length) return;
    var sol = sel.filter(S.is3D);
    if (!sol.length) { ctx.err('No se han designado sólidos.'); return; }
    var d = await ctx.getDist('Precise la distancia del chaflán', { def: 2 });
    if (!num(d) || d <= 0) return;
    var ang = await ctx.getReal('Ángulo mínimo de arista a achaflanar (grados)', { def: 60 });
    if (!num(ang)) ang = 60;
    ctx.out('Calculando chaflanes…');
    ctx.doc.mark('CHAFLANARISTA');
    var done = 0, aviso2 = null;
    for (var i = 0; i < sol.length; i++) {
      var mesh = S.meshOf(sol[i]);
      if (!mesh) continue;
      var inf2 = {};
      var res = chamferByEdges(mesh, d, ang, inf2);
      if (!res) continue;
      var e3 = S.solid({ op: 'chamfer', d: d, ang: ang, src: S.nodeOf(sol[i]) },
                       { layer: sol[i].layer, color: sol[i].color });
      ctx.doc.remove(sol[i]);
      ctx.doc.add(e3);
      if (ctx.app.is3D) ctx.app.v3dDirty();
      done++;
      aviso2 = inf2;
    }
    if (!done) { ctx.doc.discardTx(); ctx.err('No se ha encontrado ninguna arista que achaflanar.'); return; }
    ctx.app.refresh(true);
    ctx.out(done + ' sólido(s) con aristas achaflanadas ' + G.fmt(d, 3) + '.' +
            (aviso2 && aviso2.rechazados ? '   ' + aviso2.hechos + ' de ' + aviso2.total +
             ' cadenas de aristas; ' + aviso2.rechazados + ' no admiten esa distancia y se han dejado vivas.' : ''));
  });

})();
