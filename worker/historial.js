// Fase 3: historial en D1 (catálogo de productos y operaciones de compra/venta).
// Todas las rutas exigen x-revende-clave: son datos de Pablo (ver CLAUDE.md).
import { json, normalizar } from './util.js';

const CONDICIONES = ['sellado', 'como_nuevo', 'usado_bueno', 'con_detalles'];
const CANALES = ['en_persona', 'marketplace', 'otro'];
const MAX_TEXTO = 120;
const MAX_NOTAS = 1000;
const MAX_PESOS = 10_000_000;

export const esRutaHistorial = (ruta) => /^\/api\/(productos|operaciones)(\/|$)/.test(ruta);

// ---------- Utilidades ----------

class ErrorDatos extends Error {}
const fallar = (mensaje) => {
  throw new ErrorDatos(mensaje);
};

function verificarClave(request, env) {
  if (!env.REVENDE_CLAVE) return json({ ok: false, error: 'Falta configurar la clave de acceso en Cloudflare' }, 500);
  if (request.headers.get('x-revende-clave') !== env.REVENDE_CLAVE) {
    return json({ ok: false, error: 'Clave de acceso incorrecta', clave: true }, 401);
  }
  if (!env.DB) return json({ ok: false, error: 'Falta configurar la base de datos (D1)' }, 500);
  return null;
}

// Fecha de hoy en México como 'AAAA-MM-DD' (valor por defecto de compra y venta).
const hoyMexico = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Mexico_City' }).format(new Date());

function texto(valor, campo, max = MAX_TEXTO) {
  if (valor === undefined || valor === null) return null;
  const t = String(valor).replace(/\s+/g, ' ').trim();
  if (t.length > max) fallar(`${campo}: máximo ${max} caracteres`);
  return t || null;
}

// Acepta 8200, "8200", "$8,200" o "8,200.00"; guarda pesos enteros.
function pesos(valor, campo) {
  if (valor === undefined || valor === null || valor === '') return null;
  const n = typeof valor === 'number' ? valor : Number(String(valor).replace(/[$,\s]/g, ''));
  if (!Number.isFinite(n) || n < 0) fallar(`${campo}: escribe una cantidad válida`);
  if (n > MAX_PESOS) fallar(`${campo}: cantidad demasiado grande`);
  return Math.round(n);
}

function fecha(valor, campo) {
  if (valor === undefined || valor === null || valor === '') return null;
  const t = String(valor).trim();
  const d = new Date(`${t}T12:00:00Z`);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(t) || Number.isNaN(d.getTime()) || d.toISOString().slice(0, 10) !== t) {
    fallar(`${campo}: usa el formato AAAA-MM-DD`);
  }
  return t;
}

function opcion(valor, campo, opciones) {
  if (valor === undefined || valor === null || valor === '') return null;
  if (!opciones.includes(valor)) fallar(`${campo}: usa ${opciones.join(', ')}`);
  return valor;
}

async function leerCuerpo(request) {
  try {
    const cuerpo = await request.json();
    if (cuerpo && typeof cuerpo === 'object' && !Array.isArray(cuerpo)) return cuerpo;
  } catch {}
  fallar('Datos inválidos');
}

// ---------- Productos ----------

const textoBusqueda = (p) =>
  normalizar([p.nombre, p.marca, p.modelo, p.variante, p.codigo_barras].filter(Boolean).join(' '));

// Escapa % y _ para usarlos dentro de LIKE.
const paraLike = (t) => t.replace(/[\\%_]/g, (c) => `\\${c}`);

async function buscarProductos(env, url) {
  const q = normalizar(url.searchParams.get('q') || '').slice(0, MAX_TEXTO);
  if (!q) {
    const { results } = await env.DB.prepare(
      `SELECT p.*, (SELECT count(*) FROM operaciones o WHERE o.producto_id = p.id) AS operaciones
       FROM productos p ORDER BY p.id DESC LIMIT 10`,
    ).all();
    return json({ ok: true, productos: results });
  }
  // Primero exige todas las palabras (en cualquier orden): "slim playstation" encuentra
  // "PlayStation 5 Slim". Si nada coincide, acepta cualquiera y ordena por cuántas coinciden:
  // así "ps5 slim" encuentra "PlayStation 5 Slim" aunque "ps5" no esté escrito.
  const palabras = q.split(' ').slice(0, 6);
  const patrones = palabras.map((p) => `%${paraLike(p)}%`);
  const coincide = `p.busqueda LIKE ? ESCAPE '\\'`;
  const consulta = (union) =>
    env.DB.prepare(
      `SELECT p.*, (SELECT count(*) FROM operaciones o WHERE o.producto_id = p.id) AS operaciones
       FROM productos p
       WHERE p.codigo_barras = ? OR (${palabras.map(() => coincide).join(union)})
       ORDER BY (p.codigo_barras = ?) DESC, (${palabras.map(() => `(${coincide})`).join(' + ')}) DESC,
         (p.busqueda LIKE ? ESCAPE '\\') DESC, operaciones DESC, length(p.nombre)
       LIMIT 10`,
    )
      .bind(q, ...patrones, q, ...patrones, `${paraLike(q)}%`)
      .all();
  let { results } = await consulta(' AND ');
  if (!results.length && palabras.length > 1) ({ results } = await consulta(' OR '));
  return json({ ok: true, productos: results });
}

async function crearProducto(request, env) {
  const c = await leerCuerpo(request);
  const p = {
    nombre: texto(c.nombre, 'Nombre'),
    // La categoría se guarda en minúsculas y sin acentos para agrupar ("Consolas" = "consolas").
    categoria: c.categoria ? normalizar(texto(c.categoria, 'Categoría')) || null : null,
    marca: texto(c.marca, 'Marca'),
    modelo: texto(c.modelo, 'Modelo'),
    variante: texto(c.variante, 'Variante'),
    codigo_barras: texto(c.codigo_barras, 'Código de barras', 40)?.replace(/\s/g, '') || null,
  };
  if (!p.nombre) fallar('Escribe el nombre del producto');

  if (p.codigo_barras) {
    const existente = await env.DB.prepare('SELECT * FROM productos WHERE codigo_barras = ?').bind(p.codigo_barras).first();
    if (existente) return json({ ok: false, error: 'Ya existe un producto con ese código de barras', producto: existente }, 409);
  }
  const producto = await env.DB.prepare(
    `INSERT INTO productos (nombre, categoria, marca, modelo, variante, codigo_barras, busqueda)
     VALUES (?, ?, ?, ?, ?, ?, ?) RETURNING *`,
  )
    .bind(p.nombre, p.categoria, p.marca, p.modelo, p.variante, p.codigo_barras, textoBusqueda(p))
    .first();
  return json({ ok: true, producto }, 201);
}

// ---------- Operaciones ----------

const CAMPOS_OPERACION = [
  'producto_id', 'condicion', 'precio_compra', 'fecha_compra', 'lugar_compra', 'precio_publicado',
  'fecha_publicado', 'precio_venta', 'fecha_venta', 'canal', 'envio_mxn', 'otros_gastos_mxn',
  'precio_nuevo_ref', 'notas',
];

// Valida y limpia los campos presentes en `c` (los ausentes no se tocan).
function limpiarOperacion(c) {
  const o = {};
  const hay = (k) => Object.prototype.hasOwnProperty.call(c, k);
  if (hay('producto_id')) {
    const id = Number(c.producto_id);
    if (!Number.isInteger(id) || id <= 0) fallar('Elige un producto');
    o.producto_id = id;
  }
  if (hay('condicion')) o.condicion = opcion(c.condicion, 'Condición', CONDICIONES);
  if (hay('canal')) o.canal = opcion(c.canal, 'Dónde se vendió', CANALES);
  for (const [k, nombre] of [
    ['precio_compra', 'Precio de compra'],
    ['precio_publicado', 'Precio publicado'],
    ['precio_venta', 'Precio de venta'],
    ['envio_mxn', 'Envío'],
    ['otros_gastos_mxn', 'Otros gastos'],
    ['precio_nuevo_ref', 'Precio nuevo de referencia'],
  ]) {
    if (hay(k)) o[k] = pesos(c[k], nombre);
  }
  for (const [k, nombre] of [
    ['fecha_compra', 'Fecha de compra'],
    ['fecha_publicado', 'Fecha de publicación'],
    ['fecha_venta', 'Fecha de venta'],
  ]) {
    if (hay(k)) o[k] = fecha(c[k], nombre);
  }
  if (hay('lugar_compra')) o.lugar_compra = texto(c.lugar_compra, 'Lugar de compra');
  if (hay('notas')) o.notas = texto(c.notas, 'Notas', MAX_NOTAS);
  if (o.envio_mxn === null) o.envio_mxn = 0;
  if (o.otros_gastos_mxn === null) o.otros_gastos_mxn = 0;
  if (o.precio_nuevo_ref === 0) o.precio_nuevo_ref = null;
  return o;
}

// Reglas sobre la operación completa (después de mezclar con lo guardado).
function completarOperacion(o) {
  // Valor por defecto: si hay precio pero no fecha, es de hoy (para registrar en menos de 30 s).
  if (o.precio_compra != null && !o.fecha_compra) o.fecha_compra = hoyMexico();
  if (o.precio_venta != null && !o.fecha_venta) o.fecha_venta = hoyMexico();
  if (o.precio_publicado != null && !o.fecha_publicado) o.fecha_publicado = hoyMexico();
  if (o.precio_compra == null) o.fecha_compra = null;
  if (o.precio_venta == null) o.fecha_venta = null;
  if (o.precio_compra == null && o.precio_venta == null) fallar('Escribe el precio de compra o el de venta');
  if (o.fecha_compra && o.fecha_venta && o.fecha_venta < o.fecha_compra) fallar('La venta no puede ser antes de la compra');
  return o;
}

// Columnas calculadas que regresan las consultas de operaciones.
const SELECT_OPERACION = `
  SELECT o.*, p.nombre AS producto, p.categoria,
    CASE WHEN o.fecha_venta IS NULL THEN 'inventario' ELSE 'vendido' END AS estado,
    CAST(julianday(coalesce(o.fecha_venta, ?)) - julianday(o.fecha_compra) AS INTEGER) AS dias,
    CASE WHEN o.precio_venta IS NOT NULL AND o.precio_compra IS NOT NULL
      THEN o.precio_venta - o.precio_compra - o.envio_mxn - o.otros_gastos_mxn END AS ganancia
  FROM operaciones o JOIN productos p ON p.id = o.producto_id`;

const leerOperacion = (env, id) =>
  env.DB.prepare(`${SELECT_OPERACION} WHERE o.id = ?`).bind(hoyMexico(), id).first();

async function crearOperacion(request, env) {
  const c = await leerCuerpo(request);
  if (c.producto_id === undefined) fallar('Elige un producto');
  const o = completarOperacion(limpiarOperacion(c));
  const existe = await env.DB.prepare('SELECT id FROM productos WHERE id = ?').bind(o.producto_id).first();
  if (!existe) return json({ ok: false, error: 'Ese producto no existe' }, 404);

  const campos = CAMPOS_OPERACION.filter((k) => o[k] !== undefined);
  const { id } = await env.DB.prepare(
    `INSERT INTO operaciones (${campos.join(', ')}) VALUES (${campos.map(() => '?').join(', ')}) RETURNING id`,
  )
    .bind(...campos.map((k) => o[k]))
    .first();
  return json({ ok: true, operacion: await leerOperacion(env, id) }, 201);
}

async function actualizarOperacion(request, env, id) {
  const actual = await env.DB.prepare('SELECT * FROM operaciones WHERE id = ?').bind(id).first();
  if (!actual) return json({ ok: false, error: 'Esa operación no existe' }, 404);
  const cambios = limpiarOperacion(await leerCuerpo(request));
  if (!Object.keys(cambios).length) fallar('No hay cambios');
  if (cambios.producto_id && cambios.producto_id !== actual.producto_id) {
    const existe = await env.DB.prepare('SELECT id FROM productos WHERE id = ?').bind(cambios.producto_id).first();
    if (!existe) return json({ ok: false, error: 'Ese producto no existe' }, 404);
  }
  const o = completarOperacion({ ...actual, ...cambios });
  const campos = CAMPOS_OPERACION;
  await env.DB.prepare(
    `UPDATE operaciones SET ${campos.map((k) => `${k} = ?`).join(', ')},
       actualizado_en = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
     WHERE id = ?`,
  )
    .bind(...campos.map((k) => o[k] ?? null), id)
    .run();
  return json({ ok: true, operacion: await leerOperacion(env, id) });
}

async function listarOperaciones(env, url) {
  const estado = url.searchParams.get('estado');
  const productoId = url.searchParams.get('producto_id');
  const filtros = [];
  const valores = [hoyMexico()];
  if (estado === 'inventario') filtros.push('o.fecha_venta IS NULL');
  else if (estado === 'vendido') filtros.push('o.fecha_venta IS NOT NULL');
  else if (estado) fallar('estado: usa inventario o vendido');
  if (productoId) {
    const id = Number(productoId);
    if (!Number.isInteger(id) || id <= 0) fallar('producto_id inválido');
    filtros.push('o.producto_id = ?');
    valores.push(id);
  }
  const { results } = await env.DB.prepare(
    `${SELECT_OPERACION} ${filtros.length ? `WHERE ${filtros.join(' AND ')}` : ''}
     ORDER BY coalesce(o.fecha_venta, o.fecha_compra) DESC, o.id DESC LIMIT 200`,
  )
    .bind(...valores)
    .all();
  return json({ ok: true, operaciones: results });
}

// ---------- Enrutador ----------

export async function historial(request, env, url) {
  const sinPermiso = verificarClave(request, env);
  if (sinPermiso) return sinPermiso;
  const ruta = url.pathname;
  const metodo = request.method;
  try {
    if (ruta === '/api/productos') {
      if (metodo === 'GET') return await buscarProductos(env, url);
      if (metodo === 'POST') return await crearProducto(request, env);
    }
    if (ruta === '/api/operaciones') {
      if (metodo === 'GET') return await listarOperaciones(env, url);
      if (metodo === 'POST') return await crearOperacion(request, env);
    }
    const unaOperacion = /^\/api\/operaciones\/(\d+)$/.exec(ruta);
    if (unaOperacion) {
      const id = Number(unaOperacion[1]);
      if (metodo === 'GET') {
        const operacion = await leerOperacion(env, id);
        return operacion ? json({ ok: true, operacion }) : json({ ok: false, error: 'Esa operación no existe' }, 404);
      }
      if (metodo === 'PATCH') return await actualizarOperacion(request, env, id);
    }
    return json({ ok: false, error: 'Ruta o método no válido' }, 404);
  } catch (e) {
    if (e instanceof ErrorDatos) return json({ ok: false, error: e.message }, 400);
    // Reglas de la base (CHECK, UNIQUE, FOREIGN KEY): mensaje claro en vez del error crudo.
    if (/constraint/i.test(String(e))) return json({ ok: false, error: 'Datos no válidos para guardar', detalle: String(e).slice(0, 200) }, 400);
    throw e;
  }
}
