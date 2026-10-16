-- Fase 3: catálogo de productos, historial de compras y ventas, y capturas de precio de usado.
-- Montos en pesos como enteros. Fechas de negocio como 'AAAA-MM-DD'; marcas de tiempo en ISO UTC.

CREATE TABLE productos (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  nombre        TEXT    NOT NULL CHECK (length(trim(nombre)) > 0),
  categoria     TEXT,
  marca         TEXT,
  modelo        TEXT,
  variante      TEXT,
  codigo_barras TEXT    UNIQUE,
  -- Nombre, marca, modelo, variante y código en minúsculas y sin acentos (lo llena el Worker),
  -- para que el autocompletado encuentre "playstation" aunque se haya escrito "PlayStation".
  busqueda      TEXT    NOT NULL,
  creado_en     TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);
CREATE INDEX productos_categoria ON productos (categoria);

CREATE TABLE operaciones (
  id                INTEGER PRIMARY KEY AUTOINCREMENT,
  producto_id       INTEGER NOT NULL REFERENCES productos (id),
  condicion         TEXT    CHECK (condicion IN ('sellado', 'como_nuevo', 'usado_bueno', 'con_detalles')),
  precio_compra     INTEGER CHECK (precio_compra >= 0),
  fecha_compra      TEXT,
  lugar_compra      TEXT,
  precio_publicado  INTEGER CHECK (precio_publicado >= 0),
  fecha_publicado   TEXT,
  precio_venta      INTEGER CHECK (precio_venta >= 0),
  fecha_venta       TEXT,
  -- Dónde se vendió, solo para comparar. Sin comisión (ver CLAUDE.md).
  canal             TEXT    CHECK (canal IN ('en_persona', 'marketplace', 'otro')),
  envio_mxn         INTEGER NOT NULL DEFAULT 0 CHECK (envio_mxn >= 0),
  otros_gastos_mxn  INTEGER NOT NULL DEFAULT 0 CHECK (otros_gastos_mxn >= 0),
  -- Precio nuevo típico (SerpApi) al momento de vender: base del factor por categoría.
  precio_nuevo_ref  INTEGER CHECK (precio_nuevo_ref > 0),
  notas             TEXT,
  creado_en         TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  actualizado_en    TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  -- Una operación es una compra, una venta (ej. importada sin compra) o ambas.
  CHECK (precio_compra IS NOT NULL OR precio_venta IS NOT NULL),
  CHECK ((precio_compra IS NULL) = (fecha_compra IS NULL)),
  CHECK ((precio_venta IS NULL) = (fecha_venta IS NULL))
);
-- Estado derivado: en inventario = fecha_venta IS NULL; vendido = fecha_venta IS NOT NULL.
CREATE INDEX operaciones_producto ON operaciones (producto_id);
CREATE INDEX operaciones_fecha_venta ON operaciones (fecha_venta);

CREATE TABLE capturas_usado (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  producto_id INTEGER NOT NULL REFERENCES productos (id),
  fuente      TEXT    NOT NULL CHECK (fuente IN ('marketplace', 'ml_usado', 'otro')),
  precio      INTEGER NOT NULL CHECK (precio >= 0),
  condicion   TEXT    CHECK (condicion IN ('sellado', 'como_nuevo', 'usado_bueno', 'con_detalles')),
  url         TEXT,
  fecha       TEXT    NOT NULL,
  creado_en   TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);
CREATE INDEX capturas_producto ON capturas_usado (producto_id, fecha);
