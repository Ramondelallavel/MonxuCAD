/* ============================================================
   commands-annot.js — Acotación y anotación
   ============================================================ */
(function () {
  'use strict';
  var CAD = window.CAD, G = CAD.G, E = CAD.E, Cmd = CAD.Cmd;
  var isKw = CAD.CU.isKw;
  function pt(v) { return v && v.x !== undefined ? v : null; }

  function newDim(ctx, kind, o) {
    var d = E.dim(kind, o);
    d.style = ctx.doc.vars.DIMSTYLE;
    d.layer = ctx.doc.vars.CLAYER;
    return d;
  }

  async function textOptions(ctx, dim) {
    var v = await ctx.getKeyword('Indique una opción', ['textoM', 'Texto', 'ánGulo'], { def: 'Texto' });
    if (!v) return;
    if (v.kw === 'T' || v.kw === 'TM') {
      var s = await ctx.getString('Indique texto de cota <' + CAD.Dim.fmtVal(dim.measurement, CAD.Dim.style(dim, ctx.doc)) + '>', { allowNone: true });
      if (s) dim.textOverride = s;
    } else if (v.kw === 'G') {
      var a = await ctx.getAngle('Precise ángulo del texto de cota', { def: 0 });
      if (typeof a === 'number') dim.textAngle = a;
    }
  }

  /* ============================================================
     COTA LINEAL
     ============================================================ */
  Cmd.add(['ACOTALINEAL', 'DIMLINEAR', 'DIMLIN', 'DLI'], { group: 'dim', icon: 'dimlinear', title: 'Cota lineal' }, async function (ctx) {
    var p1 = await ctx.getPoint('Precise el origen de la primera línea de referencia o <designar objeto>', { allowNone: true });
    var a, b;
    if (!pt(p1)) {
      var e = await ctx.getEntity('Designe objeto para acotar');
      if (!e) return;
      var ep = endpointsOf(ctx, e.ent);
      if (!ep) { ctx.err('Objeto no válido para acotar.'); return; }
      a = ep[0]; b = ep[1];
    } else {
      a = p1;
      b = await ctx.getPoint('Precise el origen de la segunda línea de referencia', { base: a });
      if (!pt(b)) return;
    }
    var dim = newDim(ctx, 'linear', { p1: a, p2: b, p3: G.mid(a, b), rot: 0 });
    var p3 = await ctx.getPoint('Precise ubicación de línea de cota o', {
      keywords: ['textoM', 'Texto', 'ánGulo', 'Horizontal', 'Vertical', 'Rotado'],
      preview: function (c) {
        var d2 = E.deep(dim);
        d2.rot = Math.abs(c.y - (a.y + b.y) / 2) > Math.abs(c.x - (a.x + b.x) / 2) ? 0 : Math.PI / 2;
        d2.p3 = c;
        return [d2];
      }
    });
    while (isKw(p3)) {
      if (p3.kw === 'H') dim.rot = 0;
      else if (p3.kw === 'V') dim.rot = Math.PI / 2;
      else if (p3.kw === 'R') { var r = await ctx.getAngle('Precise ángulo de línea de cota', { def: 0 }); if (typeof r === 'number') dim.rot = r; }
      else if (p3.kw === 'T' || p3.kw === 'TM') {
        var s = await ctx.getString('Indique texto de cota', { allowNone: true });
        if (s) dim.textOverride = s;
      } else if (p3.kw === 'G') {
        var ang = await ctx.getAngle('Precise ángulo del texto de cota', { def: 0 });
        if (typeof ang === 'number') dim.textAngle = ang;
      }
      p3 = await ctx.getPoint('Precise ubicación de línea de cota o', {
        keywords: ['textoM', 'Texto', 'ánGulo', 'Horizontal', 'Vertical', 'Rotado'],
        preview: function (c) { var d3 = E.deep(dim); d3.p3 = c; return [d3]; }
      });
    }
    if (!pt(p3)) return;
    if (dim.rot === 0 && Math.abs(p3.y - (a.y + b.y) / 2) < Math.abs(p3.x - (a.x + b.x) / 2)) dim.rot = Math.PI / 2;
    dim.p3 = p3;
    ctx.doc.mark('ACOTALINEAL');
    ctx.doc.add(dim);
    CAD.Dim.build(dim, ctx.doc);
    ctx.out('Dimensión = ' + G.fmt(dim.measurement, 2));
    ctx.app.refresh();
  });

  function endpointsOf(ctx, ent) {
    if (ent.type === 'LINE') return [ent.p1, ent.p2];
    if (ent.type === 'LWPOLYLINE' && ent.verts.length >= 2) {
      return [{ x: ent.verts[0].x, y: ent.verts[0].y }, { x: ent.verts[1].x, y: ent.verts[1].y }];
    }
    if (ent.type === 'ARC') return [G.polar(ent.c, ent.a0, ent.r), G.polar(ent.c, ent.a1, ent.r)];
    if (ent.type === 'CIRCLE') return [G.polar(ent.c, Math.PI, ent.r), G.polar(ent.c, 0, ent.r)];
    return null;
  }

  /* ============================================================
     COTA ALINEADA
     ============================================================ */
  Cmd.add(['ACOTAALINEADA', 'DIMALIGNED', 'DIMALI', 'DAL'], { group: 'dim', icon: 'dimaligned', title: 'Cota alineada' }, async function (ctx) {
    var p1 = await ctx.getPoint('Precise el origen de la primera línea de referencia o <designar objeto>', { allowNone: true });
    var a, b;
    if (!pt(p1)) {
      var e = await ctx.getEntity('Designe objeto para acotar'); if (!e) return;
      var ep = endpointsOf(ctx, e.ent);
      if (!ep) { ctx.err('Objeto no válido.'); return; }
      a = ep[0]; b = ep[1];
    } else {
      a = p1;
      b = await ctx.getPoint('Precise el origen de la segunda línea de referencia', { base: a });
      if (!pt(b)) return;
    }
    var dim = newDim(ctx, 'aligned', { p1: a, p2: b, p3: G.mid(a, b) });
    var p3 = await ctx.getPoint('Precise ubicación de línea de cota o', {
      keywords: ['textoM', 'Texto', 'ánGulo'],
      preview: function (c) { var d = E.deep(dim); d.p3 = c; return [d]; }
    });
    if (isKw(p3)) { await textOptions(ctx, dim); p3 = await ctx.getPoint('Precise ubicación de línea de cota', { preview: function (c) { var d = E.deep(dim); d.p3 = c; return [d]; } }); }
    if (!pt(p3)) return;
    dim.p3 = p3;
    ctx.doc.mark('ACOTAALINEADA');
    ctx.doc.add(dim);
    CAD.Dim.build(dim, ctx.doc);
    ctx.out('Dimensión = ' + G.fmt(dim.measurement, 2));
    ctx.app.refresh();
  });

  /* ============================================================
     COTA ANGULAR
     ============================================================ */
  Cmd.add(['ACOTAANGULO', 'DIMANGULAR', 'DIMANG', 'DAN'], { group: 'dim', icon: 'dimangular', title: 'Cota angular' }, async function (ctx) {
    var e1 = await ctx.getEntity('Designe arco, círculo, línea o <precisar vértice>', { allowNone: true });
    var center, a, b;
    if (e1 && e1.ent && e1.ent.type === 'ARC') {
      center = e1.ent.c;
      a = G.polar(center, e1.ent.a0, e1.ent.r);
      b = G.polar(center, e1.ent.a1, e1.ent.r);
    } else if (e1 && e1.ent && e1.ent.type === 'LINE') {
      var e2 = await ctx.getEntity('Designe segunda línea');
      if (!e2 || e2.ent.type !== 'LINE') { ctx.err('Se requiere una segunda línea.'); return; }
      var i = G.interLine(e1.ent.p1, e1.ent.p2, e2.ent.p1, e2.ent.p2, true, true);
      if (!i.length) { ctx.err('Las líneas son paralelas.'); return; }
      center = { x: i[0].x, y: i[0].y };
      a = G.dist(e1.ent.p1, center) > G.dist(e1.ent.p2, center) ? e1.ent.p1 : e1.ent.p2;
      b = G.dist(e2.ent.p1, center) > G.dist(e2.ent.p2, center) ? e2.ent.p1 : e2.ent.p2;
    } else {
      center = await ctx.getPoint('Precise vértice del ángulo'); if (!pt(center)) return;
      a = await ctx.getPoint('Precise primer extremo del ángulo', { base: center }); if (!pt(a)) return;
      b = await ctx.getPoint('Precise segundo extremo del ángulo', { base: center }); if (!pt(b)) return;
    }
    var dim = newDim(ctx, 'angular', { center: center, p1: a, p2: b, p3: G.polar(center, G.ang(center, a), G.dist(center, a) * 1.2) });
    var p3 = await ctx.getPoint('Precise ubicación del arco de cota o', {
      keywords: ['textoM', 'Texto', 'ánGulo'],
      preview: function (c) { var d = E.deep(dim); d.p3 = c; return [d]; }
    });
    if (isKw(p3)) { await textOptions(ctx, dim); p3 = await ctx.getPoint('Precise ubicación del arco de cota'); }
    if (!pt(p3)) return;
    dim.p3 = p3;
    ctx.doc.mark('ACOTAANGULO');
    ctx.doc.add(dim);
    CAD.Dim.build(dim, ctx.doc);
    ctx.out('Ángulo de cota = ' + G.fmt(dim.measurement, 2) + '°');
    ctx.app.refresh();
  });

  /* ============================================================
     RADIO / DIÁMETRO / LONGITUD DE ARCO
     ============================================================ */
  function radialCmd(kind, label) {
    return async function (ctx) {
      var e = await ctx.getEntity('Designe arco o círculo', {
        filter: function (x) { return x.type === 'ARC' || x.type === 'CIRCLE'; }
      });
      if (!e) return;
      var ent = e.ent;
      var onCircle = G.polar(ent.c, G.ang(ent.c, e.p), ent.r);
      var dim = newDim(ctx, kind, { center: ent.c, p1: onCircle });
      CAD.Dim.build(dim, ctx.doc);
      ctx.out('Dimensión = ' + G.fmt(dim.measurement, 2));
      var p = await ctx.getPoint('Precise ubicación de la línea de cota o', {
        keywords: ['textoM', 'Texto', 'ánGulo'],
        preview: function (c) {
          var d = E.deep(dim);
          d.p1 = G.polar(ent.c, G.ang(ent.c, c), ent.r);
          d.textPos = c;
          return [d];
        }
      });
      if (isKw(p)) { await textOptions(ctx, dim); p = await ctx.getPoint('Precise ubicación de la línea de cota'); }
      if (!pt(p)) return;
      dim.p1 = G.polar(ent.c, G.ang(ent.c, p), ent.r);
      dim.textPos = p;
      ctx.doc.mark(label);
      ctx.doc.add(dim);
      ctx.app.refresh();
    };
  }
  Cmd.add(['ACOTARADIO', 'DIMRADIUS', 'DIMRAD', 'DRA'], { group: 'dim', icon: 'dimradius', title: 'Cota de radio' }, radialCmd('radius', 'ACOTARADIO'));
  Cmd.add(['ACOTADIAMETRO', 'DIMDIAMETER', 'DIMDIA', 'DDI'], { group: 'dim', icon: 'dimdiameter', title: 'Cota de diámetro' }, radialCmd('diameter', 'ACOTADIAMETRO'));

  Cmd.add(['ACOTALONGARCO', 'DIMARC', 'DAR'], { group: 'dim', icon: 'dimarc', title: 'Longitud de arco' }, async function (ctx) {
    var e = await ctx.getEntity('Designe arco o segmento de arco de polilínea', {
      filter: function (x) { return x.type === 'ARC'; }
    });
    if (!e) return;
    var ent = e.ent;
    var dim = newDim(ctx, 'arclen', {
      center: ent.c,
      p1: G.polar(ent.c, ent.a0, ent.r),
      p2: G.polar(ent.c, ent.a1, ent.r),
      p3: G.polar(ent.c, ent.a0, ent.r * 1.3)
    });
    var p = await ctx.getPoint('Precise ubicación de la cota de longitud de arco', {
      preview: function (c) { var d = E.deep(dim); d.p3 = c; return [d]; }
    });
    if (!pt(p)) return;
    dim.p3 = p;
    ctx.doc.mark('ACOTALONGARCO');
    ctx.doc.add(dim);
    CAD.Dim.build(dim, ctx.doc);
    ctx.app.refresh();
  });

  /* ============================================================
     COTA DE COORDENADA
     ============================================================ */
  Cmd.add(['ACOTACOORDENADA', 'DIMORDINATE', 'DOR'], { group: 'dim', icon: 'dimordinate', title: 'Cota de coordenada' }, async function (ctx) {
    var p1 = await ctx.getPoint('Precise ubicación de elemento'); if (!pt(p1)) return;
    var p2 = await ctx.getPoint('Precise extremo de directriz o', {
      base: p1, keywords: ['ordenadaX', 'ordenadaY', 'textoM', 'Texto'],
      preview: function (c) {
        var d = E.deep(newDim(ctx, 'ordinate', { p1: p1, p2: c }));
        d.ordX = Math.abs(c.x - p1.x) > Math.abs(c.y - p1.y);
        return [d];
      }
    });
    if (!pt(p2)) return;
    var dim = newDim(ctx, 'ordinate', { p1: p1, p2: p2 });
    dim.ordX = Math.abs(p2.x - p1.x) > Math.abs(p2.y - p1.y);
    ctx.doc.mark('ACOTACOORDENADA');
    ctx.doc.add(dim);
    CAD.Dim.build(dim, ctx.doc);
    ctx.app.refresh();
  });

  /* ============================================================
     CONTINUAR / LÍNEA BASE
     ============================================================ */
  function lastLinearDim(doc) {
    for (var i = doc.entities.length - 1; i >= 0; i--) {
      var e = doc.entities[i];
      if (e.type === 'DIMENSION' && (e.kind === 'linear' || e.kind === 'aligned')) return e;
    }
    return null;
  }

  Cmd.add(['ACOTACONTINUA', 'DIMCONTINUE', 'DCO'], { group: 'dim', icon: 'dimcont', title: 'Cota continua' }, async function (ctx) {
    var base = lastLinearDim(ctx.doc);
    if (!base) { ctx.err('No hay ninguna cota lineal previa.'); return; }
    var prev = base.p2, last = base;
    ctx.doc.mark('ACOTACONTINUA');
    while (true) {
      var p = await ctx.getPoint('Precise el origen de la segunda línea de referencia o', {
        base: prev, keywords: ['desHacer', 'Seleccionar'], allowNone: true,
        preview: function (c) {
          var d = E.deep(last);
          d.p1 = prev; d.p2 = c; d.textPos = null;
          return [d];
        }
      });
      if (!pt(p)) break;
      var nd = newDim(ctx, last.kind, { p1: prev, p2: p, p3: last.p3, rot: last.rot });
      ctx.doc.add(nd);
      CAD.Dim.build(nd, ctx.doc);
      prev = p; last = nd;
      ctx.app.refresh();
    }
  });

  Cmd.add(['ACOTALINEABASE', 'DIMBASELINE', 'DBA'], { group: 'dim', icon: 'dimbase', title: 'Cota línea base' }, async function (ctx) {
    var base = lastLinearDim(ctx.doc);
    if (!base) { ctx.err('No hay ninguna cota lineal previa.'); return; }
    var st = CAD.Dim.style(base, ctx.doc);
    var origin = base.p1, count = 1;
    ctx.doc.mark('ACOTALINEABASE');
    while (true) {
      var p = await ctx.getPoint('Precise el origen de la segunda línea de referencia o', {
        keywords: ['desHacer', 'Seleccionar'], allowNone: true
      });
      if (!pt(p)) break;
      var u = { x: Math.cos(base.rot || 0), y: Math.sin(base.rot || 0) };
      var nrm = { x: -u.y, y: u.x };
      var p3 = G.add(base.p3, G.mul(nrm, st.dli * count * (G.dot(G.sub(base.p3, base.p1), nrm) >= 0 ? 1 : -1)));
      var nd = newDim(ctx, base.kind, { p1: origin, p2: p, p3: p3, rot: base.rot });
      ctx.doc.add(nd);
      CAD.Dim.build(nd, ctx.doc);
      count++;
      ctx.app.refresh();
    }
  });

  /* ============================================================
     DIRECTRIZ
     ============================================================ */
  Cmd.add(['DIRECTRIZ', 'LEADER', 'MLEADER', 'MLD', 'LE'], { group: 'dim', icon: 'leader', title: 'Directriz' }, async function (ctx) {
    var p1 = await ctx.getPoint('Precise ubicación de la punta de flecha de la directriz'); if (!pt(p1)) return;
    var pts = [p1];
    while (true) {
      var p = await ctx.getPoint('Precise punto siguiente o <finalizar>', {
        base: pts[pts.length - 1], rubber: 'line', allowNone: true,
        preview: function (c) { return [E.leader(pts.concat([c]), '')]; }
      });
      if (!pt(p)) break;
      pts.push(p);
      if (pts.length >= 4) break;
      ctx.app.refresh();
    }
    if (pts.length < 2) return;
    var txt = await ctx.app.ui.textDialog('', { title: 'Texto de directriz', height: ctx.doc.vars.TEXTSIZE });
    ctx.doc.mark('DIRECTRIZ');
    var ld = E.leader(pts, txt || '', { layer: ctx.doc.vars.CLAYER });
    ld.h = ctx.doc.vars.TEXTSIZE;
    ld.style = ctx.doc.vars.DIMSTYLE;
    ctx.doc.add(ld);
    ctx.app.refresh();
  });

  /* ============================================================
     ESTILO DE COTA
     ============================================================ */
  Cmd.add(['ESTILOCOTA', 'DIMSTYLE', 'DDIM', 'D'], { group: 'dim', icon: 'dimstyle', title: 'Estilo de cota' }, async function (ctx) {
    await ctx.app.ui.dimStyleDialog();
    ctx.app.refresh();
  });

  Cmd.add(['ACTCOTA', 'DIMUPDATE', '-DIMSTYLE'], { group: 'dim', title: 'Actualizar cotas' }, async function (ctx) {
    var sel = await ctx.getSelection('Designe objetos');
    if (!sel || !sel.length) return;
    ctx.doc.mark('ACTCOTA');
    sel.forEach(function (e) { if (e.type === 'DIMENSION' || e.type === 'LEADER') e.style = ctx.doc.vars.DIMSTYLE; });
    ctx.app.refresh();
  });

  /* ============================================================
     EDITAR TEXTO
     ============================================================ */
  Cmd.add(['EDITTEXTO', 'TEXTEDIT', 'DDEDIT', 'ED'], { group: 'annot', icon: 'textedit', title: 'Editar texto' }, async function (ctx) {
    while (true) {
      var e = await ctx.getEntity('Designe una anotación para editar o <salir>', {
        allowNone: true,
        filter: function (x) { return x.type === 'TEXT' || x.type === 'MTEXT' || x.type === 'DIMENSION' || x.type === 'LEADER'; }
      });
      if (!e) break;
      var ent = e.ent;
      var cur = ent.type === 'DIMENSION' ? (ent.textOverride || '') : (ent.text || '');
      var nt = await ctx.app.ui.textDialog(cur, { title: 'Editar texto', height: ent.h || 2.5 });
      if (nt === null) continue;
      ctx.doc.mark('EDITTEXTO');
      if (ent.type === 'DIMENSION') ent.textOverride = nt;
      else ent.text = nt;
      ctx.app.refresh();
    }
  });
})();
