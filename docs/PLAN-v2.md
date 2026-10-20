# Plan de Revende 2.0 (app nativa)

Revende 2.0 es una actualización de Revende: app nativa de Android con más funciones y una interfaz
nueva inspirada en SellRaze (ver `docs/analisis-sellraze.md`). Sigue siendo personal (solo Pablo),
en español de México y con precios en MXN. Marca cada tarea con [x] al terminarla. Las tareas
marcadas **(Pablo)** las hace el usuario; Claude Code no las puede hacer.

La app web actual (Next.js, `docs/PLAN.md`) sigue en producción hasta que la versión web de 2.0 la
reemplace (Fase V9).

## Decisiones tomadas (2026-10-19)

| Tema | Decisión |
| --- | --- |
| Plataforma | React Native con Expo. Solo Android, instalada con un APK (sin Play Store). |
| Web | El mismo código genera la web después (Expo web). Se programa sin romperla desde el inicio. |
| Nombre | Revende. No comercial por ahora. |
| Repo y backend | Mismo repo y mismo Worker de Cloudflare (D1, KV, Durable Object). Se conserva el historial. |
| Acceso | Emparejar el celular una vez con un código; el Worker solo responde a quien lo traiga. |
| Estilo | Como SellRaze: fondo azul marino oscuro, azul eléctrico para la acción principal, verde para dinero, etiqueta amarilla-lima para destacar. Modo claro y oscuro. Logo, nombre y tonos propios. |
| SerpApi | Plan gratis (250 búsquedas al mes). Se mide el uso y luego se decide. Si no alcanza: Starter ($25/mes) o SearchApi ($40/mes, confirmar que incluya Lens). |
| Búsqueda | Por foto y por texto (nombre y/o modelo). Las dos terminan en el mismo resultado. |
| Identificar | De lo más barato a lo más caro: código de barras → etiqueta leída en el teléfono → Google Lens → IA con visión (respaldo). Texto va directo al catálogo. |
| Mercado Libre | Probado el 2026-10-19 con una app propia. Sí: catálogo de productos con token de app (nombre oficial, marca, modelo, color, año de lanzamiento y a veces precios de nuevo). No: la búsqueda de publicaciones (`/sites/MLM/search`) responde 403 incluso con permiso de usuario, así que no da precios de usados. |
| Precio de usado | Tu historial de ventas, capturas manuales de Marketplace, usados de Google Shopping y precios de Lens. Es el número que decide la compra; el precio nuevo es el techo. |
| Año de lanzamiento | Del catálogo de Mercado Libre (`RELEASE_YEAR`); si no viene, Wikidata. Se muestra discreto junto a la marca. |
| Calculadora | Precio máximo = precio de venta − ganancia buscada. Sin gastos. |
| Cartas | Solo Pokémon. |
| Inventario | Estados: En inventario, Publicado, Vendido, Descartado. |
| Fuera | Marketplace propio, Racks, Chat, publicar en marketplaces (incluido eBay), retiro automático, peso y medidas, IA de moda. |
| Ocultas | Autenticidad e Insight con IA: se construyen, pero no aparecen hasta activar un interruptor en el código. |

Reglas de `CLAUDE.md` que siguen vigentes: nunca un precio sin su fuente, no inventar precios,
sin comisiones, cuidar la cuota de SerpApi (cache 24 h, nada de búsquedas al escribir), registrar
en menos de 30 segundos, móvil primero, textos sin tecnicismos y preguntar antes de cada `git push`.
Al empezar la Fase V1 hay que actualizar `CLAUDE.md` (stack nativo, acceso por código).

## Navegación propuesta

Barra inferior de 5: **Inventario** (inicio), **Buscar**, **＋** (cámara), **Historial**, **Estadísticas**.

Flujo del ＋: Cámara (Identificar / Código / Lote / Cartas) → Procesando → Resultado (sugerencia,
precios con fuente, precio máximo de compra) → "Lo compré" (precio, fecha, condición en una sola
pantalla) → Guardado en inventario.

## Fase V1: base de la app

- [x] Proyecto Expo en `movil/` (Expo SDK 58, TypeScript, Expo Router), compatible con web.
- [x] Sistema de diseño (`movil/src/constants/theme.ts`): colores claro y oscuro con contraste
      revisado, Plus Jakarta Sans, espacios en múltiplos de 4/8, botones en píldora, íconos Lucide.
- [x] Barra inferior con las 5 secciones y pantallas vacías con su mensaje e invitación.
- [x] Pantallas con datos de ejemplo (solo en desarrollo, con aviso visible): inventario, ficha,
      historial, estadísticas, búsqueda por texto y escaneo simulado.
- [x] Logo e ícono propios de Revende (ícono, ícono adaptable de Android, splash y favicon).
- [ ] Worker: emparejamiento por código.
  - [x] **(Pablo)** Guardar el código en Cloudflare como Secret `REVENDE_DISPOSITIVO`.
  - [x] Las rutas aceptan el código en el encabezado `x-revende-dispositivo` o, mientras exista la
        web actual, el mismo origen (`verificarAcceso` en `worker/util.js`). `GET /api/emparejar`.
  - [x] Bloqueo de 15 minutos tras 5 códigos incorrectos seguidos desde la misma IP.
  - [x] La app pide el código la primera vez y lo guarda cifrado (`expo-secure-store`).
  - [x] Worker publicado (2026-10-19).
  - [ ] Si el Worker responde 401 en uso normal, volver a la pantalla de emparejar.
- [ ] Generar el APK.
  - [x] **(Pablo)** Crear cuenta gratis en expo.dev (compila el APK en la nube).
  - [x] Perfil de compilación `apk` en `movil/eas.json`.
  - [x] **(Pablo)** Primer APK compilado e instalado (2026-10-19); emparejó con su código.
        Para otro: desde `movil/`, `npx eas-cli@latest build -p android --profile apk`.

Terminado cuando: el APK se instala, se empareja con el código y muestra las 5 secciones en claro y oscuro.

## Fase V2: inventario e historial

- [x] Migración `0002`: estado Descartado (`fecha_descartado`) y tabla `fotos` (solo agrega).
- [x] Worker: columna `situacion` (4 estados; la web sigue con `estado`), `marca`, `portada_id` y
      `fotos` en cada operación; rutas de fotos en `worker/fotos.js` (subir, ver, portada, borrar);
      al borrar una operación se borran sus fotos de R2. CSV incluye `fecha_descartado`.
- [ ] Fotos en Cloudflare R2.
  - [x] Bucket R2 `revende-fotos` creado (2026-10-19) y binding `FOTOS_ARTICULOS` en `wrangler.jsonc`.
- [x] Inventario con pestañas En inventario / Publicado / Vendido / Descartado, en cuadrícula de 2
      columnas (foto, nombre, precio de compra), con datos reales de D1 y "jalar para actualizar".
- [x] Ficha del artículo: fotos (agregar con cámara o galería, portada, borrar) y datos en la misma
      pantalla. Pendiente: reordenar fotos arrastrando.
- [x] Marcar como publicado, vendido o descartado en uno o dos toques; deshacer y borrar en el menú.
- [x] Registrar compra (`movil/src/app/registrar.tsx`): autocompletado con tu catálogo, precio,
      hoy/ayer/otra fecha y condición; desde el + ("Registrar sin foto"), el botón + del inventario y
      "Lo compré" del resultado.
- [x] Historial y estadísticas con datos reales. El respaldo CSV sigue en la web.
- [x] Si el Worker rechaza el código guardado (401), la app vuelve a pedir emparejar.
- [x] Se publica junto con las fases V3 a V8 en un solo push y un solo APK (pedido de Pablo).

Terminado cuando: registrar una compra con foto toma menos de 30 segundos y el historial anterior aparece completo.

## Fase V3: cámara, identificación y precios

- [x] Cámara a pantalla completa con `expo-camera` (en lugar de vision-camera): disparador grande,
      galería, voltear, esquinas guía, cuadrícula y modos IDENTIFICAR / CÓDIGO / LOTE / CARTAS.
- [x] Leer el texto de la etiqueta en el teléfono (`expo-text-extractor`, ML Kit; no en la web).
- [x] Código de barras desde la misma cámara (`GET /api/codigo`: Mercado Libre o UPCitemdb, gratis).
- [x] Orden para identificar una foto: etiqueta con modelo reconocido por el catálogo → Lens.
      Pendiente: IA con visión como respaldo (depende de Gemini).
- [x] Búsqueda por texto (nombre y/o modelo) en Buscar y "¿No es? Corrige el nombre" en el resultado.
- [x] Catálogo de Mercado Libre en el Worker (`worker/catalogo.js`):
  - [x] **(Pablo)** Crear la app en developers.mercadolibre.com.mx (hecho el 2026-10-19).
  - [ ] **(Pablo)** Guardar `ML_CLIENT_ID` y `ML_CLIENT_SECRET` en Cloudflare como Secrets
        (en local ya están en `.dev.vars`). Sin ellos la app funciona, pero sin catálogo ni año.
  - [x] Token de app con `client_credentials` (6 h), guardado en KV y renovado solo.
  - [x] `GET /api/catalogo?q=` → nombre oficial, marca, modelo, color, año e imagen, en cache 24 h;
        ordenado por palabras que coinciden y con `completo` cuando trae todas.
  - [x] Precios de nuevo del catálogo cuando hay publicaciones, con link a Mercado Libre.
  - [x] Filtrar accesorios (fundas, cargadores, lectores, etc.).
- [x] Año de lanzamiento: catálogo de Mercado Libre. Pendiente: Wikidata cuando no viene.
- [x] Pantalla de procesando con avance por pasos (según foto, código o texto).
- [x] Resultado: sugerencia con origen, marca y año discreto, alternativas, precios nuevos y usados
      con tienda y link, tus ventas, Mercado Libre, Lens, calculadora sin gastos y "Lo compré"
      (la foto del escaneo se guarda como portada).
- [x] Capturas manuales de precio de usado en la app nativa (ver Fase V8b).

## Fase V4: editor de fotos

- [x] Recortar (cuadrado o vertical), girar, deshacer y rehacer; borrar o descartar.
- [x] Quitar el fondo en el teléfono (`@six33/react-native-bg-removal`, ML Kit; solo Android).
- [x] Elegir portada (desde la ficha). Pendiente: reordenar fotos arrastrando.

## Fase V5: escaneo masivo de lotes

- [x] Modo LOTE en la cámara (fotos y códigos), pantalla `lote` con búsqueda uno por uno y botón
      para parar, valor de reventa del lote con su fuente y veredicto contra lo que piden.
- [x] Avisa cuántas búsquedas puede gastar y cuántas quedan en el mes antes de empezar.

## Fase V6: cartas Pokémon

- [x] Modo CARTAS en la cámara: lee nombre y número de la carta en el teléfono.
- [x] `GET /api/cartas` (Pokémon TCG API): precio de mercado de TCGplayer en USD por variante.
- [x] Pesos con tipo de cambio del día (BCE vía Frankfurter), siempre con fecha y fuente.

## Fase V7: estadísticas

- [x] Ganancia del mes, invertido ahora, días para vender y ganancia por categoría (mejor a peor).
- [x] Pantallas vacías con explicación cuando todavía no hay datos.

## Fase V8: funciones ocultas (IA)

- [x] Interruptor `FUNCIONES` en `movil/src/constants/funciones.ts`, apagado.
- [x] "¿Es original?" (`POST /api/autenticidad`) e Insight (`POST /api/insight`, con fuentes).
- [ ] Activarlas cuando haya saldo en Gemini (hoy responde 402).

## Fase V8b: decidir y vender mejor (2026-10-20)

Sale de la comparación con otras apps de reventa (Flippd, Underpriced, Pocket Pricer, CollX). En el
orden que eligió Pablo:

- [x] Veredicto "Cómpralo / Regatea / No lo compres" en el resultado, con lo que piden
      (`datos/decision.ts`). El precio que piden pasa como precio de compra al registrar.
- [x] Precios que viste publicados (Marketplace, Mercado Libre, otro) anotados en el resultado:
      `POST /api/capturas`. Cuentan para la calculadora después de tus ventas y antes de Google.
      "Tus ventas" ya no mezcla las capturas.
- [x] Crear anuncio desde la ficha: título y descripción editables y compartir el texto (las fotos se
      agregan aparte; compartir imágenes necesitaría `expo-sharing`).
- [x] Historial de precios: cada búsqueda nueva de Google Shopping guarda su mediana del día en D1
      (`precios_vistos`, migración 0003) y el resultado muestra si subió o bajó.
- [x] Valor del inventario hoy (`GET /api/valor-inventario`): precio publicado o última mediana de
      usados buscada; sin dato no se estima. En Inicio y en la ficha.
- [x] Inventario estancado: más del doble de tus días típicos de venta (o 30 días). Aviso en Inicio
      y en la ficha.
- [x] Lote comprado: "Compré el lote" registra cada artículo con su parte de lo pagado (según lo que
      vale cada uno; si falta algún precio, en partes iguales).

## Antes del APK 4 (2026-10-20)

- [x] EAS Update (`expo-updates`, canal `apk`, `runtimeVersion` por fingerprint) y aviso "Versión
      nueva lista" en la app. Publicar: `npm run actualizar` desde `movil/`.
- [x] Anuncio con foto: comparte la portada (`expo-sharing`) y copia el texto (`expo-clipboard`).
- [x] Buscar por voz (`expo-speech-recognition`, es-MX) en los campos de búsqueda. Solo llena el
      texto; la búsqueda se confirma con la lupa. Necesita el permiso de micrófono.
- [x] Mercado Libre: la memoria del catálogo era anterior al campo `completo` (por eso no salían
      marca, año ni precios); ahora se busca dentro de la categoría que adivina ML
      (`domain_discovery`), con lo que "iPhone 13" ya no trae fundas ni "PS5" juegos. La categoría se
      sugiere al registrar. Los precios del catálogo casi nunca vienen (ML responde "No winners").
- [x] Miniaturas en los resultados de Google Shopping y búsquedas restantes de SerpApi en Inicio.
- [x] Gastos del mes (`gastos`, migración 0004, `/api/gastos`) en Estadísticas, con ganancia después
      de gastos. No se incluyen todavía en el respaldo CSV.
- [x] Reordenar fotos: mantener presionada y arrastrar (`/api/operaciones/:id/fotos/orden`).
- [x] Búsquedas sin señal: se guardan en el celular (`datos/pendientes.ts`, fotos copiadas) y se
      hacen solas al volver el internet (`expo-network`), con 30 s entre reintentos; el resultado
      queda en la pestaña Buscar.

## Fase V9: versión web

- [ ] Esperar a que la app nativa esté estable (acordado con Pablo).
- [ ] Exportar Expo web a `out/` desde el `npm run build` de la raíz para reemplazar la web de Next.js,
      y retirar la verificación por mismo origen.

## Pendiente externo

- [x] eBay (2026-10-20): `/api/ebay` (`worker/ebay.js`, Browse API con token de app). Usados de
      precio fijo con envío a México; eBay convierte a pesos y traduce títulos. Accesorios y precios
      raros marcados (no cuentan para el rango). En el resultado, sección "Referencia internacional"
      aparte, sin contar para la calculadora. Requiere la exención de borrado de cuentas (ya aprobada).
- [ ] Claves `EBAY_CLIENT_ID` y `EBAY_CLIENT_SECRET` en Cloudflare.

## Pendientes por decidir

- [ ] Uso real de SerpApi después de un mes: ¿alcanza el plan gratis?
