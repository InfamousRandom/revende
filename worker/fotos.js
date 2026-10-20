// Revende 2.0, Fase V2: fotos de los artículos en R2 (bucket revende-fotos, binding FOTOS_ARTICULOS).
// Las rutas pasan por el mismo control de acceso que el historial.
import { json } from './util.js';

const TIPOS = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' };
const MAX_BYTES = 8 * 1024 * 1024;
const MAX_FOTOS = 12;

const sinBucket = () => json({ ok: false, error: 'Falta configurar el bucket de fotos (R2)' }, 500);

export async function listarFotos(env, operacionId) {
  const { results } = await env.DB.prepare(
    'SELECT id, tipo, orden, creado_en FROM fotos WHERE operacion_id = ? ORDER BY orden, id',
  )
    .bind(operacionId)
    .all();
  return json({ ok: true, fotos: results });
}

// El cuerpo es la imagen tal cual (Content-Type image/jpeg, image/png o image/webp).
export async function subirFoto(request, env, operacionId) {
  if (!env.FOTOS_ARTICULOS) return sinBucket();
  const tipo = (request.headers.get('content-type') || '').split(';')[0].trim().toLowerCase();
  if (!TIPOS[tipo]) return json({ ok: false, error: 'La foto debe ser JPG, PNG o WebP' }, 415);
  const existe = await env.DB.prepare('SELECT id FROM operaciones WHERE id = ?').bind(operacionId).first();
  if (!existe) return json({ ok: false, error: 'Esa operación no existe' }, 404);
  const { n, max } = await env.DB.prepare('SELECT count(*) AS n, max(orden) AS max FROM fotos WHERE operacion_id = ?')
    .bind(operacionId)
    .first();
  if (n >= MAX_FOTOS) return json({ ok: false, error: `Máximo ${MAX_FOTOS} fotos por artículo` }, 400);

  const bytes = await request.arrayBuffer();
  if (!bytes.byteLength) return json({ ok: false, error: 'La foto llegó vacía' }, 400);
  if (bytes.byteLength > MAX_BYTES) return json({ ok: false, error: 'La foto pesa más de 8 MB' }, 413);

  const clave = `operaciones/${operacionId}/${crypto.randomUUID()}.${TIPOS[tipo]}`;
  await env.FOTOS_ARTICULOS.put(clave, bytes, { httpMetadata: { contentType: tipo } });
  const foto = await env.DB.prepare(
    'INSERT INTO fotos (operacion_id, clave, tipo, orden) VALUES (?, ?, ?, ?) RETURNING id, tipo, orden, creado_en',
  )
    .bind(operacionId, clave, tipo, max == null ? 0 : max + 1)
    .first();
  return json({ ok: true, foto }, 201);
}

export async function servirFoto(env, id) {
  if (!env.FOTOS_ARTICULOS) return sinBucket();
  const fila = await env.DB.prepare('SELECT clave, tipo FROM fotos WHERE id = ?').bind(id).first();
  if (!fila) return json({ ok: false, error: 'Esa foto no existe' }, 404);
  const objeto = await env.FOTOS_ARTICULOS.get(fila.clave);
  if (!objeto) return json({ ok: false, error: 'No se encontró el archivo de la foto' }, 404);
  return new Response(objeto.body, {
    headers: { 'content-type': fila.tipo, 'cache-control': 'private, max-age=31536000, immutable' },
  });
}

// La foto elegida pasa a ser la portada (orden más bajo).
export async function hacerPortada(env, id) {
  const fila = await env.DB.prepare('SELECT operacion_id FROM fotos WHERE id = ?').bind(id).first();
  if (!fila) return json({ ok: false, error: 'Esa foto no existe' }, 404);
  const { minimo } = await env.DB.prepare('SELECT min(orden) AS minimo FROM fotos WHERE operacion_id = ?')
    .bind(fila.operacion_id)
    .first();
  await env.DB.prepare('UPDATE fotos SET orden = ? WHERE id = ?').bind((minimo ?? 0) - 1, id).run();
  return listarFotos(env, fila.operacion_id);
}

// Nuevo orden de las fotos (ids en el orden deseado; la primera es la portada). Deben ser todas.
export async function ordenarFotos(request, env, operacionId) {
  const ids = await request.json().then((c) => c?.ids).catch(() => null);
  if (!Array.isArray(ids) || !ids.every((i) => Number.isInteger(i))) return json({ ok: false, error: 'Manda la lista de fotos' }, 400);
  const { results } = await env.DB.prepare('SELECT id FROM fotos WHERE operacion_id = ?').bind(operacionId).all();
  const actuales = new Set(results.map((f) => f.id));
  if (ids.length !== actuales.size || !ids.every((i) => actuales.has(i))) {
    return json({ ok: false, error: 'La lista no coincide con las fotos del artículo' }, 400);
  }
  await env.DB.batch(ids.map((id, orden) => env.DB.prepare('UPDATE fotos SET orden = ? WHERE id = ?').bind(orden, id)));
  return listarFotos(env, operacionId);
}

export async function borrarFoto(env, id) {
  const fila = await env.DB.prepare('SELECT clave, operacion_id FROM fotos WHERE id = ?').bind(id).first();
  if (!fila) return json({ ok: false, error: 'Esa foto no existe' }, 404);
  if (env.FOTOS_ARTICULOS) await env.FOTOS_ARTICULOS.delete(fila.clave);
  await env.DB.prepare('DELETE FROM fotos WHERE id = ?').bind(id).run();
  return listarFotos(env, fila.operacion_id);
}

// Al borrar una operación se borran también sus archivos en R2.
export async function borrarFotosDeOperacion(env, operacionId) {
  const { results } = await env.DB.prepare('SELECT clave FROM fotos WHERE operacion_id = ?').bind(operacionId).all();
  if (results.length && env.FOTOS_ARTICULOS) await env.FOTOS_ARTICULOS.delete(results.map((f) => f.clave));
  await env.DB.prepare('DELETE FROM fotos WHERE operacion_id = ?').bind(operacionId).run();
}
