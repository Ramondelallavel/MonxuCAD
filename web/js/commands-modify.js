/* ============================================================
   commands-modify.js — Comandos de modificación
   ============================================================ */
(function () {
  'use strict';
  var CAD = window.CAD, G = CAD.G, E = CAD.E, Cmd = CAD.Cmd, PR = CAD.Prim;
  var isKw = CAD.CU.isKw;
  function pt(v) { return v && v.x !== undefined ? v : null; }

  /* ============================================================
     Trayectoria paramétrica (recortar / alargar / partir)
     ============================================================ */
  function pathOf(ent) {
    switch (ent.type) {
      case 'LINE': return { prims: [{ t: 'seg', a: ent.p1, b: ent.p2 }], closed: false, src: ent };
      case 'ARC': return { prims: [{ t: 'arc', c: ent.c, r: ent.r, a0: ent.a0, a1: ent.a1, ccw: true }], closed: false, src: ent };
      case 'CIRCLE': return { prims: [{ t: 'arc', c: ent.c, r: ent.r, a0: 0, a1: G.TAU, ccw: true, full: true }], closed: true, src: ent };
      case 'LWPOLYLINE': {
        var v = ent.verts, n = v.length, last = ent.closed ? n : n - 1, out = [];
        for (var i = 0; i < last; i++) {
          var a = v[i], b = v[(i + 1) % n];
          if (a.b) {
            var arc = G.bulgeArc(a, b, a.b);
            if (arc) { out.push({ t: 'arc', c: arc.c, r: arc.r, a0: arc.a0, a1: arc.a1, ccw: arc.ccw }); continue; }
          }
          out.push({ t: 'seg', a: { x: a.x, y: a.y }, b: { x: b.x, y: b.y } });
        }
        return { prims: out, closed: ent.closed, src: ent };
      }
      default: return null;
    }
  }
  CAD.pathOf = pathOf;

  function primSweep(pr) {
    if (pr.full) return G.TAU;
    return pr.ccw ? G.sweep(pr.a0, pr.a1) : G.sweep(pr.a1, pr.a0);
  }
  function primPoint(pr, t) {
    if (pr.t === 'seg') return G.lerp(pr.a, pr.b, t);
    var s = primSweep(pr) * (pr.ccw ? 1 : -1);
    return G.polar(pr.c, pr.a0 + s * t, pr.r);
  }
  function primParamOf(pr, p) {
    if (pr.t === 'seg') {
      var d = G.sub(pr.b, pr.a), l2 = G.dot(d, d);
      if (l2 < 1e-15) return 0;
      return G.dot(G.sub(p, pr.a), d) / l2;
    }
    var sw = primSweep(pr);
    if (sw < 1e-12) return 0;
    var da = pr.ccw ? G.sweep(pr.a0, G.ang(pr.c, p)) : G.sweep(G.ang(pr.c, p), pr.a0);
    return da / sw;
  }
  function primDist(pr, p) {
    if (pr.t === 'seg') return G.distToSeg(p, pr.a, pr.b);
    var t = primParamOf(pr, p);
    if (t < 0 || t > 1) {
      return Math.min(G.dist(p, primPoint(pr, 0)), G.dist(p, primPoint(pr, 1)));
    }
    return Math.abs(G.dist(p, pr.c) - pr.r);
  }

  /* convierte una primitiva a la forma de CAD.Prim para intersecar */
  function toIP(pr) {
    if (pr.t === 'seg') return { t: 'seg', a: pr.a, b: pr.b };
    if (pr.full) return { t: 'cir', c: pr.c, r: pr.r };
    return pr.ccw ? { t: 'arc', c: pr.c, r: pr.r, a0: pr.a0, a1: pr.a1 }
                  : { t: 'arc', c: pr.c, r: pr.r, a0: pr.a1, a1: pr.a0 };
  }

  function pathParamOf(path, p) {
    var best = null;
    path.prims.forEach(function (pr, i) {
      var d = primDist(pr, p);
      if (!best || d < best.d) {
        var t = Math.max(0, Math.min(1, primParamOf(pr, p)));
        best = { d: d, param: i + t };
      }
    });
    return best ? best.param : 0;
  }

  function pathCuts(path, boundPrims) {
    var cuts = [];
    path.prims.forEach(function (pr, i) {
      var ip = toIP(pr);
      boundPrims.forEach(function (bp) {
        if (bp.ent && bp.ent === path.src) return;
        PR.inter(ip, bp, false).forEach(function (q) {
          var t = primParamOf(pr, q);
          if (t > 1e-6 && t < 1 - 1e-6) cuts.push(i + t);
          else if (t >= -1e-6 && t <= 1e-6) cuts.push(i);
          else if (t >= 1 - 1e-6 && t <= 1 + 1e-6) cuts.push(i + 1);
        });
      });
    });
    cuts = cuts.filter(function (v) { return isFinite(v); });
    cuts.sort(function (a, b) { return a - b; });
    var out = [];
    cuts.forEach(function (v) { if (!out.length || Math.abs(out[out.length - 1] - v) > 1e-6) out.push(v); });
    return out;
  }

  /* Devuelve los vértices (con bulge) de la subtrayectoria [from, to] */
  function subPath(path, from, to) {
    var verts = [];
    var n = path.prims.length;
    if (to <= from + 1e-9) return verts;
    var i0 = Math.floor(from + 1e-9), t0 = from - i0;
    var i1 = Math.floor(to - 1e-9), t1 = to - i1;
    if (i0 >= n) return verts;
    if (i1 >= n) { i1 = n - 1; t1 = 1; }
    for (var i = i0; i <= i1; i++) {
      var pr = path.prims[i];
      var ta = i === i0 ? t0 : 0;
      var tb = i === i1 ? t1 : 1;
      if (tb - ta < 1e-9) continue;
      var pa = primPoint(pr, ta), pb = primPoint(pr, tb);
      var b = 0;
      if (pr.t === 'arc') {
        var sw = primSweep(pr) * (tb - ta);
        b = Math.tan((pr.ccw ? sw : -sw) / 4);
      }
      if (!verts.length || G.dist(verts[verts.length - 1], pa) > 1e-9) verts.push({ x: pa.x, y: pa.y, b: b });
      else verts[verts.length - 1].b = b;
      verts.push({ x: pb.x, y: pb.y, b: 0 });
    }
    /* elimina duplicados consecutivos */
    var clean = [];
    verts.forEach(function (v) {
      if (clean.length && G.dist(clean[clean.length - 1], v) < 1e-9) { clean[clean.length - 1].b = clean[clean.length - 1].b || v.b; return; }
      clean.push(v);
    });
    return clean;
  }

  /* ¿todos los tramos van por el mismo círculo y en el mismo sentido?
     Entonces es un arco y no una polilínea.  Al recortar un círculo la
     costura cae en mitad de lo que queda y sin esto salía una polilínea
     partida en dos, que no es lo que devuelve AutoCAD. */
  function unSoloArco(verts) {
    if (verts.length < 3) return null;
    var c = null, r = 0, ccw = null;
    for (var i = 0; i + 1 < verts.length; i++) {
      if (!verts[i].b) return null;
      var a = G.bulgeArc(verts[i], verts[i + 1], verts[i].b);
      if (!a) return null;
      if (c === null) { c = a.c; r = a.r; ccw = a.ccw; }
      else if (a.ccw !== ccw || Math.abs(a.r - r) > Math.max(r, 1) * 1e-7 ||
               G.dist(a.c, c) > Math.max(r, 1) * 1e-7) return null;
    }
    var a0 = G.ang(c, verts[0]), a1 = G.ang(c, verts[verts.length - 1]);
    var res = ccw ? { c: c, r: r, a0: a0, a1: a1 } : { c: c, r: r, a0: a1, a1: a0 };
    var sw = G.sweep(res.a0, res.a1);
    if (!(sw > 1e-9) || sw > G.TAU - 1e-9) return null;
    return res;
  }

  function entsFromVerts(verts, src, closed) {
    if (verts.length < 2) return [];
    var base = { layer: src.layer, color: src.color, ltype: src.ltype, lw: src.lw, ltscale: src.ltscale };
    if (!closed && (src.type === 'CIRCLE' || src.type === 'ARC')) {
      var ar = unSoloArco(verts);
      if (ar) return [E.arc(ar.c, ar.r, ar.a0, ar.a1, base)];
    }
    if (verts.length === 2 && !closed) {
      if (!verts[0].b) return [E.line(verts[0], verts[1], base)];
      var arc = G.bulgeArc(verts[0], verts[1], verts[0].b);
      if (arc) return [arc.ccw ? E.arc(arc.c, arc.r, arc.a0, arc.a1, base) : E.arc(arc.c, arc.r, arc.a1, arc.a0, base)];
    }
    var pl = E.pline(verts, !!closed, base);
    if (src.type === 'LWPOLYLINE') pl.width = src.width || 0;
    return [pl];
  }

  function boundaryPrims(doc, ents) {
    var out = [];
    ents.forEach(function (e) { PR.of(e, doc).forEach(function (p) { p.ent = e; out.push(p); }); });
    return out;
  }

  /* ============================================================
     BORRAR
     ============================================================ */
  Cmd.add(['BORRA', 'ERASE', 'E', 'DEL'], { group: 'modify', icon: 'erase', title: 'Borrar' }, async function (ctx) {
    var sel = await ctx.getSelection('Designe objetos');
    if (!sel || !sel.length) return;
    ctx.doc.mark('BORRA');
    ctx.app.prevSelSet = sel.slice();
    ctx.doc.removeAll(sel);
    ctx.app.selSet = [];
    ctx.app.refresh();
  });

  /* ============================================================
     DESPLAZAR / COPIAR
     ============================================================ */
  Cmd.add(['DESPLAZA', 'MOVE', 'M', 'DE'], { group: 'modify', icon: 'move', title: 'Desplazar' }, async function (ctx) {
    var sel = await ctx.getSelection('Designe objetos');
    if (!sel || !sel.length) return;
    var base = await ctx.getPoint('Precise punto base o', { keywords: ['Desplazamiento'] });
    if (!pt(base)) return;
    var p2 = await ctx.getPoint('Precise segundo punto o <usar primer punto como desplazamiento>', {
      base: base, rubber: 'line', allowNone: true,
      preview: function (c) { return ghost(ctx, sel, G.mTrans(c.x - base.x, c.y - base.y)); }
    });
    var d = pt(p2) ? G.sub(p2, base) : base;
    ctx.doc.mark('DESPLAZA');
    sel.forEach(function (e) { E.transform(e, G.mTrans(d.x, d.y), ctx.doc); });
    ctx.app.refresh();
  });

  Cmd.add(['COPIA', 'COPY', 'CO', 'CP'], { group: 'modify', icon: 'copy', title: 'Copiar' }, async function (ctx) {
    var sel = await ctx.getSelection('Designe objetos');
    if (!sel || !sel.length) return;
    var base = await ctx.getPoint('Precise punto base o', { keywords: ['Desplazamiento', 'mOdo'] });
    if (!pt(base)) return;
    ctx.doc.mark('COPIA');
    var count = 0;
    while (true) {
      var p2 = await ctx.getPoint(count ? 'Precise segundo punto o [Matriz/Salir/Deshacer] <Salir>' : 'Precise segundo punto o [Matriz] <usar primer punto como desplazamiento>', {
        base: base, rubber: 'line', allowNone: true, keywords: ['Matriz', 'Salir', 'desHacer'],
        preview: function (c) { return ghost(ctx, sel, G.mTrans(c.x - base.x, c.y - base.y)); }
      });
      if (p2 === null || (isKw(p2) && p2.kw === 'S')) break;
      if (isKw(p2) && p2.kw === 'M') {
        var n = await ctx.getInt('Indique número de elementos a la matriz', { def: 2 });
        var pe = await ctx.getPoint('Precise segundo punto', { base: base });
        if (!pt(pe) || !n) continue;
        var dd = G.sub(pe, base);
        for (var i = 1; i < n; i++) {
          sel.forEach(function (e) {
            var c2 = E.copyEnt(e);
            E.transform(c2, G.mTrans(dd.x * i, dd.y * i), ctx.doc);
            ctx.doc.add(c2);
          });
        }
        count += n - 1;
        ctx.app.refresh();
        continue;
      }
      if (isKw(p2)) continue;
      var d = G.sub(p2, base);
      sel.forEach(function (e) {
        var c3 = E.copyEnt(e);
        E.transform(c3, G.mTrans(d.x, d.y), ctx.doc);
        ctx.doc.add(c3);
      });
      count++;
      ctx.app.refresh();
    }
    if (!count) ctx.doc.discardTx();
  });

  function ghost(ctx, sel, m) {
    return sel.map(function (e) {
      var c = E.copyEnt(e);
      E.transform(c, m, ctx.doc);
      return c;
    });
  }
  CAD.ghost = ghost;

  /* ============================================================
     GIRAR / ESCALAR / SIMETRÍA
     ============================================================ */
  Cmd.add(['GIRA', 'ROTATE', 'RO', 'GI'], { group: 'modify', icon: 'rotate', title: 'Girar' }, async function (ctx) {
    var sel = await ctx.getSelection('Designe objetos');
    if (!sel || !sel.length) return;
    ctx.out('ANGDIR=sentido antihorario  ANGBASE=0');
    var base = await ctx.getPoint('Precise punto base');
    if (!pt(base)) return;
    /* Igual que en ESCALA: un ángulo tecleado es un ángulo, no una
       distancia.  Antes "90" giraba lo que marcase el cursor. */
    var res = await ctx.getPoint('Precise ángulo de rotación o', {
      base: base, keywords: ['Copiar', 'Referencia'], rubber: 'line', allowNumber: true,
      preview: function (c) { return ghost(ctx, sel, G.mRot(G.ang(base, c), base)); }
    });
    if (res === null) return;
    var copy = false, ang;
    if (isKw(res) && res.kw === 'C') {
      copy = true;
      res = await ctx.getPoint('Precise ángulo de rotación', {
        base: base, allowNumber: true,
        preview: function (c) { return ghost(ctx, sel, G.mRot(G.ang(base, c), base)); }
      });
    }
    if (isKw(res) && res.kw === 'R') {
      var r1 = await ctx.getAngle('Precise ángulo de referencia', { def: 0, base: base });
      var r2 = await ctx.getAngle('Precise ángulo nuevo', { def: 0, base: base });
      ang = (r2 || 0) - (r1 || 0);
    } else if (res && typeof res.num === 'number') ang = G.rad(res.num);
    else if (typeof res === 'number') ang = G.rad(res);
    else if (pt(res)) ang = G.ang(base, res);
    else return;
    ctx.doc.mark('GIRA');
    var m = G.mRot(ang, base);
    if (copy) ghost(ctx, sel, m).forEach(function (e) { ctx.doc.add(e); });
    else sel.forEach(function (e) { E.transform(e, m, ctx.doc); });
    ctx.app.refresh();
  });

  Cmd.add(['ESCALA', 'SCALE', 'SC', 'ES'], { group: 'modify', icon: 'scale', title: 'Escala' }, async function (ctx) {
    var sel = await ctx.getSelection('Designe objetos');
    if (!sel || !sel.length) return;
    var base = await ctx.getPoint('Precise punto base');
    if (!pt(base)) return;
    /* El factor se teclea como número, que es como se usa esto el 99%
       de las veces.  Sin allowNumber, un "2" se tomaba por entrada
       directa de distancia: el objeto acababa escalado por 2/10. */
    var res = await ctx.getPoint('Precise factor de escala o', {
      base: base, keywords: ['Copiar', 'Referencia'], allowNumber: true,
      preview: function (c) {
        var f = G.dist(base, c) / (ctx.app.scaleRef || 1);
        return ghost(ctx, sel, G.mScale(f, f, base));
      }
    });
    if (res === null) return;
    var copy = false, f;
    if (isKw(res) && res.kw === 'C') {
      copy = true;
      res = await ctx.getReal('Precise factor de escala', { base: base });
    }
    if (isKw(res) && res.kw === 'R') {
      var l1 = await ctx.getDist('Precise longitud de referencia', { def: 1, base: base });
      var l2 = await ctx.getDist('Precise longitud nueva', { def: 1, base: base });
      f = (l2 || 1) / (l1 || 1);
    } else if (res && typeof res.num === 'number') f = res.num;
    else if (typeof res === 'number') f = res;
    else if (pt(res)) f = G.dist(base, res) / (ctx.app.scaleRef || 1);
    else return;
    if (!isFinite(f) || Math.abs(f) < 1e-12) { ctx.err('Valor no válido.'); return; }
    ctx.doc.mark('ESCALA');
    var m = G.mScale(f, f, base);
    if (copy) ghost(ctx, sel, m).forEach(function (e) { ctx.doc.add(e); });
    else sel.forEach(function (e) { E.transform(e, m, ctx.doc); });
    ctx.app.refresh();
  });

  Cmd.add(['SIMETRIA', 'MIRROR', 'MI', 'SI'], { group: 'modify', icon: 'mirror', title: 'Simetría' }, async function (ctx) {
    var sel = await ctx.getSelection('Designe objetos');
    if (!sel || !sel.length) return;
    var p1 = await ctx.getPoint('Precise primer punto de línea de simetría');
    if (!pt(p1)) return;
    var p2 = await ctx.getPoint('Precise segundo punto de línea de simetría', {
      base: p1, rubber: 'line',
      preview: function (c) { return ghost(ctx, sel, G.mMirror(p1, c)); }
    });
    if (!pt(p2)) return;
    var del = await ctx.getKeyword('¿Borrar objetos de origen?', ['Sí', 'No'], { def: 'No' });
    ctx.doc.mark('SIMETRIA');
    var m = G.mMirror(p1, p2);
    ghost(ctx, sel, m).forEach(function (e) { ctx.doc.add(e); });
    if (del && (del.kw === 'S')) ctx.doc.removeAll(sel);
    ctx.app.selSet = [];
    ctx.app.refresh();
  });

  /* ============================================================
     DESFASE
     ============================================================ */
  Cmd.add(['DESFASE', 'OFFSET', 'O', 'DF'], { group: 'modify', icon: 'offset', title: 'Desfase' }, async function (ctx) {
    var d = ctx.app.lastOffset || 10;
    var res = await ctx.getReal('Precise distancia de desfase o', { def: G.fmt(d, 4), keywords: ['Punto a atravesar', 'Borrar', 'Capa'] });
    var through = false;
    if (isKw(res)) { if (res.kw === 'PAA') through = true; else return; }
    else if (typeof res === 'number') { d = res; ctx.app.lastOffset = d; }
    ctx.doc.mark('DESFASE');
    var any = false;
    while (true) {
      var e = await ctx.getEntity('Designe objeto a desplazar o <salir>', { allowNone: true });
      if (!e) break;
      var side;
      if (through) {
        var tp = await ctx.getPoint('Precise punto a atravesar', { allowNone: true });
        if (!pt(tp)) break;
        var off = offsetEntity(ctx, e.ent, 0, tp, true);
        if (off) { ctx.doc.add(off); any = true; }
      } else {
        var sp = await ctx.getPoint('Precise punto en lado de desfase o <salir>', {
          allowNone: true,
          preview: function (c) { var o = offsetEntity(ctx, e.ent, d, c); return o ? [o] : []; }
        });
        if (!pt(sp)) break;
        var o2 = offsetEntity(ctx, e.ent, d, sp);
        if (o2) { ctx.doc.add(o2); any = true; }
        else ctx.err('No se puede desfasar este objeto.');
      }
      ctx.app.refresh();
    }
    if (!any) ctx.doc.discardTx();
  });

  function offsetEntity(ctx, ent, d, side, through) {
    var base = { layer: ent.layer, color: ent.color, ltype: ent.ltype, lw: ent.lw, ltscale: ent.ltscale };
    switch (ent.type) {
      case 'LINE': {
        var dir = G.norm(G.sub(ent.p2, ent.p1)), nn = { x: -dir.y, y: dir.x };
        var s = G.dot(G.sub(side, ent.p1), nn) >= 0 ? 1 : -1;
        var dd = through ? Math.abs(G.dot(G.sub(side, ent.p1), nn)) : d;
        return E.line(G.add(ent.p1, G.mul(nn, s * dd)), G.add(ent.p2, G.mul(nn, s * dd)), base);
      }
      case 'CIRCLE': {
        var out = G.dist(ent.c, side) > ent.r;
        var dd2 = through ? Math.abs(G.dist(ent.c, side) - ent.r) : d;
        var r = out ? ent.r + dd2 : ent.r - dd2;
        if (r <= 1e-9) return null;
        return E.circle(ent.c, r, base);
      }
      case 'ARC': {
        var out2 = G.dist(ent.c, side) > ent.r;
        var dd3 = through ? Math.abs(G.dist(ent.c, side) - ent.r) : d;
        var r2 = out2 ? ent.r + dd3 : ent.r - dd3;
        if (r2 <= 1e-9) return null;
        return E.arc(ent.c, r2, ent.a0, ent.a1, base);
      }
      case 'ELLIPSE': return offsetEllipse(ent, d, side, base, through);
      case 'LWPOLYLINE': return offsetPline(ent, d, side, base, through);
      case 'SPLINE': {
        var pts = E.splinePts(ent);
        var offp = offsetPolyPts(pts, d, side, ent.closed);
        if (!offp) return null;
        return E.spline(offp, ent.closed, base);
      }
      default: return null;
    }
  }
  CAD.offsetEntity = offsetEntity;

  /* El desfase de una elipse no es otra elipse: una elipse escalada sólo
     guarda la distancia pedida en los extremos del eje mayor, y en los
     del menor se queda corta en proporción al achatamiento.  Como hace
     AutoCAD, se devuelve una spline que sigue la normal punto a punto.
     Si la elipse es en realidad un círculo sí se devuelve una elipse,
     que ahí sí es exacta. */
  function offsetEllipse(ent, d, side, base, through) {
    var aE = G.len(ent.maj);
    if (aE < 1e-12) return null;
    var bE = aE * ent.ratio;
    if (bE < 1e-12) return null;
    var rot = Math.atan2(ent.maj.y, ent.maj.x);
    var cr = Math.cos(rot), sr = Math.sin(rot);
    /* el punto designado, en los ejes de la elipse */
    var dx = side.x - ent.c.x, dy = side.y - ent.c.y;
    var lx = dx * cr + dy * sr, ly = -dx * sr + dy * cr;
    var fuera = (lx * lx) / (aE * aE) + (ly * ly) / (bE * bE) >= 1;
    var sgn = fuera ? 1 : -1;
    var t0 = ent.t0 === undefined ? 0 : ent.t0;
    var t1 = ent.t1 === undefined ? G.TAU : ent.t1;
    var barr = t1 - t0;
    var entera = Math.abs(barr) < 1e-9 || Math.abs(Math.abs(barr) - G.TAU) < 1e-9;
    if (entera) barr = G.TAU;
    var n = Math.max(48, Math.min(720, Math.ceil(Math.abs(barr) / (Math.PI / 96))));
    var i, t, dd = d;
    if (through) {
      /* distancia real al punto designado */
      var mejor = Infinity;
      for (i = 0; i <= n; i++) {
        t = t0 + barr * i / n;
        var q = G.ellPt(ent.c, ent.maj.x, ent.maj.y, ent.ratio, t);
        var dq = G.dist(q, side);
        if (dq < mejor) mejor = dq;
      }
      dd = mejor;
    }
    if (!(dd > 1e-12)) return null;
    if (Math.abs(ent.ratio - 1) < 1e-6) {           /* círculo: exacto */
      var r = aE + sgn * dd;
      if (r <= 1e-9) return null;
      return E.ellipse(ent.c, { x: r * cr, y: r * sr }, 1, ent.t0, ent.t1, base);
    }
    var pts = [];
    var hasta = entera ? n - 1 : n;
    for (i = 0; i <= hasta; i++) {
      t = t0 + barr * i / n;
      var ct = Math.cos(t), st = Math.sin(t);
      var x = aE * ct, y = bE * st;
      /* normal exterior sin normalizar: la tangente girada un cuarto */
      var nx = bE * ct, ny = aE * st;
      var L = Math.hypot(nx, ny);
      if (L < 1e-12) continue;
      /* hacia dentro, más allá del radio de curvatura el punto se da la
         vuelta y sale un rizo; esos puntos se dejan fuera */
      if (sgn < 0) {
        var rc = Math.pow(aE * aE * st * st + bE * bE * ct * ct, 1.5) / (aE * bE);
        if (dd >= rc - 1e-12) continue;
      }
      var px = x + sgn * dd * nx / L, py = y + sgn * dd * ny / L;
      pts.push({ x: ent.c.x + px * cr - py * sr, y: ent.c.y + px * sr + py * cr });
    }
    if (pts.length < 4) return null;
    return E.spline(pts, entera && pts.length === n, base);
  }

  function sideSign(pts, side, closed) {
    var best = Infinity, sgn = 1;
    for (var i = 0; i < pts.length - (closed ? 0 : 1); i++) {
      var a = pts[i], b = pts[(i + 1) % pts.length];
      var d = G.distToSeg(side, a, b);
      if (d < best) {
        best = d;
        var dir = G.norm(G.sub(b, a)), nn = { x: -dir.y, y: dir.x };
        sgn = G.dot(G.sub(side, a), nn) >= 0 ? 1 : -1;
      }
    }
    return sgn;
  }

  function offsetPolyPts(pts, d, side, closed) {
    var s = sideSign(pts, side, closed);
    var n = pts.length;
    var lines = [];
    for (var i = 0; i < n - (closed ? 0 : 1); i++) {
      var a = pts[i], b = pts[(i + 1) % n];
      if (G.dist(a, b) < 1e-12) continue;
      var dir = G.norm(G.sub(b, a)), nn = { x: -dir.y, y: dir.x };
      lines.push([G.add(a, G.mul(nn, s * d)), G.add(b, G.mul(nn, s * d))]);
    }
    if (!lines.length) return null;
    var out = [];
    if (!closed) out.push(lines[0][0]);
    for (var k = 0; k < lines.length - (closed ? 0 : 1); k++) {
      var L1 = lines[k], L2 = lines[(k + 1) % lines.length];
      var ii = G.interLine(L1[0], L1[1], L2[0], L2[1], true, true);
      out.push(ii.length ? { x: ii[0].x, y: ii[0].y } : L1[1]);
    }
    if (!closed) out.push(lines[lines.length - 1][1]);
    return out;
  }

  function offsetPline(ent, d, side, base, through) {
    var pts = ent.verts.map(function (v) { return { x: v.x, y: v.y }; });
    var hasBulge = ent.verts.some(function (v) { return !!v.b; });
    if (hasBulge) {
      var path = pathOf(ent);
      var s = sideSign(E.plinePts(ent, 1), side, ent.closed);
      var verts = [];
      path.prims.forEach(function (pr, i) {
        if (pr.t === 'seg') {
          var dir = G.norm(G.sub(pr.b, pr.a)), nn = { x: -dir.y, y: dir.x };
          verts.push({ p: G.add(pr.a, G.mul(nn, s * d)), b: 0, q: G.add(pr.b, G.mul(nn, s * d)) });
        } else {
          var outw = pr.ccw ? -s : s;
          var r = pr.r + outw * d;
          if (r <= 1e-9) r = 1e-9;
          verts.push({
            p: G.polar(pr.c, pr.a0, r), q: G.polar(pr.c, pr.a1, r),
            b: Math.tan((primSweep(pr) * (pr.ccw ? 1 : -1)) / 4)
          });
        }
      });
      var res = [];
      verts.forEach(function (v, i) { res.push({ x: v.p.x, y: v.p.y, b: v.b }); });
      var lastv = verts[verts.length - 1];
      if (!ent.closed) res.push({ x: lastv.q.x, y: lastv.q.y, b: 0 });
      return E.pline(res, ent.closed, base);
    }
    var off = offsetPolyPts(pts, d, side, ent.closed);
    if (!off) return null;
    return E.pline(off, ent.closed, base);
  }

  /* ============================================================
     RECORTAR / ALARGAR
     ============================================================ */
  /* RECORTA y ALARGA.
     Desde AutoCAD 2021 el modo de fábrica es el "rápido" (TRIMEXTENDMODE
     = 2): no se designan aristas, se pincha directamente lo que sobra y
     todo lo visible hace de contorno.  Manteniendo Mayús se hace la
     operación contraria.  El modo clásico (designar aristas primero)
     sigue disponible por la opción Corte / Contorno. */
  async function trimExtend(ctx, extendMode) {
    var doc = ctx.doc;
    var quick = doc.vars.TRIMEXTENDMODE === undefined ? 2 : doc.vars.TRIMEXTENDMODE;
    var bp = null, bounds = null;

    if (quick !== 2) {
      ctx.out('Parámetros actuales: Proyección=SCP, Arista=Ninguna, Modo=Estándar');
      ctx.out(extendMode ? 'Designe aristas de contorno ...' : 'Designe aristas de corte ...');
      bounds = await ctx.getSelection('Designe objetos o <designar todo>', { force: true, allowNone: true });
      if (!bounds || !bounds.length) bounds = doc.visible();
      ctx.app.selSet = [];
      bp = boundaryPrims(doc, bounds);
    } else {
      ctx.out('Parámetros actuales: Proyección=SCP, Arista=Ninguna, Modo=Rápido');
    }

    doc.mark(extendMode ? 'ALARGA' : 'RECORTA');
    var any = false, rev = -1;
    var kws = extendMode
      ? ['Contorno', 'Captura', 'Modo', 'Proyección', 'Borrar', 'desHacer']
      : ['Corte', 'Captura', 'Modo', 'Proyección', 'Borrar', 'desHacer'];

    while (true) {
      /* en modo rápido el contorno se recalcula si el dibujo ha cambiado */
      if (quick === 2 && doc.rev !== rev) {
        bp = boundaryPrims(doc, doc.visible());
        rev = doc.rev;
      }
      var msg = extendMode
        ? 'Designe objeto a alargar o mayús-designe para recortar o'
        : 'Designe objeto a recortar o mayús-designe para alargar o';
      if (quick !== 2) msg = extendMode ? 'Designe objeto a alargar o <salir>' : 'Designe objeto a recortar o <salir>';
      var e = await ctx.getEntity(msg, { allowNone: true, keywords: quick === 2 ? kws : null });
      if (!e) break;

      if (e.kw) {
        if (e.kw === 'M') {
          var mk = await ctx.getKeyword('Indique un modo de recorte',
            ['Rápido', 'Estándar'], { def: quick === 2 ? 'Rápido' : 'Estándar' });
          if (mk) {
            quick = doc.vars.TRIMEXTENDMODE = (mk.kw === 'R' ? 2 : 0);
            rev = -1;
            if (quick !== 2) {
              ctx.out(extendMode ? 'Designe aristas de contorno ...' : 'Designe aristas de corte ...');
              bounds = await ctx.getSelection('Designe objetos o <designar todo>', { force: true, allowNone: true });
              if (!bounds || !bounds.length) bounds = doc.visible();
              ctx.app.selSet = [];
              bp = boundaryPrims(doc, bounds);
            }
          }
          continue;
        }
        if (e.kw === 'B') {
          var del = await ctx.getSelection('Designe objetos a borrar', { force: true, allowNone: true });
          if (del && del.length) {
            del.forEach(function (x) { doc.remove(x); });
            any = true;
            rev = -1;
            ctx.app.selSet = [];
            ctx.app.refresh(true);
          }
          continue;
        }
        if (e.kw === 'H') {
          if (doc.undoStack.length) { doc.undo(); rev = -1; ctx.app.refresh(true); }
          continue;
        }
        if (e.kw === 'C' || e.kw === 'CO' || e.kw === 'CA') {
          /* Corte / Contorno: pasa al modo estándar designando aristas */
          ctx.out(extendMode ? 'Designe aristas de contorno ...' : 'Designe aristas de corte ...');
          bounds = await ctx.getSelection('Designe objetos o <designar todo>', { force: true, allowNone: true });
          if (!bounds || !bounds.length) bounds = doc.visible();
          ctx.app.selSet = [];
          bp = boundaryPrims(doc, bounds);
          quick = 0;
          continue;
        }
        continue;
      }

      /* Mayús invierte la operación, igual que en AutoCAD */
      var doExt = e.shift ? !extendMode : extendMode;
      var ok = doExt ? doExtend(ctx, e.ent, e.p, bp) : doTrim(ctx, e.ent, e.p, bp);
      if (ok) { any = true; rev = -1; }
      else ctx.err(doExt ? 'El objeto no intersecta ninguna arista.' : 'El objeto no intersecta ninguna arista de corte.');
      ctx.app.refresh();
    }
    if (!any) doc.discardTx();
  }

  function doTrim(ctx, ent, pick, bp) {
    var path = pathOf(ent);
    if (!path) return false;
    var cuts = pathCuts(path, bp);
    if (!cuts.length) return false;
    var n = path.prims.length;
    var tp = pathParamOf(path, pick);
    var lo = null, hi = null;
    for (var i = 0; i < cuts.length; i++) {
      if (cuts[i] <= tp) lo = cuts[i];
      if (cuts[i] > tp && hi === null) hi = cuts[i];
    }
    var pieces = [];
    if (path.closed) {
      if (cuts.length < 2) return false;
      if (lo === null) { lo = cuts[cuts.length - 1] - n; }
      if (hi === null) { hi = cuts[0] + n; }
      /* conserva el resto recorriendo desde hi hasta lo+n */
      var from = hi, to = lo + n;
      var verts = [];
      var f = from, t = to;
      if (t - f > 1e-9) {
        if (t <= n) verts = subPath(path, f, t);
        else {
          /* El trozo que queda pasa por la costura del contorno.  El
             vértice de unión es el mismo punto en los dos tramos, pero
             el del primero lleva pandeo cero —es sólo marca de fin—, así
             que hay que quedarse con el del segundo: si no, al recortar
             un círculo salía una recta donde tenía que ir la curva. */
          var tr1 = subPath(path, f, n), tr2 = subPath(path, 0, t - n);
          if (tr1.length && tr2.length) {
            if (tr2[0].b) tr1[tr1.length - 1].b = tr2[0].b;
            verts = tr1.concat(tr2.slice(1));
          } else verts = tr1.concat(tr2);
        }
      }
      if (verts.length >= 2) pieces.push(entsFromVerts(verts, ent, false));
    } else {
      if (lo === null && hi === null) return false;
      if (lo !== null && lo > 1e-9) {
        var v1 = subPath(path, 0, lo);
        if (v1.length >= 2) pieces.push(entsFromVerts(v1, ent, false));
      }
      if (hi !== null && hi < n - 1e-9) {
        var v2 = subPath(path, hi, n);
        if (v2.length >= 2) pieces.push(entsFromVerts(v2, ent, false));
      }
      if (lo === null && hi === null) return false;
    }
    ctx.doc.remove(ent);
    pieces.forEach(function (arr) { arr.forEach(function (x) { ctx.doc.add(x); }); });
    return true;
  }

  function doExtend(ctx, ent, pick, bp) {
    var path = pathOf(ent);
    if (!path || path.closed) return false;
    var n = path.prims.length;
    var tp = pathParamOf(path, pick);
    var atStart = tp < n / 2;
    /* intersecciones con la prolongación */
    var pr = atStart ? path.prims[0] : path.prims[n - 1];
    var ip = toIP(pr);
    var cands = [];
    bp.forEach(function (b) {
      if (b.ent === ent) return;
      var bb = Object.assign({}, b);
      if (bb.t === 'seg') { bb.inf1 = true; bb.inf2 = true; }
      var target = Object.assign({}, ip);
      if (target.t === 'seg') { target.inf1 = true; target.inf2 = true; }
      else if (target.t === 'arc') { target = { t: 'cir', c: target.c, r: target.r }; }
      PR.inter(target, bb, false).forEach(function (q) {
        var t = primParamOf(pr, q);
        if (atStart && t < -1e-6) cands.push({ t: t, p: q });
        if (!atStart && t > 1 + 1e-6) cands.push({ t: t, p: q });
      });
    });
    if (!cands.length) return false;
    cands.sort(function (a, b) { return atStart ? b.t - a.t : a.t - b.t; });
    var target = cands[0].p;
    if (ent.type === 'LINE') {
      if (atStart) ent.p1 = { x: target.x, y: target.y };
      else ent.p2 = { x: target.x, y: target.y };
      return true;
    }
    if (ent.type === 'ARC') {
      var a = G.ang(ent.c, target);
      if (atStart) ent.a0 = a; else ent.a1 = a;
      return true;
    }
    if (ent.type === 'LWPOLYLINE') {
      if (atStart) { ent.verts[0].x = target.x; ent.verts[0].y = target.y; }
      else { var lv = ent.verts[ent.verts.length - 1]; lv.x = target.x; lv.y = target.y; }
      return true;
    }
    return false;
  }

  Cmd.add(['RECORTA', 'TRIM', 'TR', 'RR'], { group: 'modify', icon: 'trim', title: 'Recortar' }, function (ctx) { return trimExtend(ctx, false); });
  Cmd.add(['ALARGA', 'EXTEND', 'EX', 'AL'], { group: 'modify', icon: 'extend', title: 'Alargar' }, function (ctx) { return trimExtend(ctx, true); });

  /* ============================================================
     PARTIR
     ============================================================ */
  Cmd.add(['PARTE', 'BREAK', 'BR'], { group: 'modify', icon: 'break', title: 'Partir' }, async function (ctx) {
    var e = await ctx.getEntity('Designe objeto a partir'); if (!e) return;
    var p1 = e.p;
    var r = await ctx.getPoint('Precise segundo punto de ruptura o', { keywords: ['Primer punto'] });
    if (r === null) return;
    if (isKw(r)) {
      var np = await ctx.getPoint('Precise primer punto de ruptura'); if (!pt(np)) return;
      p1 = np;
      r = await ctx.getPoint('Precise segundo punto de ruptura'); if (!pt(r)) return;
    }
    var path = pathOf(e.ent);
    if (!path) { ctx.err('No se puede partir este objeto.'); return; }
    var n = path.prims.length;
    var t1 = pathParamOf(path, p1), t2 = pathParamOf(path, r);
    if (Math.abs(t1 - t2) < 1e-9) { ctx.err('Los puntos de ruptura coinciden.'); return; }
    var lo = Math.min(t1, t2), hi = Math.max(t1, t2);
    ctx.doc.mark('PARTE');
    var pieces = [];
    if (path.closed) {
      var v = subPath(path, hi, n).concat(subPath(path, 0, lo).slice(1));
      if (v.length >= 2) pieces.push(entsFromVerts(v, e.ent, false));
    } else {
      var a = subPath(path, 0, lo), b = subPath(path, hi, n);
      if (a.length >= 2) pieces.push(entsFromVerts(a, e.ent, false));
      if (b.length >= 2) pieces.push(entsFromVerts(b, e.ent, false));
    }
    ctx.doc.remove(e.ent);
    pieces.forEach(function (arr) { arr.forEach(function (x) { ctx.doc.add(x); }); });
    ctx.app.selSet = [];
    ctx.app.refresh();
  });

  Cmd.add(['PARTEEN1', 'BREAKATPOINT'], { group: 'modify', icon: 'break1', title: 'Partir en punto' }, async function (ctx) {
    var e = await ctx.getEntity('Designe objeto a partir'); if (!e) return;
    var p = await ctx.getPoint('Precise punto de ruptura'); if (!pt(p)) return;
    var path = pathOf(e.ent);
    if (!path || path.closed) { ctx.err('No se puede partir este objeto.'); return; }
    var n = path.prims.length;
    var t = pathParamOf(path, p);
    ctx.doc.mark('PARTEEN1');
    var a = subPath(path, 0, t), b = subPath(path, t, n);
    ctx.doc.remove(e.ent);
    if (a.length >= 2) entsFromVerts(a, e.ent, false).forEach(function (x) { ctx.doc.add(x); });
    if (b.length >= 2) entsFromVerts(b, e.ent, false).forEach(function (x) { ctx.doc.add(x); });
    ctx.app.refresh();
  });

  /* ============================================================
     EMPALME / CHAFLÁN
     ============================================================ */
  Cmd.add(['EMPALME', 'FILLET', 'F', 'MB'], { group: 'modify', icon: 'fillet', title: 'Empalme' }, async function (ctx) {
    var r = ctx.app.filletR === undefined ? 10 : ctx.app.filletR;
    if (ctx.app.filletTrim === undefined) ctx.app.filletTrim = true;
    var varios = false;
    while (true) {
      ctx.out('Parámetros actuales: Modo = ' + (ctx.app.filletTrim ? 'RECORTAR' : 'NO RECORTAR') +
              ', Radio del empalme = ' + G.fmt(r, 4));
      var e1 = await ctx.getEntity('Designe el primer objeto o', { keywords: ['desHacer', 'Polilínea', 'RAdio', 'Recortar', 'Múltiple'], allowNone: true });
      if (!e1) return;
      if (isKw(e1)) {
        if (e1.kw === 'RA') {
          var nr = await ctx.getReal('Precise radio de empalme', { def: G.fmt(r, 4) });
          if (typeof nr === 'number') { r = Math.max(0, nr); ctx.app.filletR = r; }
        } else if (e1.kw === 'P') {
          var pe = await ctx.getEntity('Designe una polilínea 2D', {
            filter: function (x) { return x.type === 'LWPOLYLINE'; }
          });
          if (!pe) return;
          ctx.doc.mark('EMPALME');
          var n = roundPline(pe.ent, r, true);
          ctx.out(n + ' línea(s) empalmada(s).');
          ctx.app.refresh();
          return;
        } else if (e1.kw === 'R') {
          /* modo de recorte: con NO RECORTAR se añade el arco y las
             rectas se quedan como estaban, igual que en AutoCAD */
          var md = await ctx.getKeyword('Indique modo de recorte de empalme', ['Recortar', 'No recortar'],
                                        { def: ctx.app.filletTrim ? 'Recortar' : 'No recortar' });
          if (md) {
            ctx.app.filletTrim = (md.kw === 'R');
            ctx.out('Modo de recorte: ' + (ctx.app.filletTrim ? 'RECORTAR' : 'NO RECORTAR'));
          }
        } else if (e1.kw === 'M') {
          varios = true;
          ctx.out('Modo múltiple: el comando sigue activo hasta pulsar Intro o Esc.');
        } else if (e1.kw === 'H') {
          var et = ctx.doc.undo();
          ctx.out(et ? ('Deshecho: ' + et) : 'Nada que deshacer', et ? '' : 'warn');
          ctx.app.refresh(true);
        }
        continue;
      }
      var e2 = await ctx.getEntity('Designe el segundo objeto o mantenga pulsada Mayús para aplicar una esquina');
      if (!e2) { if (varios) continue; return; }
      ctx.doc.mark('EMPALME');
      if (!doFillet(ctx, e1, e2, r, ctx.app.filletTrim)) { ctx.err('No se puede empalmar estos objetos.'); ctx.doc.discardTx(); }
      ctx.app.refresh();
      if (!varios) return;
    }
  });

  /* La abreviatura de una opción llega con sus acentos ("ÁN" de ÁNgulo):
     se comparan sin ellos para no tener que escribirlos en el código. */
  function kwPlano(k) {
    return String(k || '').toUpperCase()
      .replace(/[ÁÀÄÂ]/g, 'A').replace(/[ÉÈËÊ]/g, 'E').replace(/[ÍÌÏÎ]/g, 'I')
      .replace(/[ÓÒÖÔ]/g, 'O').replace(/[ÚÙÜÛ]/g, 'U').replace(/Ñ/g, 'N');
  }

  function doFillet(ctx, e1, e2, r, recorta) {
    if (recorta === undefined) recorta = true;
    var doc = ctx.doc;
    var A = e1.ent, B = e2.ent;
    var pa = PR.of(A, doc), pb = PR.of(B, doc);
    var prA = nearestPrim(pa, e1.p), prB = nearestPrim(pb, e2.p);
    if (!prA || !prB) return false;
    if (r < 1e-9) {
      var ints0 = PR.inter(infOf(prA), infOf(prB), true);
      if (!ints0.length) return false;
      var q0 = nearestTo(ints0, G.mid(e1.p, e2.p));
      trimTo(ctx, A, prA, q0, e1.p);
      trimTo(ctx, B, prB, q0, e2.p);
      return true;
    }
    var centers = filletCenters(prA, prB, r);
    if (!centers.length) return false;
    var ref = G.mid(e1.p, e2.p);
    centers.sort(function (a, b) { return G.dist(a, ref) - G.dist(b, ref); });
    var c = centers[0];
    var t1 = PR.perp(infOf(prA), c) || projOn(prA, c);
    var t2 = PR.perp(infOf(prB), c) || projOn(prB, c);
    if (!t1 || !t2) return false;
    if (prA.t !== 'seg') t1 = G.polar(prA.c, G.ang(prA.c, c), prA.r);
    if (prB.t !== 'seg') t2 = G.polar(prB.c, G.ang(prB.c, c), prB.r);
    var a0 = G.ang(c, t1), a1 = G.ang(c, t2);
    var sw = G.sweep(a0, a1);
    var arcEnt = sw <= Math.PI ? E.arc(c, r, a0, a1, { layer: doc.vars.CLAYER }) : E.arc(c, r, a1, a0, { layer: doc.vars.CLAYER });
    if (recorta) {
      trimTo(ctx, A, prA, t1, e1.p);
      trimTo(ctx, B, prB, t2, e2.p);
    }
    doc.add(arcEnt);
    return true;
  }

  function infOf(pr) {
    if (pr.t === 'seg') return { t: 'seg', a: pr.a, b: pr.b, inf1: true, inf2: true };
    if (pr.t === 'arc') return { t: 'cir', c: pr.c, r: pr.r };
    return pr;
  }
  function projOn(pr, p) {
    if (pr.t === 'seg') return G.closestOnSeg(p, pr.a, pr.b).p;
    return G.polar(pr.c, G.ang(pr.c, p), pr.r);
  }
  function nearestPrim(list, p) {
    var best = null, bd = Infinity;
    list.forEach(function (pr) {
      var q = PR.closest(pr, p), d = G.dist(q, p);
      if (d < bd) { bd = d; best = pr; }
    });
    return best;
  }
  function nearestTo(pts, ref) {
    var best = pts[0], bd = Infinity;
    pts.forEach(function (q) { var d = G.dist(q, ref); if (d < bd) { bd = d; best = q; } });
    return best;
  }
  function filletCenters(p1, p2, r) {
    var out = [];
    function off(pr, s) {
      if (pr.t === 'seg') {
        var d = G.norm(G.sub(pr.b, pr.a)), nn = { x: -d.y, y: d.x };
        return { t: 'seg', a: G.add(pr.a, G.mul(nn, s * r)), b: G.add(pr.b, G.mul(nn, s * r)), inf1: true, inf2: true };
      }
      var rr = pr.r + s * r;
      if (rr <= 1e-9) return null;
      return { t: 'cir', c: pr.c, r: rr };
    }
    [-1, 1].forEach(function (s1) {
      [-1, 1].forEach(function (s2) {
        var o1 = off(p1, s1), o2 = off(p2, s2);
        if (!o1 || !o2) return;
        PR.inter(o1, o2, true).forEach(function (q) { out.push({ x: q.x, y: q.y }); });
      });
    });
    return out;
  }

  /* recorta la entidad hasta el punto q conservando el lado del pick */
  function trimTo(ctx, ent, pr, q, pick) {
    if (ent.type === 'LINE') {
      var d1 = G.dist(ent.p1, pick), d2 = G.dist(ent.p2, pick);
      if (d1 < d2) ent.p2 = { x: q.x, y: q.y }; else ent.p1 = { x: q.x, y: q.y };
      if (d1 < d2) { /* conserva extremo p1 */ } 
      var keepStart = G.dist(ent.p1, pick) <= G.dist(ent.p2, pick);
      return;
    }
    if (ent.type === 'ARC') {
      var a = G.ang(ent.c, q);
      var ap = G.ang(ent.c, pick);
      var toStart = G.sweep(ent.a0, ap), toEnd = G.sweep(ap, ent.a1);
      if (toStart < toEnd) ent.a0 = a; else ent.a1 = a;
      return;
    }
    if (ent.type === 'CIRCLE') {
      return;
    }
    if (ent.type === 'LWPOLYLINE') {
      var path = pathOf(ent);
      var t = pathParamOf(path, q);
      var tp = pathParamOf(path, pick);
      var n = path.prims.length;
      var verts = tp < t ? subPath(path, 0, t) : subPath(path, t, n);
      if (verts.length >= 2) ent.verts = verts;
      return;
    }
  }

  Cmd.add(['CHAFLAN', 'CHAMFER', 'CHA'], { group: 'modify', icon: 'chamfer', title: 'Chaflán' }, async function (ctx) {
    var d1 = ctx.app.chamD1 === undefined ? 5 : ctx.app.chamD1;
    var d2 = ctx.app.chamD2 === undefined ? 5 : ctx.app.chamD2;
    if (ctx.app.chamTrim === undefined) ctx.app.chamTrim = true;
    if (ctx.app.chamMetodo === undefined) ctx.app.chamMetodo = 'D';   /* D = distancias, A = ángulo */
    var varios = false;
    while (true) {
      ctx.out('(Modo ' + (ctx.app.chamTrim ? 'RECORTAR' : 'NO RECORTAR') + ') ' +
              (ctx.app.chamMetodo === 'A'
                ? ('Longitud = ' + G.fmt(ctx.app.chamLong === undefined ? d1 : ctx.app.chamLong, 4) +
                   ', Ángulo = ' + G.fmt(ctx.app.chamAng === undefined ? 45 : ctx.app.chamAng, 4) + '°')
                : ('Distancia base actual1 = ' + G.fmt(d1, 4) + ', Dist2 = ' + G.fmt(d2, 4))));
      var e1 = await ctx.getEntity('Designe la primera línea o', { keywords: ['desHacer', 'Polilínea', 'Distancia', 'ÁNgulo', 'Recortar', 'mÉtodo', 'Múltiple'], allowNone: true });
      if (!e1) return;
      if (isKw(e1)) {
        if (e1.kw === 'D') {
          var a = await ctx.getReal('Precise primera distancia de chaflán', { def: G.fmt(d1, 4) });
          var b = await ctx.getReal('Precise segunda distancia de chaflán', { def: G.fmt(typeof a === 'number' ? a : d2, 4) });
          if (typeof a === 'number') d1 = a;
          if (typeof b === 'number') d2 = b;
          ctx.app.chamD1 = d1; ctx.app.chamD2 = d2; ctx.app.chamMetodo = 'D';
        } else if (kwPlano(e1.kw) === 'AN') {
          /* chaflán por longitud y ángulo, como el método ÁNgulo de AutoCAD */
          var lo = await ctx.getReal('Precise longitud de chaflán desde la primera línea',
                                     { def: G.fmt(ctx.app.chamLong === undefined ? d1 : ctx.app.chamLong, 4) });
          if (typeof lo !== 'number') continue;
          var an = await ctx.getReal('Precise ángulo de chaflán desde la primera línea',
                                     { def: G.fmt(ctx.app.chamAng === undefined ? 45 : ctx.app.chamAng, 4) });
          if (typeof an !== 'number') continue;
          an = ((an % 180) + 180) % 180;
          if (an < 1e-6 || Math.abs(an - 90) < 1e-6) { ctx.err('El ángulo debe estar entre 0 y 90 grados, sin incluirlos.'); continue; }
          ctx.app.chamLong = Math.abs(lo); ctx.app.chamAng = an; ctx.app.chamMetodo = 'A';
        } else if (kwPlano(e1.kw) === 'E') {
          var me = await ctx.getKeyword('Indique método de recorte', ['Distancia', 'ÁNgulo'],
                                        { def: ctx.app.chamMetodo === 'A' ? 'ÁNgulo' : 'Distancia' });
          if (me) {
            ctx.app.chamMetodo = kwPlano(me.kw) === 'AN' ? 'A' : 'D';
            ctx.out('Método: ' + (ctx.app.chamMetodo === 'A' ? 'ÁNGULO' : 'DISTANCIA'));
          }
        } else if (e1.kw === 'R') {
          var md = await ctx.getKeyword('Indique modo de recorte de chaflán', ['Recortar', 'No recortar'],
                                        { def: ctx.app.chamTrim ? 'Recortar' : 'No recortar' });
          if (md) {
            ctx.app.chamTrim = (md.kw === 'R');
            ctx.out('Modo de recorte: ' + (ctx.app.chamTrim ? 'RECORTAR' : 'NO RECORTAR'));
          }
        } else if (e1.kw === 'M') {
          varios = true;
          ctx.out('Modo múltiple: el comando sigue activo hasta pulsar Intro o Esc.');
        } else if (e1.kw === 'H') {
          var et = ctx.doc.undo();
          ctx.out(et ? ('Deshecho: ' + et) : 'Nada que deshacer', et ? '' : 'warn');
          ctx.app.refresh(true);
        } else if (e1.kw === 'P') {
          var pc = await ctx.getEntity('Designe una polilínea 2D', {
            filter: function (x) { return x.type === 'LWPOLYLINE'; }
          });
          if (!pc) return;
          ctx.doc.mark('CHAFLAN');
          var nc = roundPline(pc.ent, Math.min(d1, d2), false);
          ctx.out(nc + ' línea(s) achaflanada(s).');
          ctx.app.refresh();
          return;
        }
        continue;
      }
      var e2 = await ctx.getEntity('Designe la segunda línea');
      if (!e2) { if (varios) continue; return; }
      if (e1.ent.type !== 'LINE' || e2.ent.type !== 'LINE') {
        ctx.err('El chaflán requiere dos líneas.');
        if (varios) continue;
        return;
      }
      ctx.doc.mark('CHAFLAN');
      var A = e1.ent, B = e2.ent;
      var ints = G.interLine(A.p1, A.p2, B.p1, B.p2, true, true);
      if (!ints.length) {
        ctx.err('Las líneas son paralelas.'); ctx.doc.discardTx();
        if (varios) continue;
        return;
      }
      var corner = ints[0];
      var dirA = G.ang(corner, G.dist(A.p1, corner) > G.dist(A.p2, corner) ? A.p1 : A.p2);
      var dirB = G.ang(corner, G.dist(B.p1, corner) > G.dist(B.p2, corner) ? B.p1 : B.p2);
      var u1 = d1, u2 = d2;
      if (ctx.app.chamMetodo === 'A') {
        /* la segunda distancia sale del ángulo pedido sobre la primera línea */
        u1 = ctx.app.chamLong === undefined ? d1 : ctx.app.chamLong;
        u2 = u1 * Math.tan((ctx.app.chamAng === undefined ? 45 : ctx.app.chamAng) * Math.PI / 180);
      }
      var q1 = G.polar(corner, dirA, u1), q2 = G.polar(corner, dirB, u2);
      if (ctx.app.chamTrim) {
        trimTo(ctx, A, null, q1, e1.p);
        trimTo(ctx, B, null, q2, e2.p);
      }
      ctx.doc.add(E.line(q1, q2, { layer: ctx.doc.vars.CLAYER }));
      ctx.app.refresh();
      if (!varios) return;
    }
  });

  /* ============================================================
     MATRIZ
     ============================================================ */
  Cmd.add(['MATRIZ', 'ARRAY', 'AR', 'MA'], { group: 'modify', icon: 'array', title: 'Matriz' }, async function (ctx) {
    var sel = await ctx.getSelection('Designe objetos');
    if (!sel || !sel.length) return;
    var kind = await ctx.getKeyword('Indique tipo de matriz', ['Rectangular', 'POlar', 'Camino'], { def: 'Rectangular' });
    if (!kind) return;
    if (kind.kw === 'R') {
      var cfg = await ctx.app.ui.arrayDialog('rect');
      if (!cfg) return;
      ctx.doc.mark('MATRIZ');
      for (var r = 0; r < cfg.rows; r++) {
        for (var c = 0; c < cfg.cols; c++) {
          if (!r && !c) continue;
          var m = G.mTrans(c * cfg.dx, r * cfg.dy);
          ghost(ctx, sel, m).forEach(function (e) { ctx.doc.add(e); });
        }
      }
      ctx.out(cfg.rows * cfg.cols - 1 + ' copia(s) creada(s).');
      ctx.app.refresh();
      return;
    }
    if (kind.kw === 'PO') {
      var center = await ctx.getPoint('Precise centro de matriz'); if (!pt(center)) return;
      var cfg2 = await ctx.app.ui.arrayDialog('polar');
      if (!cfg2) return;
      ctx.doc.mark('MATRIZ');
      var total = G.rad(cfg2.fill);
      for (var i = 1; i < cfg2.count; i++) {
        var ang = (total * i) / (Math.abs(total - G.TAU) < 1e-6 ? cfg2.count : cfg2.count - 1);
        var m2;
        if (cfg2.rotate) m2 = G.mRot(ang, center);
        else {
          /* sin girar: cada copia se lleva a donde caería su centro */
          var b = E.extentsAll(sel, ctx.doc);
          var cc = { x: (b.x1 + b.x2) / 2, y: (b.y1 + b.y2) / 2 };
          var np = G.rotAbout(cc, center, ang);
          m2 = G.mTrans(np.x - cc.x, np.y - cc.y);
        }
        ghost(ctx, sel, m2).forEach(function (e) { ctx.doc.add(e); });
      }
      ctx.out(cfg2.count - 1 + ' copia(s) creada(s).');
      ctx.app.refresh();
      return;
    }
    return matrizCamino(ctx, sel);
  });

  /* Camino medido: la curva muestreada más su longitud acumulada, para
     poder situar un punto a una distancia dada del arranque. */
  function caminoDe(ent, doc) {
    var ss = E.segs(ent, doc, 3);
    var pts = ss && ss[0] && ss[0].pts ? ss[0].pts.slice() : null;
    if (!pts || pts.length < 2) return null;
    if (ss[0].closed) pts.push(pts[0]);
    var acum = [0], largo = 0;
    for (var i = 1; i < pts.length; i++) { largo += G.dist(pts[i - 1], pts[i]); acum.push(largo); }
    if (largo < 1e-9) return null;
    /* Dirección en cada vértice por diferencia centrada: sobre un arco
       muestreado eso da la tangente exacta, mientras que la cuerda del
       tramo se desvía medio trozo —dos grados en un arco repartido en
       48—.  En los extremos de un camino abierto se extrapola. */
    var cerrado = !!ss[0].closed, np = pts.length;
    var dirs = new Array(np), k;
    for (k = 0; k < np; k++) {
      var ka = k > 0 ? k - 1 : (cerrado ? np - 2 : 0);
      var kb = k < np - 1 ? k + 1 : (cerrado ? 1 : np - 1);
      dirs[k] = G.ang(pts[ka], pts[kb]);
    }
    function delta(a, b) { var d = a - b; while (d > Math.PI) d -= G.TAU; while (d < -Math.PI) d += G.TAU; return d; }
    if (!cerrado && np >= 4) {
      dirs[0] = dirs[1] + delta(dirs[1], dirs[2]);
      dirs[np - 1] = dirs[np - 2] + delta(dirs[np - 2], dirs[np - 3]);
    }
    return {
      largo: largo, cerrado: cerrado,
      en: function (s) {
        s = Math.max(0, Math.min(largo, s));
        var lo = 0, hi = acum.length - 1;
        while (lo < hi - 1) { var md = (lo + hi) >> 1; if (acum[md] <= s) lo = md; else hi = md; }
        var tramo = acum[hi] - acum[lo];
        var f = tramo > 1e-12 ? (s - acum[lo]) / tramo : 0;
        return { p: G.lerp(pts[lo], pts[hi], f), ang: dirs[lo] - f * delta(dirs[lo], dirs[hi]) };
      }
    };
  }

  /* Reparto a lo largo de una curva, como ARRAYPATH.  El objeto de
     origen se convierte en el primer elemento, igual que en AutoCAD, y
     al orientar se gira lo que gire el camino respecto de su arranque:
     así una pieza horizontal sobre un camino horizontal no se mueve. */
  function reparteCamino(ctx, sel, cam, cfg) {
    var n = Math.max(2, cfg.count | 0);
    var paso = cfg.spacing > 0 ? cfg.spacing : cam.largo / (cam.cerrado ? n : (n - 1));
    if (!(paso > 1e-12)) return 0;
    var caja = E.extentsAll(sel, ctx.doc);
    var ref = { x: (caja.x1 + caja.x2) / 2, y: (caja.y1 + caja.y2) / 2 };
    var q0 = cam.en(0), hechos = 0, m0 = null, nuevas = [];
    /* Las copias se sacan del original sin tocar: si se moviese primero,
       las siguientes saldrían del objeto ya desplazado y se irían
       acumulando los traslados. */
    for (var i = 0; i < n; i++) {
      var s = i * paso;
      if (!cam.cerrado && s > cam.largo + 1e-9) break;
      var q = cam.en(s);
      /* primero se orienta sobre el propio sitio y después se lleva al
         camino: G.mMul(m, n) aplica n DESPUÉS de m */
      var m = G.mTrans(q.p.x - ref.x, q.p.y - ref.y);
      if (cfg.align) m = G.mMul(G.mRot(q.ang - q0.ang, ref), m);
      if (i === 0) m0 = m;
      else { ghost(ctx, sel, m).forEach(function (e) { nuevas.push(e); }); hechos++; }
    }
    if (m0) sel.forEach(function (e) { E.transform(e, m0, ctx.doc); });
    nuevas.forEach(function (e) { ctx.doc.add(e); });
    return hechos;
  }
  CAD.caminoDe = caminoDe;
  CAD.reparteCamino = reparteCamino;

  async function matrizCamino(ctx, sel) {
    var pe = await ctx.getEntity('Designe la curva del camino', {
      filter: function (x) {
        return ['LINE', 'ARC', 'CIRCLE', 'ELLIPSE', 'LWPOLYLINE', 'SPLINE'].indexOf(x.type) >= 0;
      }
    });
    if (!pe) return;
    var cam = caminoDe(pe.ent, ctx.doc);
    if (!cam) { ctx.err('Ese objeto no sirve de camino.'); return; }
    var cfg = await ctx.app.ui.arrayDialog('path');
    if (!cfg) return;
    ctx.doc.mark('MATRIZ');
    var n = reparteCamino(ctx, sel, cam, cfg);
    ctx.out(n + ' copia(s) creada(s) a lo largo del camino.');
    ctx.app.refresh();
  }

  /* ============================================================
     ESTIRAR
     ============================================================ */
  Cmd.add(['ESTIRA', 'STRETCH', 'S'], { group: 'modify', icon: 'stretch', title: 'Estirar' }, async function (ctx) {
    ctx.out('Designe objetos a estirar mediante ventana de captura o polígono de captura...');
    var sel = await ctx.getSelection('Designe objetos', { force: true, crossingHint: true });
    if (!sel || !sel.length) return;
    var box = ctx.app.lastSelBox;
    var base = await ctx.getPoint('Precise punto base o', { keywords: ['Desplazamiento'] });
    if (!pt(base)) return;
    var p2 = await ctx.getPoint('Precise segundo punto o <usar primer punto como desplazamiento>', {
      base: base, rubber: 'line', allowNone: true
    });
    var d = pt(p2) ? G.sub(p2, base) : base;
    ctx.doc.mark('ESTIRA');
    sel.forEach(function (e) {
      if (!box) { E.transform(e, G.mTrans(d.x, d.y), ctx.doc); return; }
      var grips = E.grips(e, ctx.doc);
      var inside = grips.filter(function (g) {
        return g.p.x >= box.x1 && g.p.x <= box.x2 && g.p.y >= box.y1 && g.p.y <= box.y2;
      });
      if (!inside.length) return;
      if (inside.length === grips.length) { E.transform(e, G.mTrans(d.x, d.y), ctx.doc); return; }
      inside.forEach(function (g) {
        if (g.k === 'mid' || g.k === 'c' || /^r\d/.test(g.k) || g.k === 'am') return;
        E.moveGrip(e, g.k, { x: g.p.x + d.x, y: g.p.y + d.y }, ctx.doc);
      });
    });
    ctx.app.refresh();
  });

  /* ============================================================
     ALARGA POR LONGITUD
     ============================================================ */
  Cmd.add(['LONGITUD', 'LENGTHEN', 'LEN'], { group: 'modify', icon: 'lengthen', title: 'Longitud' }, async function (ctx) {
    var opt = await ctx.getKeyword('Indique una opción de medición', ['INcremento', 'Porcentaje', 'TOtal', 'DInámica'], { def: 'INcremento' });
    if (!opt) return;
    var val;
    if (opt.kw === 'IN') val = await ctx.getReal('Introduzca longitud delta', { def: 10 });
    else if (opt.kw === 'P') val = await ctx.getReal('Introduzca porcentaje de longitud', { def: 100 });
    else if (opt.kw === 'TO') val = await ctx.getReal('Precise longitud total', { def: 100 });
    else { ctx.err('Opción no disponible.'); return; }
    if (typeof val !== 'number') return;
    ctx.doc.mark('LONGITUD');
    var any = false;
    while (true) {
      var e = await ctx.getEntity('Designe un objeto a modificar o <salir>', { allowNone: true });
      if (!e) break;
      var ent = e.ent;
      if (ent.type === 'LINE') {
        var L = G.dist(ent.p1, ent.p2);
        var nl = opt.kw === 'IN' ? L + val : opt.kw === 'P' ? (L * val) / 100 : val;
        var nearEnd = G.dist(ent.p2, e.p) < G.dist(ent.p1, e.p);
        var a = nearEnd ? G.ang(ent.p1, ent.p2) : G.ang(ent.p2, ent.p1);
        if (nearEnd) ent.p2 = G.polar(ent.p1, a, nl); else ent.p1 = G.polar(ent.p2, a, nl);
        any = true;
      } else if (ent.type === 'ARC') {
        var sw = G.sweep(ent.a0, ent.a1), L2 = ent.r * sw;
        var nl2 = opt.kw === 'IN' ? L2 + val : opt.kw === 'P' ? (L2 * val) / 100 : val;
        var nsw = Math.max(1e-6, Math.min(G.TAU, nl2 / ent.r));
        var nearEnd2 = G.sweep(G.ang(ent.c, e.p), ent.a1) < G.sweep(ent.a0, G.ang(ent.c, e.p));
        if (nearEnd2) ent.a1 = ent.a0 + nsw; else ent.a0 = ent.a1 - nsw;
        any = true;
      } else ctx.err('Objeto no válido.');
      ctx.app.refresh();
    }
    if (!any) ctx.doc.discardTx();
  });

  /* ============================================================
     UNIR
     ============================================================ */
  Cmd.add(['UNIR', 'JOIN', 'J'], { group: 'modify', icon: 'join', title: 'Unir' }, async function (ctx) {
    var sel = await ctx.getSelection('Designe objeto de origen o varios objetos para unir a la vez');
    if (!sel || sel.length < 2) { ctx.err('Se requieren al menos dos objetos.'); return; }
    var usable = sel.filter(function (e) { return e.type === 'LINE' || e.type === 'LWPOLYLINE' || e.type === 'ARC'; });
    if (usable.length < 2) { ctx.err('Ningún objeto se puede unir.'); return; }
    ctx.doc.mark('UNIR');
    var chains = [];
    usable.forEach(function (e) {
      var path = pathOf(e);
      if (!path) return;
      var verts = path.prims.length ? subPath(path, 0, path.prims.length) : [];
      if (verts.length >= 2) chains.push({ verts: verts, ent: e });
    });
    var tol = 1e-6;
    var merged = chains.shift();
    var progress = true, joined = 1;
    while (progress && chains.length) {
      progress = false;
      for (var i = 0; i < chains.length; i++) {
        var c = chains[i], mv = merged.verts, cv = c.verts;
        var mEnd = mv[mv.length - 1], mStart = mv[0];
        var cStart = cv[0], cEnd = cv[cv.length - 1];
        if (G.dist(mEnd, cStart) < tol) { merged.verts = pega(mv, cv); }
        else if (G.dist(mEnd, cEnd) < tol) { merged.verts = pega(mv, reverseVerts(cv)); }
        else if (G.dist(mStart, cEnd) < tol) { merged.verts = pega(cv, mv); }
        else if (G.dist(mStart, cStart) < tol) { merged.verts = pega(reverseVerts(cv), mv); }
        else continue;
        chains.splice(i, 1);
        progress = true; joined++;
        break;
      }
    }
    if (joined < 2) { ctx.err('No hay objetos contiguos que unir.'); ctx.doc.discardTx(); return; }
    var closed = G.dist(merged.verts[0], merged.verts[merged.verts.length - 1]) < tol;
    if (closed) merged.verts.pop();
    var src = merged.ent;
    var base = { layer: src.layer, color: src.color, ltype: src.ltype, lw: src.lw };
    /* Varias rectas seguidas en la misma dirección son una sola recta, y
       varios arcos del mismo círculo un solo arco —o un círculo, si se
       cierra—.  Es lo que devuelve AutoCAD, en vez de una polilínea con
       vértices de sobra. */
    var res = null, nombre = 'polilínea';
    if (closed) {
      var ci = unSoloCirculo(merged.verts);
      if (ci) { res = E.circle(ci.c, ci.r, base); nombre = 'círculo'; }
    } else if (todoRecto(merged.verts)) {
      res = E.line(merged.verts[0], merged.verts[merged.verts.length - 1], base);
      nombre = 'línea';
    } else {
      var ar = unSoloArco(merged.verts);
      if (ar) { res = E.arc(ar.c, ar.r, ar.a0, ar.a1, base); nombre = 'arco'; }
    }
    ctx.doc.removeAll(usable.filter(function (e) { return !chains.some(function (c) { return c.ent === e; }); }));
    ctx.doc.add(res || E.pline(merged.verts, closed, base));
    ctx.out(joined + ' objeto(s) unido(s) en 1 ' + nombre + '.');
    ctx.app.selSet = [];
    ctx.app.refresh();
  });
  /* Empalme de dos cadenas por el vértice común.  El último vértice de
     la primera lleva pandeo cero —es marca de fin— y el de la segunda
     lleva el del tramo que empieza ahí: si no se traslada, al unir dos
     arcos salía una polilínea con la cuerda en vez de la curva. */
  function pega(a, b) {
    var out = a.slice();
    var u = out[out.length - 1];
    if (!u.b && b[0].b) out[out.length - 1] = { x: u.x, y: u.y, b: b[0].b };
    return out.concat(b.slice(1));
  }

  /* ¿todos los tramos son rectos y van en la misma dirección? */
  function todoRecto(v) {
    if (v.length < 2) return false;
    var d0 = null;
    for (var i = 0; i + 1 < v.length; i++) {
      if (v[i].b) return false;
      var d = G.norm(G.sub(v[i + 1], v[i]));
      if (!isFinite(d.x) || !isFinite(d.y)) return false;
      if (!d0) d0 = d;
      else if (Math.abs(d.x * d0.y - d.y * d0.x) > 1e-9 || G.dot(d, d0) < 0) return false;
    }
    return !!d0;
  }
  /* ¿un contorno cerrado hecho de arcos del mismo círculo? */
  function unSoloCirculo(v) {
    if (v.length < 2) return null;
    var c = null, r = 0, total = 0;
    for (var i = 0; i < v.length; i++) {
      var a = v[i], b = v[(i + 1) % v.length];
      if (!a.b) return null;
      var arc = G.bulgeArc(a, b, a.b);
      if (!arc) return null;
      if (c === null) { c = arc.c; r = arc.r; }
      else if (Math.abs(arc.r - r) > Math.max(r, 1) * 1e-7 || G.dist(arc.c, c) > Math.max(r, 1) * 1e-7) return null;
      total += Math.abs(arc.inc);
    }
    return Math.abs(total - G.TAU) < 1e-6 ? { c: c, r: r } : null;
  }

  function reverseVerts(v) {
    var out = [];
    for (var i = v.length - 1; i >= 0; i--) {
      out.push({ x: v[i].x, y: v[i].y, b: i > 0 ? -(v[i - 1].b || 0) : 0 });
    }
    return out;
  }

  /* ============================================================
     DESCOMPONER
     ============================================================ */
  Cmd.add(['DESCOMP', 'EXPLODE', 'X'], { group: 'modify', icon: 'explode', title: 'Descomponer' }, async function (ctx) {
    var sel = await ctx.getSelection('Designe objetos');
    if (!sel || !sel.length) return;
    ctx.doc.mark('DESCOMP');
    var n = 0;
    sel.forEach(function (e) {
      var parts = explodeEnt(ctx, e);
      if (!parts || !parts.length) return;
      ctx.doc.remove(e);
      parts.forEach(function (p) { ctx.doc.add(p); });
      n++;
    });
    if (!n) { ctx.err('No se puede descomponer estos objetos.'); ctx.doc.discardTx(); }
    ctx.app.selSet = [];
    ctx.app.refresh();
  });

  function explodeEnt(ctx, e) {
    var doc = ctx.doc;
    switch (e.type) {
      case 'INSERT': {
        var ch = E.insertChildren(e, doc);
        ch.forEach(function (c) { delete c.__inBlock; c.id = 0; });
        return ch;
      }
      case 'LWPOLYLINE': {
        var path = pathOf(e), out = [];
        var base = { layer: e.layer, color: e.color, ltype: e.ltype, lw: e.lw };
        path.prims.forEach(function (pr) {
          if (pr.t === 'seg') out.push(E.line(pr.a, pr.b, base));
          else out.push(pr.ccw ? E.arc(pr.c, pr.r, pr.a0, pr.a1, base) : E.arc(pr.c, pr.r, pr.a1, pr.a0, base));
        });
        return out;
      }
      case 'DIMENSION': case 'LEADER': return CAD.Dim.explode(e, doc);
      case 'MTEXT': {
        var lay = E.mtextLayout(e, doc), out2 = [];
        lay.lines.forEach(function (l, i) {
          if (!l.trim()) return;
          out2.push(E.text({ x: lay.o.x, y: lay.o.y - (i + 0.85) * lay.lh }, e.h, l, e.rot,
            { layer: e.layer, color: e.color, style: e.style }));
        });
        return out2;
      }
      case 'HATCH': {
        return e.loops.map(function (l) {
          return E.pline(l, true, { layer: e.layer, color: e.color, ltype: e.ltype });
        });
      }
      case 'SPLINE': {
        var pts = E.splinePts(e);
        return [E.pline(pts, e.closed, { layer: e.layer, color: e.color, ltype: e.ltype, lw: e.lw })];
      }
      case 'SOLID': {
        var o3 = [];
        for (var i = 0; i < e.pts.length; i++) o3.push(E.line(e.pts[i], e.pts[(i + 1) % e.pts.length], { layer: e.layer, color: e.color }));
        return o3;
      }
      default: return null;
    }
  }
  CAD.explodeEnt = explodeEnt;

  /* ============================================================
     ALINEAR
     ============================================================ */
  Cmd.add(['ALINEA', 'ALIGN', 'AN'], { group: 'modify', icon: 'align', title: 'Alinear' }, async function (ctx) {
    var sel = await ctx.getSelection('Designe objetos');
    if (!sel || !sel.length) return;
    var s1 = await ctx.getPoint('Precise primer punto de origen'); if (!pt(s1)) return;
    var d1 = await ctx.getPoint('Precise primer punto de destino', { base: s1 }); if (!pt(d1)) return;
    var s2 = await ctx.getPoint('Precise segundo punto de origen', { allowNone: true });
    if (!pt(s2)) {
      ctx.doc.mark('ALINEA');
      sel.forEach(function (e) { E.transform(e, G.mTrans(d1.x - s1.x, d1.y - s1.y), ctx.doc); });
      ctx.app.refresh();
      return;
    }
    var d2 = await ctx.getPoint('Precise segundo punto de destino', { base: s2 }); if (!pt(d2)) return;
    var sc = await ctx.getKeyword('¿Escalar objetos según puntos de alineación?', ['Sí', 'No'], { def: 'No' });
    ctx.doc.mark('ALINEA');
    var ang = G.ang(d1, d2) - G.ang(s1, s2);
    var f = (sc && sc.kw === 'S') ? G.dist(d1, d2) / (G.dist(s1, s2) || 1) : 1;
    var m = G.mMul(G.mMul(G.mTrans(-s1.x, -s1.y), G.mMul(G.mScale(f, f), G.mRot(ang))), G.mTrans(d1.x, d1.y));
    sel.forEach(function (e) { E.transform(e, m, ctx.doc); });
    ctx.app.refresh();
  });

  /* ============================================================
     EDITPOL
     ============================================================ */
  Cmd.add(['EDITPOL', 'PEDIT', 'PE'], { group: 'modify', icon: 'pedit', title: 'Editar polilínea' }, async function (ctx) {
    var e = await ctx.getEntity('Designe polilínea o [Múltiple]');
    if (!e) return;
    var ent = e.ent;
    if (ent.type === 'LINE' || ent.type === 'ARC') {
      var ok = await ctx.getKeyword('El objeto designado no es una polilínea. ¿Desea convertirlo en una?', ['Sí', 'No'], { def: 'Sí' });
      if (!ok || ok.kw !== 'S') return;
      ctx.doc.mark('EDITPOL');
      var path = pathOf(ent);
      var verts = subPath(path, 0, path.prims.length);
      var np = E.pline(verts, false, { layer: ent.layer, color: ent.color, ltype: ent.ltype, lw: ent.lw });
      ctx.doc.remove(ent); ctx.doc.add(np);
      ent = np;
      ctx.app.refresh();
    }
    if (ent.type !== 'LWPOLYLINE') { ctx.err('Objeto no válido.'); return; }
    while (true) {
      var opt = await ctx.getKeyword('Indique una opción', [
        ent.closed ? 'Abrir' : 'Cerrar', 'Juntar', 'Grosor', 'Editar vértices', 'Curvar', 'Spline', 'Estado previo', 'salir'
      ], { def: 'salir' });
      if (!opt || opt.kw === 'S' || opt.kw === 'X') break;
      ctx.doc.mark('EDITPOL');
      if (opt.kw === 'C') ent.closed = true;
      else if (opt.kw === 'A') ent.closed = false;
      else if (opt.kw === 'G') {
        var w = await ctx.getReal('Precise nueva anchura para todos los segmentos', { def: ent.width || 0 });
        if (typeof w === 'number') ent.width = w;
      } else if (opt.kw === 'EP') {
        ent.verts.forEach(function (v) { v.b = 0; });
      } else if (opt.kw === 'S' || opt.kw === 'SP') {
        var pts = ent.verts.map(function (v) { return { x: v.x, y: v.y }; });
        var sp = E.spline(pts, ent.closed, { layer: ent.layer, color: ent.color, ltype: ent.ltype, lw: ent.lw });
        ctx.doc.remove(ent); ctx.doc.add(sp);
        ctx.app.refresh();
        break;
      } else if (opt.kw === 'CU') {
        var b = Math.tan(Math.PI / 16);
        ent.verts.forEach(function (v) { v.b = b; });
      }
      ctx.app.refresh();
    }
  });

  /* Empalma o achaflana todos los vértices de una polilínea */
  function roundPline(ent, r, arc) {
    if (r <= 1e-9) return 0;
    var v = ent.verts, n = v.length;
    if (n < 3) return 0;
    var out = [], done = 0;
    var first = ent.closed ? 0 : 1;
    var last = ent.closed ? n - 1 : n - 2;
    if (!ent.closed) out.push({ x: v[0].x, y: v[0].y, b: v[0].b || 0 });
    for (var i = first; i <= last; i++) {
      var prev = v[(i - 1 + n) % n], cur = v[i], next = v[(i + 1) % n];
      if (cur.b || prev.b) { out.push({ x: cur.x, y: cur.y, b: cur.b || 0 }); continue; }
      var d1 = G.dist(prev, cur), d2 = G.dist(cur, next);
      if (d1 < 1e-9 || d2 < 1e-9) { out.push({ x: cur.x, y: cur.y, b: 0 }); continue; }
      var a1 = G.ang(cur, prev), a2 = G.ang(cur, next);
      var ang = G.na(a2 - a1);
      var half = Math.min(ang, G.TAU - ang) / 2;
      if (half < 1e-6 || Math.abs(half - Math.PI / 2) > Math.PI / 2 - 1e-9) {
        out.push({ x: cur.x, y: cur.y, b: 0 });
        continue;
      }
      var t = arc ? r / Math.tan(half) : r;
      t = Math.min(t, d1 * 0.49, d2 * 0.49);
      if (t < 1e-9) { out.push({ x: cur.x, y: cur.y, b: 0 }); continue; }
      var q1 = G.polar(cur, a1, t), q2 = G.polar(cur, a2, t);
      var bulge = 0;
      if (arc) {
        var inc = Math.PI - 2 * half;
        var ccw = G.cross(G.sub(cur, prev), G.sub(next, cur)) > 0;
        bulge = Math.tan((ccw ? inc : -inc) / 4);
      }
      out.push({ x: q1.x, y: q1.y, b: bulge });
      out.push({ x: q2.x, y: q2.y, b: 0 });
      done++;
    }
    if (!ent.closed) out.push({ x: v[n - 1].x, y: v[n - 1].y, b: 0 });
    if (done) ent.verts = out;
    return done;
  }
  CAD.roundPline = roundPline;

  /* Exporta utilidades usadas por otros módulos */
  CAD.trimUtil = { pathOf: pathOf, subPath: subPath, pathParamOf: pathParamOf, entsFromVerts: entsFromVerts, boundaryPrims: boundaryPrims };
})();
