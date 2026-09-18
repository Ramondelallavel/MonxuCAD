/* ============================================================
   ui.js — Interfaz: iconos, cinta, barra de estado, comandos,
           paletas y cuadros de diálogo.
   ============================================================ */
(function () {
  'use strict';
  var CAD = (window.CAD = window.CAD || {});
  var G = CAD.G, E = CAD.E, Cmd = CAD.Cmd;

  /* ============================================================
     Iconos (24×24, trazo)
     ============================================================ */
  var P = {
    line: '<path d="M4 19L20 5"/><circle cx="4" cy="19" r="1.6"/><circle cx="20" cy="5" r="1.6"/>',
    pline: '<path d="M3 18l5-7 4 4 3-6 6 3"/><circle cx="3" cy="18" r="1.3"/><circle cx="21" cy="12" r="1.3"/>',
    circle: '<circle cx="12" cy="12" r="8"/><path d="M12 12h8"/><circle cx="12" cy="12" r="1.2"/>',
    arc: '<path d="M4 18A9 9 0 0 1 20 12"/><circle cx="4" cy="18" r="1.3"/><circle cx="20" cy="12" r="1.3"/>',
    rect: '<rect x="3.5" y="6.5" width="17" height="11"/>',
    polygon: '<path d="M12 3.5l8 6-3 9.5H7l-3-9.5z"/>',
    ellipse: '<ellipse cx="12" cy="12" rx="9" ry="5.5"/>',
    spline: '<path d="M3 17c4 0 3-9 8-9s4 9 10 5"/>',
    point: '<path d="M12 5v14M5 12h14"/><circle cx="12" cy="12" r="2"/>',
    hatch: '<rect x="4" y="5" width="16" height="14"/><path d="M6 17l4-10M10 17l4-10M14 17l4-10"/>',
    solid: '<path d="M4 18L12 5l8 13z" fill="currentColor" stroke="none"/>',
    donut: '<circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="4"/>',
    xline: '<path d="M2 20L22 4"/><circle cx="12" cy="12" r="1.6"/>',
    ray: '<path d="M4 20L22 5"/><circle cx="4" cy="20" r="1.6"/>',
    cloud: '<path d="M5 15a2.6 2.6 0 1 1 2.6-2.6A2.6 2.6 0 1 1 12 9a2.6 2.6 0 1 1 4.5 2 2.6 2.6 0 1 1 1.5 4.6 2.6 2.6 0 1 1-4.5 1.4A2.6 2.6 0 1 1 8 16.5 2.6 2.6 0 0 1 5 15z"/>',
    text: '<path d="M5 6h14M12 6v13M9 19h6"/>',
    mtext: '<path d="M4 6h10M9 6v12M6.5 18h5M16 10h4M18 10v8M16.5 18h3"/>',
    block: '<rect x="4" y="7" width="16" height="11"/><path d="M4 7l8-4 8 4M12 3v4"/>',
    insert: '<rect x="4" y="9" width="11" height="9"/><path d="M15 6h5v5M20 6l-6 6"/>',
    divide: '<path d="M3 12h18"/><path d="M8 9v6M13 9v6M18 9v6"/>',
    measure: '<path d="M3 15l18-6"/><path d="M6 13v3M10 12v3M14 11v3M18 10v3"/>',
    erase: '<path d="M7 18h12"/><path d="M5.5 15.5l7-7 5 5-4 4h-5z"/>',
    move: '<path d="M12 3v18M3 12h18M12 3l-3 3M12 3l3 3M12 21l-3-3M12 21l3-3M3 12l3-3M3 12l3 3M21 12l-3-3M21 12l-3 3"/>',
    copy: '<rect x="3.5" y="3.5" width="12" height="12"/><rect x="8.5" y="8.5" width="12" height="12"/>',
    rotate: '<path d="M20 12a8 8 0 1 1-3-6.2"/><path d="M20 4v5h-5"/>',
    scale: '<rect x="3.5" y="12.5" width="8" height="8"/><path d="M13 11V4h-7"/><path d="M20 4L9 15"/>',
    mirror: '<path d="M12 2v20"/><path d="M9 6L3 12l6 6z"/><path d="M15 6l6 6-6 6z"/>',
    offset: '<rect x="3.5" y="6.5" width="17" height="11"/><rect x="6.5" y="9" width="11" height="6"/>',
    array: '<rect x="3" y="3" width="6" height="6"/><rect x="3" y="15" width="6" height="6"/><rect x="15" y="3" width="6" height="6"/><rect x="15" y="15" width="6" height="6"/>',
    trim: '<path d="M4 4l10 10M20 4L10 14"/><circle cx="6" cy="18" r="2.4"/><circle cx="18" cy="18" r="2.4"/>',
    extend: '<path d="M20 3v18"/><path d="M3 12h13"/><path d="M13 9l3 3-3 3"/>',
    fillet: '<path d="M4 20V10a6 6 0 0 1 6-6h10"/><path d="M4 10h6V4" stroke-dasharray="2 2"/>',
    chamfer: '<path d="M4 20V11l7-7h9"/><path d="M4 11h7V4" stroke-dasharray="2 2"/>',
    explode: '<path d="M12 12L5 5M12 12l7-7M12 12l-7 7M12 12l7 7"/><circle cx="12" cy="12" r="2"/>',
    stretch: '<path d="M3 17h7l4-10h7"/><path d="M14 4l3 3-3 3" transform="translate(4,0)"/>',
    'break': '<path d="M3 12h6M15 12h6"/><path d="M11 6l-2 12M15 6l-2 12" stroke-dasharray="2 2"/>',
    break1: '<path d="M3 12h7M14 12h7"/><circle cx="12" cy="12" r="1.6"/>',
    join: '<path d="M3 12h8M13 12h8"/><path d="M11 9v6M13 9v6"/>',
    align: '<path d="M4 6h16M4 12h10M4 18h16"/>',
    pedit: '<path d="M3 18l6-8 4 4 4-7"/><circle cx="3" cy="18" r="1.4"/><circle cx="9" cy="10" r="1.4"/><circle cx="13" cy="14" r="1.4"/><circle cx="17" cy="7" r="1.4"/>',
    lengthen: '<path d="M3 12h18"/><path d="M3 8v8M21 8v8"/><path d="M14 9l3 3-3 3"/>',
    matchprop: '<path d="M6 4h9v5H6z"/><path d="M10.5 9v11"/><path d="M8 20h5"/>',
    dimlinear: '<path d="M4 8v8M20 8v8M4 12h16"/><path d="M7 10l-3 2 3 2M17 10l3 2-3 2"/>',
    dimaligned: '<path d="M5 19L19 5"/><path d="M3 17l4 4M17 3l4 4"/>',
    dimangular: '<path d="M4 20L20 20M4 20L16 6"/><path d="M14 20a10 10 0 0 0-2.6-6"/>',
    dimradius: '<circle cx="11" cy="13" r="7"/><path d="M11 13l8-6"/><path d="M15 9l4-2-1 4"/>',
    dimdiameter: '<circle cx="12" cy="12" r="8"/><path d="M6.5 17.5l11-11"/><path d="M6.5 13.5v4h4M17.5 10.5v-4h-4"/>',
    dimarc: '<path d="M4 18A10 10 0 0 1 20 10"/><path d="M4 18v3M20 10v3"/><path d="M10 22h8"/>',
    dimordinate: '<path d="M4 20h9v-9"/><path d="M13 11l7-7"/>',
    dimcont: '<path d="M3 8v8M11 8v8M19 8v8M3 12h16"/>',
    dimbase: '<path d="M3 4v16M8 16h12M8 10h12"/>',
    leader: '<path d="M4 18l6-6 4 0"/><path d="M14 12h7"/><path d="M4 18l4-1-1-3z" fill="currentColor"/>',
    dimstyle: '<path d="M4 9v6M20 9v6M4 12h16"/><path d="M9 3h6v4H9z"/>',
    textedit: '<path d="M4 6h10M9 6v12M6 18h6"/><path d="M14 17l6-6 2 2-6 6h-2z"/>',
    zoom: '<circle cx="10.5" cy="10.5" r="6.5"/><path d="M15.5 15.5L21 21"/><path d="M8 10.5h5M10.5 8v5"/>',
    zoomext: '<circle cx="10.5" cy="10.5" r="6.5"/><path d="M15.5 15.5L21 21"/><path d="M4 4h3M4 4v3M17 4h-3M17 4v3M4 17h3M4 17v-3"/>',
    zoomwin: '<rect x="3" y="5" width="11" height="9" stroke-dasharray="2 2"/><circle cx="14" cy="14" r="5"/><path d="M18 18l3 3"/>',
    zoomprev: '<circle cx="10.5" cy="10.5" r="6.5"/><path d="M15.5 15.5L21 21"/><path d="M13 8l-4 2.5 4 2.5z" fill="currentColor"/>',
    pan: '<path d="M12 3v10M8 8v7M16 8v7M5 12c0 6 3 9 7 9s7-3 7-9"/>',
    layer: '<path d="M12 3l9 5-9 5-9-5z"/><path d="M3 13l9 5 9-5"/>',
    props: '<rect x="4" y="3" width="16" height="18"/><path d="M4 8h16M9 3v18M12 12h6M12 16h6"/>',
    list: '<path d="M5 7h14M5 12h14M5 17h9"/>',
    dist: '<path d="M4 16L20 8"/><path d="M2 13l4 6M18 5l4 6"/>',
    area: '<path d="M4 18V7l7-3 9 5v9z"/><path d="M8 12h8"/>',
    undo: '<path d="M4 10h11a5 5 0 0 1 0 10H8"/><path d="M8 6l-4 4 4 4"/>',
    redo: '<path d="M20 10H9a5 5 0 0 0 0 10h7"/><path d="M16 6l4 4-4 4"/>',
    'new': '<path d="M6 3h8l4 4v14H6z"/><path d="M14 3v4h4"/>',
    open: '<path d="M3 7h7l2 2h9v10H3z"/>',
    save: '<path d="M4 4h12l4 4v12H4z"/><path d="M8 4v6h8V4M8 20v-6h8v6"/>',
    saveas: '<path d="M4 4h11l4 4v8H4z"/><path d="M8 4v5h7V4"/><path d="M14 20l3-3 3 3"/>',
    'export': '<path d="M5 15v4h14v-4"/><path d="M12 3v12"/><path d="M8 9l4-4 4 4"/>',
    plot: '<path d="M7 9V4h10v5"/><rect x="4" y="9" width="16" height="7"/><path d="M7 16h10v5H7z"/>',
    grid: '<path d="M3 3h18v18H3z"/><path d="M9 3v18M15 3v18M3 9h18M3 15h18"/>',
    snapg: '<path d="M4 4v16M4 4h16"/><circle cx="12" cy="12" r="1.5"/><path d="M12 4v3M4 12h3"/>',
    ortho: '<path d="M4 20V4M4 20h16"/><path d="M9 20V9h11" stroke-dasharray="3 2"/>',
    polar: '<path d="M12 12L21 6"/><path d="M12 12h9"/><path d="M18 12a6 6 0 0 0-2-4"/><circle cx="12" cy="12" r="1.4"/>',
    osnap: '<rect x="4" y="4" width="7" height="7"/><path d="M13 20l4-8 4 8z"/>',
    otrack: '<path d="M3 21L21 3" stroke-dasharray="3 3"/><rect x="2" y="19" width="4" height="4"/><rect x="18" y="1" width="4" height="4"/>',
    lwt: '<path d="M4 7h16" stroke-width="1"/><path d="M4 12h16" stroke-width="2.4"/><path d="M4 17h16" stroke-width="4"/>',
    dyn: '<rect x="3" y="9" width="10" height="6"/><path d="M15 12h6M18 9l3 3-3 3"/>',
    model: '<rect x="3" y="5" width="18" height="14"/><path d="M3 9h18"/>',
    clean: '<path d="M4 4h6M4 4v6M20 4h-6M20 4v6M4 20h6M4 20v-6M20 20h-6M20 20v-6"/>',
    help: '<circle cx="12" cy="12" r="9"/><path d="M9.5 9.5a2.5 2.5 0 1 1 3.5 2.3c-.7.4-1 .9-1 1.7"/><circle cx="12" cy="17" r="1" fill="currentColor"/>',
    settings: '<circle cx="12" cy="12" r="3.2"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3M5 5l2 2M17 17l2 2M19 5l-2 2M7 17l-2 2"/>',
    purge: '<path d="M5 7h14M9 7V4h6v3M7 7l1 14h8l1-14"/>',
    select: '<path d="M5 3l14 8-6 1.5L10 19z" fill="currentColor" stroke="none"/>',
    qselect: '<path d="M4 4h8v8H4z" stroke-dasharray="2 2"/><path d="M11 11l8 4-3.5 1-1.5 4z" fill="currentColor"/>',
    group: '<rect x="3" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><path d="M10 6h5v5" stroke-dasharray="2 2"/>',
    color: '<circle cx="12" cy="12" r="8"/><path d="M12 4a8 8 0 0 1 0 16z" fill="currentColor" stroke="none"/>',
    linetype: '<path d="M3 8h18"/><path d="M3 13h4M10 13h4M17 13h4"/><path d="M3 18h7M13 18h2M18 18h3"/>',
    lweight: '<path d="M4 8h16" stroke-width="1"/><path d="M4 13h16" stroke-width="2.6"/><path d="M4 18h16" stroke-width="4.5"/>',
    cut: '<circle cx="6" cy="18" r="2.6"/><circle cx="18" cy="18" r="2.6"/><path d="M8 16L18 4M16 16L6 4"/>',
    paste: '<rect x="5" y="5" width="14" height="16"/><path d="M9 5V3h6v2"/><path d="M9 12h6M9 16h6"/>',
    units: '<path d="M3 16h18"/><path d="M6 16v-4M10 16v-6M14 16v-3M18 16v-7"/>',
    view: '<path d="M2 12s4-6 10-6 10 6 10 6-4 6-10 6-10-6-10-6z"/><circle cx="12" cy="12" r="2.6"/>',
    workspace: '<rect x="3" y="4" width="18" height="16"/><path d="M3 9h18M9 9v11"/>',
    dwg: '<path d="M6 3h8l4 4v14H6z"/><path d="M14 3v4h4"/><path d="M9 13h2.5a2 2 0 0 1 0 4H9z"/>',
    calc: '<rect x="5" y="3" width="14" height="18"/><path d="M8 7h8M8 11h2M12 11h2M16 11h0.01M8 15h2M12 15h2M16 15h0.01"/>',
    mline: '<path d="M3 8h13l5 5M3 14h10l5 5"/><path d="M16 8v-3M13 14v-3"/>',
    boundary: '<path d="M4 6h16v12H4z" stroke-dasharray="3 2"/><path d="M8 10h8v5H8z"/><circle cx="12" cy="12.5" r="1" fill="currentColor"/>',
    ucs: '<path d="M5 19V6M5 19h13"/><path d="M5 6l-2.5 3M5 6l2.5 3M18 19l-3-2.5M18 19l-3 2.5"/><path d="M11 12h5M11 12l2-2M11 12l2 2" stroke-dasharray="2 2"/>',
    textstyle: '<path d="M4 6h10M9 6v12M6 18h6"/><circle cx="17" cy="15" r="4"/><path d="M17 13v4M15 15h4"/>',
    centermark: '<circle cx="12" cy="12" r="7"/><path d="M12 3v18M3 12h18" stroke-dasharray="4 2"/>',
    attdef: '<rect x="3" y="6" width="18" height="12"/><path d="M7 15l3-7 3 7M8 13h4"/><path d="M15 9h3M15 12h3M15 15h2"/>',
    mview: '<rect x="2" y="4" width="20" height="16"/><rect x="6" y="8" width="12" height="8" stroke-dasharray="3 2"/>',
    layout: '<rect x="3" y="3" width="18" height="18"/><path d="M3 8h18M8 8v13"/>',
    lock: '<rect x="5" y="11" width="14" height="9"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/>',
    audit: '<path d="M6 3h8l4 4v14H6z"/><path d="M14 3v4h4"/><path d="M9 13l2 2 4-4"/>',
    clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
    order: '<path d="M3 6h12M3 12h8M3 18h12"/><path d="M19 4v16M16 17l3 3 3-3"/>',
    find: '<circle cx="10.5" cy="10.5" r="6.5"/><path d="M15.5 15.5 21 21"/>',
    tree: '<path d="M5 4v14M5 8h6M5 13h6M5 18h6"/><rect x="11" y="5" width="8" height="5" rx="1"/><rect x="11" y="15" width="8" height="5" rx="1"/>',
    plane: '<path d="M3 15 12 9l9 6-9 6z"/><path d="M12 9V3M9 5l3-2 3 2"/>',
    hole: '<ellipse cx="12" cy="8" rx="5" ry="2.4"/><path d="M7 8v6a5 2.4 0 0 0 10 0V8"/><path d="M12 14v6M9 18l3 3 3-3"/>',
    mesh: '<path d="M3 8h18M3 16h18M8 3v18M16 3v18"/><rect x="3" y="3" width="18" height="18" rx="1"/>',
    surf: '<path d="M3 15c4-6 8-6 9-3s5 3 9-3"/><path d="M3 20c4-6 8-6 9-3s5 3 9-3"/><path d="M3 15v5M21 9v5M12 12v5"/>',
    dimrad: '<circle cx="11" cy="13" r="7"/><path d="M11 13 20 4"/><path d="M17 4h3v3"/>',
    gradient: '<rect x="4" y="5" width="16" height="14"/><path d="M4 9h16M4 12h16M4 15h16" opacity=".5"/>',
    cycle: '<rect x="3" y="5" width="11" height="9"/><rect x="8" y="10" width="11" height="9"/><path d="M17 3l3 3-3 3" opacity=".7"/>',
    wipeout: '<rect x="3" y="6" width="18" height="12" stroke-dasharray="3 2"/><path d="M6 15l5-6 4 4 3-3" opacity=".45"/><rect x="7" y="9" width="10" height="6" fill="currentColor" stroke="none" opacity=".9"/>',
    boolean: '<circle cx="9.5" cy="12" r="6"/><circle cx="14.5" cy="12" r="6"/>',
    table: '<rect x="3" y="4" width="18" height="16"/><path d="M3 9h18M3 14.5h18M9 9v11M15 9v11"/>',
    /* --- 3D --- */
    box3d: '<path d="M12 2.5 3.5 7v10L12 21.5 20.5 17V7z"/><path d="M12 11.5 3.5 7M12 11.5 20.5 7M12 11.5v10"/>',
    cyl3d: '<ellipse cx="12" cy="6" rx="7" ry="3"/><path d="M5 6v12a7 3 0 0 0 14 0V6"/>',
    sph3d: '<circle cx="12" cy="12" r="8.5"/><ellipse cx="12" cy="12" rx="8.5" ry="3.4"/><ellipse cx="12" cy="12" rx="3.4" ry="8.5"/>',
    cone3d: '<path d="M12 3 4.5 18M12 3l7.5 15"/><ellipse cx="12" cy="18" rx="7.5" ry="3"/>',
    torus3d: '<ellipse cx="12" cy="12" rx="9" ry="5.5"/><ellipse cx="12" cy="12" rx="4" ry="2"/>',
    wedge3d: '<path d="M3.5 18h13L20.5 7h-13z"/><path d="M3.5 18 7.5 7M16.5 18 20.5 7" opacity=".55"/>',
    pyr3d: '<path d="M12 3 3.5 18h17z"/><path d="M12 3 8 18M12 3l4 15" opacity=".5"/>',
    extrude: '<path d="M4 20h9v-9H4z"/><path d="m4 11 5-5h9v9l-5 5" opacity=".75"/><path d="M13 11 18 6"/>',
    revolve: '<path d="M12 2v20" stroke-dasharray="2.5 2"/><path d="M14 5c5 2 5 12 0 14"/><ellipse cx="14" cy="12" rx="2.2" ry="7"/>',
    sweep: '<path d="M3 19c6 0 4-13 11-13"/><ellipse cx="4" cy="19" rx="2.4" ry="1.4"/><ellipse cx="18.5" cy="6" rx="2.4" ry="1.4"/>',
    loft: '<ellipse cx="12" cy="5" rx="4" ry="1.8"/><ellipse cx="12" cy="19" rx="8" ry="2.6"/><path d="M8 5 4 19M16 5l4 14"/>',
    presspull: '<rect x="5" y="12" width="14" height="8"/><path d="M12 10V3M9 6l3-3 3 3"/>',
    union: '<circle cx="9.5" cy="12" r="6"/><circle cx="14.5" cy="12" r="6"/>',
    subtract: '<circle cx="9.5" cy="12" r="6"/><circle cx="14.5" cy="12" r="6" stroke-dasharray="3 2" opacity=".6"/>',
    intersect: '<circle cx="9.5" cy="12" r="6" opacity=".5"/><circle cx="14.5" cy="12" r="6" opacity=".5"/><path d="M12 6.6a6 6 0 0 0 0 10.8 6 6 0 0 0 0-10.8z" fill="currentColor" stroke="none" opacity=".75"/>',
    slice: '<path d="M12 2.5 3.5 7v10L12 21.5 20.5 17V7z" opacity=".55"/><path d="M2 15 22 9"/>',
    section: '<path d="M4 4h16v16H4z" opacity=".35"/><path d="M4 12h16"/><path d="M6 15h3M11 15h3M16 15h2" opacity=".8"/>',
    flatshot: '<path d="M12 2.5 5 6.5v7l7 4 7-4v-7z" opacity=".5"/><path d="M4 21h16"/><path d="M8 21v-3M16 21v-3" opacity=".7"/>',
    thicken: '<path d="M4 14c5-6 11-6 16 0" /><path d="M4 18c5-6 11-6 16 0" opacity=".6"/>',
    smooth: '<path d="M3 16c4-9 14-9 18 0"/><circle cx="7" cy="12" r="1.2"/><circle cx="12" cy="9.6" r="1.2"/><circle cx="17" cy="12" r="1.2"/>',
    massprop: '<circle cx="12" cy="12" r="8.5"/><path d="M12 3.5v17M3.5 12h17" opacity=".4"/><circle cx="12" cy="12" r="1.8" fill="currentColor" stroke="none"/>',
    interfere: '<circle cx="9" cy="12" r="6"/><circle cx="15" cy="12" r="6"/><path d="M12 8v5M12 15.5v.5" stroke-width="2"/>',
    align3d: '<path d="M4 20 20 4"/><circle cx="4" cy="20" r="2"/><circle cx="20" cy="4" r="2"/><path d="M4 12h8M12 4v8" opacity=".5"/>',
    rot3d: '<ellipse cx="12" cy="12" rx="9" ry="4"/><path d="M12 3v18" stroke-dasharray="2 2"/><path d="m18 9 3 3-3 3" opacity=".8"/>',
    mir3d: '<path d="M12 2v20" stroke-dasharray="3 2"/><path d="M9 6 3 12l6 6z"/><path d="M15 6l6 6-6 6z" opacity=".5"/>',
    arr3d: '<rect x="3" y="3" width="6" height="6"/><rect x="12" y="3" width="6" height="6" opacity=".7"/><rect x="3" y="12" width="6" height="6" opacity=".7"/><rect x="12" y="12" width="6" height="6" opacity=".45"/>',
    mov3d: '<path d="M12 3v18M3 12h18"/><path d="m12 3 3 3M12 3 9 6M3 12l3-3M3 12l3 3M21 12l-3-3M21 12l-3 3M12 21l3-3M12 21l-3-3"/>',
    view3d: '<path d="M12 2.5 3.5 7v10L12 21.5 20.5 17V7z"/><path d="M12 11.5 3.5 7M12 11.5 20.5 7M12 11.5v10" opacity=".55"/>',
    orbit: '<circle cx="12" cy="12" r="4"/><ellipse cx="12" cy="12" rx="10" ry="4.5"/><ellipse cx="12" cy="12" rx="10" ry="4.5" transform="rotate(60 12 12)" opacity=".5"/>',
    vstyle: '<path d="M12 2.5 3.5 7v10L12 21.5 20.5 17V7z"/><path d="M12 11.5 20.5 7v10L12 21.5z" fill="currentColor" stroke="none" opacity=".45"/>',
    persp: '<path d="M2 20 9 6h6l7 14z"/><path d="M9 6 11 20M15 6l-2 14" opacity=".45"/>',
    plan: '<rect x="4" y="4" width="16" height="16"/><path d="M4 10h16M10 4v16" opacity=".5"/>',
    elev: '<path d="M4 20h16"/><path d="M12 17V4M8 8l4-4 4 4"/>',
    facetres: '<circle cx="12" cy="12" r="8.5"/><path d="M12 3.5 5.5 8v8l6.5 4.5 6.5-4.5V8z" opacity=".6"/>',
    tosolid: '<path d="M4 6h7v7H4z" stroke-dasharray="2 2"/><path d="m13 11 7-4v9l-7 4z"/><path d="M13 11 6 15v5h7" opacity=".5"/>',
    tomesh: '<path d="M3 8 12 3l9 5-9 5z"/><path d="M3 8v8l9 5 9-5V8" opacity=".55"/><path d="M7.5 5.5 16.5 10.5M16.5 5.5 7.5 10.5" opacity=".4"/>',
    check: '<circle cx="12" cy="12" r="9"/><path d="m8 12 3 3 5-6"/>',
    export3d: '<path d="M12 3 4.5 7v9L12 20l7.5-4V7z" opacity=".55"/><path d="M12 8v8M9 13l3 3 3-3"/>',
    import3d: '<path d="M12 3 4.5 7v9L12 20l7.5-4V7z" opacity=".55"/><path d="M12 16V8M9 11l3-3 3 3"/>',
    zoomext: '<rect x="3" y="3" width="18" height="18" stroke-dasharray="3 2"/><path d="M8 12h8M12 8v8"/>',
    /* --- CAM --- */
    stock: '<path d="M12 2.5 3.5 7v10L12 21.5 20.5 17V7z" stroke-dasharray="3 2"/><path d="M12 11.5 3.5 7M12 11.5 20.5 7M12 11.5v10" opacity=".4"/>',
    material: '<rect x="3" y="7" width="18" height="12" rx="1"/><path d="M3 11h18" opacity=".5"/><path d="M7 4h10" opacity=".6"/>',
    camcontour: '<path d="M5 19V8l7-4 7 4v11" stroke-dasharray="3 2" opacity=".6"/><path d="M3 21h18"/><circle cx="5" cy="8" r="2"/>',
    campocket: '<rect x="3" y="5" width="18" height="14"/><path d="M7 9h10v6H7z" stroke-dasharray="2 2"/><path d="M7 12h10" opacity=".5"/>',
    camface: '<path d="M3 15h18"/><path d="M5 11h14M5 7h14" opacity=".45"/><circle cx="7" cy="15" r="2.4"/>',
    camdrill: '<path d="M12 3v11"/><path d="m9 14 3 5 3-5z"/><path d="M4 21h16"/>',
    camengrave: '<path d="m5 19 3-9 9-3-3 9z"/><path d="m8 10 6 6" opacity=".5"/><path d="M3 21h18" opacity=".6"/>',
    camrough: '<path d="M3 18h18"/><path d="M5 14h14M7 10h10M9 6h6" opacity=".55"/><circle cx="5" cy="18" r="1.8"/>',
    camfinish: '<path d="M3 17c5-8 13-8 18 0"/><path d="M3 20c5-8 13-8 18 0" opacity=".45"/><circle cx="8" cy="13.4" r="1.6"/>',
    camlathe: '<path d="M3 12h18" stroke-dasharray="3 2"/><path d="M5 8h9l3 4-3 4H5z"/><path d="m19 15 2-3-2-3" opacity=".7"/>',
    camturn: '<path d="M3 12h18" stroke-dasharray="3 2"/><ellipse cx="9" cy="12" rx="5" ry="6"/><path d="m21 8-5 4 5 4"/>',
    camturnf: '<path d="M3 12h18" stroke-dasharray="3 2"/><ellipse cx="9" cy="12" rx="5" ry="6" opacity=".5"/><path d="M15 9 21 12l-6 3z"/>',
    camfacing: '<path d="M3 12h18" stroke-dasharray="3 2"/><path d="M8 5v14"/><path d="m14 7-3 5 3 5" opacity=".8"/>',
    camgroove: '<path d="M3 12h18" stroke-dasharray="3 2"/><path d="M4 7h16v10H4z" opacity=".5"/><path d="M11 7v4h2V7" fill="currentColor" stroke="none"/><path d="M11 7v4h2V7z"/>',
    camthread: '<path d="M3 12h18" stroke-dasharray="3 2"/><path d="M5 8h14v8H5z" opacity=".4"/><path d="M6 8 8 16M10 8l2 8M14 8l2 8"/>',
    camcutoff: '<path d="M3 12h18" stroke-dasharray="3 2"/><path d="M5 7h14v10H5z" opacity=".4"/><path d="M12 4v16" stroke-width="2.2"/>',
    camlist: '<path d="M4 6h16M4 12h16M4 18h10"/><circle cx="19" cy="18" r="1.6" opacity=".7"/>',
    camdel: '<path d="M5 7h14M9 7V5h6v2M7 7l1 13h8l1-13"/>',
    campost: '<rect x="3" y="5" width="18" height="12" rx="1.5"/><path d="M7 21h10M12 17v4"/><path d="M7 9h4M7 12h7" opacity=".65"/>',
    camgen: '<path d="M6 3h8l4 4v14H6z"/><path d="M14 3v4h4"/><path d="M9 12h6M9 16h4" opacity=".7"/>',
    camsheet: '<path d="M6 3h8l4 4v14H6z"/><path d="M14 3v4h4"/><path d="M9 11h6M9 14h6M9 17h3" opacity=".75"/>',
    camtools: '<path d="M12 3v9"/><path d="m9 12 3 6 3-6z"/><path d="M4 21h16" opacity=".6"/><circle cx="5" cy="6" r="2" opacity=".7"/><circle cx="19" cy="6" r="2" opacity=".7"/>',
    camsim: '<path d="M4 18h16"/><path d="m7 14 3-5 3 3 4-6" stroke-dasharray="3 2"/><circle cx="7" cy="14" r="1.6"/>',
    caments: '<path d="m4 17 4-7 4 4 4-8"/><circle cx="4" cy="17" r="1.4"/><circle cx="8" cy="10" r="1.4"/><circle cx="12" cy="14" r="1.4"/><circle cx="16" cy="6" r="1.4"/>'
  };
  function icon(name, cls) {
    var p = P[name] || P.point;
    return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" ' +
      'stroke-linecap="round" stroke-linejoin="round"' + (cls ? ' class="' + cls + '"' : '') + '>' + p + '</svg>';
  }
  CAD.icon = icon;

  /* ============================================================
     Definición de la cinta de opciones
     ============================================================ */
  var RIBBON = [
    {
      id: 'inicio', label: 'Inicio', panels: [
        {
          label: 'Dibujo', groups: [
            [{ cmd: 'LINEA', big: true }],
            [{ cmd: 'POL', big: true }],
            [{ cmd: 'CIRCULO', big: true, menu: ['CIRCULO|Centro, radio', 'CIRCULO 2P|2 puntos', 'CIRCULO 3P|3 puntos', 'CIRCULO T|Tan, tan, radio'] }],
            [{ cmd: 'ARCO', big: true, menu: ['ARCO|3 puntos', 'ARCO CE|Inicio, centro, fin'] }],
            [{ cmd: 'RECTANG' }, { cmd: 'POLIGONO' }, { cmd: 'ELIPSE', menu: ['ELIPSE|Ejes, fin', 'ELIPSE C|Centro', 'ELIPSE A|Arco elíptico'] }],
            [{ cmd: 'SPLINE' }, { cmd: 'ARANDELA' }, { cmd: 'PUNTO' }],
            [{ cmd: 'LINEAM', title: 'Multilínea' }, { cmd: 'CONTORNO' }, { cmd: 'DEGRADADO', icon: 'gradient' }],
            [{ cmd: 'CUBRIR' }, { cmd: 'REGION' }, { cmd: 'TABLA' }],
            [{ cmd: 'SOMBREA', big: true }],
            [{ cmd: 'NUBEREV', title: 'Nube' }, { cmd: 'LINEAX', title: 'Línea aux' }, { cmd: 'RAYO' }]
          ]
        },
        {
          label: 'Modificar', groups: [
            [{ cmd: 'DESPLAZA', big: true }],
            [{ cmd: 'COPIA', big: true }],
            [{ cmd: 'ESTIRA', big: true }],
            [{ cmd: 'GIRA' }, { cmd: 'SIMETRIA' }, { cmd: 'ESCALA' }],
            [{ cmd: 'RECORTA' }, { cmd: 'ALARGA' }, { cmd: 'DESFASE' }],
            [{ cmd: 'EMPALME' }, { cmd: 'CHAFLAN' }, { cmd: 'MATRIZ' }],
            [{ cmd: 'BORRA' }, { cmd: 'DESCOMP' }, { cmd: 'UNIR' }],
            [{ cmd: 'PARTE' }, { cmd: 'ALINEA' }, { cmd: 'EDITPOL', title: 'Editpol' }],
            [{ cmd: 'LONGITUD', title: 'Longitud' }, { cmd: 'ORDENAOBJETOS', icon: 'order', title: 'Orden' }, { cmd: 'EDITSOMB', title: 'Edit. somb.' }],
            [{ cmd: 'UNION', icon: 'boolean' }, { cmd: 'DIFERENCIA', icon: 'boolean' }, { cmd: 'INTERSEC', icon: 'boolean', title: 'Intersecar' }],
            [{ cmd: 'DEPURAR' }, { cmd: 'CAMBIA', title: 'Cambiar' }, { cmd: 'DEFINIRPORCAPA', icon: 'layer', title: 'Por capa' }]
          ]
        },
        {
          label: 'Anotación', groups: [
            [{ cmd: 'TEXTOM', big: true, title: 'Texto' }],
            [{ cmd: 'ACOTALINEAL', big: true, title: 'Cota', menu: ['ACOTALINEAL|Lineal', 'ACOTAALINEADA|Alineada', 'ACOTAANGULO|Angular', 'ACOTARADIO|Radio', 'ACOTADIAMETRO|Diámetro', 'ACOTALONGARCO|Longitud de arco', 'ACOTACOORDENADA|Coordenada', 'ACOTACONTINUA|Continua', 'ACOTALINEABASE|Línea base'] }],
            [{ cmd: 'DIRECTRIZ', big: true }],
            [{ cmd: 'TEXTO', title: 'Texto 1 línea' }, { cmd: 'EDITTEXTO', title: 'Editar texto' }, { cmd: 'ESTILO', title: 'Estilo texto' }],
            [{ cmd: 'ACOTARAPIDA', title: 'Cota rápida' }, { cmd: 'MARCACENTRO', title: 'Marca centro' }, { cmd: 'ESTILOCOTA', title: 'Estilo de cota' }]
          ]
        },
        {
          label: 'Capas', groups: [
            [{ cmd: 'CAPA', big: true }],
            [{ combo: 'layer' }, { row: [{ cmd: 'CAPAACT', title: '' }, { cmd: 'AISLACAPA', title: '' }, { cmd: 'DESACTCAPA', title: '' }, { cmd: 'ACTCAPAS', title: '' }, { cmd: 'BLOQUEACAPA', title: '' }] }]
          ]
        },
        {
          label: 'Propiedades', groups: [
            [{ cmd: 'PROPIEDADES', big: true }],
            [{ cmd: 'IGUALARPROP', big: true, title: 'Igualar' }],
            [{ combo: 'color' }, { combo: 'ltype' }, { combo: 'lweight' }]
          ]
        },
        {
          label: 'Bloque', groups: [
            [{ cmd: 'INSERT', big: true, title: 'Insertar' }],
            [{ cmd: 'BLOQUE', big: true, title: 'Crear' }],
            [{ cmd: 'PALETABLOQUES', title: 'Biblioteca' }, { cmd: 'ATRDEF', title: 'Atributo' }, { cmd: 'EDITATR', title: 'Editar atrib.' }]
          ]
        },
        {
          label: 'Utilidades', groups: [
            [{ cmd: 'DISTANCIA' }, { cmd: 'AREA' }, { cmd: 'LISTA' }],
            [{ cmd: 'ID', title: 'Coordenada' }, { cmd: 'DESIGNARAPIDO', title: 'Desig. rápida' }, { cmd: 'MEDIRGEOM', title: 'Medir' }],
            [{ cmd: 'GRUPO' }, { cmd: 'DESAGRUPA', icon: 'group', title: 'Desagrupar' }, { cmd: 'LIMPIA' }],
            [{ cmd: 'DESIGNASEMEJANTE', title: 'Semejantes' }, { cmd: 'AISLAROBJETOS', title: 'Aislar' }, { cmd: 'CALCRAPIDA', title: 'Calculadora' }]
          ]
        },
        {
          label: 'Portapapeles', groups: [
            [{ cmd: 'PEGARPP', big: true, title: 'Pegar' }],
            [{ cmd: 'COPIAPP', title: 'Copiar' }, { cmd: 'CORTARPP', title: 'Cortar' }]
          ]
        }
      ]
    },
    {
      id: 'insertar', label: 'Insertar', panels: [
        { label: 'Bloque', groups: [[{ cmd: 'INSERT', big: true, title: 'Insertar' }], [{ cmd: 'BLOQUE', big: true, title: 'Crear' }], [{ cmd: 'BLOQUEDISC', title: 'Guardar bloque' }, { cmd: 'DESCOMP' }]] },
        { label: 'Importar / exportar', groups: [[{ cmd: 'ABRE', big: true }], [{ cmd: 'EXPORTAR', big: true }]] },
        { label: 'Biblioteca', groups: [[{ cmd: 'PALETABLOQUES', big: true, title: 'Bloques' }]] },
        { label: 'Atributos', groups: [[{ cmd: 'ATRDEF', big: true, title: 'Definir' }], [{ cmd: 'EDITATR', big: true, title: 'Editar' }]] },
        { label: 'Datos', groups: [[{ cmd: 'DIVIDE' }, { cmd: 'GRADUA' }, { cmd: 'CONTORNO' }]] }
      ]
    },
    {
      id: 'anotar', label: 'Anotar', panels: [
        { label: 'Texto', groups: [[{ cmd: 'TEXTOM', big: true, title: 'Texto múlt.' }], [{ cmd: 'TEXTO', big: true, title: 'Texto' }], [{ cmd: 'EDITTEXTO', title: 'Editar' }, { cmd: 'ESCALATEXTO', icon: 'scale', title: 'Escalar' }, { cmd: 'JUSTIFICATEXTO', icon: 'align', title: 'Justificar' }], [{ cmd: 'BUSCAR', icon: 'find', title: 'Buscar' }, { cmd: 'TEXTOALFRENTE', icon: 'order', title: 'Al frente' }]] },
        { label: 'Tablas', groups: [[{ cmd: 'TABLA', big: true }]] },
        {
          label: 'Cotas', groups: [
            [{ cmd: 'ACOTALINEAL', big: true, title: 'Lineal' }],
            [{ cmd: 'ACOTAALINEADA', big: true, title: 'Alineada' }],
            [{ cmd: 'ACOTAANGULO', big: true, title: 'Angular' }],
            [{ cmd: 'ACOTARADIO', title: 'Radio' }, { cmd: 'ACOTADIAMETRO', title: 'Diámetro' }, { cmd: 'ACOTALONGARCO', title: 'Long. arco' }],
            [{ cmd: 'ACOTACONTINUA', title: 'Continua' }, { cmd: 'ACOTALINEABASE', title: 'Línea base' }, { cmd: 'ACOTACOORDENADA', title: 'Coordenada' }]
          ]
        },
        { label: 'Directrices', groups: [[{ cmd: 'DIRECTRIZ', big: true }]] },
        { label: 'Edición', groups: [[{ cmd: 'ACOTARAPIDA', big: true, title: 'Cota rápida' }], [{ cmd: 'MARCACENTRO', big: true, title: 'M. centro' }], [{ cmd: 'ACOTAEDIC', icon: 'dimstyle', title: 'Editar cota' }, { cmd: 'ACOTATEDIC', icon: 'dimstyle', title: 'Mover texto' }, { cmd: 'ACOTASALTO', icon: 'dimrad', title: 'Salto' }]] },
        { label: 'Estilos', groups: [[{ cmd: 'ESTILOCOTA', big: true, title: 'Estilo cota' }], [{ cmd: 'ESTILO', big: true, title: 'Estilo texto' }], [{ cmd: 'ACTCOTA', title: 'Actualizar' }]] }
      ]
    },
    {
      id: 'ver', label: 'Ver', panels: [
        {
          label: 'Navegar', groups: [
            [{ cmd: 'ZOOM E', big: true, icon: 'zoomext', title: 'Extensión' }],
            [{ cmd: 'ENCUADRE', big: true }],
            [{ cmd: 'ZOOM V', icon: 'zoomwin', title: 'Ventana' }, { cmd: 'ZOOM P', icon: 'zoomprev', title: 'Previo' }, { cmd: 'ZOOM T', icon: 'zoom', title: 'Todo' }]
          ]
        },
        { label: 'Paletas', groups: [[{ cmd: 'PROPIEDADES', big: true }], [{ cmd: 'CAPA', big: true }], [{ cmd: 'RECORRERCAPAS', icon: 'layer', title: 'Recorrer capas' }]] },
        { label: 'Coordenadas', groups: [[{ cmd: 'SCP', big: true }], [{ cmd: 'SCPGLOBAL', icon: 'ucs', title: 'SCP global' }, { cmd: 'VISTA', title: 'Vistas' }]] },
        { label: 'Visibilidad', groups: [[{ cmd: 'AISLAROBJETOS', big: true, title: 'Aislar' }], [{ cmd: 'OCULTAROBJETOS', big: true, icon: 'view', title: 'Ocultar' }], [{ cmd: 'FINAISLAR', icon: 'view', title: 'Mostrar todo' }]] },
        { label: 'Espacio de trabajo', groups: [[{ cmd: 'MODELADO3D', big: true, icon: 'view3d', title: 'Modelado 3D' }], [{ cmd: 'DIBUJO2D', big: true, icon: 'plan', title: 'Dibujo 2D' }]] },
        { label: 'Interfaz', groups: [[{ cmd: 'LIMPIAPANTALLA', title: 'Pantalla limpia' }, { cmd: 'REGEN' }, { cmd: 'OPCIONES' }]] }
      ]
    },
    {
      id: 'presentacion', label: 'Presentación', panels: [
        {
          label: 'Ventanas gráficas', groups: [
            [{ cmd: 'VENTANAS', big: true, title: 'Ventana' }],
            [{ cmd: 'ESCALAVP', big: true, icon: 'lock', title: 'Escala' }],
            [{ cmd: 'ESPACIOM', icon: 'model', title: 'Esp. modelo' }, { cmd: 'ESPACIOP', icon: 'layout', title: 'Esp. papel' }]
          ]
        },
        {
          label: 'Presentación', groups: [
            [{ cmd: 'PRESENTACION', big: true, title: 'Presentac.' }],
            [{ cmd: 'CONFIGPAG', big: true, icon: 'settings', title: 'Config. pág.' }],
            [{ cmd: 'CAJETIN', big: true, title: 'Cajetín' }]
          ]
        },
        { label: 'Trazar', groups: [[{ cmd: 'TRAZAR', big: true }], [{ cmd: 'EXPORTAPDF', big: true, title: 'PDF' }]] }
      ]
    },
    {
      id: 'administrar', label: 'Administrar', panels: [
        { label: 'Dibujo', groups: [[{ cmd: 'LIMPIA', big: true }], [{ cmd: 'UNIDADES', big: true }], [{ cmd: 'AUDITORIA', icon: 'audit', title: 'Auditoría' }, { cmd: 'RENOMBRA', icon: 'textedit', title: 'Renombrar' }, { cmd: 'PLANTILLA', title: 'Plantilla' }]] },
        { label: 'Consulta', groups: [[{ cmd: 'ESTADO', icon: 'list', title: 'Estado' }, { cmd: 'TIEMPO', icon: 'clock', title: 'Tiempo' }, { cmd: 'CARGAPAT', icon: 'hatch', title: 'Cargar .pat' }], [{ cmd: 'CALCRAPIDA', title: 'Calculadora' }, { cmd: 'DEPURAR', title: 'Depurar' }, { cmd: 'PUNTOBASE', icon: 'point', title: 'Punto base' }]] },
        { label: 'Parámetros', groups: [[{ cmd: 'OPCIONES', big: true }], [{ cmd: 'PARAMDIB', title: 'Param. dibujo' }, { cmd: 'REFENT', title: 'Referencias' }, { cmd: 'MODIVAR', title: 'Variables' }]] }
      ]
    },
    {
      id: 'modelado', label: 'Modelado 3D', panels: [
        { label: 'Espacio', groups: [[{ cmd: 'DIBUJO2D', big: true, icon: 'plan', title: 'Volver a 2D' }]] },
        {
          label: 'Primitivas', groups: [
            [{ cmd: 'PRISMARECT', big: true, title: 'Prisma' }],
            [{ cmd: 'CILINDRO', big: true }],
            [{ cmd: 'ESFERA' }, { cmd: 'CONO' }, { cmd: 'TOROIDE' }],
            [{ cmd: 'CUNA', title: 'Cuña' }, { cmd: 'PIRAMIDE' }, { cmd: 'ELEV', title: 'Elevación' }]
          ]
        },
        {
          label: 'Crear', groups: [
            [{ cmd: 'EXTRUSION', big: true }],
            [{ cmd: 'REVOLUCION', big: true }],
            [{ cmd: 'BARRIDO' }, { cmd: 'SOLEVADO' }, { cmd: 'PULSARTIRAR', title: 'Pulsar/tirar' }],
            [{ cmd: 'TALADRO', icon: 'hole', big: true, title: 'Taladro' }],
            [{ cmd: 'SALIENTE', title: 'Saliente' }, { cmd: 'PLANOTRABAJO', icon: 'plane', title: 'Plano de trabajo' }]
          ]
        },
        {
          label: 'Superficies y mallas', groups: [
            [{ cmd: 'SUPERFICIEREGLA', big: true, title: 'Reglada' }],
            [{ cmd: 'SUPERFICIEARISTA', big: true, title: 'De arista' }],
            [{ cmd: 'SUPERFICIETAB', title: 'Tabulada' }, { cmd: 'SUPERFICIEREVOL', title: 'De revolución' }, { cmd: 'SUPERFICIEPLANA', title: 'Plana' }],
            [{ cmd: 'MALLA', title: 'Primitiva de malla' }, { cmd: 'APLANAROBJETOS', title: 'Aplanar' }, { cmd: 'VISTAS2D', title: 'Tres vistas' }]
          ]
        },
        {
          label: 'Booleanos', groups: [
            [{ cmd: 'UNION3D', big: true, title: 'Unión' }],
            [{ cmd: 'DIFERENCIA3D', big: true, title: 'Diferencia' }],
            [{ cmd: 'INTERSEC3D', title: 'Intersecar' }, { cmd: 'INTERF', title: 'Interferencia' }, { cmd: 'CORTE', title: 'Cortar' }]
          ]
        },
        {
          label: 'Editar sólido', groups: [
            [{ cmd: 'DESPLAZA3D', title: 'Desplazar' }, { cmd: 'GIRA3D', title: 'Girar' }, { cmd: 'SIMETRIA3D', title: 'Simetría' }],
            [{ cmd: 'MATRIZ3D', title: 'Matriz' }, { cmd: 'ALINEAR3D', title: 'Alinear' }, { cmd: 'ENGROSAR' }],
            [{ cmd: 'SECCION3D', title: 'Sección' }, { cmd: 'SOLPERFIL', title: 'Perfil plano' }, { cmd: 'SUAVIZARMALLA', title: 'Suavizar' }],
            [{ cmd: 'ARBOL', icon: 'tree', title: 'Árbol de operaciones' }, { cmd: 'PROPFIS', title: 'Prop. físicas' }, { cmd: 'COMPROBARSOLIDO', title: 'Comprobar' }],
            [{ cmd: 'FACETRES', title: 'Resolución' }],
            [{ cmd: 'CONVERTIRENSOLIDO', title: 'A sólido' }, { cmd: 'CONVERTIRENMALLA', title: 'A malla' }]
          ]
        },
        {
          label: 'Vista', groups: [
            [{ cmd: 'ORBITA', big: true, title: 'Órbita' }],
            [{ cmd: 'ESTILOVISUAL', big: true, title: 'Estilo visual',
               menu: ['ESTILOVISUAL ESTRUCTURA|Estructura alámbrica', 'ESTILOVISUAL OCULTA|Oculto',
                      'ESTILOVISUAL SOMBREADO|Sombreado', 'ESTILOVISUAL ARISTASSOMBRA|Sombreado con aristas',
                      'ESTILOVISUAL CONCEPTUAL|Conceptual', 'ESTILOVISUAL REALISTA|Realista',
                      'ESTILOVISUAL GRISES|Tonos de gris', 'ESTILOVISUAL BOCETO|Boceto',
                      'ESTILOVISUAL RAYOSX|Rayos X'] }],
            [{ cmd: 'SWISO', title: 'Iso SO' }, { cmd: 'SEISO', title: 'Iso SE' }, { cmd: 'NEISO', title: 'Iso NE' }],
            [{ cmd: 'SUPERIOR' }, { cmd: 'FRONTAL' }, { cmd: 'DERECHA' }],
            [{ cmd: 'PERSPECTIVA' }, { cmd: 'ZOOM3D', title: 'Zoom ext.' }, { cmd: 'PLANTA2D', title: 'Volver a 2D' }]
          ]
        },
        {
          label: 'Intercambio', groups: [
            [{ cmd: 'EXPORTA3D', big: true, title: 'Exportar 3D',
               menu: ['EXPORTA3D STL|STL (impresión 3D)', 'EXPORTA3D OBJ|Wavefront OBJ',
                      'EXPORTA3D PLY|Stanford PLY', 'EXPORTA3D 3MF|3MF', 'EXPORTA3D GLTF|glTF 2.0',
                      'EXPORTA3D GLB|glTF binario', 'EXPORTA3D OFF|OFF', 'EXPORTA3D AMF|AMF',
                      'EXPORTA3D VRML|VRML', 'EXPORTA3D X3D|X3D'] }],
            [{ cmd: 'IMPORTA3D', big: true, title: 'Importar 3D' }]
          ]
        }
      ]
    },
    {
      id: 'cam', label: 'Fabricación', panels: [
        {
          label: 'Preparación', groups: [
            [{ cmd: 'CAMBRUTO', big: true, title: 'Bruto' }],
            [{ cmd: 'CAMHERRAMIENTAS', big: true, title: 'Herramientas' }],
            [{ cmd: 'CAMMATERIAL', title: 'Material' }, { cmd: 'CAMCONTROL', title: 'Control CN' }]
          ]
        },
        {
          label: 'Fresado 2.5D', groups: [
            [{ cmd: 'CAMCONTORNO', big: true, title: 'Contorneado' }],
            [{ cmd: 'CAMVACIADO', big: true, title: 'Vaciado' }],
            [{ cmd: 'CAMTALADRO', big: true, title: 'Taladrado' }],
            [{ cmd: 'CAMPLANEADO', title: 'Planeado' }, { cmd: 'CAMGRABADO', title: 'Grabado' }]
          ]
        },
        {
          label: 'Fresado 3D', groups: [
            [{ cmd: 'CAMDESBASTE', big: true, title: 'Desbaste' }],
            [{ cmd: 'CAMACABADO', big: true, title: 'Acabado' }]
          ]
        },
        {
          label: 'Torneado', groups: [
            [{ cmd: 'CAMPERFILTORNO', big: true, title: 'Perfil' }],
            [{ cmd: 'CAMCILINDRAR', title: 'Cilindrar' }, { cmd: 'CAMACABADOTORNO', title: 'Acabar' }, { cmd: 'CAMREFRENTAR', title: 'Refrentar' }],
            [{ cmd: 'CAMRANURAR', title: 'Ranurar' }, { cmd: 'CAMROSCAR', title: 'Roscar' }, { cmd: 'CAMTRONZAR', title: 'Tronzar' }]
          ]
        },
        {
          label: 'Salida CN', groups: [
            [{ cmd: 'CAMGENERAR', big: true, title: 'Generar CN' }],
            [{ cmd: 'CAMLISTA', title: 'Operaciones' }, { cmd: 'CAMSIMULAR', title: 'Ver trayect.' }, { cmd: 'CAMHOJA', title: 'Hoja prep.' }],
            [{ cmd: 'CAMAENTIDADES', title: 'A entidades' }, { cmd: 'CAMBORRAOP', title: 'Borrar op.' }]
          ]
        }
      ]
    },
    {
      id: 'salida', label: 'Salida', panels: [
        { label: 'Trazar', groups: [[{ cmd: 'TRAZAR', big: true }]] },
        { label: 'Exportar', groups: [[{ cmd: 'EXPORTAR', big: true }], [{ cmd: 'GUARDARCOMO', big: true, title: 'Guardar como' }], [{ cmd: 'GUARDAR', title: 'Guardar DXF' }, { cmd: 'BLOQUEDISC', title: 'Escribir bloque' }, { cmd: 'EXPORTAPDF', title: 'PDF' }]] }
      ]
    }
  ];

  /* ============================================================
     Barra de estado
     ============================================================ */
  var TOGGLES = [
    { key: 'GRIDMODE', icon: 'grid', label: 'Rejilla', kbd: 'F7' },
    { key: 'SNAPMODE', icon: 'snapg', label: 'Forzar cursor', kbd: 'F9' },
    { key: 'ORTHOMODE', icon: 'ortho', label: 'Orto', kbd: 'F8' },
    { key: 'POLARMODE', icon: 'polar', label: 'Rastreo polar', kbd: 'F10' },
    { key: 'OSNAP', icon: 'osnap', label: 'Referencia a objetos', kbd: 'F3' },
    { key: 'OTRACK', icon: 'otrack', label: 'Rastreo de referencia a objetos', kbd: 'F11' },
    { key: 'DYNMODE', icon: 'dyn', label: 'Entrada dinámica', kbd: 'F12' },
    { key: 'LWDISPLAY', icon: 'lwt', label: 'Mostrar grosor de línea' },
    { key: 'SELECTIONCYCLING', icon: 'cycle', label: 'Ciclo de selección' },
    { key: 'CLEAN', icon: 'clean', label: 'Pantalla limpia', kbd: 'Ctrl+0' }
  ];

  /* ============================================================
     Clase UI
     ============================================================ */
  function UI(app) {
    this.app = app;
    this.el = {};
    this.activeTab = 'inicio';
    this.histLines = 0;
    this.acIndex = -1;
    this.acItems = [];
    this.cmdHistory = [];
    this.cmdHistIdx = -1;
  }
  CAD.UI = UI;

  UI.prototype.init = function () {
    var self = this, app = this.app;
    var $ = function (id) { return document.getElementById(id); };
    this.el = {
      app: $('app'), tabs: $('ribbonTabs'), ribbon: $('ribbon'), qat: $('qat'),
      hist: $('cmdhist'), prompt: $('prompt'), input: $('cmdinput'), autocomp: $('autocomp'),
      coords: $('coords'), toggles: $('statusToggles'), palettes: $('palettes'),
      modal: $('modalRoot'), docTitle: $('docTitle'), entCount: $('entCount'),
      navbar: $('navbar'), layoutTabs: $('layoutTabs'), dynin: $('dynin'),
      dynA: $('dynA'), dynB: $('dynB'), dynSep: $('dynSep'), dynTip: $('dynTip'),
      snapTip: $('snapTip'), toast: $('toast'), search: $('searchBox'),
      scaleLabel: $('scaleLabel'), file: $('fileInput'), ws: $('wsBtn'),
      rbPrev: $('rbPrev'), rbNext: $('rbNext')
    };
    this.buildQAT();
    this.buildRibbon();
    this.buildStatus();
    this.buildNavbar();
    this.buildLayoutTabs();
    this.wireCommandLine();

    $('appMenuBtn').addEventListener('click', function (e) { self.appMenu(e.currentTarget); });
    $('btnHelp').addEventListener('click', function () { self.helpDialog(); });
    $('viewcube').addEventListener('click', function () { app.startCommand('ZOOM', ['E']); });
    $('scaleLabel').addEventListener('click', function (e) { self.scaleMenu(e.currentTarget); });
    if (this.el.ws) this.el.ws.addEventListener('click', function (e) { self.wsMenu(e.currentTarget); });
    this.wireRibbonScroll();
    $('scaleLabel').style.cursor = 'pointer';
    $('cmdwin').addEventListener('contextmenu', function (e) {
      e.preventDefault();
      self.recentMenu(e.clientX, e.clientY);
    });
    this.el.search.addEventListener('keydown', function (e) {
      if (e.key === 'Enter') { app.exec(self.el.search.value); self.el.search.value = ''; self.el.input.focus(); }
    });
    this.syncStatus();
  };

  /* ---------- Acceso rápido ---------- */
  UI.prototype.buildQAT = function () {
    var self = this;
    var items = [
      ['NUEVO', 'new', 'Nuevo'], ['ABRE', 'open', 'Abrir'], ['GUARDAR', 'save', 'Guardar'],
      ['EXPORTAR', 'export', 'Exportar'], ['TRAZAR', 'plot', 'Trazar'],
      ['H', 'undo', 'Deshacer'], ['REHACER', 'redo', 'Rehacer']
    ];
    this.el.qat.innerHTML = items.map(function (it) {
      return '<button class="tbtn" data-cmd="' + it[0] + '" title="' + it[2] + '" aria-label="' + it[2] + '">' + icon(it[1]) + '</button>';
    }).join('');
    this.el.qat.addEventListener('click', function (e) {
      var b = e.target.closest('[data-cmd]');
      if (b) self.run(b.dataset.cmd);
    });
  };

  UI.prototype.run = function (spec) {
    var parts = String(spec).split(' ');
    this.app.startCommand(parts[0], parts.slice(1));
    this.el.input.focus();
  };

  /* ---------- Desplazamiento lateral de la cinta ----------
     Con la ventana estrecha los últimos paneles quedaban fuera y no
     había forma de llegar a ellos: la barra de desplazamiento del
     navegador no se ve sobre un contenedor de esta altura. */
  UI.prototype.wireRibbonScroll = function () {
    var self = this, rb = this.el.ribbon;
    if (!rb || this._rbScroll) return;
    this._rbScroll = true;
    rb.addEventListener('wheel', function (e) {
      if (e.deltaY === 0 || rb.scrollWidth <= rb.clientWidth + 1) return;
      e.preventDefault();
      rb.scrollLeft += (Math.abs(e.deltaX) > Math.abs(e.deltaY) ? e.deltaX : e.deltaY);
      self.syncRibbonScroll();
    }, { passive: false });
    rb.addEventListener('scroll', function () { self.syncRibbonScroll(); });
    function pasa(d) {
      return function () {
        var p = rb.querySelector('.rpanel');
        rb.scrollLeft += d * Math.max(160, p ? p.offsetWidth : 200);
        self.syncRibbonScroll();
      };
    }
    if (this.el.rbPrev) this.el.rbPrev.addEventListener('click', pasa(-1));
    if (this.el.rbNext) this.el.rbNext.addEventListener('click', pasa(1));
    window.addEventListener('resize', function () { self.syncRibbonScroll(); });
  };
  UI.prototype.syncRibbonScroll = function () {
    var rb = this.el.ribbon, a = this.el.rbPrev, b = this.el.rbNext;
    if (!rb || !a || !b) return;
    var sobra = rb.scrollWidth - rb.clientWidth > 2 && !rb.classList.contains('collapsed');
    a.hidden = !sobra || rb.scrollLeft <= 1;
    b.hidden = !sobra || rb.scrollLeft >= rb.scrollWidth - rb.clientWidth - 1;
  };

  /* ---------- Cinta ---------- */
  UI.prototype.buildRibbon = function () {
    var self = this;
    this.el.tabs.innerHTML = RIBBON.map(function (t) {
      return '<button class="rtab' + (t.id === self.activeTab ? ' active' : '') + '" role="tab" data-tab="' + t.id + '">' + t.label + '</button>';
    }).join('');
    /* Asignación, no addEventListener: buildRibbon se vuelve a llamar en
       cada cambio de pestaña y al entrar o salir del 3D.  Enganchando el
       oyente se duplicaban en cada pasada (1, 2, 4, 8... reconstrucciones
       por clic) y la cinta acababa bloqueando la aplicación. */
    this.el.tabs.onclick = function (e) {
      var b = e.target.closest('[data-tab]');
      if (!b) return;
      self.activeTab = b.dataset.tab;
      self.buildRibbon();
      self.el.input.focus();
    };
    this.el.tabs.ondblclick = function () {
      self.el.ribbon.classList.toggle('collapsed');
      self.syncRibbonScroll();
      self.app.resize && self.app.resize();
    };

    var tab = RIBBON.filter(function (t) { return t.id === self.activeTab; })[0] || RIBBON[0];
    var html = '';
    tab.panels.forEach(function (p) {
      html += '<div class="rpanel"><div class="rpanel-body">';
      p.groups.forEach(function (g) {
        html += '<div class="rgroup">';
        g.forEach(function (it) { html += self.ribbonItem(it); });
        html += '</div>';
      });
      html += '</div><div class="rpanel-title">' + p.label + '</div></div>';
    });
    this.el.ribbon.innerHTML = html;
    this.el.ribbon.scrollLeft = 0;
    this.syncRibbonScroll();
    this.el.ribbon.onclick = function (e) {
      var m = e.target.closest('[data-menu]');
      if (m) { self.flyout(m, JSON.parse(m.dataset.menu)); return; }
      var c = e.target.closest('[data-combo]');
      if (c) { self.comboMenu(c, c.dataset.combo); return; }
      var b = e.target.closest('[data-cmd]');
      if (b) self.run(b.dataset.cmd);
    };
    this.syncPropBar();
  };

  UI.prototype.ribbonItem = function (it) {
    var self = this;
    if (it.row) return '<div class="rgroup row">' + it.row.map(function (x) { return self.ribbonItem(x); }).join('') + '</div>';
    if (it.combo) return this.comboHTML(it.combo);
    var spec = it.cmd, name = spec.split(' ')[0];
    var def = Cmd.reg[name] || Cmd.find(name);
    var label = it.title !== undefined ? it.title : ((def && def.title) || name);
    var full = (def && def.title) || name;
    var ic = it.icon || (def && def.icon) || 'point';
    var hasMenu = !!it.menu;
    var tip = full + ' (' + name + ')';
    return '<button class="rbtn' + (it.big ? ' big' : '') + '" title="' + tip + '" ' +
      (hasMenu ? 'data-menu=\'' + JSON.stringify(it.menu).replace(/'/g, '&#39;') + '\'' : 'data-cmd="' + spec + '"') +
      '>' + icon(ic) + (label ? '<span>' + label + '</span>' : '') + (hasMenu ? '<span class="caret">▼</span>' : '') + '</button>';
  };

  UI.prototype.comboHTML = function (kind) {
    if (kind === 'layer') {
      return '<div class="rcombo" data-combo="layer" title="Capa actual"><span class="swatch" id="cbLayerSw"></span><span class="label" id="cbLayer">0</span><span class="caret">▼</span></div>';
    }
    if (kind === 'color') {
      return '<div class="rcombo" data-combo="color" title="Color de objeto"><span class="swatch" id="cbColorSw"></span><span class="label" id="cbColor">PorCapa</span><span class="caret">▼</span></div>';
    }
    if (kind === 'ltype') {
      return '<div class="rcombo" data-combo="ltype" title="Tipo de línea"><svg class="lticon" id="cbLtIcon" viewBox="0 0 46 10"></svg><span class="label" id="cbLt">PorCapa</span><span class="caret">▼</span></div>';
    }
    return '<div class="rcombo" data-combo="lweight" title="Grosor de línea"><svg class="lticon" id="cbLwIcon" viewBox="0 0 46 10"></svg><span class="label" id="cbLw">PorCapa</span><span class="caret">▼</span></div>';
  };

  UI.prototype.syncPropBar = function () {
    var doc = this.app.doc;
    var l = doc.layer(doc.vars.CLAYER);
    var set = function (id, fn) { var e = document.getElementById(id); if (e) fn(e); };
    set('cbLayer', function (e) { e.textContent = l.name; });
    set('cbLayerSw', function (e) { e.style.background = G.aciCSS(l.color); });
    var c = doc.vars.CECOLOR;
    set('cbColor', function (e) { e.textContent = c === 256 ? 'PorCapa' : c === 0 ? 'PorBloque' : 'Color ' + c; });
    set('cbColorSw', function (e) { e.style.background = G.aciCSS(c === 256 ? l.color : c); });
    set('cbLt', function (e) { e.textContent = doc.vars.CELTYPE === 'ByLayer' ? 'PorCapa' : doc.vars.CELTYPE; });
    set('cbLtIcon', function (e) { e.innerHTML = ltPreview(doc, doc.vars.CELTYPE === 'ByLayer' ? l.ltype : doc.vars.CELTYPE); });
    var lw = doc.vars.CELWEIGHT;
    set('cbLw', function (e) { e.textContent = lw === -1 ? 'PorCapa' : lw === -3 ? 'Por defecto' : (lw / 100).toFixed(2) + ' mm'; });
    set('cbLwIcon', function (e) {
      var w = lw > 0 ? Math.max(1, lw / 40) : 1;
      e.innerHTML = '<line x1="2" y1="5" x2="44" y2="5" stroke="currentColor" stroke-width="' + w + '"/>';
    });
    var ec = this.el.entCount;
    if (ec) ec.textContent = this.app.doc.entities.length + ' objetos';
    var sl = this.el.scaleLabel;
    if (sl) sl.textContent = this.app.doc.vars.CANNOSCALE || '1:1';
  };

  function ltPreview(doc, name) {
    var lt = doc.ltypes[name];
    var dash = lt && lt.pat && lt.pat.length ? lt.pat.map(function (v) { return Math.max(0.6, Math.abs(v) / 2.2); }).join(',') : '';
    return '<line x1="2" y1="5" x2="44" y2="5" stroke="currentColor" stroke-width="1.2"' + (dash ? ' stroke-dasharray="' + dash + '"' : '') + '/>';
  }

  /* ---------- Barra de estado ---------- */
  UI.prototype.buildStatus = function () {
    var self = this;
    this.el.toggles.innerHTML = TOGGLES.map(function (t) {
      return '<button class="stog" data-tog="' + t.key + '" title="' + t.label + (t.kbd ? ' (' + t.kbd + ')' : '') + '" aria-label="' + t.label + '">' + icon(t.icon) + '</button>';
    }).join('');
    this.el.toggles.addEventListener('click', function (e) {
      var b = e.target.closest('[data-tog]');
      if (!b) return;
      self.toggle(b.dataset.tog);
    });
    this.el.toggles.addEventListener('contextmenu', function (e) {
      var b = e.target.closest('[data-tog]');
      if (!b) return;
      e.preventDefault();
      var k = b.dataset.tog;
      if (k === 'OSNAP') self.settingsDialog('osnap');
      else if (k === 'GRIDMODE' || k === 'SNAPMODE') self.settingsDialog('snap');
      else if (k === 'POLARMODE') self.settingsDialog('polar');
      else if (k === 'DYNMODE') self.settingsDialog('dyn');
    });
  };

  UI.prototype.toggle = function (key) {
    var app = this.app, v = app.doc.vars;
    if (key === 'OSNAP') { app.osnapOn = !app.osnapOn; app.out('<Refent ' + (app.osnapOn ? 'activado' : 'desactivado') + '>'); }
    else if (key === 'CLEAN') { this.toggleCleanScreen(); }
    else if (key === 'OTRACK') {
      v.OTRACK = v.OTRACK ? 0 : 1;
      if (!v.OTRACK && CAD.Track) CAD.Track.clear();
      app.out('<Rastreo de referencia ' + (v.OTRACK ? 'activado' : 'desactivado') + '>');
    }
    else if (key === 'SELECTIONCYCLING') {
      v.SELECTIONCYCLING = v.SELECTIONCYCLING ? 0 : 2;
      app.out('<Ciclo de selección ' + (v.SELECTIONCYCLING ? 'activado' : 'desactivado') + '>');
    }
    else {
      v[key] = v[key] ? 0 : 1;
      var names = { GRIDMODE: 'Rejilla', SNAPMODE: 'Forzcursor', ORTHOMODE: 'Orto', POLARMODE: 'Polar', DYNMODE: 'Dinámico', LWDISPLAY: 'Grosor' };
      if (names[key]) app.out('<' + names[key] + ' ' + (v[key] ? 'activado' : 'desactivado') + '>');
    }
    this.syncStatus();
    app.refresh();
  };

  UI.prototype.syncStatus = function () {
    var v = this.app.doc.vars, app = this.app;
    var st = {
      GRIDMODE: v.GRIDMODE, SNAPMODE: v.SNAPMODE, ORTHOMODE: v.ORTHOMODE,
      POLARMODE: v.POLARMODE, OSNAP: app.osnapOn ? 1 : 0, OTRACK: v.OTRACK,
      DYNMODE: v.DYNMODE, LWDISPLAY: v.LWDISPLAY, SELECTIONCYCLING: v.SELECTIONCYCLING,
      CLEAN: app.cleanScreen ? 1 : 0
    };
    Array.prototype.forEach.call(this.el.toggles.children, function (b) {
      b.classList.toggle('on', !!st[b.dataset.tog]);
    });
    this.syncWorkspace();
    this.syncPropBar();
  };

  UI.prototype.setCoords = function (p) {
    var pr = Math.min(4, this.app.doc.vars.LUPREC);
    /* la cota Z se muestra de verdad: en 3D era siempre 0 y no había
       forma de saber a qué altura estaba el punto capturado */
    var z = (p && typeof p.z === 'number' && isFinite(p.z)) ? p.z : 0;
    this.el.coords.textContent = G.fmt(p.x, pr) + ', ' + G.fmt(p.y, pr) + ', ' + G.fmt(z, pr);
  };

  UI.prototype.toggleCleanScreen = function () {
    var app = this.app;
    app.cleanScreen = !app.cleanScreen;
    this.el.ribbon.style.display = app.cleanScreen ? 'none' : '';
    this.el.tabs.style.display = app.cleanScreen ? 'none' : '';
    this.el.palettes.style.display = app.cleanScreen ? 'none' : '';
    this.syncStatus();
    setTimeout(function () { app.resize(); }, 10);
  };

  /* ---------- Barra de navegación ---------- */
  UI.prototype.buildNavbar = function () {
    var self = this;
    var items = [['ENCUADRE', 'pan', 'Encuadre'], ['ZOOM', 'zoom', 'Zoom en tiempo real'], ['ZOOM V', 'zoomwin', 'Zoom ventana'], ['ZOOM E', 'zoomext', 'Zoom extensión'], ['ZOOM P', 'zoomprev', 'Zoom previo']];
    this.el.navbar.innerHTML = items.map(function (i) {
      return '<button data-cmd="' + i[0] + '" title="' + i[2] + '" aria-label="' + i[2] + '">' + icon(i[1]) + '</button>';
    }).join('');
    this.el.navbar.addEventListener('click', function (e) {
      var b = e.target.closest('[data-cmd]');
      if (b) self.run(b.dataset.cmd);
    });
  };

  UI.prototype.buildLayoutTabs = function () {
    var self = this, app = this.app;
    var tabs = ['Modelo'].concat(app.doc.layouts.map(function (l) { return l.name; }));
    this.el.layoutTabs.innerHTML = tabs.map(function (t, i) {
      return '<button class="ltab' + ((app.layoutIndex === i - 1 || (i === 0 && app.layoutIndex === -1)) ? ' active' : '') + '" data-lt="' + (i - 1) + '">' + t + '</button>';
    }).join('');
    this.el.layoutTabs.onclick = function (e) {
      var b = e.target.closest('[data-lt]');
      if (!b) return;
      app.setLayout(parseInt(b.dataset.lt, 10));
      self.buildLayoutTabs();
    };
  };

  /* ============================================================
     Línea de comandos
     ============================================================ */
  UI.prototype.log = function (msg, cls) {
    var d = document.createElement('div');
    if (cls) d.className = cls;
    d.textContent = msg;
    this.el.hist.appendChild(d);
    this.histLines++;
    if (this.histLines > 500) { this.el.hist.removeChild(this.el.hist.firstChild); this.histLines--; }
    this.el.hist.scrollTop = this.el.hist.scrollHeight;
  };

  function escHtml(t) {
    return String(t).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  UI.prototype.setPrompt = function (s) {
    var el = this.el.prompt;
    this.promptRaw = s;
    var m = /^([\s\S]*?)(?:\[([^\]]*)\])?(?:\s*<([^>]*)>)?(:\s*)$/.exec(s);
    if (!m || (!m[2] && !m[3])) {
      el.textContent = s;
    } else {
      var html = escHtml(m[1]);
      if (m[2]) {
        html += '[' + m[2].split('/').map(function (k) {
          return '<span class="kwlink" data-kw="' + escHtml(k) + '">' + escHtml(k) + '</span>';
        }).join('/') + ']';
      }
      if (m[3]) html += ' &lt;<span class="kwlink" data-kw="\u0000def">' + escHtml(m[3]) + '</span>&gt;';
      html += escHtml(m[4]);
      el.innerHTML = html;
    }
    if (this.app.doc.vars.DYNMODE) this.updateDyn();
  };

  UI.prototype.setActiveCommand = function (name) {
    document.getElementById('cmdIcon').textContent = name ? '▪' : '▸';
  };

  UI.prototype.wireCommandLine = function () {
    var self = this, app = this.app, inp = this.el.input;
    inp.addEventListener('keydown', function (e) {
      if (e.key === 'Enter') {
        e.preventDefault();
        if (self.acIndex >= 0 && self.acItems[self.acIndex]) {
          inp.value = self.acItems[self.acIndex].alias;
          self.hideAC();
        }
        var t = inp.value;
        inp.value = '';
        self.hideAC();
        if (t.trim()) {
          self.cmdHistory.push(t); self.cmdHistIdx = self.cmdHistory.length;
          app.feedInput(t);
        } else app.feedEnter();
        return;
      }
      if (e.key === ' ' && !inp.value.includes(' ') && !app.expectingText()) {
        e.preventDefault();
        var t2 = inp.value; inp.value = ''; self.hideAC();
        if (t2.trim()) {
          self.cmdHistory.push(t2); self.cmdHistIdx = self.cmdHistory.length;
          app.feedInput(t2);
        } else app.feedEnter();
        return;
      }
      if (e.key === 'Escape') { e.preventDefault(); inp.value = ''; self.hideAC(); app.cancel(); return; }
      if (e.key === 'Tab' && self.acItems.length) {
        e.preventDefault();
        self.acIndex = (self.acIndex + (e.shiftKey ? -1 : 1) + self.acItems.length) % self.acItems.length;
        self.renderAC();
        return;
      }
      if (e.key === 'ArrowDown') {
        if (self.acItems.length) { e.preventDefault(); self.acIndex = Math.min(self.acIndex + 1, self.acItems.length - 1); self.renderAC(); }
        else if (self.cmdHistory.length) {
          e.preventDefault();
          self.cmdHistIdx = Math.min(self.cmdHistIdx + 1, self.cmdHistory.length);
          inp.value = self.cmdHistory[self.cmdHistIdx] || '';
        }
        return;
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        if (self.acItems.length && self.acIndex > 0) { self.acIndex--; self.renderAC(); return; }
        if (self.cmdHistory.length) {
          self.cmdHistIdx = Math.max(0, self.cmdHistIdx - 1);
          inp.value = self.cmdHistory[self.cmdHistIdx] || '';
        }
        return;
      }
    });
    inp.addEventListener('input', function () {
      var v = inp.value;
      /* El autocompletado sólo actúa en la petición "Comando:".  Dentro
         de un comando lo que se teclea es un dato u una opción —CEN, MID,
         @50,0— y sustituirlo por el nombre de otro comando destroza la
         entrada, que es lo que pasaba al forzar una referencia. */
      if (app.pending) { self.hideAC(); return; }
      if (!v || app.expectingText() || /[ ,<@]/.test(v)) { self.hideAC(); return; }
      self.acItems = Cmd.suggest(v);
      self.acIndex = self.acItems.length ? 0 : -1;
      self.renderAC();
    });
    this.el.autocomp.addEventListener('mousedown', function (e) {
      var it = e.target.closest('[data-idx]');
      if (!it) return;
      e.preventDefault();
      var s = self.acItems[parseInt(it.dataset.idx, 10)];
      inp.value = '';
      self.hideAC();
      app.feedInput(s.alias);
    });
    this.el.prompt.addEventListener('mousedown', function (e) {
      var k = e.target.closest('[data-kw]');
      if (!k) return;
      e.preventDefault();
      e.stopPropagation();
      if (k.dataset.kw === '\u0000def') app.feedEnter();
      else app.feedInput(k.dataset.kw);
      inp.focus();
    });
    document.getElementById('cmdrow').addEventListener('click', function () { inp.focus(); });
  };

  UI.prototype.renderAC = function () {
    var self = this;
    if (!this.acItems.length) { this.hideAC(); return; }
    var q = this.el.input.value.toUpperCase();
    this.el.autocomp.innerHTML = this.acItems.map(function (s, i) {
      var d = s.def || {};
      var nm = s.alias.replace(new RegExp('^' + q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')), '<b>' + q + '</b>');
      return '<div class="ac-item' + (i === self.acIndex ? ' sel' : '') + '" data-idx="' + i + '">' +
        icon(d.icon || 'point') + '<span class="ac-cmd">' + nm + '</span>' +
        '<span class="ac-title">' + (d.title || '') + '</span></div>';
    }).join('');
    this.el.autocomp.hidden = false;
  };
  UI.prototype.hideAC = function () { this.el.autocomp.hidden = true; this.acItems = []; this.acIndex = -1; };

  /* ---------- Entrada dinámica ---------- */
  UI.prototype.updateDyn = function () {
    var app = this.app, doc = app.doc;
    var d = this.el.dynin;
    /* En el espacio 3D la entrada dinámica plana no tiene sentido: el
       punto se lee en la barra de estado con sus tres coordenadas y el
       rótulo de la captura dice a qué se está enganchando. */
    if (!doc.vars.DYNMODE || !app.cursorScreen || app.cleanScreenHideDyn || app.is3D) { d.hidden = true; return; }
    var p = app.pending;
    var wrapRect = document.getElementById('canvasWrap').getBoundingClientRect();
    d.hidden = false;
    d.style.left = Math.min(wrapRect.width - 190, app.cursorScreen.x + 18) + 'px';
    d.style.top = Math.min(wrapRect.height - 70, app.cursorScreen.y + 16) + 'px';
    var pr = Math.min(4, doc.vars.LUPREC);
    var w = app.cursorWorld || { x: 0, y: 0 };
    /* Un campo que el usuario está tecleando o que ha bloqueado con Tab
       no se refresca con el cursor, igual que en AutoCAD. */
    var lock = app.dynLock || {};
    var act = document.activeElement;
    function held(el, id) {
      return (lock[id] !== undefined && lock[id] !== '') || (act === el && app.dynTyping);
    }
    var hA = held(this.el.dynA, 'dynA'), hB = held(this.el.dynB, 'dynB');
    if (p && p.kind === 'point' && p.opts.base) {
      var dist = G.dist(p.opts.base, w), ang = G.deg(G.na(G.ang(p.opts.base, w)));
      if (!hA) this.el.dynA.value = G.fmt(dist, pr);
      if (!hB) this.el.dynB.value = G.fmt(ang, 0);
      this.el.dynSep.textContent = '<';
    } else {
      if (!hA) this.el.dynA.value = G.fmt(w.x, pr);
      if (!hB) this.el.dynB.value = G.fmt(w.y, pr);
      this.el.dynSep.textContent = ',';
    }
    this.el.dynA.classList.toggle('locked', !!(lock.dynA !== undefined && lock.dynA !== ''));
    this.el.dynB.classList.toggle('locked', !!(lock.dynB !== undefined && lock.dynB !== ''));
    var tipText = p ? p.text : 'Comando:';
    this.el.dynTip.textContent = tipText;
    this.el.dynTip.hidden = !tipText;
  };

  UI.prototype.showSnapTip = function (hit, extra) {
    var t = this.el.snapTip;
    if ((!hit && !extra) || !this.app.cursorScreen) { t.hidden = true; return; }
    t.hidden = false;
    t.textContent = hit ? (extra ? hit.label + '\n' + extra : hit.label) : extra;
    t.style.left = (this.app.cursorScreen.x + 16) + 'px';
    t.style.top = (this.app.cursorScreen.y - 24) + 'px';
  };

  UI.prototype.flashResult = function (msg) {
    var t = this.el.toast;
    t.textContent = msg;
    t.hidden = false;
    clearTimeout(this._toastT);
    this._toastT = setTimeout(function () { t.hidden = true; }, 2600);
  };

  /* ---------- Menús contextuales / flyouts ---------- */
  UI.prototype.closeMenus = function () {
    Array.prototype.forEach.call(document.querySelectorAll('.menu'), function (m) { m.remove(); });
  };

  UI.prototype.menuAt = function (x, y, items) {
    var self = this;
    this.closeMenus();
    var m = document.createElement('div');
    m.className = 'menu';
    m.innerHTML = items.map(function (it, i) {
      if (it === '-') return '<div class="sep"></div>';
      if (it.head) return '<div class="mhead">' + it.head + '</div>';
      return '<button data-i="' + i + '">' + (it.icon ? icon(it.icon) : '<span style="width:16px"></span>') +
        '<span>' + it.label + '</span>' + (it.kbd ? '<span class="kbd">' + it.kbd + '</span>' : '') + '</button>';
    }).join('');
    document.getElementById('modalRoot').appendChild(m);
    var r = m.getBoundingClientRect();
    m.style.left = Math.max(4, Math.min(x, window.innerWidth - r.width - 6)) + 'px';
    m.style.top = Math.max(4, Math.min(y, window.innerHeight - r.height - 6)) + 'px';
    m.addEventListener('click', function (e) {
      var b = e.target.closest('[data-i]');
      if (!b) return;
      var it = items[parseInt(b.dataset.i, 10)];
      self.closeMenus();
      if (it && it.action) it.action();
    });
    setTimeout(function () {
      document.addEventListener('mousedown', function h(ev) {
        if (!m.contains(ev.target)) { self.closeMenus(); document.removeEventListener('mousedown', h); }
      });
    }, 0);
    return m;
  };

  UI.prototype.flyout = function (btn, specs) {
    var self = this;
    var r = btn.getBoundingClientRect();
    this.menuAt(r.left, r.bottom, specs.map(function (s) {
      var parts = s.split('|');
      var def = Cmd.find(parts[0].split(' ')[0]);
      return { label: parts[1] || parts[0], icon: def && def.icon, action: function () { self.run(parts[0]); } };
    }));
  };

  UI.prototype.comboMenu = function (el, kind) {
    var self = this, app = this.app, doc = app.doc;
    var r = el.getBoundingClientRect();
    var items = [];
    if (kind === 'layer') {
      doc.layerList().forEach(function (l) {
        items.push({
          label: (l.on ? '' : '(des) ') + l.name + (l.locked ? ' 🔒' : ''),
          action: function () { doc.vars.CLAYER = l.name; self.syncPropBar(); app.refresh(); }
        });
      });
      items.push('-', { label: 'Propiedades de capa…', icon: 'layer', action: function () { self.layerDialog(); } });
    } else if (kind === 'color') {
      [[256, 'PorCapa'], [0, 'PorBloque'], [1, 'Rojo'], [2, 'Amarillo'], [3, 'Verde'], [4, 'Cian'], [5, 'Azul'], [6, 'Magenta'], [7, 'Blanco']].forEach(function (c) {
        items.push({ label: c[1], action: function () { app.setCurrentColor(c[0]); } });
      });
      items.push('-', { label: 'Seleccionar color…', icon: 'color', action: function () { app.startCommand('COLOR'); } });
    } else if (kind === 'ltype') {
      ['ByLayer'].concat(Object.keys(doc.ltypes)).forEach(function (t) {
        items.push({ label: t === 'ByLayer' ? 'PorCapa' : t, action: function () { doc.vars.CELTYPE = t; self.syncPropBar(); } });
      });
      items.push('-', { label: 'Otro…', icon: 'linetype', action: function () { app.startCommand('TIPOLIN'); } });
    } else {
      [[-1, 'PorCapa'], [-3, 'Por defecto'], [0, '0.00 mm'], [9, '0.09 mm'], [13, '0.13 mm'], [18, '0.18 mm'], [25, '0.25 mm'], [35, '0.35 mm'], [50, '0.50 mm'], [70, '0.70 mm'], [100, '1.00 mm'], [200, '2.00 mm']].forEach(function (w) {
        items.push({ label: w[1], action: function () { doc.vars.CELWEIGHT = w[0]; self.syncPropBar(); app.refresh(); } });
      });
    }
    this.menuAt(r.left, r.bottom, items);
  };

  /* ---------- Menú de la aplicación ---------- */
  UI.prototype.appMenu = function (btn) {
    var self = this;
    var r = btn.getBoundingClientRect();
    this.menuAt(r.left, r.bottom, [
      { head: 'ARCHIVO' },
      { label: 'Nuevo', icon: 'new', kbd: 'Ctrl+N', action: function () { self.run('NUEVO'); } },
      { label: 'Nuevo desde plantilla…', icon: 'new', action: function () { self.run('PLANTILLA'); } },
      { label: 'Abrir…  (DXF / DWG)', icon: 'open', kbd: 'Ctrl+O', action: function () { self.run('ABRE'); } },
      { label: 'Guardar', icon: 'save', kbd: 'Ctrl+S', action: function () { self.run('GUARDAR'); } },
      { label: 'Guardar como…', icon: 'saveas', action: function () { self.run('GUARDARCOMO'); } },
      { label: 'Exportar…', icon: 'export', action: function () { self.run('EXPORTAR'); } },
      { label: 'Trazar…', icon: 'plot', kbd: 'Ctrl+P', action: function () { self.run('TRAZAR'); } },
      '-',
      { label: 'Utilidades del dibujo', icon: 'purge', action: function () { self.run('LIMPIA'); } },
      { label: 'Unidades', icon: 'units', action: function () { self.run('UNIDADES'); } },
      { label: 'Opciones…', icon: 'settings', action: function () { self.run('OPCIONES'); } },
      '-',
      { label: 'Ayuda y referencia de comandos', icon: 'help', kbd: 'F1', action: function () { self.helpDialog(); } },
      { label: 'Acerca de MonxuCAD', icon: 'dwg', action: function () { self.aboutDialog(); } }
    ]).classList.add('appmenu');
  };

  /* ---------- Escala de anotación ---------- */
  var ANNO_SCALES = [
    ['1:1', 1], ['1:2', 2], ['1:5', 5], ['1:10', 10], ['1:20', 20], ['1:25', 25],
    ['1:50', 50], ['1:75', 75], ['1:100', 100], ['1:200', 200], ['1:500', 500],
    ['2:1', 0.5], ['5:1', 0.2], ['10:1', 0.1]
  ];
  UI.prototype.scaleMenu = function (el) {
    var self = this, app = this.app, doc = app.doc;
    var r = el.getBoundingClientRect();
    var items = [{ head: 'ESCALA DE ANOTACIÓN' }];
    ANNO_SCALES.forEach(function (s2) {
      items.push({
        label: s2[0],
        action: function () {
          doc.mark('ESCALAANOTA');
          doc.vars.CANNOSCALE = s2[0];
          doc.vars.DIMSCALE = s2[1];
          doc.vars.LTSCALE = Math.max(0.01, s2[1] / 2);
          app.out('Escala de anotación: ' + s2[0] + '  (DIMSCALE=' + s2[1] + ', LTSCALE=' + G.fmt(doc.vars.LTSCALE, 2) + ')');
          self.syncStatus();
          app.refresh();
        }
      });
    });
    this.menuAt(r.left, r.top - 12, items);
  };

  /* ---------- Comandos recientes ---------- */
  UI.prototype.recentMenu = function (x, y) {
    var self = this, app = this.app;
    var seen = [], items = [{ head: 'COMANDOS RECIENTES' }];
    for (var i = this.cmdHistory.length - 1; i >= 0 && seen.length < 8; i--) {
      var t = String(this.cmdHistory[i]).trim().toUpperCase();
      var d = Cmd.find(t);
      if (!d || seen.indexOf(d.name) >= 0) continue;
      seen.push(d.name);
      items.push((function (nm, def) {
        return { label: nm + (def.title ? '  —  ' + def.title : ''), icon: def.icon, action: function () { app.startCommand(nm); } };
      })(d.name, d));
    }
    if (seen.length === 0) items.push({ label: '(sin comandos recientes)' });
    items.push('-');
    items.push({ label: 'Copiar historial', icon: 'paste', action: function () {
      var txt = Array.prototype.map.call(self.el.hist.children, function (d2) { return d2.textContent; }).join('\n');
      try { navigator.clipboard.writeText(txt); self.flashResult('Historial copiado.'); } catch (e) { }
    } });
    items.push({ label: 'Borrar historial', action: function () { self.el.hist.innerHTML = ''; self.histLines = 0; } });
    items.push('-');
    items.push({ label: 'Opciones…', icon: 'settings', action: function () { app.startCommand('OPCIONES'); } });
    this.menuAt(x, y, items);
  };

  /* ---------- Menú de sustitución de referencia a objetos ---------- */
  UI.prototype.osnapMenu = function (x, y) {
    var app = this.app;
    var keys = ['end', 'mid', 'int', 'cen', 'geo', 'qua', 'nod', 'ins', 'per', 'tan', 'nea'];
    var items = [{ head: 'SUSTITUIR REFERENCIA' }];
    CAD.Snap.MODES.forEach(function (m) {
      if (keys.indexOf(m.key) < 0) return;
      items.push({
        label: m.label,
        action: function () {
          app.osnapOverride = m.key;
          app.out('_' + m.key, 'echo');
          app.refresh();
        }
      });
    });
    items.push('-');
    items.push({
      label: 'Ninguno', action: function () { app.osnapOverride = 'none'; app.out('_non', 'echo'); app.refresh(); }
    });
    items.push({
      label: 'Punto medio entre 2 puntos', action: function () { app.startMidBetween(); }
    });
    items.push('-');
    items.push({ label: 'Parámetros de referencia…', icon: 'osnap', action: function () { app.startCommand('REFENT'); } });
    this.menuAt(x, y, items);
  };

  /* ---------- Información al pasar el cursor ---------- */
  UI.prototype.showRollover = function (ent, sp) {
    var doc = this.app.doc;
    var el = document.getElementById('rollover');
    if (!ent || !sp) { el.hidden = true; return; }
    var names = {
      LINE: 'Línea', LWPOLYLINE: 'Polilínea', CIRCLE: 'Círculo', ARC: 'Arco', ELLIPSE: 'Elipse',
      POINT: 'Punto', TEXT: 'Texto', MTEXT: 'Texto múltiple', INSERT: 'Referencia a bloque',
      HATCH: 'Sombreado', SOLID: 'Sólido 2D', SPLINE: 'Spline', DIMENSION: 'Cota',
      LEADER: 'Directriz', XLINE: 'Línea auxiliar', RAY: 'Rayo', ATTDEF: 'Atributo', ATTRIB: 'Atributo'
    };
    var c = E.effColor(ent, doc);
    var rows = [
      ['Capa', ent.layer],
      ['Color', ent.color === 256 ? 'PorCapa' : ent.color === 0 ? 'PorBloque' : String(ent.color)],
      ['Tipo de línea', ent.ltype === 'ByLayer' ? 'PorCapa' : ent.ltype]
    ];
    var pr = Math.min(3, doc.vars.LUPREC);
    if (ent.type === 'LINE') rows.push(['Longitud', G.fmt(G.dist(ent.p1, ent.p2), pr)]);
    else if (ent.type === 'CIRCLE') rows.push(['Radio', G.fmt(ent.r, pr)]);
    else if (ent.type === 'ARC') rows.push(['Radio', G.fmt(ent.r, pr)], ['Arco', G.fmt(ent.r * G.sweep(ent.a0, ent.a1), pr)]);
    else if (ent.type === 'LWPOLYLINE') rows.push(['Vértices', ent.verts.length]);
    else if (ent.type === 'INSERT') rows.push(['Nombre', ent.name]);
    else if (ent.type === 'DIMENSION') rows.push(['Medida', G.fmt(ent.measurement, pr)]);
    else if (ent.type === 'HATCH') rows.push(['Patrón', ent.pattern]);
    else if (ent.type === 'TEXT' || ent.type === 'MTEXT') rows.push(['Contenido', String(ent.text).slice(0, 28)]);
    if (ent.group) rows.push(['Grupo', ent.group]);
    el.innerHTML = '<b>' + escHtml(names[ent.type] || ent.type) + '</b>' +
      '<table>' + rows.map(function (r) {
        return '<tr><td class="k">' + escHtml(r[0]) + '</td><td>' + escHtml(r[1]) + '</td></tr>';
      }).join('') + '</table>';
    el.hidden = false;
    var wrap = document.getElementById('canvasWrap').getBoundingClientRect();
    var r2 = el.getBoundingClientRect();
    el.style.left = Math.min(wrap.width - r2.width - 6, sp.x + 18) + 'px';
    el.style.top = Math.min(wrap.height - r2.height - 6, sp.y + 18) + 'px';
  };
  UI.prototype.hideRollover = function () {
    var el = document.getElementById('rollover');
    if (el) el.hidden = true;
  };

  /* ---------- Ciclo de selección ---------- */
  UI.prototype.cycleMenu = function (cands, screenPt, onPick) {
    var self = this, app = this.app;
    var names = { LINE: 'Línea', LWPOLYLINE: 'Polilínea', CIRCLE: 'Círculo', ARC: 'Arco', ELLIPSE: 'Elipse', TEXT: 'Texto', MTEXT: 'Texto múltiple', INSERT: 'Bloque', HATCH: 'Sombreado', DIMENSION: 'Cota', SPLINE: 'Spline', POINT: 'Punto', SOLID: 'Sólido', LEADER: 'Directriz' };
    var items = [{ head: 'SELECCIÓN (' + cands.length + ' objetos)' }];
    cands.forEach(function (e) {
      items.push({
        label: (names[e.type] || e.type) + '  ·  ' + e.layer,
        action: function () { onPick(e); }
      });
    });
    var rect = document.getElementById('canvasWrap').getBoundingClientRect();
    var m = this.menuAt(rect.left + screenPt.x + 12, rect.top + screenPt.y + 12, items);
    m.addEventListener('mouseover', function (e) {
      var b = e.target.closest('[data-i]');
      if (!b) return;
      var idx = parseInt(b.dataset.i, 10) - 1;
      app.hoverEnt = cands[idx] || null;
      app.refresh();
    });
    return m;
  };

  /* ---------- Menú contextual del área gráfica ---------- */
  UI.prototype.contextMenu = function (x, y) {
    var self = this, app = this.app;
    var items = [];
    if (app.pending) {
      items.push({ label: 'Intro', action: function () { app.feedEnter(); } });
      items.push({ label: 'Cancelar', action: function () { app.cancel(); } });
      if (app.pending.opts && app.pending.opts.keywords) {
        items.push('-');
        app.pending.opts.keywords.forEach(function (k) {
          items.push({ label: k, action: function () { app.feedText(CAD.kwShort(k)); } });
        });
      }
    } else if (app.selSet.length) {
      items.push(
        { label: 'Borrar', icon: 'erase', action: function () { self.run('BORRA'); } },
        { label: 'Desplazar', icon: 'move', action: function () { self.run('DESPLAZA'); } },
        { label: 'Copiar selección', icon: 'copy', action: function () { self.run('COPIA'); } },
        { label: 'Escala', icon: 'scale', action: function () { self.run('ESCALA'); } },
        { label: 'Girar', icon: 'rotate', action: function () { self.run('GIRA'); } },
        '-',
        { label: 'Copiar al Portapapeles', icon: 'paste', action: function () { self.run('COPIAPP'); } },
        { label: 'Propiedades', icon: 'props', action: function () { self.togglePalette('props', true); } }
      );
    } else {
      items.push(
        { label: 'Repetir ' + (app.lastCommand || 'comando'), action: function () { if (app.lastCommand) app.startCommand(app.lastCommand); } },
        '-',
        { label: 'Deshacer', icon: 'undo', kbd: 'Ctrl+Z', action: function () { self.run('H'); } },
        { label: 'Rehacer', icon: 'redo', kbd: 'Ctrl+Y', action: function () { self.run('REHACER'); } },
        '-',
        { label: 'Encuadre', icon: 'pan', action: function () { self.run('ENCUADRE'); } },
        { label: 'Zoom', icon: 'zoom', action: function () { self.run('ZOOM'); } },
        { label: 'Zoom extensión', icon: 'zoomext', action: function () { self.run('ZOOM E'); } },
        '-',
        { label: 'Pegar', icon: 'paste', action: function () { self.run('PEGARPP'); } },
        { label: 'Opciones…', icon: 'settings', action: function () { self.run('OPCIONES'); } }
      );
    }
    this.menuAt(x, y, items);
  };
})();

/* ============================================================
   ui.js (2) — Cuadros de diálogo y paletas
   ============================================================ */
(function () {
  'use strict';
  var CAD = window.CAD, G = CAD.G, E = CAD.E, Cmd = CAD.Cmd;
  var UI = CAD.UI, icon = CAD.icon;

  function esc(s) {
    return String(s === undefined || s === null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  /* ------------------------------------------------------------
     Diálogo genérico
     ------------------------------------------------------------ */
  /* Diálogos abiertos, del más antiguo al más reciente.  Sirve para
     saber si hay un modal en marcha y para cerrar el de arriba con
     Escape aunque el foco se haya escapado del diálogo. */
  UI.abiertos = [];
  /* La verdad la tiene el DOM: si un diálogo desapareció por otra vía,
     la pila se purga sola en lugar de dejar la aplicación bloqueada
     creyendo que hay un modal abierto. */
  UI.hayModal = function () {
    var vivos = document.querySelectorAll('#modalRoot .modal-back').length;
    if (!vivos) UI.abiertos.length = 0;
    return vivos > 0;
  };
  if (!UI._escGlobal) {
    UI._escGlobal = true;
    document.addEventListener('keydown', function (e) {
      if (e.key !== 'Escape' || !UI.hayModal()) return;
      e.preventDefault();
      e.stopPropagation();
      if (UI.abiertos.length) UI.abiertos[UI.abiertos.length - 1](null);
      else {
        var d = document.querySelector('#modalRoot .modal-back:last-child');
        if (d) d.remove();
      }
    }, true);
  }

  UI.prototype.dialog = function (opts) {
    var self = this;
    return new Promise(function (resolve) {
      var back = document.createElement('div');
      back.className = 'modal-back';
      var w = opts.width ? 'width:' + opts.width + 'px;' : '';
      back.innerHTML =
        '<div class="dlg" style="' + w + '" role="dialog" aria-modal="true" aria-label="' + esc(opts.title) + '">' +
        '<div class="dlg-head"><span>' + esc(opts.title) + '</span><button class="x" aria-label="Cerrar">✕</button></div>' +
        '<div class="dlg-body"></div>' +
        (opts.buttons === null ? '' : '<div class="dlg-foot"></div>') +
        '</div>';
      var dlg = back.querySelector('.dlg');
      dlg.tabIndex = -1;                 /* para poder enfocarlo aunque no tenga campos */
      var body = back.querySelector('.dlg-body');
      if (typeof opts.body === 'string') body.innerHTML = opts.body;
      else if (opts.body) body.appendChild(opts.body);

      var done = false;
      function close(v) {
        if (done) return;
        done = true;
        var i = UI.abiertos.indexOf(close);
        if (i >= 0) UI.abiertos.splice(i, 1);
        back.remove();
        self.app.focusCmd();
        resolve(v);
      }
      var foot = back.querySelector('.dlg-foot');
      if (foot) {
        var btns = opts.buttons || [{ label: 'Aceptar', value: true, primary: true }, { label: 'Cancelar', value: null }];
        btns.forEach(function (b) {
          var el = document.createElement('button');
          el.className = 'btn' + (b.primary ? ' primary' : '');
          el.textContent = b.label;
          el.addEventListener('click', function () {
            if (b.value !== null && opts.onOk) {
              var r = opts.onOk(body, b.value);
              if (r === false) return;
              close(r === undefined ? b.value : r);
            } else close(b.value);
          });
          foot.appendChild(el);
        });
      }
      back.querySelector('.x').addEventListener('click', function () { close(null); });
      back.addEventListener('mousedown', function (e) { if (e.target === back && opts.lightDismiss !== false) close(null); });
      back.addEventListener('keydown', function (e) {
        if (e.key === 'Escape') { e.stopPropagation(); close(null); }
        if (e.key === 'Enter' && opts.enterOk !== false && e.target.tagName !== 'TEXTAREA') {
          var p = foot && foot.querySelector('.primary');
          if (p) { e.preventDefault(); p.click(); }
        }
      });
      /* arrastrar por la cabecera */
      var head = back.querySelector('.dlg-head');
      var drag = null;
      head.addEventListener('mousedown', function (e) {
        if (e.target.classList.contains('x')) return;
        var r = dlg.getBoundingClientRect();
        drag = { dx: e.clientX - r.left, dy: e.clientY - r.top };
        dlg.style.position = 'absolute';
        dlg.style.margin = '0';
      });
      window.addEventListener('mousemove', function (e) {
        if (!drag) return;
        dlg.style.left = Math.max(0, Math.min(window.innerWidth - 60, e.clientX - drag.dx)) + 'px';
        dlg.style.top = Math.max(0, Math.min(window.innerHeight - 40, e.clientY - drag.dy)) + 'px';
      });
      window.addEventListener('mouseup', function () { drag = null; });

      document.getElementById('modalRoot').appendChild(back);
      UI.abiertos.push(close);
      if (opts.onOpen) opts.onOpen(body, close);
      /* El foco tiene que caer DENTRO del diálogo: si se quedaba en la
         línea de comandos, Escape no llegaba aquí y el diálogo no había
         forma de cerrarlo con el teclado. */
      var f = body.querySelector('input:not([type=hidden]),textarea,select,button') ||
              back.querySelector('.dlg-foot .btn') || dlg;
      try { f.focus(); } catch (e) { dlg.focus(); }
      if (!back.contains(document.activeElement)) dlg.focus();
    });
  };

  /* ------------------------------------------------------------
     Diálogos sencillos
     ------------------------------------------------------------ */
  UI.prototype.promptDialog = function (title, label, def) {
    return this.dialog({
      title: title, width: 380,
      body: '<div class="fields"><label>' + esc(label) + '</label><input type="text" id="dlgVal" value="' + esc(def || '') + '"></div>',
      onOk: function (b) {
        var v = b.querySelector('#dlgVal').value.trim();
        return v || false;
      }
    });
  };

  UI.prototype.confirmDialog = function (msg, buttons) {
    var btns = buttons
      ? buttons.map(function (b, i) { return { label: b, value: b === 'Cancelar' ? null : b, primary: i === 0 }; })
      : [{ label: 'Aceptar', value: true, primary: true }, { label: 'Cancelar', value: null }];
    return this.dialog({
      title: 'MonxuCAD', width: 420,
      body: '<div style="display:flex;gap:12px;align-items:flex-start"><div style="font-size:26px;line-height:1">⚠️</div><div style="padding-top:4px">' + esc(msg) + '</div></div>',
      buttons: btns
    });
  };

  UI.prototype.textWindow = function (title, text) {
    return this.dialog({
      title: title, width: 660,
      body: '<div class="mono-out">' + esc(text) + '</div>',
      buttons: [{ label: 'Cerrar', value: true, primary: true }]
    });
  };

  UI.prototype.textDialog = function (initial, opts) {
    opts = opts || {};
    return this.dialog({
      title: opts.title || 'Editor de texto', width: 520,
      body: '<div class="fields"><textarea class="code span2" id="dlgTxt" rows="7" placeholder="Escriba el texto…">' + esc(initial) + '</textarea>' +
        '<div class="span2" style="color:var(--ink-mute)">Use %%d = ° &nbsp; %%c = Ø &nbsp; %%p = ±</div></div>',
      enterOk: false,
      onOk: function (b) {
        var v = b.querySelector('#dlgTxt').value;
        return v.replace(/%%d/gi, '°').replace(/%%c/gi, 'Ø').replace(/%%p/gi, '±');
      }
    });
  };

  /* ---------- Visor de texto (código CN, hojas de preparación) ---------- */
  UI.prototype.textViewer = function (title, text) {
    var pre = document.createElement('pre');
    pre.className = 'txtview';
    pre.textContent = text;
    pre.style.cssText = 'max-height:62vh;overflow:auto;margin:0;padding:10px 12px;' +
      'font:12px/1.45 ui-monospace,Menlo,Consolas,monospace;white-space:pre;' +
      'background:#14181f;color:#cfd8e6;border-radius:5px;border:1px solid #2a3140';
    var n = text.split('\n').length;
    return this.dialog({
      title: title + '   (' + n + ' líneas)', width: 760, body: pre,
      buttons: [{ label: 'Copiar al portapapeles', value: 'copy' },
                { label: 'Cerrar', value: null, primary: true }],
      enterOk: false,
      onOk: function (b, v) {
        if (v !== 'copy') return v;
        try {
          if (navigator.clipboard) navigator.clipboard.writeText(text);
          else {
            var ta = document.createElement('textarea');
            ta.value = text; document.body.appendChild(ta);
            ta.select(); document.execCommand('copy'); ta.remove();
          }
          var btn = b.parentNode.querySelector('.dlg-foot button');
          if (btn) { btn.textContent = 'Copiado ✓'; setTimeout(function () { btn.textContent = 'Copiar al portapapeles'; }, 1400); }
        } catch (err) { }
        return false;    /* no cierra */
      }
    });
  };

  /* ---------- Selector de archivo genérico ---------- */
  UI.prototype.pickFile = function (accept) {
    return new Promise(function (resolve) {
      var inp = document.createElement('input');
      inp.type = 'file';
      if (accept) inp.accept = accept;
      inp.style.display = 'none';
      document.body.appendChild(inp);
      var done = false;
      inp.addEventListener('change', function () {
        if (done) return;
        done = true;
        var f = inp.files && inp.files[0];
        inp.remove();
        resolve(f || null);
      });
      window.addEventListener('focus', function once() {
        window.removeEventListener('focus', once);
        setTimeout(function () { if (!done) { done = true; inp.remove(); resolve(null); } }, 700);
      });
      inp.click();
    });
  };

  /* ---------- Indicador 3D en la barra de estado ---------- */
  /* ------------------------------------------------------------
     Conmutador de espacio de trabajo
     AutoCAD lo lleva en la barra de estado y de ahí se pasa de "Dibujo
     y anotación" a "Modelado 3D".  Antes sólo se podía cambiar de modo
     escribiendo un comando, que es justo lo que nadie encuentra.
     ------------------------------------------------------------ */
  var ESPACIOS = [
    { id: '2d', label: 'Dibujo y anotación', tab: 'inicio', icon: 'line' },
    { id: '3d', label: 'Modelado 3D', tab: 'modelado', icon: 'view3d' }
  ];
  UI.prototype.setWorkspace = function (id) {
    var app = this.app;
    if (id === '3d') {
      if (app.paperMode) app.setLayout(-1);
      var venia = !app.is3D;
      if (!app.set3D(true)) return false;
      /* al entrar por primera vez se ofrece una isométrica, como el
         espacio de trabajo de modelado de AutoCAD */
      if (venia && app.view3d && app.view3d.cam && !app.ws3dVisto) {
        app.ws3dVisto = true;
        app.view3d.cam.setView('SWISO');
        if (app.zoom3dExtents) app.zoom3dExtents();
      }
      app.out('Espacio de trabajo: Modelado 3D.');
    } else {
      app.set3D(false);
      app.out('Espacio de trabajo: Dibujo y anotación.');
    }
    app.refresh();
    this.syncWorkspace();
    return true;
  };
  UI.prototype.syncWorkspace = function () {
    var b = this.el && this.el.ws;
    if (!b) return;
    var en3d = !!this.app.is3D;
    b.textContent = en3d ? ESPACIOS[1].label : ESPACIOS[0].label;
    b.classList.toggle('en3d', en3d);
  };
  UI.prototype.wsMenu = function (anchor) {
    var self = this, r = anchor.getBoundingClientRect(), act = this.app.is3D ? '3d' : '2d';
    this.menuAt(r.left, r.top - 4 - ESPACIOS.length * 26, ESPACIOS.map(function (w) {
      return { label: (w.id === act ? '● ' : '   ') + w.label, icon: w.icon,
               action: function () { self.setWorkspace(w.id); } };
    }));
  };

  UI.prototype.setStatus3D = function (on) {
    var el = document.getElementById('st3d');
    if (el) el.classList.toggle('on', !!on);
    this.syncWorkspace();
    /* Al entrar en el espacio 3D la cinta pasa a las herramientas de
       modelado, y al salir vuelve a la pestaña que estaba.  Es lo que
       hace SolidWorks al cambiar de entorno. */
    if (on) {
      if (this.activeTab !== 'modelado') {
        this.tab2d = this.activeTab;
        this.activeTab = 'modelado';
        this.buildRibbon();
      }
    } else if (this.activeTab === 'modelado') {
      this.activeTab = this.tab2d || 'inicio';
      this.buildRibbon();
    }
  };

  UI.prototype.listDialog = function (title, items, current) {
    var html = '<div class="grid-wrap"><table class="grid"><tbody>' + items.map(function (it) {
      return '<tr data-v="' + esc(it) + '"' + (it === current ? ' class="sel"' : '') + '><td>' + esc(it) + '</td></tr>';
    }).join('') + '</tbody></table></div>';
    var chosen = current;
    return this.dialog({
      title: title, width: 380, body: html,
      onOpen: function (b) {
        b.addEventListener('click', function (e) {
          var tr = e.target.closest('[data-v]');
          if (!tr) return;
          Array.prototype.forEach.call(b.querySelectorAll('tr'), function (r) { r.classList.remove('sel'); });
          tr.classList.add('sel');
          chosen = tr.dataset.v;
        });
      },
      onOk: function () { return chosen; }
    });
  };

  /* ------------------------------------------------------------
     Color
     ------------------------------------------------------------ */
  UI.prototype.colorDialog = function (current) {
    var sw = '';
    for (var i = 1; i <= 255; i++) sw += '<div data-c="' + i + '" style="background:' + G.aciCSS(i) + '" title="Índice ' + i + '"' + (i === current ? ' class="sel"' : '') + '></div>';
    var body =
      '<div style="display:flex;gap:6px;margin-bottom:8px">' +
      '<button class="btn" data-c="256">PorCapa</button><button class="btn" data-c="0">PorBloque</button></div>' +
      '<div class="swatch-grid">' + sw + '</div>' +
      '<div class="fields" style="margin-top:10px"><label>Índice de color:</label><input type="number" id="ciVal" min="0" max="256" value="' + (current | 0) + '"></div>';
    return this.dialog({
      title: 'Seleccionar color', width: 420, body: body,
      onOpen: function (b) {
        b.addEventListener('click', function (e) {
          var d = e.target.closest('[data-c]');
          if (!d) return;
          b.querySelector('#ciVal').value = d.dataset.c;
          Array.prototype.forEach.call(b.querySelectorAll('.swatch-grid div'), function (x) { x.classList.remove('sel'); });
          if (d.dataset.c > 0) d.classList.add('sel');
        });
      },
      onOk: function (b) { return parseInt(b.querySelector('#ciVal').value, 10) || 0; }
    });
  };

  UI.prototype.lweightDialog = function (current) {
    var opts = [[-1, 'PorCapa'], [-3, 'Por defecto'], [0, '0.00 mm'], [5, '0.05 mm'], [9, '0.09 mm'], [13, '0.13 mm'], [15, '0.15 mm'],
      [18, '0.18 mm'], [20, '0.20 mm'], [25, '0.25 mm'], [30, '0.30 mm'], [35, '0.35 mm'], [40, '0.40 mm'],
      [50, '0.50 mm'], [53, '0.53 mm'], [60, '0.60 mm'], [70, '0.70 mm'], [80, '0.80 mm'], [90, '0.90 mm'],
      [100, '1.00 mm'], [106, '1.06 mm'], [120, '1.20 mm'], [140, '1.40 mm'], [158, '1.58 mm'], [200, '2.00 mm'], [211, '2.11 mm']];
    var html = '<div class="grid-wrap" style="max-height:300px"><table class="grid"><tbody>' + opts.map(function (o) {
      var w = o[0] > 0 ? Math.max(1, o[0] / 35) : 1;
      return '<tr data-v="' + o[0] + '"' + (o[0] === current ? ' class="sel"' : '') + '><td style="width:90px">' + o[1] + '</td>' +
        '<td><svg viewBox="0 0 120 10" style="width:120px;height:10px"><line x1="2" y1="5" x2="118" y2="5" stroke="currentColor" stroke-width="' + w + '"/></svg></td></tr>';
    }).join('') + '</tbody></table></div>';
    var chosen = current;
    return this.dialog({
      title: 'Grosor de línea', width: 340, body: html,
      onOpen: function (b) {
        b.addEventListener('click', function (e) {
          var tr = e.target.closest('[data-v]');
          if (!tr) return;
          Array.prototype.forEach.call(b.querySelectorAll('tr'), function (r) { r.classList.remove('sel'); });
          tr.classList.add('sel');
          chosen = parseInt(tr.dataset.v, 10);
        });
      },
      onOk: function () { return chosen; }
    });
  };

  /* ------------------------------------------------------------
     Administrador de capas
     ------------------------------------------------------------ */
  UI.prototype.layerDialog = function () {
    var self = this, app = this.app, doc = app.doc;
    var cur = doc.vars.CLAYER;
    function rows() {
      return doc.layerList().map(function (l) {
        return '<tr data-n="' + esc(l.name) + '"' + (l.name === cur ? ' class="sel"' : '') + '>' +
          '<td class="icon-cell" data-a="cur" title="Definir actual">' + (l.name === doc.vars.CLAYER ? '✔' : '') + '</td>' +
          '<td>' + esc(l.name) + '</td>' +
          '<td class="icon-cell" data-a="on" title="Activar/desactivar">' + (l.on ? '💡' : '🌑') + '</td>' +
          '<td class="icon-cell" data-a="frozen" title="Utilizar/inutilizar">' + (l.frozen ? '❄' : '☀') + '</td>' +
          '<td class="icon-cell" data-a="locked" title="Bloquear/desbloquear">' + (l.locked ? '🔒' : '🔓') + '</td>' +
          '<td data-a="color" style="cursor:pointer"><span style="display:inline-block;width:14px;height:12px;border:1px solid #000;vertical-align:-2px;background:' + G.aciCSS(l.color) + '"></span> ' + l.color + '</td>' +
          '<td data-a="ltype" style="cursor:pointer">' + esc(l.ltype) + '</td>' +
          '<td data-a="lw" style="cursor:pointer">' + (l.lw === -3 ? 'Por defecto' : (l.lw / 100).toFixed(2) + ' mm') + '</td>' +
          '<td class="icon-cell" data-a="plot" title="Trazar">' + (l.plot ? '🖨' : '⃠') + '</td>' +
          '</tr>';
      }).join('');
    }
    var body =
      '<div style="display:flex;gap:6px;margin-bottom:8px">' +
      '<button class="btn" id="lyNew">Nueva capa</button>' +
      '<button class="btn" id="lyDel">Suprimir</button>' +
      '<button class="btn" id="lyCur">Definir actual</button></div>' +
      '<div class="grid-wrap"><table class="grid"><thead><tr>' +
      '<th></th><th>Nombre</th><th>A</th><th>I</th><th>B</th><th>Color</th><th>Tipo de línea</th><th>Grosor</th><th>Tr</th>' +
      '</tr></thead><tbody id="lyBody">' + rows() + '</tbody></table></div>';

    return this.dialog({
      title: 'Administrador de propiedades de capa', width: 720, body: body,
      buttons: [{ label: 'Aceptar', value: true, primary: true }],
      onOpen: function (b) {
        var tb = b.querySelector('#lyBody');
        function refresh() { tb.innerHTML = rows(); app.refresh(); self.syncPropBar(); }
        tb.addEventListener('click', async function (e) {
          var tr = e.target.closest('[data-n]');
          if (!tr) return;
          var name = tr.dataset.n, l = doc.layers[name];
          cur = name;
          var a = (e.target.closest('[data-a]') || {}).dataset;
          if (!a) { refresh(); return; }
          doc.mark('CAPA');
          if (a.a === 'on') l.on = !l.on;
          else if (a.a === 'frozen') l.frozen = !l.frozen;
          else if (a.a === 'locked') l.locked = !l.locked;
          else if (a.a === 'plot') l.plot = !l.plot;
          else if (a.a === 'cur') doc.vars.CLAYER = name;
          else if (a.a === 'color') {
            var c = await self.colorDialog(l.color);
            if (c !== null) l.color = c;
          } else if (a.a === 'ltype') {
            var t = await self.listDialog('Seleccionar tipo de línea', Object.keys(doc.ltypes), l.ltype);
            if (t) l.ltype = t;
          } else if (a.a === 'lw') {
            var w = await self.lweightDialog(l.lw);
            if (w !== null) l.lw = w;
          }
          refresh();
        });
        b.querySelector('#lyNew').addEventListener('click', async function () {
          var n = await self.promptDialog('Nueva capa', 'Nombre de la capa:', 'Capa' + (doc.layerOrder.length));
          if (!n) return;
          if (doc.layers[n]) { self.flashResult('Ya existe una capa con ese nombre.'); return; }
          doc.mark('CAPA');
          doc.addLayer({ name: n, color: 7 });
          cur = n;
          refresh();
        });
        b.querySelector('#lyDel').addEventListener('click', function () {
          var err = doc.deleteLayer(cur);
          if (err) self.flashResult(err); else refresh();
        });
        b.querySelector('#lyCur').addEventListener('click', function () {
          doc.vars.CLAYER = cur;
          refresh();
        });
      }
    });
  };

  /* ------------------------------------------------------------
     Insertar bloque
     ------------------------------------------------------------ */
  UI.prototype.insertDialog = function (names) {
    var body =
      '<div class="fields">' +
      '<label>Nombre:</label><select id="ibName">' + names.map(function (n) { return '<option>' + esc(n) + '</option>'; }).join('') + '</select>' +
      '<label>Escala X:</label><input type="number" id="ibSx" value="1" step="0.1">' +
      '<label>Escala Y:</label><input type="number" id="ibSy" value="1" step="0.1">' +
      '<label>Rotación (°):</label><input type="number" id="ibRot" value="0" step="1">' +
      '<div class="span2"><label class="check"><input type="checkbox" id="ibExp"> Descomponer al insertar</label></div>' +
      '</div>';
    return this.dialog({
      title: 'Insertar', width: 400, body: body,
      onOk: function (b) {
        return {
          name: b.querySelector('#ibName').value,
          sx: parseFloat(b.querySelector('#ibSx').value) || 1,
          sy: parseFloat(b.querySelector('#ibSy').value) || 1,
          rot: parseFloat(b.querySelector('#ibRot').value) || 0,
          explode: b.querySelector('#ibExp').checked
        };
      }
    });
  };

  /* ------------------------------------------------------------
     Matriz
     ------------------------------------------------------------ */
  UI.prototype.arrayDialog = function (kind) {
    var body = kind === 'rect'
      ? '<div class="fields">' +
      '<label>Filas:</label><input type="number" id="arRows" value="3" min="1">' +
      '<label>Columnas:</label><input type="number" id="arCols" value="4" min="1">' +
      '<label>Distancia entre filas:</label><input type="number" id="arDy" value="20" step="any">' +
      '<label>Distancia entre columnas:</label><input type="number" id="arDx" value="20" step="any">' +
      '</div>'
      : '<div class="fields">' +
      '<label>Número de elementos:</label><input type="number" id="apN" value="6" min="2">' +
      '<label>Ángulo a rellenar (°):</label><input type="number" id="apFill" value="360" step="any">' +
      '<div class="span2"><label class="check"><input type="checkbox" id="apRot" checked> Girar elementos copiados</label></div>' +
      '</div>';
    return this.dialog({
      title: kind === 'rect' ? 'Matriz rectangular' : 'Matriz polar', width: 400, body: body,
      onOk: function (b) {
        if (kind === 'rect') {
          return {
            rows: Math.max(1, parseInt(b.querySelector('#arRows').value, 10) || 1),
            cols: Math.max(1, parseInt(b.querySelector('#arCols').value, 10) || 1),
            dy: parseFloat(b.querySelector('#arDy').value) || 0,
            dx: parseFloat(b.querySelector('#arDx').value) || 0
          };
        }
        return {
          count: Math.max(2, parseInt(b.querySelector('#apN').value, 10) || 2),
          fill: parseFloat(b.querySelector('#apFill').value) || 360,
          rotate: b.querySelector('#apRot').checked
        };
      }
    });
  };

  /* ------------------------------------------------------------
     Sombreado
     ------------------------------------------------------------ */
  UI.prototype.hatchDialog = function (cfg) {
    var pats = CAD.HatchLib.names();
    var body =
      '<div class="fields">' +
      '<label>Tipo:</label><select id="hMode"><option value="pick">Designar puntos internos</option><option value="select">Designar objetos</option></select>' +
      '<label>Patrón:</label><select id="hPat">' + pats.map(function (p) { return '<option' + (p === cfg.pattern ? ' selected' : '') + '>' + p + '</option>'; }).join('') + '</select>' +
      '<label>Ángulo (°):</label><input type="number" id="hAng" value="' + (cfg.angle || 0) + '" step="any">' +
      '<label>Escala:</label><input type="number" id="hSc" value="' + (cfg.scale || 1) + '" step="any" min="0.01">' +
      '<label>Transparencia:</label><input type="number" id="hTr" value="0" min="0" max="90">' +
      '<div class="span2" style="margin-top:6px"><svg id="hPrev" viewBox="0 0 220 72" style="width:100%;height:72px;background:#fff;border:1px solid var(--edge-soft)"></svg></div>' +
      '</div>';
    var self = this;
    return this.dialog({
      title: 'Sombreado y degradado', width: 430, body: body,
      onOpen: function (b) {
        function draw() {
          var name = b.querySelector('#hPat').value;
          var ang = parseFloat(b.querySelector('#hAng').value) || 0;
          var sc = parseFloat(b.querySelector('#hSc').value) || 1;
          var svg = b.querySelector('#hPrev');
          if (CAD.HatchLib.isSolid(name)) { svg.innerHTML = '<rect width="220" height="72" fill="#1b1b1b"/>'; return; }
          var box = { x1: -110, y1: -36, x2: 110, y2: 36 };
          var segs = CAD.HatchLib.segments(name, box, G.rad(ang), sc, null, 2500);
          var d = segs.map(function (sg) {
            return 'M' + (sg[0].x + 110).toFixed(1) + ' ' + (36 - sg[0].y).toFixed(1) +
              'L' + (sg[1].x + 110).toFixed(1) + ' ' + (36 - sg[1].y).toFixed(1);
          }).join('');
          svg.innerHTML = '<rect width="220" height="72" fill="#fff"/><g clip-path="url(#cp)">' +
            '<path d="' + d + '" stroke="#111" stroke-width="0.6" fill="none"/></g>' +
            '<defs><clipPath id="cp"><rect width="220" height="72"/></clipPath></defs>';
        }
        ['#hPat', '#hAng', '#hSc'].forEach(function (s) { b.querySelector(s).addEventListener('input', draw); });
        draw();
      },
      onOk: function (b) {
        return {
          mode: b.querySelector('#hMode').value,
          pattern: b.querySelector('#hPat').value,
          angle: parseFloat(b.querySelector('#hAng').value) || 0,
          scale: parseFloat(b.querySelector('#hSc').value) || 1,
          transparency: parseInt(b.querySelector('#hTr').value, 10) || 0,
          color: 256
        };
      }
    });
  };

  /* ------------------------------------------------------------
     Estilo de cota
     ------------------------------------------------------------ */
  UI.prototype.dimStyleDialog = function () {
    var self = this, doc = this.app.doc;
    var names = Object.keys(doc.dimStyles);
    var cur = doc.vars.DIMSTYLE;
    var s = doc.dimStyles[cur];
    var body =
      '<div class="fields">' +
      '<label>Estilo actual:</label><select id="dsName">' + names.map(function (n) { return '<option' + (n === cur ? ' selected' : '') + '>' + esc(n) + '</option>'; }).join('') + '</select>' +
      '</div>' +
      '<fieldset><legend>Líneas y flechas</legend><div class="fields">' +
      '<label>Tamaño de flecha:</label><input type="number" id="dsAsz" step="any" value="' + s.DIMASZ + '">' +
      '<label>Tipo de flecha:</label><select id="dsBlk">' +
      ['ClosedFilled', 'Open', 'ArchTick', 'Dot'].map(function (t) { return '<option' + (t === s.DIMBLK ? ' selected' : '') + '>' + t + '</option>'; }).join('') + '</select>' +
      '<label>Ampliación de línea de referencia:</label><input type="number" id="dsExe" step="any" value="' + s.DIMEXE + '">' +
      '<label>Desfase desde origen:</label><input type="number" id="dsExo" step="any" value="' + s.DIMEXO + '">' +
      '<label>Incremento línea base:</label><input type="number" id="dsDli" step="any" value="' + s.DIMDLI + '">' +
      '</div></fieldset>' +
      '<fieldset><legend>Texto</legend><div class="fields">' +
      '<label>Altura de texto:</label><input type="number" id="dsTxt" step="any" value="' + s.DIMTXT + '">' +
      '<label>Desfase de línea de cota:</label><input type="number" id="dsGap" step="any" value="' + s.DIMGAP + '">' +
      '<label>Posición vertical:</label><select id="dsTad"><option value="0"' + (s.DIMTAD === 0 ? ' selected' : '') + '>Centrado</option><option value="1"' + (s.DIMTAD === 1 ? ' selected' : '') + '>Encima</option></select>' +
      '</div></fieldset>' +
      '<fieldset><legend>Unidades principales</legend><div class="fields">' +
      '<label>Precisión (decimales):</label><input type="number" id="dsDec" min="0" max="8" value="' + s.DIMDEC + '">' +
      '<label>Factor de escala de medida:</label><input type="number" id="dsLfac" step="any" value="' + s.DIMLFAC + '">' +
      '<label>Prefijo/sufijo (&lt;&gt;):</label><input type="text" id="dsPost" value="' + esc(s.DIMPOST || '') + '">' +
      '<label>Escala general:</label><input type="number" id="dsScale" step="any" value="' + s.DIMSCALE + '">' +
      '</div></fieldset>' +
      '<div style="margin-top:8px"><button class="btn" id="dsNew">Nuevo estilo…</button></div>';

    return this.dialog({
      title: 'Administrador de estilos de cota', width: 470, body: body,
      onOpen: function (b) {
        b.querySelector('#dsName').addEventListener('change', function (e) {
          doc.vars.DIMSTYLE = e.target.value;
          self.dimStyleDialog();
          b.closest('.modal-back').remove();
        });
        b.querySelector('#dsNew').addEventListener('click', async function () {
          var n = await self.promptDialog('Crear estilo de cota', 'Nombre del nuevo estilo:', 'ISO-25 copia');
          if (!n) return;
          doc.dimStyles[n] = Object.assign({}, doc.dimStyles[doc.vars.DIMSTYLE], { name: n });
          doc.vars.DIMSTYLE = n;
          b.closest('.modal-back').remove();
          self.dimStyleDialog();
        });
      },
      onOk: function (b) {
        var name = b.querySelector('#dsName').value;
        var st = doc.dimStyles[name];
        doc.mark('ESTILOCOTA');
        st.DIMASZ = parseFloat(b.querySelector('#dsAsz').value) || 2.5;
        st.DIMBLK = b.querySelector('#dsBlk').value;
        st.DIMEXE = parseFloat(b.querySelector('#dsExe').value) || 0;
        st.DIMEXO = parseFloat(b.querySelector('#dsExo').value) || 0;
        st.DIMDLI = parseFloat(b.querySelector('#dsDli').value) || 3.75;
        st.DIMTXT = parseFloat(b.querySelector('#dsTxt').value) || 2.5;
        st.DIMGAP = parseFloat(b.querySelector('#dsGap').value) || 0.625;
        st.DIMTAD = parseInt(b.querySelector('#dsTad').value, 10);
        st.DIMDEC = parseInt(b.querySelector('#dsDec').value, 10);
        st.DIMLFAC = parseFloat(b.querySelector('#dsLfac').value) || 1;
        st.DIMPOST = b.querySelector('#dsPost').value;
        st.DIMSCALE = parseFloat(b.querySelector('#dsScale').value) || 1;
        doc.vars.DIMSTYLE = name;
        return true;
      }
    });
  };

  /* ------------------------------------------------------------
     Parámetros de dibujo (rejilla / polar / refent / dinámico)
     ------------------------------------------------------------ */
  UI.prototype.settingsDialog = function (tab) {
    var self = this, app = this.app, doc = app.doc, v = doc.vars;
    var snapModes = CAD.Snap.MODES.map(function (m) {
      return '<label class="check"><input type="checkbox" data-bit="' + m.bit + '"' + ((v.OSMODE & m.bit) ? ' checked' : '') + '> ' + m.label + '</label>';
    }).join('');
    var body =
      '<fieldset><legend>Resolución y rejilla</legend><div class="fields">' +
      '<label class="span2"><label class="check"><input type="checkbox" id="stSnap"' + (v.SNAPMODE ? ' checked' : '') + '> Forzar cursor activado (F9)</label></label>' +
      '<label>Intervalo de resolución:</label><input type="number" id="stSnapU" step="any" value="' + v.SNAPUNIT + '">' +
      '<div class="span2"><label class="check"><input type="checkbox" id="stGrid"' + (v.GRIDMODE ? ' checked' : '') + '> Rejilla activada (F7)</label></div>' +
      '<label>Intervalo de rejilla:</label><input type="number" id="stGridU" step="any" value="' + v.GRIDUNIT + '">' +
      '<label>Líneas principales cada:</label><input type="number" id="stGridM" min="1" value="' + v.GRIDMAJOR + '">' +
      '</div></fieldset>' +
      '<fieldset><legend>Rastreo polar</legend><div class="fields">' +
      '<div class="span2"><label class="check"><input type="checkbox" id="stPolar"' + (v.POLARMODE ? ' checked' : '') + '> Rastreo polar activado (F10)</label></div>' +
      '<label>Incremento de ángulo:</label><select id="stPolarA">' +
      [90, 45, 30, 22.5, 15, 10, 5].map(function (a) { return '<option' + (a === v.POLARANG ? ' selected' : '') + '>' + a + '</option>'; }).join('') + '</select>' +
      '<div class="span2"><label class="check"><input type="checkbox" id="stOrtho"' + (v.ORTHOMODE ? ' checked' : '') + '> Modo ortogonal (F8)</label></div>' +
      '</div></fieldset>' +
      '<fieldset><legend>Referencia a objetos (F3)</legend>' +
      '<label class="check"><input type="checkbox" id="stOsnap"' + (app.osnapOn ? ' checked' : '') + '> <b>Referencia a objetos activada</b></label>' +
      '<div style="columns:2;margin-top:6px">' + snapModes + '</div>' +
      '<div style="margin-top:6px;display:flex;gap:6px"><button class="btn" id="stAll">Seleccionar todo</button><button class="btn" id="stNone">Borrar todo</button></div>' +
      '</fieldset>' +
      '<fieldset><legend>Entrada dinámica</legend>' +
      '<label class="check"><input type="checkbox" id="stDyn"' + (v.DYNMODE ? ' checked' : '') + '> Entrada dinámica activada (F12)</label>' +
      '</fieldset>';
    return this.dialog({
      title: 'Parámetros de dibujo', width: 520, body: body,
      onOpen: function (b) {
        b.querySelector('#stAll').addEventListener('click', function () {
          Array.prototype.forEach.call(b.querySelectorAll('[data-bit]'), function (c) { c.checked = true; });
        });
        b.querySelector('#stNone').addEventListener('click', function () {
          Array.prototype.forEach.call(b.querySelectorAll('[data-bit]'), function (c) { c.checked = false; });
        });
      },
      onOk: function (b) {
        v.SNAPMODE = b.querySelector('#stSnap').checked ? 1 : 0;
        v.SNAPUNIT = parseFloat(b.querySelector('#stSnapU').value) || 10;
        v.GRIDMODE = b.querySelector('#stGrid').checked ? 1 : 0;
        v.GRIDUNIT = parseFloat(b.querySelector('#stGridU').value) || 10;
        v.GRIDMAJOR = parseInt(b.querySelector('#stGridM').value, 10) || 5;
        v.POLARMODE = b.querySelector('#stPolar').checked ? 1 : 0;
        v.POLARANG = parseFloat(b.querySelector('#stPolarA').value) || 45;
        v.ORTHOMODE = b.querySelector('#stOrtho').checked ? 1 : 0;
        v.DYNMODE = b.querySelector('#stDyn').checked ? 1 : 0;
        app.osnapOn = b.querySelector('#stOsnap').checked;
        var m = 0;
        Array.prototype.forEach.call(b.querySelectorAll('[data-bit]'), function (c) {
          if (c.checked) m |= parseInt(c.dataset.bit, 10);
        });
        v.OSMODE = m;
        self.syncStatus();
        app.refresh();
        return true;
      }
    });
  };

  /* ------------------------------------------------------------
     Unidades
     ------------------------------------------------------------ */
  UI.prototype.unitsDialog = function () {
    var v = this.app.doc.vars, app = this.app;
    var insUnits = [[0, 'Sin unidad'], [1, 'Pulgadas'], [4, 'Milímetros'], [5, 'Centímetros'], [6, 'Metros'], [2, 'Pies']];
    var body =
      '<div class="fields">' +
      '<label>Precisión decimal:</label><select id="unPrec">' + [0, 1, 2, 3, 4, 5, 6].map(function (n) { return '<option value="' + n + '"' + (n === v.LUPREC ? ' selected' : '') + '>0.' + '0'.repeat(n) + (n ? '' : '') + '</option>'; }).join('') + '</select>' +
      '<label>Precisión angular:</label><select id="unAPrec">' + [0, 1, 2, 3, 4].map(function (n) { return '<option value="' + n + '"' + (n === v.AUPREC ? ' selected' : '') + '>' + n + ' decimales</option>'; }).join('') + '</select>' +
      '<label>Unidades de inserción:</label><select id="unIns">' + insUnits.map(function (u) { return '<option value="' + u[0] + '"' + (u[0] === v.INSUNITS ? ' selected' : '') + '>' + u[1] + '</option>'; }).join('') + '</select>' +
      '<label>Escala de tipo de línea:</label><input type="number" id="unLts" step="any" value="' + v.LTSCALE + '">' +
      '<label>Altura de texto por defecto:</label><input type="number" id="unTxt" step="any" value="' + v.TEXTSIZE + '">' +
      '</div>';
    return this.dialog({
      title: 'Unidades de dibujo', width: 400, body: body,
      onOk: function (b) {
        v.LUPREC = parseInt(b.querySelector('#unPrec').value, 10);
        v.AUPREC = parseInt(b.querySelector('#unAPrec').value, 10);
        v.INSUNITS = parseInt(b.querySelector('#unIns').value, 10);
        v.LTSCALE = parseFloat(b.querySelector('#unLts').value) || 1;
        v.TEXTSIZE = parseFloat(b.querySelector('#unTxt').value) || 2.5;
        app.refresh();
        return true;
      }
    });
  };

  /* ------------------------------------------------------------
     Opciones
     ------------------------------------------------------------ */
  UI.prototype.optionsDialog = function () {
    var self = this, app = this.app, v = app.doc.vars;
    var body =
      '<fieldset><legend>Visual</legend><div class="fields">' +
      '<label>Tema de color:</label><select id="opTheme"><option value="dark"' + (!app.lightTheme ? ' selected' : '') + '>Oscuro</option><option value="light"' + (app.lightTheme ? ' selected' : '') + '>Claro</option></select>' +
      '<label>Color de fondo del modelo:</label><input type="color" id="opBg" value="' + rgbToHex(CAD.THEME.bg) + '">' +
      '<label>Tamaño de cursor en cruz (%):</label><input type="number" id="opCross" min="1" max="100" value="' + v.CURSORSIZE + '">' +
      '</div></fieldset>' +
      '<fieldset><legend>Selección</legend><div class="fields">' +
      '<label>Tamaño de mira de designación:</label><input type="number" id="opPick" min="1" max="20" value="' + v.PICKBOX + '">' +
      '<label>Tamaño de apertura de refent:</label><input type="number" id="opAp" min="1" max="50" value="' + v.APERTURE + '">' +
      '<label>Tamaño de pinzamiento:</label><input type="number" id="opGrip" min="2" max="15" value="' + v.GRIPSIZE + '">' +
      '</div></fieldset>' +
      '<fieldset><legend>Dibujo</legend>' +
      '<label class="check"><input type="checkbox" id="opFill"' + (v.FILLMODE ? ' checked' : '') + '> Rellenar sólidos y polilíneas con grosor (FILLMODE)</label>' +
      '<label class="check"><input type="checkbox" id="opLwt"' + (v.LWDISPLAY ? ' checked' : '') + '> Mostrar grosores de línea</label>' +
      '<div class="fields" style="margin-top:6px"><label>Modo de punto (PDMODE):</label><input type="number" id="opPd" min="0" max="99" value="' + v.PDMODE + '">' +
      '<label>Tamaño de punto (PDSIZE):</label><input type="number" id="opPds" step="any" value="' + v.PDSIZE + '"></div>' +
      '</fieldset>';
    return this.dialog({
      title: 'Opciones', width: 480, body: body,
      onOk: function (b) {
        app.lightTheme = b.querySelector('#opTheme').value === 'light';
        document.getElementById('app').classList.toggle('light', app.lightTheme);
        CAD.THEME.bg = b.querySelector('#opBg').value;
        v.CURSORSIZE = parseInt(b.querySelector('#opCross').value, 10) || 5;
        v.PICKBOX = parseInt(b.querySelector('#opPick').value, 10) || 4;
        v.APERTURE = parseInt(b.querySelector('#opAp').value, 10) || 10;
        v.GRIPSIZE = parseInt(b.querySelector('#opGrip').value, 10) || 5;
        v.FILLMODE = b.querySelector('#opFill').checked ? 1 : 0;
        v.LWDISPLAY = b.querySelector('#opLwt').checked ? 1 : 0;
        v.PDMODE = parseInt(b.querySelector('#opPd').value, 10) || 0;
        v.PDSIZE = parseFloat(b.querySelector('#opPds').value) || 0;
        self.syncStatus();
        app.refresh();
        return true;
      }
    });
  };
  function rgbToHex(c) {
    if (c[0] === '#') return c;
    var m = c.match(/\d+/g);
    return m ? '#' + m.slice(0, 3).map(function (x) { return ('0' + (+x).toString(16)).slice(-2); }).join('') : '#212830';
  }

  /* ------------------------------------------------------------
     Designación rápida
     ------------------------------------------------------------ */
  UI.prototype.qselectDialog = function () {
    var doc = this.app.doc;
    var types = {};
    doc.entities.forEach(function (e) { types[e.type] = (types[e.type] || 0) + 1; });
    var body =
      '<div class="fields">' +
      '<label>Tipo de objeto:</label><select id="qsType"><option value="">Múltiple</option>' +
      Object.keys(types).map(function (t) { return '<option value="' + t + '">' + t + ' (' + types[t] + ')</option>'; }).join('') + '</select>' +
      '<label>Capa:</label><select id="qsLayer"><option value="">(cualquiera)</option>' +
      doc.layerList().map(function (l) { return '<option>' + esc(l.name) + '</option>'; }).join('') + '</select>' +
      '<label>Índice de color:</label><input type="number" id="qsColor" placeholder="(cualquiera)" min="1" max="255">' +
      '</div>';
    return this.dialog({
      title: 'Designación rápida', width: 400, body: body,
      onOk: function (b) {
        var c = b.querySelector('#qsColor').value;
        return {
          type: b.querySelector('#qsType').value || null,
          layer: b.querySelector('#qsLayer').value || null,
          color: c === '' ? null : parseInt(c, 10)
        };
      }
    });
  };

  /* ------------------------------------------------------------
     Trazar (salida a PDF)
     ------------------------------------------------------------ */
  UI.prototype.plotDialog = function () {
    var self = this, app = this.app, doc = app.doc;
    var papers = Object.keys(CAD.Exporter.PAPERS);
    var body =
      '<div class="fields">' +
      '<label>Impresora/trazador:</label><select id="plDev"><option>PDF (vectorial)</option><option>PNG (imagen)</option><option>SVG (vectorial)</option></select>' +
      '<label>Tamaño de papel:</label><select id="plPaper">' + papers.map(function (p, i) { return '<option' + (i === 1 ? ' selected' : '') + '>' + p + '</option>'; }).join('') + '</select>' +
      '<label>Orientación:</label><select id="plOri"><option>Horizontal</option><option>Vertical</option></select>' +
      '<label>Área de trazado:</label><select id="plArea"><option>Extensión</option><option>Límites</option><option>Pantalla</option></select>' +
      '<label>Escala:</label><select id="plScale"><option value="0">Ajustar al papel</option><option value="1">1:1</option><option value="0.5">1:2</option><option value="0.2">1:5</option><option value="0.1">1:10</option><option value="0.05">1:20</option><option value="0.02">1:50</option><option value="0.01">1:100</option><option value="0.005">1:200</option><option value="0.002">1:500</option></select>' +
      '<label>Margen (mm):</label><input type="number" id="plMargin" value="10" step="any">' +
      '<div class="span2"><label class="check"><input type="checkbox" id="plMono" checked> Trazar en monocromo (todas las plumas en negro)</label></div>' +
      '</div>' +
      '<fieldset><legend>Previsualización</legend><canvas id="plPrev" width="420" height="300" style="width:100%;background:#fff;border:1px solid var(--edge-soft)"></canvas></fieldset>';
    return this.dialog({
      title: 'Trazar — Modelo', width: 520, body: body,
      buttons: [{ label: 'Trazar', value: 'plot', primary: true }, { label: 'Cancelar', value: null }],
      onOpen: function (b) {
        function preview() {
          var cfg = read(b);
          var cv = b.querySelector('#plPrev');
          var ctx = cv.getContext('2d');
          var pw = cfg.paper.w, ph = cfg.paper.h;
          var s = Math.min(cv.width / pw, cv.height / ph) * 0.92;
          ctx.fillStyle = '#e9ebee'; ctx.fillRect(0, 0, cv.width, cv.height);
          var ox = (cv.width - pw * s) / 2, oy = (cv.height - ph * s) / 2;
          ctx.fillStyle = '#fff'; ctx.fillRect(ox, oy, pw * s, ph * s);
          ctx.strokeStyle = '#999'; ctx.strokeRect(ox + .5, oy + .5, pw * s, ph * s);
          ctx.setLineDash([3, 3]); ctx.strokeStyle = '#bbb';
          ctx.strokeRect(ox + cfg.margin * s, oy + cfg.margin * s, (pw - 2 * cfg.margin) * s, (ph - 2 * cfg.margin) * s);
          ctx.setLineDash([]);
          var box = cfg.box;
          if (!G.bboxValid(box)) return;
          var dw = box.x2 - box.x1, dh = box.y2 - box.y1;
          var sc = cfg.scale || Math.min((pw - 2 * cfg.margin) / dw, (ph - 2 * cfg.margin) / dh);
          var offx = (pw - dw * sc) / 2 - box.x1 * sc, offy = (ph - dh * sc) / 2 - box.y1 * sc;
          ctx.save();
          ctx.beginPath();
          ctx.rect(ox, oy, pw * s, ph * s);
          ctx.clip();
          ctx.lineWidth = 0.7;
          CAD.Exporter.collect(doc, { mono: true }).forEach(function (it) {
            if (it.kind === 'path' || it.kind === 'fill') {
              ctx.strokeStyle = '#333';
              ctx.beginPath();
              it.pts.forEach(function (p, i) {
                var X = ox + (p.x * sc + offx) * s, Y = oy + ph * s - (p.y * sc + offy) * s;
                if (i) ctx.lineTo(X, Y); else ctx.moveTo(X, Y);
              });
              if (it.kind === 'fill') { ctx.fillStyle = '#333'; ctx.fill(); } else ctx.stroke();
            }
          });
          ctx.restore();
        }
        function read(b2) {
          var paper = Object.assign({}, CAD.Exporter.PAPERS[b2.querySelector('#plPaper').value]);
          if (b2.querySelector('#plOri').value === 'Horizontal') { var t = paper.w; paper.w = paper.h; paper.h = t; }
          var area = b2.querySelector('#plArea').value;
          var box;
          if (area === 'Límites') box = { x1: doc.vars.LIMMIN.x, y1: doc.vars.LIMMIN.y, x2: doc.vars.LIMMAX.x, y2: doc.vars.LIMMAX.y };
          else if (area === 'Pantalla') {
            var a = app.r.s2w({ x: 0, y: app.r.H }), c = app.r.s2w({ x: app.r.W, y: 0 });
            box = { x1: a.x, y1: a.y, x2: c.x, y2: c.y };
          } else {
            box = E.extentsAll(doc.entities, doc);
            if (!G.bboxValid(box)) box = { x1: 0, y1: 0, x2: 100, y2: 100 };
          }
          return {
            dev: b2.querySelector('#plDev').value,
            paper: paper, box: box,
            scale: parseFloat(b2.querySelector('#plScale').value) || 0,
            margin: parseFloat(b2.querySelector('#plMargin').value) || 0,
            mono: b2.querySelector('#plMono').checked
          };
        }
        b._read = read;
        ['#plPaper', '#plOri', '#plArea', '#plScale', '#plMargin', '#plMono'].forEach(function (s) {
          b.querySelector(s).addEventListener('input', preview);
          b.querySelector(s).addEventListener('change', preview);
        });
        preview();
      },
      onOk: async function (b) {
        var cfg = b._read(b);
        var base = (doc.name || 'dibujo').replace(/\.[^.]+$/, '');
        if (cfg.dev.indexOf('PNG') === 0) {
          var blob = await CAD.Exporter.pngBlob(app);
          await CAD.Exporter.saveFile(app, base + '.png', blob, 'png');
        } else if (cfg.dev.indexOf('SVG') === 0) {
          var svg = CAD.Exporter.toSVG(doc, { box: cfg.box, mono: cfg.mono });
          await CAD.Exporter.saveFile(app, base + '.svg', svg, 'svg');
        } else {
          var pdf = CAD.Exporter.toPDF(doc, cfg);
          await CAD.Exporter.saveFile(app, base + '.pdf', pdf, 'pdf');
        }
        return true;
      }
    });
  };

  /* ------------------------------------------------------------
     Ayuda / Acerca de
     ------------------------------------------------------------ */
  UI.prototype.helpDialog = function () {
    var groups = {
      draw: 'Dibujo', modify: 'Modificar', dim: 'Acotación', annot: 'Anotación',
      layer: 'Capas', props: 'Propiedades', view: 'Vista', inquiry: 'Consulta',
      edit: 'Edición', file: 'Archivo', block: 'Bloques', settings: 'Parámetros', help: 'Ayuda', otros: 'Otros'
    };
    var byGroup = {};
    Cmd.order.forEach(function (n) {
      var d = Cmd.reg[n];
      (byGroup[d.group] = byGroup[d.group] || []).push(d);
    });
    var html = '<div style="color:var(--ink-dim);margin-bottom:8px">' +
      'Escriba el comando en la línea de comandos y pulse <b>Intro</b> o <b>Espacio</b>. ' +
      'Se aceptan los nombres en español y en inglés. Entre corchetes, las opciones: escriba las letras en mayúscula.</div>';
    html += '<fieldset><legend>Teclas</legend><div class="mono-out" style="max-height:150px">' +
      'Esc            Cancelar el comando en curso\n' +
      'Intro / Espacio Repetir el último comando / aceptar\n' +
      'F1  Ayuda        F3  Referencia a objetos   F7  Rejilla\n' +
      'F8  Orto         F9  Forzar cursor          F10 Rastreo polar\n' +
      'F12 Entrada dinámica                        Ctrl+0 Pantalla limpia\n' +
      'Ctrl+Z Deshacer  Ctrl+Y Rehacer   Ctrl+C/X/V Portapapeles\n' +
      'Ctrl+S Guardar   Ctrl+O Abrir     Ctrl+P Trazar   Ctrl+A Designar todo\n' +
      'Supr Borrar la selección   Rueda del ratón: zoom   Rueda pulsada: encuadre\n' +
      'Entrada de puntos:  x,y   @dx,dy   @dist&lt;ángulo   dist (distancia directa)' +
      '</div></fieldset>';
    Object.keys(groups).forEach(function (g) {
      if (!byGroup[g]) return;
      html += '<fieldset><legend>' + groups[g] + '</legend><table class="grid"><tbody>';
      byGroup[g].forEach(function (d) {
        var alias = Object.keys(Cmd.alias).filter(function (a) { return Cmd.alias[a] === d.name && a !== d.name; });
        html += '<tr><td style="width:150px"><b>' + d.name + '</b></td><td style="width:180px;color:var(--ink-mute)">' +
          esc(alias.slice(0, 5).join(', ')) + '</td><td>' + esc(d.title || '') + '</td></tr>';
      });
      html += '</tbody></table></fieldset>';
    });
    return this.dialog({
      title: 'Ayuda — Referencia de comandos', width: 720, body: html,
      buttons: [{ label: 'Cerrar', value: true, primary: true }]
    });
  };

  UI.prototype.aboutDialog = function () {
    var n = Object.keys(Cmd.reg).length;
    var body =
      '<div style="display:flex;gap:14px">' +
      '<div style="font-size:42px;line-height:1">📐</div>' +
      '<div><h3 style="margin:0 0 4px">MonxuCAD</h3>' +
      '<div style="color:var(--ink-dim);margin-bottom:8px">Estación de dibujo y diseño 2D para navegador</div>' +
      '<div class="mono-out" style="max-height:300px">' +
      n + ' comandos con nombre en español e inglés y sus alias.\n\n' +
      'Formatos de intercambio\n' +
      '  · Lectura   DXF ASCII (R12 … 2018), formato nativo .dcad\n' +
      '  · Escritura DXF R12 (AC1009) y DXF 2000 (AC1015)\n' +
      '  · Salida    PDF vectorial, SVG, PNG\n\n' +
      'Sobre el formato DWG\n' +
      '  DWG es un formato binario propietario de Autodesk sin\n' +
      '  especificación pública. Este programa no lo escribe.\n' +
      '  El DXF que genera lo abre AutoCAD de forma nativa; desde\n' +
      '  allí, GUARDARCOMO produce el .dwg equivalente. También\n' +
      '  sirve el conversor gratuito ODA File Converter.\n\n' +
      'Entidades\n' +
      '  LINE · LWPOLYLINE · CIRCLE · ARC · ELLIPSE · SPLINE\n' +
      '  POINT · TEXT · MTEXT · INSERT · ATTDEF · ATTRIB\n' +
      '  HATCH · SOLID · XLINE · RAY · LEADER\n' +
      '  DIMENSION (lineal, alineada, angular, radio, diámetro,\n' +
      '  longitud de arco, coordenada, marca de centro)\n\n' +
      'Incluye\n' +
      '  · ' + CAD.HatchLib.names().length + ' patrones de sombreado y carga de archivos .pat\n' +
      '  · ' + CAD.Blocks.defs.length + ' bloques de biblioteca en 6 categorías\n' +
      '  · ' + CAD.Templates.list.length + ' plantillas de dibujo (arquitectura, mecánica, …)\n' +
      '  · Espacio papel con ventanas gráficas a escala y cajetín\n' +
      '  · SCP móvil y girable, atributos de bloque, grupos' +
      '</div></div></div>';
    return this.dialog({
      title: 'Acerca de MonxuCAD', width: 560, body: body,
      buttons: [{ label: 'Cerrar', value: true, primary: true }]
    });
  };

  /* ------------------------------------------------------------
     Reserva si el visor no permite descargas
     ------------------------------------------------------------ */
  UI.prototype.downloadFallback = function (filename, data) {
    if (typeof data !== 'string') {
      this.dialog({
        title: 'No se puede entregar el archivo', width: 460,
        body: '<p>El visor ha bloqueado la descarga de <b>' + esc(filename) + '</b>.</p>' +
          '<p style="color:var(--ink-dim)">Abra esta página en una pestaña propia (botón «Abrir en una pestaña nueva») e inténtelo de nuevo, o exporte a DXF y copie el texto.</p>',
        buttons: [{ label: 'Cerrar', value: true, primary: true }]
      });
      return;
    }
    var self = this;
    this.dialog({
      title: 'Guardar ' + filename, width: 640,
      body: '<p style="margin-top:0">La descarga directa no está disponible en este visor. ' +
        'Copie el contenido y guárdelo con el nombre <b>' + esc(filename) + '</b>.</p>' +
        '<textarea class="code span2" id="dlTxt" style="width:100%" rows="12">' + esc(data) + '</textarea>',
      buttons: [{ label: 'Copiar al portapapeles', value: 'copy', primary: true }, { label: 'Cerrar', value: null }],
      onOk: function (b) {
        var ta = b.querySelector('#dlTxt');
        ta.select();
        try {
          if (navigator.clipboard) navigator.clipboard.writeText(ta.value);
          else document.execCommand('copy');
          self.flashResult('Contenido copiado al portapapeles.');
        } catch (e) { self.flashResult('Seleccione el texto y cópielo con Ctrl+C.'); }
        return true;
      }
    });
  };

  /* ------------------------------------------------------------
     Árbol de operaciones

     Es la pieza que hace paramétrico el modelado: lista las piezas del
     documento y, dentro de cada una, el árbol de operaciones con sus
     medidas.  Cambiar una medida reconstruye el sólido; se puede
     suprimir y restituir una operación sin perderla.
     ------------------------------------------------------------ */
  UI.prototype.renderTree = function () {
    var p = this.el.palettes;
    if (!p.classList.contains('open')) return;
    var self = this, app = this.app, doc = app.doc;
    var S = CAD.Solid;
    var piezas = (doc.visible ? doc.visible() : doc.entities).filter(function (e) { return S.is3D(e); });
    var head = '<div class="palette"><div class="palette-head"><span>Árbol de operaciones</span>' +
      '<button id="palClose" title="Cerrar" aria-label="Cerrar paleta">✕</button></div><div class="palette-body tree-body">';
    var html = head;
    if (!piezas.length) {
      html += '<div class="prop-empty">El documento no tiene sólidos.<br><br>' +
              'Cree uno con PRISMARECT, CILINDRO, EXTRUSION, REVOLUCION…</div>';
    } else {
      piezas.forEach(function (ent, ip) {
        var mesh = S.meshOf(ent);
        var sel = app.selSet.indexOf(ent) >= 0;
        var vol = mesh ? Math.abs(mesh.volume()) : 0;
        html += '<div class="tree-part' + (sel ? ' sel' : '') + '" data-part="' + ip + '">';
        html += '<div class="tree-part-head" data-pick="' + ip + '">' +
                '<span class="tree-ico">◧</span><b>' + esc(S.opName(ent.hist)) + ' ' + (ip + 1) + '</b>' +
                '<span class="tree-vol">' + G.fmt(vol, 2) + ' mm³</span></div>';
        var nodos = S.featureTree(ent);
        nodos.forEach(function (n, ix) {
          if (!n.ruta.length && nodos.length > 1) return;      /* la raíz ya es la cabecera */
          var sup = nodeSuppressed(ent, n.ruta);
          html += '<div class="tree-node' + (sup ? ' sup' : '') + '" style="padding-left:' +
                  (10 + n.nivel * 14) + 'px" data-part="' + ip + '" data-ruta="' + n.ruta.join('.') + '">';
          html += '<span class="tree-tog" title="Suprimir o restituir">' + (sup ? '○' : '●') + '</span>';
          html += '<span class="tree-name">' + esc(n.nombre) + '</span>';
          if (n.params.length) {
            html += '<div class="tree-params">';
            n.params.forEach(function (q) {
              html += '<label>' + esc(q.label) +
                '<input type="number" step="any" value="' + G.fmt(q.value, 4) +
                '" data-part="' + ip + '" data-ruta="' + n.ruta.join('.') + '" data-key="' + q.key + '"></label>';
            });
            html += '</div>';
          }
          html += '</div>';
        });
        html += '</div>';
      });
    }
    html += '</div></div>';
    p.innerHTML = html;

    function nodeSuppressed(ent, ruta) {
      if (!ruta.length) return false;
      var padre = ent.hist;
      for (var i = 0; i < ruta.length - 1; i++) {
        if (!padre || padre.op !== 'bool') return false;
        padre = padre.nodes[ruta[i]].hist;
      }
      if (!padre || padre.op !== 'bool' || !padre.nodes) return false;
      return !!padre.nodes[ruta[ruta.length - 1]].suprimido;
    }
    function piezaDe(i) { return piezas[+i]; }

    var close = p.querySelector('#palClose');
    if (close) close.addEventListener('click', function () { self.togglePalette('arbol', false); });

    /* designar la pieza al pulsar su cabecera */
    p.querySelectorAll('[data-pick]').forEach(function (el) {
      el.addEventListener('click', function () {
        var e = piezaDe(el.dataset.pick);
        if (!e) return;
        app.selSet = [e];
        app.v3dDirty && app.v3dDirty();
        app.refresh();
        self.renderTree();
      });
    });

    /* suprimir o restituir una operación */
    p.querySelectorAll('.tree-tog').forEach(function (el) {
      el.addEventListener('click', function (ev) {
        ev.stopPropagation();
        var nd = el.closest('.tree-node');
        var e = piezaDe(nd.dataset.part);
        if (!e || !nd.dataset.ruta) return;
        var ruta = nd.dataset.ruta.split('.').filter(function (x) { return x !== ''; }).map(Number);
        doc.mark('SUPRIMIR OPERACIÓN');
        CAD.Solid.toggleNode(e, ruta, doc);
        app.refresh(true);
        self.renderTree();
      });
    });

    /* editar una medida: el sólido se reconstruye al salir del campo */
    p.querySelectorAll('.tree-params input').forEach(function (inp) {
      function aplica() {
        var e = piezaDe(inp.dataset.part);
        if (!e) return;
        var v = parseFloat(inp.value);
        if (!isFinite(v)) return;
        var ruta = inp.dataset.ruta.split('.').filter(function (x) { return x !== ''; }).map(Number);
        var antes = CAD.Solid.histAt(e, ruta);
        if (!antes || antes[inp.dataset.key] === v) return;
        doc.mark('EDITAR OPERACIÓN');
        CAD.Solid.setParam(e, ruta, inp.dataset.key, v, doc);
        var m = CAD.Solid.meshOf(e);
        if (!m || !m.faces.length) {
          /* el cambio deja la pieza vacía: se deshace */
          CAD.Solid.setParam(e, ruta, inp.dataset.key, antes[inp.dataset.key], doc);
          app.out('Ese valor deja la pieza vacía; se ha conservado el anterior.', 'warn');
          inp.value = G.fmt(antes[inp.dataset.key], 4);
        }
        app.refresh(true);
        self.renderTree();
      }
      inp.addEventListener('change', aplica);
      inp.addEventListener('keydown', function (e) {
        if (e.key === 'Enter') { e.preventDefault(); aplica(); }
        e.stopPropagation();
      });
    });
  };

  /* ------------------------------------------------------------
     Paleta de propiedades
     ------------------------------------------------------------ */
  UI.prototype.togglePalette = function (name, show) {
    var p = this.el.palettes;
    var same = this.paletteKind === name;
    var open = show === undefined ? !(p.classList.contains('open') && same) : show;
    this.paletteKind = name || 'props';
    p.classList.toggle('open', open);
    if (open && this.paletteKind === 'blocks') this.renderBlocks();
    else if (open && this.paletteKind === 'arbol') this.renderTree();
    else this.renderProps();
    var app = this.app;
    setTimeout(function () { app.resize(); }, 10);
  };

  var TYPE_LABEL = {
    LINE: 'Línea', LWPOLYLINE: 'Polilínea', CIRCLE: 'Círculo', ARC: 'Arco', ELLIPSE: 'Elipse',
    POINT: 'Punto', TEXT: 'Texto', MTEXT: 'Texto múltiple', INSERT: 'Referencia a bloque',
    HATCH: 'Sombreado', SOLID: 'Sólido 2D', SPLINE: 'Spline', DIMENSION: 'Cota',
    LEADER: 'Directriz', XLINE: 'Línea auxiliar', RAY: 'Rayo'
  };

  UI.prototype.renderProps = function () {
    var p = this.el.palettes;
    if (!p.classList.contains('open')) return;
    if (this.paletteKind === 'blocks') return;
    if (this.paletteKind === 'arbol') { this.renderTree(); return; }
    var self = this, app = this.app, doc = app.doc;
    var sel = app.selSet;
    var head = '<div class="palette"><div class="palette-head"><span>Propiedades</span>' +
      '<button id="palClose" title="Cerrar" aria-label="Cerrar paleta">✕</button></div><div class="palette-body">';
    var html;
    if (!sel.length) {
      html = head + '<div class="prop-empty">Ningún objeto designado.<br><br>Seleccione objetos en el área de dibujo para ver y modificar sus propiedades.</div>';
    } else {
      var same = sel.every(function (e) { return e.type === sel[0].type; });
      var label = sel.length === 1 ? (TYPE_LABEL[sel[0].type] || sel[0].type)
        : (same ? (TYPE_LABEL[sel[0].type] || sel[0].type) + ' (' + sel.length + ')' : 'Varios (' + sel.length + ')');
      html = head + '<div class="prop-group"><h4>' + esc(label) + '</h4>';
      html += row('Color', colorSelect('pColor', sel[0].color));
      html += row('Capa', select('pLayer', doc.layerList().map(function (l) { return l.name; }), sel[0].layer));
      html += row('Tipo de línea', select('pLtype', ['ByLayer'].concat(Object.keys(doc.ltypes)), sel[0].ltype || 'ByLayer'));
      html += row('Escala de TL', input('pLts', sel[0].ltscale === undefined ? 1 : sel[0].ltscale, 'number'));
      html += row('Grosor de línea', select('pLw', ['-1|PorCapa', '-3|Por defecto', '0|0.00 mm', '13|0.13 mm', '18|0.18 mm', '25|0.25 mm', '35|0.35 mm', '50|0.50 mm', '70|0.70 mm', '100|1.00 mm', '200|2.00 mm'], String(sel[0].lw === undefined ? -1 : sel[0].lw), true));
      html += '</div>';
      if (sel.length === 1) html += geomGroup(sel[0], doc);
    }
    html += '</div></div>';
    p.innerHTML = html;

    var close = document.getElementById('palClose');
    if (close) close.addEventListener('click', function () { self.togglePalette('props', false); });

    /* El contenedor de paletas no se destruye al repintar: con
       addEventListener se acumulaba un oyente por cada repintado y cada
       cambio de propiedad se aplicaba también a las designaciones
       anteriores, marcando el histórico varias veces. */
    p.onchange = function (e) {
      var t = e.target;
      if (!t.id) return;
      doc.mark('PROPIEDADES');
      var v = t.value;
      sel.forEach(function (ent) {
        switch (t.id) {
          case 'pColor': ent.color = parseInt(v, 10); break;
          case 'pLayer': ent.layer = v; break;
          case 'pLtype': ent.ltype = v; break;
          case 'pLts': ent.ltscale = parseFloat(v) || 1; break;
          case 'pLw': ent.lw = parseInt(v, 10); break;
          default: applyGeom(ent, t.id, v, doc);
        }
      });
      app.refresh();
      self.renderProps();
    };

    function row(label, control) {
      return '<div class="prop-row"><label>' + label + '</label><div class="val">' + control + '</div></div>';
    }
    function input(id, val, type) {
      return '<input id="' + id + '" type="' + (type || 'text') + '" step="any" value="' + esc(val) + '">';
    }
    function select(id, items, cur, pairs) {
      return '<select id="' + id + '">' + items.map(function (it) {
        var v = it, l = it;
        if (pairs) { var s = it.split('|'); v = s[0]; l = s[1]; }
        return '<option value="' + esc(v) + '"' + (String(v) === String(cur) ? ' selected' : '') + '>' + esc(l === 'ByLayer' ? 'PorCapa' : l) + '</option>';
      }).join('') + '</select>';
    }
    function colorSelect(id, cur) {
      var opts = [[256, 'PorCapa'], [0, 'PorBloque'], [1, 'Rojo'], [2, 'Amarillo'], [3, 'Verde'], [4, 'Cian'], [5, 'Azul'], [6, 'Magenta'], [7, 'Blanco'], [8, 'Gris 8'], [9, 'Gris 9'], [30, 'Naranja'], [40, 'Ámbar']];
      if (typeof cur === 'object') cur = 256;
      if (!opts.some(function (o) { return o[0] === cur; })) opts.push([cur, 'Índice ' + cur]);
      return '<select id="' + id + '">' + opts.map(function (o) {
        return '<option value="' + o[0] + '"' + (o[0] === cur ? ' selected' : '') + '>' + o[1] + '</option>';
      }).join('') + '</select>';
    }
    function geomGroup(e, doc2) {
      var pr = doc2.vars.LUPREC;
      var h = '<div class="prop-group"><h4>Geometría</h4>';
      function r(l, id, v) { return row(l, input(id, G.fmt(v, pr), 'number')); }
      switch (e.type) {
        case 'LINE':
          h += r('X inicial', 'gX1', e.p1.x) + r('Y inicial', 'gY1', e.p1.y) +
            r('X final', 'gX2', e.p2.x) + r('Y final', 'gY2', e.p2.y) +
            row('Longitud', '<span style="padding-left:4px">' + G.fmt(G.dist(e.p1, e.p2), pr) + '</span>') +
            row('Ángulo', '<span style="padding-left:4px">' + G.fmt(G.deg(G.na(G.ang(e.p1, e.p2))), 2) + '°</span>');
          break;
        case 'CIRCLE':
          h += r('Centro X', 'gCX', e.c.x) + r('Centro Y', 'gCY', e.c.y) + r('Radio', 'gR', e.r) +
            row('Diámetro', '<span style="padding-left:4px">' + G.fmt(e.r * 2, pr) + '</span>') +
            row('Área', '<span style="padding-left:4px">' + G.fmt(Math.PI * e.r * e.r, pr) + '</span>');
          break;
        case 'ARC':
          h += r('Centro X', 'gCX', e.c.x) + r('Centro Y', 'gCY', e.c.y) + r('Radio', 'gR', e.r) +
            r('Ángulo inicial', 'gA0', G.deg(G.na(e.a0))) + r('Ángulo final', 'gA1', G.deg(G.na(e.a1)));
          break;
        case 'TEXT': case 'MTEXT':
          h += row('Contenido', input('gTxt', e.text)) + r('Altura', 'gH', e.h) +
            r('Rotación', 'gRot', G.deg(e.rot || 0)) + r('X', 'gPX', e.p.x) + r('Y', 'gPY', e.p.y) +
            row('Estilo', select('gStyle', Object.keys(doc2.textStyles), e.style));
          break;
        case 'LWPOLYLINE':
          h += row('Vértices', '<span style="padding-left:4px">' + e.verts.length + '</span>') +
            row('Cerrada', select('gClosed', ['0|No', '1|Sí'], e.closed ? '1' : '0', true)) +
            r('Grosor global', 'gW', e.width || 0) +
            row('Longitud', '<span style="padding-left:4px">' + G.fmt(G.polyLen(E.plinePts(e, 1), e.closed), pr) + '</span>');
          break;
        case 'INSERT':
          h += row('Nombre', '<span style="padding-left:4px">' + esc(e.name) + '</span>') +
            r('X', 'gPX', e.p.x) + r('Y', 'gPY', e.p.y) +
            r('Escala X', 'gSX', e.sx) + r('Escala Y', 'gSY', e.sy) + r('Rotación', 'gRot', G.deg(e.rot));
          break;
        case 'HATCH':
          h += row('Patrón', select('gPat', CAD.HatchLib.names(), e.pattern)) +
            r('Escala', 'gHSc', e.scale) + r('Ángulo', 'gHAng', G.deg(e.angle)) +
            r('Transparencia', 'gHTr', e.transparency || 0);
          break;
        case 'DIMENSION':
          h += row('Estilo', select('gDimStyle', Object.keys(doc2.dimStyles), e.style)) +
            row('Medida', '<span style="padding-left:4px">' + G.fmt(e.measurement, pr) + '</span>') +
            row('Texto sustituido', input('gDimTxt', e.textOverride || ''));
          break;
        case 'ELLIPSE':
          h += r('Centro X', 'gCX', e.c.x) + r('Centro Y', 'gCY', e.c.y) +
            r('Semieje mayor', 'gMaj', G.len(e.maj)) + r('Relación', 'gRatio', e.ratio);
          break;
        case 'POINT':
          h += r('X', 'gPX', e.p.x) + r('Y', 'gPY', e.p.y);
          break;
      }
      return h + '</div>';
    }
    function applyGeom(ent, id, v, doc2) {
      var n = parseFloat(v);
      switch (id) {
        case 'gX1': ent.p1.x = n; break;
        case 'gY1': ent.p1.y = n; break;
        case 'gX2': ent.p2.x = n; break;
        case 'gY2': ent.p2.y = n; break;
        case 'gCX': ent.c.x = n; break;
        case 'gCY': ent.c.y = n; break;
        case 'gR': if (n > 0) ent.r = n; break;
        case 'gA0': ent.a0 = G.rad(n); break;
        case 'gA1': ent.a1 = G.rad(n); break;
        case 'gTxt': ent.text = v; break;
        case 'gH': if (n > 0) ent.h = n; break;
        case 'gRot': ent.rot = G.rad(n); break;
        case 'gPX': ent.p.x = n; break;
        case 'gPY': ent.p.y = n; break;
        case 'gStyle': ent.style = v; break;
        case 'gClosed': ent.closed = v === '1'; break;
        case 'gW': ent.width = n; break;
        case 'gSX': ent.sx = n || 1; break;
        case 'gSY': ent.sy = n || 1; break;
        case 'gPat': ent.pattern = v; ent.solid = CAD.HatchLib.isSolid(v); break;
        case 'gHSc': if (n > 0) ent.scale = n; break;
        case 'gHAng': ent.angle = G.rad(n); break;
        case 'gHTr': ent.transparency = Math.max(0, Math.min(90, n)); break;
        case 'gDimStyle': ent.style = v; break;
        case 'gDimTxt': ent.textOverride = v; break;
        case 'gMaj': if (n > 0) ent.maj = G.mul(G.norm(ent.maj), n); break;
        case 'gRatio': if (n > 0 && n <= 1) ent.ratio = n; break;
      }
    }
  };
})();

/* ============================================================
   ui.js (3) — Diálogos adicionales y paleta de bloques
   ============================================================ */
(function () {
  'use strict';
  var CAD = window.CAD, G = CAD.G, E = CAD.E, Cmd = CAD.Cmd;
  var UI = CAD.UI, icon = CAD.icon;

  function esc(s) {
    return String(s === undefined || s === null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  /* ------------------------------------------------------------
     Estilos de texto
     ------------------------------------------------------------ */
  UI.prototype.textStyleDialog = function () {
    var self = this, doc = this.app.doc;
    var cur = doc.vars.TEXTSTYLE;
    var fonts = ['AcadStick', 'Arial', 'Arial Narrow', 'Times New Roman', 'Courier New', 'Verdana', 'Georgia'];
    function body() {
      var st = doc.textStyles[cur] || doc.textStyles.Standard;
      return '<div class="fields">' +
        '<label>Estilo:</label><select id="tsName">' + Object.keys(doc.textStyles).map(function (n) {
          return '<option' + (n === cur ? ' selected' : '') + '>' + esc(n) + '</option>';
        }).join('') + '</select>' +
        '<label>Tipo de letra:</label><select id="tsFont">' + fonts.map(function (f) {
          return '<option' + (f === (st.css || 'AcadStick') ? ' selected' : '') + '>' + f + '</option>';
        }).join('') + '</select>' +
        '<label>Altura fija:</label><input type="number" id="tsH" step="any" value="' + (st.h || 0) + '">' +
        '<label>Factor de anchura:</label><input type="number" id="tsW" step="any" value="' + (st.wfac || 1) + '">' +
        '<label>Ángulo oblicuo (°):</label><input type="number" id="tsO" step="any" value="' + (st.oblique || 0) + '">' +
        '<div class="span2" style="margin-top:8px;padding:10px;background:var(--chrome-2);border:1px solid var(--edge-soft)">' +
        '<span id="tsPrev" style="font-size:22px">AaBbCc 0123 ÁÉÑ</span></div>' +
        '<div class="span2" style="margin-top:8px"><button class="btn" id="tsNew">Nuevo estilo…</button> ' +
        '<button class="btn" id="tsCur">Definir actual</button></div>' +
        '</div>';
    }
    return this.dialog({
      title: 'Estilo de texto', width: 460, body: body(),
      onOpen: function (b) {
        function preview() {
          var f = b.querySelector('#tsFont').value;
          var w = parseFloat(b.querySelector('#tsW').value) || 1;
          var o = parseFloat(b.querySelector('#tsO').value) || 0;
          var el = b.querySelector('#tsPrev');
          el.style.fontFamily = '"' + f + '", "Arial Narrow", Arial, sans-serif';
          el.style.transform = 'scaleX(' + w + ') skewX(' + (-o) + 'deg)';
          el.style.display = 'inline-block';
        }
        b.addEventListener('input', preview);
        b.querySelector('#tsName').addEventListener('change', function (e) { cur = e.target.value; });
        b.querySelector('#tsNew').addEventListener('click', async function () {
          var n = await self.promptDialog('Nuevo estilo de texto', 'Nombre del estilo:', 'Estilo1');
          if (!n) return;
          doc.textStyles[n] = { name: n, font: 'arial.ttf', h: 0, wfac: 1, oblique: 0, css: 'Arial' };
          cur = n;
          b.closest('.modal-back').remove();
          self.textStyleDialog();
        });
        b.querySelector('#tsCur').addEventListener('click', function () {
          doc.vars.TEXTSTYLE = b.querySelector('#tsName').value;
          self.flashResult('Estilo actual: ' + doc.vars.TEXTSTYLE);
        });
        preview();
      },
      onOk: function (b) {
        var name = b.querySelector('#tsName').value;
        var st = doc.textStyles[name];
        if (!st) return true;
        doc.mark('ESTILO');
        st.css = b.querySelector('#tsFont').value;
        st.font = st.css === 'AcadStick' ? 'txt.shx' : st.css.toLowerCase().replace(/\s+/g, '') + '.ttf';
        st.h = parseFloat(b.querySelector('#tsH').value) || 0;
        st.wfac = parseFloat(b.querySelector('#tsW').value) || 1;
        st.oblique = parseFloat(b.querySelector('#tsO').value) || 0;
        doc.vars.TEXTSTYLE = name;
        return true;
      }
    });
  };

  /* ------------------------------------------------------------
     Renombrar
     ------------------------------------------------------------ */
  UI.prototype.renameDialog = function () {
    var doc = this.app.doc;
    var kinds = [['layer', 'Capas'], ['block', 'Bloques'], ['ltype', 'Tipos de línea'], ['style', 'Estilos de texto'], ['dim', 'Estilos de cota']];
    function itemsOf(k) {
      if (k === 'layer') return doc.layerOrder.slice();
      if (k === 'block') return Object.keys(doc.blocks).filter(function (n) { return n[0] !== '*'; });
      if (k === 'ltype') return Object.keys(doc.ltypes);
      if (k === 'style') return Object.keys(doc.textStyles);
      return Object.keys(doc.dimStyles);
    }
    var body = '<div class="fields">' +
      '<label>Objetos con nombre:</label><select id="rnKind">' + kinds.map(function (k) {
        return '<option value="' + k[0] + '">' + k[1] + '</option>';
      }).join('') + '</select>' +
      '<label>Elementos:</label><select id="rnItem" size="8" style="height:130px"></select>' +
      '<label>Nombre nuevo:</label><input type="text" id="rnNew">' +
      '</div>';
    return this.dialog({
      title: 'Renombrar', width: 420, body: body,
      onOpen: function (b) {
        function fill() {
          var k = b.querySelector('#rnKind').value;
          b.querySelector('#rnItem').innerHTML = itemsOf(k).map(function (n) {
            return '<option>' + esc(n) + '</option>';
          }).join('');
        }
        b.querySelector('#rnKind').addEventListener('change', fill);
        b.querySelector('#rnItem').addEventListener('change', function (e) {
          b.querySelector('#rnNew').value = e.target.value;
        });
        fill();
      },
      onOk: function (b) {
        var k = b.querySelector('#rnKind').value;
        var old = b.querySelector('#rnItem').value;
        var nw = b.querySelector('#rnNew').value.trim();
        if (!old || !nw || old === nw) return false;
        doc.mark('RENOMBRA');
        if (k === 'layer') {
          if (old === '0' || doc.layers[nw]) return false;
          doc.layers[nw] = doc.layers[old];
          doc.layers[nw].name = nw;
          delete doc.layers[old];
          doc.layerOrder = doc.layerOrder.map(function (n) { return n === old ? nw : n; });
          doc.entities.forEach(function (e) { if (e.layer === old) e.layer = nw; });
          doc.layouts.forEach(function (l) { l.entities.forEach(function (e) { if (e.layer === old) e.layer = nw; }); });
          if (doc.vars.CLAYER === old) doc.vars.CLAYER = nw;
        } else if (k === 'block') {
          if (doc.blocks[nw]) return false;
          doc.blocks[nw] = doc.blocks[old];
          doc.blocks[nw].name = nw;
          delete doc.blocks[old];
          doc.entities.forEach(function (e) { if (e.type === 'INSERT' && e.name === old) e.name = nw; });
        } else if (k === 'ltype') {
          doc.ltypes[nw] = doc.ltypes[old]; doc.ltypes[nw].name = nw; delete doc.ltypes[old];
          doc.entities.forEach(function (e) { if (e.ltype === old) e.ltype = nw; });
          doc.layerList().forEach(function (l) { if (l.ltype === old) l.ltype = nw; });
        } else if (k === 'style') {
          doc.textStyles[nw] = doc.textStyles[old]; doc.textStyles[nw].name = nw; delete doc.textStyles[old];
          doc.entities.forEach(function (e) { if (e.style === old) e.style = nw; });
          if (doc.vars.TEXTSTYLE === old) doc.vars.TEXTSTYLE = nw;
        } else {
          doc.dimStyles[nw] = doc.dimStyles[old]; doc.dimStyles[nw].name = nw; delete doc.dimStyles[old];
          doc.entities.forEach(function (e) { if (e.type === 'DIMENSION' && e.style === old) e.style = nw; });
          if (doc.vars.DIMSTYLE === old) doc.vars.DIMSTYLE = nw;
        }
        return true;
      }
    });
  };

  /* ------------------------------------------------------------
     Vistas guardadas
     ------------------------------------------------------------ */
  UI.prototype.viewDialog = function (views) {
    var names = Object.keys(views);
    var body = '<div class="grid-wrap" style="max-height:200px"><table class="grid"><thead><tr><th>Vista guardada</th></tr></thead><tbody id="vwBody">' +
      (names.length ? names.map(function (n) { return '<tr data-n="' + esc(n) + '"><td>' + esc(n) + '</td></tr>'; }).join('')
        : '<tr><td style="color:var(--ink-mute)">(ninguna vista guardada)</td></tr>') +
      '</tbody></table></div>' +
      '<div class="fields" style="margin-top:10px"><label>Nombre:</label><input type="text" id="vwName" value="Vista' + (names.length + 1) + '"></div>';
    var sel = null, action = null;
    return this.dialog({
      title: 'Administrador de vistas', width: 420, body: body,
      buttons: [
        { label: 'Guardar actual', value: 'save', primary: true },
        { label: 'Restablecer', value: 'restore' },
        { label: 'Suprimir', value: 'delete' },
        { label: 'Cerrar', value: null }
      ],
      onOpen: function (b) {
        b.querySelector('#vwBody').addEventListener('click', function (e) {
          var tr = e.target.closest('[data-n]');
          if (!tr) return;
          Array.prototype.forEach.call(b.querySelectorAll('#vwBody tr'), function (r) { r.classList.remove('sel'); });
          tr.classList.add('sel');
          sel = tr.dataset.n;
          b.querySelector('#vwName').value = sel;
        });
      },
      onOk: function (b, val) {
        var name = b.querySelector('#vwName').value.trim();
        if (val === 'save') return name ? { action: 'save', name: name } : false;
        if (!sel && !name) return false;
        return { action: val, name: sel || name };
      }
    });
  };

  /* ------------------------------------------------------------
     Degradado
     ------------------------------------------------------------ */
  UI.prototype.gradientDialog = function () {
    var body = '<div class="fields">' +
      '<label>Color inicial:</label><input type="color" id="grA" value="#2f7fd1">' +
      '<label>Color final:</label><input type="color" id="grB" value="#ffffff">' +
      '</div>';
    return this.dialog({
      title: 'Degradado', width: 340, body: body,
      onOk: function (b) { return { a: b.querySelector('#grA').value, b: b.querySelector('#grB').value }; }
    });
  };

  /* ------------------------------------------------------------
     Cargar archivo .pat
     ------------------------------------------------------------ */
  UI.prototype.patDialog = function () {
    var body = '<p style="margin-top:0">Pegue el contenido de un archivo <b>.pat</b> de AutoCAD, o cárguelo desde disco.</p>' +
      '<div class="fields">' +
      '<div class="span2"><input type="file" id="ptFile" accept=".pat,.txt"></div>' +
      '<textarea class="code span2" id="ptTxt" rows="9" placeholder="*MIPATRON, descripción&#10;45, 0,0, 0,3.175"></textarea>' +
      '<div class="span2"><label class="check"><input type="checkbox" id="ptMm"> El archivo ya está en milímetros (acadiso.pat)</label></div>' +
      '</div>';
    return this.dialog({
      title: 'Cargar patrones de sombreado', width: 560, body: body, enterOk: false,
      onOpen: function (b) {
        b.querySelector('#ptFile').addEventListener('change', function (e) {
          var f = e.target.files && e.target.files[0];
          if (!f) return;
          var rd = new FileReader();
          rd.onload = function () { b.querySelector('#ptTxt').value = String(rd.result); };
          rd.readAsText(f);
        });
      },
      onOk: function (b) {
        var t = b.querySelector('#ptTxt').value.trim();
        if (!t) return false;
        return { text: t, mm: b.querySelector('#ptMm').checked };
      }
    });
  };

  /* ------------------------------------------------------------
     Atributos
     ------------------------------------------------------------ */
  UI.prototype.attdefDialog = function () {
    var doc = this.app.doc;
    var body = '<div class="fields">' +
      '<label>Etiqueta:</label><input type="text" id="adTag" value="ETIQUETA">' +
      '<label>Solicitud:</label><input type="text" id="adPrompt" value="Introduzca el valor">' +
      '<label>Valor por defecto:</label><input type="text" id="adDef" value="">' +
      '<label>Altura de texto:</label><input type="number" id="adH" step="any" value="' + doc.vars.TEXTSIZE + '">' +
      '<label>Rotación (°):</label><input type="number" id="adRot" step="any" value="0">' +
      '</div>';
    return this.dialog({
      title: 'Definición de atributo', width: 420, body: body,
      onOk: function (b) {
        var tag = b.querySelector('#adTag').value.trim().toUpperCase();
        if (!tag) return false;
        return {
          tag: tag,
          prompt: b.querySelector('#adPrompt').value,
          def: b.querySelector('#adDef').value,
          h: parseFloat(b.querySelector('#adH').value) || doc.vars.TEXTSIZE,
          rot: parseFloat(b.querySelector('#adRot').value) || 0
        };
      }
    });
  };

  UI.prototype.attribDialog = function (blockName, attrs) {
    if (!attrs || !attrs.length) return Promise.resolve(null);
    var body = '<div style="color:var(--ink-dim);margin-bottom:8px">Bloque: <b>' + esc(blockName) + '</b></div>' +
      '<div class="fields">' + attrs.map(function (a, i) {
        return '<label>' + esc(a.prompt || a.tag) + ':</label><input type="text" id="at' + i + '" value="' + esc(a.value) + '">';
      }).join('') + '</div>';
    return this.dialog({
      title: 'Editar atributos', width: 460, body: body,
      onOk: function (b) {
        return attrs.map(function (a, i) { return b.querySelector('#at' + i).value; });
      }
    });
  };

  /* ------------------------------------------------------------
     Espacio papel
     ------------------------------------------------------------ */
  var VP_SCALES = [
    ['1:1', 1], ['1:2', 0.5], ['1:5', 0.2], ['1:10', 0.1], ['1:20', 0.05], ['1:25', 0.04],
    ['1:50', 0.02], ['1:75', 1 / 75], ['1:100', 0.01], ['1:200', 0.005], ['1:250', 0.004],
    ['1:500', 0.002], ['1:1000', 0.001], ['2:1', 2], ['5:1', 5], ['10:1', 10]
  ];

  UI.prototype.vpScaleDialog = function (vp) {
    var body = '<div class="fields">' +
      '<label>Escala de ventana:</label><select id="vsSel">' +
      VP_SCALES.map(function (s) {
        return '<option value="' + s[1] + '"' + (Math.abs(s[1] - vp.scale) < 1e-9 ? ' selected' : '') + '>' + s[0] + '</option>';
      }).join('') + '<option value="custom">Personalizada…</option></select>' +
      '<label>Valor:</label><input type="number" id="vsVal" step="any" value="' + vp.scale + '">' +
      '<div class="span2"><label class="check"><input type="checkbox" id="vsLock"' + (vp.locked ? ' checked' : '') + '> Bloquear la visualización de la ventana</label></div>' +
      '</div><p style="color:var(--ink-mute);margin:8px 0 0">La escala es el cociente entre milímetros de papel y unidades de dibujo.</p>';
    return this.dialog({
      title: 'Escala de la ventana gráfica', width: 400, body: body,
      onOpen: function (b) {
        b.querySelector('#vsSel').addEventListener('change', function (e) {
          if (e.target.value !== 'custom') b.querySelector('#vsVal').value = e.target.value;
        });
      },
      onOk: function (b) {
        var v = parseFloat(b.querySelector('#vsVal').value);
        if (!(v > 0)) return false;
        return { scale: v, locked: b.querySelector('#vsLock').checked };
      }
    });
  };

  UI.prototype.layoutDialog = function () {
    var self = this, doc = this.app.doc, app = this.app;
    function rows() {
      return doc.layouts.map(function (l, i) {
        return '<tr data-i="' + i + '"><td>' + esc(l.name) + '</td><td>' + l.w + ' × ' + l.h + ' mm</td>' +
          '<td>' + (l.viewports ? l.viewports.length : 0) + ' ventana(s)</td></tr>';
      }).join('');
    }
    var body = '<div style="display:flex;gap:6px;margin-bottom:8px">' +
      '<button class="btn" id="loNew">Nueva</button><button class="btn" id="loDel">Suprimir</button>' +
      '<button class="btn" id="loRen">Renombrar</button></div>' +
      '<div class="grid-wrap"><table class="grid"><thead><tr><th>Presentación</th><th>Papel</th><th>Contenido</th></tr></thead>' +
      '<tbody id="loBody">' + rows() + '</tbody></table></div>';
    var sel = 0;
    return this.dialog({
      title: 'Presentaciones', width: 480, body: body,
      buttons: [{ label: 'Cerrar', value: true, primary: true }],
      onOpen: function (b) {
        var tb = b.querySelector('#loBody');
        function refresh() { tb.innerHTML = rows(); self.buildLayoutTabs(); }
        tb.addEventListener('click', function (e) {
          var tr = e.target.closest('[data-i]');
          if (!tr) return;
          sel = parseInt(tr.dataset.i, 10);
          Array.prototype.forEach.call(tb.querySelectorAll('tr'), function (r) { r.classList.remove('sel'); });
          tr.classList.add('sel');
        });
        b.querySelector('#loNew').addEventListener('click', async function () {
          var n = await self.promptDialog('Nueva presentación', 'Nombre:', 'Presentación' + (doc.layouts.length + 1));
          if (!n) return;
          doc.mark('PRESENTACION');
          doc.layouts.push({ name: n, w: 420, h: 297, margin: 10, entities: [], viewports: [] });
          refresh();
        });
        b.querySelector('#loDel').addEventListener('click', function () {
          if (doc.layouts.length <= 1) { self.flashResult('Debe quedar al menos una presentación.'); return; }
          doc.mark('PRESENTACION');
          doc.layouts.splice(sel, 1);
          if (app.layoutIndex >= doc.layouts.length) app.setLayout(-1);
          sel = 0;
          refresh();
        });
        b.querySelector('#loRen').addEventListener('click', async function () {
          var n = await self.promptDialog('Renombrar presentación', 'Nombre:', doc.layouts[sel].name);
          if (!n) return;
          doc.layouts[sel].name = n;
          refresh();
        });
      }
    });
  };

  UI.prototype.pageSetupDialog = function (lay) {
    var papers = CAD.Exporter.PAPERS;
    var names = Object.keys(papers);
    var cur = names.filter(function (n) {
      var p = papers[n];
      return (Math.abs(p.w - lay.w) < .5 && Math.abs(p.h - lay.h) < .5) || (Math.abs(p.h - lay.w) < .5 && Math.abs(p.w - lay.h) < .5);
    })[0] || names[1];
    var body = '<div class="fields">' +
      '<label>Tamaño de papel:</label><select id="psPaper">' + names.map(function (n) {
        return '<option' + (n === cur ? ' selected' : '') + '>' + n + '</option>';
      }).join('') + '</select>' +
      '<label>Orientación:</label><select id="psOri"><option' + (lay.w >= lay.h ? ' selected' : '') + '>Horizontal</option><option' + (lay.w < lay.h ? ' selected' : '') + '>Vertical</option></select>' +
      '<label>Margen (mm):</label><input type="number" id="psM" step="any" value="' + (lay.margin || 10) + '">' +
      '</div>';
    return this.dialog({
      title: 'Configurar página — ' + lay.name, width: 420, body: body,
      onOk: function (b) {
        var p = papers[b.querySelector('#psPaper').value];
        var horiz = b.querySelector('#psOri').value === 'Horizontal';
        lay.w = horiz ? Math.max(p.w, p.h) : Math.min(p.w, p.h);
        lay.h = horiz ? Math.min(p.w, p.h) : Math.max(p.w, p.h);
        lay.margin = parseFloat(b.querySelector('#psM').value) || 10;
        return true;
      }
    });
  };

  /* ------------------------------------------------------------
     Plantillas
     ------------------------------------------------------------ */
  UI.prototype.templateDialog = function () {
    var list = CAD.Templates.list;
    var body = '<div class="grid-wrap" style="max-height:330px"><table class="grid"><tbody>' +
      list.map(function (t, i) {
        return '<tr data-id="' + t.id + '"' + (i === 0 ? ' class="sel"' : '') + '>' +
          '<td style="width:170px"><b>' + esc(t.name) + '</b><br><span style="color:var(--ink-mute)">' + esc(t.units) + '</span></td>' +
          '<td>' + esc(t.desc) + '</td></tr>';
      }).join('') + '</tbody></table></div>';
    var sel = list[0].id;
    return this.dialog({
      title: 'Seleccionar plantilla de dibujo', width: 620, body: body,
      buttons: [{ label: 'Abrir', value: true, primary: true }, { label: 'Cancelar', value: null }],
      onOpen: function (b) {
        b.addEventListener('click', function (e) {
          var tr = e.target.closest('[data-id]');
          if (!tr) return;
          Array.prototype.forEach.call(b.querySelectorAll('tr'), function (r) { r.classList.remove('sel'); });
          tr.classList.add('sel');
          sel = tr.dataset.id;
        });
      },
      onOk: function () { return sel; }
    });
  };

  /* ------------------------------------------------------------
     Paleta de bloques
     ------------------------------------------------------------ */
  UI.prototype.renderBlocks = function () {
    var self = this, app = this.app, doc = app.doc;
    var cats = CAD.Blocks.categories();
    this.blockCat = this.blockCat || cats[0];
    var docBlocks = Object.keys(doc.blocks).filter(function (n) { return n[0] !== '*' && !doc.blocks[n].lib; });
    var html = '<div class="palette"><div class="palette-head"><span>Paleta de herramientas</span>' +
      '<button id="palClose2" title="Cerrar" aria-label="Cerrar paleta">✕</button></div>' +
      '<div class="bl-tabs">' + cats.map(function (c) {
        return '<button class="bl-tab' + (c === self.blockCat ? ' on' : '') + '" data-cat="' + esc(c) + '">' + esc(c) + '</button>';
      }).join('') + (docBlocks.length ? '<button class="bl-tab' + (self.blockCat === '__doc' ? ' on' : '') + '" data-cat="__doc">Del dibujo</button>' : '') + '</div>' +
      '<div class="palette-body"><div class="bl-grid">';
    if (this.blockCat === '__doc') {
      html += docBlocks.map(function (n) {
        return '<button class="bl-item" data-doc="' + esc(n) + '" title="' + esc(n) + '">' +
          '<span class="bl-th">' + icon('block') + '</span><span class="bl-name">' + esc(n) + '</span></button>';
      }).join('');
    } else {
      CAD.Blocks.defs.filter(function (b) { return b.cat === self.blockCat; }).forEach(function (b) {
        html += '<button class="bl-item" data-blk="' + esc(b.n) + '" title="' + esc(b.d) + '">' +
          '<span class="bl-th">' + CAD.Blocks.thumb(b.n, 54, 40) + '</span>' +
          '<span class="bl-name">' + esc(b.n) + '</span></button>';
      });
    }
    html += '</div></div></div>';
    this.el.palettes.innerHTML = html;

    var pc = document.getElementById('palClose2');
    if (pc) pc.addEventListener('click', function () { self.togglePalette('blocks', false); });
    this.el.palettes.onclick = function (e) {
      var t = e.target.closest('[data-cat]');
      if (t) { self.blockCat = t.dataset.cat; self.renderBlocks(); return; }
      var b = e.target.closest('[data-blk]');
      if (b) { self.insertLibraryBlock(b.dataset.blk); return; }
      var d = e.target.closest('[data-doc]');
      if (d) { app.insertBlockByName(d.dataset.doc); }
    };
  };

  UI.prototype.insertLibraryBlock = function (name) {
    var app = this.app;
    CAD.Blocks.ensure(app.doc, name);
    app.insertBlockByName(name);
  };
})();

/* ============================================================
   ui.js (4) — Tabla y calculadora
   ============================================================ */
(function () {
  'use strict';
  var CAD = window.CAD, G = CAD.G;
  var UI = CAD.UI;

  function esc(s) {
    return String(s === undefined || s === null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  UI.prototype.tableDialog = function (textH) {
    var h = textH || 2.5;
    var body =
      '<div class="fields">' +
      '<label>Título:</label><input type="text" id="tbTitle" value="TABLA">' +
      '<label>Columnas:</label><input type="number" id="tbCols" min="1" max="12" value="3">' +
      '<label>Filas de datos:</label><input type="number" id="tbRows" min="1" max="20" value="4">' +
      '<label>Ancho de columna:</label><input type="number" id="tbCw" step="any" value="' + (h * 16).toFixed(2) + '">' +
      '<label>Alto de fila:</label><input type="number" id="tbRh" step="any" value="' + (h * 2.4).toFixed(2) + '">' +
      '<label>Altura de texto:</label><input type="number" id="tbH" step="any" value="' + h + '">' +
      '</div>' +
      '<fieldset><legend>Contenido</legend><div id="tbGrid" style="overflow:auto;max-height:230px"></div></fieldset>';
    return this.dialog({
      title: 'Insertar tabla', width: 560, body: body,
      onOpen: function (b) {
        function build() {
          var nc = Math.max(1, Math.min(12, parseInt(b.querySelector('#tbCols').value, 10) || 3));
          var nr = Math.max(1, Math.min(20, parseInt(b.querySelector('#tbRows').value, 10) || 4));
          var html = '<table class="grid"><tbody>';
          for (var r = 0; r < nr; r++) {
            html += '<tr>';
            for (var c = 0; c < nc; c++) {
              var prev = b.querySelector('#tc' + r + '_' + c);
              var v = prev ? prev.value : (r === 0 ? 'Col ' + (c + 1) : '');
              html += '<td style="padding:1px"><input type="text" id="tc' + r + '_' + c +
                '" value="' + esc(v) + '" style="width:100%;background:var(--chrome-2);border:1px solid var(--edge-soft);color:var(--ink);padding:2px 4px"></td>';
            }
            html += '</tr>';
          }
          b.querySelector('#tbGrid').innerHTML = html + '</tbody></table>';
        }
        b.querySelector('#tbCols').addEventListener('input', build);
        b.querySelector('#tbRows').addEventListener('input', build);
        build();
      },
      onOk: function (b) {
        var nc = Math.max(1, Math.min(12, parseInt(b.querySelector('#tbCols').value, 10) || 3));
        var nr = Math.max(1, Math.min(20, parseInt(b.querySelector('#tbRows').value, 10) || 4));
        var data = [];
        for (var r = 0; r < nr; r++) {
          var row = [];
          for (var c = 0; c < nc; c++) {
            var el = b.querySelector('#tc' + r + '_' + c);
            row.push(el ? el.value : '');
          }
          data.push(row);
        }
        return {
          title: b.querySelector('#tbTitle').value.trim(),
          cols: nc, rows: nr,
          colw: parseFloat(b.querySelector('#tbCw').value) || 40,
          rowh: parseFloat(b.querySelector('#tbRh').value) || 6,
          h: parseFloat(b.querySelector('#tbH').value) || 2.5,
          data: data
        };
      }
    });
  };

  UI.prototype.calcDialog = function () {
    var self = this, app = this.app;
    var body =
      '<div class="fields">' +
      '<label>Expresión:</label><input type="text" id="qcIn" placeholder="120*3+sqrt(2)  ·  sin(30)  ·  pi*10^2">' +
      '<label>Resultado:</label><input type="text" id="qcOut" readonly style="font-family:var(--font-mono);font-size:15px">' +
      '</div>' +
      '<div style="color:var(--ink-mute);margin-top:8px;font-size:11px">' +
      'Operadores + − * / % ^ y paréntesis. Funciones: sin cos tan asin acos atan sqrt abs ln log exp round floor ceil. ' +
      'Constantes: pi, e. Los ángulos van en grados.</div>' +
      '<div id="qcHist" class="mono-out" style="margin-top:8px;max-height:140px"></div>';
    return this.dialog({
      title: 'Calculadora rápida', width: 460, body: body,
      buttons: [{ label: 'Pegar en la línea de comandos', value: 'paste', primary: true }, { label: 'Cerrar', value: null }],
      onOpen: function (b) {
        var hist = [];
        function evalNow() {
          var v = b.querySelector('#qcIn').value.trim();
          var out = b.querySelector('#qcOut');
          if (!v) { out.value = ''; return; }
          try {
            var r = CAD.calc(v);
            out.value = G.fmt(r, 6).replace(/\.?0+$/, '');
            out.style.color = '';
          } catch (e) {
            out.value = e.message;
            out.style.color = 'var(--err)';
          }
        }
        b.querySelector('#qcIn').addEventListener('input', evalNow);
        b.querySelector('#qcIn').addEventListener('keydown', function (e) {
          if (e.key !== 'Enter') return;
          e.preventDefault();
          evalNow();
          var v = b.querySelector('#qcIn').value.trim();
          var r = b.querySelector('#qcOut').value;
          if (v && r) {
            hist.unshift(v + '  =  ' + r);
            b.querySelector('#qcHist').textContent = hist.slice(0, 12).join('\n');
          }
        });
        evalNow();
      },
      onOk: function (b) {
        var r = b.querySelector('#qcOut').value;
        if (!r || isNaN(parseFloat(r))) return false;
        var inp = document.getElementById('cmdinput');
        inp.value = r;
        setTimeout(function () { inp.focus(); }, 30);
        app.out('Calculadora: ' + b.querySelector('#qcIn').value + ' = ' + r);
        return true;
      }
    });
  };
})();
