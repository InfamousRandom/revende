// Fase 3: historial en D1 (catálogo de productos y operaciones de compra/venta).
// Sin clave (decisión de Pablo, 2026-10-16): como precios, solo acepta llamadas desde la app.
import { json, normalizar, verificarAcceso } from './util.js';
import { escribirCsv, leerCsv } from './csv.js';
import { borrarFoto, borrarFotosDeOperacion, hacerPortada, listarFotos, ordenarFotos, servirFoto, subirFoto } from './fotos.js';

const CONDICIONES = ['sellado', 'como_nuevo', 'usado_bueno', 'con_detalles'];
const CANALES = ['en_persona', 'marketplace', 'otro'];
const MAX_TEXTO = 120;
const MAX_NOTAS = 1000;
const MAX_PESOS = 10_000_000;

export const esRutaHistorial = (ruta) => /^\/api\/(productos|operaciones|referencias|capturas|exportar|importar|fotos|valor-inventario|gastos)(\/|$)/.test(ruta);

const FUENTES = ['marketplace', 'ml_usado', 'otro'];

const DIAS_REFERENCIA = 365; // ventas y capturas de los últimos 12 meses
const NUEVO_REF_SEGUNDOS = 30 * 24 * 60 * 60; // precio nuevo recordado por producto (KV)
const claveNuevo = (productoId) => `nuevo:${productoId}`;

function mediana(numeros) {
  const orden = [...numeros].sort((a, b) => a - b);
  const mitad = Math.floor(orden.length / 2);
  return orden.length % 2 ? orden[mitad] : (orden[mitad - 1] + orden[mitad]) / 2;
}
const resumir = (precios) =>
  precios.length ? { n: precios.length, mediana: Math.round(mediana(precios)), min: Math.min(...precios), max: Math.max(...precios) } : null;

// ---------- Utilidades ----------

class ErrorDatos extends Error {}
const fallar = (mensaje) => {
  throw new ErrorDatos(mensaje);
};

async function verificarHistorial(request, env) {
  const fuera = await verificarAcceso(request, env);
  if (fuera) return fuera;
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
  return json({ ok: true, productos: await productosQueCoinciden(env, q) });
}

// Primero exige todas las palabras (en cualquier orden): "slim playstation" encuentra
// "PlayStation 5 Slim". Si nada coincide, acepta cualquiera y ordena por cuántas coinciden:
// así "ps5 slim" encuentra "PlayStation 5 Slim" aunque "ps5" no esté escrito.
// Cada resultado trae `aciertos` (palabras que coinciden) y `palabras` (total buscado).
async function productosQueCoinciden(env, q) {
  const palabras = q.split(' ').slice(0, 6);
  const patrones = palabras.map((p) => `%${paraLike(p)}%`);
  const coincide = `p.busqueda LIKE ? ESCAPE '\\'`;
  const aciertos = palabras.map(() => `(${coincide})`).join(' + ');
  const consulta = (union) =>
    env.DB.prepare(
      `SELECT p.*, (SELECT count(*) FROM operaciones o WHERE o.producto_id = p.id) AS operaciones,
         (${aciertos}) AS aciertos, (p.codigo_barras = ?) AS por_codigo
       FROM productos p
       WHERE p.codigo_barras = ? OR (${palabras.map(() => coincide).join(union)})
       ORDER BY por_codigo DESC, aciertos DESC, (p.busqueda LIKE ? ESCAPE '\\') DESC, operaciones DESC, length(p.nombre)
       LIMIT 10`,
    )
      .bind(...patrones, q, q, ...patrones, `${paraLike(q)}%`)
      .all();
  let { results } = await consulta(' AND ');
  if (!results.length && palabras.length > 1) ({ results } = await consulta(' OR '));
  return results.map((p) => ({ ...p, palabras: palabras.length }));
}

// Palabras que no distinguen un producto de otro ("128 gb" no hace igual a un iPhone y un Galaxy).
const PALABRAS_GENERICAS = new Set(['de', 'del', 'la', 'el', 'los', 'las', 'con', 'y', 'en', 'para', 'sin', 'gb', 'tb', 'mb', 'nuevo', 'usado', 'original']);

// Para referencias hay que estar seguros de que es el mismo artículo: código de barras exacto o
// al menos 60 % de las palabras importantes de la búsqueda.
async function productoParaReferencias(env, q) {
  const importantes = q.split(' ').filter((p) => p.length > 1 && !PALABRAS_GENERICAS.has(p));
  if (!importantes.length) return { producto: null, otros: [] };
  const candidatos = (await productosQueCoinciden(env, importantes.join(' '))).filter(
    (p) => p.por_codigo || p.aciertos / p.palabras >= 0.6,
  );
  return {
    producto: candidatos[0] || null,
    otros: candidatos.slice(1, 4).map((p) => ({ id: p.id, nombre: p.nombre })),
  };
}

// Productos de tu catálogo que coinciden con los nombres detectados en una foto (Fase 4).
// Usa la misma regla estricta de referencias para no sugerir un artículo distinto.
export async function productosDelCatalogo(env, nombres) {
  if (!env.DB) return [];
  const encontrados = new Map();
  for (const nombre of nombres.filter(Boolean).slice(0, 3)) {
    const { producto, otros } = await productoParaReferencias(env, normalizar(nombre).slice(0, MAX_TEXTO));
    for (const p of [producto, ...otros].filter(Boolean)) {
      if (!encontrados.has(p.id)) encontrados.set(p.id, { id: p.id, nombre: p.nombre });
    }
  }
  return [...encontrados.values()].slice(0, 3);
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
  'precio_nuevo_ref', 'notas', 'fecha_descartado',
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
    ['fecha_descartado', 'Fecha de descarte'],
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
  if (o.fecha_venta && o.fecha_descartado) fallar('Un artículo vendido no puede estar descartado');
  return o;
}

// Columnas calculadas que regresan las consultas de operaciones.
const SELECT_OPERACION = `
  SELECT o.*, p.nombre AS producto, p.categoria, p.marca, p.modelo,
    CASE WHEN o.fecha_venta IS NULL THEN 'inventario' ELSE 'vendido' END AS estado,
    -- Estado de Revende 2.0 (la web actual sigue usando estado).
    CASE WHEN o.fecha_venta IS NOT NULL THEN 'vendido'
         WHEN o.fecha_descartado IS NOT NULL THEN 'descartado'
         WHEN o.fecha_publicado IS NOT NULL THEN 'publicado'
         ELSE 'inventario' END AS situacion,
    (SELECT f.id FROM fotos f WHERE f.operacion_id = o.id ORDER BY f.orden, f.id LIMIT 1) AS portada_id,
    (SELECT count(*) FROM fotos f WHERE f.operacion_id = o.id) AS fotos,
    CAST(julianday(coalesce(o.fecha_venta, ?)) - julianday(o.fecha_compra) AS INTEGER) AS dias,
    CASE WHEN o.precio_venta IS NOT NULL AND o.precio_compra IS NOT NULL
      THEN o.precio_venta - o.precio_compra - o.envio_mxn - o.otros_gastos_mxn END AS ganancia
  FROM operaciones o JOIN productos p ON p.id = o.producto_id`;

const leerOperacion = (env, id) =>
  env.DB.prepare(`${SELECT_OPERACION} WHERE o.id = ?`).bind(hoyMexico(), id).first();

async function crearOperacion(request, env) {
  const c = await leerCuerpo(request);
  if (c.producto_id === undefined) fallar('Elige un producto');
  const o = await agregarPrecioNuevo(env, completarOperacion(limpiarOperacion(c)));
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
  const o = await agregarPrecioNuevo(env, completarOperacion({ ...actual, ...cambios }));
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
  const categoria = normalizar(url.searchParams.get('categoria') || '');
  const q = normalizar(url.searchParams.get('q') || '').slice(0, MAX_TEXTO);
  const filtros = [];
  const valores = [];
  if (estado === 'inventario') filtros.push('o.fecha_venta IS NULL');
  else if (estado === 'vendido') filtros.push('o.fecha_venta IS NOT NULL');
  else if (estado) fallar('estado: usa inventario o vendido');
  if (productoId) {
    const id = Number(productoId);
    if (!Number.isInteger(id) || id <= 0) fallar('producto_id inválido');
    filtros.push('o.producto_id = ?');
    valores.push(id);
  }
  if (categoria) {
    filtros.push('p.categoria = ?');
    valores.push(categoria);
  }
  for (const palabra of q ? q.split(' ').slice(0, 6) : []) {
    filtros.push(`p.busqueda LIKE ? ESCAPE '\\'`);
    valores.push(`%${paraLike(palabra)}%`);
  }
  const donde = filtros.length ? `WHERE ${filtros.join(' AND ')}` : '';

  // Totales sobre todo lo filtrado (no solo los 200 que se listan).
  const conAmbos = 'o.precio_venta IS NOT NULL AND o.precio_compra IS NOT NULL';
  const [{ results }, totales, { results: categorias }] = await Promise.all([
    env.DB.prepare(`${SELECT_OPERACION} ${donde} ORDER BY coalesce(o.fecha_venta, o.fecha_compra) DESC, o.id DESC LIMIT 200`)
      .bind(hoyMexico(), ...valores)
      .all(),
    env.DB.prepare(
      `SELECT count(*) AS registros,
         coalesce(sum(o.fecha_venta IS NOT NULL), 0) AS vendidos,
         coalesce(sum(o.fecha_venta IS NULL), 0) AS en_inventario,
         coalesce(sum(CASE WHEN o.fecha_venta IS NULL THEN o.precio_compra END), 0) AS dinero_parado,
         coalesce(sum(o.precio_venta), 0) AS ingresos,
         coalesce(sum(CASE WHEN ${conAmbos} THEN o.precio_venta - o.precio_compra - o.envio_mxn - o.otros_gastos_mxn END), 0) AS ganancia,
         sum(CASE WHEN ${conAmbos} THEN o.precio_venta END) AS ventas_con_compra,
         avg(CASE WHEN ${conAmbos} AND o.fecha_compra IS NOT NULL THEN julianday(o.fecha_venta) - julianday(o.fecha_compra) END) AS dias_promedio
       FROM operaciones o JOIN productos p ON p.id = o.producto_id ${donde}`,
    )
      .bind(...valores)
      .first(),
    env.DB.prepare(
      `SELECT DISTINCT p.categoria FROM productos p JOIN operaciones o ON o.producto_id = p.id
       WHERE p.categoria IS NOT NULL ORDER BY p.categoria`,
    ).all(),
  ]);
  const { ventas_con_compra: base, dias_promedio: diasProm, ...resto } = totales;
  return json({
    ok: true,
    operaciones: results,
    totales: {
      ...resto,
      // Margen real: ganancia ÷ precio de venta, solo de ventas con compra registrada.
      margen: base ? Math.round((totales.ganancia / base) * 1000) / 1000 : null,
      dias_promedio: diasProm == null ? null : Math.round(diasProm),
    },
    categorias: categorias.map((c) => c.categoria),
  });
}

async function borrarOperacion(env, id) {
  await borrarFotosDeOperacion(env, id);
  const { meta } = await env.DB.prepare('DELETE FROM operaciones WHERE id = ?').bind(id).run();
  if (!meta.changes) return json({ ok: false, error: 'Esa operación no existe' }, 404);
  return json({ ok: true, borrada: id });
}

// ---------- Referencias: lo que ya vendí de este artículo ----------

async function referencias(env, url) {
  const productoId = url.searchParams.get('producto_id');
  const q = normalizar(url.searchParams.get('q') || '').slice(0, MAX_TEXTO);
  // Precio nuevo típico de la Fase 2A (lo manda la app tras buscar precios). Se recuerda por
  // producto para guardarlo en cada venta como precio_nuevo_ref, sin gastar búsquedas.
  const precioNuevo = pesos(url.searchParams.get('precio_nuevo'), 'precio_nuevo') || null;

  let producto = null;
  let otros = [];
  if (productoId) {
    const id = Number(productoId);
    if (!Number.isInteger(id) || id <= 0) fallar('producto_id inválido');
    producto = await env.DB.prepare('SELECT * FROM productos WHERE id = ?').bind(id).first();
  } else if (q) {
    ({ producto, otros } = await productoParaReferencias(env, q));
  } else fallar('Indica producto_id o q');
  if (!producto) return json({ ok: true, producto: null });

  if (precioNuevo && env.CACHE) {
    await env.CACHE.put(claveNuevo(producto.id), JSON.stringify({ precio: precioNuevo, fecha: hoyMexico() }), {
      expirationTtl: NUEVO_REF_SEGUNDOS,
    });
  }

  const desde = new Date(Date.now() - DIAS_REFERENCIA * 86400000).toISOString().slice(0, 10);
  const [{ results: ventas }, { results: capturas }] = await Promise.all([
    env.DB.prepare(
      `SELECT id, precio_venta, fecha_venta, condicion, canal, precio_publicado,
         CASE WHEN precio_publicado IS NOT NULL THEN precio_publicado - precio_venta END AS descuento,
         CAST(julianday(fecha_venta) - julianday(fecha_compra) AS INTEGER) AS dias
       FROM operaciones
       WHERE producto_id = ? AND fecha_venta IS NOT NULL AND fecha_venta >= ?
       ORDER BY fecha_venta DESC, id DESC`,
    )
      .bind(producto.id, desde)
      .all(),
    env.DB.prepare(
      `SELECT id, precio, fecha, fuente, condicion, url FROM capturas_usado
       WHERE producto_id = ? AND fecha >= ? ORDER BY fecha DESC, id DESC`,
    )
      .bind(producto.id, desde)
      .all(),
  ]);

  const conDias = ventas.filter((v) => v.dias != null);
  const resumen = {
    ventas: resumir(ventas.map((v) => v.precio_venta)),
    capturas: resumir(capturas.map((c) => c.precio)),
    todo: resumir([...ventas.map((v) => v.precio_venta), ...capturas.map((c) => c.precio)]),
    dias_mediana: conDias.length ? Math.round(mediana(conDias.map((v) => v.dias))) : null,
  };

  // Precio contra rapidez: la venta más rápida y la más cara (si son distintas).
  let contraste = null;
  if (conDias.length >= 2) {
    const rapida = conDias.reduce((a, b) => (b.dias < a.dias || (b.dias === a.dias && b.precio_venta > a.precio_venta) ? b : a));
    const cara = conDias.reduce((a, b) => (b.precio_venta > a.precio_venta || (b.precio_venta === a.precio_venta && b.dias < a.dias) ? b : a));
    if (rapida.id !== cara.id && cara.dias > rapida.dias) {
      contraste = [rapida, cara].map((v) => ({ precio: v.precio_venta, dias: v.dias }));
    }
  }

  // Sin ventas de este producto: estimar con lo que suelo sacar en su categoría respecto al
  // precio nuevo. Es la única estimación permitida (ver CLAUDE.md) y siempre dice de dónde sale.
  let estimacion = null;
  if (!ventas.length && producto.categoria) {
    const { results } = await env.DB.prepare(
      `SELECT CAST(o.precio_venta AS REAL) / o.precio_nuevo_ref AS factor
       FROM operaciones o JOIN productos p ON p.id = o.producto_id
       WHERE p.categoria = ? AND o.precio_venta IS NOT NULL AND o.precio_nuevo_ref IS NOT NULL`,
    )
      .bind(producto.categoria)
      .all();
    const recordado = env.CACHE ? await env.CACHE.get(claveNuevo(producto.id), 'json') : null;
    const nuevo = precioNuevo || recordado?.precio || null;
    if (results.length) {
      const factor = mediana(results.map((r) => r.factor));
      estimacion = {
        categoria: producto.categoria,
        factor: Math.round(factor * 100) / 100,
        n: results.length,
        precio_nuevo: nuevo,
        estimado: nuevo ? Math.round((factor * nuevo) / 10) * 10 : null,
      };
    }
  }

  return json({ ok: true, producto, otros, ventas, capturas, resumen, contraste, estimacion });
}

// ---------- Capturas de precio de usado (lo que vi publicado en Marketplace, ML, etc.) ----------

async function crearCaptura(request, env) {
  const c = await leerCuerpo(request);
  const productoId = Number(c.producto_id);
  if (!Number.isInteger(productoId) || productoId <= 0) fallar('Elige un producto');
  const precio = pesos(c.precio, 'Precio');
  if (!precio) fallar('Escribe el precio que viste');
  const url = texto(c.url, 'Link', 500);
  if (url && !/^https?:\/\/\S+$/i.test(url)) fallar('Link: pega una dirección que empiece con http');
  const captura = {
    fuente: opcion(c.fuente, 'Fuente', FUENTES) || 'marketplace',
    condicion: opcion(c.condicion, 'Condición', CONDICIONES),
    fecha: fecha(c.fecha, 'Fecha') || hoyMexico(),
  };
  const existe = await env.DB.prepare('SELECT id FROM productos WHERE id = ?').bind(productoId).first();
  if (!existe) return json({ ok: false, error: 'Ese producto no existe' }, 404);
  const guardada = await env.DB.prepare(
    `INSERT INTO capturas_usado (producto_id, fuente, precio, condicion, url, fecha)
     VALUES (?, ?, ?, ?, ?, ?) RETURNING *`,
  )
    .bind(productoId, captura.fuente, precio, captura.condicion, url, captura.fecha)
    .first();
  return json({ ok: true, captura: guardada }, 201);
}

// ---------- Gastos del mes (gasolina, publicidad…): solo para la ganancia neta ----------

async function listarGastos(env, url) {
  const mes = url.searchParams.get('mes') || hoyMexico().slice(0, 7);
  if (!/^\d{4}-\d{2}$/.test(mes)) fallar('Mes inválido (AAAA-MM)');
  const { results } = await env.DB.prepare(
    "SELECT id, concepto, monto, fecha FROM gastos WHERE fecha LIKE ? || '-%' ORDER BY fecha DESC, id DESC",
  )
    .bind(mes)
    .all();
  return json({ ok: true, mes, gastos: results });
}

async function crearGasto(request, env) {
  const c = await leerCuerpo(request);
  const concepto = texto(c.concepto, 'Concepto');
  if (!concepto) fallar('Escribe en qué gastaste');
  const monto = pesos(c.monto, 'Monto');
  if (!monto) fallar('Escribe cuánto gastaste');
  const gasto = await env.DB.prepare('INSERT INTO gastos (concepto, monto, fecha) VALUES (?, ?, ?) RETURNING id, concepto, monto, fecha')
    .bind(concepto, monto, fecha(c.fecha, 'Fecha') || hoyMexico())
    .first();
  return json({ ok: true, gasto }, 201);
}

async function borrarGasto(env, id) {
  const { meta } = await env.DB.prepare('DELETE FROM gastos WHERE id = ?').bind(id).run();
  if (!meta.changes) return json({ ok: false, error: 'Ese gasto no existe' }, 404);
  return json({ ok: true, borrado: id });
}

// ---------- Valor de lo que tengo sin vender ----------
// Por artículo: el precio en que lo publicaste; si no, la última mediana de usados que salió al
// buscarlo en Google Shopping (precios_vistos). Sin ninguno de los dos, queda sin valor: no se estima.

async function valorInventario(env) {
  const { results: ops } = await env.DB.prepare(
    `SELECT o.id, o.precio_publicado, p.nombre FROM operaciones o JOIN productos p ON p.id = o.producto_id
     WHERE o.fecha_venta IS NULL AND o.fecha_descartado IS NULL`,
  ).all();
  const consultas = [...new Set(ops.filter((o) => !o.precio_publicado).map((o) => normalizar(o.nombre)))];
  const vistos = new Map();
  // De a 50 para no pasar el límite de parámetros de D1.
  for (let i = 0; i < consultas.length; i += 50) {
    const grupo = consultas.slice(i, i + 50);
    const { results } = await env.DB.prepare(
      `SELECT consulta, fecha, usado FROM precios_vistos
       WHERE usado IS NOT NULL AND consulta IN (${grupo.map(() => '?').join(',')})
       ORDER BY fecha DESC`,
    )
      .bind(...grupo)
      .all();
    for (const r of results) if (!vistos.has(r.consulta)) vistos.set(r.consulta, r);
  }
  const articulos = ops.map((o) => {
    if (o.precio_publicado) return { id: o.id, precio: o.precio_publicado, fuente: 'publicado', fecha: null };
    const v = vistos.get(normalizar(o.nombre));
    return v ? { id: o.id, precio: v.usado, fuente: 'google', fecha: v.fecha } : { id: o.id, precio: null, fuente: null, fecha: null };
  });
  return json({ ok: true, articulos });
}

// Si una venta no trae precio nuevo de referencia, usa el último recordado para ese producto.
async function agregarPrecioNuevo(env, o) {
  if (o.precio_venta == null || o.precio_nuevo_ref != null || !env.CACHE) return o;
  const recordado = await env.CACHE.get(claveNuevo(o.producto_id), 'json');
  return recordado?.precio ? { ...o, precio_nuevo_ref: recordado.precio } : o;
}

// ---------- Respaldo: exportar e importar CSV ----------

const COLUMNAS_CSV = [
  'producto', 'categoria', 'marca', 'modelo', 'variante', 'codigo_barras', 'condicion',
  'precio_compra', 'fecha_compra', 'lugar_compra', 'precio_publicado', 'fecha_publicado',
  'precio_venta', 'fecha_venta', 'canal', 'envio_mxn', 'otros_gastos_mxn', 'precio_nuevo_ref', 'notas',
  'fecha_descartado',
];
const MAX_CSV_BYTES = 1024 * 1024;
const MAX_FILAS_CSV = 2000;

async function exportar(env) {
  const { results } = await env.DB.prepare(
    `SELECT o.*, p.nombre AS producto, p.categoria, p.marca, p.modelo, p.variante, p.codigo_barras
     FROM operaciones o JOIN productos p ON p.id = o.producto_id
     ORDER BY coalesce(o.fecha_venta, o.fecha_compra), o.id`,
  ).all();
  const csv = escribirCsv(COLUMNAS_CSV, results.map((o) => COLUMNAS_CSV.map((c) => o[c])));
  return new Response(csv, {
    headers: {
      'content-type': 'text/csv; charset=utf-8',
      'content-disposition': `attachment; filename="revende-historial-${hoyMexico()}.csv"`,
      'cache-control': 'no-store',
    },
  });
}

// Nombres de columna aceptados (sin importar mayúsculas, acentos ni guiones bajos).
const ALIAS_CSV = {
  producto: ['producto', 'nombre', 'articulo'],
  categoria: ['categoria'],
  marca: ['marca'],
  modelo: ['modelo'],
  variante: ['variante'],
  codigo_barras: ['codigo barras', 'codigo', 'codigo de barras'],
  condicion: ['condicion'],
  precio_compra: ['precio compra', 'compra', 'precio de compra'],
  fecha_compra: ['fecha compra', 'fecha de compra'],
  lugar_compra: ['lugar compra', 'lugar', 'lugar de compra'],
  precio_publicado: ['precio publicado'],
  fecha_publicado: ['fecha publicado', 'fecha de publicacion'],
  precio_venta: ['precio venta', 'venta', 'precio de venta', 'precio'],
  fecha_venta: ['fecha venta', 'fecha de venta', 'fecha'],
  canal: ['canal', 'donde', 'donde se vendio'],
  envio_mxn: ['envio mxn', 'envio'],
  otros_gastos_mxn: ['otros gastos mxn', 'otros gastos', 'otros'],
  precio_nuevo_ref: ['precio nuevo ref', 'precio nuevo'],
  notas: ['notas', 'nota'],
  fecha_descartado: ['fecha descartado', 'fecha de descarte', 'descartado'],
};
const nombreColumna = (t) => normalizar(t).replace(/_/g, ' ').replace(/\s+/g, ' ');

// "como nuevo" -> "como_nuevo"; "16/10/2026" -> "2026-10-16".
const comoOpcion = (v) => normalizar(v).replace(/\s+/g, '_') || null;
function comoFecha(v) {
  const t = String(v ?? '').trim();
  const dmy = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(t);
  return dmy ? `${dmy[3]}-${dmy[2].padStart(2, '0')}-${dmy[1].padStart(2, '0')}` : t;
}
const firma = (o) => [o.producto_id, o.precio_compra, o.fecha_compra, o.precio_venta, o.fecha_venta].join('|');
// Una fila que solo trae la venta es la misma venta aunque en la base tenga compra registrada.
const firmaVenta = (o) => [o.producto_id, o.precio_venta, o.fecha_venta].join('|');

async function importar(request, env, url) {
  // Primero se prueba sin guardar (?probar=1) para mostrar qué pasaría; luego se confirma.
  const probar = url.searchParams.get('probar') === '1';
  const contenido = await request.text();
  if (contenido.length > MAX_CSV_BYTES) fallar('El archivo es demasiado grande (máximo 1 MB)');
  const filas = leerCsv(contenido);
  if (filas.length < 2) fallar('El archivo no tiene filas de datos');
  if (filas.length - 1 > MAX_FILAS_CSV) fallar(`Máximo ${MAX_FILAS_CSV} filas por archivo`);

  const indices = {};
  filas[0].forEach((encabezado, i) => {
    const n = nombreColumna(encabezado);
    for (const [campo, alias] of Object.entries(ALIAS_CSV)) {
      if (indices[campo] === undefined && (n === nombreColumna(campo) || alias.includes(n))) indices[campo] = i;
    }
  });
  if (indices.producto === undefined) fallar('Falta la columna "producto"');
  if (indices.precio_venta === undefined && indices.precio_compra === undefined) {
    fallar('Falta la columna "precio_venta" o "precio_compra"');
  }

  const [{ results: productos }, { results: existentes }] = await Promise.all([
    env.DB.prepare('SELECT id, nombre, codigo_barras FROM productos').all(),
    env.DB.prepare('SELECT producto_id, precio_compra, fecha_compra, precio_venta, fecha_venta FROM operaciones').all(),
  ]);
  const porCodigo = new Map(productos.filter((p) => p.codigo_barras).map((p) => [p.codigo_barras, p.id]));
  const porNombre = new Map(productos.map((p) => [normalizar(p.nombre), p.id]));
  const vistas = new Set(existentes.map(firma));
  const ventasVistas = new Set(existentes.filter((o) => o.fecha_venta).map(firmaVenta));
  const nuevos = new Map(); // nombre normalizado -> datos del producto a crear
  const listas = [];
  const errores = [];
  let repetidos = 0;

  filas.slice(1).forEach((fila, i) => {
    const linea = i + 2;
    const v = (campo) => (indices[campo] === undefined ? undefined : fila[indices[campo]]?.trim() ?? '');
    try {
      const nombre = texto(v('producto'), 'Producto');
      if (!nombre) fallar('falta el producto');
      const crudo = {};
      for (const campo of COLUMNAS_CSV.slice(6)) {
        const valor = v(campo);
        if (valor === undefined || valor === '') continue;
        crudo[campo] = campo.startsWith('fecha') ? comoFecha(valor) : campo === 'condicion' || campo === 'canal' ? comoOpcion(valor) : valor;
      }
      // En un archivo, la fecha es obligatoria: "hoy" no tiene sentido para ventas pasadas.
      if (crudo.precio_venta && !crudo.fecha_venta) fallar('falta la fecha de venta');
      if (crudo.precio_compra && !crudo.fecha_compra) fallar('falta la fecha de compra');
      const o = completarOperacion(limpiarOperacion(crudo));

      const codigo = texto(v('codigo_barras'), 'Código de barras', 40)?.replace(/\s/g, '') || null;
      const clave = normalizar(nombre);
      let productoId = (codigo && porCodigo.get(codigo)) || porNombre.get(clave);
      if (!productoId) {
        if (!nuevos.has(clave)) {
          const categoria = v('categoria') ? normalizar(texto(v('categoria'), 'Categoría')) || null : null;
          nuevos.set(clave, {
            nombre,
            categoria,
            marca: texto(v('marca'), 'Marca'),
            modelo: texto(v('modelo'), 'Modelo'),
            variante: texto(v('variante'), 'Variante'),
            codigo_barras: codigo && !porCodigo.has(codigo) ? codigo : null,
          });
        }
        productoId = `nuevo:${clave}`;
      }
      o.producto_id = productoId;
      const f = firma(o);
      const soloVenta = o.precio_compra == null && o.precio_venta != null;
      if (vistas.has(f) || (soloVenta && ventasVistas.has(firmaVenta(o)))) {
        repetidos++;
        return;
      }
      vistas.add(f);
      if (o.precio_venta != null) ventasVistas.add(firmaVenta(o));
      listas.push(o);
    } catch (e) {
      if (!(e instanceof ErrorDatos)) throw e;
      errores.push({ linea, error: e.message });
    }
  });

  const resumen = {
    registros: listas.length,
    productos_nuevos: nuevos.size,
    repetidos,
    errores: errores.slice(0, 20),
    con_error: errores.length,
  };
  if (probar || !listas.length) return json({ ok: true, probado: true, ...resumen });

  // Crear productos nuevos y luego las operaciones, en lotes.
  const idsNuevos = new Map();
  const listaNuevos = [...nuevos.entries()];
  for (let i = 0; i < listaNuevos.length; i += 50) {
    const lote = listaNuevos.slice(i, i + 50);
    const respuestas = await env.DB.batch(
      lote.map(([, p]) =>
        env.DB.prepare(
          `INSERT INTO productos (nombre, categoria, marca, modelo, variante, codigo_barras, busqueda)
           VALUES (?, ?, ?, ?, ?, ?, ?) RETURNING id`,
        ).bind(p.nombre, p.categoria, p.marca, p.modelo, p.variante, p.codigo_barras, textoBusqueda(p)),
      ),
    );
    lote.forEach(([clave], j) => idsNuevos.set(`nuevo:${clave}`, respuestas[j].results[0].id));
  }
  for (let i = 0; i < listas.length; i += 50) {
    await env.DB.batch(
      listas.slice(i, i + 50).map((o) => {
        const fila = { ...o, producto_id: idsNuevos.get(o.producto_id) ?? o.producto_id };
        const campos = CAMPOS_OPERACION.filter((k) => fila[k] !== undefined);
        return env.DB.prepare(
          `INSERT INTO operaciones (${campos.join(', ')}) VALUES (${campos.map(() => '?').join(', ')})`,
        ).bind(...campos.map((k) => fila[k]));
      }),
    );
  }
  return json({ ok: true, importado: true, ...resumen });
}

// ---------- Enrutador ----------

export async function historial(request, env, url) {
  const sinPermiso = await verificarHistorial(request, env);
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
    if (ruta === '/api/referencias' && metodo === 'GET') return await referencias(env, url);
    if (ruta === '/api/capturas' && metodo === 'POST') return await crearCaptura(request, env);
    if (ruta === '/api/valor-inventario' && metodo === 'GET') return await valorInventario(env);
    if (ruta === '/api/gastos') {
      if (metodo === 'GET') return await listarGastos(env, url);
      if (metodo === 'POST') return await crearGasto(request, env);
    }
    const unGasto = /^\/api\/gastos\/(\d+)$/.exec(ruta);
    if (unGasto && metodo === 'DELETE') return await borrarGasto(env, Number(unGasto[1]));
    if (ruta === '/api/exportar' && metodo === 'GET') return await exportar(env);
    if (ruta === '/api/importar' && metodo === 'POST') return await importar(request, env, url);
    const unaOperacion = /^\/api\/operaciones\/(\d+)$/.exec(ruta);
    if (unaOperacion) {
      const id = Number(unaOperacion[1]);
      if (metodo === 'GET') {
        const operacion = await leerOperacion(env, id);
        return operacion ? json({ ok: true, operacion }) : json({ ok: false, error: 'Esa operación no existe' }, 404);
      }
      if (metodo === 'PATCH') return await actualizarOperacion(request, env, id);
      if (metodo === 'DELETE') return await borrarOperacion(env, id);
    }
    const fotosDe = /^\/api\/operaciones\/(\d+)\/fotos$/.exec(ruta);
    if (fotosDe) {
      const id = Number(fotosDe[1]);
      if (metodo === 'GET') return await listarFotos(env, id);
      if (metodo === 'POST') return await subirFoto(request, env, id);
    }
    const ordenDe = /^\/api\/operaciones\/(\d+)\/fotos\/orden$/.exec(ruta);
    if (ordenDe && metodo === 'POST') return await ordenarFotos(request, env, Number(ordenDe[1]));
    const unaFoto = /^\/api\/fotos\/(\d+)$/.exec(ruta);
    if (unaFoto) {
      const id = Number(unaFoto[1]);
      if (metodo === 'GET') return await servirFoto(env, id);
      if (metodo === 'DELETE') return await borrarFoto(env, id);
    }
    const portada = /^\/api\/fotos\/(\d+)\/portada$/.exec(ruta);
    if (portada && metodo === 'POST') return await hacerPortada(env, Number(portada[1]));
    return json({ ok: false, error: 'Ruta o método no válido' }, 404);
  } catch (e) {
    if (e instanceof ErrorDatos) return json({ ok: false, error: e.message }, 400);
    // Reglas de la base (CHECK, UNIQUE, FOREIGN KEY): mensaje claro en vez del error crudo.
    if (/constraint/i.test(String(e))) return json({ ok: false, error: 'Datos no válidos para guardar', detalle: String(e).slice(0, 200) }, 400);
    throw e;
  }
}
