/* ============================================================
   converter.js — Conversión DWG ⇄ DXF
   Detecta el motor disponible en el sistema y lo usa:
     1. ODA File Converter  (gratuito, mejor fidelidad, R12…2018)
     2. LibreDWG            (libre: dwgread lee; dwgwrite escribe R13-R2000)
   ============================================================ */
'use strict';
const { execFile } = require('child_process');
const { promisify } = require('util');
const fs = require('fs/promises');
const fssync = require('fs');
const os = require('os');
const path = require('path');
const run = promisify(execFile);

const ODA_CANDIDATES = [
  process.env.ODA_PATH,
  '/usr/bin/ODAFileConverter',
  '/usr/local/bin/ODAFileConverter',
  '/opt/ODAFileConverter/ODAFileConverter',
  'ODAFileConverter'
].filter(Boolean);

async function which(cmd) {
  try {
    await run(process.platform === 'win32' ? 'where' : 'which', [cmd]);
    return true;
  } catch (_) { return false; }
}

async function detect() {
  const out = { oda: null, libredwg: { read: false, write: false } };
  for (const c of ODA_CANDIDATES) {
    if (c.includes('/') ? fssync.existsSync(c) : await which(c)) { out.oda = c; break; }
  }
  out.libredwg.read = await which('dwgread');
  out.libredwg.write = await which('dwgwrite');
  return out;
}

function tmpdir(prefix) {
  return fs.mkdtemp(path.join(os.tmpdir(), prefix));
}

/* ------------------------------------------------------------
   ODA File Converter
   Uso: ODAFileConverter <dirEntrada> <dirSalida> <version> <tipo> <recursivo> <auditar>
        version: ACAD12 ACAD2000 ACAD2004 ACAD2007 ACAD2010 ACAD2013 ACAD2018
        tipo:    DWG | DXF
   ------------------------------------------------------------ */
async function odaConvert(odaPath, inputBuf, inputExt, outVersion, outType) {
  const inDir = await tmpdir('mx-in-');
  const outDir = await tmpdir('mx-out-');
  const name = 'dibujo.' + inputExt;
  await fs.writeFile(path.join(inDir, name), inputBuf);
  const args = [inDir, outDir, outVersion, outType, '0', '1'];
  const env = Object.assign({}, process.env);
  if (!env.DISPLAY) env.QT_QPA_PLATFORM = 'offscreen';   // servidor sin X
  await run(odaPath, args, { env, timeout: 120000, maxBuffer: 1 << 26 });
  const files = await fs.readdir(outDir);
  const target = files.find(f => f.toLowerCase().endsWith('.' + outType.toLowerCase()));
  if (!target) {
    const err = files.find(f => f.endsWith('.err') || f.endsWith('.txt'));
    const detail = err ? await fs.readFile(path.join(outDir, err), 'utf8') : '';
    throw new Error('ODA File Converter no generó salida. ' + detail.slice(0, 400));
  }
  const buf = await fs.readFile(path.join(outDir, target));
  fs.rm(inDir, { recursive: true, force: true }).catch(() => {});
  fs.rm(outDir, { recursive: true, force: true }).catch(() => {});
  return buf;
}

/* ------------------------------------------------------------
   LibreDWG
   ------------------------------------------------------------ */
async function libreDwgToDxf(inputBuf) {
  const dir = await tmpdir('mx-ldwg-');
  const inFile = path.join(dir, 'in.dwg');
  const outFile = path.join(dir, 'out.dxf');
  await fs.writeFile(inFile, inputBuf);
  await run('dwgread', ['-O', 'DXF', '-o', outFile, inFile], { timeout: 120000, maxBuffer: 1 << 26 });
  const buf = await fs.readFile(outFile);
  fs.rm(dir, { recursive: true, force: true }).catch(() => {});
  return buf;
}

async function libreDxfToDwg(inputBuf, version) {
  const dir = await tmpdir('mx-ldwg-');
  const inFile = path.join(dir, 'in.dxf');
  const outFile = path.join(dir, 'out.dwg');
  await fs.writeFile(inFile, inputBuf);
  const args = ['-y', '-o', outFile];
  if (version) args.push('--as=' + version);
  args.push(inFile);
  await run('dwgwrite', args, { timeout: 120000, maxBuffer: 1 << 26 });
  const buf = await fs.readFile(outFile);
  fs.rm(dir, { recursive: true, force: true }).catch(() => {});
  return buf;
}

/* ------------------------------------------------------------
   API pública
   ------------------------------------------------------------ */
const ODA_VERSIONS = {
  R12: 'ACAD12', 2000: 'ACAD2000', 2004: 'ACAD2004', 2007: 'ACAD2007',
  2010: 'ACAD2010', 2013: 'ACAD2013', 2018: 'ACAD2018'
};

async function dwgToDxf(buf, opts = {}) {
  const engines = await detect();
  const version = ODA_VERSIONS[opts.version] || 'ACAD2000';
  if (engines.oda) return { data: await odaConvert(engines.oda, buf, 'dwg', version, 'DXF'), engine: 'ODA File Converter' };
  if (engines.libredwg.read) return { data: await libreDwgToDxf(buf), engine: 'LibreDWG (dwgread)' };
  throw new Error('No hay ningún motor de conversión instalado. Instale ODA File Converter o LibreDWG (véase docs/INSTALL.md).');
}

async function dxfToDwg(buf, opts = {}) {
  const engines = await detect();
  const version = ODA_VERSIONS[opts.version] || 'ACAD2018';
  if (engines.oda) return { data: await odaConvert(engines.oda, buf, 'dxf', version, 'DWG'), engine: 'ODA File Converter' };
  if (engines.libredwg.write) {
    const v = opts.version === 'R12' ? 'r12' : 'r2000';
    return { data: await libreDxfToDwg(buf, v), engine: 'LibreDWG (dwgwrite, hasta R2000)' };
  }
  throw new Error('No hay ningún motor capaz de escribir DWG. Instale ODA File Converter (véase docs/INSTALL.md).');
}

module.exports = { detect, dwgToDxf, dxfToDwg, ODA_VERSIONS };
