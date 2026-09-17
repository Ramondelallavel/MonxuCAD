/* ============================================================
   templates.js — Plantillas de dibujo
   Equivalen a los .dwt de AutoCAD: fijan unidades, capas,
   estilos de texto y cota, y los valores de sombreado.
   ============================================================ */
(function () {
  'use strict';
  var CAD = (window.CAD = window.CAD || {});
  var E = CAD.E, G = CAD.G;
  var TP = (CAD.Templates = {});

  function ds(doc, name, o) {
    var d = E.defaultDimStyle(name);
    Object.assign(d, o || {});
    doc.dimStyles[name] = d;
    return d;
  }

  TP.list = [
    {
      id: 'arq-mm', name: 'Arquitectura ISO (mm)', units: 'Milímetros',
      desc: 'Planta de edificación. Capas de muros, tabiques, carpintería y cotas a escala 1:50.',
      apply: function (doc) {
        doc.vars.INSUNITS = 4; doc.vars.LUPREC = 0; doc.vars.AUPREC = 0;
        doc.vars.GRIDUNIT = 500; doc.vars.SNAPUNIT = 50; doc.vars.GRIDMAJOR = 10;
        doc.vars.LTSCALE = 25; doc.vars.TEXTSIZE = 180; doc.vars.DIMSCALE = 50;
        doc.vars.LIMMAX = { x: 21000, y: 14850 };
        doc.vars.HPNAME = 'ANSI31'; doc.vars.HPSCALE = 25;
        [['MUROS', 7, 'CONTINUOUS', 50], ['TABIQUES', 8, 'CONTINUOUS', 25],
         ['CARPINTERIA', 4, 'CONTINUOUS', 18], ['EJES', 1, 'CENTER', 9],
         ['COTAS', 3, 'CONTINUOUS', 13], ['TEXTOS', 2, 'CONTINUOUS', 18],
         ['MOBILIARIO', 6, 'CONTINUOUS', 13], ['SOMBREADO', 9, 'CONTINUOUS', 9],
         ['INSTALACIONES', 5, 'DASHED', 13], ['OCULTOS', 8, 'HIDDEN', 13]
        ].forEach(function (l) { doc.addLayer({ name: l[0], color: l[1], ltype: l[2], lw: l[3] }); });
        ds(doc, 'ISO-25', { DIMSCALE: 50, DIMASZ: 2.5, DIMTXT: 2.5, DIMDEC: 0, DIMTAD: 1 });
        doc.vars.CLAYER = 'MUROS'; doc.vars.DIMSTYLE = 'ISO-25';
      }
    },
    {
      id: 'mec-mm', name: 'Mecánica ISO (mm)', units: 'Milímetros',
      desc: 'Pieza mecánica 1:1. Contorno grueso, ejes y ocultas, cotas con tolerancia.',
      apply: function (doc) {
        doc.vars.INSUNITS = 4; doc.vars.LUPREC = 2; doc.vars.AUPREC = 1;
        doc.vars.GRIDUNIT = 10; doc.vars.SNAPUNIT = 1; doc.vars.GRIDMAJOR = 5;
        doc.vars.LTSCALE = 1; doc.vars.TEXTSIZE = 3.5; doc.vars.DIMSCALE = 1;
        doc.vars.LIMMAX = { x: 420, y: 297 };
        doc.vars.HPNAME = 'ANSI31'; doc.vars.HPSCALE = 1;
        [['CONTORNO', 7, 'CONTINUOUS', 50], ['OCULTAS', 4, 'HIDDEN2', 25],
         ['EJES', 1, 'CENTER2', 18], ['COTAS', 3, 'CONTINUOUS', 18],
         ['TEXTOS', 2, 'CONTINUOUS', 25], ['RAYADO', 9, 'CONTINUOUS', 13],
         ['AUXILIAR', 8, 'PHANTOM', 13], ['ROSCAS', 6, 'CONTINUOUS', 13]
        ].forEach(function (l) { doc.addLayer({ name: l[0], color: l[1], ltype: l[2], lw: l[3] }); });
        ds(doc, 'ISO-25', { DIMSCALE: 1, DIMASZ: 2.5, DIMTXT: 3.5, DIMDEC: 2, DIMTAD: 1, DIMEXE: 1.25, DIMGAP: 0.625 });
        ds(doc, 'ISO-25-TOL', {
          DIMSCALE: 1, DIMASZ: 2.5, DIMTXT: 3.5, DIMDEC: 2, DIMTAD: 1,
          DIMTOL: 1, DIMTP: 0.05, DIMTM: 0.05, DIMTDEC: 2, DIMTFAC: 0.7
        });
        doc.vars.CLAYER = 'CONTORNO'; doc.vars.DIMSTYLE = 'ISO-25';
      }
    },
    {
      id: 'est-mm', name: 'Estructura (mm)', units: 'Milímetros',
      desc: 'Planos de estructura: pilares, vigas, armado y replanteo a escala 1:50.',
      apply: function (doc) {
        doc.vars.INSUNITS = 4; doc.vars.LUPREC = 0;
        doc.vars.GRIDUNIT = 500; doc.vars.SNAPUNIT = 50;
        doc.vars.LTSCALE = 25; doc.vars.TEXTSIZE = 150; doc.vars.DIMSCALE = 50;
        doc.vars.LIMMAX = { x: 21000, y: 14850 };
        doc.vars.HPNAME = 'AR-CONC'; doc.vars.HPSCALE = 40;
        [['PILARES', 7, 'CONTINUOUS', 50], ['VIGAS', 4, 'CONTINUOUS', 35],
         ['FORJADO', 8, 'CONTINUOUS', 18], ['ARMADO', 1, 'CONTINUOUS', 35],
         ['EJES-REPLANTEO', 6, 'CENTER', 13], ['COTAS', 3, 'CONTINUOUS', 13],
         ['TEXTOS', 2, 'CONTINUOUS', 18], ['CIMENTACION', 5, 'DASHED', 25]
        ].forEach(function (l) { doc.addLayer({ name: l[0], color: l[1], ltype: l[2], lw: l[3] }); });
        ds(doc, 'ISO-25', { DIMSCALE: 50, DIMTXT: 2.5, DIMDEC: 0, DIMTAD: 1 });
        doc.vars.CLAYER = 'PILARES';
      }
    },
    {
      id: 'ele-mm', name: 'Electricidad (mm)', units: 'Milímetros',
      desc: 'Esquemas y plantas de instalación eléctrica con simbología UNE.',
      apply: function (doc) {
        doc.vars.INSUNITS = 4; doc.vars.LUPREC = 0;
        doc.vars.GRIDUNIT = 500; doc.vars.SNAPUNIT = 50;
        doc.vars.LTSCALE = 25; doc.vars.TEXTSIZE = 150; doc.vars.DIMSCALE = 50;
        doc.vars.LIMMAX = { x: 21000, y: 14850 };
        [['ARQUITECTURA', 8, 'CONTINUOUS', 13], ['ALUMBRADO', 2, 'CONTINUOUS', 25],
         ['TOMAS', 4, 'CONTINUOUS', 25], ['CIRCUITOS', 3, 'CONTINUOUS', 18],
         ['CUADROS', 1, 'CONTINUOUS', 35], ['TEXTOS', 7, 'CONTINUOUS', 18],
         ['TIERRA', 6, 'DASHDOT', 18]
        ].forEach(function (l) { doc.addLayer({ name: l[0], color: l[1], ltype: l[2], lw: l[3] }); });
        doc.vars.CLAYER = 'ALUMBRADO';
      }
    },
    {
      id: 'topo-m', name: 'Topografía (m)', units: 'Metros',
      desc: 'Levantamientos y parcelario en metros, con curvas de nivel.',
      apply: function (doc) {
        doc.vars.INSUNITS = 6; doc.vars.LUPREC = 3;
        doc.vars.GRIDUNIT = 10; doc.vars.SNAPUNIT = 0.5;
        doc.vars.LTSCALE = 1; doc.vars.TEXTSIZE = 1.5; doc.vars.DIMSCALE = 1;
        doc.vars.LIMMAX = { x: 500, y: 300 };
        [['PARCELAS', 3, 'CONTINUOUS', 35], ['CURVAS-MAESTRAS', 2, 'CONTINUOUS', 25],
         ['CURVAS', 8, 'CONTINUOUS', 9], ['VIALES', 7, 'CONTINUOUS', 25],
         ['EDIFICACION', 1, 'CONTINUOUS', 25], ['COTAS', 4, 'CONTINUOUS', 13],
         ['TEXTOS', 7, 'CONTINUOUS', 13], ['VERTICES', 6, 'CONTINUOUS', 18]
        ].forEach(function (l) { doc.addLayer({ name: l[0], color: l[1], ltype: l[2], lw: l[3] }); });
        ds(doc, 'ISO-25', { DIMSCALE: 1, DIMTXT: 1.5, DIMASZ: 1.5, DIMDEC: 2 });
        doc.vars.CLAYER = 'PARCELAS';
      }
    },
    {
      id: 'imperial', name: 'Imperial (pulgadas)', units: 'Pulgadas',
      desc: 'Equivalente a acad.dwt: unidades en pulgadas y cotas Standard.',
      apply: function (doc) {
        doc.vars.INSUNITS = 1; doc.vars.LUPREC = 4;
        doc.vars.GRIDUNIT = 0.5; doc.vars.SNAPUNIT = 0.25; doc.vars.GRIDMAJOR = 2;
        doc.vars.LTSCALE = 1; doc.vars.TEXTSIZE = 0.2; doc.vars.DIMSCALE = 1;
        doc.vars.LIMMAX = { x: 12, y: 9 };
        doc.vars.HPSCALE = 1;
        ds(doc, 'Standard', { DIMSCALE: 1, DIMASZ: 0.18, DIMTXT: 0.18, DIMEXE: 0.18, DIMEXO: 0.0625, DIMGAP: 0.09, DIMDEC: 4 });
        doc.vars.DIMSTYLE = 'Standard';
      }
    },
    {
      id: 'blank', name: 'En blanco (acadiso)', units: 'Milímetros',
      desc: 'Dibujo vacío con la capa 0 y los valores por defecto ISO.',
      apply: function (doc) {
        doc.vars.INSUNITS = 4; doc.vars.LUPREC = 4;
        doc.vars.GRIDUNIT = 10; doc.vars.SNAPUNIT = 10;
        doc.vars.LTSCALE = 1; doc.vars.TEXTSIZE = 2.5; doc.vars.DIMSCALE = 1;
        doc.vars.LIMMAX = { x: 420, y: 297 };
      }
    }
  ];

  TP.byId = function (id) {
    for (var i = 0; i < TP.list.length; i++) if (TP.list[i].id === id) return TP.list[i];
    return TP.list[TP.list.length - 1];
  };

  TP.create = function (id) {
    var doc = new CAD.Doc();
    var t = TP.byId(id);
    t.apply(doc);
    doc.templateId = t.id;
    doc.name = 'Dibujo1.dxf';
    return doc;
  };
})();
