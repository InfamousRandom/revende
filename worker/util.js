// Utilidades compartidas por las rutas del Worker.

export const json = (datos, status = 200) => Response.json(datos, { status });

// Minúsculas, sin acentos y con espacios simples: para comparar y buscar texto escrito distinto.
export const normalizar = (texto) =>
  String(texto ?? '').toLowerCase().normalize('NFD').replace(/\p{M}/gu, '').replace(/\s+/g, ' ').trim();

// Sin clave de acceso (decisión de Pablo): solo se aceptan llamadas hechas desde la propia app.
// Frena bots y usos casuales; no detiene a alguien que falsifique encabezados.
export function verificarOrigen(request) {
  const propio = new URL(request.url).origin;
  if (request.headers.get('origin') === propio || request.headers.get('sec-fetch-site') === 'same-origin') return null;
  return json({ ok: false, error: 'Esta función solo se puede usar desde la app.' }, 403);
}
