/* ============================================================
   post.js — Postprocesadores de control numérico
   Traducen las trayectorias neutras de cam.js al dialecto de
   cada control: Fanuc/ISO, Haas, Siemens SINUMERIK 840D
   (ShopMill), Heidenhain TNC (conversacional), Mazak Mazatrol
   EIA, LinuxCNC, GRBL, Okuma OSP y Fagor 8055.
   ============================================================ */
(function () {
  'use strict';
  var CAD = (window.CAD = window.CAD || {});
  var G3 = CAD.G3, CAM = CAD.CAM;
  var P = (CAD.Post = {});

  function f(v, d) {
    if (v === undefined || v === null || !isFinite(v)) return null;
    d = d === undefined ? 3 : d;
    var s = v.toFixed(d);
    if (/\./.test(s)) s = s.replace(/0+$/, '').replace(/\.$/, '');
    if (s === '-0') s = '0';
    return s;
  }
  P.f = f;

  /* ============================================================
     Definición de un control
     ============================================================ */
  function Post(o) { Object.assign(this, o); }
  P.Post = Post;

  var COMMON = {
    ext: 'nc',
    seq: true, seqStart: 10, seqStep: 10,
    maxRpm: 12000,
    arcs: true, arcIJ: true,       /* IJ relativos (true) o R (false) */
    useCycles: true,
    comment: function (s) { return '(' + ascii(String(s).replace(/[()]/g, ' ').toUpperCase()) + ')'; },
    lineNum: function (n) { return 'N' + n; }
  };

  /* ---------- FANUC / ISO genérico ---------- */
  P.FANUC = new Post(Object.assign({}, COMMON, {
    id: 'fanuc', name: 'Fanuc 0i / ISO genérico', ext: 'nc',
    header: function (ctx) {
      var L = [];
      L.push('%');
      L.push('O' + (ctx.program || '1000') + ' (' + up(ctx.name) + ')');
      L.push(this.comment('MonxuCAD  ' + ctx.date));
      L.push(this.comment('Material: ' + (ctx.material || 'N/D')));
      L.push('G17 G21 G40 G49 G80 G90 G94');
      L.push('G54');
      return L;
    },
    footer: function (ctx) {
      return ['G0 G91 G28 Z0.', 'G91 G28 X0. Y0.', 'G90', 'M09', 'M05', 'M30', '%'];
    },
    tool: function (m, ctx) {
      var L = [];
      L.push(this.comment('T' + m.tool.num + ' ' + m.tool.name + ' D' + f(m.tool.d)));
      L.push('T' + m.tool.num + ' M06');
      L.push('G90 G54');
      L.push('S' + Math.round(m.rpm) + ' M03');
      L.push('G43 H' + (m.tool.hOffset || m.tool.num) + ' Z' + f(ctx.clearance || 25));
      L.push(coolant(m.coolant));
      return L;
    },
    rapid: function (m, s) { return 'G0' + xyz(m, s); },
    feed: function (m, s) { return 'G1' + xyz(m, s) + fw(m, s); },
    arc: function (m, s) {
      var g = m.cw ? 'G2' : 'G3';
      var t = g + xyz(m, s);
      if (this.arcIJ) { if (m.i !== undefined) t += ' I' + f(m.i); if (m.j !== undefined) t += ' J' + f(m.j); }
      else if (m.r !== undefined) t += ' R' + f(m.r);
      return t + fw(m, s);
    },
    comp: function (m) {
      if (m.mode === 'off') return 'G40';
      return (m.mode === 'left' ? 'G41' : 'G42') + ' D' + (m.d || 1);
    },
    cycleStart: function (m, s) {
      var t = m.cycle + ' Z' + f(m.z) + ' R' + f(m.r);
      if (m.cycle === 'G83' || m.cycle === 'G73') t += ' Q' + f(m.q);
      if (m.cycle === 'G82' || m.cycle === 'G89') t += ' P' + Math.round((m.p || 0) * 1000);
      if (m.cycle === 'G84') t += ' F' + f(m.f);
      else t += ' F' + f(m.f);
      return (m.retractMode || 'G98') + ' ' + t;
    },
    drill: function (m, s) {
      var t = '';
      if (m.x !== undefined && m.x !== s.x) t += ' X' + f(m.x);
      if (m.y !== undefined && m.y !== s.y) t += ' Y' + f(m.y);
      return t ? t.trim() : 'X' + f(m.x) + ' Y' + f(m.y);
    },
    cycleEnd: function () { return 'G80'; },
    dwell: function (m) { return 'G4 P' + Math.round((m.p || 0) * 1000); },
    /* torno */
    latheHeader: function (ctx) {
      var L = ['%', 'O' + (ctx.program || '2000') + ' (' + up(ctx.name) + ')',
               this.comment('MonxuCAD torno  ' + ctx.date),
               'G21 G40 G99', 'G50 S' + (ctx.latheMaxRpm || 3000), 'G54'];
      return L;
    },
    latheFooter: function () { return ['G0 X200. Z200.', 'M09', 'M05', 'M30', '%']; },
    latheTool: function (m) {
      return [this.comment('T' + m.tool.num + ' ' + m.tool.name),
              'T' + pad2(m.tool.num) + pad2(m.tool.dOffset || m.tool.num),
              'G96 S' + Math.round(m.tool.vc) + ' M03',
              coolant(m.coolant)];
    },
    latheMove: function (m, s, dia) {
      var g = m.t === 'rapid' ? 'G0' : 'G1';
      var t = g;
      if (m.x !== undefined) t += ' X' + f(dia ? m.x * 2 : m.x);
      if (m.z !== undefined) t += ' Z' + f(m.z);
      if (m.t === 'feed') t += ' F' + f(m.f || s.feed, 4);
      return t;
    },
    noseComp: function (m) {
      if (m.mode === 'off') return 'G40';
      return m.mode;
    },
    threadCycle: function (m, s, dia) {
      /* G76 en dos bloques (formato Fanuc 0i) */
      var L = [];
      L.push('G76 P' + pad2(m.passes > 99 ? 99 : 1) + pad2(Math.round(m.chamfer * 10)) +
             pad2(Math.round(m.angle)) + ' Q' + Math.round(m.minCut * 1000) +
             ' R' + f(m.finish, 3));
      L.push('G76 X' + f(dia ? m.rEnd * 2 : m.rEnd) + ' Z' + f(m.zEnd) +
             ' P' + Math.round(m.h * 1000) + ' Q' + Math.round(m.firstCut * 1000) +
             ' F' + f(m.pitch, 4));
      return L;
    },
    thread: function (m, s, dia) {
      return 'G32 X' + f(dia ? m.x * 2 : m.x) + ' Z' + f(m.z) + ' F' + f(m.pitch, 4);
    },
    latheCycle: function (m, s, dia) {
      return ['G71 U' + f(m.u) + ' R' + f(m.r),
              'G71 P100 Q200 U' + f(m.ud * (dia ? 2 : 1)) + ' W' + f(m.wd) + ' F' + f(m.f)];
    },
    latheDrill: function (m) {
      if (m.cycle === 'G74') return 'G74 R' + f(m.p || 0.5) + '\nG74 Z' + f(m.z) + ' Q' + Math.round(m.q * 1000) + ' F' + f(m.f);
      return 'G0 Z' + f(m.r) + '\nG1 Z' + f(m.z) + ' F' + f(m.f) + '\nG0 Z' + f(m.r);
    },
    css: function (m) { return m.off ? 'G97 S' + Math.round(m.maxRpm || 1000) : 'G96 S' + Math.round(m.vc); }
  }));

  /* ---------- HAAS ---------- */
  P.HAAS = new Post(Object.assign({}, P.FANUC, {
    id: 'haas', name: 'Haas NGC', ext: 'nc', maxRpm: 15000,
    header: function (ctx) {
      return ['%', 'O' + (ctx.program || '1000') + ' (' + up(ctx.name) + ')',
        this.comment('GENERADO POR MONXUCAD ' + ctx.date),
        this.comment('MATERIAL ' + (ctx.material || 'N/D')),
        'G00 G17 G20'.replace('G20', 'G21'), 'G40 G49 G80 G90 G94 G98', 'G54'];
    },
    tool: function (m, ctx) {
      return [this.comment('T' + m.tool.num + ' ' + up(m.tool.name)),
        'T' + m.tool.num + ' M06',
        'G00 G90 G54 G17',
        'S' + Math.round(m.rpm) + ' M03',
        'G43 H' + (m.tool.hOffset || m.tool.num) + ' Z' + f(ctx.clearance || 25) + ' M08'];
    },
    footer: function () { return ['G00 G53 Z0.', 'G53 X0. Y0.', 'M09', 'M05', 'M30', '%']; }
  }));

  /* ---------- SIEMENS SINUMERIK 840D ---------- */
  P.SIEMENS = new Post(Object.assign({}, COMMON, {
    id: 'siemens', name: 'Siemens SINUMERIK 840D', ext: 'mpf', maxRpm: 18000,
    comment: function (s) { return '; ' + ascii(String(s)); },
    header: function (ctx) {
      return ['; ' + ascii(ctx.name || 'PIEZA'),
        '; MonxuCAD ' + ctx.date,
        '; Material: ' + (ctx.material || 'N/D'),
        'G17 G54 G64 G90 G94',
        'G710                     ; cotas métricas',
        'CYCLE800()               ; anular giro de plano'];
    },
    footer: function () { return ['SUPA G0 Z=_ZSAFE', 'M09', 'M05', 'SUPA G0 X0 Y0', 'M30']; },
    tool: function (m, ctx) {
      return ['; T' + m.tool.num + ' ' + m.tool.name,
        'T="' + toolName(m.tool) + '"',
        'M06',
        'D' + (m.tool.dOffset || 1),
        'S' + Math.round(m.rpm) + ' M03',
        coolant(m.coolant),
        'G0 Z' + f(ctx.clearance || 25)];
    },
    rapid: function (m, s) { return 'G0' + xyz(m, s); },
    feed: function (m, s) { return 'G1' + xyz(m, s) + fw(m, s); },
    arc: function (m, s) {
      var g = m.cw ? 'G2' : 'G3';
      var t = g + xyz(m, s);
      if (m.i !== undefined) t += ' I' + f(m.i);
      if (m.j !== undefined) t += ' J' + f(m.j);
      return t + fw(m, s);
    },
    comp: function (m) { return m.mode === 'off' ? 'G40' : (m.mode === 'left' ? 'G41' : 'G42'); },
    cycleStart: function (m) {
      if (m.cycle === 'G83' || m.cycle === 'G73')
        return 'CYCLE83(' + f(m.r) + ',' + f(m.r) + ',2,' + f(m.z) + ',0,,' + f(m.q) +
               ',,,1,0,' + f(m.f) + ',,0,,,,)';
      if (m.cycle === 'G84')
        return 'CYCLE84(' + f(m.r) + ',' + f(m.r) + ',2,' + f(m.z) + ',0,0,3,,' +
               f(m.pitch) + ',,300,300,0,1,,,)';
      if (m.cycle === 'G82')
        return 'CYCLE82(' + f(m.r) + ',' + f(m.r) + ',2,' + f(m.z) + ',0,' + f(m.p) + ',,1)';
      return 'CYCLE81(' + f(m.r) + ',' + f(m.r) + ',2,' + f(m.z) + ',,)';
    },
    drill: function (m, s) {
      var t = 'G0';
      if (m.x !== undefined) t += ' X' + f(m.x);
      if (m.y !== undefined) t += ' Y' + f(m.y);
      return t + '\nMCALL_EXEC';
    },
    cycleEnd: function () { return 'MCALL'; },
    dwell: function (m) { return 'G4 F' + f(m.p); },
    latheHeader: function (ctx) {
      return ['; ' + (ctx.name || 'PIEZA') + ' (torno)', '; MonxuCAD ' + ctx.date,
        'G18 G54 G90 G95', 'G710', 'DIAMON                   ; cotas al diámetro'];
    },
    latheFooter: function () { return ['G0 X200 Z200', 'M09', 'M05', 'M30']; },
    latheTool: function (m) {
      return ['; ' + m.tool.name, 'T="' + toolName(m.tool) + '" D1',
        'LIMS=' + (this._lims || 3000), 'G96 S' + Math.round(m.tool.vc) + ' M03', coolant(m.coolant)];
    },
    latheMove: function (m, s, dia) {
      var t = m.t === 'rapid' ? 'G0' : 'G1';
      if (m.x !== undefined) t += ' X' + f(dia ? m.x * 2 : m.x);
      if (m.z !== undefined) t += ' Z' + f(m.z);
      if (m.t === 'feed') t += ' F' + f(m.f || s.feed, 4);
      return t;
    },
    noseComp: function (m) { return m.mode === 'off' ? 'G40' : (m.mode === 'G41' ? 'G41' : 'G42'); },
    threadCycle: function (m, s, dia) {
      return ['CYCLE99(' + f(m.rStart) + ',' + f(dia ? m.rEnd * 2 : m.rEnd) + ',' + f(m.zEnd) +
              ',,' + f(m.pitch) + ',' + f(m.h) + ',' + f(m.firstCut) + ',' + f(m.finish) +
              ',1,' + Math.round(m.angle) + ',,' + m.passes + ',1,,,1,0,,,,)'];
    },
    thread: function (m, s, dia) {
      return 'G33 X' + f(dia ? m.x * 2 : m.x) + ' Z' + f(m.z) + ' K' + f(m.pitch, 4);
    },
    latheCycle: function (m, s, dia) {
      return ['CYCLE95("PERFIL",' + f(m.u) + ',' + f(m.ud) + ',' + f(m.wd) + ',,' +
              f(m.f) + ',,9,,,' + f(m.r) + ')'];
    },
    latheDrill: function (m) {
      return 'CYCLE83(' + f(m.r) + ',' + f(m.r) + ',2,' + f(m.z) + ',0,,' + f(m.q) + ',,,1,0,' + f(m.f) + ',,0,,,,)';
    },
    css: function (m) { return m.off ? 'G97 S' + Math.round(m.maxRpm || 1000) : 'G96 S' + Math.round(m.vc); }
  }));

  /* ---------- HEIDENHAIN TNC (conversacional) ---------- */
  P.HEIDENHAIN = new Post(Object.assign({}, COMMON, {
    id: 'heidenhain', name: 'Heidenhain TNC 640', ext: 'h',
    seq: true, seqStart: 0, seqStep: 1,
    comment: function (s) { return '; ' + ascii(String(s)); },
    lineNum: function (n) { return String(n); },
    header: function (ctx) {
      return ['BEGIN PGM ' + safeName(ctx.name) + ' MM',
        '; MonxuCAD ' + ctx.date,
        'BLK FORM 0.1 Z X' + f(ctx.bx1 || 0) + ' Y' + f(ctx.by1 || 0) + ' Z' + f(ctx.bz1 || -20),
        'BLK FORM 0.2 X' + f(ctx.bx2 || 100) + ' Y' + f(ctx.by2 || 100) + ' Z' + f(ctx.bz2 || 0)];
    },
    footer: function (ctx) {
      return ['L Z+100 R0 FMAX M9', 'L X-20 Y-20 R0 FMAX M5', 'END PGM ' + safeName(ctx.name) + ' MM'];
    },
    tool: function (m, ctx) {
      return ['; ' + m.tool.name,
        'TOOL CALL ' + m.tool.num + ' Z S' + Math.round(m.rpm),
        'L Z+' + f(ctx.clearance || 25) + ' R0 FMAX M3',
        m.coolant === 'NINGUNA' ? '' : 'M8'].filter(Boolean);
    },
    rapid: function (m, s) {
      var t = 'L';
      if (m.x !== undefined) t += ' X' + sgn(m.x);
      if (m.y !== undefined) t += ' Y' + sgn(m.y);
      if (m.z !== undefined) t += ' Z' + sgn(m.z);
      return t + ' R0 FMAX';
    },
    feed: function (m, s) {
      var t = 'L';
      if (m.x !== undefined) t += ' X' + sgn(m.x);
      if (m.y !== undefined) t += ' Y' + sgn(m.y);
      if (m.z !== undefined) t += ' Z' + sgn(m.z);
      return t + ' ' + (s.comp || 'R0') + ' F' + Math.round(m.f || s.feed);
    },
    arc: function (m, s) {
      var t = (m.cw ? 'CR' : 'CR');
      var r = m.r !== undefined ? m.r : Math.hypot(m.i || 0, m.j || 0);
      return 'CR X' + sgn(m.x) + ' Y' + sgn(m.y) + ' R' + f(r) +
             ' DR' + (m.cw ? '-' : '+') + ' ' + (s.comp || 'R0') + ' F' + Math.round(m.f || s.feed);
    },
    comp: function (m, s) {
      s.comp = m.mode === 'off' ? 'R0' : (m.mode === 'left' ? 'RL' : 'RR');
      return null;
    },
    cycleStart: function (m) {
      if (m.cycle === 'G83' || m.cycle === 'G73') {
        return ['CYCL DEF 200 TALADRADO ~', '  Q200=+2   ;DISTANCIA SEGURIDAD ~',
          '  Q201=' + sgn(m.z) + ' ;PROFUNDIDAD ~', '  Q206=+' + Math.round(m.f) + ' ;AVANCE PROFUNDIDAD ~',
          '  Q202=+' + f(m.q) + ' ;PROFUNDIDAD PASADA ~', '  Q210=+0   ;TIEMPO ESPERA ARRIBA ~',
          '  Q203=' + sgn(m.r - 2) + ' ;COORD. SUPERFICIE ~', '  Q204=+50  ;2A DIST. SEGURIDAD ~',
          '  Q211=+' + f(m.p || 0) + '  ;TIEMPO ESPERA ABAJO'].join('\n');
      }
      if (m.cycle === 'G84') {
        return ['CYCL DEF 206 ROSCADO CON MACHO ~', '  Q200=+2   ;DISTANCIA SEGURIDAD ~',
          '  Q201=' + sgn(m.z) + ' ;PROFUNDIDAD ~', '  Q206=+' + Math.round(m.f) + ' ;AVANCE PROFUNDIDAD ~',
          '  Q211=+0   ;TIEMPO ESPERA ABAJO ~', '  Q203=' + sgn(m.r - 2) + ' ;COORD. SUPERFICIE ~',
          '  Q204=+50  ;2A DIST. SEGURIDAD'].join('\n');
      }
      return ['CYCL DEF 200 TALADRADO ~', '  Q200=+2   ;DISTANCIA SEGURIDAD ~',
        '  Q201=' + sgn(m.z) + ' ;PROFUNDIDAD ~', '  Q206=+' + Math.round(m.f) + ' ;AVANCE PROFUNDIDAD ~',
        '  Q202=' + sgn(m.z) + ' ;PROFUNDIDAD PASADA ~', '  Q210=+0   ;TIEMPO ESPERA ARRIBA ~',
        '  Q203=' + sgn(m.r - 2) + ' ;COORD. SUPERFICIE ~', '  Q204=+50  ;2A DIST. SEGURIDAD ~',
        '  Q211=+0   ;TIEMPO ESPERA ABAJO'].join('\n');
    },
    drill: function (m) { return 'L X' + sgn(m.x) + ' Y' + sgn(m.y) + ' R0 FMAX M99'; },
    cycleEnd: function () { return null; },
    dwell: function (m) { return 'CYCL DEF 9.0 TIEMPO ESPERA\nCYCL DEF 9.1 T.ESPERA ' + f(m.p); }
  }));

  /* ---------- LinuxCNC ---------- */
  P.LINUXCNC = new Post(Object.assign({}, P.FANUC, {
    id: 'linuxcnc', name: 'LinuxCNC (EMC2)', ext: 'ngc', seq: false,
    comment: function (s) { return '(' + ascii(String(s).replace(/[()]/g, ' ')) + ')'; },
    header: function (ctx) {
      return [this.comment('MonxuCAD  ' + ctx.name + '  ' + ctx.date),
        'G17 G21 G40 G49 G54 G80 G90 G94 G97'];
    },
    footer: function () { return ['M9', 'M5', 'G0 Z50', 'M2']; },
    tool: function (m, ctx) {
      return [this.comment(m.tool.name),
        'T' + m.tool.num + ' M6',
        'G43 H' + (m.tool.hOffset || m.tool.num),
        'S' + Math.round(m.rpm) + ' M3',
        coolant(m.coolant),
        'G0 Z' + f(ctx.clearance || 25)];
    }
  }));

  /* ---------- GRBL (fresadora de aficionado / router) ---------- */
  P.GRBL = new Post(Object.assign({}, COMMON, {
    id: 'grbl', name: 'GRBL / router', ext: 'gcode', seq: false,
    maxRpm: 24000, useCycles: false,   /* GRBL no tiene ciclos fijos */
    comment: function (s) { return '(' + ascii(String(s).replace(/[()]/g, ' ')) + ')'; },
    header: function (ctx) {
      return [this.comment('MonxuCAD ' + ctx.name), 'G21 G90 G94', 'G17'];
    },
    footer: function (ctx) { return ['G0 Z' + f(ctx.clearance || 20), 'M5', 'M2']; },
    tool: function (m, ctx) {
      return [this.comment('Herramienta ' + m.tool.num + ': ' + m.tool.name),
        'M5', 'S' + Math.round(Math.min(m.rpm, this.maxRpm)) + ' M3',
        'G4 P2', 'G0 Z' + f(ctx.clearance || 20)];
    },
    rapid: function (m, s) { return 'G0' + xyz(m, s); },
    feed: function (m, s) { return 'G1' + xyz(m, s) + fw(m, s); },
    arc: function (m, s) {
      var t = (m.cw ? 'G2' : 'G3') + xyz(m, s);
      if (m.i !== undefined) t += ' I' + f(m.i);
      if (m.j !== undefined) t += ' J' + f(m.j);
      return t + fw(m, s);
    },
    comp: function () { return null; },   /* sin compensación en el control */
    dwell: function (m) { return 'G4 P' + f(m.p); }
  }));

  /* ---------- Okuma OSP ---------- */
  P.OKUMA = new Post(Object.assign({}, P.FANUC, {
    id: 'okuma', name: 'Okuma OSP-P300', ext: 'min',
    header: function (ctx) {
      return ['$' + safeName(ctx.name), '(MonxuCAD ' + ctx.date + ')',
        'G15 H1', 'G17 G21 G40 G80 G90 G94'];
    },
    footer: function () { return ['G0 Z0 M09', 'M05', 'M02']; },
    tool: function (m, ctx) {
      return ['(' + up(m.tool.name) + ')',
        'T' + m.tool.num + ' M06',
        'G15 H1', 'S' + Math.round(m.rpm) + ' M03',
        'G56 H' + (m.tool.hOffset || m.tool.num) + ' Z' + f(ctx.clearance || 25),
        coolant(m.coolant)];
    }
  }));

  /* ---------- Fagor 8055 ---------- */
  P.FAGOR = new Post(Object.assign({}, P.FANUC, {
    id: 'fagor', name: 'Fagor 8055 / 8065', ext: 'pim',
    comment: function (s) { return ';' + ascii(String(s)); },
    header: function (ctx) {
      return [';' + (ctx.name || 'PIEZA') + '  MonxuCAD ' + ctx.date,
        'G71 G17 G40 G90 G94', 'G54'];
    },
    footer: function () { return ['G0 Z100', 'M9', 'M5', 'M30']; },
    tool: function (m, ctx) {
      return [';' + m.tool.name,
        'T' + m.tool.num + ' D' + (m.tool.dOffset || m.tool.num), 'M6',
        'S' + Math.round(m.rpm) + ' M3', coolant(m.coolant),
        'G0 Z' + f(ctx.clearance || 25)];
    }
  }));

  /* ---------- Mazak EIA (Mazatrol en modo ISO) ---------- */
  P.MAZAK = new Post(Object.assign({}, P.FANUC, {
    id: 'mazak', name: 'Mazak Integrex (EIA/ISO)', ext: 'eia',
    header: function (ctx) {
      return ['%', 'O' + (ctx.program || '9001') + '(' + up(ctx.name) + ')',
        '(MONXUCAD ' + ctx.date + ')',
        'G20.1', 'G17 G21 G40 G49 G54 G80 G90 G94'];
    }
  }));

  P.LIST = [P.FANUC, P.HAAS, P.SIEMENS, P.HEIDENHAIN, P.LINUXCNC, P.GRBL, P.OKUMA, P.FAGOR, P.MAZAK];
  P.byId = function (id) {
    for (var i = 0; i < P.LIST.length; i++) if (P.LIST[i].id === id) return P.LIST[i];
    return P.FANUC;
  };

  /* ---------- Auxiliares compartidos ---------- */
  function xyz(m, s) {
    var t = '';
    if (m.x !== undefined && (s.x === undefined || Math.abs(m.x - s.x) > 1e-7)) { t += ' X' + f(m.x); s.x = m.x; }
    if (m.y !== undefined && (s.y === undefined || Math.abs(m.y - s.y) > 1e-7)) { t += ' Y' + f(m.y); s.y = m.y; }
    if (m.z !== undefined && (s.z === undefined || Math.abs(m.z - s.z) > 1e-7)) { t += ' Z' + f(m.z); s.z = m.z; }
    return t;
  }
  function fw(m, s) {
    var v = m.f || s.feed;
    if (!v) return '';
    if (s.lastF !== undefined && Math.abs(v - s.lastF) < 1e-7) return '';
    s.lastF = v;
    return ' F' + f(v, 1);
  }
  function coolant(c) {
    if (c === 'NINGUNA' || c === null) return 'M09';
    if (c === 'NIEBLA') return 'M07';
    if (c === 'INTERIOR') return 'M08';
    return 'M08';
  }
  function up(s) { return ascii(String(s || '').toUpperCase()); }
  /* Los controles antiguos sólo admiten ASCII en los comentarios */
  var ACC = { 'Á': 'A', 'É': 'E', 'Í': 'I', 'Ó': 'O', 'Ú': 'U', 'Ü': 'U', 'Ñ': 'N',
              'á': 'a', 'é': 'e', 'í': 'i', 'ó': 'o', 'ú': 'u', 'ü': 'u', 'ñ': 'n',
              'Ø': 'D', 'º': 'o', 'ª': 'a', '°': 'deg', '·': '-', '—': '-', '–': '-',
              '≈': '~', '×': 'x', '⚠': '!', '▸': '>', '✓': 'OK' };
  function ascii(t) {
    return String(t).replace(/[^\x20-\x7E]/g, function (c) { return ACC[c] !== undefined ? ACC[c] : ''; });
  }
  P.ascii = ascii;
  function pad2(n) { n = Math.round(n || 0); return (n < 10 ? '0' : '') + n; }
  function sgn(v) { var s = f(v); return (v >= 0 ? '+' : '') + s; }
  function safeName(s) { return String(s || 'PIEZA').toUpperCase().replace(/[^A-Z0-9_]/g, '').slice(0, 16) || 'PIEZA'; }
  function toolName(t) { return String(t.name || ('T' + t.num)).replace(/[^\w]/g, '_').slice(0, 24); }

  /* ============================================================
     Generación del programa
     ============================================================ */
  P.generate = function (paths, post, ctx) {
    post = post || P.FANUC;
    ctx = Object.assign({
      name: 'PIEZA', program: '1000', date: new Date().toISOString().slice(0, 16).replace('T', ' '),
      clearance: 25, material: '', diameterMode: true, lathe: false, maxRpm: post.maxRpm
    }, ctx || {});
    if (!Array.isArray(paths)) paths = [paths];
    var lathe = ctx.lathe || paths.some(function (p) { return p.meta && p.meta.lathe; });
    var out = [];
    var s = { feed: 0, lastF: undefined, comp: 'R0' };

    push(out, lathe && post.latheHeader ? post.latheHeader.call(post, ctx) : post.header.call(post, ctx));

    for (var pi = 0; pi < paths.length; pi++) {
      var path = paths[pi];
      s.x = s.y = s.z = undefined; s.lastF = undefined;
      s.feed = (path.meta && path.meta.feed) || 300;
      out.push(post.comment('--- ' + path.name + ' ---'));
      var inCycle = false;
      for (var i = 0; i < path.moves.length; i++) {
        var m = path.moves[i];
        var line = null;
        switch (m.t) {
          case 'comment': line = post.comment(m.s); break;
          case 'tool':
            s.x = s.y = s.z = undefined; s.lastF = undefined;
            line = (lathe && post.latheTool) ? post.latheTool.call(post, m, ctx) : post.tool.call(post, m, ctx);
            break;
          case 'rapid':
            line = (lathe && post.latheMove) ? post.latheMove.call(post, m, s, ctx.diameterMode) : post.rapid.call(post, m, s);
            if (lathe) { if (m.x !== undefined) s.x = m.x; if (m.z !== undefined) s.z = m.z; }
            break;
          case 'feed':
            line = (lathe && post.latheMove) ? post.latheMove.call(post, m, s, ctx.diameterMode) : post.feed.call(post, m, s);
            if (lathe) { if (m.x !== undefined) s.x = m.x; if (m.z !== undefined) s.z = m.z; }
            break;
          case 'arc': line = post.arc.call(post, m, s); break;
          case 'comp': line = post.comp ? post.comp.call(post, m, s) : null; break;
          case 'noseComp': line = post.noseComp ? post.noseComp.call(post, m, s) : null; break;
          case 'dwell': line = post.dwell.call(post, m); break;
          case 'cycle':
            if (post.useCycles !== false && post.cycleStart) { line = post.cycleStart.call(post, m, s); inCycle = true; }
            else { s.pendingCycle = m; }
            break;
          case 'drill':
            if (inCycle && post.drill) line = post.drill.call(post, m, s);
            else line = expandDrill(post, m, s, ctx);
            break;
          case 'cycleEnd':
            if (inCycle && post.cycleEnd) line = post.cycleEnd.call(post, m, s);
            inCycle = false; s.pendingCycle = null;
            break;
          case 'threadCycle': line = post.threadCycle ? post.threadCycle.call(post, m, s, ctx.diameterMode) : null; break;
          case 'thread': line = post.thread ? post.thread.call(post, m, s, ctx.diameterMode) : null; break;
          case 'latheCycle': line = post.latheCycle ? post.latheCycle.call(post, m, s, ctx.diameterMode) : null; break;
          case 'latheDrill': line = post.latheDrill ? post.latheDrill.call(post, m, s) : null; break;
          case 'css': line = post.css ? post.css.call(post, m) : null; break;
          case 'plane': line = null; break;
        }
        if (line) push(out, line, post);
      }
    }
    push(out, lathe && post.latheFooter ? post.latheFooter.call(post, ctx) : post.footer.call(post, ctx));

    /* numeración de bloques */
    if (post.seq) {
      var n = post.seqStart === undefined ? 10 : post.seqStart;
      var st = post.seqStep || 10;
      out = out.map(function (l) {
        if (!l || l[0] === '%' || l[0] === '(' || l[0] === ';' || /^\s/.test(l)) return l;
        if (post.id === 'heidenhain' && /^(BEGIN|END) PGM/.test(l)) { var r = post.lineNum(n) + ' ' + l; n += st; return r; }
        if (post.id === 'heidenhain' && /^  Q/.test(l)) return l;
        var q = post.lineNum(n) + ' ' + l;
        n += st;
        return q;
      });
    }
    return out.join('\n') + '\n';
  };

  /* Un bloque de movimiento sin ninguna palabra de eje no mueve nada y
     algunos controles lo rechazan: se descarta. */
  var EMPTY_MOVE = /^(G0?[0-3]|L|CR)\s*$/i;
  function push(out, v, post) {
    if (v === null || v === undefined) return;
    if (Array.isArray(v)) { for (var i = 0; i < v.length; i++) push(out, v[i], post); return; }
    String(v).split('\n').forEach(function (l) {
      if (l === null || l === undefined) return;
      var t = String(l).trim();
      if (!t) return;
      if (EMPTY_MOVE.test(t)) return;
      if (/^L\s+R0\s+FMAX$/i.test(t)) return;
      out.push(l);
    });
  }

  /* Desarrollo de un taladro cuando el control no admite ciclos */
  function expandDrill(post, m, s, ctx) {
    var L = [];
    L.push(post.rapid.call(post, { x: m.x, y: m.y }, s));
    L.push(post.rapid.call(post, { z: m.r }, s));
    if ((m.cycle === 'G83' || m.cycle === 'G73') && m.q > 0) {
      var z = m.r, depth = m.r - m.z;
      var n = Math.ceil(depth / m.q);
      for (var i = 1; i <= n; i++) {
        var zt = Math.max(m.z, m.r - m.q * i);
        L.push(post.feed.call(post, { z: zt, f: m.f }, s));
        if (m.cycle === 'G83') L.push(post.rapid.call(post, { z: m.r }, s));
        else L.push(post.rapid.call(post, { z: zt + 0.5 }, s));
        if (zt <= m.z) break;
        if (m.cycle === 'G83') L.push(post.rapid.call(post, { z: zt + 0.5 }, s));
      }
    } else {
      L.push(post.feed.call(post, { z: m.z, f: m.f }, s));
      if (m.p) L.push(post.dwell.call(post, { p: m.p }));
    }
    L.push(post.rapid.call(post, { z: m.r }, s));
    return L;
  }

  /* ============================================================
     Hoja de preparación (setup sheet)
     ============================================================ */
  P.setupSheet = function (paths, ctx) {
    ctx = ctx || {};
    var L = [];
    L.push('HOJA DE PREPARACIÓN — ' + (ctx.name || 'Pieza'));
    L.push('Generada por MonxuCAD  ' + new Date().toLocaleString('es-ES'));
    L.push('Control: ' + (ctx.postName || 'Fanuc/ISO') + '    Material: ' + (ctx.material || 'N/D'));
    L.push(''.padEnd(78, '='));
    var totalT = 0;
    var tools = {};
    for (var i = 0; i < paths.length; i++) {
      var p = paths[i];
      var t = p.time(ctx.rapidFeed || 10000);
      totalT += t;
      var tool = p.meta && p.meta.tool;
      L.push('');
      L.push((i + 1) + '. ' + p.name);
      if (tool) {
        L.push('   Herramienta   T' + tool.num + '  ' + tool.name +
               '  Ø' + f(tool.d) + (tool.r ? '  R' + f(tool.r) : '') + '  Z' + tool.flutes);
        L.push('   Régimen       S' + Math.round(p.meta.rpm) + ' rpm    Avance F' + Math.round(p.meta.feed) + ' mm/min');
        tools[tool.num] = tool;
      }
      L.push('   Z mínima      ' + (isFinite(p.minZ) ? f(p.minZ) : '—'));
      L.push('   Recorrido     corte ' + f(p.cutLen, 1) + ' mm   rápido ' + f(p.rapidLen, 1) + ' mm');
      L.push('   Tiempo        ' + fmtTime(t));
    }
    L.push('');
    L.push(''.padEnd(78, '-'));
    L.push('Herramientas necesarias:');
    Object.keys(tools).sort(function (a, b) { return a - b; }).forEach(function (k) {
      var t = tools[k];
      L.push('   T' + t.num + '  ' + t.name + '  Ø' + f(t.d) + '  L útil ' + f(t.len) +
             '  corrector H' + (t.hOffset || t.num) + ' / D' + (t.dOffset || t.num));
    });
    L.push('');
    L.push('TIEMPO TOTAL ESTIMADO: ' + fmtTime(totalT));
    return L.join('\n');
  };
  function fmtTime(min) {
    var s = Math.round(min * 60);
    var h = Math.floor(s / 3600), m2 = Math.floor((s % 3600) / 60), ss = s % 60;
    return (h ? h + ' h ' : '') + (h || m2 ? m2 + ' min ' : '') + ss + ' s';
  }
  P.fmtTime = fmtTime;
})();
