/* ============================================================
   dwgbridge.js — Cliente del puente DWG (sólo autoalojado)
   Añade lectura y escritura de DWG a MonxuCAD delegando la
   conversión en el servicio de ../server.
   Cargar DESPUÉS de main.js.
   ============================================================ */
(function () {
  'use strict';
  var CAD = window.CAD;
  if (!CAD || !CAD.App) return;
  var Cmd = CAD.Cmd, E = CAD.E;

  var B = (CAD.DWG = {
    url: (function () {
      try { return localStorage.getItem('monxucad.bridge') || ''; } catch (e) { return ''; }
    })(),
    status: null
  });

  /* Si la página se sirve desde el propio puente, se usa su mismo origen */
  if (!B.url && location.protocol.indexOf('http') === 0) B.url = location.origin;

  B.setUrl = function (u) {
    B.url = (u || '').replace(/\/+$/, '');
    try { localStorage.setItem('monxucad.bridge', B.url); } catch (e) { }
    B.status = null;
  };

  B.check = async function () {
    if (!B.url) return null;
    try {
      var r = await fetch(B.url + '/api/health', { cache: 'no-store' });
      if (!r.ok) return null;
      B.status = await r.json();
      return B.status;
    } catch (e) { return null; }
  };

  B.dwgToDxf = async function (file, version) {
    var fd = new FormData();
    fd.append('file', file, file.name || 'dibujo.dwg');
    var r = await fetch(B.url + '/api/dwg2dxf?version=' + encodeURIComponent(version || '2000'), {
      method: 'POST', body: fd
    });
    if (!r.ok) throw new Error((await r.json().catch(function () { return {}; })).error || ('HTTP ' + r.status));
    return { text: await r.text(), engine: r.headers.get('X-Convert-Engine') || '' };
  };

  B.dxfToDwg = async function (dxfText, name, version) {
    var r = await fetch(B.url + '/api/dxf2dwg?version=' + encodeURIComponent(version || '2018') +
      '&name=' + encodeURIComponent(name || 'dibujo'), {
      method: 'POST', headers: { 'Content-Type': 'text/plain; charset=utf-8' }, body: dxfText
    });
    if (!r.ok) throw new Error((await r.json().catch(function () { return {}; })).error || ('HTTP ' + r.status));
    return { blob: await r.blob(), engine: r.headers.get('X-Convert-Engine') || '' };
  };

  /* ------------------------------------------------------------
     Apertura de .dwg
     ------------------------------------------------------------ */
  var baseLoad = CAD.App.prototype.loadFile;
  CAD.App.prototype.loadFile = function (file) {
    var self = this;
    if (!/\.dwg$/i.test(file.name || '')) return baseLoad.call(this, file);
    if (!B.url) return baseLoad.call(this, file);
    this.out('Convirtiendo ' + file.name + ' mediante el puente DWG…');
    B.check().then(function (st) {
      if (!st || !st.canRead) { baseLoad.call(self, file); return; }
      B.dwgToDxf(file).then(function (res) {
        try {
          var doc = CAD.DXF.read(res.text);
          doc.name = file.name.replace(/\.dwg$/i, '.dwg');
          self.doc = doc;
          self.selSet = []; self.preview = []; self.pending = null;
          self.activeVp = null; self.paperMode = false; self.layout = null; self.layoutIndex = -1;
          self.ui.buildLayoutTabs();
          document.getElementById('docTitle').textContent = 'MonxuCAD   ' + doc.name;
          var b = CAD.E.extentsAll(doc.entities, doc);
          if (CAD.G.bboxValid(b)) self.r.zoomBox(b);
          self.ui.syncStatus();
          self.out('Abierto ' + file.name + ' con ' + res.engine + '.', 'ok');
          self.out(doc.entities.length + ' objeto(s), ' + doc.layerOrder.length + ' capa(s).');
          self.refresh();
        } catch (err) { self.out('Error al leer el DXF convertido: ' + err.message, 'err'); }
      }).catch(function (err) {
        self.out('El puente DWG no pudo convertir el archivo: ' + err.message, 'err');
      });
    });
  };

  /* ------------------------------------------------------------
     Guardado en .dwg
     ------------------------------------------------------------ */
  CAD.App.prototype.saveAsDwg = async function (version) {
    var st = await B.check();
    if (!st || !st.canWrite) {
      this.out('El puente DWG no está disponible o no puede escribir DWG.', 'err');
      return false;
    }
    var base = (this.doc.name || 'Dibujo1').replace(/\.[^.]+$/, '');
    var dxf = CAD.DXF.write(this.doc, { version: 'AC1015' });
    this.out('Convirtiendo a DWG ' + (version || '2018') + '…');
    try {
      var res = await B.dxfToDwg(dxf, base, version);
      var buf = new Uint8Array(await res.blob.arrayBuffer());
      await CAD.Exporter.saveFile(this, base + '.dwg', buf, 'dwg');
      this.out('DWG generado con ' + res.engine + '.', 'ok');
      return true;
    } catch (err) {
      this.out('Error al generar el DWG: ' + err.message, 'err');
      return false;
    }
  };

  /* ------------------------------------------------------------
     Comandos
     ------------------------------------------------------------ */
  Cmd.add(['PUENTEDWG', 'DWGBRIDGE'], { group: 'file', icon: 'dwg', title: 'Puente DWG' }, async function (ctx) {
    var app = ctx.app;
    var st = await B.check();
    var body =
      '<div class="fields">' +
      '<label>Dirección del servicio:</label><input type="text" id="dbUrl" value="' + (B.url || '') + '" placeholder="http://localhost:8787">' +
      '<div class="span2" id="dbState" style="margin-top:6px;color:var(--ink-dim)">' +
      (st ? ('Conectado · lectura: ' + (st.canRead ? 'sí' : 'no') + ' · escritura: ' + (st.canWrite ? 'sí' : 'no') +
        '<br>Motor: ' + (st.engines.oda ? 'ODA File Converter' : (st.engines.libredwg.read ? 'LibreDWG' : 'ninguno')))
        : 'Sin conexión. Arranque el servicio con <code>npm start</code> en la carpeta server/.') +
      '</div></div>';
    var r = await app.ui.dialog({
      title: 'Puente DWG', width: 460, body: body,
      buttons: [{ label: 'Probar y guardar', value: true, primary: true }, { label: 'Cerrar', value: null }],
      onOk: function (b) { return b.querySelector('#dbUrl').value.trim(); }
    });
    if (r === null) return;
    B.setUrl(r);
    var st2 = await B.check();
    if (st2) ctx.out('Puente DWG conectado. Lectura: ' + (st2.canRead ? 'sí' : 'no') + ', escritura: ' + (st2.canWrite ? 'sí' : 'no'), 'ok');
    else ctx.err('No se pudo contactar con el puente DWG en ' + B.url);
  });

  Cmd.add(['GUARDARDWG', 'SAVEDWG'], { group: 'file', icon: 'dwg', title: 'Guardar como DWG' }, async function (ctx) {
    var v = await ctx.getKeyword('Versión de DWG', ['2018', '2013', '2010', '2007', '2004', '2000', 'R12'], { def: '2018' });
    await ctx.app.saveAsDwg(v ? v.keyword : '2018');
  });

  /* Aviso en el arranque */
  window.addEventListener('load', function () {
    setTimeout(function () {
      var app = window.CADAPP;
      if (!app) return;
      B.check().then(function (st) {
        if (st && (st.canRead || st.canWrite)) {
          app.out('Puente DWG activo: ABRE acepta .dwg y GUARDARDWG lo escribe.', 'ok');
        } else if (B.url) {
          app.out('Puente DWG configurado en ' + B.url + ' pero sin motor de conversión. Véase docs/INSTALL.md.', 'warn');
        }
      });
    }, 600);
  });
})();
