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

  function entsFromVerts(verts, src, closed) {
    if (verts.length < 2) return [];
    var base = { layer: src.layer, color: src.color, ltype: src.ltype, lw: src.lw, ltscale: src.ltscale };
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
    if (!count) ctx.doc.undoStack.pop();
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
    var res = await ctx.getPoint('Precise ángulo de rotación o', {
      base: base, keywords: ['Copiar', 'Referencia'], rubber: 'line',
      preview: function (c) { return ghost(ctx, sel, G.mRot(G.ang(base, c), base)); }
    });
    if (res === null) return;
    var copy = false, ang;
    if (isKw(res) && res.kw === 'C') {
      copy = true;
      res = await ctx.getPoint('Precise ángulo de rotación', {
        base: base, preview: function (c) { return ghost(ctx, sel, G.mRot(G.ang(base, c), base)); }
      });
    }
    if (isKw(res) && res.kw === 'R') {
      var r1 = await ctx.getAngle('Precise ángulo de referencia', { def: 0, base: base });
      var r2 = await ctx.getAngle('Precise ángulo nuevo', { def: 0, base: base });
      ang = (r2 || 0) - (r1 || 0);
    } else if (typeof res === 'number') ang = G.rad(res);
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
    var res = await ctx.getPoint('Precise factor de escala o', {
      base: base, keywords: ['Copiar', 'Referencia'],
      preview: function (c) {
        var f = G.dist(base, c) / (ctx.app.scaleRef || 10);
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
    } else if (typeof res === 'number') f = res;
    else if (pt(res)) f = G.dist(base, res) / (ctx.app.scaleRef || 10);
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
    if (!any) ctx.doc.undoStack.pop();
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
      case 'ELLIPSE': {
        var half = G.len(ent.maj);
        var f = (half + (G.dist(ent.c, side) > half ? d : -d)) / half;
        if (f <= 0) return null;
        var el = E.ellipse(ent.c, G.mul(ent.maj, f), ent.ratio, ent.t0, ent.t1, base);
        return el;
      }
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
  async function trimExtend(ctx, extendMode) {
    var doc = ctx.doc;
    ctx.out('Parámetros actuales: Proyección=SCP, Arista=Ninguna');
    ctx.out(extendMode ? 'Designe aristas de contorno ...' : 'Designe aristas de corte ...');
    var bounds = await ctx.getSelection('Designe objetos o <designar todo>', { force: true, allowNone: true });
    if (!bounds || !bounds.length) bounds = doc.visible();
    ctx.app.selSet = [];
    var bp = boundaryPrims(doc, bounds);
    doc.mark(extendMode ? 'ALARGA' : 'RECORTA');
    var any = false;
    while (true) {
      var e = await ctx.getEntity(
        extendMode ? 'Designe objeto a alargar o <salir>' : 'Designe objeto a recortar o <salir>',
        { allowNone: true });
      if (!e) break;
      var ok = extendMode ? doExtend(ctx, e.ent, e.p, bp) : doTrim(ctx, e.ent, e.p, bp);
      if (ok) any = true;
      else ctx.err(extendMode ? 'El objeto no intersecta ninguna arista.' : 'El objeto no intersecta ninguna arista de corte.');
      ctx.app.refresh();
    }
    if (!any) doc.undoStack.pop();
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
        else verts = subPath(path, f, n).concat(subPath(path, 0, t - n).slice(1));
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
    while (true) {
      ctx.out('Parámetros actuales: Modo = RECORTAR, Radio del empalme = ' + G.fmt(r, 4));
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
        }
        continue;
      }
      var e2 = await ctx.getEntity('Designe el segundo objeto o mantenga pulsada Mayús para aplicar una esquina');
      if (!e2) return;
      ctx.doc.mark('EMPALME');
      if (!doFillet(ctx, e1, e2, r)) { ctx.err('No se puede empalmar estos objetos.'); ctx.doc.undoStack.pop(); }
      ctx.app.refresh();
      return;
    }
  });

  function doFillet(ctx, e1, e2, r) {
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
    trimTo(ctx, A, prA, t1, e1.p);
    trimTo(ctx, B, prB, t2, e2.p);
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
    while (true) {
      ctx.out('(Modo RECORTAR) Distancia base actual1 = ' + G.fmt(d1, 4) + ', Dist2 = ' + G.fmt(d2, 4));
      var e1 = await ctx.getEntity('Designe la primera línea o', { keywords: ['desHacer', 'Polilínea', 'Distancia', 'Ángulo', 'Recortar', 'Método', 'Múltiple'], allowNone: true });
      if (!e1) return;
      if (isKw(e1)) {
        if (e1.kw === 'D') {
          var a = await ctx.getReal('Precise primera distancia de chaflán', { def: G.fmt(d1, 4) });
          var b = await ctx.getReal('Precise segunda distancia de chaflán', { def: G.fmt(typeof a === 'number' ? a : d2, 4) });
          if (typeof a === 'number') d1 = a;
          if (typeof b === 'number') d2 = b;
          ctx.app.chamD1 = d1; ctx.app.chamD2 = d2;
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
      if (!e2) return;
      if (e1.ent.type !== 'LINE' || e2.ent.type !== 'LINE') { ctx.err('El chaflán requiere dos líneas.'); return; }
      ctx.doc.mark('CHAFLAN');
      var A = e1.ent, B = e2.ent;
      var ints = G.interLine(A.p1, A.p2, B.p1, B.p2, true, true);
      if (!ints.length) { ctx.err('Las líneas son paralelas.'); ctx.doc.undoStack.pop(); return; }
      var corner = ints[0];
      var dirA = G.ang(corner, G.dist(A.p1, corner) > G.dist(A.p2, corner) ? A.p1 : A.p2);
      var dirB = G.ang(corner, G.dist(B.p1, corner) > G.dist(B.p2, corner) ? B.p1 : B.p2);
      var q1 = G.polar(corner, dirA, d1), q2 = G.polar(corner, dirB, d2);
      trimTo(ctx, A, null, q1, e1.p);
      trimTo(ctx, B, null, q2, e2.p);
      ctx.doc.add(E.line(q1, q2, { layer: ctx.doc.vars.CLAYER }));
      ctx.app.refresh();
      return;
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
        var m2 = cfg2.rotate ? G.mRot(ang, center) : G.mTrans(
          G.polar(center, G.ang(center, center), 0).x, 0);
        if (!cfg2.rotate) {
          m2 = G.mIdent();
          var b = E.extentsAll(sel, ctx.doc);
          var cc = { x: (b.x1 + b.x2) / 2, y: (b.y1 + b.y2) / 2 };
          var np = G.rotAbout(cc, center, ang);
          m2 = G.mTrans(np.x - cc.x, np.y - cc.y);
        }
        ghost(ctx, sel, m2).forEach(function (e) { ctx.doc.add(e); });
      }
      ctx.app.refresh();
      return;
    }
    ctx.err('La matriz de camino aún no está disponible.');
  });

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
    if (!any) ctx.doc.undoStack.pop();
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
        if (G.dist(mEnd, cStart) < tol) { merged.verts = mv.concat(cv.slice(1)); }
        else if (G.dist(mEnd, cEnd) < tol) { merged.verts = mv.concat(reverseVerts(cv).slice(1)); }
        else if (G.dist(mStart, cEnd) < tol) { merged.verts = cv.concat(mv.slice(1)); }
        else if (G.dist(mStart, cStart) < tol) { merged.verts = reverseVerts(cv).concat(mv.slice(1)); }
        else continue;
        chains.splice(i, 1);
        progress = true; joined++;
        break;
      }
    }
    if (joined < 2) { ctx.err('No hay objetos contiguos que unir.'); ctx.doc.undoStack.pop(); return; }
    var closed = G.dist(merged.verts[0], merged.verts[merged.verts.length - 1]) < tol;
    if (closed) merged.verts.pop();
    var src = merged.ent;
    ctx.doc.removeAll(usable.filter(function (e) { return !chains.some(function (c) { return c.ent === e; }); }));
    ctx.doc.add(E.pline(merged.verts, closed, { layer: src.layer, color: src.color, ltype: src.ltype, lw: src.lw }));
    ctx.out(joined + ' objeto(s) unido(s) en 1 polilínea.');
    ctx.app.selSet = [];
    ctx.app.refresh();
  });
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
    if (!n) { ctx.err('No se puede descomponer estos objetos.'); ctx.doc.undoStack.pop(); }
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
