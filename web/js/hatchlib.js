/* ============================================================
   hatchlib.js — Biblioteca de patrones de sombreado
   Analizador del formato .PAT de AutoCAD y catálogo integrado.
   Formato:  *NOMBRE, descripción
             ángulo, org-x, org-y, delta-x, delta-y [, trazo1, trazo2 …]
   ============================================================ */
(function () {
  'use strict';
  var CAD = (window.CAD = window.CAD || {});
  var G = CAD.G;
  var HP = (CAD.HatchLib = {});

  /* Los patrones de acad.pat están en pulgadas; se convierten a mm
     igual que hace acadiso.pat. */
  var IN = 25.4;

  HP.parse = function (text, scale) {
    var k = scale === undefined ? IN : scale;
    var out = {}, cur = null;
    String(text).split(/\r?\n/).forEach(function (raw) {
      var line = raw.trim();
      if (!line || line[0] === ';') return;
      if (line[0] === '*') {
        var c = line.indexOf(',');
        var name = (c < 0 ? line.slice(1) : line.slice(1, c)).trim().toUpperCase();
        cur = { name: name, desc: c < 0 ? '' : line.slice(c + 1).trim(), defs: [] };
        out[name] = cur;
        return;
      }
      if (!cur) return;
      var n = line.split(',').map(function (s) { return parseFloat(s.trim()); });
      if (n.length < 5 || !isFinite(n[0])) return;
      var def = { a: n[0], x: n[1] * k, y: n[2] * k, dx: n[3] * k, dy: n[4] * k, dash: [] };
      for (var i = 5; i < n.length; i++) if (isFinite(n[i])) def.dash.push(n[i] * k);
      cur.defs.push(def);
    });
    return out;
  };

  /* ------------------------------------------------------------
     Catálogo integrado (subconjunto de acad.pat / acadiso.pat)
     ------------------------------------------------------------ */
  var PAT_TEXT = [
    '*ANSI31, ANSI Hierro, ladrillo, mampostería',
    '45, 0,0, 0,.125',
    '*ANSI32, ANSI Acero',
    '45, 0,0, 0,.375',
    '45, .176776695,0, 0,.375',
    '*ANSI33, ANSI Bronce, latón, cobre',
    '45, 0,0, 0,.25',
    '45, .176776695,0, 0,.25, .125,-.0625',
    '*ANSI34, ANSI Plástico, caucho',
    '45, 0,0, 0,.75',
    '45, .176776695,0, 0,.75',
    '45, .353553391,0, 0,.75',
    '45, .530330086,0, 0,.75',
    '*ANSI35, ANSI Ladrillo refractario',
    '45, 0,0, 0,.25',
    '45, .176776695,0, 0,.25, .3125,-.0625,0,-.0625,0,-.0625',
    '*ANSI36, ANSI Mármol, pizarra, vidrio',
    '45, 0,0, .21875,.125, .3125,-.0625,0,-.0625',
    '*ANSI37, ANSI Plomo, zinc, aislamiento',
    '45, 0,0, 0,.125',
    '135, 0,0, 0,.125',
    '*ANSI38, ANSI Aluminio',
    '45, 0,0, 0,.125',
    '135, 0,0, .25,.125, .3125,-.1875',
    '*ANGLE, Perfil angular',
    '0, 0,0, 0,.275, .2,-.075',
    '90, 0,0, 0,.275, .2,-.075',
    '*AR-B816, Bloque 8x16 aparejo a soga',
    '0, 0,0, 0,8',
    '90, 0,0, 8,8, 8,-8',
    '*AR-BRSTD, Ladrillo visto estándar',
    '0, 0,0, 0,2.6666',
    '90, 0,0, 2.6666,2.6666, 2.6666,-2.6666',
    '*AR-CONC, Hormigón',
    '0, 0,0, .5,.5, .1,-.4',
    '90, .05,0, .5,.5, .1,-.4',
    '45, .1,.1, .3,.3, .07,-.23',
    '*AR-HBONE, Espiga 1x4',
    '45, 0,0, .25,.25, .5,-.5',
    '135, .176776695,.176776695, .25,-.25, .5,-.5',
    '*AR-PARQ1, Parqué 2x12',
    '90, 0,0, 1,1, 6,-6',
    '0, 0,0, 1,1, 6,-6',
    '*AR-RROOF, Cubierta rugosa',
    '0, 0,0, .15,.15, .4,-.15,0,-.15',
    '*AR-SAND, Textura de arena',
    '0, 0,0, .13,.18, 0,-.132',
    '0, .066,.09, .13,.18, 0,-.132',
    '*BOX, Acero en cajón',
    '90, 0,0, 0,1',
    '90, .25,0, 0,1',
    '0, 0,0, 0,1',
    '0, 0,.25, 0,1',
    '*BRASS, Latón',
    '0, 0,0, 0,.25',
    '0, 0,.0625, 0,.25, .1875,-.0625',
    '*BRICK, Ladrillo',
    '0, 0,0, 0,.25',
    '90, 0,0, .25,.25, .25,-.25',
    '90, .125,.125, .25,.25, .25,-.25',
    '*BRSTONE, Piedra y ladrillo',
    '0, 0,0, 0,.5',
    '0, 0,.21, 0,.5, .5,-.1',
    '90, 0,0, .5,.5, .21,-.79',
    '*CLAY, Arcilla',
    '0, 0,0, 0,.1875',
    '0, 0,.0234375, 0,.1875, .140625,-.046875',
    '0, 0,.09375, 0,.1875, .140625,-.046875',
    '0, 0,.1640625, 0,.1875, .140625,-.046875',
    '*CORK, Corcho',
    '0, 0,0, 0,.125',
    '135, .0625,.0625, .125,.125, .09375,-.15625',
    '*CROSS, Cruces',
    '0, 0,0, .25,.25, .125,-.375',
    '90, .0625,-.0625, .25,.25, .125,-.375',
    '*DASH, Trazos',
    '0, 0,0, .125,.125, .125,-.125',
    '*DOLMIT, Dolomita',
    '0, 0,0, 0,.25',
    '45, 0,0, .25,.25, .25,-.75',
    '*DOTS, Puntos',
    '0, 0,0, .03125,.0625, 0,-.0625',
    '*EARTH, Terreno',
    '0, 0,0, .25,.25, .25,-.25',
    '0, 0,.09375, .25,.25, .25,-.25',
    '90, 0,0, .25,.25, .25,-.25',
    '90, .09375,0, .25,.25, .25,-.25',
    '*ESCHER, Escher',
    '60, 0,0, .5,.5, .5,-.5',
    '180, 0,0, .5,.5, .5,-.5',
    '300, 0,0, .5,.5, .5,-.5',
    '*FLEX, Material flexible',
    '0, 0,0, .25,.125, .25,-.125',
    '225, .25,0, .25,.125, .04419417,-.30630583',
    '*GRASS, Hierba',
    '90, 0,0, .707106781,.707106781, .1875,-1.226563',
    '45, 0,0, 0,1, .1875,-.81',
    '135, 0,0, 0,1, .1875,-.81',
    '*GRATE, Rejilla',
    '0, 0,0, 0,.03125',
    '90, 0,0, 0,.125',
    '*HEX, Hexágonos',
    '0, 0,0, 0,.216506351, .125,-.25',
    '120, 0,0, 0,.216506351, .125,-.25',
    '60, .108253175,.0625, 0,.216506351, .125,-.25',
    '*HONEY, Panal',
    '0, 0,0, .1082531755,.1875, .125,-.25',
    '120, 0,0, .1082531755,.1875, .125,-.25',
    '60, .0625,.1082531755, .1082531755,.1875, .125,-.25',
    '*HOUND, Pata de gallo',
    '0, 0,0, .25,.125, .5,-.25',
    '90, 0,0, .25,.125, .5,-.25',
    '*INSUL, Aislamiento',
    '0, 0,0, 0,.375',
    '0, 0,.125, 0,.375, .125,-.125',
    '0, 0,.25, 0,.375',
    '*LINE, Líneas paralelas',
    '0, 0,0, 0,.125',
    '*MUDST, Limolita',
    '0, 0,0, .5,.25, .25,-.25',
    '45, 0,0, .25,.25, .125,-.375',
    '*NET, Retícula',
    '0, 0,0, 0,.125',
    '90, 0,0, 0,.125',
    '*NET3, Retícula a 60 grados',
    '0, 0,0, 0,.125',
    '60, 0,0, 0,.125',
    '120, 0,0, 0,.125',
    '*PLAST, Plástico',
    '0, 0,0, 0,.25',
    '0, 0,.03125, 0,.25',
    '0, 0,.0625, 0,.25',
    '*PLASTI, Plástico industrial',
    '0, 0,0, 0,.25',
    '0, 0,.03125, 0,.25',
    '0, 0,.0625, 0,.25',
    '0, 0,.09375, 0,.25',
    '*SACNCR, Hormigón armado',
    '45, 0,0, .09375,.09375, .125,-.0625',
    '*SQUARE, Cuadrados',
    '0, 0,0, .125,.125, .125,-.125',
    '90, 0,0, .125,.125, .125,-.125',
    '*STARS, Estrellas de David',
    '0, 0,0, .216506351,.125, .125,-.125',
    '60, 0,0, .216506351,.125, .125,-.125',
    '120, .0625,.108253175, .216506351,.125, .125,-.125',
    '*STEEL, Acero',
    '45, 0,0, 0,.125',
    '45, .09375,0, 0,.125',
    '*SWAMP, Marisma',
    '0, 0,0, .5,.866025403, .125,-.875',
    '90, .0625,0, .43301207,.25, .0625,-.34801207',
    '90, .078125,0, .43301207,.25, .05,-.35551207',
    '90, .046875,0, .43301207,.25, .05,-.35551207',
    '*TRANS, Transmisión de calor',
    '0, 0,0, 0,.25',
    '0, 0,.125, 0,.25, .125,-.125',
    '*TRIANG, Triángulos',
    '60, 0,0, .1875,.324759526, .1875,-.1875',
    '120, 0,0, .1875,.324759526, .1875,-.1875',
    '0, -.09375,.162379763, .1875,.324759526, .1875,-.1875',
    '*ZIGZAG, Zigzag',
    '0, 0,0, .125,.125, .125,-.125',
    '90, .125,0, .125,.125, .125,-.125',
    '*GRAVEL, Grava',
    '0, 0,0, .25,.25, .0625,-.4375',
    '90, .125,.05, .25,.25, .0625,-.4375',
    '45, .05,.15, .3,.3, .05,-.55',
    '*ISO02W100, Trazos',
    '0, 0,0, 0,3.9, 12,-6',
    '*ISO03W100, Trazos espaciados',
    '0, 0,0, 0,3.9, 12,-18',
    '*ISO04W100, Trazo y punto largos',
    '0, 0,0, 0,3.9, 24,-3,.5,-3',
    '*ISO05W100, Trazo y dos puntos largos',
    '0, 0,0, 0,3.9, 24,-3,.5,-3,.5,-3',
    '*ISO08W100, Trazo largo y corto',
    '0, 0,0, 0,3.9, 12,-3,6,-3',
    '*ISO11W100, Trazo doble',
    '0, 0,0, 0,3.9, 12,-3,12,-9',
    '*ISO12W100, Trazo y punto',
    '0, 0,0, 0,3.9, 12,-3,.5,-3',
    '*ISO13W100, Trazo y dos puntos',
    '0, 0,0, 0,3.9, 12,-3,.5,-3,.5,-3',
    '*ISO15W100, Trazo y tres puntos',
    '0, 0,0, 0,3.9, 12,-3,.5,-3,.5,-3,.5,-3'
  ].join('\n');

  /* Los ISOxx ya vienen en mm */
  var ISO_NAMES = /^ISO\d\dW100$/;

  HP.library = {};
  (function build() {
    var inches = HP.parse(PAT_TEXT, IN);
    var mm = HP.parse(PAT_TEXT, 1);
    Object.keys(inches).forEach(function (n) {
      HP.library[n] = ISO_NAMES.test(n) ? mm[n] : inches[n];
    });
    HP.library.SOLID = { name: 'SOLID', desc: 'Relleno sólido', defs: null, solid: true };
  })();

  HP.names = function () {
    return Object.keys(HP.library).sort(function (a, b) {
      if (a === 'SOLID') return -1;
      if (b === 'SOLID') return 1;
      return a.localeCompare(b);
    });
  };
  HP.get = function (name) { return HP.library[String(name).toUpperCase()] || HP.library.ANSI31; };
  HP.defs = function (name) {
    var p = HP.get(name);
    return p && p.defs ? p.defs : [];
  };
  HP.isSolid = function (name) {
    var p = HP.library[String(name).toUpperCase()];
    return !!(p && p.solid);
  };

  /* Carga de un archivo .pat del usuario */
  HP.load = function (text, unitsAreMm) {
    var parsed = HP.parse(text, unitsAreMm ? 1 : IN);
    var added = [];
    Object.keys(parsed).forEach(function (n) {
      if (!parsed[n].defs.length) return;
      HP.library[n] = parsed[n];
      added.push(n);
    });
    return added;
  };

  /* Genera los segmentos de un patrón dentro de un rectángulo dado.
     Devuelve [[p1,p2], …] ya recortados por longitud de trazo. */
  HP.segments = function (name, box, angle, scale, origin, maxSegs) {
    var defs = HP.defs(name);
    if (!defs.length) return [];
    var sc = scale || 1, rot = angle || 0;
    var org = origin || { x: 0, y: 0 };
    var cx = (box.x1 + box.x2) / 2, cy = (box.y1 + box.y2) / 2;
    var diag = Math.hypot(box.x2 - box.x1, box.y2 - box.y1) || 1;
    var out = [];
    var cap = maxSegs || 12000;
    for (var di = 0; di < defs.length && out.length < cap; di++) {
      var d = defs[di];
      var a = G.rad(d.a) + rot;
      var ux = Math.cos(a), uy = Math.sin(a);
      var nx = -uy, ny = ux;
      var dy = (d.dy || 1) * sc;
      if (Math.abs(dy) < 1e-9) dy = sc;
      var dx = (d.dx || 0) * sc;
      /* origen del patrón girado */
      var ox0 = org.x + (d.x * sc) * Math.cos(rot) - (d.y * sc) * Math.sin(rot);
      var oy0 = org.y + (d.x * sc) * Math.sin(rot) + (d.y * sc) * Math.cos(rot);
      var n = Math.ceil(diag / Math.abs(dy)) + 2;
      if (n > 4000) continue;
      var dash = d.dash && d.dash.length ? d.dash.map(function (v) { return v * sc; }) : null;
      var period = dash ? dash.reduce(function (s, v) { return s + Math.abs(v); }, 0) : 0;
      for (var i = -n; i <= n && out.length < cap; i++) {
        var bx = cx + ox0 + nx * dy * i + ux * dx * i;
        var by = cy + oy0 + ny * dy * i + uy * dx * i;
        if (!dash || period < 1e-9) {
          out.push([{ x: bx - ux * diag, y: by - uy * diag }, { x: bx + ux * diag, y: by + uy * diag }]);
          continue;
        }
        /* desarrolla el patrón de trazos a lo largo de la línea */
        var start = -Math.ceil(diag / period) * period;
        var t = start, guard = 0;
        while (t < diag && guard++ < 4000 && out.length < cap) {
          for (var k = 0; k < dash.length; k++) {
            var len = dash[k];
            if (len > 0) {
              out.push([
                { x: bx + ux * t, y: by + uy * t },
                { x: bx + ux * (t + len), y: by + uy * (t + len) }
              ]);
            } else if (len === 0) {
              out.push([
                { x: bx + ux * t, y: by + uy * t },
                { x: bx + ux * (t + 0.01 * sc), y: by + uy * (t + 0.01 * sc) }
              ]);
            }
            t += Math.abs(len) || 0.01 * sc;
            if (t > diag) break;
          }
        }
      }
    }
    return out;
  };
})();
