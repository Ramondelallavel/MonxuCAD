/* ============================================================
   blocks.js — Biblioteca de bloques (unidades: milímetros)
   Cada bloque se construye con primitivas sobre la capa 0 y
   color PorCapa, de modo que adopta capa y color al insertarse.
   ============================================================ */
(function () {
  'use strict';
  var CAD = (window.CAD = window.CAD || {});
  var G = CAD.G, E = CAD.E;
  var BL = (CAD.Blocks = {});

  var O = { layer: '0', color: 256, ltype: 'ByLayer' };
  function L(x1, y1, x2, y2) { return E.line({ x: x1, y: y1 }, { x: x2, y: y2 }, O); }
  function C(x, y, r) { return E.circle({ x: x, y: y }, r, O); }
  function A(x, y, r, a0, a1) { return E.arc({ x: x, y: y }, r, G.rad(a0), G.rad(a1), O); }
  function R(x1, y1, x2, y2) {
    return E.pline([{ x: x1, y: y1 }, { x: x2, y: y1 }, { x: x2, y: y2 }, { x: x1, y: y2 }], true, O);
  }
  function PL(pts, closed) {
    return E.pline(pts.map(function (p) { return { x: p[0], y: p[1], b: p[2] || 0 }; }), !!closed, O);
  }
  function T(x, y, h, s, rot, halign) {
    var t = E.text({ x: x, y: y }, h, s, G.rad(rot || 0), O);
    if (halign) { t.halign = halign; t.p2 = { x: x, y: y }; }
    return t;
  }
  function EL(x, y, rx, ry) { return E.ellipse({ x: x, y: y }, { x: rx, y: 0 }, ry / rx, 0, G.TAU, O); }
  function ATT(x, y, h, tag, prompt, def, halign) {
    var a = E.attdef({ x: x, y: y }, h, tag, prompt, def, O);
    if (halign) { a.halign = halign; a.p2 = { x: x, y: y }; }
    return a;
  }

  /* ============================================================
     Definiciones
     ============================================================ */
  BL.defs = [
    /* ---------------- Arquitectura ---------------- */
    { n: 'PUERTA-70', cat: 'Arquitectura', d: 'Puerta abatible 70 cm', f: function () { return [L(0, 0, 700, 0), A(0, 0, 700, 0, 90), L(0, 0, 0, 45), L(0, 45, 45, 45)]; } },
    { n: 'PUERTA-80', cat: 'Arquitectura', d: 'Puerta abatible 80 cm', f: function () { return [L(0, 0, 800, 0), A(0, 0, 800, 0, 90), L(0, 0, 0, 45), L(0, 45, 45, 45)]; } },
    { n: 'PUERTA-90', cat: 'Arquitectura', d: 'Puerta abatible 90 cm', f: function () { return [L(0, 0, 900, 0), A(0, 0, 900, 0, 90), L(0, 0, 0, 45), L(0, 45, 45, 45)]; } },
    { n: 'PUERTA-DOBLE-140', cat: 'Arquitectura', d: 'Puerta doble 140 cm', f: function () { return [L(0, 0, 700, 0), A(0, 0, 700, 0, 90), L(1400, 0, 700, 0), A(1400, 0, 700, 90, 180)]; } },
    { n: 'PUERTA-CORREDERA-90', cat: 'Arquitectura', d: 'Puerta corredera 90 cm', f: function () { return [R(0, -25, 900, 25), L(900, 0, 1800, 0), L(880, -60, 880, 60), L(0, -70, 1800, -70)]; } },
    { n: 'VENTANA-100', cat: 'Arquitectura', d: 'Ventana 100 cm (muro 25)', f: function () { return [L(0, 0, 1000, 0), L(0, 125, 1000, 125), L(0, 250, 1000, 250), L(0, 0, 0, 250), L(1000, 0, 1000, 250)]; } },
    { n: 'VENTANA-150', cat: 'Arquitectura', d: 'Ventana 150 cm (muro 25)', f: function () { return [L(0, 0, 1500, 0), L(0, 125, 1500, 125), L(0, 250, 1500, 250), L(0, 0, 0, 250), L(1500, 0, 1500, 250), L(750, 0, 750, 250)]; } },
    { n: 'VENTANA-CORREDERA-180', cat: 'Arquitectura', d: 'Ventana corredera 180 cm', f: function () { return [L(0, 0, 1800, 0), L(0, 250, 1800, 250), L(0, 0, 0, 250), L(1800, 0, 1800, 250), L(0, 90, 900, 90), L(900, 160, 1800, 160)]; } },
    { n: 'ESCALERA-RECTA', cat: 'Arquitectura', d: 'Escalera recta 10 peldaños', f: function () { var e = [R(0, 0, 1000, 2800)]; for (var i = 1; i < 10; i++) e.push(L(0, i * 280, 1000, i * 280)); e.push(L(500, 200, 500, 2600)); e.push(PL([[430, 2400], [500, 2600], [570, 2400]])); return e; } },
    { n: 'PILAR-30x30', cat: 'Arquitectura', d: 'Pilar 30×30 cm', f: function () { return [R(-150, -150, 150, 150), L(-150, -150, 150, 150), L(-150, 150, 150, -150)]; } },
    { n: 'PILAR-CIRC-40', cat: 'Arquitectura', d: 'Pilar circular Ø40 cm', f: function () { return [C(0, 0, 200), L(-141, -141, 141, 141), L(-141, 141, 141, -141)]; } },

    /* ---------------- Sanitarios ---------------- */
    { n: 'INODORO', cat: 'Sanitarios', d: 'Inodoro con cisterna', f: function () { return [R(-180, 0, 180, 180), EL(0, 400, 180, 230), A(-180, 400, 0.1, 0, 1), L(-180, 180, -180, 400), L(180, 180, 180, 400)]; } },
    { n: 'LAVABO', cat: 'Sanitarios', d: 'Lavabo mural 60×45', f: function () { return [R(-300, 0, 300, 450), EL(0, 250, 210, 160), C(0, 80, 25)]; } },
    { n: 'LAVABO-PEDESTAL', cat: 'Sanitarios', d: 'Lavabo con pedestal', f: function () { return [EL(0, 0, 250, 200), EL(0, 0, 190, 145), R(-90, -200, 90, -60)]; } },
    { n: 'BANERA-170', cat: 'Sanitarios', d: 'Bañera 170×70', f: function () { return [R(0, 0, 1700, 700), PL([[80, 80], [1620, 80], [1620, 620], [80, 620]], true), C(180, 350, 45)]; } },
    { n: 'DUCHA-80', cat: 'Sanitarios', d: 'Plato de ducha 80×80', f: function () { return [R(0, 0, 800, 800), C(400, 400, 45), L(0, 0, 800, 800), L(0, 800, 800, 0)]; } },
    { n: 'BIDE', cat: 'Sanitarios', d: 'Bidé', f: function () { return [EL(0, 200, 180, 230), R(-150, 0, 150, 60), C(0, 200, 40)]; } },
    { n: 'FREGADERO-2', cat: 'Sanitarios', d: 'Fregadero 2 senos', f: function () { return [R(0, 0, 1200, 600), R(60, 60, 540, 540), R(660, 60, 1140, 540), C(300, 300, 40), C(900, 300, 40)]; } },
    { n: 'LAVADORA', cat: 'Sanitarios', d: 'Lavadora 60×60', f: function () { return [R(0, 0, 600, 600), C(300, 300, 200), C(300, 300, 150), R(40, 500, 240, 560)]; } },

    /* ---------------- Mobiliario ---------------- */
    { n: 'CAMA-90', cat: 'Mobiliario', d: 'Cama individual 90×190', f: function () { return [R(0, 0, 900, 1900), L(0, 1450, 900, 1450), R(120, 1520, 780, 1830)]; } },
    { n: 'CAMA-150', cat: 'Mobiliario', d: 'Cama matrimonio 150×190', f: function () { return [R(0, 0, 1500, 1900), L(0, 1450, 1500, 1450), R(90, 1520, 690, 1830), R(810, 1520, 1410, 1830)]; } },
    { n: 'SOFA-2', cat: 'Mobiliario', d: 'Sofá 2 plazas', f: function () { return [PL([[0, 0], [1400, 0], [1400, 800], [0, 800]], true), R(0, 600, 1400, 800), R(0, 0, 180, 800), R(1220, 0, 1400, 800), L(700, 180, 700, 600)]; } },
    { n: 'SOFA-3', cat: 'Mobiliario', d: 'Sofá 3 plazas', f: function () { return [PL([[0, 0], [2000, 0], [2000, 850], [0, 850]], true), R(0, 650, 2000, 850), R(0, 0, 180, 850), R(1820, 0, 2000, 850), L(640, 180, 640, 650), L(1360, 180, 1360, 650)]; } },
    { n: 'SILLON', cat: 'Mobiliario', d: 'Sillón', f: function () { return [R(0, 0, 800, 800), R(0, 620, 800, 800), R(0, 0, 160, 800), R(640, 0, 800, 800)]; } },
    { n: 'MESA-COMEDOR', cat: 'Mobiliario', d: 'Mesa comedor 160×90', f: function () { return [R(0, 0, 1600, 900)]; } },
    { n: 'MESA-REDONDA-120', cat: 'Mobiliario', d: 'Mesa redonda Ø120', f: function () { return [C(0, 0, 600)]; } },
    { n: 'SILLA', cat: 'Mobiliario', d: 'Silla 45×45', f: function () { return [R(-225, -225, 225, 225), L(-225, 225, 225, 225), A(0, 225, 180, 0, 180)]; } },
    { n: 'MESA-DESPACHO', cat: 'Mobiliario', d: 'Mesa de despacho 160×80', f: function () { return [R(0, 0, 1600, 800), R(1100, 100, 1550, 700)]; } },
    { n: 'ARMARIO-200', cat: 'Mobiliario', d: 'Armario 200×60', f: function () { return [R(0, 0, 2000, 600), L(0, 600, 2000, 600), L(1000, 0, 1000, 600), L(0, 0, 500, 600), L(2000, 0, 1500, 600)]; } },
    { n: 'ESTANTERIA', cat: 'Mobiliario', d: 'Estantería 100×35', f: function () { return [R(0, 0, 1000, 350), L(0, 90, 1000, 90), L(0, 180, 1000, 180), L(0, 270, 1000, 270)]; } },
    { n: 'NEVERA', cat: 'Mobiliario', d: 'Frigorífico 60×65', f: function () { return [R(0, 0, 600, 650), L(0, 650, 600, 650), A(300, 650, 300, 0, 180)]; } },
    { n: 'COCINA-4F', cat: 'Mobiliario', d: 'Encimera 4 fuegos', f: function () { return [R(0, 0, 600, 600), C(160, 160, 90), C(440, 160, 110), C(160, 440, 110), C(440, 440, 70)]; } },
    { n: 'HORNO', cat: 'Mobiliario', d: 'Horno 60×60', f: function () { return [R(0, 0, 600, 600), R(50, 50, 550, 470), R(50, 500, 550, 560)]; } },
    { n: 'TV', cat: 'Mobiliario', d: 'Televisor', f: function () { return [R(-550, -30, 550, 30), L(-200, 30, 200, 30), R(-120, 30, 120, 80)]; } },
    { n: 'COCHE', cat: 'Mobiliario', d: 'Vehículo turismo', f: function () { return [PL([[0, 0, 0.2], [4400, 0], [4400, 1800, 0.2], [0, 1800]], true), PL([[900, 200], [3100, 200], [3100, 1600], [900, 1600]], true), L(2000, 200, 2000, 1600)]; } },

    /* ---------------- Eléctrico ---------------- */
    { n: 'ENCHUFE', cat: 'Eléctrico', d: 'Base de enchufe', f: function () { return [A(0, 0, 100, 0, 180), L(-100, 0, 100, 0), L(0, 0, 0, 160)]; } },
    { n: 'ENCHUFE-TT', cat: 'Eléctrico', d: 'Base con toma de tierra', f: function () { return [A(0, 0, 100, 0, 180), L(-100, 0, 100, 0), L(0, 0, 0, 160), L(-55, 55, 55, 55)]; } },
    { n: 'ENCHUFE-ESTANCO', cat: 'Eléctrico', d: 'Base estanca', f: function () { return [A(0, 0, 100, 0, 180), L(-100, 0, 100, 0), L(0, 0, 0, 160), L(-55, 55, 55, 55), L(-100, -40, 100, -40)]; } },
    { n: 'INTERRUPTOR', cat: 'Eléctrico', d: 'Interruptor unipolar', f: function () { return [C(0, 0, 60), L(0, 60, 0, 190), L(0, 190, 110, 250)]; } },
    { n: 'CONMUTADOR', cat: 'Eléctrico', d: 'Conmutador', f: function () { return [C(0, 0, 60), L(0, 60, 0, 190), L(0, 190, 110, 250), L(0, 190, -110, 250)]; } },
    { n: 'PULSADOR', cat: 'Eléctrico', d: 'Pulsador', f: function () { return [C(0, 0, 60), L(0, 60, 0, 190), L(-70, 190, 70, 190), L(0, 190, 0, 250)]; } },
    { n: 'PUNTO-LUZ', cat: 'Eléctrico', d: 'Punto de luz', f: function () { return [C(0, 0, 110), L(-78, -78, 78, 78), L(-78, 78, 78, -78)]; } },
    { n: 'LUMINARIA-60', cat: 'Eléctrico', d: 'Luminaria empotrada 60×60', f: function () { return [R(-300, -300, 300, 300), L(-300, -300, 300, 300), L(-300, 300, 300, -300)]; } },
    { n: 'FLUORESCENTE', cat: 'Eléctrico', d: 'Pantalla fluorescente 120', f: function () { return [R(-600, -60, 600, 60), L(-600, 0, 600, 0)]; } },
    { n: 'APLIQUE', cat: 'Eléctrico', d: 'Aplique de pared', f: function () { return [C(0, 0, 90), L(-64, -64, 64, 64), L(-64, 64, 64, -64), L(-120, -120, 120, -120)]; } },
    { n: 'CUADRO-ELECTRICO', cat: 'Eléctrico', d: 'Cuadro general', f: function () { return [R(-300, -150, 300, 150), L(-300, -150, 300, 150), T(0, -100, 120, 'CGP', 0, 1)]; } },
    { n: 'TIMBRE', cat: 'Eléctrico', d: 'Timbre', f: function () { return [A(0, 0, 120, 0, 180), L(-120, 0, 120, 0)]; } },
    { n: 'TOMA-TV', cat: 'Eléctrico', d: 'Toma de televisión', f: function () { return [C(0, 0, 100), T(0, -45, 110, 'TV', 0, 1)]; } },
    { n: 'TOMA-RJ45', cat: 'Eléctrico', d: 'Toma de datos RJ45', f: function () { return [R(-110, -90, 110, 90), T(0, -45, 100, 'R', 0, 1)]; } },
    { n: 'DETECTOR-HUMO', cat: 'Eléctrico', d: 'Detector de humos', f: function () { return [C(0, 0, 150), C(0, 0, 60), L(-106, -106, 106, 106)]; } },
    { n: 'EMERGENCIA', cat: 'Eléctrico', d: 'Alumbrado de emergencia', f: function () { return [R(-180, -90, 180, 90), L(-180, -90, 180, 90), L(-180, 90, 180, -90), T(0, -40, 90, 'E', 0, 1)]; } },

    /* ---------------- Mecánica ---------------- */
    { n: 'MARCA-CENTRO', cat: 'Mecánica', d: 'Marca de centro', f: function () { return [L(-120, 0, 120, 0), L(0, -120, 0, 120)]; } },
    { n: 'RUGOSIDAD', cat: 'Mecánica', d: 'Símbolo de rugosidad', f: function () { return [L(0, 0, -90, 160), L(0, 0, 130, 230), L(75, 133, 205, 133), T(20, 155, 90, 'Ra', 0, 0)]; } },
    { n: 'SOLDADURA', cat: 'Mecánica', d: 'Símbolo de soldadura', f: function () { return [L(0, 0, 200, 200), L(200, 200, 700, 200), L(280, 200, 340, 320), L(340, 320, 400, 200)]; } },
    { n: 'TORNILLO-M10', cat: 'Mecánica', d: 'Tornillo M10 hexagonal', f: function () { var p = []; for (var i = 0; i < 6; i++) p.push([Math.cos(i * Math.PI / 3) * 90, Math.sin(i * Math.PI / 3) * 90]); return [PL(p, true), C(0, 0, 50), C(0, 0, 43)]; } },
    { n: 'TUERCA-M10', cat: 'Mecánica', d: 'Tuerca M10', f: function () { var p = []; for (var i = 0; i < 6; i++) p.push([Math.cos(i * Math.PI / 3 + Math.PI / 6) * 87, Math.sin(i * Math.PI / 3 + Math.PI / 6) * 87]); return [PL(p, true), C(0, 0, 50)]; } },
    { n: 'RODAMIENTO', cat: 'Mecánica', d: 'Rodamiento de bolas', f: function () { var e = [C(0, 0, 350), C(0, 0, 290), C(0, 0, 160), C(0, 0, 100)]; for (var i = 0; i < 8; i++) { var a = i * Math.PI / 4; e.push(C(Math.cos(a) * 225, Math.sin(a) * 225, 60)); } return e; } },

    /* ---------------- Anotación ---------------- */
    { n: 'NORTE', cat: 'Anotación', d: 'Símbolo de norte', f: function () { return [C(0, 0, 400), PL([[0, 350], [-120, -200], [0, -80], [120, -200]], true), T(0, 450, 200, 'N', 0, 1)]; } },
    { n: 'COTA-NIVEL', cat: 'Anotación', d: 'Marca de nivel', f: function () { return [PL([[0, 0], [-120, 200], [120, 200]], true), L(-300, 200, 300, 200), ATT(0, 260, 150, 'NIVEL', 'Cota de nivel', '+0.00', 1)]; } },
    { n: 'MARCA-SECCION', cat: 'Anotación', d: 'Marca de sección', f: function () { return [C(0, 0, 250), L(-250, 0, 250, 0), ATT(0, 70, 160, 'SECCION', 'Letra de sección', 'A', 1), ATT(0, -210, 160, 'PLANO', 'Plano', '01', 1)]; } },
    { n: 'MARCA-DETALLE', cat: 'Anotación', d: 'Llamada de detalle', f: function () { return [C(0, 0, 250), L(-250, 0, 250, 0), ATT(0, 70, 160, 'DETALLE', 'Número de detalle', '1', 1), ATT(0, -210, 160, 'PLANO', 'Plano', '02', 1)]; } },
    { n: 'REFERENCIA-EJE', cat: 'Anotación', d: 'Referencia de eje', f: function () { return [C(0, 0, 250), ATT(0, -70, 200, 'EJE', 'Referencia de eje', 'A', 1)]; } },
    {
      n: 'CAJETIN-A3', cat: 'Anotación', d: 'Cajetín A3 (mm de papel)', f: function () {
        return [
          R(0, 0, 180, 60), L(0, 48, 180, 48), L(0, 36, 180, 36), L(0, 24, 180, 24), L(0, 12, 180, 12),
          L(120, 0, 120, 36), L(60, 0, 60, 24),
          T(3, 51, 3.5, 'PROYECTO', 0), ATT(45, 51, 3.5, 'PROYECTO', 'Nombre del proyecto', 'PROYECTO', 0),
          T(3, 39, 3.5, 'PLANO', 0), ATT(45, 39, 4.5, 'PLANO', 'Título del plano', 'PLANTA BAJA', 0),
          T(3, 27, 2.5, 'AUTOR', 0), ATT(30, 27, 3, 'AUTOR', 'Autor', '', 0),
          T(3, 15, 2.5, 'FECHA', 0), ATT(30, 15, 3, 'FECHA', 'Fecha', '', 0),
          T(63, 15, 2.5, 'ESCALA', 0), ATT(90, 15, 3, 'ESCALA', 'Escala', '1:50', 0),
          T(123, 15, 2.5, 'Nº PLANO', 0), ATT(150, 15, 5, 'NUMERO', 'Número de plano', '01', 0)
        ];
      }
    },
    {
      n: 'CAJETIN-A4', cat: 'Anotación', d: 'Cajetín A4 (mm de papel)', f: function () {
        return [
          R(0, 0, 150, 50), L(0, 40, 150, 40), L(0, 30, 150, 30), L(0, 20, 150, 20), L(0, 10, 150, 10),
          L(100, 0, 100, 30), L(50, 0, 50, 20),
          T(3, 43, 3, 'PROYECTO', 0), ATT(40, 43, 3, 'PROYECTO', 'Nombre del proyecto', 'PROYECTO', 0),
          T(3, 33, 3, 'PLANO', 0), ATT(40, 33, 3.5, 'PLANO', 'Título del plano', 'PLANTA', 0),
          T(3, 23, 2.2, 'AUTOR', 0), ATT(25, 23, 2.5, 'AUTOR', 'Autor', '', 0),
          T(3, 13, 2.2, 'FECHA', 0), ATT(25, 13, 2.5, 'FECHA', 'Fecha', '', 0),
          T(53, 13, 2.2, 'ESCALA', 0), ATT(75, 13, 2.5, 'ESCALA', 'Escala', '1:100', 0),
          T(103, 13, 2.2, 'Nº', 0), ATT(125, 13, 4, 'NUMERO', 'Número de plano', '01', 0)
        ];
      }
    },
    { n: 'FLECHA-NORTE-SIMPLE', cat: 'Anotación', d: 'Flecha de norte simple', f: function () { return [L(0, -300, 0, 300), PL([[0, 400], [-90, 180], [90, 180]], true), T(0, 450, 180, 'N', 0, 1)]; } }
  ];

  BL.categories = function () {
    var seen = [], out = [];
    BL.defs.forEach(function (b) { if (seen.indexOf(b.cat) < 0) { seen.push(b.cat); out.push(b.cat); } });
    return out;
  };

  BL.byName = function (n) {
    for (var i = 0; i < BL.defs.length; i++) if (BL.defs[i].n === n) return BL.defs[i];
    return null;
  };

  /* Inserta la definición en el documento si aún no existe */
  BL.ensure = function (doc, name) {
    if (doc.blocks[name]) return doc.blocks[name];
    var def = BL.byName(name);
    if (!def) return null;
    doc.blocks[name] = { name: name, base: { x: 0, y: 0 }, entities: def.f(), desc: def.d, lib: true };
    return doc.blocks[name];
  };

  /* Miniatura SVG para la paleta */
  BL.thumb = function (name, w, h) {
    var def = BL.byName(name);
    if (!def) return '';
    var ents = def.f();
    var tmpDoc = { layers: { '0': { name: '0', color: 7, on: true, ltype: 'CONTINUOUS' } }, blocks: {}, ltypes: {}, textStyles: {}, vars: {}, layer: function () { return this.layers['0']; } };
    var b = G.bboxNew();
    ents.forEach(function (e) { G.bboxMerge(b, E.extents(e, tmpDoc)); });
    if (!G.bboxValid(b)) return '';
    var pad = Math.max(b.x2 - b.x1, b.y2 - b.y1) * 0.08 + 1;
    b = G.bboxGrow(b, pad);
    var bw = b.x2 - b.x1, bh = b.y2 - b.y1;
    var s = Math.min(w / bw, h / bh);
    var ox = (w - bw * s) / 2 - b.x1 * s, oy = (h - bh * s) / 2 - b.y1 * s;
    var paths = [];
    ents.forEach(function (e) {
      if (e.type === 'TEXT' || e.type === 'ATTDEF') return;
      E.segs(e, tmpDoc, 1).forEach(function (sg) {
        if (sg.pts.length < 2) return;
        var d = sg.pts.map(function (p, i) {
          return (i ? 'L' : 'M') + (p.x * s + ox).toFixed(1) + ' ' + (h - (p.y * s + oy)).toFixed(1);
        }).join(' ');
        paths.push('<path d="' + d + (sg.closed ? ' Z' : '') + '"/>');
      });
    });
    return '<svg viewBox="0 0 ' + w + ' ' + h + '" width="' + w + '" height="' + h + '" fill="none" stroke="currentColor" stroke-width="1.1" stroke-linejoin="round">' + paths.join('') + '</svg>';
  };
})();
