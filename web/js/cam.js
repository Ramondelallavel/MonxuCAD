/* ============================================================
   cam.js — Fabricación asistida: generación de trayectorias
   Fresado 2.5D (contorneado con compensación, vaciado en zigzag
   y en espiral, planeado, taladrado con ciclos, grabado),
   desbaste 3D por planos Z, y torneado (cilindrado, refrentado,
   ranurado, roscado, tronzado).
   La salida es una lista de movimientos neutros que post.js
   traduce al dialecto de cada control numérico.
   ============================================================ */
(function () {
  'use strict';
  var CAD = (window.CAD = window.CAD || {});
  var G = CAD.G, G3 = CAD.G3, M = CAD.Mesh, S = CAD.Solid;
  var CAM = (CAD.CAM = {});
  var v3 = G3.v;

  /* ============================================================
     Herramientas
     ============================================================ */
  CAM.TOOLTYPES = {
    PLANA:      { id: 'flat',    label: 'Fresa cilíndrica',        c: 'mill' },
    ESFERICA:   { id: 'ball',    label: 'Fresa esférica',          c: 'mill' },
    TORICA:     { id: 'bull',    label: 'Fresa tórica',            c: 'mill' },
    CONICA:     { id: 'taper',   label: 'Fresa cónica',            c: 'mill' },
    GRABADO:    { id: 'vbit',    label: 'Fresa de grabar (V)',     c: 'mill' },
    BROCA:      { id: 'drill',   label: 'Broca',                   c: 'drill' },
    CENTRADOR:  { id: 'spot',    label: 'Broca de centrar',        c: 'drill' },
    MACHO:      { id: 'tap',     label: 'Macho de roscar',         c: 'drill' },
    ESCARIADOR: { id: 'ream',    label: 'Escariador',              c: 'drill' },
    CILINDRAR:  { id: 'turnOD',  label: 'Cuchilla de cilindrar',   c: 'turn' },
    INTERIOR:   { id: 'turnID',  label: 'Barra de mandrinar',      c: 'turn' },
    RANURAR:    { id: 'groove',  label: 'Cuchilla de ranurar',     c: 'turn' },
    ROSCAR:     { id: 'thread',  label: 'Cuchilla de roscar',      c: 'turn' },
    TRONZAR:    { id: 'cutoff',  label: 'Cuchilla de tronzar',     c: 'turn' }
  };

  CAM.tool = function (o) {
    return Object.assign({
      num: 1, type: 'PLANA', name: 'Fresa 10',
      d: 10,            /* diámetro */
      r: 0,             /* radio de punta (tórica) o de la plaquita (torno) */
      flutes: 3,
      angle: 118,       /* ángulo de punta de broca o de V */
      len: 40,          /* longitud útil */
      hOffset: 1, dOffset: 1,
      material: 'HSS',
      /* condiciones de corte */
      vc: 120,          /* velocidad de corte m/min */
      fz: 0.05,         /* avance por diente mm */
      rpm: 0,           /* si es 0 se calcula a partir de vc */
      feed: 0,          /* si es 0 se calcula a partir de fz */
      plunge: 0,        /* avance de penetración; 0 = 35 % del avance */
      coolant: 'INUNDACION'
    }, o || {});
  };

  /* Cálculo de régimen y avance a partir de vc y fz */
  CAM.cutting = function (tool, maxRpm, workDia) {
    var cls = (CAM.TOOLTYPES[tool.type] || {}).c;
    if (cls === 'turn') {
      /* Torno: el avance se programa por vuelta (G99) y el régimen sale
         del diámetro de la PIEZA, no de la herramienta. */
      var dw = Math.max(0.1, workDia || tool.workDia || 50);
      var rpmT = tool.rpm || (1000 * tool.vc) / (Math.PI * dw);
      rpmT = Math.max(1, Math.min(maxRpm || 4000, Math.round(rpmT)));
      var fr = tool.feed || tool.fz;      /* mm/rev */
      return { rpm: rpmT, feed: fr, plunge: tool.plunge || fr * 0.5,
               vc: Math.PI * dw * rpmT / 1000, perRev: true };
    }
    var d = Math.max(0.01, tool.d);
    var rpm = tool.rpm || (1000 * tool.vc) / (Math.PI * d);
    rpm = Math.max(1, Math.min(maxRpm || 24000, Math.round(rpm)));
    var feed = tool.feed || (rpm * tool.flutes * tool.fz);
    feed = Math.max(1, Math.round(feed));
    var plunge = tool.plunge || Math.max(1, Math.round(feed * 0.35));
    return { rpm: rpm, feed: feed, plunge: plunge, vc: Math.PI * d * rpm / 1000, perRev: false };
  };

  /* Biblioteca por defecto */
  CAM.defaultTools = function () {
    return [
      CAM.tool({ num: 1, type: 'PLANA', name: 'Fresa plana Ø10', d: 10, flutes: 3, vc: 140, fz: 0.055 }),
      CAM.tool({ num: 2, type: 'PLANA', name: 'Fresa plana Ø6', d: 6, flutes: 3, vc: 130, fz: 0.035 }),
      CAM.tool({ num: 3, type: 'ESFERICA', name: 'Fresa esférica Ø6', d: 6, r: 3, flutes: 2, vc: 150, fz: 0.04 }),
      CAM.tool({ num: 4, type: 'TORICA', name: 'Fresa tórica Ø12 R1', d: 12, r: 1, flutes: 4, vc: 160, fz: 0.07 }),
      CAM.tool({ num: 5, type: 'BROCA', name: 'Broca Ø5', d: 5, angle: 118, flutes: 2, vc: 35, fz: 0.10 }),
      CAM.tool({ num: 6, type: 'BROCA', name: 'Broca Ø8.5', d: 8.5, angle: 118, flutes: 2, vc: 32, fz: 0.12 }),
      CAM.tool({ num: 7, type: 'CENTRADOR', name: 'Centrador Ø3', d: 3, angle: 90, flutes: 2, vc: 25, fz: 0.05 }),
      CAM.tool({ num: 8, type: 'MACHO', name: 'Macho M10x1.5', d: 10, flutes: 3, rpm: 300, vc: 10 }),
      CAM.tool({ num: 9, type: 'GRABADO', name: 'V 90° Ø6', d: 6, angle: 90, flutes: 1, vc: 120, fz: 0.03 }),
      CAM.tool({ num: 10, type: 'CILINDRAR', name: 'Cuchilla exterior CNMG', d: 0, r: 0.8, vc: 220, fz: 0.22 }),
      CAM.tool({ num: 11, type: 'INTERIOR', name: 'Barra interior Ø16', d: 16, r: 0.4, vc: 180, fz: 0.15 }),
      CAM.tool({ num: 12, type: 'RANURAR', name: 'Ranurar 3 mm', d: 3, r: 0.2, vc: 140, fz: 0.08 }),
      CAM.tool({ num: 13, type: 'ROSCAR', name: 'Roscar exterior 60°', d: 0, angle: 60, vc: 120 }),
      CAM.tool({ num: 14, type: 'TRONZAR', name: 'Tronzar 2.5 mm', d: 2.5, r: 0.2, vc: 120, fz: 0.06 })
    ];
  };

  /* Materiales: factores de corrección sobre vc y fz */
  CAM.MATERIALS = {
    'Aluminio':        { vc: 2.6, fz: 1.35, dens: 0.0027 },
    'Latón':           { vc: 1.9, fz: 1.10, dens: 0.0085 },
    'Acero S235':      { vc: 1.0, fz: 1.00, dens: 0.00785 },
    'Acero F-1140':    { vc: 0.85, fz: 0.92, dens: 0.00785 },
    'Acero inox 304':  { vc: 0.55, fz: 0.75, dens: 0.0079 },
    'Fundición GG25':  { vc: 0.90, fz: 1.05, dens: 0.0072 },
    'Titanio Ti6Al4V': { vc: 0.35, fz: 0.60, dens: 0.00443 },
    'Plástico POM':    { vc: 3.5, fz: 1.60, dens: 0.00141 },
    'Madera':          { vc: 5.0, fz: 2.00, dens: 0.00070 }
  };

  /* ============================================================
     Movimientos
       {t:'rapid'|'feed'|'arc'|'drill'|'dwell'|'tool'|'spindle'|
           'coolant'|'comment'|'plane'|'comp'|'thread'|'cycle', ...}
     Coordenadas siempre en el sistema de la pieza.
     ============================================================ */
  function Path(name, meta) {
    this.name = name || 'Operación';
    this.moves = [];
    this.meta = meta || {};
    this.minZ = Infinity;
    this.cutLen = 0;
    this.rapidLen = 0;
    this._last = null;
  }
  CAM.Path = Path;
  Path.prototype.add = function (mv) {
    this.moves.push(mv);
    if (mv.z !== undefined && mv.z < this.minZ) this.minZ = mv.z;
    if (this._last && (mv.t === 'feed' || mv.t === 'rapid' || mv.t === 'arc')) {
      var d = Math.hypot((mv.x === undefined ? this._last.x : mv.x) - this._last.x,
                         (mv.y === undefined ? this._last.y : mv.y) - this._last.y,
                         (mv.z === undefined ? this._last.z : mv.z) - this._last.z);
      if (mv.t === 'rapid') this.rapidLen += d; else this.cutLen += d;
    }
    if (mv.x !== undefined || mv.y !== undefined || mv.z !== undefined) {
      var l = this._last || { x: 0, y: 0, z: 0 };
      this._last = { x: mv.x === undefined ? l.x : mv.x,
                     y: mv.y === undefined ? l.y : mv.y,
                     z: mv.z === undefined ? l.z : mv.z };
    }
    return this;
  };
  Path.prototype.rapid = function (x, y, z) { return this.add({ t: 'rapid', x: x, y: y, z: z }); };
  Path.prototype.feed = function (x, y, z, f) { return this.add({ t: 'feed', x: x, y: y, z: z, f: f }); };
  Path.prototype.arc = function (x, y, z, i, j, cw, f) {
    return this.add({ t: 'arc', x: x, y: y, z: z, i: i, j: j, cw: cw, f: f });
  };
  Path.prototype.comment = function (s) { return this.add({ t: 'comment', s: s }); };
  /* Torno: el radio va SIEMPRE en .x y la cota axial en .z.
     (En la máquina, X es el eje radial; el postprocesador decide si
     lo emite al radio o al diámetro.) */
  Path.prototype.lrapid = function (r, z) { return this.add({ t: 'rapid', x: r, z: z }); };
  Path.prototype.lfeed = function (r, z, f) { return this.add({ t: 'feed', x: r, z: z, f: f }); };

  /* Tiempo estimado (min) con aceleración simplificada */
  Path.prototype.time = function (rapidFeed) {
    var rf = rapidFeed || 10000, t = 0, last = null;
    for (var i = 0; i < this.moves.length; i++) {
      var m = this.moves[i];
      if (m.t === 'dwell') { t += (m.p || 0) / 60; continue; }
      if (m.t === 'tool') { t += 0.15; continue; }
      if (m.t !== 'rapid' && m.t !== 'feed' && m.t !== 'arc' && m.t !== 'drill') continue;
      var p = { x: m.x, y: m.y, z: m.z };
      if (last) {
        var d = Math.hypot((p.x === undefined ? last.x : p.x) - last.x,
                           (p.y === undefined ? last.y : p.y) - last.y,
                           (p.z === undefined ? last.z : p.z) - last.z);
        var f = m.t === 'rapid' ? rf : (m.f || this.meta.feed || 300);
        t += d / Math.max(1, f);
      }
      last = { x: p.x === undefined ? (last ? last.x : 0) : p.x,
               y: p.y === undefined ? (last ? last.y : 0) : p.y,
               z: p.z === undefined ? (last ? last.z : 0) : p.z };
    }
    return t;
  };

  /* ============================================================
     Utilidades geométricas 2D para trayectorias
     ============================================================ */

  /* Desfase de un contorno cerrado (offset poligonal con recorte de
     auto-intersecciones).  d > 0 desplaza hacia fuera. */
  CAM.offsetLoop = function (pts, d) {
    if (!pts || pts.length < 3 || Math.abs(d) < 1e-9) return pts ? [pts.slice()] : [];
    var n = pts.length;
    var area = signedArea(pts);
    var s = area > 0 ? 1 : -1;      /* antihorario -> normal exterior a la izquierda */
    var raw = [];
    for (var i = 0; i < n; i++) {
      var p0 = pts[(i - 1 + n) % n], p1 = pts[i], p2 = pts[(i + 1) % n];
      var d1 = nrm2(sub2(p1, p0)), d2 = nrm2(sub2(p2, p1));
      if (!d1 || !d2) continue;
      var n1 = { x: d1.y * s, y: -d1.x * s }, n2 = { x: d2.y * s, y: -d2.x * s };
      var a1 = { x: p0.x + n1.x * d, y: p0.y + n1.y * d }, b1 = { x: p1.x + n1.x * d, y: p1.y + n1.y * d };
      var a2 = { x: p1.x + n2.x * d, y: p1.y + n2.y * d }, b2 = { x: p2.x + n2.x * d, y: p2.y + n2.y * d };
      var cr = d1.x * d2.y - d1.y * d2.x;
      if (Math.abs(cr) < 1e-9) { raw.push(b1); continue; }
      var ip = interLines(a1, b1, a2, b2);
      if (ip) {
        /* esquina exterior muy aguda: se redondea para no crear picos */
        var dist = Math.hypot(ip.x - p1.x, ip.y - p1.y);
        if (dist > Math.abs(d) * 2.2) {
          var arc = arcCorner(p1, b1, a2, Math.abs(d), cr * s < 0);
          for (var k = 0; k < arc.length; k++) raw.push(arc[k]);
        } else raw.push(ip);
      } else { raw.push(b1); raw.push(a2); }
    }
    if (raw.length < 3) return [];
    return CAM.removeSelfIntersections(raw, d, pts);
  };

  function arcCorner(c, from, to, r, cw) {
    var a0 = Math.atan2(from.y - c.y, from.x - c.x);
    var a1 = Math.atan2(to.y - c.y, to.x - c.x);
    var da = a1 - a0;
    while (da > Math.PI) da -= Math.PI * 2;
    while (da < -Math.PI) da += Math.PI * 2;
    var n = Math.max(2, Math.ceil(Math.abs(da) / 0.30));
    var out = [];
    for (var i = 0; i <= n; i++) {
      var a = a0 + da * i / n;
      out.push({ x: c.x + r * Math.cos(a), y: c.y + r * Math.sin(a) });
    }
    return out;
  }

  /* Elimina bucles invertidos tras el desfase:
     se descartan los tramos cuya distancia al contorno original es
     claramente menor que |d| (dentro de una tolerancia). */
  CAM.removeSelfIntersections = function (raw, d, orig) {
    var tol = Math.abs(d) * 0.72;
    var keep = [];
    for (var i = 0; i < raw.length; i++) {
      if (distToLoop(raw[i], orig) >= tol) keep.push(raw[i]);
    }
    if (keep.length < 3) return [];
    /* separa en bucles si el contorno se ha partido */
    return [keep];
  };

  function distToLoop(p, loop) {
    var best = Infinity;
    for (var i = 0; i < loop.length; i++) {
      var a = loop[i], b = loop[(i + 1) % loop.length];
      var d = segDist2(p, a, b);
      if (d < best) best = d;
    }
    return Math.sqrt(best);
  }
  function segDist2(p, a, b) {
    var dx = b.x - a.x, dy = b.y - a.y, l2 = dx * dx + dy * dy;
    var t = l2 < 1e-12 ? 0 : ((p.x - a.x) * dx + (p.y - a.y) * dy) / l2;
    t = t < 0 ? 0 : (t > 1 ? 1 : t);
    var qx = a.x + dx * t - p.x, qy = a.y + dy * t - p.y;
    return qx * qx + qy * qy;
  }
  function sub2(a, b) { return { x: a.x - b.x, y: a.y - b.y }; }
  function nrm2(v) { var l = Math.hypot(v.x, v.y); return l < 1e-12 ? null : { x: v.x / l, y: v.y / l }; }
  function interLines(a1, b1, a2, b2) {
    var d1 = sub2(b1, a1), d2 = sub2(b2, a2);
    var den = d1.x * d2.y - d1.y * d2.x;
    if (Math.abs(den) < 1e-12) return null;
    var t = ((a2.x - a1.x) * d2.y - (a2.y - a1.y) * d2.x) / den;
    return { x: a1.x + d1.x * t, y: a1.y + d1.y * t };
  }
  function signedArea(p) {
    var s = 0;
    for (var i = 0; i < p.length; i++) {
      var a = p[i], b = p[(i + 1) % p.length];
      s += a.x * b.y - b.x * a.y;
    }
    return s / 2;
  }
  CAM.signedArea = signedArea;
  CAM.ptInLoop = function (p, loop) {
    var inside = false;
    for (var i = 0, j = loop.length - 1; i < loop.length; j = i++) {
      if (((loop[i].y > p.y) !== (loop[j].y > p.y)) &&
          (p.x < (loop[j].x - loop[i].x) * (p.y - loop[i].y) / (loop[j].y - loop[i].y) + loop[i].x))
        inside = !inside;
    }
    return inside;
  };

  /* ============================================================
     Rampas de entrada
     ============================================================ */
  function plunge(path, x, y, zFrom, zTo, mode, tool, feed, plungeFeed, len) {
    if (zTo >= zFrom - 1e-9) return;
    if (mode === 'VERTICAL' || !mode) {
      path.feed(x, y, zTo, plungeFeed);
      return;
    }
    if (mode === 'RAMPA') {
      var L = len || Math.max(tool.d * 1.5, 4);
      var dz = zFrom - zTo;
      var passes = Math.max(1, Math.ceil(dz / (L * Math.tan(3 * Math.PI / 180))));
      var step = dz / passes;
      var dirX = 1;
      for (var i = 0; i < passes; i++) {
        path.feed(x + dirX * L, y, zFrom - step * (i + 0.5), feed);
        dirX = -dirX;
        path.feed(x, y, zFrom - step * (i + 1), feed);
      }
      return;
    }
    if (mode === 'HELICE') {
      var r = Math.max(tool.d * 0.35, 1);
      var dzh = zFrom - zTo;
      var pitch = Math.max(0.2, tool.d * 0.08);
      var turns = Math.max(1, Math.ceil(dzh / pitch));
      var segPerTurn = 24;
      path.rapid(x + r, y, undefined);
      for (var t = 1; t <= turns * segPerTurn; t++) {
        var a = Math.PI * 2 * t / segPerTurn;
        var z = zFrom - dzh * (t / (turns * segPerTurn));
        path.feed(x + r * Math.cos(a), y + r * Math.sin(a), z, feed);
      }
      path.feed(x, y, zTo, feed);
      return;
    }
    path.feed(x, y, zTo, plungeFeed);
  }
  CAM.plunge = plunge;

  /* ============================================================
     OPERACIÓN: CONTORNEADO
     ============================================================ */
  CAM.contour = function (loops, op) {
    op = Object.assign({
      tool: CAM.tool(), name: 'Contorneado',
      zTop: 0, zBottom: -5, stepDown: 2, stock: 0,
      side: 'EXTERIOR',         /* EXTERIOR | INTERIOR | SOBRE */
      comp: 'ORDENADOR',        /* ORDENADOR | CONTROL | DESACTIVADA */
      dir: 'CONCORDANTE',       /* CONCORDANTE (climb) | OPUESTO */
      clearance: 5, retract: 2,
      lead: 1.5,                /* radio de entrada/salida tangencial */
      passes: 1, finish: 0,
      entry: 'VERTICAL', multi: true
    }, op || {});
    var tool = op.tool, cut = CAM.cutting(tool, op.maxRpm);
    var path = new Path(op.name, { tool: tool, feed: cut.feed, rpm: cut.rpm, op: 'contorneado' });
    path.add({ t: 'tool', tool: tool, rpm: cut.rpm, coolant: tool.coolant });
    path.comment(op.name + '  T' + tool.num + ' ' + tool.name);

    var r = tool.d / 2;
    var off = op.side === 'SOBRE' ? 0 : (op.side === 'EXTERIOR' ? 1 : -1) * (r + op.stock);
    var zs = zLevels(op.zTop, op.zBottom, op.stepDown);

    for (var li = 0; li < loops.length; li++) {
      var src = loops[li];
      if (!src || src.length < 2) continue;
      var closed = src.closed !== false;
      var work;
      if (op.comp === 'CONTROL' || Math.abs(off) < 1e-9) work = [src.slice()];
      else work = CAM.offsetLoop(src, off);
      if (!work.length) continue;
      for (var wi = 0; wi < work.length; wi++) {
        var lp = work[wi];
        if (lp.length < 2) continue;
        /* sentido de mecanizado */
        var a = signedArea(lp);
        var wantCCW = (op.side === 'INTERIOR') === (op.dir === 'OPUESTO');
        if ((a > 0) !== wantCCW) lp = lp.slice().reverse();

        for (var zi = 0; zi < zs.length; zi++) {
          var z = zs[zi];
          var p0 = lp[0];
          /* cota de aproximación: el nivel anterior (o la cara superior)
             más la distancia de seguridad — nunca por debajo del material
             que todavía no se ha cortado. */
          var zPrev = zi === 0 ? op.zTop : zs[zi - 1];
          var zApp = Math.min(op.clearance, zPrev + op.retract);
          path.rapid(undefined, undefined, op.clearance);
          var lead = leadIn(lp, op.lead);
          path.rapid(lead.p.x, lead.p.y, undefined);
          path.rapid(undefined, undefined, zApp);
          plunge(path, lead.p.x, lead.p.y, zApp, z, op.entry, tool, cut.feed, cut.plunge, tool.d * 2);
          if (op.comp === 'CONTROL')
            path.add({ t: 'comp', mode: op.side === 'INTERIOR' ? 'right' : 'left', d: tool.dOffset });
          path.feed(p0.x, p0.y, z, cut.feed);
          for (var i = 1; i < lp.length; i++) path.feed(lp[i].x, lp[i].y, z, cut.feed);
          if (closed) path.feed(p0.x, p0.y, z, cut.feed);
          var lo = leadOut(lp, op.lead);
          path.feed(lo.x, lo.y, z, cut.feed);
          if (op.comp === 'CONTROL') path.add({ t: 'comp', mode: 'off' });
          path.rapid(undefined, undefined, op.clearance);
        }
      }
    }
    path.rapid(undefined, undefined, op.clearance);
    return path;
  };

  function leadIn(lp, r) {
    var p0 = lp[0], p1 = lp[1 % lp.length];
    var d = nrm2(sub2(p1, p0)) || { x: 1, y: 0 };
    return { p: { x: p0.x - d.x * Math.max(r, 0.5), y: p0.y - d.y * Math.max(r, 0.5) }, d: d };
  }
  function leadOut(lp, r) {
    var n = lp.length;
    var pa = lp[0], pb = lp[1 % n];
    var d = nrm2(sub2(pb, pa)) || { x: 1, y: 0 };
    return { x: pa.x + d.x * Math.max(r, 0.5), y: pa.y + d.y * Math.max(r, 0.5) };
  }

  function zLevels(zTop, zBot, step) {
    var out = [], d = zTop - zBot;
    if (d <= 0) return [zBot];
    step = Math.max(0.01, Math.abs(step));
    var n = Math.ceil(d / step - 1e-9);
    for (var i = 1; i <= n; i++) out.push(Math.max(zBot, zTop - step * i));
    if (!out.length) out.push(zBot);
    return out;
  }
  CAM.zLevels = zLevels;

  /* ============================================================
     OPERACIÓN: VACIADO (pocket)
     Desfases concéntricos hacia dentro + opción de zigzag.
     ============================================================ */
  CAM.pocket = function (outer, holes, op) {
    op = Object.assign({
      tool: CAM.tool(), name: 'Vaciado',
      zTop: 0, zBottom: -5, stepDown: 2, stepOver: 0.45,
      stock: 0, clearance: 5, retract: 2,
      pattern: 'CONCENTRICO',   /* CONCENTRICO | ZIGZAG | ESPIRAL */
      dir: 'CONCORDANTE', entry: 'HELICE', angle: 0, finishPass: true
    }, op || {});
    var tool = op.tool, cut = CAM.cutting(tool, op.maxRpm);
    var r = tool.d / 2;
    var so = Math.max(0.05, op.stepOver) * tool.d;
    var path = new Path(op.name, { tool: tool, feed: cut.feed, rpm: cut.rpm, op: 'vaciado' });
    path.add({ t: 'tool', tool: tool, rpm: cut.rpm, coolant: tool.coolant });
    path.comment(op.name + '  T' + tool.num + ' ' + tool.name);

    var zs = zLevels(op.zTop, op.zBottom, op.stepDown);
    holes = holes || [];

    /* anillos concéntricos: se desfasa el contorno hacia dentro hasta agotar */
    var rings = [];
    var d = r + op.stock;
    var guard = 0;
    while (guard++ < 400) {
      var lp = CAM.offsetLoop(outer, -d);
      if (!lp.length || lp[0].length < 3) break;
      var ok = lp[0];
      if (perim(ok) < so * 0.7) break;
      /* recorta contra los agujeros */
      var blocked = false;
      for (var h = 0; h < holes.length; h++) {
        var ho = CAM.offsetLoop(holes[h], r + op.stock);
        if (ho.length) {
          /* si el anillo entra en el agujero, se parte */
          var frag = clipAgainst(ok, ho[0]);
          if (frag.length) { rings.push.apply(rings, frag); blocked = true; break; }
        }
      }
      if (!blocked) rings.push(ok);
      d += so;
    }
    if (!rings.length) {
      /* bolsillo más estrecho que la fresa: un solo pasada por el centro */
      var c = centroid(outer);
      rings.push([c, c]);
    }

    for (var zi = 0; zi < zs.length; zi++) {
      var z = zs[zi];
      path.comment('Z' + G3.fmt(z, 3));
      /* entrada por el anillo más interior (el último) */
      var order = op.pattern === 'ESPIRAL' ? rings.slice().reverse() : rings.slice().reverse();
      var first = order[0];
      var e = first[0];
      var zPrev = zi === 0 ? op.zTop : zs[zi - 1];
      var zApp = Math.min(op.clearance, zPrev + op.retract);
      path.rapid(undefined, undefined, op.clearance);
      path.rapid(e.x, e.y, undefined);
      path.rapid(undefined, undefined, zApp);
      plunge(path, e.x, e.y, zApp, z, op.entry, tool, cut.feed, cut.plunge, tool.d * 1.5);
      for (var ri = 0; ri < order.length; ri++) {
        var lp2 = order[ri];
        if (lp2.length < 2) continue;
        var ar = signedArea(lp2);
        var wantCCW = op.dir === 'CONCORDANTE';
        if ((ar > 0) !== wantCCW) lp2 = lp2.slice().reverse();
        /* enlace entre anillos: en el aire si están lejos */
        var cur = path._last;
        var p0 = nearestOn(lp2, cur);
        if (cur && Math.hypot(cur.x - p0.p.x, cur.y - p0.p.y) > so * 2.2) {
          path.rapid(undefined, undefined, z + op.retract);
          path.rapid(p0.p.x, p0.p.y, undefined);
          path.feed(p0.p.x, p0.p.y, z, cut.plunge);
        } else {
          path.feed(p0.p.x, p0.p.y, z, cut.feed);
        }
        for (var i = 1; i <= lp2.length; i++) {
          var q = lp2[(p0.i + i) % lp2.length];
          path.feed(q.x, q.y, z, cut.feed);
        }
      }
      if (op.pattern === 'ZIGZAG') {
        var zz = CAM.zigzag(outer, holes, r + op.stock, so, op.angle);
        for (i = 0; i < zz.length; i++) {
          var L = zz[i];
          path.rapid(undefined, undefined, z + op.retract);
          path.rapid(L[0].x, L[0].y, undefined);
          path.feed(L[0].x, L[0].y, z, cut.plunge);
          for (var j = 1; j < L.length; j++) path.feed(L[j].x, L[j].y, z, cut.feed);
        }
      }
      path.rapid(undefined, undefined, op.clearance);
    }
    /* pasada de acabado sobre la pared */
    if (op.finishPass && op.stock > 0) {
      var fin = CAM.contour([outer], Object.assign({}, op, {
        name: op.name + ' (acabado)', side: 'INTERIOR', stock: 0,
        stepDown: Math.abs(op.zTop - op.zBottom), entry: 'VERTICAL'
      }));
      path.moves = path.moves.concat(fin.moves.filter(function (m) { return m.t !== 'tool'; }));
    }
    path.rapid(undefined, undefined, op.clearance);
    return path;
  };

  function perim(lp) {
    var s = 0;
    for (var i = 0; i < lp.length; i++) {
      var a = lp[i], b = lp[(i + 1) % lp.length];
      s += Math.hypot(b.x - a.x, b.y - a.y);
    }
    return s;
  }
  function centroid(lp) {
    var c = { x: 0, y: 0 };
    for (var i = 0; i < lp.length; i++) { c.x += lp[i].x; c.y += lp[i].y; }
    return { x: c.x / lp.length, y: c.y / lp.length };
  }
  function nearestOn(lp, p) {
    if (!p) return { p: lp[0], i: 0 };
    var bi = 0, bd = Infinity;
    for (var i = 0; i < lp.length; i++) {
      var d = (lp[i].x - p.x) * (lp[i].x - p.x) + (lp[i].y - p.y) * (lp[i].y - p.y);
      if (d < bd) { bd = d; bi = i; }
    }
    return { p: lp[bi], i: bi };
  }
  function clipAgainst() { return []; }

  /* Barrido en zigzag restando una REGIÓN (conjunto de bucles con la
     regla par-impar), no bucles sueltos.  Es lo que hace falta cuando
     la sección de la pieza tiene agujeros: el agujero es material a
     quitar, no una isla. */
  CAM.zigzagRegion = function (outer, regionLoops, inset, step, angleDeg) {
    var ang = (angleDeg || 0) * Math.PI / 180;
    var ca = Math.cos(-ang), sa = Math.sin(-ang);
    function rot(p) { return { x: p.x * ca - p.y * sa, y: p.x * sa + p.y * ca }; }
    function unrot(p) { return { x: p.x * ca + p.y * sa, y: -p.x * sa + p.y * ca }; }
    var inner = inset ? CAM.offsetLoop(outer, -inset) : [outer];
    if (!inner.length) return [];
    var lp = inner[0].map(rot);
    var reg = (regionLoops || []).map(function (h) { return h.map(rot); });
    var y1 = Infinity, y2 = -Infinity, i;
    for (i = 0; i < lp.length; i++) { y1 = Math.min(y1, lp[i].y); y2 = Math.max(y2, lp[i].y); }
    var lines = [], flip = false;
    for (var y = y1 + step * 0.5; y < y2; y += step) {
      var xs = scan(lp, y);
      /* cruces de TODOS los bucles de la región juntos -> par-impar */
      var rx = [];
      for (i = 0; i < reg.length; i++) rx = rx.concat(scan(reg[i], y));
      rx.sort(function (a, b) { return a - b; });
      xs = subtractSpans(xs, rx);
      for (var s2 = 0; s2 + 1 < xs.length; s2 += 2) {
        var a = { x: xs[s2], y: y }, b = { x: xs[s2 + 1], y: y };
        if (Math.abs(b.x - a.x) < step * 0.05) continue;
        lines.push(flip ? [unrot(b), unrot(a)] : [unrot(a), unrot(b)]);
      }
      flip = !flip;
    }
    return lines;
  };

  /* Barrido en zigzag dentro de un contorno */
  CAM.zigzag = function (outer, holes, inset, step, angleDeg) {
    var ang = (angleDeg || 0) * Math.PI / 180;
    var ca = Math.cos(-ang), sa = Math.sin(-ang);
    function rot(p) { return { x: p.x * ca - p.y * sa, y: p.x * sa + p.y * ca }; }
    function unrot(p) { return { x: p.x * ca + p.y * sa, y: -p.x * sa + p.y * ca }; }
    var inner = CAM.offsetLoop(outer, -inset);
    if (!inner.length) return [];
    var lp = inner[0].map(rot);
    var hs = (holes || []).map(function (h) {
      var o = CAM.offsetLoop(h, inset);
      return (o.length ? o[0] : h).map(rot);
    });
    var y1 = Infinity, y2 = -Infinity;
    for (var i = 0; i < lp.length; i++) { y1 = Math.min(y1, lp[i].y); y2 = Math.max(y2, lp[i].y); }
    var lines = [], dirFlip = false;
    for (var y = y1 + step * 0.5; y < y2; y += step) {
      var xs = scan(lp, y);
      for (var h = 0; h < hs.length; h++) {
        var hx = scan(hs[h], y);
        xs = subtractSpans(xs, hx);
      }
      for (var s = 0; s + 1 < xs.length; s += 2) {
        var a = { x: xs[s], y: y }, b = { x: xs[s + 1], y: y };
        if (Math.abs(b.x - a.x) < 1e-6) continue;
        lines.push(dirFlip ? [unrot(b), unrot(a)] : [unrot(a), unrot(b)]);
      }
      dirFlip = !dirFlip;
    }
    return lines;
  };
  function scan(lp, y) {
    var xs = [];
    for (var i = 0; i < lp.length; i++) {
      var a = lp[i], b = lp[(i + 1) % lp.length];
      if ((a.y <= y && b.y > y) || (b.y <= y && a.y > y)) {
        var t = (y - a.y) / (b.y - a.y);
        xs.push(a.x + (b.x - a.x) * t);
      }
    }
    xs.sort(function (p, q) { return p - q; });
    return xs;
  }
  function subtractSpans(outerXs, holeXs) {
    if (!holeXs.length) return outerXs;
    var out = [];
    for (var i = 0; i + 1 < outerXs.length; i += 2) {
      var spans = [[outerXs[i], outerXs[i + 1]]];
      for (var h = 0; h + 1 < holeXs.length; h += 2) {
        var ns = [];
        for (var s = 0; s < spans.length; s++) {
          var a = spans[s][0], b = spans[s][1], ha = holeXs[h], hb = holeXs[h + 1];
          if (hb <= a || ha >= b) { ns.push([a, b]); continue; }
          if (ha > a) ns.push([a, ha]);
          if (hb < b) ns.push([hb, b]);
        }
        spans = ns;
      }
      for (s = 0; s < spans.length; s++) { out.push(spans[s][0]); out.push(spans[s][1]); }
    }
    return out;
  }

  /* ============================================================
     OPERACIÓN: PLANEADO (facing)
     ============================================================ */
  CAM.facing = function (box, op) {
    op = Object.assign({
      tool: CAM.tool(), name: 'Planeado',
      zTop: 0, zBottom: -1, stepDown: 1, stepOver: 0.7,
      clearance: 5, retract: 2, angle: 0, overrun: 0.6
    }, op || {});
    var tool = op.tool, cut = CAM.cutting(tool, op.maxRpm);
    var path = new Path(op.name, { tool: tool, feed: cut.feed, rpm: cut.rpm, op: 'planeado' });
    path.add({ t: 'tool', tool: tool, rpm: cut.rpm, coolant: tool.coolant });
    path.comment(op.name);
    var r = tool.d / 2, so = tool.d * op.stepOver;
    var ov = tool.d * op.overrun;
    var zs = zLevels(op.zTop, op.zBottom, op.stepDown);
    for (var zi = 0; zi < zs.length; zi++) {
      var z = zs[zi];
      var flip = false;
      path.rapid(undefined, undefined, op.clearance);
      for (var y = box.y1 + r * 0.2; y <= box.y2 + 1e-9; y += so) {
        var xa = box.x1 - ov, xb = box.x2 + ov;
        var p1 = flip ? xb : xa, p2 = flip ? xa : xb;
        path.rapid(p1, y, undefined);
        if (path._last.z > z + 1e-9) {
          var zPrev = zi === 0 ? op.zTop : zs[zi - 1];
          path.rapid(undefined, undefined, Math.min(op.clearance, zPrev + op.retract));
          path.feed(p1, y, z, cut.plunge);
        }
        path.feed(p2, y, z, cut.feed);
        flip = !flip;
      }
      path.rapid(undefined, undefined, op.clearance);
    }
    return path;
  };

  /* ============================================================
     OPERACIÓN: TALADRADO (ciclos fijos)
     ============================================================ */
  CAM.drilling = function (points, op) {
    op = Object.assign({
      tool: CAM.tool({ type: 'BROCA', d: 5 }), name: 'Taladrado',
      zTop: 0, depth: 10, cycle: 'G81',   /* G81 G82 G83 G73 G84 G85 G76 */
      peck: 3, dwell: 0, retract: 2, clearance: 25,
      throughExtra: 0, pitch: 1.5, chipBreak: 0.5
    }, op || {});
    var tool = op.tool, cut = CAM.cutting(tool, op.maxRpm);
    var path = new Path(op.name, { tool: tool, feed: cut.feed, rpm: cut.rpm, op: 'taladrado' });
    path.add({ t: 'tool', tool: tool, rpm: cut.rpm, coolant: tool.coolant });
    path.comment(op.name + '  ' + op.cycle + ' Ø' + G3.fmt(tool.d, 3) + '  prof ' + G3.fmt(op.depth, 3));
    /* punta cónica: se añade la altura del cono si el agujero es pasante */
    var tip = 0;
    if ((tool.type === 'BROCA' || tool.type === 'CENTRADOR') && op.throughExtra)
      tip = (tool.d / 2) / Math.tan((tool.angle / 2) * Math.PI / 180);
    var zBot = op.zTop - op.depth - (op.throughExtra ? tip + op.throughExtra : 0);
    var zR = op.zTop + op.retract;
    path.rapid(undefined, undefined, op.clearance);
    path.add({ t: 'cycle', cycle: op.cycle, z: zBot, r: zR, q: op.peck,
               p: op.dwell, f: op.cycle === 'G84' ? cut.rpm * op.pitch : cut.feed,
               pitch: op.pitch, retractMode: 'G98' });
    for (var i = 0; i < points.length; i++) {
      var p = points[i];
      path.add({ t: 'drill', x: p.x, y: p.y, z: zBot, r: zR, q: op.peck,
                 p: op.dwell, cycle: op.cycle,
                 f: op.cycle === 'G84' ? cut.rpm * op.pitch : cut.feed });
    }
    path.add({ t: 'cycleEnd' });
    path.rapid(undefined, undefined, op.clearance);
    return path;
  };

  /* ============================================================
     OPERACIÓN: GRABADO (sigue la línea con fresa en V)
     ============================================================ */
  CAM.engrave = function (polys, op) {
    op = Object.assign({
      tool: CAM.tool({ type: 'GRABADO', d: 6, angle: 90 }), name: 'Grabado',
      zTop: 0, depth: 0.4, clearance: 5, retract: 1, stepDown: 0.4
    }, op || {});
    var tool = op.tool, cut = CAM.cutting(tool, op.maxRpm);
    var path = new Path(op.name, { tool: tool, feed: cut.feed, rpm: cut.rpm, op: 'grabado' });
    path.add({ t: 'tool', tool: tool, rpm: cut.rpm, coolant: tool.coolant });
    path.comment(op.name + '  prof ' + G3.fmt(op.depth, 3));
    var zs = zLevels(op.zTop, op.zTop - op.depth, op.stepDown);
    for (var zi = 0; zi < zs.length; zi++) {
      var z = zs[zi];
      for (var i = 0; i < polys.length; i++) {
        var lp = polys[i];
        if (!lp || lp.length < 2) continue;
        path.rapid(undefined, undefined, op.clearance);
        path.rapid(lp[0].x, lp[0].y, undefined);
        path.rapid(undefined, undefined, op.zTop + op.retract);
        path.feed(lp[0].x, lp[0].y, z, cut.plunge);
        for (var j = 1; j < lp.length; j++) path.feed(lp[j].x, lp[j].y, z, cut.feed);
        if (lp.closed) path.feed(lp[0].x, lp[0].y, z, cut.feed);
        path.rapid(undefined, undefined, op.clearance);
      }
    }
    return path;
  };

  /* ============================================================
     OPERACIÓN: DESBASTE 3D POR PLANOS Z
     Corta el sólido con planos horizontales y contornea cada nivel.
     ============================================================ */
  CAM.roughing3D = function (mesh, op) {
    op = Object.assign({
      tool: CAM.tool(), name: 'Desbaste 3D',
      zTop: null, zBottom: null, stepDown: 2, stepOver: 0.45,
      stock: 0.3, clearance: 10, retract: 2, entry: 'HELICE',
      stockBox: null
    }, op || {});
    var tool = op.tool, cut = CAM.cutting(tool, op.maxRpm);
    var path = new Path(op.name, { tool: tool, feed: cut.feed, rpm: cut.rpm, op: 'desbaste3d' });
    path.add({ t: 'tool', tool: tool, rpm: cut.rpm, coolant: tool.coolant });
    var bb = mesh.bbox();
    var zTop = op.zTop === null ? bb.z2 : op.zTop;
    var zBot = op.zBottom === null ? bb.z1 : op.zBottom;
    path.comment(op.name + '  Z ' + G3.fmt(zTop, 3) + ' .. ' + G3.fmt(zBot, 3));
    var stock = op.stockBox || { x1: bb.x1 - 1, y1: bb.y1 - 1, x2: bb.x2 + 1, y2: bb.y2 + 1 };
    var zs = zLevels(zTop, zBot, op.stepDown);
    var r = tool.d / 2, so = tool.d * op.stepOver;
    for (var zi = 0; zi < zs.length; zi++) {
      var z = zs[zi];
      /* sección del modelo un pelín por encima del plano para coger la
         silueta real que hay que dejar */
      var loops = M.section(mesh, { n: v3(0, 0, 1), w: z + 1e-4 });
      var flat = loops.map(function (lp) {
        return lp.map(function (p) { return { x: p.x, y: p.y }; });
      }).filter(function (lp) { return lp.length > 2; });
      /* material bruto menos la sección del modelo.  Cada bucle se
         desfasa hacia FUERA de la pieza: los exteriores crecen y los
         interiores (agujeros) encogen, de modo que la fresa no invada
         la pieza por ningún lado. */
      var rect = [{ x: stock.x1, y: stock.y1 }, { x: stock.x2, y: stock.y1 },
                  { x: stock.x2, y: stock.y2 }, { x: stock.x1, y: stock.y2 }];
      var region = [];
      for (var fi = 0; fi < flat.length; fi++) {
        var lp0 = flat[fi];
        /* ¿está contenido en otro bucle? -> es un agujero */
        var depth = 0;
        for (var fj = 0; fj < flat.length; fj++) {
          if (fj === fi) continue;
          if (CAM.ptInLoop(lp0[0], flat[fj])) depth++;
        }
        var d0 = (depth % 2 === 0) ? (r + op.stock) : -(r + op.stock);
        var o = CAM.offsetLoop(lp0, d0);
        region.push(o.length ? o[0] : lp0);
      }
      var zz = CAM.zigzagRegion(rect, region, r * 0.2, so, (zi % 2) * 90);
      if (!zz.length) continue;
      path.comment('Z' + G3.fmt(z, 3) + '  ' + zz.length + ' pasadas');
      path.rapid(undefined, undefined, op.clearance);
      for (var i = 0; i < zz.length; i++) {
        var L = zz[i];
        var cur = path._last;
        if (!cur || Math.hypot(cur.x - L[0].x, cur.y - L[0].y) > so * 2.5) {
          var zPrev = zi === 0 ? zTop : zs[zi - 1];
          path.rapid(undefined, undefined, op.clearance);
          path.rapid(L[0].x, L[0].y, undefined);
          path.rapid(undefined, undefined, Math.min(op.clearance, zPrev + op.retract));
          path.feed(L[0].x, L[0].y, z, cut.plunge);
        } else path.feed(L[0].x, L[0].y, z, cut.feed);
        for (var j = 1; j < L.length; j++) path.feed(L[j].x, L[j].y, z, cut.feed);
      }
      path.rapid(undefined, undefined, op.clearance);
    }
    return path;
  };

  /* ============================================================
     OPERACIÓN: ACABADO 3D POR LÍNEAS PARALELAS
     Proyecta una rejilla sobre la malla (fresa esférica o plana).
     ============================================================ */
  CAM.finishing3D = function (mesh, op) {
    op = Object.assign({
      tool: CAM.tool({ type: 'ESFERICA', d: 6, r: 3 }), name: 'Acabado 3D',
      stepOver: 0.12, angle: 0, clearance: 10, retract: 2,
      zBottom: null, box: null
    }, op || {});
    var tool = op.tool, cut = CAM.cutting(tool, op.maxRpm);
    var path = new Path(op.name, { tool: tool, feed: cut.feed, rpm: cut.rpm, op: 'acabado3d' });
    path.add({ t: 'tool', tool: tool, rpm: cut.rpm, coolant: tool.coolant });
    var bb = op.box || mesh.bbox();
    var ballR = tool.type === 'ESFERICA' ? tool.d / 2 : (tool.type === 'TORICA' ? tool.r : 0);
    var so = tool.d * op.stepOver;
    var ang = (op.angle || 0) * Math.PI / 180;
    var ca = Math.cos(ang), sa = Math.sin(ang);
    path.comment(op.name + '  paso ' + G3.fmt(so, 3));

    /* muestreo a lo largo de líneas paralelas; en cada punto se baja un
       rayo hasta tocar la pieza y se compensa el radio de la punta */
    var diag = Math.hypot(bb.x2 - bb.x1, bb.y2 - bb.y1);
    var cx = (bb.x1 + bb.x2) / 2, cy = (bb.y1 + bb.y2) / 2;
    var nLines = Math.max(2, Math.ceil(diag / so));
    var stepAlong = Math.max(0.15, Math.min(so, tool.d * 0.15));
    var nAlong = Math.max(2, Math.ceil(diag / stepAlong));
    var zSafe = bb.z2 + 10;
    var flip = false;
    path.rapid(undefined, undefined, op.clearance);
    for (var li = 0; li <= nLines; li++) {
      var v = -diag / 2 + li * so;
      var pts = [];
      for (var ai = 0; ai <= nAlong; ai++) {
        var u = -diag / 2 + ai * stepAlong;
        var x = cx + u * ca - v * sa, y = cy + u * sa + v * ca;
        if (x < bb.x1 - so || x > bb.x2 + so || y < bb.y1 - so || y > bb.y2 + so) continue;
        var h = mesh.rayHit(v3(x, y, zSafe), v3(0, 0, -1));
        var z = h ? h.p.z : (op.zBottom === null ? bb.z1 : op.zBottom);
        if (ballR > 0 && h) {
          /* compensa la esfera según la normal de la cara tocada */
          var tri = mesh.triangles()[h.face];
          if (tri) {
            var A = mesh.verts[tri[0]], B = mesh.verts[tri[1]], C = mesh.verts[tri[2]];
            var n = G3.norm(G3.cross(G3.sub(B, A), G3.sub(C, A)));
            if (n.z < 0) n = G3.neg(n);
            z += ballR * (1 - n.z);
          }
        }
        pts.push({ x: x, y: y, z: z });
      }
      if (pts.length < 2) continue;
      if (flip) pts.reverse();
      flip = !flip;
      var cur = path._last;
      if (!cur || Math.hypot(cur.x - pts[0].x, cur.y - pts[0].y) > so * 3) {
        path.rapid(undefined, undefined, op.clearance);
        path.rapid(pts[0].x, pts[0].y, undefined);
        path.feed(pts[0].x, pts[0].y, pts[0].z, cut.plunge);
      } else path.feed(pts[0].x, pts[0].y, pts[0].z, cut.feed);
      for (var k = 1; k < pts.length; k++) path.feed(pts[k].x, pts[k].y, pts[k].z, cut.feed);
    }
    path.rapid(undefined, undefined, op.clearance);
    return path;
  };

  /* ============================================================
     TORNEADO
     Perfil dado como [{z, x}] con x = RADIO (no diámetro).
     El eje Z es el del torno; el eje X sale radialmente.
     ============================================================ */

  /* Desbaste longitudinal (cilindrado) — equivalente a G71 */
  CAM.turnRough = function (profile, op) {
    op = Object.assign({
      tool: CAM.tool({ type: 'CILINDRAR' }), name: 'Cilindrado de desbaste',
      stockD: 0, stockZ: 0,         /* creces radial y axial */
      depth: 1.5,                   /* profundidad de pasada radial */
      stockR: null,                 /* radio del material bruto */
      zStart: null, zEnd: null,
      retract: 1, clearanceX: null, clearanceZ: 2,
      useCycle: false,              /* true: emite G71 en vez de pasadas */
      diameterMode: true
    }, op || {});
    var tool = op.tool, cut = CAM.cutting(tool, op.maxRpm);
    var path = new Path(op.name, { tool: tool, feed: cut.feed, rpm: cut.rpm, op: 'torno-desbaste', lathe: true });
    path.add({ t: 'tool', tool: tool, rpm: cut.rpm, coolant: tool.coolant, lathe: true });
    path.comment(op.name + '  T' + tool.num);

    var prof = profile.slice().sort(function (a, b) { return b.z - a.z; });
    var maxR = 0, minZ = Infinity, maxZ = -Infinity;
    for (var i = 0; i < prof.length; i++) {
      maxR = Math.max(maxR, prof[i].x);
      minZ = Math.min(minZ, prof[i].z); maxZ = Math.max(maxZ, prof[i].z);
    }
    var R0 = op.stockR === null ? maxR + 2 : op.stockR;
    var clrX = op.clearanceX === null ? R0 + 5 : op.clearanceX;
    var zS = op.zStart === null ? maxZ + op.clearanceZ : op.zStart;
    var zE = op.zEnd === null ? minZ : op.zEnd;

    if (op.useCycle) {
      path.add({ t: 'latheCycle', cycle: 'G71', u: op.depth, r: op.retract,
                 ud: op.stockD, wd: op.stockZ, f: cut.feed, profile: prof,
                 first: 'P', last: 'Q' });
      return path;
    }

    var r = R0;
    var guard = 0;
    path.lrapid(clrX, zS);
    while (r > op.stockD + 1e-6 && guard++ < 2000) {
      r = Math.max(op.stockD, r - op.depth);
      /* ¿dónde arranca esta pasada?  El primer z (desde la derecha) en el
         que el perfil ya está por dentro de este radio. */
      var zIn = null, zOut = null;
      for (i = 0; i < prof.length; i++) {
        var pr = profR(prof, prof[i].z);
        if (pr <= r + 1e-9) { if (zIn === null) zIn = prof[i].z; zOut = prof[i].z; }
      }
      if (zIn === null) continue;
      path.lrapid(r, zIn + op.clearanceZ);
      path.lfeed(r, zOut, cut.feed);
      /* sale en rampa a 45° para no rozar */
      path.lfeed(r + op.retract, zOut + op.retract, cut.feed);
      path.lrapid(clrX, zS);
      if (r <= op.stockD + 1e-9) break;
    }
    /* pasada de perfilado dejando la creces */
    path.comment('Perfilado con creces');
    path.rapid(undefined, profR(prof, zS) + op.stockD + op.retract, zS);
    for (i = 0; i < prof.length; i++)
      path.lfeed(prof[i].x + op.stockD, prof[i].z + op.stockZ, cut.feed);
    path.lrapid(clrX, zS);
    return path;
  };

  function profR(prof, z) {
    /* radio del perfil en la cota z, interpolando */
    var best = null;
    for (var i = 0; i + 1 < prof.length; i++) {
      var a = prof[i], b = prof[i + 1];
      var lo = Math.min(a.z, b.z), hi = Math.max(a.z, b.z);
      if (z >= lo - 1e-9 && z <= hi + 1e-9) {
        var t = Math.abs(hi - lo) < 1e-12 ? 0 : (z - a.z) / (b.z - a.z);
        var r = a.x + (b.x - a.x) * t;
        if (best === null || r > best) best = r;
      }
    }
    if (best !== null) return best;
    /* fuera del perfil: el extremo más cercano */
    var bd = Infinity, br = 0;
    for (i = 0; i < prof.length; i++) {
      var d = Math.abs(prof[i].z - z);
      if (d < bd) { bd = d; br = prof[i].x; }
    }
    return br;
  }
  CAM.profR = profR;

  /* Acabado del perfil — equivalente a G70 */
  CAM.turnFinish = function (profile, op) {
    op = Object.assign({
      tool: CAM.tool({ type: 'CILINDRAR', vc: 260, fz: 0.10 }), name: 'Acabado de torneado',
      clearanceX: null, clearanceZ: 2, noseComp: true
    }, op || {});
    var tool = op.tool, cut = CAM.cutting(tool, op.maxRpm);
    var path = new Path(op.name, { tool: tool, feed: cut.feed, rpm: cut.rpm, op: 'torno-acabado', lathe: true });
    path.add({ t: 'tool', tool: tool, rpm: cut.rpm, coolant: tool.coolant, lathe: true });
    var prof = profile.slice().sort(function (a, b) { return b.z - a.z; });
    var maxR = 0;
    for (var i = 0; i < prof.length; i++) maxR = Math.max(maxR, prof[i].x);
    var clrX = op.clearanceX === null ? maxR + 5 : op.clearanceX;
    path.comment(op.name);
    if (op.noseComp) path.add({ t: 'noseComp', mode: 'G42', r: tool.r, d: tool.dOffset });
    path.lrapid(prof[0].x, prof[0].z + op.clearanceZ);
    for (i = 0; i < prof.length; i++) path.lfeed(prof[i].x, prof[i].z, cut.feed);
    if (op.noseComp) path.add({ t: 'noseComp', mode: 'off' });
    path.lrapid(clrX, prof[0].z + op.clearanceZ);
    return path;
  };

  /* Refrentado */
  CAM.turnFace = function (op) {
    op = Object.assign({
      tool: CAM.tool({ type: 'CILINDRAR' }), name: 'Refrentado',
      rOuter: 25, rInner: 0, zStart: 1, zEnd: 0, depth: 0.5,
      clearanceX: null, clearanceZ: 2
    }, op || {});
    var tool = op.tool, cut = CAM.cutting(tool, op.maxRpm);
    var path = new Path(op.name, { tool: tool, feed: cut.feed, rpm: cut.rpm, op: 'refrentado', lathe: true });
    path.add({ t: 'tool', tool: tool, rpm: cut.rpm, coolant: tool.coolant, lathe: true });
    var clrX = op.clearanceX === null ? op.rOuter + 5 : op.clearanceX;
    path.comment(op.name);
    var z = op.zStart;
    var guard = 0;
    while (z > op.zEnd + 1e-9 && guard++ < 1000) {
      z = Math.max(op.zEnd, z - op.depth);
      path.lrapid(op.rOuter + 1, z);
      path.lfeed(Math.max(op.rInner, -0.2), z, cut.feed);
      path.lrapid(op.rOuter + 1, z + 0.5);
    }
    path.lrapid(clrX, op.zStart + op.clearanceZ);
    return path;
  };

  /* Ranurado radial */
  CAM.turnGroove = function (op) {
    op = Object.assign({
      tool: CAM.tool({ type: 'RANURAR', d: 3 }), name: 'Ranurado',
      z: 0, width: 3, rOuter: 25, rBottom: 20,
      peck: 1.5, dwell: 0.3, clearanceX: null, retract: 0.5
    }, op || {});
    var tool = op.tool, cut = CAM.cutting(tool, op.maxRpm);
    var path = new Path(op.name, { tool: tool, feed: cut.feed, rpm: cut.rpm, op: 'ranurado', lathe: true });
    path.add({ t: 'tool', tool: tool, rpm: cut.rpm, coolant: tool.coolant, lathe: true });
    var clrX = op.clearanceX === null ? op.rOuter + 5 : op.clearanceX;
    var w = tool.d;
    var nCuts = Math.max(1, Math.ceil((op.width - w) / (w * 0.75)) + 1);
    path.comment(op.name + '  ancho ' + G3.fmt(op.width, 3));
    for (var c = 0; c < nCuts; c++) {
      var z = op.z - (op.width - w) * (nCuts === 1 ? 0 : c / (nCuts - 1));
      path.lrapid(clrX, z);
      path.lrapid(op.rOuter + 0.5, z);
      var r = op.rOuter;
      var guard = 0;
      while (r > op.rBottom + 1e-9 && guard++ < 500) {
        r = Math.max(op.rBottom, r - op.peck);
        path.lfeed(r, z, cut.feed);
        if (r > op.rBottom + 1e-9) {
          path.lrapid(r + op.retract, z);
          path.lrapid(r, z);
        }
      }
      if (op.dwell) path.add({ t: 'dwell', p: op.dwell });
      path.lrapid(op.rOuter + 0.5, z);
    }
    path.lrapid(clrX, op.z + 2);
    return path;
  };

  /* Roscado (ciclo G76 o pasadas explícitas) */
  CAM.turnThread = function (op) {
    op = Object.assign({
      tool: CAM.tool({ type: 'ROSCAR' }), name: 'Roscado',
      zStart: 2, zEnd: -20, dMajor: 20, pitch: 1.5,
      passes: 6, angle: 60, internal: false,
      useCycle: true, chamfer: 1, springPasses: 1
    }, op || {});
    var tool = op.tool, cut = CAM.cutting(tool, op.maxRpm);
    var path = new Path(op.name, { tool: tool, feed: op.pitch, rpm: cut.rpm, op: 'roscado', lathe: true });
    path.add({ t: 'tool', tool: tool, rpm: cut.rpm, coolant: tool.coolant, lathe: true });
    /* profundidad teórica de rosca métrica ISO: 0.6134 * P */
    var h = 0.6134 * op.pitch;
    var rMaj = op.dMajor / 2;
    var rMin = op.internal ? rMaj + h : rMaj - h;
    path.comment(op.name + '  M' + G3.fmt(op.dMajor, 2) + 'x' + G3.fmt(op.pitch, 2) +
                 '  prof ' + G3.fmt(h, 3));
    if (op.useCycle) {
      path.add({ t: 'threadCycle', cycle: 'G76', zEnd: op.zEnd, rEnd: rMin,
                 taper: 0, h: h, firstCut: h / Math.sqrt(op.passes),
                 minCut: 0.05, finish: 0.03, angle: op.angle,
                 pitch: op.pitch, chamfer: op.chamfer, passes: op.passes,
                 rStart: rMaj + (op.internal ? -1 : 1) * 2 });
      return path;
    }
    /* pasadas de sección constante: la enésima entra h*sqrt(n/N) */
    for (var i = 1; i <= op.passes + op.springPasses; i++) {
      var k = Math.min(1, i / op.passes);
      var d = h * Math.sqrt(k);
      var r = op.internal ? rMaj + d : rMaj - d;
      path.lrapid(rMaj + (op.internal ? -2 : 2), op.zStart);
      path.lrapid(r, op.zStart);
      path.add({ t: 'thread', z: op.zEnd, x: r, pitch: op.pitch });
      path.lrapid(rMaj + (op.internal ? -2 : 2), op.zEnd);
      path.lrapid(rMaj + (op.internal ? -2 : 2), op.zStart);
    }
    return path;
  };

  /* Tronzado */
  CAM.turnCutoff = function (op) {
    op = Object.assign({
      tool: CAM.tool({ type: 'TRONZAR', d: 2.5 }), name: 'Tronzado',
      z: -30, rOuter: 25, rInner: 0.3, peck: 2, dwell: 0.2,
      clearanceX: null, retract: 0.5, constantSurface: true
    }, op || {});
    var tool = op.tool, cut = CAM.cutting(tool, op.maxRpm);
    var path = new Path(op.name, { tool: tool, feed: cut.feed, rpm: cut.rpm, op: 'tronzado', lathe: true });
    path.add({ t: 'tool', tool: tool, rpm: cut.rpm, coolant: tool.coolant, lathe: true });
    var clrX = op.clearanceX === null ? op.rOuter + 5 : op.clearanceX;
    path.comment(op.name + '  Z' + G3.fmt(op.z, 3));
    if (op.constantSurface) path.add({ t: 'css', vc: tool.vc, maxRpm: cut.rpm });
    path.lrapid(clrX, op.z);
    path.lrapid(op.rOuter + 0.5, op.z);
    var r = op.rOuter, guard = 0;
    while (r > op.rInner + 1e-9 && guard++ < 800) {
      r = Math.max(op.rInner, r - op.peck);
      path.lfeed(r, op.z, cut.feed);
      if (r > op.rInner + 1e-9) {
        path.lrapid(r + op.retract, op.z);
        path.lrapid(r, op.z);
      }
    }
    if (op.dwell) path.add({ t: 'dwell', p: op.dwell });
    path.lrapid(clrX, op.z);
    if (op.constantSurface) path.add({ t: 'css', off: true });
    return path;
  };

  /* Taladrado en el eje del torno */
  CAM.turnDrill = function (op) {
    op = Object.assign({
      tool: CAM.tool({ type: 'BROCA', d: 10 }), name: 'Taladrado en torno',
      zStart: 2, depth: 40, peck: 5, dwell: 0, clearanceZ: 5
    }, op || {});
    var tool = op.tool, cut = CAM.cutting(tool, op.maxRpm);
    var path = new Path(op.name, { tool: tool, feed: cut.feed, rpm: cut.rpm, op: 'torno-taladro', lathe: true });
    path.add({ t: 'tool', tool: tool, rpm: cut.rpm, coolant: tool.coolant, lathe: true });
    path.comment(op.name + '  Ø' + G3.fmt(tool.d, 3));
    path.add({ t: 'latheDrill', cycle: op.peck ? 'G74' : 'G81',
               z: op.zStart - op.depth, r: op.zStart, q: op.peck, f: cut.feed, p: op.dwell });
    return path;
  };

  /* ============================================================
     Extracción del perfil de revolución de un sólido (para el torno)
     Corta el sólido con el plano XZ y se queda con la mitad X >= 0.
     ============================================================ */
  CAM.latheProfile = function (mesh, opts) {
    opts = opts || {};
    var tol = opts.tol || 1e-6;
    var loops = M.section(mesh, { n: v3(0, 1, 0), w: 0 });
    var best = null, bestLen = -1, i, j;
    for (i = 0; i < loops.length; i++) {
      /* recorta el bucle al semiplano x >= 0 */
      var cl = clipHalf(loops[i], !!loops[i].closed);
      if (cl.length < 2) continue;
      var L = 0;
      for (j = 0; j + 1 < cl.length; j++) L += Math.hypot(cl[j + 1].z - cl[j].z, cl[j + 1].x - cl[j].x);
      if (L > bestLen) { bestLen = L; best = cl; }
    }
    if (!best) return [];
    /* quita el tramo que va por el eje (x ~ 0): ahí no hay material */
    var chain = dropAxis(best, tol);
    if (chain.length < 2) chain = best;
    /* ordena de +Z a -Z (sentido habitual de mecanizado en torno) */
    if (chain[0].z < chain[chain.length - 1].z) chain.reverse();
    /* elimina puntos repetidos y colineales */
    var out = [chain[0]];
    for (i = 1; i < chain.length; i++) {
      var p = chain[i], q = out[out.length - 1];
      if (Math.hypot(p.z - q.z, p.x - q.x) < tol) continue;
      out.push(p);
    }
    if (opts.simplify !== false) out = simplifyProf(out, opts.simpTol || 1e-4);
    return out;
  };

  /* Recorta un bucle de la sección al semiplano x >= 0 */
  function clipHalf(loop, closed) {
    var n = loop.length, out = [], i;
    var lim = closed ? n : n - 1;
    for (i = 0; i < lim; i++) {
      var a = loop[i], b = loop[(i + 1) % n];
      var ia = a.x >= -1e-9, ib = b.x >= -1e-9;
      if (ia) out.push({ z: a.z, x: Math.max(0, a.x) });
      if (ia !== ib) {
        var t = a.x / (a.x - b.x);
        out.push({ z: a.z + (b.z - a.z) * t, x: 0 });
      }
    }
    if (!closed && loop[n - 1].x >= -1e-9) out.push({ z: loop[n - 1].z, x: Math.max(0, loop[n - 1].x) });
    return out;
  }

  /* Localiza la sucesión más larga de puntos que NO están sobre el eje */
  function dropAxis(pts, tol) {
    var n = pts.length, i;
    var onAxis = pts.map(function (p) { return p.x <= tol * 10; });
    if (!onAxis.some(Boolean)) return pts;
    var best = [], cur = [];
    for (i = 0; i < n * 2; i++) {
      var k = i % n;
      if (onAxis[k]) { if (cur.length > best.length) best = cur; cur = []; if (i >= n) break; continue; }
      cur.push(pts[k]);
      if (cur.length > n) break;
    }
    if (cur.length > best.length) best = cur;
    return best;
  }

  /* Simplificación Douglas-Peucker sobre el perfil (z,x) */
  function simplifyProf(pts, tol) {
    if (pts.length < 3) return pts;
    var keep = new Uint8Array(pts.length);
    keep[0] = keep[pts.length - 1] = 1;
    (function rec(a, b) {
      if (b <= a + 1) return;
      var best = -1, bd = tol;
      for (var i = a + 1; i < b; i++) {
        var d = ptSeg(pts[i], pts[a], pts[b]);
        if (d > bd) { bd = d; best = i; }
      }
      if (best < 0) return;
      keep[best] = 1;
      rec(a, best); rec(best, b);
    })(0, pts.length - 1);
    var out = [];
    for (var i = 0; i < pts.length; i++) if (keep[i]) out.push(pts[i]);
    return out;
  }
  function ptSeg(p, a, b) {
    var dz = b.z - a.z, dx = b.x - a.x, l2 = dz * dz + dx * dx;
    var t = l2 < 1e-15 ? 0 : ((p.z - a.z) * dz + (p.x - a.x) * dx) / l2;
    t = t < 0 ? 0 : (t > 1 ? 1 : t);
    return Math.hypot(p.z - a.z - dz * t, p.x - a.x - dx * t);
  }

  /* Simulación del volumen arrancado (estimación) */
  CAM.stockRemoved = function (path, tool) {
    var vol = 0, last = null;
    var r = (tool ? tool.d : 6) / 2;
    for (var i = 0; i < path.moves.length; i++) {
      var m = path.moves[i];
      if (m.t !== 'feed') { if (m.x !== undefined || m.y !== undefined || m.z !== undefined) last = upd(last, m); continue; }
      var n = upd(last, m);
      if (last) {
        var d = Math.hypot(n.x - last.x, n.y - last.y, n.z - last.z);
        vol += d * Math.PI * r * r * 0.35;
      }
      last = n;
    }
    return vol;
    function upd(l, m2) {
      l = l || { x: 0, y: 0, z: 0 };
      return { x: m2.x === undefined ? l.x : m2.x,
               y: m2.y === undefined ? l.y : m2.y,
               z: m2.z === undefined ? l.z : m2.z };
    }
  };

  /* Comprobación de colisiones básica: ¿algún movimiento rápido pasa
     por debajo del plano de seguridad dentro del contorno de la pieza? */
  CAM.checkRapids = function (path, safeZ) {
    var warn = [], last = null;
    for (var i = 0; i < path.moves.length; i++) {
      var m = path.moves[i];
      if (m.x === undefined && m.y === undefined && m.z === undefined) continue;
      var cur = { x: m.x === undefined ? (last ? last.x : 0) : m.x,
                  y: m.y === undefined ? (last ? last.y : 0) : m.y,
                  z: m.z === undefined ? (last ? last.z : 0) : m.z };
      if (m.t === 'rapid' && last && (cur.z < safeZ - 1e-9) &&
          (Math.abs(cur.x - last.x) > 1e-9 || Math.abs(cur.y - last.y) > 1e-9))
        warn.push({ i: i, msg: 'Movimiento rápido en XY por debajo de Z' + G3.fmt(safeZ, 3) });
      last = cur;
    }
    return warn;
  };
})();
