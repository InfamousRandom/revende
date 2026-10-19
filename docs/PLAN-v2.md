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
  - [ ] Publicar el Worker (preguntar antes del push a `main`).
  - [ ] Si el Worker responde 401 en uso normal, volver a la pantalla de emparejar.
- [ ] Generar el APK.
  - [x] **(Pablo)** Crear cuenta gratis en expo.dev (compila el APK en la nube).
  - [x] Perfil de compilación `apk` en `movil/eas.json`.
  - [ ] **(Pablo)** `npx eas-cli@latest login` y luego `npx eas-cli@latest build -p android --profile apk`.

Terminado cuando: el APK se instala, se empareja con el código y muestra las 5 secciones en claro y oscuro.

## Fase V2: inventario e historial

- [ ] Migración `0002`: estado Descartado (`fecha_descartado`) y fotos por operación.
- [ ] Fotos en Cloudflare R2.
  - [ ] **(Pablo)** Crear el bucket R2 `revende-fotos` (o `npx wrangler r2 bucket create revende-fotos`).
- [ ] Inventario con pestañas En inventario / Publicado / Vendido / Descartado, en cuadrícula de 2
      columnas (foto, nombre, precio de compra).
- [ ] Ficha del artículo: álbum (portada, reordenar arrastrando, menú por foto) y datos en la misma
      pantalla, sin abrir una pantalla por campo.
- [ ] Marcar como publicado, vendido o descartado en uno o dos toques.
- [ ] Historial y respaldo CSV con lo que ya existe en D1.

Terminado cuando: registrar una compra con foto toma menos de 30 segundos y el historial anterior aparece completo.

## Fase V3: cámara, identificación y precios

- [ ] Cámara a pantalla completa (`react-native-vision-camera`): disparador grande, galería, voltear,
      esquinas guía, varias fotos por artículo, ajustes de brillo y cuadrícula.
- [ ] Leer el texto de la etiqueta en el teléfono (ML Kit) para mejorar la búsqueda sin gastar cuota.
- [ ] Código de barras desde la misma cámara.
- [ ] Código de barras → nombre con UPCitemdb (gratis, 100 al día) antes de gastar una búsqueda.
- [ ] Orden para identificar una foto: código de barras → etiqueta → Lens → IA con visión.
- [ ] Búsqueda por texto (nombre y/o modelo) en la sección Buscar, y "¿No es? Corrige el nombre" en
      el resultado. Solo busca al confirmar, nunca mientras se escribe.
- [ ] Catálogo de Mercado Libre en el Worker:
  - [x] **(Pablo)** Crear la app en developers.mercadolibre.com.mx (hecho el 2026-10-19).
  - [ ] **(Pablo)** Guardar `ML_CLIENT_ID` y `ML_CLIENT_SECRET` en Cloudflare como Secrets
        (en local ya están en `.dev.vars`).
  - [ ] Token de app con `client_credentials` (dura 6 h), guardado en KV y renovado solo.
  - [ ] `GET /api/catalogo?q=` → productos con nombre oficial, marca, modelo, color y año
        (`/products/search` y `/products/{id}`), en cache KV 24 h.
  - [ ] Precios de nuevo del catálogo (`/products/{id}/items`) cuando haya publicaciones, con link
        y marcados como fuente "Mercado Libre".
  - [ ] Filtrar accesorios: el catálogo los mezcla (fundas, cargadores) con el producto.
- [ ] Año de lanzamiento: catálogo de Mercado Libre; si no viene, Wikidata.
- [ ] Pantalla de procesando con avance por pasos.
- [ ] Resultado: sugerencia con nombre, marca y año discreto, "¿No es? Corrige el nombre", precios
      nuevos y usados con tienda y link (`/api/identificar` + `/api/precios` + `/api/catalogo`),
      calculadora de precio máximo (sin gastos) y botón "Lo compré".
- [ ] Capturas manuales de precio de usado, como hoy.

Terminado cuando: una foto o un texto identifica el artículo, muestra precios con fuente y lo guarda
en inventario; una foto con código o etiqueta legible gasta como máximo 1 búsqueda de SerpApi.

## Fase V4: editor de fotos

- [ ] Recortar, girar, borrar, deshacer y rehacer.
- [ ] Quitar el fondo en el teléfono (ML Kit Subject Segmentation), sin servicios de pago.
- [ ] Elegir portada.

## Fase V5: escaneo masivo de lotes

- [ ] Modo Lote: varias fotos o códigos seguidos, cola de procesamiento y resumen del lote (costo
      total, valor estimado con fuente por artículo).
- [ ] Avisar cuántas búsquedas de SerpApi gastará el lote antes de empezar.

## Fase V6: cartas Pokémon

- [ ] Modo Cartas en la cámara: identificar la carta por nombre y número.
- [ ] Precios desde la API pública de Pokémon TCG (precios de TCGplayer en USD), siempre con su fuente.
- [ ] Si se muestra en pesos, indicar el tipo de cambio y de dónde sale.

## Fase V7: estadísticas

- [ ] Ganancia del mes, dinero invertido en inventario, días promedio para vender, mejores y peores categorías.
- [ ] Pantallas vacías con explicación cuando todavía no hay datos.

## Fase V8: funciones ocultas (IA)

- [ ] Interruptor en el código (`FUNCIONES`), apagado por defecto.
- [ ] Revisar si es auténtico.
- [ ] Insight: si conviene comprar para revender, siempre con sus fuentes.
- [ ] Dependen de Gemini (hoy pausado por prepago); no se activan hasta decidirlo.

## Fase V9: versión web

- [ ] Activar Expo web con alternativas para la cámara, la lectura de etiquetas y quitar el fondo.
- [ ] Reemplazar la web de Next.js en Cloudflare y retirar la verificación por mismo origen.

## Pendientes por decidir

- [ ] Uso real de SerpApi después de un mes: ¿alcanza el plan gratis?
