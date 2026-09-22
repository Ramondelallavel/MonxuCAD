import { abreBanco, cerca, cierra } from './banco.mjs';

const { nav, pag, ruido } = await abreBanco();
const fallos = [];
function ok(nombre, cond, detalle) {
  if (cond) console.log('  ok   ' + nombre);
  else { console.log('  MAL  ' + nombre + '  —  ' + detalle); fallos.push(nombre + ' — ' + detalle); }
}

async function caso(titulo, preparar, comando, entradas, revision, preseleccion) {
  await pag.evaluate(() => window.__banco.limpia());
  if (preparar) await pag.evaluate(l => window.__banco.pon(l), preparar);
  if (preseleccion) await pag.evaluate(i => window.__banco.sel(i), preseleccion);
  const r = await pag.evaluate(([c, e]) => window.__banco.orden(c, e), [comando, entradas]);
  const ents = await pag.evaluate(() => window.__banco.ents());
  console.log('\n' + titulo + '  ->  ' + r + ', ' + ents.length + ' obj: ' + ents.map(e => e.type).join(','));
  if (r !== 'ok') { fallos.push(titulo + ': ' + r); return; }
  try { revision(ents); } catch (e) { ok(titulo, false, 'la comprobación reventó: ' + e.message); }
}

const L = (x1, y1, x2, y2) => ({ t: 'linea', x1, y1, x2, y2 });
const C = (x, y, r) => ({ t: 'circulo', x, y, r });

/* ---------- DESFASE ---------- */
await caso('Desfase de una línea a 10', [L(0, 0, 100, 0)], 'DESFASE',
  ['10', ['pica', 0, 50, 0], '50,40', '\n'], (e) => {
    ok('quedan dos líneas', e.length === 2, e.length + ' obj');
    const n = e[1];
    ok('la nueva está a y=10', n && cerca(n.p1.y, 10) && cerca(n.p2.y, 10), JSON.stringify(n && [n.p1, n.p2]));
    ok('conserva la longitud', n && cerca(Math.hypot(n.p2.x - n.p1.x, n.p2.y - n.p1.y), 100, 1e-6),
       n ? Math.hypot(n.p2.x - n.p1.x, n.p2.y - n.p1.y) : '-');
  });

await caso('Desfase de un círculo hacia fuera', [C(0, 0, 50)], 'DESFASE',
  ['10', ['pica', 0, 50, 0], '80,0', '\n'], (e) => {
    ok('quedan dos círculos', e.length === 2, e.length + ' obj');
    ok('el nuevo tiene r=60', e[1] && cerca(e[1].r, 60), e[1] && e[1].r);
  });

await caso('Desfase de un círculo hacia dentro', [C(0, 0, 50)], 'DESFASE',
  ['10', ['pica', 0, 50, 0], '20,0', '\n'], (e) => {
    ok('el nuevo tiene r=40', e[1] && cerca(e[1].r, 40), e[1] && e[1].r);
  });

/* ---------- EMPALME ---------- */
await caso('Empalme de radio 10 en esquina recta', [L(0, 0, 100, 0), L(100, 0, 100, 100)], 'EMPALME',
  ['RA', '10', ['pica', 0, 50, 0], ['pica', 1, 100, 50]], (e) => {
    const arcos = e.filter(x => x.type === 'ARC');
    ok('aparece un arco', arcos.length === 1, e.map(x => x.type).join(','));
    if (arcos[0]) {
      ok('radio 10', cerca(arcos[0].r, 10, 1e-6), arcos[0].r);
      ok('centro en (90,10)', cerca(arcos[0].c.x, 90, 1e-6) && cerca(arcos[0].c.y, 10, 1e-6), JSON.stringify(arcos[0].c));
    }
    console.log('     líneas que quedan: ' + JSON.stringify(e.filter(x => x.type === 'LINE').map(x => [x.p1, x.p2])));
    const l1 = e.find(x => x.type === 'LINE' && cerca(x.p1.y, 0) && cerca(x.p2.y, 0));
    ok('la horizontal conserva el lado designado (x=50) y acaba en 90',
       l1 && cerca(Math.min(l1.p1.x, l1.p2.x), 0, 1e-6) && cerca(Math.max(l1.p1.x, l1.p2.x), 90, 1e-6),
       l1 ? JSON.stringify([l1.p1, l1.p2]) : 'no está');
  });

/* ---------- CHAFLAN ---------- */
await caso('Chaflán 10x10 en esquina recta', [L(0, 0, 100, 0), L(100, 0, 100, 100)], 'CHAFLAN',
  ['D', '10', '10', ['pica', 0, 50, 0], ['pica', 1, 100, 50]], (e) => {
    const lineas = e.filter(x => x.type === 'LINE');
    ok('quedan tres líneas', lineas.length === 3, lineas.length + ' líneas de ' + e.length);
    const ch = lineas.find(x =>
      (cerca(x.p1.x, 90, 1e-6) && cerca(x.p1.y, 0, 1e-6) && cerca(x.p2.x, 100, 1e-6) && cerca(x.p2.y, 10, 1e-6)) ||
      (cerca(x.p2.x, 90, 1e-6) && cerca(x.p2.y, 0, 1e-6) && cerca(x.p1.x, 100, 1e-6) && cerca(x.p1.y, 10, 1e-6)));
    ok('el chaflán va de (90,0) a (100,10)', !!ch, JSON.stringify(lineas.map(x => [x.p1, x.p2])));
  });

/* ---------- SIMETRIA ---------- */
await caso('Simetría respecto del eje Y', [L(10, 0, 30, 20)], 'SIMETRIA',
  ['0,0', '0,100', 'N'], (e) => {
    ok('quedan dos líneas', e.length === 2, e.length + ' obj');
    const n = e[1];
    ok('la copia está en x negativo', n && cerca(n.p1.x, -10, 1e-6) && cerca(n.p2.x, -30, 1e-6),
       JSON.stringify(n && [n.p1, n.p2]));
    ok('la y no cambia', n && cerca(n.p1.y, 0, 1e-6) && cerca(n.p2.y, 20, 1e-6), JSON.stringify(n && [n.p1, n.p2]));
  }, [0]);

/* ---------- GIRA ---------- */
await caso('Giro de 90° alrededor del origen', [L(10, 0, 50, 0)], 'GIRA',
  ['0,0', '90'], (e) => {
    const l = e[0];
    ok('sigue habiendo una línea', e.length === 1, e.length + ' obj');
    ok('pasa a estar sobre el eje Y', l && cerca(l.p1.x, 0, 1e-6) && cerca(l.p1.y, 10, 1e-6) &&
       cerca(l.p2.x, 0, 1e-6) && cerca(l.p2.y, 50, 1e-6), JSON.stringify(l && [l.p1, l.p2]));
  }, [0]);

/* ---------- ESCALA ---------- */
await caso('Escala x2 desde el origen', [L(10, 10, 20, 20)], 'ESCALA',
  ['0,0', '2'], (e) => {
    const l = e[0];
    ok('duplica las coordenadas', l && cerca(l.p1.x, 20, 1e-6) && cerca(l.p2.x, 40, 1e-6),
       JSON.stringify(l && [l.p1, l.p2]));
  }, [0]);

/* ---------- DESPLAZA ---------- */
await caso('Desplazar 10,20', [L(0, 0, 100, 0)], 'DESPLAZA',
  ['0,0', '10,20'], (e) => {
    const l = e[0];
    ok('se mueve entero', l && cerca(l.p1.x, 10) && cerca(l.p1.y, 20) && cerca(l.p2.x, 110) && cerca(l.p2.y, 20),
       JSON.stringify(l && [l.p1, l.p2]));
  }, [0]);

/* ---------- DESCOMP ---------- */
await caso('Descomponer un rectángulo', null, 'RECTANG', ['0,0', '100,50', '\n'], () => {});
await pag.evaluate(() => window.__banco.sel([0]));
{
  const r = await pag.evaluate(() => window.__banco.orden('DESCOMP', ['\n']));
  const e = await pag.evaluate(() => window.__banco.ents());
  console.log('\nDescomponer un rectángulo  ->  ' + r + ', ' + e.length + ' obj: ' + e.map(x => x.type).join(','));
  ok('da cuatro líneas', e.length === 4 && e.every(x => x.type === 'LINE'), e.map(x => x.type).join(','));
}

/* ---------- UNIR ---------- */
await caso('Unir dos líneas colineales', [L(0, 0, 50, 0), L(50, 0, 100, 0)], 'UNIR',
  ['\n'], (e) => {
    ok('queda un solo objeto', e.length === 1, e.length + ' obj: ' + e.map(x => x.type).join(','));
    const l = e[0];
    if (l && l.type === 'LINE') ok('va de 0 a 100', cerca(Math.min(l.p1.x, l.p2.x), 0) && cerca(Math.max(l.p1.x, l.p2.x), 100),
      JSON.stringify([l.p1, l.p2]));
  }, [0, 1]);

/* ---------- RECORTA ---------- */
await caso('Recortar una línea por otra', [L(0, 0, 100, 0), L(50, -50, 50, 50)], 'RECORTA',
  [['pica', 0, 80, 0], '\n'], (e) => {
    const h = e.find(x => x.type === 'LINE' && cerca(x.p1.y, 0) && cerca(x.p2.y, 0));
    ok('la horizontal se queda en x=50', h && cerca(Math.max(h.p1.x, h.p2.x), 50, 1e-6),
       h ? JSON.stringify([h.p1, h.p2]) : 'no está');
  });

/* ---------- ALARGA ---------- */
await caso('Alargar una línea hasta otra', [L(0, 0, 40, 0), L(100, -50, 100, 50)], 'ALARGA',
  [['pica', 0, 35, 0], '\n'], (e) => {
    const h = e.find(x => x.type === 'LINE' && cerca(x.p1.y, 0) && cerca(x.p2.y, 0));
    ok('llega hasta x=100', h && cerca(Math.max(h.p1.x, h.p2.x), 100, 1e-6),
       h ? JSON.stringify([h.p1, h.p2]) : 'no está');
  });

cierra(fallos, ruido);
await nav.close();
