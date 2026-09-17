/* ============================================================
   dim.js — Generación de geometría de cotas y directrices
   Devuelve primitivas (líneas, sólidos de flecha, arcos, textos)
   usadas por el visor, la exportación DXF y el comando DESCOMP.
   ============================================================ */
(function () {
  'use strict';
  var CAD = (window.CAD = window.CAD || {});
  var G = CAD.G, E = CAD.E;
  var D = (CAD.Dim = {});

  D.style = function (ent, doc) {
    var s = (doc.dimStyles[ent.style] || doc.dimStyles['ISO-25'] || E.defaultDimStyle('ISO-25'));
    var o = Object.assign({}, s);
    if (ent.over) Object.assign(o, ent.over);
    var k = (o.DIMSCALE || 1) * (doc.vars.DIMSCALE || 1);
    o._k = k;
    o.asz = o.DIMASZ * k; o.txt = o.DIMTXT * k; o.exe = o.DIMEXE * k;
    o.exo = o.DIMEXO * k; o.gap = o.DIMGAP * k; o.dli = o.DIMDLI * k;
    return o;
  };

  /* Formato del valor medido */
  D.fmtVal = function (v, st, angular) {
    var dec = angular ? (st.DIMADEC || 0) : (st.DIMDEC === undefined ? 2 : st.DIMDEC);
    var val = angular ? v : v * (st.DIMLFAC || 1);
    if (st.DIMRND) val = Math.round(val / st.DIMRND) * st.DIMRND;
    var s = val.toFixed(dec);
    if ((st.DIMZIN & 8) && s.indexOf('.') >= 0) s = s.replace(/0+$/, '').replace(/\.$/, '');
    if (angular) s += '°';
    var post = st.DIMPOST || '';
    if (post) s = post.indexOf('<>') >= 0 ? post.replace('<>', s) : s + post;
    return s;
  };

  D.textOf = function (ent, st, measure, angular) {
    if (ent.textOverride === ' ') return '';
    if (ent.textOverride) {
      if (ent.textOverride.indexOf('<>') >= 0) return ent.textOverride.replace('<>', D.fmtVal(measure, st, angular));
      return ent.textOverride;
    }
    return D.fmtVal(measure, st, angular);
  };

  function arrow(tip, ang, sz, style) {
    var back = G.polar(tip, ang + Math.PI, sz);
    var w = sz / 6;
    if (style === 'Open' || style === 'Oblique') {
      return { line: [G.polar(tip, ang + Math.PI * 0.75, sz), tip, G.polar(tip, ang - Math.PI * 0.75, sz)] };
    }
    if (style === 'Tick' || style === 'ArchTick') {
      return { line: [G.polar(tip, ang + Math.PI * 0.75, sz * 0.8), G.polar(tip, ang - Math.PI * 0.25, sz * 0.8)] };
    }
    if (style === 'Dot') {
      return { dot: { c: tip, r: sz / 3 } };
    }
    return {
      solid: [tip, G.polar(back, ang + Math.PI / 2, w), G.polar(back, ang - Math.PI / 2, w)]
    };
  }

  function emptyGeo() { return { lines: [], solids: [], arcs: [], texts: [], dots: [] }; }

  function addArrow(geo, tip, ang, st) {
    var a = arrow(tip, ang, st.asz, st.DIMBLK);
    if (a.solid) geo.solids.push(a.solid);
    if (a.line) for (var i = 1; i < a.line.length; i++) geo.lines.push([a.line[i - 1], a.line[i]]);
    if (a.dot) geo.dots.push(a.dot);
  }

  D.textWidth = function (txt, h) { return String(txt).length * h * 0.62; };

  /* ============================================================
     Constructor principal
     ============================================================ */
  D.build = function (ent, doc) {
    if (ent.type === 'LEADER') return D.buildLeader(ent, doc);
    var st = D.style(ent, doc);
    var geo = D.buildKind(ent, doc, st);
    D.addTolerance(geo, st);
    D.addAlt(geo, st, ent);
    return geo;
  };

  /* Tolerancias simétricas / desviaciones / límites */
  D.addTolerance = function (geo, st) {
    if (!geo.texts.length || (!st.DIMTOL && !st.DIMLIM)) return;
    var t = geo.texts[0];
    var dec = st.DIMTDEC === undefined ? 2 : st.DIMTDEC;
    var h = t.h * (st.DIMTFAC || 0.7);
    var c = Math.cos(t.rot || 0), s2 = Math.sin(t.rot || 0);
    function at(dx, dy) { return { x: t.p.x + dx * c - dy * s2, y: t.p.y + dx * s2 + dy * c }; }
    var w = D.textWidth(t.text, t.h);
    if (st.DIMLIM) {
      var base = parseFloat(String(t.text).replace(/[^\d.\-]/g, '')) || 0;
      var hi = (base + (st.DIMTP || 0)).toFixed(dec);
      var lo = (base - (st.DIMTM || 0)).toFixed(dec);
      geo.texts.splice(0, 1);
      geo.texts.push({ p: at(0, h * 0.72), h: h, rot: t.rot, text: hi, halign: 1, valign: 2 });
      geo.texts.push({ p: at(0, -h * 0.72), h: h, rot: t.rot, text: lo, halign: 1, valign: 2 });
      return;
    }
    var tp = st.DIMTP || 0, tm = st.DIMTM || 0;
    if (Math.abs(tp - tm) < 1e-9 && tp !== 0) {
      var sym = '\u00b1' + tp.toFixed(dec);
      geo.texts.push({ p: at(w / 2 + D.textWidth(sym, h) / 2 + h * 0.2, 0), h: h, rot: t.rot, text: sym, halign: 1, valign: 2 });
      return;
    }
    var up = (tp >= 0 ? '+' : '-') + Math.abs(tp).toFixed(dec);
    var dn = (tm > 0 ? '-' : '+') + Math.abs(tm).toFixed(dec);
    var off = w / 2 + Math.max(D.textWidth(up, h), D.textWidth(dn, h)) / 2 + h * 0.25;
    geo.texts.push({ p: at(off, h * 0.62), h: h, rot: t.rot, text: up, halign: 1, valign: 2 });
    geo.texts.push({ p: at(off, -h * 0.62), h: h, rot: t.rot, text: dn, halign: 1, valign: 2 });
  };

  /* Unidades alternativas entre corchetes */
  D.addAlt = function (geo, st, ent) {
    if (!st.DIMALT || !geo.texts.length) return;
    var t = geo.texts[0];
    var v = (ent.measurement || 0) * (st.DIMALTF || 1);
    var txt = '[' + v.toFixed(st.DIMALTD === undefined ? 2 : st.DIMALTD) + (st.DIMAPOST || '') + ']';
    var c = Math.cos(t.rot || 0), s2 = Math.sin(t.rot || 0);
    var dx = D.textWidth(t.text, t.h) / 2 + D.textWidth(txt, t.h * 0.85) / 2 + t.h * 0.3;
    geo.texts.push({
      p: { x: t.p.x + dx * c, y: t.p.y + dx * s2 },
      h: t.h * 0.85, rot: t.rot, text: txt, halign: 1, valign: 2
    });
  };

  /* Marca de centro / líneas de centro */
  D.centerMark = function (c, r, st, lines) {
    var geo = emptyGeo();
    var sz = st.asz || 2.5;
    geo.lines.push([G.polar(c, 0, sz), G.polar(c, Math.PI, sz)]);
    geo.lines.push([G.polar(c, Math.PI / 2, sz), G.polar(c, -Math.PI / 2, sz)]);
    if (lines) {
      [0, Math.PI / 2, Math.PI, -Math.PI / 2].forEach(function (a) {
        geo.lines.push([G.polar(c, a, sz * 2), G.polar(c, a, r + sz)]);
      });
    }
    return geo;
  };

  D.buildKind = function (ent, doc, st) {
    switch (ent.kind) {
      case 'linear': case 'aligned': case 'rotated': return D.buildLinear(ent, doc, st);
      case 'angular': return D.buildAngular(ent, doc, st);
      case 'radius': return D.buildRadius(ent, doc, st);
      case 'diameter': return D.buildDiameter(ent, doc, st);
      case 'arclen': return D.buildArcLen(ent, doc, st);
      case 'ordinate': return D.buildOrdinate(ent, doc, st);
      case 'centermark': return D.centerMark(ent.center, ent.radius || 0, st, ent.lines);
      default: return emptyGeo();
    }
  };

  /* ---------- Cota lineal / alineada ---------- */
  D.buildLinear = function (ent, doc, st) {
    var geo = emptyGeo();
    var p1 = ent.p1, p2 = ent.p2, p3 = ent.p3;
    if (!p1 || !p2 || !p3) return geo;
    var ang = ent.kind === 'aligned' ? G.ang(p1, p2) : (ent.rot || 0);
    var u = { x: Math.cos(ang), y: Math.sin(ang) };
    var nrm = { x: -u.y, y: u.x };

    /* proyección sobre la línea de cota que pasa por p3 */
    var t1 = G.dot(G.sub(p1, p3), u), t2 = G.dot(G.sub(p2, p3), u);
    var d1 = { x: p3.x + u.x * t1, y: p3.y + u.y * t1 };
    var d2 = { x: p3.x + u.x * t2, y: p3.y + u.y * t2 };
    var measure = Math.abs(t2 - t1);
    ent.measurement = measure;

    /* líneas de extensión */
    var e1o = G.dot(G.sub(d1, p1), nrm), e2o = G.dot(G.sub(d2, p2), nrm);
    var s1 = e1o >= 0 ? 1 : -1, s2 = e2o >= 0 ? 1 : -1;
    if (!st.DIMSE1) geo.lines.push([G.add(p1, G.mul(nrm, s1 * st.exo)), G.add(d1, G.mul(nrm, s1 * st.exe))]);
    if (!st.DIMSE2) geo.lines.push([G.add(p2, G.mul(nrm, s2 * st.exo)), G.add(d2, G.mul(nrm, s2 * st.exe))]);

    var txt = D.textOf(ent, st, measure, false);
    var tw = D.textWidth(txt, st.txt);
    var fits = measure > tw + 2 * st.asz * 1.2;
    var dirA = G.ang(d1, d2);

    if (fits) {
      geo.lines.push([d1, d2]);
      addArrow(geo, d1, dirA, st);
      addArrow(geo, d2, dirA + Math.PI, st);
    } else {
      /* flechas y línea hacia fuera */
      geo.lines.push([d1, d2]);
      geo.lines.push([d1, G.polar(d1, dirA + Math.PI, st.asz * 2)]);
      geo.lines.push([d2, G.polar(d2, dirA, st.asz * 2)]);
      addArrow(geo, d1, dirA + Math.PI, st);
      addArrow(geo, d2, dirA, st);
    }

    /* texto */
    if (txt) {
      var tp = ent.textPos || G.mid(d1, d2);
      var trot = ang;
      if (st.DIMTIH && Math.abs(Math.sin(ang)) > 0.7) trot = 0;
      /* normaliza para que el texto nunca quede cabeza abajo */
      var nd = G.na(trot);
      if (nd > Math.PI / 2 + 1e-6 && nd < 1.5 * Math.PI - 1e-6) trot = nd - Math.PI;
      var off = st.DIMTAD === 1 ? st.gap + st.txt / 2 : 0;
      var side = G.dot(G.sub(p3, G.mid(p1, p2)), nrm) >= 0 ? 1 : 1;
      var tpos = ent.textPos ? tp : G.add(tp, G.mul(nrm, off * side));
      if (!fits && !ent.textPos) tpos = G.add(G.polar(d2, dirA, st.asz * 2 + tw / 2 + st.gap), G.mul(nrm, off));
      geo.texts.push({ p: tpos, h: st.txt, rot: trot, text: txt, halign: 1, valign: 2 });
      if (ent.textPos) geo.lines.push([G.mid(d1, d2), ent.textPos]);
    }
    return geo;
  };

  /* ---------- Cota angular ---------- */
  D.buildAngular = function (ent, doc, st) {
    var geo = emptyGeo();
    var c = ent.center, p1 = ent.p1, p2 = ent.p2, p3 = ent.p3;
    if (!c || !p1 || !p2 || !p3) return geo;
    var r = G.dist(c, p3);
    var a1 = G.ang(c, p1), a2 = G.ang(c, p2);
    /* elige el sector que contiene p3 */
    var a3 = G.ang(c, p3);
    var s0 = a1, s1 = a2;
    if (!G.inArc(a3, a1, a2)) { s0 = a2; s1 = a1; }
    var sweep = G.sweep(s0, s1);
    ent.measurement = G.deg(sweep);

    /* líneas de extensión desde los extremos hasta el arco */
    [[p1, a1], [p2, a2]].forEach(function (pr) {
      var d = G.dist(c, pr[0]);
      if (d < r) geo.lines.push([G.polar(c, pr[1], d + st.exo), G.polar(c, pr[1], r + st.exe)]);
    });

    geo.arcs.push({ c: c, r: r, a0: s0, a1: s1 });
    var q0 = G.polar(c, s0, r), q1 = G.polar(c, s1, r);
    addArrow(geo, q0, s0 + Math.PI / 2, st);
    addArrow(geo, q1, s1 - Math.PI / 2, st);

    var txt = D.textOf(ent, st, G.deg(sweep), true);
    var am = s0 + sweep / 2;
    var tpos = ent.textPos || G.polar(c, am, r + st.gap + st.txt / 2);
    geo.texts.push({ p: tpos, h: st.txt, rot: 0, text: txt, halign: 1, valign: 2 });
    return geo;
  };

  /* ---------- Cota de radio ---------- */
  D.buildRadius = function (ent, doc, st) {
    var geo = emptyGeo();
    var c = ent.center, p = ent.p1;
    if (!c || !p) return geo;
    var r = G.dist(c, p);
    ent.measurement = r;
    var a = G.ang(c, p);
    var txt = D.textOf(ent, st, r, false);
    if (!ent.textOverride) txt = 'R' + txt;
    var tw = D.textWidth(txt, st.txt);
    var out = ent.textPos || G.polar(c, a, r + st.asz * 3 + tw);
    var inside = G.dist(c, out) < r;
    if (inside) {
      geo.lines.push([out, p]);
      addArrow(geo, p, a, st);
    } else {
      var start = G.polar(c, a, r * 0.0);
      geo.lines.push([G.polar(c, a, 0), p]);
      addArrow(geo, p, a, st);
      geo.lines.push([p, out]);
    }
    geo.lines.push([out, G.polar(out, G.ang(c, out), tw + st.gap)]);
    geo.texts.push({
      p: G.polar(out, G.ang(c, out), tw / 2 + st.gap / 2), h: st.txt, rot: 0,
      text: txt, halign: 1, valign: 1, below: true
    });
    geo.texts[geo.texts.length - 1].p = G.add(geo.texts[geo.texts.length - 1].p, { x: 0, y: st.gap });
    /* marca de centro */
    geo.lines.push([G.polar(c, 0, st.asz / 2), G.polar(c, Math.PI, st.asz / 2)]);
    geo.lines.push([G.polar(c, Math.PI / 2, st.asz / 2), G.polar(c, -Math.PI / 2, st.asz / 2)]);
    return geo;
  };

  /* ---------- Cota de diámetro ---------- */
  D.buildDiameter = function (ent, doc, st) {
    var geo = emptyGeo();
    var c = ent.center, p = ent.p1;
    if (!c || !p) return geo;
    var r = G.dist(c, p);
    ent.measurement = 2 * r;
    var a = G.ang(c, p);
    var p2 = G.polar(c, a + Math.PI, r);
    var txt = D.textOf(ent, st, 2 * r, false);
    if (!ent.textOverride) txt = 'Ø' + txt;
    var tw = D.textWidth(txt, st.txt);
    var fits = 2 * r > tw + 2 * st.asz * 1.5;
    if (fits) {
      geo.lines.push([p2, p]);
      addArrow(geo, p, a, st);
      addArrow(geo, p2, a + Math.PI, st);
      var tp = ent.textPos || c;
      var trot = a;
      var nd = G.na(trot);
      if (nd > Math.PI / 2 + 1e-6 && nd < 1.5 * Math.PI - 1e-6) trot = nd - Math.PI;
      geo.texts.push({ p: G.add(tp, { x: 0, y: st.gap + st.txt / 2 }), h: st.txt, rot: trot, text: txt, halign: 1, valign: 2 });
    } else {
      var out = ent.textPos || G.polar(c, a, r + st.asz * 3 + tw);
      geo.lines.push([p, out]);
      addArrow(geo, p, a, st);
      geo.lines.push([out, G.polar(out, G.ang(c, out), tw + st.gap)]);
      geo.texts.push({ p: G.add(G.polar(out, G.ang(c, out), tw / 2 + st.gap / 2), { x: 0, y: st.gap }), h: st.txt, rot: 0, text: txt, halign: 1, valign: 1 });
    }
    return geo;
  };

  /* ---------- Longitud de arco ---------- */
  D.buildArcLen = function (ent, doc, st) {
    var geo = emptyGeo();
    var c = ent.center, p1 = ent.p1, p2 = ent.p2, p3 = ent.p3;
    if (!c || !p1 || !p2 || !p3) return geo;
    var r0 = G.dist(c, p1), r = G.dist(c, p3);
    var a1 = G.ang(c, p1), a2 = G.ang(c, p2);
    var sweep = G.sweep(a1, a2);
    ent.measurement = r0 * sweep;
    geo.lines.push([G.polar(c, a1, r0 + st.exo), G.polar(c, a1, r + st.exe)]);
    geo.lines.push([G.polar(c, a2, r0 + st.exo), G.polar(c, a2, r + st.exe)]);
    geo.arcs.push({ c: c, r: r, a0: a1, a1: a2 });
    addArrow(geo, G.polar(c, a1, r), a1 + Math.PI / 2, st);
    addArrow(geo, G.polar(c, a2, r), a2 - Math.PI / 2, st);
    var txt = D.textOf(ent, st, r0 * sweep, false);
    var am = a1 + sweep / 2;
    var tpos = ent.textPos || G.polar(c, am, r + st.gap + st.txt / 2);
    geo.texts.push({ p: tpos, h: st.txt, rot: 0, text: '⌒' + txt, halign: 1, valign: 2 });
    return geo;
  };

  /* ---------- Cota de coordenada ---------- */
  D.buildOrdinate = function (ent, doc, st) {
    var geo = emptyGeo();
    var p1 = ent.p1, p2 = ent.p2;
    if (!p1 || !p2) return geo;
    var xAxis = ent.ordX;
    var v = xAxis ? p1.x : p1.y;
    ent.measurement = v;
    var mid1, mid2;
    if (xAxis) { mid1 = { x: p1.x, y: (p1.y + p2.y) / 2 }; mid2 = { x: p2.x, y: (p1.y + p2.y) / 2 }; }
    else { mid1 = { x: (p1.x + p2.x) / 2, y: p1.y }; mid2 = { x: (p1.x + p2.x) / 2, y: p2.y }; }
    geo.lines.push([p1, mid1], [mid1, mid2], [mid2, p2]);
    var txt = D.textOf(ent, st, v, false);
    geo.texts.push({
      p: G.polar(p2, G.ang(mid2, p2), st.gap + st.txt * 0.2), h: st.txt, rot: 0,
      text: txt, halign: xAxis ? 1 : 0, valign: 2
    });
    return geo;
  };

  /* ---------- Directriz ---------- */
  D.buildLeader = function (ent, doc) {
    var geo = emptyGeo();
    var st = D.style(ent, doc);
    var pts = ent.pts || [];
    if (pts.length < 2) return geo;
    for (var i = 1; i < pts.length; i++) geo.lines.push([pts[i - 1], pts[i]]);
    addArrow(geo, pts[0], G.ang(pts[1], pts[0]), st);
    if (ent.text) {
      var last = pts[pts.length - 1], prev = pts[pts.length - 2];
      var toRight = last.x >= prev.x;
      var h = ent.h || st.txt;
      var lines = String(ent.text).split('\n');
      var wmax = 0;
      lines.forEach(function (l) { wmax = Math.max(wmax, D.textWidth(l, h)); });
      var land = G.add(last, { x: toRight ? wmax + st.gap * 2 : -(wmax + st.gap * 2), y: 0 });
      geo.lines.push([last, land]);
      lines.forEach(function (l, k) {
        geo.texts.push({
          p: { x: last.x + (toRight ? st.gap : -st.gap), y: last.y + st.gap + h * 0.15 + (lines.length - 1 - k) * h * 1.4 },
          h: h, rot: 0, text: l, halign: toRight ? 0 : 2, valign: 0
        });
      });
    }
    return geo;
  };

  /* ---------- Descomposición en entidades reales ---------- */
  D.explode = function (ent, doc) {
    var geo = D.build(ent, doc);
    var out = [];
    var common = { layer: ent.layer, color: ent.color, ltype: ent.ltype, lw: ent.lw };
    geo.lines.forEach(function (l) { out.push(E.line(l[0], l[1], common)); });
    geo.arcs.forEach(function (a) { out.push(E.arc(a.c, a.r, a.a0, a.a1, common)); });
    geo.solids.forEach(function (s) { out.push(E.solid(s, common)); });
    geo.dots.forEach(function (d) { out.push(E.circle(d.c, d.r, common)); });
    geo.texts.forEach(function (t) {
      var te = E.text(t.p, t.h, t.text, t.rot, common);
      te.halign = t.halign; te.valign = t.valign;
      out.push(te);
    });
    return out;
  };
})();
