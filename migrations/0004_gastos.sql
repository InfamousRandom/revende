-- Gastos del mes que no son de un artículo (gasolina, publicidad, bolsas…), para ver la ganancia neta
-- en Estadísticas. La calculadora de compra no los usa. Solo agrega.

CREATE TABLE gastos (
  id        INTEGER PRIMARY KEY AUTOINCREMENT,
  concepto  TEXT    NOT NULL CHECK (length(trim(concepto)) > 0),
  monto     INTEGER NOT NULL CHECK (monto > 0),
  fecha     TEXT    NOT NULL,
  creado_en TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);
CREATE INDEX gastos_fecha ON gastos (fecha);
