# Análisis de SellRaze (competencia)

Fecha: 2026-10-19. Versión analizada: SellRaze 5.26 para Android (`com.sellraze.scanner`, XAPK de APKPure).

Análisis estático: se revisaron el manifiesto, las librerías nativas, la configuración de Expo y unos
70,000 textos del bundle de JavaScript. No se ejecutó la app ni se descompiló el código, así que esto
describe qué hace, no la lógica exacta paso a paso.

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
