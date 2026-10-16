# Plan de Revende

Contexto, stack y reglas: `CLAUDE.md`. Marca cada tarea con [x] al terminarla.
Las tareas marcadas **(Pablo)** las hace el usuario en el navegador; Claude Code no las puede hacer.

## Hecho

- [x] Fase 0: cuentas (GitHub, Cloudflare, Google AI Studio, presupuesto y tope de gasto en Google Cloud).
- [x] Fase 1: PWA en producción con escáner, links a tiendas y calculadora.
- [x] Worker con `/api/salud` y `/api/analizar` (Gemini, inactivo por prepago).

## Fase 2A: precios nuevos dentro de la app (SerpApi + Google Shopping)

Objetivo: escribir o escanear un artículo y ver dentro de la app el rango de precio nuevo y las
mejores ofertas, sin salir a otras páginas.

- [x] **(Pablo)** Crear cuenta gratis en serpapi.com y guardar la llave en Cloudflare como Secret `SERPAPI_KEY`.
- [x] **(Pablo)** Crear un namespace KV llamado `revende-cache` (Cloudflare → Storage & Databases → KV)
      y pasar su ID para agregarlo a `wrangler.jsonc`. Alternativa: `npx wrangler kv namespace create revende-cache`.
- [x] Binding KV `CACHE` en `wrangler.jsonc`.
- [x] `POST /api/precios` en el Worker:
  - Recibe `{ consulta }`, valida `x-revende-clave` y longitud.
  - Llama a SerpApi `engine=google_shopping`, `q`, `gl=mx`, `hl=es`, `google_domain=google.com.mx`.
  - Normaliza cada resultado: título, tienda, precio numérico en MXN, link, miniatura.
  - Filtra: sin precio, duplicados por tienda, y precios atípicos (accesorios) respecto a la mediana.
  - Devuelve: `producto` (mejor título), `rango { min, mediana, max }`, `ofertas` (top 5), `total`.
  - Cache en KV 24 h por consulta normalizada; indicar en la respuesta si vino de cache.
  - Errores claros en español (sin llave, cuota agotada, sin resultados).
  - Nota: SerpApi ya no da el link directo de la tienda en Google Shopping, solo la ficha de
    Google (`product_link`), que muestra esa oferta con su tienda. El link directo costaría una
    búsqueda extra por oferta; por ahora no.
  - Ya no se quita nada (pedido de Pablo): todo se devuelve separado en `nuevos` y `usados`, cada
    uno con su `rango`. Se marca con `aviso` (no se quita) lo que parece accesorio, paquete
    (bundle/"+"/juego/edición especial, salvo que la consulta lo incluya) o precio < 35 % o > 200 %
    de la mediana; lo marcado no cuenta para el rango.
- [x] Pantalla de resultados en la app:
  - Botón "Buscar precios" (no busca mientras se escribe).
  - Tarjeta con precio típico de nuevo y de usado lado a lado, y listas completas de nuevos y
    usados (6 visibles + "Ver los N"); marcados en gris los paquetes/accesorios/atípicos.
  - Botón "Usar precio" en cada resumen que lleva ese valor a la calculadora.
  - Estados de carga, vacío y error.
- [x] Ajustes: campo "Clave de acceso" guardado en el celular; aviso si falta.
- [x] Mostrar búsquedas de SerpApi restantes del mes (`GET /api/cuota` → `serpapi.com/account.json`,
      no gasta búsquedas; se consulta al abrir y tras cada búsqueda que no sale de cache).

Terminado cuando: "PS5 Slim digital" muestra en menos de 5 s un rango coherente y ofertas con
tienda y link, sin accesorios; una segunda búsqueda igual sale de cache.

## Fase 2B: identificar por foto (SerpApi + Google Lens)

- [ ] Botón "Foto" que abre la cámara (`input type=file accept=image/* capture=environment`).
- [ ] Reducir la imagen en el celular (~1024 px, JPEG) antes de enviarla.
- [ ] `POST /api/identificar`:
  - Guarda la imagen en KV con ID aleatorio y TTL de 10 minutos.
  - Ruta pública temporal `GET /api/img/:id` que la sirve (solo IDs válidos y vigentes).
  - Llama a SerpApi `engine=google_lens`, `url`, `country=mx`.
  - Devuelve 3 nombres candidatos y, si vienen, precios de coincidencias de producto.
  - Borra la imagen al terminar.
- [ ] UI: muestra los candidatos, el usuario elige o edita el nombre (variante, capacidad) y
      confirma; entonces corre la búsqueda de precios de la Fase 2A.
- [ ] Consejo visible: fotografiar etiqueta, caja o número de modelo.

Terminado cuando: una foto de la caja de un producto común da el nombre correcto entre los
candidatos y lleva a sus precios con dos toques.

## Fase 3: registro de operaciones, inventario y precios de usado

Todo en el celular (IndexedDB), sin servidor.

- [ ] Registrar compra: artículo, fecha, precio, canal donde piensa vender, notas.
- [ ] Registrar venta: precio, fecha, dónde (en persona o Marketplace) y gastos reales.
- [ ] Inventario: artículos sin vender, días en inventario, dinero invertido.
- [ ] Resumen: ganancia real, margen real, días promedio para vender, por artículo y total.
- [ ] Captura rápida de precio usado (Marketplace, ML usado, otro): precio, condición, fecha, link opcional.
- [ ] En la tarjeta de resultados, mostrar el rango de usado con las capturas y ventas propias de ese artículo.
- [ ] Exportar e importar respaldo JSON.

Terminado cuando: se puede registrar una compra y su venta en menos de 30 s cada una y ver la
ganancia real y los días que tardó.

## Fase 4: checklist antes de comprar

- [ ] Checklist por categoría como datos fijos en la app: celulares, consolas, laptops, tablets,
      audio, relojes, tenis y ropa.
- [ ] Puntos antifraude: IMEI reportado, bloqueo de iCloud o cuenta Google, factura,
      señales de réplica, accesorios originales.
- [ ] Se muestra junto a los resultados según la categoría del artículo; se puede marcar cada punto.

## Fase 5: opcional, solo si el uso lo justifica

- [ ] Sincronizar el registro a Cloudflare D1 (respaldo y uso en varios dispositivos).
- [ ] Gemini como segunda opinión para identificar o para checklist específico (requiere prepago).
- [ ] Precios de usado de Mercado Libre vía scraper de pago (Apify) si la captura manual no basta.
- [ ] Alertas de oportunidades: avisar cuando aparezca algo por debajo del precio máximo.

## Decisiones pendientes

- Umbral exacto para descartar accesorios: hoy < 35 % y > 200 % de la mediana; ajustar con casos reales.
- Si conviene unificar `/api/analizar` (Gemini) con `/api/precios` o retirarlo más adelante.
