/* Áreas, perímetros, arcos dentro de polilíneas y cotas.
   Un CAD que mide mal no vale para nada, así que esto se comprueba
   contra valores calculados a mano. */
import { abreBanco, cerca, cierra } from './banco.mjs';

const { nav, pag, ruido } = await abreBanco();
const fallos = [];
function ok(n, c, d) { if (c) console.log('  ok   ' + n); else { console.log('  MAL  ' + n + '  —  ' + d); fallos.push(n + ' — ' + d); } }

async function pon(lista) {
  await pag.evaluate(() => window.__banco.limpia());
  await pag.evaluate(l => window.__banco.pon(l), lista);
}
async function corre(comando, entradas) {
  const r = await pag.evaluate(([c, e]) => window.__banco.orden(c, e), [comando, entradas]);
  return { r, ents: await pag.evaluate(() => window.__banco.ents()) };
}
const mide = (i) => pag.evaluate(j => window.__banco.mide(j), i);

const TAU = Math.PI * 2;

/* ---------- Áreas y perímetros ---------- */
console.log('\n--- Áreas y perímetros ---');

await pon([{ t: 'pol', closed: true, verts: [{ x: 0, y: 0 }, { x: 100, y: 0 }, { x: 100, y: 50 }, { x: 0, y: 50 }] }]);
{
  const m = await mide(0);
  ok('rectángulo 100x50: área 5000', cerca(m.area, 5000, 1e-9), m.area);
  ok('rectángulo 100x50: perímetro 300', cerca(m.perim, 300, 1e-9), m.perim);
}

await pon([{ t: 'circulo', x: 0, y: 0, r: 25 }]);
{
  const m = await mide(0);
  ok('círculo r=25: área πr²', cerca(m.area, Math.PI * 625, 1e-9), m.area);
  ok('círculo r=25: perímetro 2πr', cerca(m.perim, TAU * 25, 1e-9), m.perim);
}

/* Hexágono regular inscrito en r=50 */
{
  const v = [];
  for (let i = 0; i < 6; i++) v.push({ x: 50 * Math.cos(i * TAU / 6), y: 50 * Math.sin(i * TAU / 6) });
  await pon([{ t: 'pol', closed: true, verts: v }]);
  const m = await mide(0);
  ok('hexágono r=50: área 3√3/2·r²', cerca(m.area, 1.5 * Math.sqrt(3) * 2500, 1e-6), m.area);
  ok('hexágono r=50: perímetro 300', cerca(m.perim, 300, 1e-9), m.perim);
}

/* Polilínea abierta que es media circunferencia (bulge = 1) */
await pon([{ t: 'pol', closed: false, verts: [{ x: 0, y: 0, b: 1 }, { x: 100, y: 0 }] }]);
{
  const m = await mide(0);
  ok('semicircunferencia de radio 50: longitud π·50', cerca(m.perim, Math.PI * 50, 1e-6), m.perim);
}

/* Medio disco: la misma media circunferencia, cerrada por la cuerda */
await pon([{ t: 'pol', closed: true, verts: [{ x: 0, y: 0, b: 1 }, { x: 100, y: 0 }] }]);
{
  const m = await mide(0);
  ok('medio disco r=50: área πr²/2', cerca(m.area, Math.PI * 2500 / 2, 1e-6), m.area);
  ok('medio disco r=50: perímetro π·50 + 100', cerca(m.perim, Math.PI * 50 + 100, 1e-6), m.perim);
}

/* ---------- Arcos dentro de polilíneas ---------- */
console.log('\n--- Arcos dentro de polilíneas ---');

await pon([{ t: 'pol', closed: false, verts: [{ x: 0, y: 0 }, { x: 100, y: 0, b: 1 }, { x: 100, y: 100 }] }]);
await pag.evaluate(() => window.__banco.sel([0]));
{
  const { r, ents } = await corre('DESCOMP', ['\n']);
  console.log('  descomponer polilínea con arco -> ' + r + ': ' + ents.map(e => e.type).join(','));
  ok('da una línea y un arco', ents.length === 2 && ents.some(e => e.type === 'LINE') && ents.some(e => e.type === 'ARC'),
     ents.map(e => e.type).join(','));
  const a = ents.find(e => e.type === 'ARC');
  ok('el arco tiene radio 50', a && cerca(a.r, 50, 1e-6), a && a.r);
}

await pon([{ t: 'pol', closed: false, verts: [{ x: 0, y: 0, b: 1 }, { x: 100, y: 0 }] }]);
{
  /* Con bulge 1 el arco va por debajo de la cuerda: pasa por (50,-50).
     El lado de fuera es, por tanto, más abajo todavía. */
  const { r, ents } = await corre('DESFASE', ['10', ['pica', 0, 50, -50], '50,-70', '\n']);
  console.log('  desfase de polilínea con arco -> ' + r + ': ' + ents.length + ' obj');
  ok('aparece la copia desfasada', ents.length === 2, ents.length + ' obj');
  if (ents[1]) {
    const m = await mide(1);
    /* El arco desfasado hacia fuera pasa de radio 50 a 60. */
    ok('la longitud pasa de π·50 a π·60', cerca(m.perim, Math.PI * 60, 1e-4), m.perim);
  }
}

/* ---------- Cotas ---------- */
console.log('\n--- Cotas ---');

await pon([]);
{
  const { r, ents } = await corre('ACOTALINEAL', ['0,0', '100,0', '50,25']);
  const d = ents.find(e => e.type === 'DIMENSION');
  console.log('  acota lineal -> ' + r + ': ' + ents.map(e => e.type).join(',') + (d ? '  medida=' + d.measurement : ''));
  ok('mide 100', d && cerca(d.measurement, 100, 1e-9), d && d.measurement);
}

await pon([]);
{
  const { r, ents } = await corre('ACOTAALINEADA', ['0,0', '30,40', '30,10']);
  const d = ents.find(e => e.type === 'DIMENSION');
  console.log('  acota alineada -> ' + r + (d ? '  medida=' + d.measurement : ''));
  ok('mide 50 (triángulo 3-4-5)', d && cerca(d.measurement, 50, 1e-9), d && d.measurement);
}

await pon([{ t: 'circulo', x: 0, y: 0, r: 25 }]);
{
  const { r, ents } = await corre('ACOTARADIO', [['pica', 0, 25, 0], '40,40']);
  const d = ents.find(e => e.type === 'DIMENSION');
  console.log('  acota radio -> ' + r + (d ? '  medida=' + d.measurement : ''));
  ok('mide 25', d && cerca(d.measurement, 25, 1e-9), d && d.measurement);
}

await pon([{ t: 'circulo', x: 0, y: 0, r: 25 }]);
{
  const { r, ents } = await corre('ACOTADIAMETRO', [['pica', 0, 25, 0], '40,40']);
  const d = ents.find(e => e.type === 'DIMENSION');
  console.log('  acota diámetro -> ' + r + (d ? '  medida=' + d.measurement : ''));
  ok('mide 50', d && cerca(d.measurement, 50, 1e-9), d && d.measurement);
}

await pon([{ t: 'linea', x1: 0, y1: 0, x2: 100, y2: 0 }, { t: 'linea', x1: 0, y1: 0, x2: 0, y2: 100 }]);
{
  const { r, ents } = await corre('ACOTAANGULO', [['pica', 0, 50, 0], ['pica', 1, 0, 50], '30,30']);
  const d = ents.find(e => e.type === 'DIMENSION');
  console.log('  acota ángulo -> ' + r + (d ? '  medida=' + d.measurement : ''));
  ok('mide 90° (o π/2 en radianes)',
     d && (cerca(d.measurement, 90, 1e-9) || cerca(d.measurement, Math.PI / 2, 1e-9)), d && d.measurement);
}

cierra(fallos, ruido);
await nav.close();
