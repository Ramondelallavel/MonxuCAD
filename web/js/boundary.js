/* ============================================================
   boundary.js — Detección de contorno por punto interior
   Rasteriza los objetos visibles, hace un relleno por difusión
   desde el punto designado y extrae el contorno exterior y las
   islas, igual que el sombreado por punto interno de AutoCAD.
   ============================================================ */
(function () {
  'use strict';
  var CAD = (window.CAD = window.CAD || {});
  var G = CAD.G, E = CAD.E;
  var B = (CAD.Boundary = {});

  var MAXDIM = 1100;

  /* Devuelve {loops:[[{x,y}...]]} en coordenadas de dibujo, o {error:'...'} */
  B.trace = function (app, seedWorld, opts) {
    opts = opts || {};
    var r = app.r, doc = app.doc;
    var W = r.W, H = r.H;
    var sc = Math.min(1, MAXDIM / Math.max(W, H));
    var w = Math.max(16, Math.round(W * sc)), h = Math.max(16, Math.round(H * sc));

    var cv = document.createElement('canvas');
    cv.width = w; cv.height = h;
    var ctx = cv.getContext('2d', { willReadFrequently: true });
    ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, w, h);
    ctx.strokeStyle = '#000'; ctx.lineWidth = 1.15;
    ctx.lineJoin = 'round'; ctx.lineCap = 'round';

    var z = r.view.zoom * sc;
    var cx = r.view.cx, cy = r.view.cy;
    function W2S(p) { return { x: (p.x - cx) * z + w / 2, y: h / 2 - (p.y - cy) * z }; }

    var candidates = doc.visible().filter(function (e) {
      if (e.type === 'HATCH') return false;
      if (e.type === 'TEXT' || e.type === 'MTEXT') return false;
      if (opts.only && opts.only.indexOf(e) < 0) return false;
      return true;
    });
    if (!candidates.length) return { error: 'No se ha detectado ningún contorno válido.' };

    ctx.beginPath();
    candidates.forEach(function (e) {
      E.segs(e, doc, 2).forEach(function (s) {
        var pts = s.pts;
        if (pts.length < 2) return;
        var p = W2S(pts[0]);
        ctx.moveTo(p.x, p.y);
        for (var i = 1; i < pts.length; i++) { p = W2S(pts[i]); ctx.lineTo(p.x, p.y); }
        if (s.closed) ctx.closePath();
      });
    });
    ctx.stroke();

    var img = ctx.getImageData(0, 0, w, h).data;
    var n = w * h;
    var open = new Uint8Array(n);       /* 1 = píxel libre (blanco) */
    for (var i = 0; i < n; i++) open[i] = img[i * 4] > 128 ? 1 : 0;

    var sp = W2S(seedWorld);
    var sxp = Math.round(sp.x), syp = Math.round(sp.y);
    if (sxp < 1 || syp < 1 || sxp >= w - 1 || syp >= h - 1) return { error: 'El punto está fuera del área visible.' };
    if (!open[syp * w + sxp]) {
      /* busca un píxel libre muy cercano */
      var found = false;
      for (var rr = 1; rr <= 3 && !found; rr++) {
        for (var dy = -rr; dy <= rr && !found; dy++) {
          for (var dx = -rr; dx <= rr && !found; dx++) {
            var q = (syp + dy) * w + (sxp + dx);
            if (open[q]) { sxp += dx; syp += dy; found = true; }
          }
        }
      }
      if (!found) return { error: 'El punto designado está sobre un objeto.' };
    }

    /* --- relleno por difusión --- */
    var fill = new Uint8Array(n);
    var stack = new Int32Array(n);
    var sp2 = 0;
    stack[sp2++] = syp * w + sxp;
    fill[syp * w + sxp] = 1;
    var touchedBorder = false;
    var count = 0;
    while (sp2 > 0) {
      var idx = stack[--sp2];
      var y = (idx / w) | 0, x = idx - y * w;
      count++;
      if (x <= 0 || y <= 0 || x >= w - 1 || y >= h - 1) { touchedBorder = true; break; }
      var nb = [idx - 1, idx + 1, idx - w, idx + w];
      for (var k = 0; k < 4; k++) {
        var q2 = nb[k];
        if (!fill[q2] && open[q2]) { fill[q2] = 1; stack[sp2++] = q2; }
      }
    }
    if (touchedBorder) return { error: 'No se ha detectado ningún contorno válido.' };
    if (count < 12) return { error: 'El área designada es demasiado pequeña.' };

    /* --- dilatación de 1 píxel para absorber el trazo --- */
    var grown = new Uint8Array(n);
    for (var idx2 = 0; idx2 < n; idx2++) {
      if (!fill[idx2]) continue;
      grown[idx2] = 1;
      var yy = (idx2 / w) | 0, xx = idx2 - yy * w;
      if (xx > 0) grown[idx2 - 1] = 1;
      if (xx < w - 1) grown[idx2 + 1] = 1;
      if (yy > 0) grown[idx2 - w] = 1;
      if (yy < h - 1) grown[idx2 + w] = 1;
    }

    /* --- contorno exterior --- */
    var outer = traceContour(grown, w, h);
    if (!outer || outer.length < 4) return { error: 'No se ha detectado ningún contorno válido.' };

    /* --- islas: componentes del complemento rodeados por la región --- */
    var holes = [];
    var seen = new Uint8Array(n);
    /* marca el "exterior" partiendo del borde */
    var st2 = [], sp3 = 0;
    for (var bx = 0; bx < w; bx++) { pushOut(bx); pushOut((h - 1) * w + bx); }
    for (var by = 0; by < h; by++) { pushOut(by * w); pushOut(by * w + w - 1); }
    function pushOut(q3) { if (!grown[q3] && !seen[q3]) { seen[q3] = 1; st2.push(q3); } }
    while (st2.length) {
      var c = st2.pop();
      var cy2 = (c / w) | 0, cx2 = c - cy2 * w;
      if (cx2 > 0) pushOut(c - 1);
      if (cx2 < w - 1) pushOut(c + 1);
      if (cy2 > 0) pushOut(c - w);
      if (cy2 < h - 1) pushOut(c + w);
    }
    /* cualquier componente restante no visto y no relleno es una isla */
    var comp = new Uint8Array(n);
    for (var p2 = 0; p2 < n && holes.length < 24; p2++) {
      if (grown[p2] || seen[p2] || comp[p2]) continue;
      var cells = [], st3 = [p2];
      comp[p2] = 1;
      var adjacent = false;
      while (st3.length) {
        var cc = st3.pop();
        cells.push(cc);
        var yc = (cc / w) | 0, xc = cc - yc * w;
        var nn = [];
        if (xc > 0) nn.push(cc - 1);
        if (xc < w - 1) nn.push(cc + 1);
        if (yc > 0) nn.push(cc - w);
        if (yc < h - 1) nn.push(cc + w);
        for (var m = 0; m < nn.length; m++) {
          if (grown[nn[m]]) adjacent = true;
          else if (!comp[nn[m]] && !seen[nn[m]]) { comp[nn[m]] = 1; st3.push(nn[m]); }
        }
      }
      if (!adjacent || cells.length < 25) continue;
      var sub = new Uint8Array(n);
      cells.forEach(function (q4) {
        sub[q4] = 1;
        var yq = (q4 / w) | 0, xq = q4 - yq * w;
        if (xq > 0) sub[q4 - 1] = 1;
        if (xq < w - 1) sub[q4 + 1] = 1;
        if (yq > 0) sub[q4 - w] = 1;
        if (yq < h - 1) sub[q4 + w] = 1;
      });
      var hc = traceContour(sub, w, h);
      if (hc && hc.length > 4) holes.push(hc);
    }

    /* --- conversión a coordenadas de dibujo --- */
    function S2W(p) { return { x: (p.x - w / 2) / z + cx, y: (h / 2 - p.y) / z + cy }; }
    var tolW = 1.3 / z;
    function conv(c2) {
      var pts = c2.map(S2W);
      pts = G.simplify(pts, tolW);
      if (pts.length > 2 && G.dist(pts[0], pts[pts.length - 1]) < tolW) pts.pop();
      return refine(pts);
    }

    /* El trazado se hace sobre píxeles; aquí cada vértice se lleva a la
       geometría real y las esquinas se sustituyen por la intersección
       exacta de las dos curvas implicadas. */
    var prims = null;
    function getPrims() {
      if (prims) return prims;
      prims = [];
      candidates.forEach(function (e) {
        if (prims.length > 900) return;
        CAD.Prim.of(e, doc).forEach(function (pr) { prims.push(pr); });
      });
      return prims;
    }
    function refine(pts) {
      var ps = getPrims();
      if (!ps.length || pts.length < 3) return pts;
      var snapTol = 3.2 / z;
      var owners = [], snapped = [];
      pts.forEach(function (p) {
        var bi = -1, bq = null, bd = snapTol;
        for (var i = 0; i < ps.length; i++) {
          var q = CAD.Prim.closest(ps[i], p);
          if (!q) continue;
          var dd = G.dist(q, p);
          if (dd < bd) { bd = dd; bi = i; bq = q; }
        }
        owners.push(bi);
        snapped.push(bq || p);
      });
      var out = [], n = snapped.length;
      for (var k = 0; k < n; k++) {
        var a = owners[k], b = owners[(k + 1) % n];
        var pa = snapped[k], pb = snapped[(k + 1) % n];
        out.push(pa);
        if (a >= 0 && a === b && ps[a].t !== 'seg' && out.length < 4000) {
          /* tramo curvo: se vuelve a muestrear sobre el arco real */
          var pr = ps[a];
          var aa = G.ang(pr.c, pa), ab = G.ang(pr.c, pb);
          var sw = G.sweep(aa, ab);
          var dir = 1;
          if (sw > Math.PI) { sw = G.TAU - sw; dir = -1; }
          var steps = Math.min(48, Math.ceil(sw / G.rad(4)));
          for (var q2 = 1; q2 < steps; q2++) {
            out.push(G.polar(pr.c, aa + dir * sw * (q2 / steps), pr.r));
          }
        }
        if (a >= 0 && b >= 0 && a !== b) {
          var ints = CAD.Prim.inter(ps[a], ps[b], true);
          if (ints.length) {
            var best = null, bdd = snapTol * 2.5;
            ints.forEach(function (q) {
              var dd2 = Math.max(G.distToSeg(q, pa, pb), Math.min(G.dist(q, pa), G.dist(q, pb)) * 0.02);
              if (dd2 < bdd) { bdd = dd2; best = q; }
            });
            if (best) out.push({ x: best.x, y: best.y });
          }
        }
      }
      if (out.length < 3) return pts;
      out = G.simplify(out, 0.02 / z);
      var clean = [];
      out.forEach(function (p) {
        if (clean.length && G.dist(clean[clean.length - 1], p) < 1e-7) return;
        clean.push(p);
      });
      if (clean.length > 3 && G.dist(clean[0], clean[clean.length - 1]) < 1e-7) clean.pop();
      return clean.length >= 3 ? clean : pts;
    }

    var loops = [conv(outer)].concat(holes.map(conv)).filter(function (l) { return l.length >= 3; });
    if (!loops.length) return { error: 'No se ha detectado ningún contorno válido.' };
    if (!opts.sinAnidadas) anidadas(loops);
    return { loops: loops, area: Math.abs(G.polyArea(loops[0])) };

    /* Islas dentro de islas.  El rastreo por píxeles sólo llega al primer
       nivel: lo que hay dentro de una isla queda al otro lado del trazo y
       nunca toca la región rellenada.  AutoCAD, con la detección Normal
       —la de siempre—, va alternando hueco y relleno según se entra, y
       como el sombreado se rellena por paridad basta con recoger también
       los contornos cerrados que caen enteros dentro. */
    function anidadas(lps) {
      var fuera = lps[0];
      function yaEsta(pts, lista) {
        var a = Math.abs(G.polyArea(pts));
        if (!(a > 1e-9)) return true;
        for (var k = 0; k < lista.length; k++) {
          var ak = Math.abs(G.polyArea(lista[k]));
          if (Math.abs(ak - a) > Math.max(ak, a) * 0.03) continue;
          var ck = G.polyCentroid(lista[k]), cc = G.polyCentroid(pts);
          if (ck && cc && G.dist(ck, cc) < Math.sqrt(a) * 0.06) return true;
        }
        return false;
      }
      var extra = [];
      candidates.forEach(function (e) {
        if (lps.length + extra.length > 64) return;
        E.segs(e, doc, 2).forEach(function (s) {
          var pts = s.pts;
          if (!s.closed || !pts || pts.length < 3) return;
          var paso = Math.max(1, Math.floor(pts.length / 16));
          for (var i = 0; i < pts.length; i += paso)
            if (!G.ptInPoly(pts[i], fuera)) return;
          if (yaEsta(pts, lps) || yaEsta(pts, extra)) return;
          extra.push(pts.slice());
        });
      });
      for (var i2 = 0; i2 < extra.length; i2++) lps.push(extra[i2]);
    }
  };

  /* Seguimiento de contorno de Moore sobre una máscara binaria */
  function traceContour(mask, w, h) {
    var start = -1;
    for (var i = 0; i < w * h; i++) if (mask[i]) { start = i; break; }
    if (start < 0) return null;
    var sy = (start / w) | 0, sx = start - sy * w;
    var dirs = [[1, 0], [1, 1], [0, 1], [-1, 1], [-1, 0], [-1, -1], [0, -1], [1, -1]];
    var out = [];
    var cx = sx, cy = sy, dir = 6;
    var guard = w * h * 4;
    do {
      out.push({ x: cx + 0.5, y: cy + 0.5 });
      var found = false;
      var startDir = (dir + 6) % 8;
      for (var k = 0; k < 8; k++) {
        var d = (startDir + k) % 8;
        var nx = cx + dirs[d][0], ny = cy + dirs[d][1];
        if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
        if (mask[ny * w + nx]) { cx = nx; cy = ny; dir = d; found = true; break; }
      }
      if (!found) break;
      if (--guard < 0) break;
      if (out.length > 60000) break;
    } while (!(cx === sx && cy === sy));
    return out;
  }

  /* Contorno a partir de objetos designados (opción "Designar objetos") */
  B.fromEntities = function (app, ents) {
    var doc = app.doc;
    var loops = [];
    ents.forEach(function (e) {
      E.segs(e, doc, 2).forEach(function (s) {
        if (s.pts.length >= 3) loops.push(s.pts.slice());
      });
    });
    return loops.length ? { loops: loops } : { error: 'Los objetos designados no forman un contorno cerrado.' };
  };
})();
