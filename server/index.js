/* ============================================================
   index.js — Servicio HTTP del puente DWG de MonxuCAD
   Sirve la aplicación web y expone la conversión DWG ⇄ DXF.
   ============================================================ */
'use strict';
const express = require('express');
const cors = require('cors');
const path = require('path');
const multer = require('multer');
const converter = require('./converter');

const PORT = process.env.PORT || 8787;
const MAX_MB = parseInt(process.env.MAX_MB || '64', 10);
const ORIGINS = (process.env.ALLOWED_ORIGINS || '*').split(',').map(s => s.trim());

const app = express();
app.use(cors({ origin: ORIGINS.includes('*') ? true : ORIGINS }));
app.use(express.text({ type: ['application/dxf', 'text/plain'], limit: MAX_MB + 'mb' }));
app.use(express.json({ limit: MAX_MB + 'mb' }));

const upload = multer({ limits: { fileSize: MAX_MB * 1024 * 1024 }, storage: multer.memoryStorage() });

/* --- estado del servicio --- */
app.get('/api/health', async (_req, res) => {
  const engines = await converter.detect();
  res.json({
    ok: true,
    service: 'monxucad-dwg-bridge',
    version: require('./package.json').version,
    engines: {
      oda: engines.oda || null,
      libredwg: engines.libredwg
    },
    canRead: !!(engines.oda || engines.libredwg.read),
    canWrite: !!(engines.oda || engines.libredwg.write),
    versions: Object.keys(converter.ODA_VERSIONS)
  });
});

/* --- DWG → DXF --- */
app.post('/api/dwg2dxf', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'Falta el archivo (campo "file").' });
    const out = await converter.dwgToDxf(req.file.buffer, { version: req.query.version });
    res.set('X-Convert-Engine', out.engine);
    res.type('application/dxf').send(out.data);
  } catch (e) {
    res.status(500).json({ error: String(e.message || e) });
  }
});

/* --- DXF → DWG --- */
app.post('/api/dxf2dwg', async (req, res) => {
  try {
    const body = typeof req.body === 'string' ? req.body : (req.body && req.body.dxf);
    if (!body) return res.status(400).json({ error: 'Envíe el DXF como texto plano o {"dxf":"…"}.' });
    const name = (req.query.name || 'dibujo').replace(/[^\w.\-]/g, '_');
    const out = await converter.dxfToDwg(Buffer.from(body, 'utf8'), { version: req.query.version });
    res.set('X-Convert-Engine', out.engine);
    res.set('Content-Disposition', 'attachment; filename="' + name + '.dwg"');
    res.type('application/acad').send(out.data);
  } catch (e) {
    res.status(500).json({ error: String(e.message || e) });
  }
});

/* --- aplicación web --- */
app.use('/', express.static(path.join(__dirname, '..', 'web')));

app.listen(PORT, () => {
  console.log('MonxuCAD — puente DWG escuchando en http://localhost:' + PORT);
  converter.detect().then(e => {
    console.log('  ODA File Converter:', e.oda || 'no encontrado');
    console.log('  LibreDWG: dwgread=' + e.libredwg.read + ' dwgwrite=' + e.libredwg.write);
    if (!e.oda && !e.libredwg.read) console.log('  ⚠  Sin motor de conversión: véase docs/INSTALL.md');
  });
});
