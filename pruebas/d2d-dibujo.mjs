import { abreBanco, cerca, cierra } from './banco.mjs';

const { nav, pag, ruido } = await abreBanco();
const fallos = [];
function comprueba(nombre, condicion, detalle) {
  if (condicion) console.log('  ok   ' + nombre);
  else { console.log('  MAL  ' + nombre + '  —  ' + detalle); fallos.push(nombre + ': ' + detalle); }
}

async function caso(titulo, comando, entradas, revision) {
  await pag.evaluate(() => window.__banco.limpia());
  const r = await pag.evaluate(([c, e]) => window.__banco.orden(c, e), [comando, entradas]);
  const ents = await pag.evaluate(() => window.__banco.ents());
  console.log('\n' + titulo + '   [' + comando + ' ' + JSON.stringify(entradas) + ']  -> ' + r + ', ' + ents.length + ' obj: ' + ents.map(e => e.type).join(','));
  if (r !== 'ok') { fallos.push(titulo + ': ' + r); return; }
  revision(ents);
}

/* ---------- LINEA ---------- */
await caso('Línea entre dos puntos', 'LINEA', ['0,0', '100,0', '\n'], (e) => {
  comprueba('una sola LINE', e.length === 1 && e[0].type === 'LINE', JSON.stringify(e.map(x => x.type)));
  if (e[0]) comprueba('extremos correctos',
    cerca(e[0].p1.x, 0) && cerca(e[0].p1.y, 0) && cerca(e[0].p2.x, 100) && cerca(e[0].p2.y, 0),
    JSON.stringify([e[0].p1, e[0].p2]));
});

await caso('Línea encadenada: tres puntos dan dos segmentos', 'LINEA', ['0,0', '100,0', '100,50', '\n'], (e) => {
  comprueba('dos LINE', e.length === 2 && e.every(x => x.type === 'LINE'), e.length + ' obj');
  if (e.length === 2) comprueba('la segunda empieza donde acaba la primera',
    cerca(e[1].p1.x, e[0].p2.x) && cerca(e[1].p1.y, e[0].p2.y), JSON.stringify([e[0].p2, e[1].p1]));
});

await caso('Línea con coordenada relativa @', 'LINEA', ['10,10', '@50,0', '\n'], (e) => {
  comprueba('acaba en 60,10', e[0] && cerca(e[0].p2.x, 60) && cerca(e[0].p2.y, 10), JSON.stringify(e[0] && e[0].p2));
});

await caso('Línea por distancia y ángulo @d<a', 'LINEA', ['0,0', '@100<30', '\n'], (e) => {
  const p = e[0] && e[0].p2;
  comprueba('acaba en (86.6025, 50)', p && cerca(p.x, 100 * Math.cos(Math.PI / 6), 1e-6) && cerca(p.y, 50, 1e-6), JSON.stringify(p));
});

/* ---------- CIRCULO ---------- */
await caso('Círculo por centro y radio', 'CIRCULO', ['50,50', '25', '\n'], (e) => {
  comprueba('un CIRCLE', e.length === 1 && e[0].type === 'CIRCLE', e.map(x => x.type).join(','));
  if (e[0]) comprueba('centro y radio', cerca(e[0].c.x, 50) && cerca(e[0].c.y, 50) && cerca(e[0].r, 25),
    JSON.stringify([e[0].c, e[0].r]));
});

await caso('Círculo por dos puntos del diámetro', 'CIRCULO', ['2P', '0,0', '100,0', '\n'], (e) => {
  comprueba('centro 50,0 y radio 50', e[0] && cerca(e[0].c.x, 50) && cerca(e[0].c.y, 0) && cerca(e[0].r, 50),
    JSON.stringify(e[0] && [e[0].c, e[0].r]));
});

await caso('Círculo por tres puntos', 'CIRCULO', ['3P', '0,0', '100,0', '50,50', '\n'], (e) => {
  const c = e[0];
  comprueba('pasa por los tres puntos', c && [[0,0],[100,0],[50,50]].every(([x,y]) => cerca(Math.hypot(x - c.c.x, y - c.c.y), c.r, 1e-6)),
    JSON.stringify(c && [c.c, c.r]));
});

/* ---------- RECTANGULO ---------- */
await caso('Rectángulo', 'RECTANG', ['0,0', '100,50', '\n'], (e) => {
  const p = e[0];
  comprueba('una polilínea', p && p.type === 'LWPOLYLINE', e.map(x => x.type).join(','));
  if (p) {
    comprueba('cerrada', !!p.closed, String(p.closed));
    comprueba('cuatro vértices', p.verts && p.verts.length === 4, p.verts && p.verts.length);
    const xs = (p.verts || []).map(v => v.x), ys = (p.verts || []).map(v => v.y);
    comprueba('esquinas en 0..100 x 0..50',
      Math.min(...xs) === 0 && Math.max(...xs) === 100 && Math.min(...ys) === 0 && Math.max(...ys) === 50,
      JSON.stringify(p.verts));
  }
});

/* ---------- POLIGONO ---------- */
await caso('Polígono de 6 lados inscrito en r=50', 'POLIGONO', ['6', '0,0', 'I', '50', '\n'], (e) => {
  const p = e[0];
  comprueba('polilínea cerrada de 6 vértices', p && p.type === 'LWPOLYLINE' && p.closed && p.verts.length === 6,
    p ? p.type + ' cerrada=' + p.closed + ' n=' + (p.verts && p.verts.length) : 'nada');
  if (p && p.verts) comprueba('todos los vértices a 50 del centro',
    p.verts.every(v => cerca(Math.hypot(v.x, v.y), 50, 1e-6)),
    JSON.stringify(p.verts.map(v => +Math.hypot(v.x, v.y).toFixed(6))));
});

/* ---------- ARCO ---------- */
await caso('Arco por tres puntos', 'ARCO', ['0,0', '50,50', '100,0'], (e) => {
  const a = e[0];
  comprueba('un ARC', a && a.type === 'ARC', e.map(x => x.type).join(','));
  if (a) {
    const enArco = (x, y) => cerca(Math.hypot(x - a.c.x, y - a.c.y), a.r, 1e-6);
    comprueba('pasa por los tres puntos', enArco(0,0) && enArco(50,50) && enArco(100,0),
      JSON.stringify([a.c, a.r, a.a1, a.a2]));
  }
});

/* ---------- ELIPSE ---------- */
await caso('Elipse por eje y radio menor', 'ELIPSE', ['-50,0', '50,0', '25'], (e) => {
  const el = e[0];
  comprueba('una ELLIPSE', el && el.type === 'ELLIPSE', e.map(x => x.type).join(','));
  if (el) comprueba('centro en el origen', cerca(el.c.x, 0) && cerca(el.c.y, 0), JSON.stringify(el.c));
});

/* ---------- POLILINEA ---------- */
await caso('Polilínea de tres tramos', 'POL', ['0,0', '100,0', '100,50', '0,50', '\n'], (e) => {
  const p = e[0];
  comprueba('una LWPOLYLINE', p && p.type === 'LWPOLYLINE', e.map(x => x.type).join(','));
  if (p) comprueba('cuatro vértices', p.verts && p.verts.length === 4, p.verts && p.verts.length);
});

await caso('Polilínea cerrada con la opción C', 'POL', ['0,0', '100,0', '100,50', 'C'], (e) => {
  const p = e[0];
  comprueba('queda cerrada', p && p.closed, p ? 'cerrada=' + p.closed : 'nada');
});

/* ---------- PUNTO ---------- */
await caso('Punto', 'PUNTO', ['10,20', '\n'], (e) => {
  comprueba('un POINT en 10,20', e[0] && e[0].type === 'POINT' && cerca(e[0].p.x, 10) && cerca(e[0].p.y, 20),
    JSON.stringify(e[0]));
});

cierra(fallos, ruido);
await nav.close();
