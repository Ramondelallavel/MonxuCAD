package es.monxucad.app;

import android.app.Activity;
import android.content.ActivityNotFoundException;
import android.content.Intent;
import android.database.Cursor;
import android.net.Uri;
import android.os.Bundle;
import android.os.SystemClock;
import android.provider.OpenableColumns;
import android.util.Base64;
import android.util.Log;
import android.view.ViewGroup;
import android.webkit.ConsoleMessage;
import android.webkit.ValueCallback;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceError;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.Toast;

import androidx.webkit.WebViewAssetLoader;
import androidx.webkit.WebViewCompat;
import androidx.webkit.WebViewFeature;

import org.json.JSONObject;

import java.io.OutputStream;
import java.util.Collections;

/**
 * MonxuCAD para Android.
 *
 * Es la misma aplicación que corre en el navegador y en el escritorio,
 * dentro de un WebView.  Los archivos no se sirven por file://, sino
 * por https://appassets.androidplatform.net, que es un origen seguro
 * de verdad: así el almacenamiento local y fetch se comportan igual
 * que en el navegador en vez de quedar en un origen opaco.
 *
 * Lo que pone Android y la página no puede hacer por su cuenta es
 * abrir y guardar archivos, las dos cosas con el selector del sistema
 * y sin pedir un solo permiso.
 */
public class MainActivity extends Activity {

  private static final String ETIQUETA = "MonxuCAD";

  private static final String ORIGEN = "https://appassets.androidplatform.net";

  /* El repartidor de rutas QUITA su propio prefijo antes de buscar el
     archivo: con el prefijo «/aplicacion/», la dirección
     «/aplicacion/index.html» acaba abriendo «index.html» en la raíz de
     los activos, que es donde los deja Gradle.  Cambiar una de las dos
     cosas sin la otra deja la ventana en blanco sin decir por qué. */
  private static final String RUTA = "/aplicacion/";
  private static final String INICIO = ORIGEN + RUTA + "index.html";

  private static final int PIDE_ABRIR = 101;
  private static final int PIDE_GUARDAR = 102;

  private WebView web;

  /** Selector abierto por un <input type="file"> de la página. */
  private ValueCallback<Uri[]> alElegir;

  /** Guardado a medias: la página espera contestación con este número. */
  private String guardandoId;
  private byte[] guardandoDatos;

  private long ultimoAtras;

  @Override
  protected void onCreate(Bundle estado) {
    super.onCreate(estado);

    final WebViewAssetLoader cargador = new WebViewAssetLoader.Builder()
        .addPathHandler(RUTA, new WebViewAssetLoader.AssetsPathHandler(this))
        .build();

    web = new WebView(this);
    web.setLayoutParams(new ViewGroup.LayoutParams(
        ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.MATCH_PARENT));
    setContentView(web);

    WebSettings ajustes = web.getSettings();
    ajustes.setJavaScriptEnabled(true);
    ajustes.setDomStorageEnabled(true);
    ajustes.setAllowFileAccess(false);
    ajustes.setAllowContentAccess(true);
    ajustes.setSupportZoom(false);
    ajustes.setBuiltInZoomControls(false);
    ajustes.setDisplayZoomControls(false);
    /* La interfaz es densa y de medidas fijas: que el tamaño de letra
       del sistema no la descoloque. */
    ajustes.setTextZoom(100);

    web.addJavascriptInterface(new Puente(), "MonxuPuente");

    web.setWebViewClient(new WebViewClient() {
      @Override
      public WebResourceResponse shouldInterceptRequest(WebView vista, WebResourceRequest peticion) {
        return cargador.shouldInterceptRequest(peticion.getUrl());
      }

      @Override
      public boolean shouldOverrideUrlLoading(WebView vista, WebResourceRequest peticion) {
        Uri destino = peticion.getUrl();
        if (destino != null && ORIGEN.equals(destino.getScheme() + "://" + destino.getHost())) return false;
        /* Un enlace de fuera se abre en el navegador, no dentro. */
        try {
          startActivity(new Intent(Intent.ACTION_VIEW, destino));
        } catch (ActivityNotFoundException e) { /* sin nadie que lo abra */ }
        return true;
      }

      /* Si la aplicación no carga, lo que se ve es una ventana vacía y
         no hay manera de saber por qué.  Mejor decirlo. */
      @Override
      public void onReceivedError(WebView vista, WebResourceRequest peticion, WebResourceError error) {
        if (!peticion.isForMainFrame()) return;
        String donde = String.valueOf(peticion.getUrl());
        String motivo = String.valueOf(error.getDescription());
        Log.e(ETIQUETA, "No se pudo cargar " + donde + ": " + motivo);
        vista.loadDataWithBaseURL(null, paginaDeAviso(donde, motivo), "text/html", "utf-8", null);
      }

      @Override
      public void onPageFinished(WebView vista, String url) {
        /* Reserva para los WebView que no saben inyectar al principio
           del documento: la página sólo mira el puente al guardar, así
           que llegar ahora sigue valiendo. */
        if (!WebViewFeature.isFeatureSupported(WebViewFeature.DOCUMENT_START_SCRIPT)) inyecta();
      }
    });

    web.setWebChromeClient(new WebChromeClient() {
      @Override
      public boolean onConsoleMessage(ConsoleMessage msg) {
        if (msg.messageLevel() == ConsoleMessage.MessageLevel.ERROR)
          Log.e(ETIQUETA, msg.message() + "  (" + msg.sourceId() + ":" + msg.lineNumber() + ")");
        return true;
      }

      @Override
      public boolean onShowFileChooser(WebView vista, ValueCallback<Uri[]> respuesta,
                                       FileChooserParams parametros) {
        if (alElegir != null) alElegir.onReceiveValue(null);
        alElegir = respuesta;

        /* El intento que arma el WebView a partir del «accept» de la
           página arrastra la lista de tipos que sale de «.dxf, .dwg,
           .json, .dcad».  Android no conoce esas extensiones, así que
           esa lista no casa con ningún archivo: el selector salía
           vacío y lo único que ofrecía era crear uno nuevo.

           Se arma aquí uno propio.  ACTION_OPEN_DOCUMENT sólo sabe
           elegir archivos que ya existen —no tiene modo de crear— y
           se enseñan todos, porque quien mira la extensión al abrir
           es la propia aplicación. */
        Intent abrir = new Intent(Intent.ACTION_OPEN_DOCUMENT);
        abrir.addCategory(Intent.CATEGORY_OPENABLE);
        abrir.setType("*/*");
        try {
          startActivityForResult(abrir, PIDE_ABRIR);
          return true;
        } catch (ActivityNotFoundException e) {
          /* Reserva para un aparato sin selector de documentos. */
          Intent otro = new Intent(Intent.ACTION_GET_CONTENT);
          otro.addCategory(Intent.CATEGORY_OPENABLE);
          otro.setType("*/*");
          try {
            startActivityForResult(Intent.createChooser(otro, getString(R.string.elija)), PIDE_ABRIR);
            return true;
          } catch (ActivityNotFoundException e2) {
            alElegir = null;
            return false;
          }
        }
      }
    });

    if (WebViewFeature.isFeatureSupported(WebViewFeature.DOCUMENT_START_SCRIPT)) {
      WebViewCompat.addDocumentStartJavaScript(web, puenteJs(), Collections.singleton(ORIGEN));
    }

    web.loadUrl(INICIO);
  }

  private static String esc(String t) {
    return t.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;");
  }

  private static String paginaDeAviso(String donde, String motivo) {
    return "<!DOCTYPE html><html lang=\"es\"><head><meta charset=\"utf-8\">"
        + "<meta name=\"viewport\" content=\"width=device-width,initial-scale=1\">"
        + "<style>body{margin:0;padding:24px;background:#2b2e31;color:#dde1e6;"
        + "font:16px/1.5 sans-serif}h1{font-size:19px;margin:0 0 12px}"
        + "code{color:#e0a33a;word-break:break-all}p{color:#969ca4}</style></head><body>"
        + "<h1>MonxuCAD no ha podido abrirse</h1>"
        + "<p>No se pudo cargar <code>" + esc(donde) + "</code></p>"
        + "<p>" + esc(motivo) + "</p>"
        + "<p>Desinstale la aplicación y vuelva a instalarla; si sigue igual, "
        + "es un fallo del programa y conviene contarlo.</p>"
        + "</body></html>";
  }

  /* ------------------------------------------------------------
     El puente, visto desde la página

     window.MonxuNative.guardar devuelve una promesa porque el selector
     del sistema tarda lo que tarde la persona; el objeto que expone
     Android sólo sabe contestar en el acto, así que la promesa se
     queda aquí apuntada y se resuelve cuando vuelve el resultado.
     ------------------------------------------------------------ */
  private static String puenteJs() {
    return "(function () {\n"
        + "  var pendientes = {}, n = 0;\n"
        + "  window.MonxuNative = {\n"
        + "    donde: 'android',\n"
        + "    guardar: function (nombre, base64, tipo) {\n"
        + "      return new Promise(function (listo) {\n"
        + "        var id = 'g' + (++n);\n"
        + "        pendientes[id] = listo;\n"
        + "        try { MonxuPuente.guardar(id, nombre, base64, tipo || ''); }\n"
        + "        catch (e) { delete pendientes[id]; listo('error:' + e); }\n"
        + "      });\n"
        + "    },\n"
        + "    _resuelve: function (id, valor) {\n"
        + "      var f = pendientes[id];\n"
        + "      if (!f) return;\n"
        + "      delete pendientes[id];\n"
        + "      f(valor);\n"
        + "    }\n"
        + "  };\n"
        + "})();";
  }

  private void inyecta() {
    web.evaluateJavascript(puenteJs(), null);
  }

  private void contesta(final String id, final String valor) {
    final String js = "window.MonxuNative && window.MonxuNative._resuelve("
        + JSONObject.quote(id) + "," + JSONObject.quote(valor) + ")";
    runOnUiThread(new Runnable() {
      @Override public void run() {
        if (web != null) web.evaluateJavascript(js, null);
      }
    });
  }

  /* Lo llama JavaScript por reflexión, así que ni la clase ni el
     método pueden ser privados. */
  public class Puente {
    @android.webkit.JavascriptInterface
    public void guardar(final String id, final String nombre, final String base64, final String tipo) {
      final byte[] datos;
      try {
        datos = Base64.decode(base64, Base64.DEFAULT);
      } catch (IllegalArgumentException e) {
        contesta(id, "error:el archivo venía mal codificado");
        return;
      }
      runOnUiThread(new Runnable() {
        @Override public void run() {
          /* Sólo cabe un guardado a la vez: el selector es modal. */
          if (guardandoId != null) {
            contesta(id, "error:hay otro archivo guardándose");
            return;
          }
          guardandoId = id;
          guardandoDatos = datos;

          Intent intencion = new Intent(Intent.ACTION_CREATE_DOCUMENT);
          intencion.addCategory(Intent.CATEGORY_OPENABLE);
          intencion.setType(mimeLimpio(tipo));
          intencion.putExtra(Intent.EXTRA_TITLE, nombre);
          try {
            startActivityForResult(intencion, PIDE_GUARDAR);
          } catch (ActivityNotFoundException e) {
            guardandoId = null;
            guardandoDatos = null;
            contesta(id, "error:este teléfono no trae selector de archivos");
          }
        }
      });
    }
  }

  /**
   * El tipo llega de la página como lo da un Blob, con su juego de
   * caracteres detrás («application/dxf;charset=utf-8»).  setType no
   * admite parámetros y con una cadena que no sea tipo/subtipo lanza.
   */
  private static String mimeLimpio(String tipo) {
    String m = tipo == null ? "" : tipo.trim();
    int punto = m.indexOf(';');
    if (punto >= 0) m = m.substring(0, punto).trim();
    return m.matches("[\\w.+-]+/[\\w.+-]+") ? m : "application/octet-stream";
  }

  /* ------------------------------------------------------------
     Vuelta de los selectores del sistema
     ------------------------------------------------------------ */
  @Override
  protected void onActivityResult(int peticion, int resultado, Intent datos) {
    if (peticion == PIDE_ABRIR) {
      if (alElegir == null) return;
      alElegir.onReceiveValue(
          resultado == RESULT_OK ? WebChromeClient.FileChooserParams.parseResult(resultado, datos) : null);
      alElegir = null;
      return;
    }

    if (peticion == PIDE_GUARDAR) {
      String id = guardandoId;
      byte[] contenido = guardandoDatos;
      guardandoId = null;
      guardandoDatos = null;
      if (id == null) return;

      Uri destino = datos == null ? null : datos.getData();
      if (resultado != RESULT_OK || destino == null) {
        contesta(id, "cancelado");
        return;
      }
      try {
        /* «wt» vacía el archivo antes de escribir.  Guardando encima de
           uno más largo sin eso quedarían las sobras del anterior al
           final, y un DXF así no lo abre nadie.  No todos los
           proveedores lo admiten, de ahí la segunda intentona. */
        OutputStream salida;
        try {
          salida = getContentResolver().openOutputStream(destino, "wt");
        } catch (IllegalArgumentException e) {
          salida = getContentResolver().openOutputStream(destino);
        }
        if (salida == null) throw new java.io.IOException("no se pudo abrir el destino");
        try {
          salida.write(contenido);
          salida.flush();
        } finally {
          salida.close();
        }
        contesta(id, "ok:" + nombreDe(destino));
      } catch (Exception e) {
        contesta(id, "error:" + e.getMessage());
      }
      return;
    }

    super.onActivityResult(peticion, resultado, datos);
  }

  /** El nombre con el que ha quedado el archivo, para poder decirlo. */
  private String nombreDe(Uri destino) {
    Cursor c = null;
    try {
      c = getContentResolver().query(destino, new String[]{OpenableColumns.DISPLAY_NAME}, null, null, null);
      if (c != null && c.moveToFirst()) {
        String n = c.getString(0);
        if (n != null && !n.isEmpty()) return n;
      }
    } catch (Exception e) {
      /* si no se deja preguntar, con la ruta basta */
    } finally {
      if (c != null) c.close();
    }
    return destino.getLastPathSegment() == null ? "" : destino.getLastPathSegment();
  }

  /* ------------------------------------------------------------
     Tecla de volver

     En un programa de dibujo lo que se espera de ella es cancelar lo
     que se esté haciendo, no cerrar el dibujo.  Sale a la segunda.
     ------------------------------------------------------------ */
  @Override
  public void onBackPressed() {
    if (web != null) {
      web.evaluateJavascript(
          "document.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape',bubbles:true,cancelable:true}))", null);
    }
    long ahora = SystemClock.elapsedRealtime();
    if (ahora - ultimoAtras < 2000) {
      super.onBackPressed();
      return;
    }
    ultimoAtras = ahora;
    Toast.makeText(this, R.string.otra_vez, Toast.LENGTH_SHORT).show();
  }

  /* Android mata lo que está en segundo plano cuando necesita
     memoria, y no avisa.  Éste es el último momento seguro para
     dejar a salvo el dibujo. */
  @Override
  protected void onPause() {
    if (web != null) {
      web.evaluateJavascript(
          "window.CADCopia && window.CADAPP && window.CADCopia.guarda(window.CADAPP, 'segundo plano')", null);
    }
    super.onPause();
  }

  @Override
  protected void onDestroy() {
    if (web != null) {
      web.destroy();
      web = null;
    }
    super.onDestroy();
  }
}
