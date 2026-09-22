/* ============================================================
   export.js — Salida a DXF, SVG, PDF vectorial, PNG y ZIP
   ============================================================ */
(function () {
  'use strict';
  var CAD = (window.CAD = window.CAD || {});
  var G = CAD.G, E = CAD.E;
  var X = (CAD.Exporter = {});

  var MM2PT = 72 / 25.4;

  X.PAPERS = {
    'ISO A4 (210 x 297 mm)': { w: 210, h: 297 },
    'ISO A3 (297 x 420 mm)': { w: 297, h: 420 },
    'ISO A2 (420 x 594 mm)': { w: 420, h: 594 },
    'ISO A1 (594 x 841 mm)': { w: 594, h: 841 },
    'ISO A0 (841 x 1189 mm)': { w: 841, h: 1189 },
    'Carta (215.9 x 279.4 mm)': { w: 215.9, h: 279.4 },
    'Tabloide (279.4 x 431.8 mm)': { w: 279.4, h: 431.8 }
  };

  /* ------------------------------------------------------------
     Color para salida en papel: el blanco se imprime en negro
     ------------------------------------------------------------ */
  function penRGB(ent, doc, mono) {
    if (mono) return [0, 0, 0];
    var c = E.effColor(ent, doc);
    if (c && typeof c === 'object' && c.rgb) return c.rgb;
    var i = c | 0;
    if (i === 7 || i === 255) return [0, 0, 0];
    return G.aciRGB(i);
  }

  /* ------------------------------------------------------------
     Recolección de trazos independiente del formato
     ------------------------------------------------------------ */
  function collect(doc, opts) {
    opts = opts || {};
    var items = [];
    var list = (opts.entities || doc.visible()).filter(function (e) {
      var l = doc.layer(e.layer);
      return l.plot !== false;
    });
    list.forEach(function (ent) {
      var rgb = penRGB(ent, doc, opts.mono);
      var lw = E.effLw(ent, doc);
      var wmm = lw > 0 ? lw / 100 : 0.25;
      var ltn = E.effLtype(ent, doc);
      var lt = doc.ltypes[ltn];
      var dash = lt && lt.pat && lt.pat.length
        ? lt.pat.map(function (v) { return Math.max(0.01, Math.abs(v) * (doc.vars.LTSCALE || 1) * (ent.ltscale || 1)); })
        : null;
      if (ent.type === 'HATCH') {
        items.push({ kind: 'fillLoops', loops: ent.loops, rgb: rgb, solid: ent.solid || CAD.HatchLib.isSolid(ent.pattern), pattern: ent.pattern, scale: ent.scale, angle: ent.angle, origin: ent.origin, ent: ent });
        return;
      }
      if (ent.type === 'SOLID') {
        items.push({ kind: 'fill', pts: ent.pts, rgb: rgb });
        return;
      }
      if (ent.type === 'TEXT' || ent.type === 'ATTRIB') {
        items.push({ kind: 'text', p: ent.p, h: ent.h, rot: ent.rot, text: ent.text, rgb: rgb, halign: ent.halign, valign: ent.valign });
        return;
      }
      if (ent.type === 'MTEXT') {
        var lay = E.mtextLayout(ent, doc);
        lay.lines.forEach(function (line, i) {
          items.push({
            kind: 'text', p: { x: lay.o.x, y: lay.o.y - (i + 0.85) * lay.lh },
            h: ent.h, rot: ent.rot, text: line, rgb: rgb, halign: 0, valign: 0
          });
        });
        return;
      }
      if (ent.type === 'DIMENSION' || ent.type === 'LEADER') {
        var geo = CAD.Dim.build(ent, doc);
        geo.lines.forEach(function (l) { items.push({ kind: 'path', pts: [l[0], l[1]], rgb: rgb, w: wmm }); });
        geo.arcs.forEach(function (a) { items.push({ kind: 'path', pts: G.arcPts(a.c, a.r, a.a0, a.a1, true), rgb: rgb, w: wmm }); });
        geo.solids.forEach(function (s) { items.push({ kind: 'fill', pts: s, rgb: rgb }); });
        geo.dots.forEach(function (d) { items.push({ kind: 'fill', pts: G.arcPts(d.c, d.r, 0, G.TAU, true), rgb: rgb }); });
        geo.texts.forEach(function (t) {
          items.push({ kind: 'text', p: t.p, h: t.h, rot: t.rot, text: t.text, rgb: rgb, halign: t.halign, valign: t.valign });
        });
        return;
      }
      if (ent.type === 'INSERT') {
        E.insertChildren(ent, doc).forEach(function (ch) {
          collect(doc, { entities: [ch], mono: opts.mono }).forEach(function (it) { items.push(it); });
        });
        return;
      }
      E.segs(ent, doc, 2).forEach(function (s) {
        if (s.pts.length < 2) {
          if (s.pts.length === 1) items.push({ kind: 'point', p: s.pts[0], rgb: rgb });
          return;
        }
        var pts = s.pts.slice();
        if (s.closed) pts.push(pts[0]);
        items.push({ kind: 'path', pts: pts, rgb: rgb, w: wmm, dash: dash });
      });
    });
    return items;
  }
  X.collect = collect;

  /* ------------------------------------------------------------
     La hoja de una presentación
     Trazar o exportar desde una presentación daba un archivo vacío: se
     recogía el espacio activo, y en el papel lo único que hay son las
     anotaciones de la hoja; lo que se ve por las ventanas gráficas vive
     en el modelo.  Aquí se arma la hoja entera: lo dibujado en el papel
     más el modelo visto por cada ventana, ya en coordenadas de papel y
     recortado a su marco.
     ------------------------------------------------------------ */
  function dentro(p, r) { return p.x >= r.x1 - 1e-9 && p.x <= r.x2 + 1e-9 && p.y >= r.y1 - 1e-9 && p.y <= r.y2 + 1e-9; }

  /* Recorta un segmento contra el rectángulo (Liang–Barsky) */
  function corta(a, b, r) {
    var t0 = 0, t1 = 1, dx = b.x - a.x, dy = b.y - a.y;
    var pq = [[-dx, a.x - r.x1], [dx, r.x2 - a.x], [-dy, a.y - r.y1], [dy, r.y2 - a.y]];
    for (var i = 0; i < 4; i++) {
      var pp = pq[i][0], qq = pq[i][1];
      if (Math.abs(pp) < 1e-12) { if (qq < 0) return null; continue; }
      var t = qq / pp;
      if (pp < 0) { if (t > t1) return null; if (t > t0) t0 = t; }
      else { if (t < t0) return null; if (t < t1) t1 = t; }
    }
    return [{ x: a.x + t0 * dx, y: a.y + t0 * dy }, { x: a.x + t1 * dx, y: a.y + t1 * dy }];
  }

  /* Trozos de una polilínea que caen dentro del rectángulo */
  function recortaPoli(pts, r) {
    var out = [], cur = null;
    for (var i = 0; i + 1 < pts.length; i++) {
      var sg = corta(pts[i], pts[i + 1], r);
      if (!sg) { if (cur) { out.push(cur); cur = null; } continue; }
      if (!cur) cur = [sg[0], sg[1]];
      else {
        var ul = cur[cur.length - 1];
        if (Math.abs(ul.x - sg[0].x) > 1e-9 || Math.abs(ul.y - sg[0].y) > 1e-9) { out.push(cur); cur = [sg[0], sg[1]]; }
        else cur.push(sg[1]);
      }
    }
    if (cur) out.push(cur);
    return out;
  }

  /* Recorta un contorno cerrado (Sutherland–Hodgman) */
  function recortaLazo(pts, r) {
    var bordes = [
      function (p) { return p.x >= r.x1; }, function (p) { return p.x <= r.x2; },
      function (p) { return p.y >= r.y1; }, function (p) { return p.y <= r.y2; }
    ];
    var inter = [
      function (a, b) { var t = (r.x1 - a.x) / (b.x - a.x); return { x: r.x1, y: a.y + t * (b.y - a.y) }; },
      function (a, b) { var t = (r.x2 - a.x) / (b.x - a.x); return { x: r.x2, y: a.y + t * (b.y - a.y) }; },
      function (a, b) { var t = (r.y1 - a.y) / (b.y - a.y); return { x: a.x + t * (b.x - a.x), y: r.y1 }; },
      function (a, b) { var t = (r.y2 - a.y) / (b.y - a.y); return { x: a.x + t * (b.x - a.x), y: r.y2 }; }
    ];
    var res = pts.slice();
    for (var k = 0; k < 4 && res.length; k++) {
      var ent2 = res; res = [];
      for (var i = 0; i < ent2.length; i++) {
        var A = ent2[i], B = ent2[(i + 1) % ent2.length];
        var dA = bordes[k](A), dB = bordes[k](B);
        if (dA) res.push(A);
        if (dA !== dB) res.push(inter[k](A, B));
      }
    }
    return res.length >= 3 ? res : null;
  }

  X.hoja = function (app, opts) {
    opts = opts || {};
    var doc = app.doc;
    if (!app.paperMode || !app.layout) return { items: collect(doc, opts), box: opts.box || null };
    var lay = app.layout;
    var items = collect(doc, Object.assign({}, opts, { entities: doc.visible() }));
    var modelo = doc.entities.filter(function (e) {
      var l = doc.layer(e.layer);
      return l.on && !l.frozen && !e.hidden;
    });
    (lay.viewports || []).forEach(function (vp) {
      if (vp.on === false) return;
      var sc = vp.scale || 1;
      var cx = vp.x + vp.w / 2, cy = vp.y + vp.h / 2;
      var r = { x1: vp.x, y1: vp.y, x2: vp.x + vp.w, y2: vp.y + vp.h };
      var T = function (p) { return { x: cx + (p.x - vp.cx) * sc, y: cy + (p.y - vp.cy) * sc }; };
      var vistos = modelo.filter(function (e) { return (vp.frozen || []).indexOf(e.layer) < 0; });
      collect(doc, Object.assign({}, opts, { entities: vistos })).forEach(function (it) {
        if (it.kind === 'path') {
          recortaPoli(it.pts.map(T), r).forEach(function (tr) {
            items.push({ kind: 'path', pts: tr, rgb: it.rgb, w: it.w, dash: it.dash });
          });
        } else if (it.kind === 'fill') {
          var lz = recortaLazo(it.pts.map(T), r);
          if (lz) items.push({ kind: 'fill', pts: lz, rgb: it.rgb });
        } else if (it.kind === 'fillLoops') {
          var loops = [];
          it.loops.forEach(function (l) { var q = recortaLazo(l.map(T), r); if (q) loops.push(q); });
          if (loops.length) items.push(Object.assign({}, it, { loops: loops, scale: (it.scale || 1) * sc }));
        } else if (it.kind === 'text') {
          var q2 = T(it.p);
          if (dentro(q2, r)) items.push(Object.assign({}, it, { p: q2, h: it.h * sc }));
        } else if (it.kind === 'point') {
          var q3 = T(it.p);
          if (dentro(q3, r)) items.push(Object.assign({}, it, { p: q3 }));
        }
      });
    });
    return { items: items, box: { x1: 0, y1: 0, x2: lay.w, y2: lay.h } };
  };

  /* Lo que toca exportar ahora mismo, esté uno donde esté */
  X.paraExportar = function (app, opts) {
    var h = X.hoja(app, opts);
    var o = Object.assign({}, opts, { items: h.items });
    if (h.box) o.box = h.box;
    return o;
  };


  /* ------------------------------------------------------------
     SVG
     ------------------------------------------------------------ */
  X.toSVG = function (doc, opts) {
    opts = opts || {};
    var b = opts.box || E.extentsAll(doc.entities, doc);
    if (!G.bboxValid(b)) b = { x1: 0, y1: 0, x2: 100, y2: 100 };
    var pad = Math.max((b.x2 - b.x1), (b.y2 - b.y1)) * 0.03 + 1;
    b = G.bboxGrow(b, pad);
    var w = b.x2 - b.x1, h = b.y2 - b.y1;
    var out = [];
    out.push('<?xml version="1.0" encoding="UTF-8"?>');
    out.push('<svg xmlns="http://www.w3.org/2000/svg" width="' + fmt(w) + 'mm" height="' + fmt(h) + 'mm" viewBox="0 0 ' + fmt(w) + ' ' + fmt(h) + '">');
    out.push('<rect width="100%" height="100%" fill="#ffffff"/>');
    out.push('<g transform="translate(' + fmt(-b.x1) + ',' + fmt(b.y2) + ') scale(1,-1)">');
    function col(rgb) { return 'rgb(' + rgb[0] + ',' + rgb[1] + ',' + rgb[2] + ')'; }
    (opts.items || collect(doc, opts)).forEach(function (it) {
      if (it.kind === 'path') {
        var d = it.pts.map(function (p, i) { return (i ? 'L' : 'M') + fmt(p.x) + ' ' + fmt(p.y); }).join(' ');
        out.push('<path d="' + d + '" fill="none" stroke="' + col(it.rgb) + '" stroke-width="' + fmt(it.w || 0.25) +
          '"' + (it.dash ? ' stroke-dasharray="' + it.dash.map(fmt).join(',') + '"' : '') + ' stroke-linecap="round" stroke-linejoin="round"/>');
      } else if (it.kind === 'fill') {
        out.push('<polygon points="' + it.pts.map(function (p) { return fmt(p.x) + ',' + fmt(p.y); }).join(' ') + '" fill="' + col(it.rgb) + '"/>');
      } else if (it.kind === 'fillLoops') {
        var dd = it.loops.map(function (l) {
          return l.map(function (p, i) { return (i ? 'L' : 'M') + fmt(p.x) + ' ' + fmt(p.y); }).join(' ') + ' Z';
        }).join(' ');
        if (it.solid) out.push('<path d="' + dd + '" fill="' + col(it.rgb) + '" fill-rule="evenodd"/>');
        else {
          var id = 'hp' + Math.random().toString(36).slice(2, 8);
          out.push('<clipPath id="' + id + '"><path d="' + dd + '" clip-rule="evenodd"/></clipPath>');
          var segs = hatchLines(it);
          var dl = segs.map(function (sg) {
            return 'M' + fmt(sg[0].x) + ' ' + fmt(sg[0].y) + 'L' + fmt(sg[1].x) + ' ' + fmt(sg[1].y);
          }).join('');
          out.push('<path d="' + dl + '" clip-path="url(#' + id + ')" fill="none" stroke="' + col(it.rgb) + '" stroke-width="0.18"/>');
        }
      } else if (it.kind === 'text') {
        var anchor = it.halign === 1 || it.halign === 4 ? 'middle' : it.halign === 2 ? 'end' : 'start';
        var dy = it.valign === 3 ? it.h : it.valign === 2 ? it.h * 0.36 : it.valign === 1 ? 0 : 0;
        out.push('<g transform="translate(' + fmt(it.p.x) + ',' + fmt(it.p.y) + ') rotate(' + fmt(G.deg(it.rot || 0)) + ') scale(1,-1)">' +
          '<text x="0" y="' + fmt(dy) + '" font-family="Arial, Helvetica, sans-serif" font-size="' + fmt(it.h) +
          '" fill="' + col(it.rgb) + '" text-anchor="' + anchor + '">' + esc(it.text) + '</text></g>');
      } else if (it.kind === 'point') {
        out.push('<circle cx="' + fmt(it.p.x) + '" cy="' + fmt(it.p.y) + '" r="0.4" fill="' + col(it.rgb) + '"/>');
      }
    });
    out.push('</g></svg>');
    return out.join('\n');
  };

  function fmt(v) {
    if (!isFinite(v)) return '0';
    return (Math.round(v * 1000) / 1000).toString();
  }
  function esc(s) {
    return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  /* ------------------------------------------------------------
     PDF vectorial
     ------------------------------------------------------------ */
  X.toPDF = function (doc, opts) {
    opts = opts || {};
    var paper = opts.paper || { w: 297, h: 210 };
    var pw = paper.w, ph = paper.h;
    var margin = opts.margin === undefined ? 10 : opts.margin;
    var b = opts.box || E.extentsAll(doc.entities, doc);
    if (!G.bboxValid(b)) b = { x1: 0, y1: 0, x2: 100, y2: 100 };
    var dw = Math.max(1e-6, b.x2 - b.x1), dh = Math.max(1e-6, b.y2 - b.y1);
    var scale = opts.scale || Math.min((pw - 2 * margin) / dw, (ph - 2 * margin) / dh);
    var offx = (pw - dw * scale) / 2 - b.x1 * scale;
    var offy = (ph - dh * scale) / 2 - b.y1 * scale;

    function TX(x) { return ((x * scale + offx) * MM2PT); }
    function TY(y) { return ((y * scale + offy) * MM2PT); }

    var c = [];
    c.push('1 J 1 j');
    var lastCol = null, lastW = null, lastDash = null;
    function setStroke(rgb, wmm, dash) {
      var key = rgb.join(',');
      if (key !== lastCol) { c.push(f3(rgb[0] / 255) + ' ' + f3(rgb[1] / 255) + ' ' + f3(rgb[2] / 255) + ' RG'); lastCol = key; }
      var wpt = Math.max(0.05, (wmm || 0.25) * MM2PT);
      if (wpt !== lastW) { c.push(f3(wpt) + ' w'); lastW = wpt; }
      var ds = dash ? '[' + dash.map(function (v) { return f3(v * scale * MM2PT); }).join(' ') + '] 0 d' : '[] 0 d';
      if (ds !== lastDash) { c.push(ds); lastDash = ds; }
    }
    function setFill(rgb) { c.push(f3(rgb[0] / 255) + ' ' + f3(rgb[1] / 255) + ' ' + f3(rgb[2] / 255) + ' rg'); }

    (opts.items || collect(doc, opts)).forEach(function (it) {
      if (it.kind === 'path') {
        setStroke(it.rgb, it.w, it.dash);
        it.pts.forEach(function (p, i) { c.push(f3(TX(p.x)) + ' ' + f3(TY(p.y)) + ' ' + (i ? 'l' : 'm')); });
        c.push('S');
      } else if (it.kind === 'fill') {
        setFill(it.rgb);
        it.pts.forEach(function (p, i) { c.push(f3(TX(p.x)) + ' ' + f3(TY(p.y)) + ' ' + (i ? 'l' : 'm')); });
        c.push('h f');
      } else if (it.kind === 'fillLoops') {
        if (it.solid) {
          setFill(it.rgb);
          it.loops.forEach(function (l) {
            l.forEach(function (p, i) { c.push(f3(TX(p.x)) + ' ' + f3(TY(p.y)) + ' ' + (i ? 'l' : 'm')); });
            c.push('h');
          });
          c.push('f*');
        } else {
          c.push('q');
          it.loops.forEach(function (l) {
            l.forEach(function (p, i) { c.push(f3(TX(p.x)) + ' ' + f3(TY(p.y)) + ' ' + (i ? 'l' : 'm')); });
            c.push('h');
          });
          c.push('W* n');
          setStroke(it.rgb, 0.18, null);
          hatchLines(it).forEach(function (seg) {
            c.push(f3(TX(seg[0].x)) + ' ' + f3(TY(seg[0].y)) + ' m ' + f3(TX(seg[1].x)) + ' ' + f3(TY(seg[1].y)) + ' l S');
          });
          c.push('Q');
          lastCol = lastW = lastDash = null;
        }
      } else if (it.kind === 'text') {
        setFill(it.rgb);
        var size = it.h * scale * MM2PT;
        var a = it.rot || 0, ca = Math.cos(a), sa = Math.sin(a);
        var tw = String(it.text).length * size * 0.5;
        var ox = it.halign === 1 || it.halign === 4 ? -tw / 2 : it.halign === 2 ? -tw : 0;
        var oy = it.valign === 3 ? -size * 0.85 : it.valign === 2 ? -size * 0.36 : 0;
        var px = TX(it.p.x) + ox * ca - oy * sa, py = TY(it.p.y) + ox * sa + oy * ca;
        c.push('BT /F1 ' + f3(size) + ' Tf ' + f3(ca) + ' ' + f3(sa) + ' ' + f3(-sa) + ' ' + f3(ca) + ' ' + f3(px) + ' ' + f3(py) + ' Tm (' + pdfStr(it.text) + ') Tj ET');
      } else if (it.kind === 'point') {
        setFill(it.rgb);
        c.push(f3(TX(it.p.x) - 0.6) + ' ' + f3(TY(it.p.y) - 0.6) + ' 1.2 1.2 re f');
      }
    });

    var content = c.join('\n');
    var objs = [];
    objs[1] = '<< /Type /Catalog /Pages 2 0 R >>';
    objs[2] = '<< /Type /Pages /Kids [3 0 R] /Count 1 >>';
    objs[3] = '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ' + f3(pw * MM2PT) + ' ' + f3(ph * MM2PT) +
      '] /Resources << /Font << /F1 5 0 R >> >> /Contents 4 0 R >>';
    objs[4] = '<< /Length ' + content.length + ' >>\nstream\n' + content + '\nendstream';
    objs[5] = '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>';

    var pdf = '%PDF-1.4\n%âãÏÓ\n';
    var offsets = [];
    for (var i = 1; i < objs.length; i++) {
      offsets[i] = pdf.length;
      pdf += i + ' 0 obj\n' + objs[i] + '\nendobj\n';
    }
    var xref = pdf.length;
    pdf += 'xref\n0 ' + objs.length + '\n0000000000 65535 f \n';
    for (var j = 1; j < objs.length; j++) pdf += pad10(offsets[j]) + ' 00000 n \n';
    pdf += 'trailer\n<< /Size ' + objs.length + ' /Root 1 0 R >>\nstartxref\n' + xref + '\n%%EOF';

    var bytes = new Uint8Array(pdf.length);
    for (var k = 0; k < pdf.length; k++) bytes[k] = pdf.charCodeAt(k) & 0xff;
    return bytes;
  };

  function hatchLines(it) {
    var b = G.bboxNew();
    it.loops.forEach(function (l) { l.forEach(function (p) { G.bboxAdd(b, p); }); });
    if (!G.bboxValid(b)) return [];
    return CAD.HatchLib.segments(it.pattern, b, it.angle || 0, it.scale || 1, it.origin, 6000);
  }

  function f3(v) { if (!isFinite(v)) v = 0; return (Math.round(v * 1000) / 1000).toString(); }
  function pad10(n) { return ('0000000000' + n).slice(-10); }
  function pdfStr(s) {
    return String(s).replace(/\\/g, '\\\\').replace(/\(/g, '\\(').replace(/\)/g, '\\)')
      .split('').map(function (ch) {
        var c = ch.charCodeAt(0);
        return c > 255 ? '?' : ch;
      }).join('');
  }

  /* ------------------------------------------------------------
     ZIP (método "store", sin compresión)
     ------------------------------------------------------------ */
  var CRC_TABLE = (function () {
    var t = new Uint32Array(256);
    for (var n = 0; n < 256; n++) {
      var c = n;
      for (var k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
      t[n] = c >>> 0;
    }
    return t;
  })();
  function crc32(buf) {
    var c = 0xffffffff;
    for (var i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
    return (c ^ 0xffffffff) >>> 0;
  }
  function toBytes(data) {
    if (data instanceof Uint8Array) return data;
    return new TextEncoder().encode(String(data));
  }

  X.zip = function (files) {
    var chunks = [], central = [], offset = 0;
    files.forEach(function (f) {
      var name = new TextEncoder().encode(f.name);
      var body = toBytes(f.data);
      var crc = crc32(body);
      var lh = new Uint8Array(30 + name.length);
      var dv = new DataView(lh.buffer);
      dv.setUint32(0, 0x04034b50, true);
      dv.setUint16(4, 20, true); dv.setUint16(6, 0, true); dv.setUint16(8, 0, true);
      dv.setUint16(10, 0, true); dv.setUint16(12, 0x2821, true);
      dv.setUint32(14, crc, true);
      dv.setUint32(18, body.length, true); dv.setUint32(22, body.length, true);
      dv.setUint16(26, name.length, true); dv.setUint16(28, 0, true);
      lh.set(name, 30);
      chunks.push(lh, body);
      var ch = new Uint8Array(46 + name.length);
      var cv = new DataView(ch.buffer);
      cv.setUint32(0, 0x02014b50, true);
      cv.setUint16(4, 20, true); cv.setUint16(6, 20, true);
      cv.setUint16(8, 0, true); cv.setUint16(10, 0, true);
      cv.setUint16(12, 0, true); cv.setUint16(14, 0x2821, true);
      cv.setUint32(16, crc, true);
      cv.setUint32(20, body.length, true); cv.setUint32(24, body.length, true);
      cv.setUint16(28, name.length, true);
      cv.setUint32(42, offset, true);
      ch.set(name, 46);
      central.push(ch);
      offset += lh.length + body.length;
    });
    var cdSize = central.reduce(function (a, b) { return a + b.length; }, 0);
    var end = new Uint8Array(22);
    var ev = new DataView(end.buffer);
    ev.setUint32(0, 0x06054b50, true);
    ev.setUint16(8, files.length, true); ev.setUint16(10, files.length, true);
    ev.setUint32(12, cdSize, true); ev.setUint32(16, offset, true);
    var total = offset + cdSize + 22;
    var out = new Uint8Array(total), p = 0;
    chunks.forEach(function (c) { out.set(c, p); p += c.length; });
    central.forEach(function (c) { out.set(c, p); p += c.length; });
    out.set(end, p);
    return out;
  };

  /* Lectura de un ZIP (la usan los formatos empaquetados: 3MF y, de
     rebote, cualquier otro que llegue comprimido).  Se recorre el
     directorio central, que es lo único fiable: los tamaños del
     encabezado local pueden venir a cero cuando el archivo se escribió
     en streaming.  Devuelve [{name, data:Uint8Array}]. */
  X.unzip = async function (buf) {
    var u8 = buf instanceof Uint8Array ? buf : new Uint8Array(buf);
    var dv = new DataView(u8.buffer, u8.byteOffset, u8.byteLength);
    var eocd = -1;
    for (var i = u8.length - 22; i >= 0 && i > u8.length - 66000; i--)
      if (dv.getUint32(i, true) === 0x06054b50) { eocd = i; break; }
    if (eocd < 0) throw new Error('no parece un archivo ZIP');
    var n = dv.getUint16(eocd + 10, true);
    var cdOff = dv.getUint32(eocd + 16, true);
    var dec = new TextDecoder('utf-8');
    var out = [], q = cdOff;
    for (var k = 0; k < n && q + 46 <= u8.length; k++) {
      if (dv.getUint32(q, true) !== 0x02014b50) break;
      var metodo = dv.getUint16(q + 10, true);
      var comp = dv.getUint32(q + 20, true);
      var crudo = dv.getUint32(q + 24, true);
      var nl = dv.getUint16(q + 28, true), el = dv.getUint16(q + 30, true), cl = dv.getUint16(q + 32, true);
      var lo = dv.getUint32(q + 42, true);
      var nombre = dec.decode(u8.subarray(q + 46, q + 46 + nl));
      q += 46 + nl + el + cl;
      if (lo + 30 > u8.length || dv.getUint32(lo, true) !== 0x04034b50) continue;
      var lnl = dv.getUint16(lo + 26, true), lel = dv.getUint16(lo + 28, true);
      var ini = lo + 30 + lnl + lel;
      var cuerpo = u8.subarray(ini, ini + comp);
      var datos;
      if (metodo === 0) datos = cuerpo.slice();
      else if (metodo === 8) datos = await inflaRaw(cuerpo, crudo);
      else continue;                      /* método no soportado */
      out.push({ name: nombre, data: datos });
    }
    return out;
  };
  async function inflaRaw(bytes, tam) {
    if (typeof DecompressionStream === 'undefined')
      throw new Error('este navegador no sabe descomprimir el archivo');
    var ds = new DecompressionStream('deflate-raw');
    var w = ds.writable.getWriter();
    w.write(bytes); w.close();
    var trozos = [], total = 0, r = ds.readable.getReader();
    for (;;) {
      var paso = await r.read();
      if (paso.done) break;
      trozos.push(paso.value); total += paso.value.length;
    }
    var res = new Uint8Array(tam && tam > 0 ? Math.max(tam, total) : total), o = 0;
    trozos.forEach(function (t) { res.set(t, o); o += t.length; });
    return total === res.length ? res : res.subarray(0, total);
  }

  /* ------------------------------------------------------------
     Entrega del archivo al usuario

     Hay tres maneras de sacar un archivo del programa y ninguna está
     disponible en todas partes:

       1. El puente nativo que ponen la aplicación de escritorio y la
          de Android: escribe en el disco con el diálogo del sistema
          y contesta dónde ha quedado el archivo.
       2. Las descargas del visor de claude.ai.
       3. Un enlace de descarga corriente, que entienden todos los
          navegadores.

     Dentro del visor de claude.ai se usa sólo el segundo camino: el
     enlace de descarga no funciona ahí, pero tampoco da error, así
     que probarlo sería anunciar un archivo que no ha salido.
     ------------------------------------------------------------ */
  var downloadsNS = undefined;
  async function getDownloads() {
    if (downloadsNS !== undefined) return downloadsNS;
    try {
      downloadsNS = window.claude && window.claude.use ? await window.claude.use('downloads') : null;
    } catch (e) { downloadsNS = null; }
    return downloadsNS;
  }
  X.getDownloads = getDownloads;

  var TIPOS = {
    dxf: 'application/dxf', dwg: 'image/vnd.dwg', dcad: 'application/json',
    json: 'application/json', png: 'image/png', svg: 'image/svg+xml',
    pdf: 'application/pdf', stl: 'model/stl', obj: 'model/obj',
    mtl: 'model/mtl', '3mf': 'model/3mf', gltf: 'model/gltf+json',
    glb: 'model/gltf-binary', zip: 'application/zip', csv: 'text/csv',
    txt: 'text/plain', nc: 'text/plain', tap: 'text/plain',
    gcode: 'text/plain', mpf: 'text/plain', ptp: 'text/plain'
  };
  X.mimeDe = function (filename) {
    return TIPOS[String(filename).split('.').pop().toLowerCase()] || 'application/octet-stream';
  };

  /* Los exportadores entregan cadenas, Uint8Array o un Blob ya hecho
     (la captura de pantalla).  Todo acaba en Blob para no repetir
     tres veces cada camino de salida. */
  function aBlob(data, filename) {
    if (typeof Blob !== 'undefined' && data instanceof Blob) return data;
    var tipo = X.mimeDe(filename);
    if (typeof data === 'string') return new Blob([data], { type: tipo + ';charset=utf-8' });
    return new Blob([data], { type: tipo });
  }

  async function aBase64(blob) {
    var bytes = new Uint8Array(await blob.arrayBuffer()), partes = [], paso = 0x8000;
    for (var i = 0; i < bytes.length; i += paso)
      partes.push(String.fromCharCode.apply(null, bytes.subarray(i, i + paso)));
    return btoa(partes.join(''));
  }

  /* El puente de Android contesta en el acto y el de escritorio
     devuelve una promesa; esperar el resultado sirve para los dos.
     Contesta «ok:<ruta>», «cancelado» o cualquier otra cosa, que se
     toma por avería y hace seguir probando. */
  async function guardaNativo(app, filename, blob) {
    var n = window.MonxuNative;
    if (!n || typeof n.guardar !== 'function') return 'no';
    var res;
    try { res = await n.guardar(filename, await aBase64(blob), blob.type || ''); }
    catch (e) { return 'no'; }
    res = String(res == null ? '' : res);
    if (res === 'cancelado') return 'cancelado';
    if (res.slice(0, 3) === 'ok:' || res === 'ok') {
      app.out('Archivo guardado: ' + (res.slice(3) || filename));
      return 'si';
    }
    return 'no';
  }

  /* En el navegador se baja como se baja cualquier cosa: a la carpeta
     de descargas.  El diálogo de «guardar en tal carpeta» existe, pero
     sólo se puede abrir mientras dura el gesto del usuario y exportar
     un dibujo grande tarda más que eso; pasado ese momento el navegador
     lo rechaza igual que si lo hubiera cancelado la persona, y no hay
     manera de distinguir una cosa de la otra.  Quien quiera elegir
     carpeta al guardar tiene la aplicación de escritorio, que abre el
     diálogo del sistema. */
  function guardaNavegador(app, filename, blob) {
    try {
      var url = URL.createObjectURL(blob);
      var a = document.createElement('a');
      a.href = url; a.download = filename; a.rel = 'noopener';
      a.style.display = 'none';
      document.body.appendChild(a);
      a.click();
      setTimeout(function () {
        if (a.parentNode) a.parentNode.removeChild(a);
        URL.revokeObjectURL(url);
      }, 30000);
      app.out('Archivo descargado: ' + filename);
      return 'si';
    } catch (e) { return 'no'; }
  }

  /* Guarda un archivo. Si la extensión no está permitida por el visor,
     se entrega comprimido en ZIP conservando el nombre y la extensión. */
  X.saveFile = async function (app, filename, data, kind) {
    var dl = await getDownloads();

    if (!dl) {
      var blob = aBlob(data, filename);
      var v = await guardaNativo(app, filename, blob);
      if (v === 'si') return true;
      if (v === 'cancelado') { app.out('*Cancelado*', 'warn'); return false; }
      if (guardaNavegador(app, filename, blob) === 'si') return true;
      app.ui.downloadFallback(filename, data);
      return false;
    }

    try {
      await dl.save({ filename: filename, data: data });
      app.out('Archivo guardado: ' + filename);
      return true;
    } catch (err) {
      var code = err && err.code;
      if (code === 'rejected_extension' || code === 'extension_not_enabled') {
        var zipName = filename.replace(/\.[^.]+$/, '') + '.zip';
        try {
          var zipped = X.zip([{ name: filename, data: data }]);
          await dl.save({ filename: zipName, data: zipped });
          app.out('El visor no admite descargas ".' + filename.split('.').pop() + '" directas.');
          app.out('Archivo entregado comprimido: ' + zipName + ' (contiene ' + filename + ').');
          return true;
        } catch (err2) {
          if (err2 && err2.code === 'declined') { app.out('*Cancelado*', 'warn'); return false; }
          app.ui.downloadFallback(filename, data);
          return false;
        }
      }
      if (code === 'declined') { app.out('*Cancelado*', 'warn'); return false; }
      if (code === 'rate_limited') { app.out('Hay otra descarga en curso. Inténtelo de nuevo.', 'warn'); return false; }
      app.ui.downloadFallback(filename, data);
      return false;
    }
  };

  X.pngBlob = function (app) {
    return new Promise(function (res) {
      app.r.cv.toBlob(function (b) { res(b); }, 'image/png');
    });
  };
})();
