/* ============================================================
   commands-3d.js — Comandos de modelado y navegación 3D
   Primitivas, operaciones de barrido, booleanos, edición de
   sólidos, vistas y estilos visuales.  Nomenclatura y flujo de
   peticiones equivalentes a los de AutoCAD.
   ============================================================ */
(function () {
  'use strict';
  var CAD = window.CAD, G = CAD.G, G3 = CAD.G3, E = CAD.E, Cmd = CAD.Cmd;
  var M = CAD.Mesh, CSG = CAD.CSG, S = CAD.Solid, V3 = CAD.View3D;
  var v3 = G3.v;

  function isKw(v) { return !!(v && v.kw); }
  function pt(v) { return v && v.x !== undefined ? v : null; }
  /* Predicado: 0 es un valor válido, así que nunca se devuelve el número. */
  function num(v) { return typeof v === 'number' && isFinite(v); }

  /* Añade un sólido al documento con las propiedades actuales */
  function addSolid(ctx, ent) {
    ctx.doc.add(ent);
    if (ctx.app.is3D) ctx.app.v3dDirty();
    ctx.app.refresh();
    return ent;
  }
  function z0(ctx) { return ctx.doc.vars.ELEVATION || 0; }

  /* Selección filtrada a sólidos/mallas */
  async function get3D(ctx, msg, opts) {
    var sel = await ctx.getSelection(msg || 'Designe sólidos', opts);
    if (!sel) return null;
    var out = sel.filter(S.is3D);
    if (!out.length) { ctx.err('No se han designado sólidos ni mallas.'); return null; }
    return out;
  }

  /* ============================================================
     PRIMITIVAS
     ============================================================ */
  Cmd.add(['PRISMARECT', 'BOX', 'CAJA'], { group: '3d', icon: 'box3d', title: 'Prisma rectangular' },
  async function (ctx) {
    var r0 = await ctx.getPoint('Precise primera esquina o', { keywords: ['Centro'] });
    if (r0 === null) return;
    var centered = false, c0;
    if (isKw(r0)) {
      centered = true;
      c0 = await ctx.getPoint('Precise centro');
      if (!pt(c0)) return;
    } else c0 = r0;
    var r1 = await ctx.getPoint('Precise otra esquina o', {
      base: c0, keywords: ['Cubo', 'Longitud'],
      preview: function (p) { return [E.pline(rect(c0, p, centered), true)]; }
    });
    if (r1 === null) return;
    var l, w;
    if (isKw(r1) && r1.kw === 'C') {
      l = await ctx.getDist('Precise longitud', { base: c0 });
      if (!num(l)) return;
      w = l;
      var h0 = l;
      return build(l, w, h0);
    }
    if (isKw(r1) && r1.kw === 'L') {
      l = await ctx.getDist('Precise longitud', { base: c0 }); if (!num(l)) return;
      w = await ctx.getDist('Precise anchura', { base: c0 }); if (!num(w)) return;
      var hh = await ctx.getDist('Precise altura', { base: c0 }); if (!num(hh)) return;
      return build(l, w, hh);
    }
    l = Math.abs(r1.x - c0.x) * (centered ? 2 : 1);
    w = Math.abs(r1.y - c0.y) * (centered ? 2 : 1);
    if (l < 1e-9 || w < 1e-9) { ctx.err('Dimensiones nulas.'); return; }
    var h = await ctx.getDist('Precise altura o', { base: c0, keywords: ['2Puntos'] });
    if (!num(h)) return;
    return build(l, w, h);

    function build(L, W, H) {
      ctx.doc.mark('PRISMARECT');
      var org = centered ? { x: c0.x, y: c0.y } : { x: Math.min(c0.x, c0.x + (r1.x > c0.x ? L : -L)), y: Math.min(c0.y, c0.y + (r1.y > c0.y ? W : -W)) };
      if (centered) org = { x: c0.x, y: c0.y };
      var e = S.solid({ op: 'box', l: L, w: W, h: H, centered: centered },
                      { layer: ctx.doc.vars.CLAYER });
      e.m = G3.mTrans(org.x, org.y, z0(ctx) + (centered ? H / 2 : 0));
      addSolid(ctx, e);
      ctx.out('Prisma ' + G.fmt(L, 3) + ' × ' + G.fmt(W, 3) + ' × ' + G.fmt(H, 3) +
              '   volumen ' + G.fmt(L * W * H, 3));
    }
  });

  function rect(a, b, centered) {
    if (centered) {
      var dx = Math.abs(b.x - a.x), dy = Math.abs(b.y - a.y);
      return [{ x: a.x - dx, y: a.y - dy }, { x: a.x + dx, y: a.y - dy },
              { x: a.x + dx, y: a.y + dy }, { x: a.x - dx, y: a.y + dy }];
    }
    return [{ x: a.x, y: a.y }, { x: b.x, y: a.y }, { x: b.x, y: b.y }, { x: a.x, y: b.y }];
  }

  /* ------------------------------------------------------------
     Base circular de un sólido de revolución.  Admite las mismas
     opciones que AutoCAD (3P, 2P, Ttr y, donde procede, Elíptico)
     además del centro y el radio.  Antes esas opciones se anunciaban
     en la petición pero no estaban implementadas, así que elegir una
     cancelaba el comando sin decir nada.
     Devuelve {c, r} o {elipse:[puntos]} o null.
     ------------------------------------------------------------ */
  async function baseCircle(ctx, msg, opts) {
    opts = opts || {};
    var kws = ['3P', '2P', 'Ttr'];
    if (opts.elliptic) kws.push('Elíptico');
    var r0 = await ctx.getPoint(msg, { keywords: kws });
    if (r0 === null) return null;

    if (!isKw(r0)) return await radiusOf(ctx, r0);

    if (r0.kw === '3P') {
      var a = await ctx.getPoint('Precise primer punto'); if (!pt(a)) return null;
      var b = await ctx.getPoint('Precise segundo punto', { base: a }); if (!pt(b)) return null;
      var c3 = await ctx.getPoint('Precise tercer punto', {
        base: b, preview: function (q) { var k = CAD.circ3(a, b, q); return k ? [E.circle(k.c, k.r)] : []; }
      });
      if (!pt(c3)) return null;
      var k3 = CAD.circ3(a, b, c3);
      if (!k3) { ctx.err('Los puntos son colineales.'); return null; }
      return { c: k3.c, r: k3.r };
    }
    if (r0.kw === '2P') {
      var d1 = await ctx.getPoint('Precise primer extremo del diámetro'); if (!pt(d1)) return null;
      var d2 = await ctx.getPoint('Precise segundo extremo del diámetro', {
        base: d1, preview: function (q) { return [E.circle(G.mid(d1, q), G.dist(d1, q) / 2)]; }
      });
      if (!pt(d2)) return null;
      var rr = G.dist(d1, d2) / 2;
      if (rr <= 0) return null;
      return { c: G.mid(d1, d2), r: rr };
    }
    if (r0.kw === 'T') {
      var t1 = await ctx.getEntity('Precise punto en objeto para la primera tangente'); if (!t1) return null;
      var t2 = await ctx.getEntity('Precise punto en objeto para la segunda tangente'); if (!t2) return null;
      var rt = await ctx.getReal('Precise radio', { def: ctx.app.lastRadius || 10 });
      if (!num(rt) || rt <= 0) return null;
      var sol = CAD.tanTanRadius(ctx, t1, t2, rt);
      if (!sol) { ctx.err('El círculo no existe.'); return null; }
      ctx.app.lastRadius = rt;
      return { c: sol, r: rt };
    }
    if (r0.kw === 'E') {
      var ce = await ctx.getPoint('Precise centro de la elipse'); if (!pt(ce)) return null;
      var ra = await ctx.getDist('Precise semieje mayor', { base: ce }); if (!num(ra) || ra <= 0) return null;
      var rb = await ctx.getDist('Precise semieje menor', { base: ce }); if (!num(rb) || rb <= 0) return null;
      var ang = await ctx.getAngle('Precise giro de la elipse', { base: ce, def: 0 });
      if (ang === null) ang = 0;
      var n = Math.max(16, M.segFor(Math.max(ra, rb)));
      var per = [], co = Math.cos(ang), si = Math.sin(ang);
      for (var i = 0; i < n; i++) {
        var th = 2 * Math.PI * i / n, ex = ra * Math.cos(th), ey = rb * Math.sin(th);
        per.push(v3(ce.x + ex * co - ey * si, ce.y + ex * si + ey * co, 0));
      }
      return { elipse: per, c: ce, r: Math.max(ra, rb) };
    }
    return null;
  }

  /* Radio (o diámetro) de una base ya centrada */
  async function radiusOf(ctx, c) {
    var r = await ctx.getDist('Precise radio de la base o', {
      base: c, keywords: ['Diámetro'],
      preview: function (q) { return [E.circle(c, Math.max(1e-9, G.dist(c, q)))]; }
    });
    if (isKw(r)) {
      var d = await ctx.getDist('Precise diámetro', { base: c });
      if (!num(d) || d <= 0) return null;
      r = d / 2;
    }
    if (!num(r) || r <= 0) return null;
    return { c: c, r: r };
  }

  /* Altura de un sólido: admite 2Puntos como AutoCAD */
  async function heightOf(ctx, c, extra) {
    var kws = ['2Puntos'].concat(extra || []);
    var h = await ctx.getDist('Precise altura o', { base: c, keywords: kws });
    if (isKw(h)) {
      if (h.kw === '2P') {
        var a = await ctx.getPoint('Precise primer punto'); if (!pt(a)) return null;
        var b = await ctx.getPoint('Precise segundo punto', { base: a }); if (!pt(b)) return null;
        /* la altura se mide en el espacio, no sólo en el plano */
        return { h: G3.dist(v3(a.x, a.y, a.z || 0), v3(b.x, b.y, b.z || 0)) };
      }
      return { kw: h.kw };
    }
    if (!num(h)) return null;
    return { h: h };
  }

  Cmd.add(['CILINDRO', 'CYLINDER'], { group: '3d', icon: 'cyl3d', title: 'Cilindro' },
  async function (ctx) {
    var base = await baseCircle(ctx, 'Precise centro de la base o', { elliptic: true });
    if (!base) return;
    var hr = await heightOf(ctx, base.c);
    if (!hr || !num(hr.h) || hr.h === 0) return;
    var h = hr.h;
    ctx.doc.mark('CILINDRO');
    var e;
    if (base.elipse) {
      e = S.solid({ op: 'extrude', prof: base.elipse, dir: { x: 0, y: 0, z: h } },
                  { layer: ctx.doc.vars.CLAYER });
      e.m = G3.mTrans(0, 0, z0(ctx));
      addSolid(ctx, e);
      ctx.out('Cilindro elíptico de altura ' + G.fmt(h, 3));
      return;
    }
    var r = base.r;
    e = S.solid({ op: 'cylinder', r: r, h: h, seg: M.segFor(r) }, { layer: ctx.doc.vars.CLAYER });
    e.m = G3.mTrans(base.c.x, base.c.y, z0(ctx));
    addSolid(ctx, e);
    ctx.out('Cilindro Ø' + G.fmt(r * 2, 3) + ' × ' + G.fmt(h, 3) +
            '   volumen ' + G.fmt(Math.PI * r * r * h, 3));
  });

  Cmd.add(['ESFERA', 'SPHERE'], { group: '3d', icon: 'sph3d', title: 'Esfera' },
  async function (ctx) {
    var base = await baseCircle(ctx, 'Precise centro o');
    if (!base || !num(base.r)) return;
    var c = base.c, r = base.r;
    ctx.doc.mark('ESFERA');
    var e = S.solid({ op: 'sphere', r: r, seg: M.segFor(r) }, { layer: ctx.doc.vars.CLAYER });
    e.m = G3.mTrans(c.x, c.y, z0(ctx));
    addSolid(ctx, e);
    ctx.out('Esfera R' + G.fmt(r, 3) + '   volumen ' + G.fmt(4 / 3 * Math.PI * r * r * r, 3));
  });

  Cmd.add(['CONO', 'CONE'], { group: '3d', icon: 'cone3d', title: 'Cono' },
  async function (ctx) {
    var base = await baseCircle(ctx, 'Precise centro de la base o', { elliptic: true });
    if (!base) return;
    var rTop = 0;
    var hr = await heightOf(ctx, base.c, ['Radio superior']);
    if (!hr) return;
    if (hr.kw === 'R') {
      rTop = await ctx.getDist('Precise radio superior', { base: base.c });
      if (!num(rTop) || rTop < 0) return;
      hr = await heightOf(ctx, base.c);
      if (!hr) return;
    }
    if (!num(hr.h) || hr.h === 0) return;
    var h = hr.h;
    ctx.doc.mark('CONO');
    var e;
    if (base.elipse) {
      /* cono elíptico: extrusión con estrechamiento hasta el radio superior */
      var k = base.r > 1e-12 ? (base.r - rTop) / base.r : 1;
      var cen = base.c, top = base.elipse.map(function (q) {
        return v3(cen.x + (q.x - cen.x) * (1 - k), cen.y + (q.y - cen.y) * (1 - k), h);
      });
      e = S.solid({ op: 'loft', secs: [base.elipse, top], opts: { closedSections: true } },
                  { layer: ctx.doc.vars.CLAYER });
      e.m = G3.mTrans(0, 0, z0(ctx));
      addSolid(ctx, e);
      ctx.out((rTop ? 'Tronco de cono elíptico' : 'Cono elíptico') + ' de altura ' + G.fmt(h, 3));
      return;
    }
    var r = base.r;
    e = S.solid({ op: 'cone', r: r, h: h, r2: rTop, seg: M.segFor(r) }, { layer: ctx.doc.vars.CLAYER });
    e.m = G3.mTrans(base.c.x, base.c.y, z0(ctx));
    addSolid(ctx, e);
    ctx.out((rTop ? 'Tronco de cono' : 'Cono') + ' Ø' + G.fmt(r * 2, 3) + ' × ' + G.fmt(h, 3));
  });

  Cmd.add(['CUNA', 'CUÑA', 'WEDGE'], { group: '3d', icon: 'wedge3d', title: 'Cuña' },
  async function (ctx) {
    var r0 = await ctx.getPoint('Precise primera esquina o', { keywords: ['Centro'] });
    if (r0 === null) return;
    var centered = isKw(r0), c0 = centered ? await ctx.getPoint('Precise centro') : r0;
    if (!pt(c0)) return;
    var r1 = await ctx.getPoint('Precise otra esquina o', {
      base: c0, keywords: ['Cubo', 'Longitud'],
      preview: function (p) { return [E.pline(rect(c0, p, centered), true)]; }
    });
    if (!pt(r1)) return;
    var l = Math.abs(r1.x - c0.x) * (centered ? 2 : 1);
    var w = Math.abs(r1.y - c0.y) * (centered ? 2 : 1);
    var h = await ctx.getDist('Precise altura', { base: c0 });
    if (!num(h)) return;
    ctx.doc.mark('CUNA');
    var e = S.solid({ op: 'wedge', l: l, w: w, h: h, centered: centered }, { layer: ctx.doc.vars.CLAYER });
    e.m = G3.mTrans(centered ? c0.x : Math.min(c0.x, r1.x), centered ? c0.y : Math.min(c0.y, r1.y), z0(ctx));
    addSolid(ctx, e);
    ctx.out('Cuña ' + G.fmt(l, 3) + ' × ' + G.fmt(w, 3) + ' × ' + G.fmt(h, 3));
  });

  Cmd.add(['TOROIDE', 'TORUS'], { group: '3d', icon: 'torus3d', title: 'Toroide' },
  async function (ctx) {
    var base = await baseCircle(ctx, 'Precise centro o');
    if (!base || !num(base.r)) return;
    var c = base.c, R = base.r;
    var r = await ctx.getDist('Precise radio del tubo o', { base: c, keywords: ['2Puntos', 'Diámetro'] });
    if (isKw(r)) {
      if (r.kw === '2P') {
        var ta = await ctx.getPoint('Precise primer punto'); if (!pt(ta)) return;
        var tb = await ctx.getPoint('Precise segundo punto', { base: ta }); if (!pt(tb)) return;
        r = G.dist(ta, tb) / 2;
      } else {
        var d2 = await ctx.getDist('Precise diámetro del tubo', { base: c });
        if (!num(d2)) return; r = d2 / 2;
      }
    }
    if (!num(r)) return;
    ctx.doc.mark('TOROIDE');
    var e = S.solid({ op: 'torus', R: R, r: r, seg: M.segFor(R) }, { layer: ctx.doc.vars.CLAYER });
    e.m = G3.mTrans(c.x, c.y, z0(ctx));
    addSolid(ctx, e);
    ctx.out('Toroide R' + G.fmt(R, 3) + ' r' + G.fmt(r, 3) +
            '   volumen ' + G.fmt(2 * Math.PI * Math.PI * R * r * r, 3));
  });

  Cmd.add(['PIRAMIDE', 'PYRAMID'], { group: '3d', icon: 'pyr3d', title: 'Pirámide' },
  async function (ctx) {
    var sides = ctx.doc.vars.PYRSIDES || 4;
    var c = await ctx.getPoint('Precise centro de la base o', { keywords: ['Arista', 'Lados'] });
    if (isKw(c) && c.kw === 'L') {
      var n = await ctx.getReal('Introduzca número de lados', { def: sides });
      if (!num(n)) return;
      sides = ctx.doc.vars.PYRSIDES = Math.max(3, Math.min(32, Math.round(n)));
      c = await ctx.getPoint('Precise centro de la base');
    }
    if (!pt(c)) return;
    var r = await ctx.getDist('Precise radio de la base o', { base: c, keywords: ['Inscrito', 'Circunscrito'],
      preview: function (p) { return [E.circle(c, G.dist(c, p))]; } });
    if (isKw(r)) r = await ctx.getDist('Precise radio de la base', { base: c });
    if (!num(r)) return;
    var h = await ctx.getDist('Precise altura o', { base: c, keywords: ['2Puntos', 'Eje', 'Radio superior'] });
    var rTop = 0;
    if (isKw(h) && h.kw === 'R') {
      rTop = await ctx.getDist('Precise radio superior', { base: c });
      if (!num(rTop)) return;
      h = await ctx.getDist('Precise altura', { base: c });
    }
    if (!num(h)) return;
    ctx.doc.mark('PIRAMIDE');
    var e = S.solid({ op: 'pyramid', r: r, h: h, sides: sides, r2: rTop }, { layer: ctx.doc.vars.CLAYER });
    e.m = G3.mTrans(c.x, c.y, z0(ctx));
    addSolid(ctx, e);
    ctx.out('Pirámide de ' + sides + ' lados, R' + G.fmt(r, 3) + ' × ' + G.fmt(h, 3));
  });

  /* ============================================================
     OPERACIONES DE BARRIDO
     ============================================================ */
  Cmd.add(['EXTRUSION', 'EXTRUDE', 'EXT'], { group: '3d', icon: 'extrude', title: 'Extrusión' },
  async function (ctx) {
    var sel = await ctx.getSelection('Designe objetos a extruir');
    if (!sel || !sel.length) return;
    var profs = [];
    for (var i = 0; i < sel.length; i++) {
      var pr = S.profileOf(sel[i], ctx.doc, 'high');
      if (pr && pr.length > 2) profs.push({ pts: pr, ent: sel[i] });
    }
    if (!profs.length) { ctx.err('Ninguno de los objetos designados sirve como perfil cerrado.'); return; }
    var h = await ctx.getDist('Precise altura de extrusión o', {
      keywords: ['Dirección', 'Trayectoria', 'ángulo de Inclinación']
    });
    var taper = 0, dir = null, pathEnt = null;
    while (isKw(h)) {
      if (h.kw === 'I') {
        var t = await ctx.getAngle('Precise ángulo de inclinación', { def: 0 });
        if (t === null) return;
        taper = t;
        h = await ctx.getDist('Precise altura de extrusión o', { keywords: ['Dirección', 'Trayectoria'] });
      } else if (h.kw === 'T') {
        var pe = await ctx.getEntity('Designe trayectoria de extrusión');
        if (!pe || !pe.ent) return;
        pathEnt = pe.ent;
        break;
      } else if (h.kw === 'D') {
        var d1 = await ctx.getPoint('Precise punto inicial de la dirección'); if (!pt(d1)) return;
        var d2 = await ctx.getPoint('Precise punto final de la dirección', { base: d1 }); if (!pt(d2)) return;
        dir = v3(d2.x - d1.x, d2.y - d1.y, (d2.z || 0) - (d1.z || 0));
        break;
      } else break;
    }
    if (!pathEnt && !dir && !num(h)) return;
    ctx.doc.mark('EXTRUSION');
    var made = 0, del = ctx.doc.vars.DELOBJ === undefined ? 1 : ctx.doc.vars.DELOBJ;
    for (i = 0; i < profs.length; i++) {
      var mesh = null;
      if (pathEnt) {
        var pp = S.profileOf(pathEnt, ctx.doc, 'high');
        if (pp) mesh = M.sweep(profs[i].pts, pp, { closedPath: !!pp.closed });
      } else {
        mesh = M.extrude(profs[i].pts, dir || v3(0, 0, h), taper, []);
      }
      if (!mesh || !mesh.faces.length) continue;
      var e = S.fromMesh(mesh, { layer: profs[i].ent.layer, color: profs[i].ent.color });
      addSolid(ctx, e);
      made++;
      if (del) ctx.doc.remove(profs[i].ent);
    }
    if (!made) { ctx.doc.discardTx(); ctx.err('No se ha podido extruir.'); return; }
    ctx.out(made + ' sólido(s) creado(s) por extrusión.');
  });

  Cmd.add(['REVOLUCION', 'REVOLVE', 'REV'], { group: '3d', icon: 'revolve', title: 'Revolución' },
  async function (ctx) {
    var sel = await ctx.getSelection('Designe objetos a revolucionar');
    if (!sel || !sel.length) return;
    var a1 = await ctx.getPoint('Precise punto inicial del eje de revolución o', {
      keywords: ['Objeto', 'X', 'Y', 'Z']
    });
    var axP, axD;
    if (isKw(a1)) {
      if (a1.kw === 'X') { axP = v3(0, 0, 0); axD = v3(1, 0, 0); }
      else if (a1.kw === 'Y') { axP = v3(0, 0, 0); axD = v3(0, 1, 0); }
      else if (a1.kw === 'Z') { axP = v3(0, 0, 0); axD = v3(0, 0, 1); }
      else {
        var oe = await ctx.getEntity('Designe un objeto como eje');
        if (!oe || !oe.ent || oe.ent.type !== 'LINE') { ctx.err('El eje debe ser una línea.'); return; }
        axP = v3(oe.ent.p1.x, oe.ent.p1.y, 0);
        axD = G3.norm(v3(oe.ent.p2.x - oe.ent.p1.x, oe.ent.p2.y - oe.ent.p1.y, 0));
      }
    } else {
      if (!pt(a1)) return;
      var a2 = await ctx.getPoint('Precise punto final del eje', { base: a1 });
      if (!pt(a2)) return;
      axP = v3(a1.x, a1.y, a1.z || 0);
      axD = G3.norm(v3(a2.x - a1.x, a2.y - a1.y, (a2.z || 0) - (a1.z || 0)));
    }
    if (G3.len2(axD) < 1e-12) { ctx.err('Eje nulo.'); return; }
    var ang = await ctx.getAngle('Precise ángulo de revolución o', { def: 360, keywords: ['Ángulo inicial', 'Invertir'] });
    if (ang === null || isKw(ang)) ang = Math.PI * 2;
    ctx.doc.mark('REVOLUCION');
    var made = 0, del = ctx.doc.vars.DELOBJ === undefined ? 1 : ctx.doc.vars.DELOBJ;
    for (var i = 0; i < sel.length; i++) {
      var pr = S.profileOf(sel[i], ctx.doc, 'high');
      if (!pr || pr.length < 2) continue;
      var mesh = M.revolve(pr, axP, axD, ang, Math.max(12, Math.ceil(Math.abs(ang) / (Math.PI / 24))), !!pr.closed);
      if (!mesh || !mesh.faces.length) continue;
      var e = S.fromMesh(mesh, { layer: sel[i].layer, color: sel[i].color });
      addSolid(ctx, e);
      made++;
      if (del) ctx.doc.remove(sel[i]);
    }
    if (!made) { ctx.doc.discardTx(); ctx.err('No se ha podido revolucionar.'); return; }
    ctx.out(made + ' sólido(s) creado(s) por revolución de ' + G.fmt(ang * 180 / Math.PI, 2) + '°.');
  });

  Cmd.add(['BARRIDO', 'SWEEP'], { group: '3d', icon: 'sweep', title: 'Barrido' },
  async function (ctx) {
    var sel = await ctx.getSelection('Designe objetos a barrer');
    if (!sel || !sel.length) return;
    var opts = { twist: 0, scale: 1, align: true };
    var pe = await ctx.getEntity('Designe trayectoria de barrido o', {
      keywords: ['Alineación', 'Punto base', 'Escala', 'Torsión']
    });
    while (pe && pe.kw) {
      if (pe.kw === 'E') { var sc = await ctx.getReal('Precise factor de escala', { def: 1 }); if (num(sc)) opts.scale = sc; }
      else if (pe.kw === 'T') { var tw = await ctx.getAngle('Precise ángulo de torsión', { def: 0 }); if (tw !== null) opts.twist = tw; }
      else if (pe.kw === 'A') { var ak = await ctx.getKeyword('Alinear perfil con la trayectoria', ['Sí', 'No'], { def: 'Sí' }); opts.bank = !(ak && ak.kw === 'N'); }
      pe = await ctx.getEntity('Designe trayectoria de barrido o', { keywords: ['Alineación', 'Escala', 'Torsión'] });
    }
    if (!pe || !pe.ent) return;
    var path = S.profileOf(pe.ent, ctx.doc, 'high');
    if (!path || path.length < 2) { ctx.err('Trayectoria no válida.'); return; }
    opts.closedPath = !!path.closed;
    ctx.doc.mark('BARRIDO');
    var made = 0, del = ctx.doc.vars.DELOBJ === undefined ? 1 : ctx.doc.vars.DELOBJ;
    for (var i = 0; i < sel.length; i++) {
      if (sel[i] === pe.ent) continue;
      var pr = S.profileOf(sel[i], ctx.doc, 'high');
      if (!pr || pr.length < 3) continue;
      var mesh = M.sweep(pr, path, opts);
      if (!mesh || !mesh.faces.length) continue;
      addSolid(ctx, S.fromMesh(mesh, { layer: sel[i].layer, color: sel[i].color }));
      made++;
      if (del) ctx.doc.remove(sel[i]);
    }
    if (!made) { ctx.doc.discardTx(); ctx.err('No se ha podido barrer.'); return; }
    ctx.out(made + ' sólido(s) creado(s) por barrido.');
  });

  Cmd.add(['SOLEVADO', 'LOFT'], { group: '3d', icon: 'loft', title: 'Solevado' },
  async function (ctx) {
    ctx.out('Designe secciones transversales en orden de solevado:');
    var secs = [];
    while (true) {
      var r = await ctx.getEntity('Designe sección transversal en orden de solevado o (Intro para terminar)',
                                  { allowEmpty: true, keywords: ['Punto', 'Unir varias aristas', 'Modo'] });
      if (r === null || r === undefined || (r && r.empty)) break;
      if (r && r.kw) continue;
      if (!r || !r.ent) break;
      var pr = S.profileOf(r.ent, ctx.doc, 'high');
      if (pr && pr.length >= 3) { secs.push({ pts: pr, ent: r.ent }); ctx.out(secs.length + ' sección(es)'); }
      else ctx.err('Sección no válida (debe ser un contorno cerrado).');
    }
    if (secs.length < 2) { ctx.err('Se necesitan al menos dos secciones.'); return; }
    ctx.doc.mark('SOLEVADO');
    var mesh = M.loft(secs.map(function (s) { return s.pts; }), { closedSections: true });
    if (!mesh || !mesh.faces.length) { ctx.doc.discardTx(); ctx.err('No se ha podido solevar.'); return; }
    addSolid(ctx, S.fromMesh(mesh, { layer: secs[0].ent.layer, color: secs[0].ent.color }));
    var del = ctx.doc.vars.DELOBJ === undefined ? 1 : ctx.doc.vars.DELOBJ;
    if (del) secs.forEach(function (s) { ctx.doc.remove(s.ent); });
    ctx.out('Sólido creado por solevado de ' + secs.length + ' secciones.  Volumen ' +
            G.fmt(Math.abs(mesh.volume()), 3));
  });

  Cmd.add(['PULSARTIRAR', 'PRESSPULL'], { group: '3d', icon: 'presspull', title: 'Pulsar o tirar' },
  async function (ctx) {
    var r = await ctx.getEntity('Designe objeto o área delimitada');
    if (!r || !r.ent) return;
    var pr = S.profileOf(r.ent, ctx.doc, 'high');
    if (!pr || pr.length < 3) { ctx.err('El objeto no delimita un área cerrada.'); return; }
    var h = await ctx.getDist('Precise altura de extrusión');
    if (!num(h)) return;
    ctx.doc.mark('PULSARTIRAR');
    var mesh = M.extrude(pr, v3(0, 0, h));
    if (!mesh) { ctx.doc.discardTx(); ctx.err('No se ha podido extruir.'); return; }
    addSolid(ctx, S.fromMesh(mesh, { layer: r.ent.layer, color: r.ent.color }));
    ctx.doc.remove(r.ent);
    ctx.out('Volumen ' + G.fmt(Math.abs(mesh.volume()), 3));
  });

  /* ============================================================
     BOOLEANOS 3D
     ============================================================ */
  function boolCmd(names, meta, mode, label) {
    Cmd.add(names, meta, async function (ctx) {
      var sel = mode === 'diff' ? null : await get3D(ctx, 'Designe sólidos');
      if (mode === 'diff') {
        var a = await get3D(ctx, 'Designe sólidos de los que restar');
        if (!a) return;
        ctx.app.selSet = [];
        var b = await get3D(ctx, 'Designe sólidos a restar', { force: true });
        if (!b) return;
        sel = { a: a, b: b };
      }
      if (!sel) return;
      if (mode !== 'diff' && sel.length < 2) { ctx.err('Se necesitan al menos dos sólidos.'); return; }
      ctx.doc.mark(label);
      var t0 = performance.now();
      var all = mode === 'diff' ? sel.a.concat(sel.b) : sel;
      var first = mode === 'diff' ? sel.a[0] : sel[0];

      /* El resultado guarda el árbol de operandos, no una malla cocida:
         así se puede volver atrás, cambiar el radio de un taladro o
         suprimir una operación y que la pieza se reconstruya sola. */
      var e = S.solid({ op: 'bool', kind: mode,
                        nodes: all.map(function (x) { return S.nodeOf(x); }) },
                      { layer: first.layer, color: first.color });
      var res;
      try { res = S.meshOf(e); }
      catch (err) {
        ctx.doc.discardTx();
        ctx.err('Error en la operación booleana: ' + err.message);
        return;
      }
      if (!res || !res.faces.length) {
        ctx.doc.discardTx();
        ctx.err('El resultado está vacío (los sólidos no se cortan).');
        return;
      }
      all.forEach(function (x) { ctx.doc.remove(x); });
      addSolid(ctx, e);
      ctx.app.selSet = [e];
      var chk = M.check(res);
      ctx.out(label + ': volumen ' + G.fmt(Math.abs(res.volume()), 4) +
              ', ' + res.faces.length + ' caras, ' + Math.round(performance.now() - t0) + ' ms' +
              (chk.estanco ? '' : '  (aviso: la malla queda abierta)'));
    });
  }
  boolCmd(['UNION3D', 'UNION3'], { group: '3d', icon: 'union', title: 'Unión de sólidos' }, 'union', 'Unión');
  boolCmd(['DIFERENCIA3D', 'SUBTRACT', 'DIFERENCIA3'], { group: '3d', icon: 'subtract', title: 'Diferencia de sólidos' }, 'diff', 'Diferencia');
  boolCmd(['INTERSEC3D', 'INTERSECT', 'INTERSEC3'], { group: '3d', icon: 'intersect', title: 'Intersección de sólidos' }, 'inter', 'Intersección');

  Cmd.add(['INTERF', 'INTERFERE'], { group: '3d', icon: 'interfere', title: 'Comprobar interferencias' },
  async function (ctx) {
    var sel = await get3D(ctx, 'Designe sólidos a comprobar');
    if (!sel || sel.length < 2) { ctx.err('Se necesitan al menos dos sólidos.'); return; }
    var found = [], i, j;
    for (i = 0; i < sel.length; i++)
      for (j = i + 1; j < sel.length; j++) {
        var r = CSG.interferes(S.meshOf(sel[i]), S.meshOf(sel[j]));
        if (r) found.push({ a: sel[i], b: sel[j], mesh: r, vol: Math.abs(r.volume()) });
      }
    if (!found.length) { ctx.out('No se han detectado interferencias.'); return; }
    ctx.out(found.length + ' pareja(s) interfieren:');
    found.forEach(function (f) {
      ctx.out('  Sólidos ' + f.a.id + ' y ' + f.b.id + ': volumen común ' + G.fmt(f.vol, 4));
    });
    var k = await ctx.getKeyword('¿Crear sólidos de interferencia?', ['Sí', 'No'], { def: 'No' });
    if (k && k.kw === 'S') {
      ctx.doc.mark('INTERF');
      found.forEach(function (f) {
        addSolid(ctx, S.fromMesh(f.mesh, { layer: ctx.doc.vars.CLAYER, color: 1 }));
      });
      ctx.out(found.length + ' sólido(s) de interferencia creado(s).');
    }
  });

  /* ============================================================
     EDICIÓN DE SÓLIDOS
     ============================================================ */
  Cmd.add(['CORTE', 'SLICE', 'SECCIONAR'], { group: '3d', icon: 'slice', title: 'Cortar sólido' },
  async function (ctx) {
    var sel = await get3D(ctx, 'Designe objetos a cortar');
    if (!sel) return;
    var k = await ctx.getKeyword('Precise punto inicial del plano de corte o',
      ['3puntos', 'Objeto', 'Eje z', 'Vista', 'XY', 'YZ', 'ZX'], { def: '3puntos' });
    var kw = k && k.kw;
    var plane = null;
    if (kw === 'XY') plane = { n: v3(0, 0, 1), w: 0 };
    else if (kw === 'YZ') plane = { n: v3(1, 0, 0), w: 0 };
    else if (kw === 'ZX') plane = { n: v3(0, 1, 0), w: 0 };
    if (plane) {
      var pp = await ctx.getPoint('Precise un punto del plano ' + kw, { def: { x: 0, y: 0 } });
      if (pt(pp)) plane.w = G3.dot(plane.n, v3(pp.x, pp.y, pp.z || 0));
    } else {
      var p1 = await ctx.getPoint('Precise primer punto del plano'); if (!pt(p1)) return;
      var p2 = await ctx.getPoint('Precise segundo punto del plano', { base: p1 }); if (!pt(p2)) return;
      var p3 = await ctx.getPoint('Precise tercer punto del plano', { base: p2 });
      var A = v3(p1.x, p1.y, p1.z || 0), B = v3(p2.x, p2.y, p2.z || 0);
      var C = pt(p3) ? v3(p3.x, p3.y, p3.z || 0) : v3(p1.x, p1.y, (p1.z || 0) + 1);
      plane = G3.planeFrom3(A, B, C);
      if (G3.len2(plane.n) < 1e-12) { ctx.err('Los tres puntos son colineales.'); return; }
    }
    var side = await ctx.getKeyword('Precise un punto del lado deseado o', ['ambos Lados'], { def: 'ambos Lados' });
    ctx.doc.mark('CORTE');
    var made = 0;
    for (var i = 0; i < sel.length; i++) {
      var mesh = S.meshOf(sel[i]);
      if (!mesh) continue;
      var b = mesh.bbox();
      var d = G3.boxDiag(b) * 2 + 10;
      var c = G3.boxCenter(b);
      /* semiespacio como caja gigante detrás del plano */
      function halfBox(flip) {
        var box = M.box(d, d, d, true);
        var nrm = flip ? G3.neg(plane.n) : plane.n;
        var org = G3.add(G3.mul(plane.n, plane.w), G3.mul(nrm, -d / 2));
        box.transform(G3.mChain(G3.mTrans(org), G3.mPlane(v3(0, 0, 0), nrm)));
        return box;
      }
      var above = CSG.intersect(mesh, halfBox(false));
      var below = CSG.intersect(mesh, halfBox(true));
      var keep = [];
      if (side && side.kw === 'L') { if (above.faces.length) keep.push(above); if (below.faces.length) keep.push(below); }
      else { if (above.faces.length) keep.push(above); }
      if (!keep.length) continue;
      ctx.doc.remove(sel[i]);
      keep.forEach(function (m2) {
        addSolid(ctx, S.fromMesh(m2, { layer: sel[i].layer, color: sel[i].color }));
        made++;
      });
    }
    if (!made) { ctx.doc.discardTx(); ctx.err('El plano no corta ningún sólido.'); return; }
    ctx.out(made + ' sólido(s) tras el corte.');
  });

  Cmd.add(['SECCION3D', 'SECTION'], { group: '3d', icon: 'section', title: 'Sección de sólido' },
  async function (ctx) {
    var sel = await get3D(ctx, 'Designe sólidos');
    if (!sel) return;
    var k = await ctx.getKeyword('Precise el plano de sección', ['XY', 'YZ', 'ZX', '3puntos'], { def: 'XY' });
    var kw = k && k.kw;
    var plane = kw === 'YZ' ? { n: v3(1, 0, 0), w: 0 } : (kw === 'ZX' ? { n: v3(0, 1, 0), w: 0 } : { n: v3(0, 0, 1), w: 0 });
    var pp = await ctx.getPoint('Precise un punto del plano', { def: { x: 0, y: 0 } });
    if (pt(pp)) plane.w = G3.dot(plane.n, v3(pp.x, pp.y, pp.z || 0));
    ctx.doc.mark('SECCION3D');
    var n = 0;
    for (var i = 0; i < sel.length; i++) {
      var ents = S.sectionEnts(sel[i], plane, ctx.doc);
      ents.forEach(function (e) { ctx.doc.add(e); n++; });
    }
    if (!n) { ctx.doc.discardTx(); ctx.err('El plano no corta ningún sólido.'); return; }
    ctx.app.refresh(true);
    ctx.out(n + ' contorno(s) de sección creado(s).');
  });

  Cmd.add(['SOLPERFIL', 'SOLPROF', 'APLANAR', 'FLATSHOT'], { group: '3d', icon: 'flatshot', title: 'Perfil plano del sólido' },
  async function (ctx) {
    var sel = await get3D(ctx, 'Designe sólidos');
    if (!sel) return;
    ctx.doc.mark('SOLPERFIL');
    var n = 0;
    for (var i = 0; i < sel.length; i++) {
      var ents = S.flatten(sel[i], ctx.doc, { n: v3(0, 0, 1), w: 0 });
      ents.forEach(function (e) { ctx.doc.add(e); n++; });
    }
    if (!n) { ctx.doc.discardTx(); ctx.err('Sin aristas que proyectar.'); return; }
    ctx.app.refresh(true);
    ctx.out(n + ' línea(s) de perfil creada(s).');
  });

  Cmd.add(['ENGROSAR', 'THICKEN'], { group: '3d', icon: 'thicken', title: 'Engrosar superficie' },
  async function (ctx) {
    var sel = await get3D(ctx, 'Designe superficies a engrosar');
    if (!sel) return;
    var t = await ctx.getDist('Precise grosor', { def: 1 });
    if (!num(t)) return;
    ctx.doc.mark('ENGROSAR');
    var n = 0;
    for (var i = 0; i < sel.length; i++) {
      var mesh = S.meshOf(sel[i]);
      if (!mesh) continue;
      var out = CSG.offsetMesh(mesh, t);
      out.flip();
      var comb = mesh.clone();
      comb.append(out);
      S.setMesh(sel[i], comb.clean(), ctx.doc);
      n++;
    }
    ctx.app.refresh(true);
    ctx.out(n + ' objeto(s) engrosado(s) ' + G.fmt(t, 3) + '.');
  });

  Cmd.add(['SUAVIZARMALLA', 'MESHSMOOTH'], { group: '3d', icon: 'smooth', title: 'Suavizar malla' },
  async function (ctx) {
    var sel = await get3D(ctx, 'Designe objetos');
    if (!sel) return;
    var n = await ctx.getReal('Nivel de suavizado (1-3)', { def: 1 });
    if (!num(n)) return;
    n = Math.max(1, Math.min(3, Math.round(n)));
    ctx.doc.mark('SUAVIZARMALLA');
    for (var i = 0; i < sel.length; i++) {
      var mesh = S.meshOf(sel[i]);
      if (!mesh) continue;
      if (mesh.faces.length * Math.pow(4, n) > 400000) { ctx.err('Malla demasiado densa para ese nivel.'); continue; }
      for (var k = 0; k < n; k++) mesh = M.subdivide(mesh);
      S.setMesh(sel[i], mesh, ctx.doc);
      sel[i].type = 'MESH';
    }
    ctx.app.refresh(true);
    ctx.out('Malla(s) suavizada(s) al nivel ' + n + '.');
  });

  Cmd.add(['PROPFIS', 'MASSPROP'], { group: '3d', icon: 'massprop', title: 'Propiedades físicas' },
  async function (ctx) {
    var sel = await get3D(ctx, 'Designe sólidos o regiones');
    if (!sel) return;
    var dens = ctx.doc.vars.DENSITY || 0.00785;  /* acero, g/mm³ */
    for (var i = 0; i < sel.length; i++) {
      var p = S.massProps(sel[i], dens);
      if (!p) continue;
      ctx.out('---------------- SÓLIDO ' + sel[i].id + ' ----------------');
      ctx.out('  Volumen:            ' + G.fmt(p.volumen, 4) + ' mm³');
      ctx.out('  Área:               ' + G.fmt(p.area, 4) + ' mm²');
      ctx.out('  Masa (ρ=' + dens + '):   ' + G.fmt(p.masa, 4) + ' g');
      ctx.out('  Centro de gravedad: X ' + G.fmt(p.centroide.x, 4) +
              '  Y ' + G.fmt(p.centroide.y, 4) + '  Z ' + G.fmt(p.centroide.z, 4));
      ctx.out('  Caja delimitadora:  X ' + G.fmt(p.bbox.x1, 3) + ' .. ' + G.fmt(p.bbox.x2, 3));
      ctx.out('                      Y ' + G.fmt(p.bbox.y1, 3) + ' .. ' + G.fmt(p.bbox.y2, 3));
      ctx.out('                      Z ' + G.fmt(p.bbox.z1, 3) + ' .. ' + G.fmt(p.bbox.z2, 3));
      ctx.out('  Momentos de inercia: Ixx ' + G.fmt(p.Ixx, 2) + '  Iyy ' + G.fmt(p.Iyy, 2) + '  Izz ' + G.fmt(p.Izz, 2));
      ctx.out('  Productos:           Ixy ' + G.fmt(p.Ixy, 2) + '  Iyz ' + G.fmt(p.Iyz, 2) + '  Ixz ' + G.fmt(p.Ixz, 2));
      ctx.out('  Radios de giro:      X ' + G.fmt(p.radioGiro.x, 4) +
              '  Y ' + G.fmt(p.radioGiro.y, 4) + '  Z ' + G.fmt(p.radioGiro.z, 4));
    }
  });

  Cmd.add(['COMPROBARSOLIDO', 'SOLIDCHECK'], { group: '3d', icon: 'check', title: 'Comprobar sólido' },
  async function (ctx) {
    var sel = await get3D(ctx, 'Designe sólidos');
    if (!sel) return;
    var bad = 0;
    for (var i = 0; i < sel.length; i++) {
      var mesh = S.meshOf(sel[i]);
      if (!mesh) continue;
      var c = M.check(mesh);
      var est = c.estanco ? 'estanco ✓' : 'ABIERTO (' + c.abiertas + ' aristas libres)';
      var man = c.noManifold ? ',  ' + c.noManifold + ' arista(s) con más de dos caras' : '';
      ctx.out('Sólido ' + sel[i].id + ': ' + c.caras + ' caras, ' + c.vertices + ' vértices, ' +
              c.aristas + ' aristas  —  ' + est + man);
      if (!c.estanco) bad++;
    }
    if (bad) {
      var k = await ctx.getKeyword('¿Intentar reparar?', ['Sí', 'No'], { def: 'Sí' });
      if (k && k.kw === 'S') {
        ctx.doc.mark('REPARARSOLIDO');
        var fixed = 0;
        for (i = 0; i < sel.length; i++) {
          var m2 = S.meshOf(sel[i]);
          if (!m2) continue;
          var r = m2.clone();
          r.weld(1e-5); r.clean(); r.fixTJunctions(1e-5); r.clean();
          if (r.volume() < 0) r.flip();
          S.setMesh(sel[i], r, ctx.doc);
          if (M.check(r).estanco) fixed++;
        }
        ctx.app.refresh(true);
        ctx.out(fixed + ' de ' + bad + ' sólido(s) reparado(s).');
      }
    }
  });

  Cmd.add(['ALINEAR3D', '3DALIGN', 'ALINEAR3'], { group: '3d', icon: 'align3d', title: 'Alinear en 3D' },
  async function (ctx) {
    var sel = await ctx.getSelection('Designe objetos');
    if (!sel || !sel.length) return;
    var s1 = await ctx.getPoint('Precise primer punto de origen'); if (!pt(s1)) return;
    var d1 = await ctx.getPoint('Precise primer punto de destino'); if (!pt(d1)) return;
    var s2 = await ctx.getPoint('Precise segundo punto de origen o (Intro para acabar)', { allowEmpty: true });
    var m;
    if (!pt(s2)) {
      m = G3.mTrans(d1.x - s1.x, d1.y - s1.y, (d1.z || 0) - (s1.z || 0));
    } else {
      var d2 = await ctx.getPoint('Precise segundo punto de destino'); if (!pt(d2)) return;
      var a = v3(s2.x - s1.x, s2.y - s1.y, (s2.z || 0) - (s1.z || 0));
      var b = v3(d2.x - d1.x, d2.y - d1.y, (d2.z || 0) - (d1.z || 0));
      var rot = M.rotBetween(a, b);
      m = G3.mChain(G3.mTrans(d1.x, d1.y, d1.z || 0), rot,
                    G3.mTrans(-s1.x, -s1.y, -(s1.z || 0)));
    }
    ctx.doc.mark('ALINEAR3D');
    sel.forEach(function (e) {
      if (S.is3D(e)) S.xform(e, m, ctx.doc);
      else E.transform(e, G.M(m[0], m[1], m[4], m[5], m[12], m[13]), ctx.doc);
    });
    ctx.app.refresh(true);
    ctx.out(sel.length + ' objeto(s) alineado(s).');
  });

  Cmd.add(['GIRA3D', '3DROTATE', 'ROTATE3D'], { group: '3d', icon: 'rot3d', title: 'Girar en 3D' },
  async function (ctx) {
    var sel = await ctx.getSelection('Designe objetos');
    if (!sel || !sel.length) return;
    var base = await ctx.getPoint('Precise punto base'); if (!pt(base)) return;
    var k = await ctx.getKeyword('Precise eje de giro', ['X', 'Y', 'Z', '2puntos'], { def: 'Z' });
    var kw = k && k.kw, dir;
    if (kw === 'X') dir = v3(1, 0, 0);
    else if (kw === 'Y') dir = v3(0, 1, 0);
    else if (kw === 'Z') dir = v3(0, 0, 1);
    else {
      var p2 = await ctx.getPoint('Precise segundo punto del eje', { base: base });
      if (!pt(p2)) return;
      dir = v3(p2.x - base.x, p2.y - base.y, (p2.z || 0) - (base.z || 0));
    }
    if (G3.len2(dir) < 1e-12) { ctx.err('Eje nulo.'); return; }
    var ang = await ctx.getAngle('Precise ángulo de rotación', { base: base });
    if (ang === null) return;
    ctx.doc.mark('GIRA3D');
    var m = G3.mRotAxis(v3(base.x, base.y, base.z || 0), dir, ang);
    sel.forEach(function (e) {
      if (S.is3D(e)) S.xform(e, m, ctx.doc);
    });
    ctx.app.refresh(true);
    ctx.out(sel.length + ' objeto(s) girado(s) ' + G.fmt(ang * 180 / Math.PI, 2) + '°.');
  });

  Cmd.add(['SIMETRIA3D', 'MIRROR3D'], { group: '3d', icon: 'mir3d', title: 'Simetría en 3D' },
  async function (ctx) {
    var sel = await ctx.getSelection('Designe objetos');
    if (!sel || !sel.length) return;
    var k = await ctx.getKeyword('Precise plano de simetría', ['XY', 'YZ', 'ZX', '3puntos'], { def: 'XY' });
    var kw = k && k.kw;
    var n = kw === 'YZ' ? v3(1, 0, 0) : (kw === 'ZX' ? v3(0, 1, 0) : v3(0, 0, 1));
    var pp = await ctx.getPoint('Precise un punto del plano', { def: { x: 0, y: 0 } });
    var w = pt(pp) ? G3.dot(n, v3(pp.x, pp.y, pp.z || 0)) : 0;
    var del = await ctx.getKeyword('¿Borrar objetos de origen?', ['Sí', 'No'], { def: 'No' });
    if (del === null) return;
    ctx.doc.mark('SIMETRIA3D');
    /* reflexión: I - 2·n·nᵀ, con traslación por w */
    var m = [1 - 2 * n.x * n.x, -2 * n.x * n.y, -2 * n.x * n.z, 0,
             -2 * n.y * n.x, 1 - 2 * n.y * n.y, -2 * n.y * n.z, 0,
             -2 * n.z * n.x, -2 * n.z * n.y, 1 - 2 * n.z * n.z, 0,
             2 * w * n.x, 2 * w * n.y, 2 * w * n.z, 1];
    var made = 0;
    sel.forEach(function (e) {
      if (!S.is3D(e)) return;
      if (del && del.kw === 'S') { S.xform(e, m, ctx.doc); made++; return; }
      var mesh = S.meshOf(e).clone();
      mesh.transform(m);
      addSolid(ctx, S.fromMesh(mesh, { layer: e.layer, color: e.color }));
      made++;
    });
    ctx.app.refresh(true);
    ctx.out(made + ' objeto(s) reflejado(s).');
  });

  Cmd.add(['MATRIZ3D', '3DARRAY'], { group: '3d', icon: 'arr3d', title: 'Matriz 3D' },
  async function (ctx) {
    var sel = await get3D(ctx, 'Designe objetos');
    if (!sel) return;
    var k = await ctx.getKeyword('Indique el tipo de matriz', ['Rectangular', 'Polar'], { def: 'Rectangular' });
    if (!k) return;
    ctx.doc.mark('MATRIZ3D');
    var made = 0, i;
    if (k.kw === 'R') {
      var nr = await ctx.getReal('Introduzca el número de filas (---)', { def: 1 });
      var nc = await ctx.getReal('Introduzca el número de columnas (|||)', { def: 1 });
      var nl = await ctx.getReal('Introduzca el número de niveles (...)', { def: 1 });
      if (!num(nr) || !num(nc) || !num(nl)) { ctx.doc.discardTx(); return; }
      nr = Math.max(1, Math.round(nr)); nc = Math.max(1, Math.round(nc)); nl = Math.max(1, Math.round(nl));
      var dr = nr > 1 ? await ctx.getDist('Precise la distancia entre filas') : 0;
      var dc = nc > 1 ? await ctx.getDist('Precise la distancia entre columnas') : 0;
      var dl = nl > 1 ? await ctx.getDist('Precise la distancia entre niveles') : 0;
      for (i = 0; i < sel.length; i++)
        for (var r = 0; r < nr; r++)
          for (var c = 0; c < nc; c++)
            for (var l = 0; l < nl; l++) {
              if (!r && !c && !l) continue;
              var mesh = S.meshOf(sel[i]).clone();
              mesh.transform(G3.mTrans(c * (dc || 0), r * (dr || 0), l * (dl || 0)));
              addSolid(ctx, S.fromMesh(mesh, { layer: sel[i].layer, color: sel[i].color }));
              made++;
            }
    } else {
      var n = await ctx.getReal('Introduzca el número de elementos', { def: 4 });
      if (!num(n)) { ctx.doc.discardTx(); return; }
      n = Math.max(2, Math.round(n));
      var ang = await ctx.getAngle('Precise el ángulo a rellenar', { def: 360 });
      if (ang === null) ang = Math.PI * 2;
      var a1 = await ctx.getPoint('Precise el primer punto del eje de la matriz'); if (!pt(a1)) { ctx.doc.discardTx(); return; }
      var a2 = await ctx.getPoint('Precise el segundo punto del eje', { base: a1 }); if (!pt(a2)) { ctx.doc.discardTx(); return; }
      var axP = v3(a1.x, a1.y, a1.z || 0);
      var axD = G3.norm(v3(a2.x - a1.x, a2.y - a1.y, (a2.z || 0) - (a1.z || 0)));
      var full = Math.abs(Math.abs(ang) - Math.PI * 2) < 1e-6;
      for (i = 0; i < sel.length; i++)
        for (var q = 1; q < n; q++) {
          var a = ang * q / (full ? n : n - 1);
          var mm = S.meshOf(sel[i]).clone();
          mm.transform(G3.mRotAxis(axP, axD, a));
          addSolid(ctx, S.fromMesh(mm, { layer: sel[i].layer, color: sel[i].color }));
          made++;
        }
    }
    if (!made) { ctx.doc.discardTx(); ctx.err('No se ha creado ningún elemento.'); return; }
    ctx.app.refresh(true);
    ctx.out(made + ' copia(s) creada(s).');
  });

  Cmd.add(['DESPLAZA3D', '3DMOVE'], { group: '3d', icon: 'mov3d', title: 'Desplazar en 3D' },
  async function (ctx) {
    var sel = await ctx.getSelection('Designe objetos');
    if (!sel || !sel.length) return;
    var b = await ctx.getPoint('Precise punto base'); if (!pt(b)) return;
    var d = await ctx.getPoint('Precise segundo punto', { base: b }); if (!pt(d)) return;
    var dz = await ctx.getDist('Precise desplazamiento en Z', { def: 0 });
    if (!num(dz)) dz = 0;
    ctx.doc.mark('DESPLAZA3D');
    var m = G3.mTrans(d.x - b.x, d.y - b.y, ((d.z || 0) - (b.z || 0)) + dz);
    sel.forEach(function (e) {
      if (S.is3D(e)) S.xform(e, m, ctx.doc);
      else E.transform(e, G.M(1, 0, 0, 1, d.x - b.x, d.y - b.y), ctx.doc);
    });
    ctx.app.refresh(true);
    ctx.out(sel.length + ' objeto(s) desplazado(s).');
  });

  /* ============================================================
     VISTAS Y NAVEGACIÓN
     ============================================================ */
  function viewCmd(names, view, title) {
    Cmd.add(names, { group: 'view3d', icon: 'view3d', title: title, transparent: true }, async function (ctx) {
      ctx.app.set3D(true);
      ctx.app.view3d.cam.setView(view);
      ctx.app.zoom3dExtents();
      ctx.app.refresh();
      ctx.out('Vista: ' + title);
    });
  }
  viewCmd(['SUPERIOR', 'TOP', 'PLANTA'], 'SUPERIOR', 'Superior');
  viewCmd(['INFERIOR', 'BOTTOM'], 'INFERIOR', 'Inferior');
  viewCmd(['IZQUIERDA', 'LEFT'], 'IZQUIERDA', 'Izquierda');
  viewCmd(['DERECHA', 'RIGHT'], 'DERECHA', 'Derecha');
  viewCmd(['FRONTAL', 'FRONT', 'ALZADO'], 'FRONTAL', 'Frontal');
  viewCmd(['POSTERIOR', 'BACK'], 'POSTERIOR', 'Posterior');
  viewCmd(['SWISO', 'ISOSO'], 'SWISO', 'Isométrica SO');
  viewCmd(['SEISO', 'ISOSE'], 'SEISO', 'Isométrica SE');
  viewCmd(['NEISO', 'ISONE'], 'NEISO', 'Isométrica NE');
  viewCmd(['NWISO', 'ISONO'], 'NWISO', 'Isométrica NO');

  Cmd.add(['ORBITA', '3DORBIT', 'ORBIT', '3DO'], { group: 'view3d', icon: 'orbit', title: 'Órbita 3D', transparent: true },
  async function (ctx) {
    ctx.app.set3D(true);
    ctx.app.orbitMode = true;
    ctx.out('Órbita 3D: arrastre con el botón izquierdo. Pulse Esc o Intro para salir.');
    await ctx.getKeyword('Pulse Intro o Esc para salir de la órbita', ['Salir'], { def: 'Salir' }).catch(function () { });
    ctx.app.orbitMode = false;
  });

  Cmd.add(['ESTILOVISUAL', 'VSCURRENT', 'SOMBRA', 'SHADEMODE'], { group: 'view3d', icon: 'vstyle', title: 'Estilo visual', transparent: true },
  async function (ctx, args) {
    var names = Object.keys(V3.STYLES);
    var k = args && args[0] ? String(args[0]).toUpperCase() : null;
    if (!k) {
      var r = await ctx.getKeyword('Introduzca una opción de estilo visual', names, { def: 'ARISTASSOMBRA' });
      if (!r) return;
      k = r.keyword || r.kw;
    }
    var found = null, kU = String(k).toUpperCase();
    for (var i = 0; i < names.length; i++) if (names[i] === kU) { found = names[i]; break; }
    if (!found) for (i = 0; i < names.length; i++) if (names[i].indexOf(kU) === 0) { found = names[i]; break; }
    if (!found) { ctx.err('Estilo visual desconocido.'); return; }
    ctx.app.set3D(found !== '2DESTRUCTURA');
    ctx.app.view3d.style = found;
    ctx.app.view3d.dirty = true;
    ctx.app.refresh();
    ctx.out('Estilo visual: ' + V3.STYLES[found].label);
  });

  Cmd.add(['PLANTA2D', 'PLAN', 'VISTA2D'], { group: 'view3d', icon: 'plan', title: 'Volver a 2D', transparent: true },
  async function (ctx) {
    ctx.app.set3D(false);
    ctx.app.refresh();
    ctx.out('Vista de modelo 2D.');
  });

  Cmd.add(['PERSPECTIVA', 'PERSPECTIVE'], { group: 'view3d', icon: 'persp', title: 'Perspectiva', transparent: true },
  async function (ctx) {
    ctx.app.set3D(true);
    var k = await ctx.getKeyword('Proyección', ['PAralela', 'PErspectiva'],
                                 { def: ctx.app.view3d.cam.persp ? 'PErspectiva' : 'PAralela' });
    if (!k) return;
    ctx.app.view3d.cam.persp = (k.kw === 'PE');
    ctx.app.refresh();
    ctx.out('Proyección ' + (ctx.app.view3d.cam.persp ? 'en perspectiva' : 'paralela') + '.');
  });

  Cmd.add(['ZOOM3D', 'ZOOMEXT3D'], { group: 'view3d', icon: 'zoomext', title: 'Zoom extensión 3D', transparent: true },
  async function (ctx) {
    ctx.app.set3D(true);
    ctx.app.zoom3dExtents();
    ctx.app.refresh();
  });

  Cmd.add(['ELEV', 'ELEVACION', 'ELEVATION'], { group: '3d', icon: 'elev', title: 'Elevación' },
  async function (ctx) {
    var e = await ctx.getDist('Precise nueva elevación por defecto', { def: ctx.doc.vars.ELEVATION || 0 });
    if (!num(e)) return;
    ctx.doc.mark('ELEV');
    ctx.doc.vars.ELEVATION = e;
    var t = await ctx.getDist('Precise nueva altura de objeto por defecto', { def: ctx.doc.vars.THICKNESS || 0 });
    if (num(t)) ctx.doc.vars.THICKNESS = t;
    ctx.out('Elevación ' + G.fmt(e, 4) + '   altura de objeto ' + G.fmt(ctx.doc.vars.THICKNESS || 0, 4));
  });

  /* ============================================================
     CONVERSIÓN Y DENSIDAD DE MALLA
     ============================================================ */
  Cmd.add(['FACETRES', 'RESOLUCIONMALLA'], { group: '3d', icon: 'facetres', title: 'Resolución de malla' },
  async function (ctx) {
    var v = await ctx.getReal('Introduzca el valor de FACETRES (0.01 a 10)', { def: ctx.doc.vars.FACETRES || 0.5 });
    if (!num(v)) return;
    v = Math.max(0.01, Math.min(10, v));
    ctx.doc.mark('FACETRES');
    ctx.doc.vars.FACETRES = v;
    /* vuelve a teselar las primitivas paramétricas */
    var n = 0;
    ctx.doc.ents().forEach(function (e) {
      if (!S.is3D(e) || !e.hist || e.hist.op === 'mesh') return;
      var base = e.hist.r || e.hist.R || 10;
      S.reparam(e, { seg: Math.max(6, Math.round(M.segFor(base) * v * 2)) }, ctx.doc);
      n++;
    });
    ctx.app.refresh(true);
    ctx.out('FACETRES = ' + G.fmt(v, 3) + '.  ' + n + ' sólido(s) reteselado(s).');
  });

  Cmd.add(['CONVERTIRENSOLIDO', 'CONVTOSOLID'], { group: '3d', icon: 'tosolid', title: 'Convertir en sólido' },
  async function (ctx) {
    var sel = await ctx.getSelection('Designe mallas a convertir');
    if (!sel) return;
    ctx.doc.mark('CONVERTIRENSOLIDO');
    var n = 0;
    sel.forEach(function (e) {
      if (e.type !== 'MESH') return;
      ctx.doc.touch(e);
      e.type = 'SOLID3D';
      n++;
    });
    ctx.app.refresh(true);
    ctx.out(n + ' malla(s) convertida(s) en sólido.');
  });

  Cmd.add(['CONVERTIRENMALLA', 'CONVTOMESH'], { group: '3d', icon: 'tomesh', title: 'Convertir en malla' },
  async function (ctx) {
    var sel = await get3D(ctx, 'Designe sólidos a convertir');
    if (!sel) return;
    ctx.doc.mark('CONVERTIRENMALLA');
    sel.forEach(function (e) {
      var mesh = S.meshOf(e);
      if (!mesh) return;
      S.setMesh(e, mesh.clone(), ctx.doc);
      e.type = 'MESH';
    });
    ctx.app.refresh(true);
    ctx.out(sel.length + ' sólido(s) convertido(s) en malla.');
  });

  /* Panel del árbol de operaciones */
  Cmd.add(['ARBOL', 'FEATURETREE', 'HISTORIAL', 'ARBOLOP'],
  { group: '3d', icon: 'tree', title: 'Árbol de operaciones', transparent: true },
  async function (ctx) {
    ctx.app.ui.togglePalette('arbol', true);
    ctx.out('Árbol de operaciones: cambie una medida y la pieza se reconstruye; ' +
            'el círculo de la izquierda suprime o restituye la operación.');
  });

})();
