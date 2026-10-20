-- Historial de precios: la mediana de cada búsqueda de Google Shopping, una fila por consulta y día.
-- Se llena sola con las búsquedas que ya se hacen (no gasta búsquedas extra). Solo agrega.

CREATE TABLE precios_vistos (
  id       INTEGER PRIMARY KEY AUTOINCREMENT,
  -- Consulta en minúsculas y sin acentos (misma clave que la memoria de 24 h).
  consulta TEXT    NOT NULL,
  fecha    TEXT    NOT NULL,
  nuevo    INTEGER CHECK (nuevo > 0),
  usado    INTEGER CHECK (usado > 0),
  UNIQUE (consulta, fecha)
);
