-- Revende 2.0, Fase V2: estado Descartado y fotos de cada artículo. Solo agrega; no cambia datos.

-- Fecha en que el artículo se dio por perdido, regalado o usado para piezas ('AAAA-MM-DD').
ALTER TABLE operaciones ADD COLUMN fecha_descartado TEXT;

-- Fotos guardadas en R2 (bucket revende-fotos). `clave` es la ruta del archivo en el bucket.
-- La de menor `orden` es la portada.
CREATE TABLE fotos (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  operacion_id INTEGER NOT NULL REFERENCES operaciones (id) ON DELETE CASCADE,
  clave        TEXT    NOT NULL UNIQUE,
  tipo         TEXT    NOT NULL CHECK (tipo IN ('image/jpeg', 'image/png', 'image/webp')),
  orden        INTEGER NOT NULL DEFAULT 0,
  creado_en    TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);
CREATE INDEX fotos_operacion ON fotos (operacion_id, orden);
