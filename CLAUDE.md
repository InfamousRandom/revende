# Revende

App personal (PWA) para decidir rápido si conviene comprar un artículo para revenderlo en México:
identificarlo, ver precios reales dentro de la app, calcular el precio máximo de compra y llevar
registro de compras y ventas. Un solo usuario (Pablo). Interfaz en español de México, precios en MXN.

Plan por fases y tareas: `docs/PLAN.md`. Léelo antes de empezar cualquier tarea y marca lo que termines.

## Estado actual (2026-10-16)

- Fase 1 en producción: https://revende.molinapablo990.workers.dev
  - Buscador + escáner de código de barras (html5-qrcode), botones a tiendas, calculadora de
    precio máximo, comisiones por canal guardadas en localStorage.
- Worker en `worker/index.js` con:
  - `GET /api/salud`: indica qué secretos están configurados (sin mostrarlos).
  - `POST /api/analizar`: consulta Gemini con búsqueda de Google. **Inactivo**: la cuenta de
    Google está en prepago y responde 402 hasta que se compren créditos. No borrarlo; no es la ruta
    principal.
- Fase 2A en producción (2026-10-16):
  - `POST /api/precios`: SerpApi Google Shopping, filtros y cache KV `CACHE` (24 h).
  - `GET /api/cuota`: búsquedas restantes de SerpApi (consultar la cuenta no gasta búsquedas).
  - App: botón "Buscar precios", tarjeta de resultados, clave de acceso en Ajustes.
  - Para probar en local sin usar la clave real: `npx wrangler dev --var REVENDE_CLAVE:prueba-local`.
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
| `REVENDE_CLAVE` | Clave que la app manda en el encabezado `x-revende-clave` | Configurado |
| `GEMINI_API_KEY` | Gemini (ruta inactiva) | Configurado |
| `SERPAPI_KEY` | Google Shopping y Google Lens vía SerpApi | Configurado |

## Decisiones tomadas (y por qué)

- **Precio nuevo:** SerpApi, motor Google Shopping, México (`gl=mx`, `hl=es`). Datos reales y
  estructurados. Plan gratuito: 250 búsquedas al mes (la cuenta reporta 250 por hora como límite). Más exacto que pedirle precios
  a un LLM.
- **Identificar por foto:** SerpApi, motor Google Lens (`country=mx`). Necesita la imagen en una
  URL pública: el Worker la guarda unos minutos en KV y la sirve en una ruta temporal.
- **Gemini con búsqueda:** pausado. Requiere $5 USD de prepago. Opción futura, no principal.
- **API de Mercado Libre:** no usar. La búsqueda pública devuelve 403 desde 2024.
- **Facebook Marketplace:** nada automatizado (viola términos). Precios de usado por captura
  manual rápida dentro de la app.
- **Datos del usuario (registro, capturas):** primero en el celular (IndexedDB), con exportar e
  importar respaldo en JSON. Sincronizar a Cloudflare D1 solo si hace falta después.
- **Plataforma única:** todo en Cloudflare (Workers, KV, D1). No agregar Vercel ni Supabase.

## Reglas

- Ninguna llave en el frontend ni en el repo. Toda llamada a servicios externos pasa por el Worker.
- Toda ruta `/api/*` (excepto `/api/salud`) exige `x-revende-clave` igual a `REVENDE_CLAVE`.
  La app guarda esa clave en el celular desde Ajustes.
- Cuidar la cuota de SerpApi: cachear resultados en KV por consulta normalizada (24 h) y no
  repetir búsquedas automáticas. Nunca disparar búsquedas al escribir; solo al confirmar.
- Nunca mostrar un precio sin su fuente (tienda + link). Nunca inventar ni estimar precios.
- Filtrar accesorios, fundas y productos distintos antes de calcular rangos (mediana, mín, máx).
- Mostrar solo lo útil: artículo, rango, 4-5 mejores ofertas, calculadora. Nada de datos crudos.
- Móvil primero: botones grandes, una mano, legible al sol, modo claro y oscuro.
- Mantener el lenguaje visual actual (etiqueta amarilla, tipografías, variables de color).
- Cambios pequeños y probados con `npx wrangler dev` antes de hacer commit. Preguntar antes de
  hacer `git push`, porque cada push publica a producción.
- Textos de la interfaz en español de México, sin tecnicismos.
