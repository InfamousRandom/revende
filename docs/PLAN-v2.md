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
| SerpApi | Plan gratis (250 búsquedas al mes). Se mide el uso y luego se decide. |
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

- [ ] Proyecto Expo en `movil/` (TypeScript, Expo Router), compatible con web desde el inicio.
- [ ] Sistema de diseño: colores como variables para claro y oscuro, tipografía, espacios en múltiplos
      de 8, botones en píldora, tarjetas, hojas que suben desde abajo, íconos de un solo set (Lucide).
- [ ] Barra inferior con las 5 secciones y pantallas vacías con su mensaje e invitación.
- [ ] Logo e ícono propios de Revende.
- [ ] Worker: emparejamiento por código.
  - [ ] **(Pablo)** Guardar el código en Cloudflare como Secret `REVENDE_DISPOSITIVO`.
  - [ ] Las rutas aceptan el código en un encabezado o, mientras exista la web actual, el mismo origen.
  - [ ] La app pide el código la primera vez y lo guarda cifrado (`expo-secure-store`).
- [ ] Generar el APK.
  - [ ] **(Pablo)** Crear cuenta gratis en expo.dev (compila el APK en la nube).
  - [ ] Perfil de compilación que entrega un APK instalable.

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
- [ ] Pantalla de procesando con avance por pasos.
- [ ] Resultado: sugerencia con nombre y marca, "¿No es? Corregir", precios nuevos y usados con tienda
      y link (`/api/identificar` + `/api/precios`), calculadora de precio máximo y botón "Lo compré".
- [ ] Capturas manuales de precio de usado, como hoy.

Terminado cuando: una foto identifica el artículo, muestra precios con fuente y lo guarda en inventario.

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
