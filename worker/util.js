// Utilidades compartidas por las rutas del Worker.

export const json = (datos, status = 200) => Response.json(datos, { status });

// Minúsculas, sin acentos y con espacios simples: para comparar y buscar texto escrito distinto.
export const normalizar = (texto) =>
  String(texto ?? '').toLowerCase().normalize('NFD').replace(/\p{M}/gu, '').replace(/\s+/g, ' ').trim();
