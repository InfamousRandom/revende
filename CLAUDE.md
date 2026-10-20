# Revende

App personal (PWA) para decidir rápido si conviene comprar un artículo para revenderlo en México:
identificarlo, ver precios reales dentro de la app, calcular el precio máximo de compra y llevar
registro de compras y ventas. Un solo usuario (Pablo). Interfaz en español de México, precios en MXN.

Plan por fases y tareas: `docs/PLAN.md`. Léelo antes de empezar cualquier tarea y marca lo que termines.

## Estado actual (2026-10-16)

- Fase 1 en producción: https://revende.molinapablo990.workers.dev
  - Buscador + escáner de código de barras (html5-qrcode), botones a tiendas, calculadora de
    precio máximo (precio de venta, gastos y ganancia buscada; sin comisiones).
- Worker en `worker/index.js` con:
  - `GET /api/salud`: indica qué secretos están configurados (sin mostrarlos).
  - `POST /api/analizar`: consulta Gemini con búsqueda de Google. **Inactivo**: la cuenta de
    Google está en prepago y responde 402 hasta que se compren créditos. No borrarlo; no es la ruta
    principal.
- Fase 2A en producción (2026-10-16):
  - `POST /api/precios`: SerpApi Google Shopping, filtros y cache KV `CACHE` (24 h).
  - `GET /api/cuota`: búsquedas restantes de SerpApi (consultar la cuenta no gasta búsquedas).
  - App: dos pantallas (Buscar, Calcular); foto con cámara dentro de la app (`CamaraFoto`) o galería.
  - `POST /api/identificar` + `GET /api/img/:id.jpg` (Google Lens; foto temporal en Durable Object).
- Fase 3 en producción (2026-10-16): historial en D1 (`DB`, base `revende-db`), código en
  `worker/historial.js` y `worker/csv.js`; app en `app/Historial.js`, `TusVentas.js`,
  `CapturaUsado.js`, `Respaldo.js`. El deploy de Cloudflare corre
  `npx wrangler d1 migrations apply revende-db --remote && npx wrangler deploy`.
  Local: `npx wrangler d1 migrations apply revende-db --local` y probar con
  `npx wrangler dev`. No escribir datos de prueba en producción.
- Repo: github.com/InfamousRandom/revende (rama `main`).

## Revende 2.0 (app nativa, en desarrollo desde 2026-10-19)

Plan: `docs/PLAN-v2.md`. Análisis de referencia: `docs/analisis-sellraze.md`. La web actual sigue en
producción hasta que la versión web de 2.0 la reemplace.

- App en `movil/`: Expo SDK 58 + Expo Router + TypeScript, solo Android (APK con EAS, perfil `apk`
  en `movil/eas.json`). Rutas en `movil/src/app/`; diseño en `movil/src/constants/theme.ts`.
  Antes de tocar APIs de Expo, leer `movil/AGENTS.md` (las APIs cambian entre versiones).
- Interfaz: usar la skill `ui-ux-pro-max` para decisiones de diseño. Estilo inspirado en SellRaze
  (azul marino, azul eléctrico, verde para dinero, amarillo-lima para destacar), claro y oscuro.
- Datos de ejemplo en `movil/src/datos/ejemplo.ts`: inventados, solo en desarrollo (`__DEV__`) y
  siempre con el aviso "Datos de ejemplo". Nunca en una compilación de producción.
- Acceso de la app: código del Secret `REVENDE_DISPOSITIVO` en el encabezado
  `x-revende-dispositivo` (`verificarAcceso` en `worker/util.js`); bloqueo de 15 min tras 5 fallos.
  La app lo guarda cifrado con `expo-secure-store`. Nunca pedirle a Pablo que pegue el código en el
  chat; él lo pone en `.dev.vars`.
- Comandos de la app (desde `movil/`): `npx expo start --web` (vista previa), `npx tsc --noEmit` y
  `npx eslint src` antes de dar algo por terminado. `movil/.env.local` (ignorado) puede apuntar
  `EXPO_PUBLIC_API_URL` al Worker local (`http://127.0.0.1:8787`); el Worker solo acepta CORS de
  `http://localhost:8081` para estas pruebas.
- `wrangler dev` en Windows: si el almacenamiento local (KV/D1) da "internal error", revisar que no
  queden procesos `wrangler dev`/`workerd` viejos corriendo.
- Rutas nuevas del Worker (2.0): `/api/emparejar`, `/api/operaciones/:id/fotos`, `/api/fotos/:id`
  (R2 `FOTOS_ARTICULOS`), `/api/catalogo` y `/api/codigo` (`worker/catalogo.js`), `/api/cartas`
  (`worker/cartas.js`), `/api/ebay` (`worker/ebay.js`, referencia internacional),
  `/api/valor-inventario` (historial.js; usa la tabla `precios_vistos` que llena `/api/precios`), `/api/insight` y `/api/autenticidad` (IA, ocultas en la app).
- Para probar la app en local sin el código real: `npx wrangler dev --var REVENDE_DISPOSITIVO:<prueba>`.
  La búsqueda de precios en local sí gasta SerpApi real.

## Stack

- Next.js 14.2.35 (App Router), exportación estática (`output: 'export'` en `next.config.mjs`),
  genera `out/`. Sin rutas de API de Next: todo el backend vive en el Worker.
- Cloudflare Workers con assets estáticos (`wrangler.jsonc`):
  - `main: worker/index.js`, `assets.directory: ./out`, binding `ASSETS`.
  - `run_worker_first: ["/api/*"]` para que `/api` siempre llegue al Worker.
- Deploy automático: Cloudflare Workers Builds en cada push a `main`
  (build: `npm run build`, deploy: `npx wrangler deploy`).
- Estilos: CSS propio en `app/globals.css` (variables con modo claro y oscuro, fuentes Barlow y
  Barlow Condensed). Sin Tailwind.
- Entorno del usuario: Windows con Git Bash.

## Comandos

```bash
npm run dev                      # solo frontend (sin /api)
npm run build                    # genera out/
npx wrangler dev                 # app + Worker en local (correr build antes)
npx wrangler deploy --dry-run    # validar config sin publicar
```

Secretos locales en `.dev.vars` (está en .gitignore). Nunca subirlo.

## Secretos (Cloudflare → Worker → Settings → Variables and Secrets, tipo Secret)

| Nombre | Uso | Estado |
| --- | --- | --- |
| `REVENDE_CLAVE` | Ya no se usa: el historial tampoco pide clave (2026-10-16) | Configurado, se puede borrar |
| `GEMINI_API_KEY` | Gemini (ruta inactiva) | Configurado |
| `SERPAPI_KEY` | Google Shopping y Google Lens vía SerpApi | Configurado |
| `REVENDE_DISPOSITIVO` | Código para emparejar la app nativa | Configurado |
| `ML_CLIENT_ID`, `ML_CLIENT_SECRET` | Catálogo de Mercado Libre (app propia de Pablo) | Pendiente en Cloudflare |
| `EBAY_CLIENT_ID`, `EBAY_CLIENT_SECRET` | eBay Browse API, keyset Production (cuenta de Pablo) | Pendiente en Cloudflare |

## Decisiones tomadas (y por qué)

- **Precio nuevo:** SerpApi, motor Google Shopping, México (`gl=mx`, `hl=es`). Datos reales y
  estructurados. Plan gratuito: 250 búsquedas al mes (la cuenta reporta 250 por hora como límite). Más exacto que pedirle precios
  a un LLM.
- **Identificar por foto:** SerpApi, motor Google Lens (`country=mx`). Necesita la imagen en una
  URL pública: el Worker la guarda unos minutos en un Durable Object (`FotoTemporal`) y la sirve
  en una ruta temporal (`/api/img/:id.jpg`).
- **Gemini con búsqueda:** pausado. Requiere $5 USD de prepago. Opción futura, no principal.
- **API de Mercado Libre:** solo el catálogo de productos (probado el 2026-10-19 con la app propia
  de Pablo y token `client_credentials`): nombre oficial, marca, modelo, año de lanzamiento y a veces
  precios de nuevo. La búsqueda de publicaciones (`/sites/MLM/search`) responde 403 incluso con token
  de app o de usuario, así que no sirve para precios de usados. Claves: `ML_CLIENT_ID` y
  `ML_CLIENT_SECRET` (en `.dev.vars` en local). Detalle en `docs/PLAN-v2.md`.
- **eBay:** solo referencia internacional (Browse API, gratis, no gasta SerpApi): usados que piden
  en eBay con envío a México, en pesos convertidos por eBay. Son precios de publicaciones activas, no
  ventas; se muestran aparte y nunca alimentan la calculadora. Nada de publicar en eBay.
- **Facebook Marketplace:** nada automatizado (viola términos). Precios de usado por captura
  manual rápida dentro de la app.
- **Datos del usuario (historial de ventas, capturas de usado):** en Cloudflare D1 desde el inicio
  (binding `DB`, migraciones de Wrangler en `migrations/`). Es el dato más valioso de la app y el
  navegador puede borrar lo guardado localmente (sobre todo en iPhone) o se pierde al cambiar de
  celular. Acceso solo vía Worker (mismo origen, sin clave).
- **Catálogo de productos:** cada operación se liga a un producto de un catálogo (categoría, marca,
  modelo, variante, código de barras) elegido con autocompletado, para agrupar ventas del mismo
  artículo aunque se escriba distinto.
- **Plataforma única:** todo en Cloudflare (Workers, KV, D1). No agregar Vercel ni Supabase.

## Reglas

- Ninguna llave en el frontend ni en el repo. Toda llamada a servicios externos pasa por el Worker.
- Sin pantalla de Ajustes (decisión de Pablo, 2026-10-16: era impráctico).
  - Precios y foto (`/api/precios`, `/api/identificar`, `/api/cuota`, `/api/analizar`) no piden
    clave: solo aceptan llamadas desde la propia app (`Origin` o `Sec-Fetch-Site: same-origin`).
    Protección ligera, no segura contra quien falsifique encabezados. Para probar con curl:
    `-H "Origin: http://localhost:8787"`. `/api/img/:id.jpg` es pública a propósito (Google la descarga).
  - Historial (rutas de D1) tampoco pide clave (decisión de Pablo, 2026-10-16: no la ve necesaria).
    Misma verificación de origen (`verificarOrigen` en `worker/util.js`). Riesgo aceptado: quien
    falsifique encabezados podría leer o cambiar el historial.
- Cuidar la cuota de SerpApi: cachear resultados en KV por consulta normalizada (24 h) y no
  repetir búsquedas automáticas. Nunca disparar búsquedas al escribir; solo al confirmar. Tomar
  una foto cuenta como confirmación: identifica y busca precios sola (2 búsquedas por foto, pedido
  de Pablo); elegir otra opción del nombre vuelve a buscar.
- Nunca mostrar un precio sin su fuente (tienda + link). Nunca inventar ni estimar precios de
  mercado. Única excepción: la estimación por factor de categoría de la Fase 3 (a partir de las
  ventas de Pablo), siempre etiquetada con su origen.
- Pablo vende en persona o por Marketplace: no hay comisiones; no volver a agregarlas (ni en la
  calculadora ni en el historial). El historial sí guarda el canal donde se vendió (en persona,
  Marketplace, otro) solo para comparar.
- Resultados sin ocultar (decisión de Pablo, 2026-10-16): mostrar todos los resultados de Google
  Shopping de todas las tiendas, separados en nuevos y usados/reacondicionados. Lo que parece
  accesorio, paquete o precio fuera de lo normal se muestra marcado en gris, al final, y no cuenta
  para el rango (mediana, mín, máx). Nunca quitar resultados de la lista.
- Registrar una compra o venta debe tomar menos de 30 segundos: autocompletar producto, valores
  por defecto, y obligatorio solo producto, precio y fecha.
- Móvil primero: botones grandes, una mano, legible al sol, modo claro y oscuro.
- Mantener el lenguaje visual actual (etiqueta amarilla, tipografías, variables de color).
- Cambios pequeños y probados con `npx wrangler dev` antes de hacer commit. Preguntar antes de
  hacer `git push`, porque cada push publica a producción.
- Textos de la interfaz en español de México, sin tecnicismos.
- Nunca dos archivos cuyo nombre solo cambie en mayúsculas (`Checklist.js` y `checklist.js`):
  en Windows son el mismo archivo y uno borra al otro; Cloudflare compila en Linux, donde son distintos.
- Orden de trabajo: Fase 2A (precios) → Fase 3 (historial en D1) → Fase 4 (foto) → Fase 5 (checklist).
  La identificación por foto con Lens ya está en producción; de la Fase 4 queda lo que depende del
  catálogo de la Fase 3.
