import { abreBanco, cerca, cierra } from './banco.mjs';

const { nav, pag, ruido } = await abreBanco();
const fallos = [];
function ok(n, c, d) { if (c) console.log('  ok   ' + n); else { console.log('  MAL  ' + n + '  —  ' + d); fallos.push(n + ' — ' + d); } }

async function corre(prep, comando, entradas) {
  await pag.evaluate(() => window.__banco.limpia());
  await pag.evaluate(l => window.__banco.pon(l), prep);
  const r = await pag.evaluate(([c, e]) => window.__banco.orden(c, e), [comando, entradas]);
  const ents = await pag.evaluate(() => window.__banco.ents());
  return { r, ents };
}
const L = (x1, y1, x2, y2) => ({ t: 'linea', x1, y1, x2, y2 });
const A = (x, y, r, a1, a2) => ({ t: 'arco', x, y, r, a1, a2 });

/* Esquina en (100,0): horizontal 0..100 y vertical 0..100.
   Se designa cerca de la esquina, que es como se empalma de verdad. */
for (const [titulo, px, py, qx, qy] of [
  ['designando cerca de la esquina (80 y 20)', 80, 0, 100, 20],
  ['designando lejos de la esquina (20 y 80)', 20, 0, 100, 80],
  ['designando justo en la mitad (50 y 50)', 50, 0, 100, 50]
]) {
  const { r, ents } = await corre([L(0, 0, 100, 0), L(100, 0, 100, 100)], 'EMPALME',
    ['RA', '10', ['pica', 0, px, py], ['pica', 1, qx, qy]]);
  console.log('\nEmpalme r=10 ' + titulo + '  -> ' + r);
  const h = ents.find(e => e.type === 'LINE' && cerca(e.p1.y, 0) && cerca(e.p2.y, 0));
  const v = ents.find(e => e.type === 'LINE' && cerca(e.p1.x, 100) && cerca(e.p2.x, 100));
  console.log('     horizontal: ' + JSON.stringify(h && [h.p1, h.p2]) + '   vertical: ' + JSON.stringify(v && [v.p1, v.p2]));
  ok('la horizontal conserva 0→90', h && cerca(Math.min(h.p1.x, h.p2.x), 0, 1e-6) && cerca(Math.max(h.p1.x, h.p2.x), 90, 1e-6),
     JSON.stringify(h && [h.p1, h.p2]));
  ok('la vertical conserva 10→100', v && cerca(Math.min(v.p1.y, v.p2.y), 10, 1e-6) && cerca(Math.max(v.p1.y, v.p2.y), 100, 1e-6),
     JSON.stringify(v && [v.p1, v.p2]));
  ok('hay un arco de radio 10', ents.some(e => e.type === 'ARC' && cerca(e.r, 10, 1e-6)), ents.map(e => e.type).join(','));
}

/* Chaflán: el mismo recorte, el mismo fallo. */
for (const [titulo, px, qy] of [
  ['designando cerca de la esquina', 80, 20],
  ['designando lejos', 20, 80]
]) {
  const { r, ents } = await corre([L(0, 0, 100, 0), L(100, 0, 100, 100)], 'CHAFLAN',
    ['D', '10', '10', ['pica', 0, px, 0], ['pica', 1, 100, qy]]);
  console.log('\nChaflán 10x10 ' + titulo + '  -> ' + r);
  const h = ents.find(e => e.type === 'LINE' && cerca(e.p1.y, 0) && cerca(e.p2.y, 0));
  const v = ents.find(e => e.type === 'LINE' && cerca(e.p1.x, 100) && cerca(e.p2.x, 100));
  console.log('     horizontal: ' + JSON.stringify(h && [h.p1, h.p2]) + '   vertical: ' + JSON.stringify(v && [v.p1, v.p2]));
  ok('la horizontal conserva 0→90', h && cerca(Math.min(h.p1.x, h.p2.x), 0, 1e-6) && cerca(Math.max(h.p1.x, h.p2.x), 90, 1e-6),
     JSON.stringify(h && [h.p1, h.p2]));
  ok('la vertical conserva 10→100', v && cerca(Math.min(v.p1.y, v.p2.y), 10, 1e-6) && cerca(Math.max(v.p1.y, v.p2.y), 100, 1e-6),
     JSON.stringify(v && [v.p1, v.p2]));
}

/* El caso del arco vive en d2d-arcos.mjs, que comprueba tanto la
   esquina de verdad como los tangentes. */

cierra(fallos, ruido);
await nav.close();
