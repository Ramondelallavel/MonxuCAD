/* ============================================================
   pgp.js — Alias de comando al estilo de acad.pgp

   AutoCAD trae un archivo de parámetros de programa donde cada
   comando tiene su abreviatura.  Quien lleva años dibujando teclea
   "L" y espera una línea, "TR" y espera recortar, "SU" y espera
   restar sólidos.  Aquí se registran esas mismas abreviaturas
   contra los comandos equivalentes de MonxuCAD.

   Sólo se dan de alta las que no colisionan con un comando ya
   existente: nunca se pisa un nombre que el usuario podría estar
   escribiendo entero.
   ============================================================ */
(function () {
  'use strict';
  var CAD = window.CAD, Cmd = CAD.Cmd;

  /* alias -> nombre o lista de nombres candidatos (se usa el primero
     que exista en el registro) */
  var PGP = {
    /* --- dibujo --- */
    L: 'LINEA', XL: 'LINEAX', PL: 'POL', POL: 'POLIGONO', REC: 'RECTANG',
    C: 'CIRCULO', A: 'ARCO', DO: 'ARANDELA', SPL: 'SPLINE', EL: 'ELIPSE',
    ELL: 'ELIPSE', PO: 'PUNTO', PT: 'PUNTO', H: 'SOMBREA', BH: 'SOMBREA',
    GD: 'DEGRADADO', REG: 'REGION', BO: 'CONTORNO', ML: 'LINEAM',
    DIV: 'DIVIDE', ME: 'GRADUA', SO: 'SOLIDO', TB: 'TABLA',
    WIPE: 'CUBRIR', REV: 'NUBEREV', SK: 'BOCETO',

    /* --- modificar --- */
    E: 'BORRA', CO: 'COPIA', CP: 'COPIA', MI: 'SIMETRIA', O: 'DESFASE',
    AR: 'MATRIZ', M: 'DESPLAZA', RO: 'GIRA', SC: 'ESCALA', S: 'ESTIRA',
    TR: 'RECORTA', EX: 'ALARGA', BR: 'PARTE', J: 'UNIR', CHA: 'CHAFLAN',
    F: 'EMPALME', X: 'DESCOMP', LEN: 'LONGITUD', AL: 'ALINEA',
    PE: 'EDITPOL', ED: 'EDITTEXTO', MA: 'IGUALARPROP', OV: 'DEPURAR',
    NCOPY: 'COPIARANIDADO', REV3: 'INVERTIR',

    /* --- capas y propiedades --- */
    LA: 'CAPA', LT: 'TIPOLIN', LTS: 'ESCALATL', LW: 'GROSORLIN',
    COL: 'COLOR', CH: 'PROPIEDADES', MO: 'PROPIEDADES', PR: 'PROPIEDADES',
    LAS: 'ESTADOSCAPA', LAYMRG: 'CAPAFUS', LAYDEL: 'CAPADEL',

    /* --- texto y anotación --- */
    DT: 'TEXTO', T: 'TEXTOM', MT: 'TEXTOM', ST: 'ESTILO',
    D: 'ESTILOCOTA', DLI: 'ACOTALINEAL', DAL: 'ACOTAALINEADA',
    DAN: 'ACOTAANGULO', DRA: 'ACOTARADIO', DDI: 'ACOTADIAMETRO',
    DCO: 'ACOTACONTINUA', DBA: 'ACOTALINEABASE', DOR: 'ACOTACOORDENADA',
    DAR: 'ACOTALONGARCO', DCE: 'MARCACENTRO', DED: 'ACOTAEDIC',
    LE: 'DIRECTRIZ', MLD: 'DIRECTRIZM', QDIM: 'ACOTARAPIDA',
    TOL: 'TOLERANCIA',

    /* --- bloques --- */
    B: 'BLOQUE', I: 'INSERT', W: 'BLOQUEDISC', ATT: 'ATRDEF',
    ATE: 'EDITATR', ATTE: 'EDITATR', BE: 'BLOQUEEDIT', G: 'GRUPO',

    /* --- consulta --- */
    DI: 'DISTANCIA', AA: 'AREA', LI: 'LISTA', LS: 'LISTA', ID: 'ID',
    MEA: 'MEDIRGEOM', MASS: 'PROPFIS',

    /* --- vista --- */
    Z: 'ZOOM', P: 'ENCUADRE', RE: 'REGEN', REA: 'REGENTODO',
    V: 'VISTA', MS: 'ESPACIOM', PS: 'ESPACIOP', MV: 'VENTANAS',
    LO: 'PRESENTACION', UC: 'SCP', HI: 'OCULTA', SHA: 'ESTILOVISUAL',
    VS: 'ESTILOVISUAL', '3DO': 'ORBITA', '3F': 'PASEO',
    DS: 'PARAMDIB', OS: 'REFENT', SE: 'PARAMDIB',

    /* --- sólidos 3D --- */
    BOX: 'PRISMARECT', CYL: 'CILINDRO', SPH: 'ESFERA', CONE: 'CONO',
    TOR: 'TOROIDE', WE: 'CUNA', PYR: 'PIRAMIDE', HEL: 'HELICE',
    EXT: 'EXTRUSION', REVO: 'REVOLUCION', SW: 'BARRIDO', LOF: 'SOLEVADO',
    UNI: 'UNION3D', SU: 'DIFERENCIA3D', IN: 'INTERSEC3D',
    SL: 'CORTE', SEC: 'SECCION3D', INF: 'INTERF',
    PRESSPULL: 'PULSARTIRAR', 'SHELL': 'VACIAR', THI: 'ENGROSAR',
    FILLETEDGE: 'EMPALMEARISTA', CHAMFEREDGE: 'CHAFLANARISTA',

    /* --- archivo y salida --- */
    U: 'H', PU: 'LIMPIA', OP: 'OPCIONES', UN: 'UNIDADES',
    EXP: 'EXPORTAR', IMP: 'IMPORTA3D', PLO: 'TRAZAR',
    QSE: 'DESIGNARAPIDO', FI: 'FILTRO', SSX: 'DESIGNASEMEJANTE',

    /* --- fabricación (propios) --- */
    CAM: 'CAMLISTA', NC: 'CAMGENERAR'
  };

  var puestos = 0, chocan = [];
  Object.keys(PGP).forEach(function (al) {
    var A = al.toUpperCase();
    /* nunca se pisa un comando ni un alias que ya existan */
    if (Cmd.reg[A] || Cmd.alias[A]) { chocan.push(A); return; }
    var target = PGP[al];
    var names = Array.isArray(target) ? target : [target];
    for (var i = 0; i < names.length; i++) {
      var N = names[i].toUpperCase();
      if (Cmd.reg[N]) { Cmd.alias[A] = N; puestos++; return; }
      if (Cmd.alias[N]) { Cmd.alias[A] = Cmd.alias[N]; puestos++; return; }
    }
  });
  Cmd.pgpInfo = { puestos: puestos, chocan: chocan };

  /* ============================================================
     Transparencia: en AutoCAD los comandos de vista y de consulta se
     pueden lanzar en mitad de otro anteponiendo un apóstrofo.
     ============================================================ */
  ['ZOOM', 'ENCUADRE', 'REFENT', 'CAPA', 'COLOR', 'TIPOLIN', 'GROSORLIN',
   'REJILLA', 'FORZCURSOR', 'ORTO', 'VISTA', 'REGEN', 'CALCRAPIDA',
   'ID', 'DISTANCIA', 'AREA', 'PARAMDIB', 'MODIVAR', 'ESCALATL',
   'LIMITES', 'AYUDA'].forEach(function (n) {
    var d = Cmd.reg[n] || (Cmd.alias[n] && Cmd.reg[Cmd.alias[n]]);
    if (d) d.transparent = true;
  });
})();
