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
  `npx wrangler dev --var REVENDE_CLAVE:prueba-local`. No escribir datos de prueba en producción.
- Repo: github.com/InfamousRandom/revende (rama `main`).

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
| `REVENDE_CLAVE` | Protege solo las rutas del historial (D1, Fase 3) vía encabezado `x-revende-clave` | Configurado |
| `GEMINI_API_KEY` | Gemini (ruta inactiva) | Configurado |
| `SERPAPI_KEY` | Google Shopping y Google Lens vía SerpApi | Configurado |

## Decisiones tomadas (y por qué)

- **Precio nuevo:** SerpApi, motor Google Shopping, México (`gl=mx`, `hl=es`). Datos reales y
  estructurados. Plan gratuito: 250 búsquedas al mes (la cuenta reporta 250 por hora como límite). Más exacto que pedirle precios
  a un LLM.
- **Identificar por foto:** SerpApi, motor Google Lens (`country=mx`). Necesita la imagen en una
  URL pública: el Worker la guarda unos minutos en un Durable Object (`FotoTemporal`) y la sirve
  en una ruta temporal (`/api/img/:id.jpg`).
- **Gemini con búsqueda:** pausado. Requiere $5 USD de prepago. Opción futura, no principal.
- **API de Mercado Libre:** no usar. La búsqueda pública devuelve 403 desde 2024.
- **Facebook Marketplace:** nada automatizado (viola términos). Precios de usado por captura
  manual rápida dentro de la app.
- **Datos del usuario (historial de ventas, capturas de usado):** en Cloudflare D1 desde el inicio
  (binding `DB`, migraciones de Wrangler en `migrations/`). Es el dato más valioso de la app y el
  navegador puede borrar lo guardado localmente (sobre todo en iPhone) o se pierde al cambiar de
  celular. Acceso solo vía Worker con `REVENDE_CLAVE`.
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
  - Historial (rutas de D1, Fase 3) sí exige `x-revende-clave` igual a `REVENDE_CLAVE`, porque son
    datos de Pablo. La app pide la clave una sola vez, en una ventanita la primera vez que se abre el
    historial, y la recuerda en el celular.
- Cuidar la cuota de SerpApi: cachear resultados en KV por consulta normalizada (24 h) y no
  repetir búsquedas automáticas. Nunca disparar búsquedas al escribir; solo al confirmar.
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
- Orden de trabajo: Fase 2A (precios) → Fase 3 (historial en D1) → Fase 4 (foto) → Fase 5 (checklist).
  La identificación por foto con Lens ya está en producción; de la Fase 4 queda lo que depende del
  catálogo de la Fase 3.
