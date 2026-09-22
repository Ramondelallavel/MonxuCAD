import { abreBanco, cerca, cierra } from './banco.mjs';
const { nav, pag, ruido } = await abreBanco();
const fallos = [];
function ok(n, c, d) { if (c) console.log('  ok   ' + n); else { console.log('  MAL  ' + n + '  —  ' + d); fallos.push(n + ' — ' + d); } }
async function corre(prep, comando, entradas) {
  await pag.evaluate(() => window.__banco.limpia());
  await pag.evaluate(l => window.__banco.pon(l), prep);
  const r = await pag.evaluate(([c, e]) => window.__banco.orden(c, e), [comando, entradas]);
  const ents = await pag.evaluate(() => window.__banco.ents());
  const hist = await pag.evaluate(() => window.__banco.hist());
  return { r, ents, hist };
}
const L = (x1, y1, x2, y2) => ({ t: 'linea', x1, y1, x2, y2 });
const A = (x, y, r, a1, a2) => ({ t: 'arco', x, y, r, a1, a2 });

/* Esquina de verdad: media circunferencia de arriba (r=50) y una
   línea que sale a la derecha desde (50,0).  Se cortan en ángulo
   recto, así que hay esquina que redondear. */
for (const [titulo, pax, pay] of [
  ['designando el arco arriba (0,50)', 0, 50],
  ['designando el arco cerca de la esquina (a 15°)', 50 * Math.cos(0.26), 50 * Math.sin(0.26)]
]) {
  const { r, ents } = await corre([A(0, 0, 50, 0, Math.PI), L(50, 0, 150, 0)], 'EMPALME',
    ['RA', '10', ['pica', 0, pax, pay], ['pica', 1, 120, 0]]);
  const grande = ents.find(e => e.type === 'ARC' && cerca(e.r, 50, 1e-6));
  const empalme = ents.find(e => e.type === 'ARC' && cerca(e.r, 10, 1e-6));
  const linea = ents.find(e => e.type === 'LINE');
  console.log('\nArco+línea, ' + titulo + '  -> ' + r + ', ' + ents.map(e => e.type).join(','));
  console.log('     arco grande a0=' + (grande && grande.a0.toFixed(4)) + ' a1=' + (grande && grande.a1.toFixed(4)) +
              '   línea ' + JSON.stringify(linea && [linea.p1, linea.p2]));
  ok('hay arco de empalme r=10', !!empalme, ents.filter(e => e.type === 'ARC').map(e => e.r).join(','));
  ok('el arco grande conserva el lado de arriba (llega hasta 180°)',
     grande && cerca(grande.a1, Math.PI, 1e-6), grande ? 'a1=' + grande.a1 : 'no está');
  ok('el arco grande se recorta por abajo (a0 > 0)',
     grande && grande.a0 > 1e-6, grande ? 'a0=' + grande.a0 : 'no está');
  ok('la línea conserva el lado designado y empieza más allá de 50',
     linea && cerca(Math.max(linea.p1.x, linea.p2.x), 150, 1e-6) && Math.min(linea.p1.x, linea.p2.x) > 50,
     JSON.stringify(linea && [linea.p1, linea.p2]));
}

/* Tangentes: no hay esquina que redondear.  Debe decirlo, no dejar un
   arco de barrido cero metido en el dibujo. */
{
  const { r, ents, hist } = await corre([A(0, 0, 50, 0, Math.PI / 2), L(50, 0, 50, -60)], 'EMPALME',
    ['RA', '5', ['pica', 0, 50 * Math.cos(0.2), 50 * Math.sin(0.2)], ['pica', 1, 50, -30]]);
  console.log('\nEmpalme de dos objetos tangentes  -> ' + r + ', ' + ents.map(e => e.type).join(','));
  const basura = ents.filter(e => e.type === 'ARC' && Math.abs(window_sweep(e.a0, e.a1)) < 1e-9);
  function window_sweep(a, b) { const d = b - a; return d < 0 ? d + Math.PI * 2 : d; }
  console.log('     arcos: ' + JSON.stringify(ents.filter(e => e.type === 'ARC').map(a => [+a.r.toFixed(3), +a.a0.toFixed(4), +a.a1.toFixed(4)])));
  ok('no deja ningún arco de barrido cero', basura.length === 0, basura.length + ' arco(s) degenerado(s)');
  ok('siguen estando los dos objetos originales', ents.length === 2, ents.length + ' obj');
}

cierra(fallos, ruido);
await nav.close();
