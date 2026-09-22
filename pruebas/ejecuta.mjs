/* Lanza las pruebas del dibujo 2D.
 *
 * Levanta un servidor estático sobre web/, pasa cada suite y devuelve
 * un código distinto de cero si alguna falla, para que el flujo de
 * trabajo se entere.
 */
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';

const aqui = path.dirname(fileURLToPath(import.meta.url));
const raizWeb = path.join(aqui, '..', 'web');
const PUERTO = Number(process.env.MONXU_PUERTO || 8899);

const TIPOS = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.webmanifest': 'application/manifest+json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png'
};

const servidor = http.createServer(function (pet, res) {
  let rel = decodeURIComponent(new URL(pet.url, 'http://x').pathname);
  if (rel === '/' || rel === '') rel = '/index.html';
  const destino = path.join(raizWeb, path.normalize(rel));
  if (!destino.startsWith(raizWeb)) { res.writeHead(403).end(); return; }
  fs.readFile(destino, function (err, datos) {
    if (err) { res.writeHead(404).end(); return; }
    res.writeHead(200, { 'content-type': TIPOS[path.extname(destino).toLowerCase()] || 'application/octet-stream' });
    res.end(datos);
  });
});

function pasa(suite) {
  return new Promise(function (listo) {
    const hijo = spawn(process.execPath, [path.join(aqui, suite)], {
      stdio: 'inherit',
      env: Object.assign({}, process.env, { MONXU_DIRECCION: 'http://127.0.0.1:' + PUERTO + '/' })
    });
    hijo.on('exit', function (cod) { listo(cod === 0); });
  });
}

const suites = fs.readdirSync(aqui).filter(function (f) { return /^d2d-.*\.mjs$/.test(f); }).sort();

await new Promise(function (listo) { servidor.listen(PUERTO, '127.0.0.1', listo); });
console.log('Sirviendo web/ en el puerto ' + PUERTO + '\n');

const malas = [];
for (const s of suites) {
  console.log('\n########  ' + s + '  ########');
  if (!(await pasa(s))) malas.push(s);
}

servidor.close();
console.log('\n========================================');
if (malas.length) {
  console.log('FALLAN ' + malas.length + ' de ' + suites.length + ' suites: ' + malas.join(', '));
  process.exit(1);
}
console.log('Las ' + suites.length + ' suites del dibujo 2D pasan.');
