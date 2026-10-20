// Config plugin: expo-camera (lector de códigos) y @six33/react-native-bg-removal (quitar fondo) declaran
// cada uno su propio valor de `com.google.mlkit.vision.DEPENDENCIES` y el manifiesto de Android no los
// puede combinar ("Manifest merger failed"). Aquí se declaran todos juntos y se marca que este valor
// reemplaza a los de las librerías. ocr = lectura de texto (expo-text-extractor).
const { withAndroidManifest } = require('expo/config-plugins');

const NOMBRE = 'com.google.mlkit.vision.DEPENDENCIES';
const MODELOS = 'barcode_ui,subject_segment,ocr';

module.exports = function conMlkit(config) {
  return withAndroidManifest(config, (cfg) => {
    const manifiesto = cfg.modResults.manifest;
    manifiesto.$ = { ...manifiesto.$, 'xmlns:tools': 'http://schemas.android.com/tools' };
    const app = manifiesto.application?.[0];
    if (!app) return cfg;
    app['meta-data'] = (app['meta-data'] || []).filter((m) => m.$['android:name'] !== NOMBRE);
    app['meta-data'].push({
      $: { 'android:name': NOMBRE, 'android:value': MODELOS, 'tools:replace': 'android:value' },
    });
    return cfg;
  });
};
