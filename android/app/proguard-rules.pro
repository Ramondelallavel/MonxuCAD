# El puente con la página se llama por reflexión desde JavaScript:
# sin esto, ofuscar se lleva por delante los métodos.
-keepclassmembers class es.monxucad.app.** {
  @android.webkit.JavascriptInterface <methods>;
}
