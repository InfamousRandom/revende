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
  - Recibe `{ consulta }`, valida que venga de la app (mismo origen) y la longitud.
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
- [x] ~~Ajustes con clave de acceso~~: se quitó por impráctica; ahora solo mismo origen.
- [x] Mostrar búsquedas de SerpApi restantes del mes (`GET /api/cuota` → `serpapi.com/account.json`,
      no gasta búsquedas; se consulta al abrir y tras cada búsqueda que no sale de cache).

Terminado cuando: "PS5 Slim digital" muestra en menos de 5 s un rango coherente y ofertas con
tienda y link, sin accesorios; una segunda búsqueda igual sale de cache.

## Fase 3: historial de ventas (Cloudflare D1)

Objetivo: tener referencias de lo que ya vendí para saber en cuánto puedo dar un artículo, y
estimar precios de artículos que nunca he vendido a partir de mi historial por categoría.

Preparación:

- [x] **(Pablo)** Crear base D1 `revende-db` en Cloudflare y pasar su ID
      (alternativa: `npx wrangler d1 create revende-db`).
- [x] Binding `DB` en `wrangler.jsonc` y carpeta `migrations/` (`0001_historial.sql`).
- [x] **(Pablo)** Que el deploy aplique las migraciones: en Cloudflare → Workers → revende →
      Settings → Build → Deploy command, cambiar `npx wrangler deploy` por
      `npx wrangler d1 migrations apply revende-db --remote && npx wrangler deploy`.
      Sin esto, la base de producción queda sin tablas. Hacerlo antes del primer push de la Fase 3.
- Local: `npx wrangler d1 migrations apply revende-db --local` (correr antes de `wrangler dev`).

Esquema inicial (ajustable):

- `productos`: id, nombre, categoria, marca, modelo, variante, codigo_barras (único, opcional), creado_en.
- `operaciones`: id, producto_id, condicion (sellado | como_nuevo | usado_bueno | con_detalles),
  precio_compra, fecha_compra, lugar_compra, precio_publicado, fecha_publicado, precio_venta,
  fecha_venta, canal (en_persona | marketplace | otro), envio_mxn, otros_gastos_mxn,
  precio_nuevo_ref (precio nuevo de SerpApi al momento de vender), notas, creado_en, actualizado_en.
  Estado derivado: en inventario (sin fecha_venta) o vendido. Sin comisión (ver `CLAUDE.md`).
- `capturas_usado`: id, producto_id, fuente (marketplace | ml_usado | otro), precio, condicion,
  url opcional, fecha.
- Montos en pesos como enteros; fechas ISO.
- Implementado en `migrations/0001_historial.sql`, con: columna `productos.busqueda` (texto sin
  acentos para autocompletar, la llena el Worker), `CHECK` de condición, canal y fuente, precios
  no negativos, precio y fecha de venta juntos (y de compra), y al menos compra o venta.

API (sin clave; solo desde la app, igual que precios y foto):

- [x] `GET /api/productos?q=` (autocompletado por nombre, marca, modelo o código de barras) y
      `POST /api/productos`.
- [x] `POST /api/operaciones` y `PATCH /api/operaciones/:id` (registrar compra y luego venta);
      `GET /api/operaciones?estado=&producto_id=`.
  - Código en `worker/historial.js` (utilidades compartidas en `worker/util.js`).
  - Autocompletado: cada palabra debe aparecer, sin importar acentos ni orden; el código de barras
    exacto va primero. Categoría guardada en minúsculas sin acentos para agrupar.
  - Valores por defecto: si hay precio sin fecha, la fecha es hoy (hora de México); envío y otros
    gastos en 0. Montos aceptan "$8,200". Las respuestas traen `estado`, `dias` y `ganancia`
    (venta − compra − envío − otros gastos) calculados.
  - También `GET /api/operaciones/:id`. Falta borrar operaciones (por si se registra mal).
- [x] `POST /api/capturas` (fuente por defecto Marketplace, fecha de hoy, link opcional solo http/https).
- [x] `GET /api/referencias?producto_id=` o `?q=`: mis ventas de ese producto (precio, días para
      vender, condición, canal, descuento vs publicado); mediana, mínimo y máximo de mis ventas y
      capturas (últimos 12 meses); si no hay ventas del producto, factor de la categoría = mediana de
      (precio_venta / precio_nuevo_ref) y estimación con el precio nuevo actual de la Fase 2A.
  - Con `q` solo acepta un producto si coincide el código o el 60 % de las palabras importantes
    (sin "gb", "de", etc.), para no mezclar artículos. Devuelve `otros` para elegir.
  - El precio nuevo típico de cada búsqueda se recuerda por producto en KV (`nuevo:<id>`, 30 días)
    y se guarda solo como `precio_nuevo_ref` al registrar la venta.
- [x] `GET /api/exportar` (CSV) y `POST /api/importar` (CSV de ventas pasadas).
  - `worker/csv.js` sin dependencias: separador , o ; (Excel en español), comillas, BOM para acentos
    y celdas que empiezan con = + - @ protegidas contra fórmulas.
  - Importar acepta encabezados en español con o sin acentos y fechas AAAA-MM-DD o DD/MM/AAAA; la
    fecha es obligatoria por fila. Productos por código de barras o nombre; si no existen se crean.
  - `?probar=1` muestra registros, productos nuevos, repetidos y errores por fila sin guardar.
    Repetidos: misma compra y venta, o misma venta (producto, precio, fecha) si la fila no trae compra.
    Reimportar el propio respaldo no duplica nada. Máximo 1 MB y 2000 filas.

Pantallas:

- [x] Registrar compra y venta en menos de 30 s, con autocompletado de producto o creación en el momento.
  - Pestaña "Historial" (`app/Historial.js`, `app/SelectorProducto.js`, `app/historial-api.js`).
  - Compra: producto + precio (condición "usado bueno" y fecha de hoy por defecto; lugar, fecha y
    notas plegados). 5 acciones con producto existente, 7 creando uno nuevo con categoría.
  - Venta: tocar el artículo del inventario + precio (Marketplace y hoy por defecto; envío y otros
    gastos plegados), con ganancia en vivo. 3 acciones. También "Otro artículo" sin compra registrada.
  - Atajo "Lo compré" en Calcular: abre la compra con el nombre buscado y el precio que te piden.
  - Autocompletado: si no coinciden todas las palabras, busca con cualquiera ("ps5 slim" encuentra
    "PlayStation 5 Slim"). Editar y borrar: ver la tarea de la pantalla "Historial".
- [x] Al buscar un artículo: tarjeta "Tus ventas" arriba de los precios nuevos, con el contraste
      precio contra rapidez (ej. "$7,200 en 3 días · $7,800 en 21 días").
- [x] La calculadora usa como precio de venta esperado la mediana de mis ventas, o la estimación por
      categoría si no hay ventas, indicando de dónde salió el número.
- [x] Pantalla "Historial": búsqueda, filtros (categoría, vendido o en inventario), ganancia real,
      margen, días promedio para vender y dinero parado en inventario.
  - `GET /api/operaciones` acepta `categoria` y `q`, y devuelve `totales` sobre todo lo filtrado
    (no solo los 200 listados) y las `categorias` con registros. Margen = ganancia ÷ precio de venta
    de las ventas con compra registrada.
  - Tocar un registro abre "Corregir registro": editar cualquier campo, "Deshacer venta" (vuelve a
    inventario; no aparece en ventas sin compra) y "Borrar registro" con confirmación
    (`DELETE /api/operaciones/:id`).
- [x] ~~Clave de acceso para el historial~~: se quitó a pedido de Pablo; solo mismo origen.
- [x] Captura rápida de precio de usado desde la tarjeta de resultados (`app/CapturaUsado.js`):
      "Anotar un precio de usado que viste" en Buscar, 3 acciones; se ve en "Tus ventas".
- [x] Exportar e importar CSV: sección "Respaldo" al final del Historial (`app/Respaldo.js`).

Terminado cuando: registro una venta en menos de 30 s; al buscar ese producto veo mi venta con días
para vender; y para un producto nuevo de una categoría con ventas veo una estimación por el factor
de la categoría.

## Fase 4: identificar por foto (SerpApi + Google Lens)

La parte de Lens ya está en producción (se hizo antes como "Fase 2B"); falta lo que depende del
catálogo de la Fase 3.

- [x] Botón "Foto" que abre la cámara dentro de la app (`getUserMedia`, `app/CamaraFoto.js`), con "Galería"
      como alternativa. Se cambió porque en varios celulares `capture=environment` abría la galería.
- [x] Reducir la imagen en el celular (~1024 px, JPEG) antes de enviarla.
- [x] `POST /api/identificar`:
  - Guarda la imagen con ID aleatorio y vida de 10 minutos en un Durable Object (`FotoTemporal`),
    que se lee igual desde cualquier región (Google la descarga desde EE. UU.). La URL termina en
    `.jpg`. Nota: se cambió de KV a DO por una sospecha de propagación que resultó falsa (la prueba
    usaba un archivo HTML en vez de imagen); el DO se quedó por ser más seguro.
  - Si no hay candidatos, la respuesta trae `detalle`: quién descargó la foto y
    qué contestó Lens. Verificado en producción el 2026-10-16: foto de PS5 → candidatos en 4.4 s.
  - Ruta pública temporal `GET /api/img/:id` que la sirve (solo IDs válidos y vigentes).
  - Llama a SerpApi `engine=google_lens`, `url`, `country=mx`.
  - Devuelve 3 nombres candidatos y, si vienen, precios de coincidencias de producto.
  - Borra la imagen al terminar.
- [x] UI: muestra los candidatos, el usuario elige o edita el nombre (variante, capacidad) y
      confirma; entonces corre la búsqueda de precios de la Fase 2A.
- [x] Consejo visible: fotografiar etiqueta, caja o número de modelo.
- [x] **(Pablo)** Probar en producción con una foto real (confirmado por Pablo el 2026-10-16; en local Lens no puede ver la foto porque
      `localhost` no es público).
- [x] Nombre elegido solo (pedido de Pablo, 2026-10-16): el Worker devuelve `sugerido`, el título
      cuyas palabras más se repiten entre los resultados de Lens, sin las que casi nadie usa ("envío
      gratis", tiendas). Se pone en el buscador; las demás opciones y los precios de la foto quedan
      plegados. No busca precios solo (1 búsqueda por foto, no 2). Foto reducida a 800 px.
- [x] Después de la foto se buscan los precios solos (pedido de Pablo): 2 búsquedas por foto.
- [x] Tarjeta de precios más visual: foto del producto, miniatura por oferta y barra de precios
      (más barato, típico, más caro, un punto por oferta). Cache `precios3` por el cambio de formato.
- [x] Al mostrar candidatos de la foto, incluir también productos de mi catálogo que coincidan
      ("En tu historial", `productosDelCatalogo` con la regla estricta del 60 % de palabras).
- [x] Al confirmar un candidato, mostrar precios y mi historial de ese producto (precios automáticos
      + tarjeta "Tus ventas").
- Notas: candidatos salen de `related_content` de Lens (nombres limpios) y de títulos de
  coincidencias; tocar un candidato llena el buscador y NO busca precios solo (cuida la cuota).

Terminado cuando: una foto de la caja de un producto común da el nombre correcto entre los
candidatos y lleva a sus precios y mi historial con dos toques.

## Fase 5: checklist antes de comprar

- [x] Checklist por categoría como datos fijos en la app: celulares, consolas, laptops, tablets,
      audio, relojes, tenis y ropa (`app/checklist-datos.js`), más puntos generales.
- [x] Puntos antifraude: IMEI reportado, bloqueo de iCloud o cuenta Google, factura,
      señales de réplica, accesorios originales (marcados con `fraude: true`, en rojo).
- [x] Se muestra junto a los resultados según la categoría del artículo; se puede marcar cada punto
      (`app/Checklist.js`, debajo de los precios). Categoría: la de tu historial, si no por palabras
      del nombre ("iPhone", "PS5", "Jordan"); se puede cambiar. Las marcas no se guardan: son por
      revisión y se reinician al buscar otro artículo.

## Fase 6: opcional, solo si el uso lo justifica

- [ ] Gemini como segunda opinión para identificar o para checklist específico (requiere prepago).
- [ ] Precios de usado de Mercado Libre vía scraper de pago (Apify) si la captura manual no basta.
- [ ] Alertas de oportunidades: avisar cuando aparezca algo por debajo del precio máximo.
- [ ] Fotos de cada artículo en el historial (evaluar costo).

## Decisiones pendientes

- Umbral exacto para descartar accesorios: hoy < 35 % y > 200 % de la mediana; ajustar con casos reales.
- Si conviene unificar `/api/analizar` (Gemini) con `/api/precios` o retirarlo más adelante.
- Si el factor por categoría debe ajustarse por condición (sellado vs usado) cuando haya suficientes datos.
