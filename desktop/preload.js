/* ============================================================
   Puente entre la aplicación y el sistema

   Lo único que cruza de la página al proceso principal.  La página
   no ve ni node ni el sistema de archivos: manda el archivo ya
   preparado y recibe dónde ha quedado.
   ============================================================ */
'use strict';

const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('MonxuNative', {
  donde: 'escritorio',
  plataforma: process.platform,

  /* Contesta «ok:<ruta>», «cancelado» o «error:<motivo>». */
  guardar: function (nombre, base64, tipo) {
    return ipcRenderer.invoke('monxucad:guardar', { nombre: nombre, base64: base64, tipo: tipo });
  },

  /* Archivos con los que arranca el sistema (doble clic en un .dxf).
     Avisar de que ya hay quien los recoja es parte del trato: hasta
     entonces el proceso principal los guarda en cola. */
  alAbrir: function (fn) {
    if (typeof fn !== 'function') return;
    ipcRenderer.on('monxucad:abrir', function (ev, datos) { fn(datos); });
    ipcRenderer.send('monxucad:listo');
  }
});
