// Revende 2.0, Fase V3: catálogo de Mercado Libre (nombre oficial, marca, modelo, año y precios de
// nuevo cuando hay) y código de barras → nombre (UPCitemdb). Ninguna de las dos gasta SerpApi.
// Mercado Libre: solo el catálogo funciona con token de app; la búsqueda de publicaciones da 403.
import { json, normalizar } from './util.js';

const ML = 'https://api.mercadolibre.com';
const CACHE_SEGUNDOS = 24 * 60 * 60;
const CODIGO_SEGUNDOS = 30 * 24 * 60 * 60;
const VERSION = 'v4';

// El catálogo mezcla accesorios con el producto; se quitan salvo que se hayan buscado.
const ACCESORIOS = ['funda', 'fundas', 'cargador', 'soporte', 'cable', 'estuche', 'mica', 'protector', 'skin', 'case', 'adaptador', 'repuesto', 'refaccion', 'calcomania', 'sticker', 'correa', 'lector', 'organizador', 'revista'];

async function tokenMercadoLibre(env) {
  const guardado = await env.CACHE?.get('ml-token');
  if (guardado) return guardado;
  const r = await fetch(`${ML}/oauth/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded', Accept: 'application/json' },
    body: new URLSearchParams({ grant_type: 'client_credentials', client_id: env.ML_CLIENT_ID, client_secret: env.ML_CLIENT_SECRET }),
  });
  const t = await r.json().catch(() => ({}));
  if (!t.access_token) throw new Error(`Mercado Libre no dio token (${r.status})`);
  // Dura 6 h; se guarda un poco menos para no usarlo vencido.
  await env.CACHE?.put('ml-token', t.access_token, { expirationTtl: Math.max(300, (t.expires_in || 21600) - 600) });
  return t.access_token;
}

async function ml(env, ruta) {
  const token = await tokenMercadoLibre(env);
  const r = await fetch(`${ML}${ruta}`, { headers: { Authorization: `Bearer ${token}` } });
  if (!r.ok) return null;
  return r.json().catch(() => null);
}

const atributo = (p, id) => (p?.attributes || []).find((a) => a.id === id)?.value_name || null;

function aProducto(detalle) {
  const anio = Number(atributo(detalle, 'RELEASE_YEAR'));
  return {
    id: detalle.id,
    nombre: detalle.name,
    marca: atributo(detalle, 'BRAND'),
    modelo: atributo(detalle, 'MODEL'),
    linea: atributo(detalle, 'LINE'),
    color: atributo(detalle, 'COLOR'),
    lanzamiento: Number.isInteger(anio) && anio > 1950 && anio <= new Date().getFullYear() + 1 ? anio : null,
    imagen: detalle.pictures?.[0]?.url?.replace(/^http:/, 'https:') || null,
    link: detalle.permalink || `https://www.mercadolibre.com.mx/p/${detalle.id}`,
  };
}

// Precios de nuevo de las publicaciones ligadas al producto del catálogo (cuando hay).
async function preciosDelCatalogo(env, producto) {
  const items = await ml(env, `/products/${producto.id}/items?limit=20`);
  const precios = (items?.results || [])
    .filter((i) => i.price > 0 && i.currency_id === 'MXN')
    .map((i) => ({ precio: Math.round(i.price), condicion: i.condition === 'used' ? 'Usado' : 'Nuevo', usado: i.condition === 'used' }))
    .sort((a, b) => a.precio - b.precio);
  if (!precios.length) return null;
  return { fuente: 'Mercado Libre', link: producto.link, total: precios.length, precios };
}

// GET /api/catalogo?q=nombre o modelo  |  ?codigo=EAN/UPC
export async function catalogo(env, url) {
  if (!env.ML_CLIENT_ID || !env.ML_CLIENT_SECRET) {
    return json({ ok: false, error: 'Falta configurar ML_CLIENT_ID y ML_CLIENT_SECRET en Cloudflare' }, 500);
  }
  const q = (url.searchParams.get('q') || '').trim().slice(0, 120);
  const codigo = (url.searchParams.get('codigo') || '').replace(/\D/g, '').slice(0, 14);
  if (!codigo && q.length < 2) return json({ ok: false, error: 'Escribe el artículo o manda el código' }, 400);

  const clave = `catalogo:${VERSION}:${codigo ? `c${codigo}` : normalizar(q)}`;
  const guardado = await env.CACHE?.get(clave, 'json');
  if (guardado) return json({ ...guardado, cache: true });

  // Sin categoría, "iPhone 13" trae fundas y "PlayStation 5" trae juegos. Mercado Libre adivina la
  // categoría del texto (domain_discovery) y se busca solo dentro de ella; si no hay nada, sin filtro.
  let dominio = null;
  if (!codigo) {
    const d = await ml(env, `/sites/MLM/domain_discovery/search?limit=1&q=${encodeURIComponent(q)}`);
    if (Array.isArray(d) && d[0]?.domain_id) dominio = { id: d[0].domain_id, nombre: d[0].domain_name || null };
  }
  const busqueda = codigo ? `product_identifier=${codigo}` : `q=${encodeURIComponent(q)}`;
  let lista = dominio ? await ml(env, `/products/search?status=active&site_id=MLM&limit=20&${busqueda}&domain_id=${dominio.id}`) : null;
  if (!lista?.results?.length) lista = await ml(env, `/products/search?status=active&site_id=MLM&limit=20&${busqueda}`);
  const consulta = normalizar(q);
  const palabras = consulta.split(' ').filter((p) => p.length > 1);
  // El orden del catálogo no es bueno: primero los que traen más palabras buscadas y luego los
  // nombres más cortos (los largos suelen ser paquetes o accesorios).
  const puntaje = (nombre) => {
    const n = normalizar(nombre);
    return palabras.filter((p) => n.includes(p)).length;
  };
  const candidatos = (lista?.results || [])
    .filter((p) => codigo || !ACCESORIOS.some((a) => normalizar(p.name).split(/\W+/).includes(a) && !consulta.includes(a)))
    .map((p, i) => ({ p, puntos: codigo ? 0 : puntaje(p.name), i }))
    .sort((a, b) => b.puntos - a.puntos || a.p.name.length - b.p.name.length || a.i - b.i)
    .slice(0, 4)
    .map((x) => x.p);
  const detalles = (await Promise.all(candidatos.map((p) => ml(env, `/products/${p.id}`)))).filter(Boolean);
  // `completo`: el nombre trae todas las palabras buscadas (o vino por código). Solo así la app
  // confía en su marca y año.
  const productos = detalles.map((d) => ({ ...aProducto(d), completo: Boolean(codigo) || puntaje(d.name) === palabras.length }));
  const precios = productos[0] ? await preciosDelCatalogo(env, productos[0]) : null;

  // Categoría en palabras ("consolas de videojuegos"), para sugerirla al registrar la compra.
  const categoria = dominio?.nombre ? normalizar(dominio.nombre) : null;
  const respuesta = { ok: true, productos, precios, categoria, fecha: new Date().toISOString() };
  if (productos.length) await env.CACHE?.put(clave, JSON.stringify(respuesta), { expirationTtl: CACHE_SEGUNDOS });
  return json({ ...respuesta, cache: false });
}

// GET /api/codigo?c=EAN/UPC → nombre y marca. Primero el catálogo de Mercado Libre (productos de
// México); si no, UPCitemdb (gratis, 100 consultas al día sin registro).
export async function codigoDeBarras(env, url) {
  const c = (url.searchParams.get('c') || '').replace(/\D/g, '');
  if (c.length < 8 || c.length > 14) return json({ ok: false, error: 'El código debe tener entre 8 y 14 dígitos' }, 400);

  const clave = `codigo:${VERSION}:${c}`;
  const guardado = await env.CACHE?.get(clave, 'json');
  if (guardado) return json({ ...guardado, cache: true });

  let respuesta = null;
  if (env.ML_CLIENT_ID && env.ML_CLIENT_SECRET) {
    const lista = await ml(env, `/products/search?status=active&site_id=MLM&product_identifier=${c}`).catch(() => null);
    const p = lista?.results?.[0];
    if (p) {
      const detalle = await ml(env, `/products/${p.id}`);
      if (detalle) {
        const prod = aProducto(detalle);
        respuesta = { ok: true, codigo: c, nombre: prod.nombre, marca: prod.marca, fuente: 'Mercado Libre' };
      }
    }
  }
  if (!respuesta) {
    const r = await fetch(`https://api.upcitemdb.com/prod/trial/lookup?upc=${c}`, { headers: { Accept: 'application/json' } });
    if (r.status === 429) return json({ ok: false, error: 'Se acabaron las consultas de códigos de hoy. Escribe el nombre.' }, 429);
    const d = await r.json().catch(() => ({}));
    const item = d.items?.[0];
    if (item?.title) respuesta = { ok: true, codigo: c, nombre: item.title, marca: item.brand || null, fuente: 'UPCitemdb' };
  }
  if (!respuesta) return json({ ok: false, vacio: true, error: 'No encontramos ese código. Escribe el nombre o toma una foto.' }, 404);
  await env.CACHE?.put(clave, JSON.stringify(respuesta), { expirationTtl: CODIGO_SEGUNDOS });
  return json({ ...respuesta, cache: false });
}
