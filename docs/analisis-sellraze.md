# Análisis de SellRaze (competencia)

Fecha: 2026-10-19. Versión analizada: SellRaze 5.26 para Android (`com.sellraze.scanner`, XAPK de APKPure).

Análisis estático: se revisaron el manifiesto, las librerías nativas, la configuración de Expo y unos
70,000 textos del bundle de JavaScript. En una segunda pasada se descompiló el código Java/Kotlin con
JADX (vía REA). No se ejecutó la app, y el JavaScript (Hermes) no se descompiló, así que esto describe
qué hace, no la lógica exacta paso a paso. Ver "Segunda pasada" al final.

## En una frase

App para revendedores (enfocada en EE. UU.): le tomas foto a un artículo, te dice qué es y cuánto vale,
y lo publica a la vez en varios marketplaces. Además tiene su propio marketplace.

## Cómo está hecha

- React Native + Expo (SDK 57), con el JavaScript compilado a bytecode Hermes (bundle de 32 MB).
- Backend propio: `api.sellraze.com`. Ahí viven la IA, el inventario, pagos y mensajería.
- Actualizaciones de código sin pasar por la tienda (Expo Updates, canal `production`).

## Funciones principales

1. **Identificar por foto**
   - En el teléfono: códigos de barras y texto de etiquetas (ML Kit de Google, TensorFlow Lite).
   - En el servidor: función "Lens" con respaldo de IA. Devuelve qué es el artículo y "Here's what it's worth".
2. **Precio sugerido**: precio basado en el mercado ("smartPricing.marketBased") y búsqueda con Algolia.
3. **Publicar en varios sitios y retirar al vender**
   - Marketplaces: eBay, Poshmark, Mercari, Depop, Vinted, Facebook Marketplace, Whatnot, OfferUp, GOAT, Etsy y Shopify.
   - eBay: login oficial (OAuth).
   - Mercari, Whatnot, Depop y otros: parece que el usuario inicia sesión dentro de la app, la app guarda
     sus cookies de sesión y usa las APIs web internas de esos sitios (por ejemplo `webapi.depop.com`).
     Deducido de textos como "temporary marketplace cookie key" y "No Whatnot cookies"; no se vio el código.
   - Tarea en segundo plano ("background_delist") que retira el anuncio de los demás sitios cuando se vende en uno.
4. **Escaneo masivo e inventario**: escanear muchos artículos seguidos, organizarlos en "racks"/"trays", exportar.
5. **Marketplace propio**: carrito, ofertas, mensajes, pagos con Stripe, guías de envío con Shippo y
   "Buyer Protection" (el pago al vendedor queda retenido hasta que el comprador acepta o se resuelve un reclamo).
6. **Moda con IA**: probarse ropa virtualmente (decart.ai) y "Roast", donde la IA califica tu outfit en
   video en vivo (LiveKit/WebRTC).

## Cómo cobra

Suscripciones y paywalls (RevenueCat, Superwall, Helium) con facturación de Google Play. Pruebas
gratis, referidos y recompensas por ver anuncios.

## Rastreo y privacidad

- AppsFlyer, Branch, PostHog, Firebase, Sentry y FingerprintJS Pro (huella persistente del dispositivo).
- Permisos sensibles: contactos, micrófono, cámara, Bluetooth, ID de publicidad.
- Si conectas tus cuentas, guarda tus sesiones de otros marketplaces.

## Qué se puede aprender para Revende

Ideas a evaluar, sin cambiar las decisiones de `CLAUDE.md`:

- **Escáner en el teléfono antes de gastar búsquedas**: SellRaze lee código de barras y texto de la
  etiqueta localmente antes de llamar a su servidor. Revende ya lee códigos de barras; leer el texto de
  la etiqueta (marca, modelo) podría mejorar la búsqueda sin gastar cuota de SerpApi.
- **Escaneo masivo**: útil si Pablo evalúa lotes (bazar, remate). Encaja con el historial en D1.
- **No aplica**: publicar en varios marketplaces y retirar anuncios automáticamente. Depende de
  automatizar sesiones de terceros, y Revende decidió no automatizar Facebook Marketplace.

## Segunda pasada: verificación con JADX (2026-10-19)

APK base `com.sellraze.scanner` 5.26, SHA-256 `8a9ab92f…8d9a57`. Herramientas: REA 6.7.0 con
jadx-headless-mcp 0.7.1.

### Qué hay en el código Java/Kotlin

- Solo 18 clases son propias de SellRaze (`com.sellraze.scanner.*`): arranque de la app y módulos
  pequeños (texto con la cámara, reseñas, reCAPTCHA, diagnósticos de SSL y de "Roast"). Las otras
  ~31,700 clases son librerías. **La lógica del producto vive en el JavaScript**, no en Java.
- Trae el módulo nativo `@react-native-cookies/cookies` (`CookieManagerModule`): lee y escribe las
  cookies del WebView de Android (`get`, `getAll`, `set`, `clearAll`, `flush`), y también `react-native-webview`.
- El trabajo en segundo plano usa `expo-background-task`: Android WorkManager con un trabajo único
  (`EXPO_BACKGROUND_WORKER`) que corre cada N minutos y solo con internet.

### Sesiones de los marketplaces: confirmado en gran parte

Antes era una deducción. Ahora hay piezas de los dos lados:

- **En el teléfono (observado)**: el módulo que lee las cookies del WebView y el componente WebView
  están incluidos. Que el login de cada marketplace se abra ahí se deduce de lo de abajo, no se vio.
- **En el JavaScript (textos del bundle)**: llamadas a su servidor llamadas `useStoreCookieMutation`,
  `useGetAllCookiesQuery`, `useRemoveMarketplaceCookieMutation`, y rutas `/integrations/get-cookie`,
  `/integrations/remove-cookie`, `/integrations/all-cookies-status`, `/api/marketplaces/common/get_cookies`.
  Eventos como `marketplace_cookie_persist_succeeded`, `link_cookie_captured`, `vinted_cookies_captured_at`
  y `facebook_session_cookie_reconciled`.
- **Conclusión (inferencia fuerte)**: entras a Mercari, Poshmark, Vinted, Facebook, etc. dentro de un
  WebView, la app copia las cookies de esa sesión y **las sube al servidor de SellRaze**, que las usa para
  publicar, revisar y retirar anuncios en tu nombre. No se vio el código exacto que arma la petición.
- **Soporte técnico puede pedir tus sesiones**: hay un flujo "Support Cookie Share" (solicitar, aceptar,
  revocar) en `/mobile/support/cookie-share-request/`.
- Choca con protecciones anti-bots: aparece `datadome_session_blocked`.

### Retiro automático de anuncios: cómo funciona

- Una tarea de fondo en JavaScript ("BackgroundDelist") se registra con `expo-background-task` y Android
  la despierta periódicamente (solo con internet). Primero revisa que el servidor responda ("Server unhealthy").
- Consulta el estado de los anuncios (`/api/listings/listing_status/poll_single_listing_async`,
  `/api/listings/listing_status/on_sold`) y registra intentos en `/delist_attempt`. Eventos:
  `background_delist_task_scan_completed`, `_completed`, `_skipped`, `_failed`.
- Hay casos manuales: si no puede confirmar el anuncio de Poshmark ("Could not safely identify the
  current Poshmark listing for delisting") te pide hacerlo tú.
- No se pudo ver el intervalo exacto: lo fija el JavaScript, que no se descompiló.

### Precio sugerido

Hay rutas `/mobile/lens/ai-pricing` y `/mobile/sold-comps`, con campos como `sold_comps_count` y
`pricing_source_type`. Indica que el precio se calcula **en su servidor** con ventas ya cerradas
("sold comps") y IA. Cómo pondera los datos no se puede ver desde la app.

### Lo que sigue sin verificarse

- El código JavaScript exacto. Haría falta un decompilador de Hermes (por ejemplo `hermes-dec`).
- Todo lo que pasa en `api.sellraze.com`: identificación, IA, precios y uso de tus sesiones.
- Ningún comportamiento observado en ejecución: no se instaló ni se corrió la app.
