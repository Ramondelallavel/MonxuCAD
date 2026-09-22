/* Banco de pruebas del dibujo 2D: ejecuta los comandos de verdad y
   comprueba la geometría que sale. */
import { chromium } from 'playwright-core';

/* El navegador y la dirección se pueden fijar por el entorno: aquí se
   usa el Chromium que ya hay instalado, y en el flujo de trabajo el
   que instala Playwright. */
const NAVEGADOR = process.env.MONXU_NAVEGADOR || undefined;
const DIRECCION = process.env.MONXU_DIRECCION || 'http://127.0.0.1:8899/';

export async function abreBanco() {
  const nav = await chromium.launch({
    executablePath: NAVEGADOR,
    args: ['--no-sandbox', '--disable-gpu']
  });
  const ctx = await nav.newContext({ viewport: { width: 1400, height: 900 } });
  const pag = await ctx.newPage();
  const ruido = [];
  pag.on('pageerror', e => ruido.push('EXCEPCIÓN: ' + e.message));
  pag.on('console', m => { if (m.type() === 'error') ruido.push('CONSOLA: ' + m.text()); });
  await pag.goto(DIRECCION, { waitUntil: 'networkidle' });
  await pag.waitForFunction(() => !!window.CADAPP, null, { timeout: 20000 });

  await pag.evaluate(() => {
    const app = window.CADAPP;
    const espera = (cond, ms) => new Promise(listo => {
      const t0 = Date.now();
      (function mira() {
        if (cond() || Date.now() - t0 > ms) return listo();
        setTimeout(mira, 10);
      })();
    });

    window.__banco = {
      limpia() {
        app.doc.entities.length = 0;
        app.selSet = [];
        app.pending = null;
        app.doc.undoStack.length = 0;
        app.doc.redoStack.length = 0;
        app.refresh();
      },
      /* Lanza un comando y le va dando respuestas, esperando a que
         pida cada una.  '\n' es Intro. */
      async orden(nombre, entradas) {
        app.pending = null;
        app.exec(nombre);
        for (const e of (entradas || [])) {
          await espera(() => !!app.pending, 1500);
          if (!app.pending) break;
          if (e === '\n') app.feedEnter();
          else if (Array.isArray(e) && e[0] === 'pica') {
            /* Designar de verdad, como hace el lienzo. */
            const ent = typeof e[1] === 'number' ? app.doc.entities[e[1]] : null;
            const w = { x: e[2], y: e[3], z: 0 };
            app.feedPick(app.r.w2s(w), w, ent, false);
          } else app.feedText(String(e));
          await new Promise(r => setTimeout(r, 15));
        }
        await espera(() => !app.pending, 2500);
        if (app.pending) { app.cancel && app.cancel(); app.pending = null; return 'SE QUEDÓ ESPERANDO'; }
        return 'ok';
      },
      ents() { return app.doc.entities.map(e => JSON.parse(JSON.stringify(e))); },
      pon(lista) {
        const E = window.CAD.E;
        lista.forEach(d => {
          /* Por doc.add, como el programa: así llevan identificador y
             entran en el índice. */
          if (d.t === 'linea') app.doc.add(E.line({ x: d.x1, y: d.y1 }, { x: d.x2, y: d.y2 }, { layer: '0' }));
          else if (d.t === 'circulo') app.doc.add(E.circle({ x: d.x, y: d.y }, d.r, { layer: '0' }));
          else if (d.t === 'arco') app.doc.add(E.arc({ x: d.x, y: d.y }, d.r, d.a1, d.a2, { layer: '0' }));
          else if (d.t === 'pol') app.doc.add(E.pline(d.verts, d.closed, { layer: '0' }));
        });
        app.refresh();
      },
      tipos() { return app.doc.entities.map(e => e.type).join(','); },
      sel(indices) { app.selSet = indices.map(i => app.doc.entities[i]).filter(Boolean); },
      hist() { return document.getElementById('cmdhist').textContent.slice(-200); },
      /* Medidas de geometría, que es lo que consultan AREA y las cotas. */
      mide(i) {
        const e = app.doc.entities[i];
        if (!e) return null;
        return { area: window.CAD.E.areaOf(e, app.doc), perim: window.CAD.E.perimOf(e, app.doc) };
      }
    };
  });
  return { nav, pag, ruido };
}

export function cerca(a, b, tol = 1e-6) { return Math.abs(a - b) <= tol; }

/* El lanzador mira el código de salida. */
export function cierra(fallos, ruido) {
  console.log('\n================  ' + (fallos.length ? fallos.length + ' FALLO(S)' : 'TODO CORRECTO') + '  ================');
  fallos.forEach(f => console.log('  · ' + f));
  if (ruido && ruido.length) { console.log('\nRuido:'); ruido.slice(0, 6).forEach(r => console.log('  ' + r)); }
  if (fallos.length) process.exitCode = 1;
}
