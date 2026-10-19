// Utilidades compartidas por las rutas del Worker.

export const json = (datos, status = 200) => Response.json(datos, { status });

// Minúsculas, sin acentos y con espacios simples: para comparar y buscar texto escrito distinto.
export const normalizar = (texto) =>
  String(texto ?? '').toLowerCase().normalize('NFD').replace(/\p{M}/gu, '').replace(/\s+/g, ' ').trim();

// Web actual: solo se aceptan llamadas hechas desde la propia página (mismo origen).
// Frena bots y usos casuales; no detiene a alguien que falsifique encabezados.
export function verificarOrigen(request) {
  const propio = new URL(request.url).origin;
  if (request.headers.get('origin') === propio || request.headers.get('sec-fetch-site') === 'same-origin') return null;
  return json({ ok: false, error: 'Esta función solo se puede usar desde la app.' }, 403);
}

// App nativa (Revende 2.0): el celular se empareja una vez con el código del Secret
// REVENDE_DISPOSITIVO y lo manda en este encabezado en cada llamada.
export const ENCABEZADO_DISPOSITIVO = 'x-revende-dispositivo';
const MAX_FALLOS = 5;
const BLOQUEO_SEGUNDOS = 15 * 60;

/**
 * Acceso a las rutas de la API. Con el encabezado del dispositivo se valida el código (y tras
 * varios fallos seguidos desde la misma IP se bloquea un rato); sin él, se exige el mismo origen,
 * para que la web actual siga funcionando hasta que se retire.
 */
export async function verificarAcceso(request, env) {
  const codigo = request.headers.get(ENCABEZADO_DISPOSITIVO);
  if (codigo == null) return verificarOrigen(request);
  if (!env.REVENDE_DISPOSITIVO) return json({ ok: false, error: 'Falta configurar REVENDE_DISPOSITIVO en Cloudflare' }, 500);

  // Sin ":" en la clave (las IPv6 los traen): el KV local de Windows no los acepta.
  const ip = (request.headers.get('cf-connecting-ip') || 'desconocida').replace(/[^0-9a-zA-Z.]/g, '_');
  const clave = `fallos-dispositivo_${ip}`;
  const fallos = Number((await env.CACHE?.get(clave)) || 0);
  if (fallos >= MAX_FALLOS) {
    return json({ ok: false, error: 'Demasiados intentos con un código incorrecto. Espera 15 minutos.' }, 429);
  }
  if (await mismoTexto(codigo, env.REVENDE_DISPOSITIVO)) return null;

  await env.CACHE?.put(clave, String(fallos + 1), { expirationTtl: BLOQUEO_SEGUNDOS });
  return json({ ok: false, error: 'El código del dispositivo no es correcto.' }, 401);
}

// Comparación en tiempo constante, para no revelar el código por cuánto tarda la respuesta.
async function mismoTexto(a, b) {
  const [ha, hb] = await Promise.all(
    [a, b].map((t) => crypto.subtle.digest('SHA-256', new TextEncoder().encode(String(t)))),
  );
  return crypto.subtle.timingSafeEqual(ha, hb);
}
