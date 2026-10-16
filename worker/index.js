// Worker de Revende: sirve la app (archivos de ./out) y las rutas /api.
import { DurableObject } from 'cloudflare:workers';
import { json, normalizar } from './util.js';
import { historial, esRutaHistorial } from './historial.js';
const MODELO_DEFECTO = 'gemini-3-flash-preview';

const instrucciones = (consulta) => `Eres un asistente para una persona que compra y revende articulos en Mexico.
Articulo: "${consulta}"

Busca en Google precios ACTUALES en Mexico, en pesos mexicanos (MXN), de este articulo exacto
(misma variante: almacenamiento, generacion, version). Incluye tiendas de nuevo (Mercado Libre,
Amazon MX, Walmart, Liverpool, Coppel, Sams, etc.) y de usado o reacondicionado (Mercado Libre usado,
tiendas de seminuevos). Si el texto es un codigo de barras, primero identifica el producto.

Responde SOLO con un objeto JSON, sin texto antes ni despues, con esta forma:
{
  "producto": "nombre exacto del articulo identificado",
  "nuevo": [{ "tienda": "", "precio_mxn": 0, "url": "" }],
  "usado": [{ "fuente": "", "precio_mxn": 0, "condicion": "usado|reacondicionado", "url": "" }],
  "rango_nuevo_mxn": { "min": 0, "max": 0 },
  "rango_usado_mxn": { "min": 0, "max": 0 },
  "demanda": "alta|media|baja",
  "demanda_razon": "una frase",
  "revisar_al_comprar": ["puntos concretos para revisar este articulo usado"],
  "notas": "advertencias breves, por ejemplo si hay variantes que cambian mucho el precio"
}

Reglas:
- Solo precios que encontraste en la busqueda; nunca inventes ni estimes un precio.
- Cada precio con la URL de donde salio. Si no tienes la URL, no incluyas ese precio.
- Si no encuentras precios de usado, deja "usado" como lista vacia y el rango en 0.
- Maximo 6 precios de nuevo y 6 de usado. Ignora accesorios, fundas y productos distintos.`;


async function llamarGemini(env, cuerpo) {
  const modelo = env.GEMINI_MODELO || MODELO_DEFECTO;
  return fetch(`https://generativelanguage.googleapis.com/v1beta/models/${modelo}:generateContent`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-goog-api-key': env.GEMINI_API_KEY },
    body: JSON.stringify(cuerpo),
  });
}

function leerJSON(texto) {
  const limpio = texto.replace(/```json|```/g, '').trim();
  const inicio = limpio.indexOf('{');
  const fin = limpio.lastIndexOf('}');
  if (inicio === -1 || fin === -1) return null;
  try {
    return JSON.parse(limpio.slice(inicio, fin + 1));
  } catch {
    return null;
  }
}

async function analizar(request, env) {
  if (request.method !== 'POST') return json({ ok: false, error: 'Usa POST' }, 405);
  if (!env.GEMINI_API_KEY) return json({ ok: false, error: 'Falta GEMINI_API_KEY en Cloudflare' }, 500);
  const sinPermiso = verificarOrigen(request);
  if (sinPermiso) return sinPermiso;

  let consulta = '';
  try {
    consulta = String((await request.json()).consulta || '').trim();
  } catch {}
  if (consulta.length < 2 || consulta.length > 200) {
    return json({ ok: false, error: 'Escribe el articulo (entre 2 y 200 caracteres)' }, 400);
  }

  const base = {
    contents: [{ role: 'user', parts: [{ text: instrucciones(consulta) }] }],
    tools: [{ google_search: {} }],
  };

  // Primero pide JSON directo; si el modelo no lo acepta junto con la busqueda, reintenta sin eso.
  let r = await llamarGemini(env, { ...base, generationConfig: { responseMimeType: 'application/json' } });
  if (r.status === 400) r = await llamarGemini(env, base);
  if (!r.ok) {
    const detalle = (await r.text()).slice(0, 400);
    return json({ ok: false, error: `Gemini respondio ${r.status}`, detalle }, 502);
  }

  const datos = await r.json();
  const candidato = datos.candidates?.[0];
  const texto = (candidato?.content?.parts || [])
    .filter((p) => p.text && !p.thought)
    .map((p) => p.text)
    .join('');
  const resultado = leerJSON(texto);
  const fuentes = (candidato?.groundingMetadata?.groundingChunks || [])
    .map((c) => c.web)
    .filter(Boolean)
    .map((w) => ({ titulo: w.title || '', url: w.uri || '' }));

  if (!resultado) {
    return json({ ok: false, error: 'No se pudo leer la respuesta de Gemini', texto: texto.slice(0, 800), fuentes }, 502);
  }
  return json({ ok: true, consulta, modelo: env.GEMINI_MODELO || MODELO_DEFECTO, resultado, fuentes });
}

// ---------- /api/precios: precios de nuevo con SerpApi (Google Shopping, Mexico) ----------

const CACHE_SEGUNDOS = 24 * 60 * 60;
const VERSION_CACHE = 'precios2'; // cambia si cambia la forma de la respuesta
const UMBRAL_BAJO = 0.35; // menos del 35 % de la mediana: casi seguro accesorio o producto distinto
const UMBRAL_ALTO = 2; // mas del doble de la mediana: paquete, edicion especial u otro producto
const PALABRAS_ACCESORIO = [
  'funda', 'case', 'carcasa', 'mica', 'protector', 'skin', 'sticker', 'calcomania', 'vinil',
  'cargador', 'cable', 'base de carga', 'soporte', 'estuche', 'repuesto', 'refaccion', 'adaptador',
];
const PALABRAS_PAQUETE = [
  'bundle', 'paquete', 'pack', 'combo', 'kit', 'aniversario', 'edicion limitada', 'limited edition',
  'mas', 'incluye', 'incluido', 'juego', 'juegos',
];

function mediana(numeros) {
  const orden = [...numeros].sort((a, b) => a - b);
  const mitad = Math.floor(orden.length / 2);
  return orden.length % 2 ? orden[mitad] : Math.round((orden[mitad - 1] + orden[mitad]) / 2);
}

// Sin clave de acceso (decisión de Pablo): solo se aceptan llamadas hechas desde la propia app.
// Frena bots y usos casuales que gastarían la cuota; no detiene a alguien que falsifique encabezados.
function verificarOrigen(request) {
  const propio = new URL(request.url).origin;
  if (request.headers.get('origin') === propio || request.headers.get('sec-fetch-site') === 'same-origin') return null;
  return json({ ok: false, error: 'Esta función solo se puede usar desde la app.' }, 403);
}

// Convierte un resultado de SerpApi en oferta; null solo si no se puede mostrar (sin precio, tienda o link).
function aOferta(r) {
  const precio = typeof r.extracted_price === 'number' ? Math.round(r.extracted_price) : null;
  const link = r.link || r.product_link || '';
  const tienda = (r.source || '').trim();
  if (!precio || precio <= 0 || !link || !tienda || !r.title) return null;
  const condicion = normalizar(r.second_hand_condition || '');
  return {
    titulo: r.title.trim(),
    tienda,
    precio,
    link,
    usado: Boolean(condicion),
    condicion: condicion.includes('reacond') || condicion.includes('renov') ? 'Reacondicionado' : condicion ? 'Usado' : 'Nuevo',
  };
}

// Marca (no quita) lo que parece accesorio, paquete o precio fuera de lo normal.
function marcarAtipicos(ofertas, consulta) {
  const consultaNorm = normalizar(consulta);
  const sinBuscar = (lista) => lista.filter((p) => !consultaNorm.includes(p));
  const accesorios = sinBuscar(PALABRAS_ACCESORIO);
  const paquetes = sinBuscar(PALABRAS_PAQUETE);
  const tiene = (t, lista) => lista.some((p) => t.includes(` ${p} `) || t.includes(` ${p}s `) || t.includes(` ${p}es `));

  for (const o of ofertas) {
    const t = ` ${normalizar(o.titulo).replace(/[^a-z0-9+]+/g, ' ')} `;
    if (tiene(t, accesorios)) o.aviso = 'Parece accesorio';
    // Un "+" en el titulo casi siempre es paquete ("PS5 + juego"), salvo que se haya buscado asi.
    else if (tiene(t, paquetes) || (!consultaNorm.includes('+') && t.includes('+'))) o.aviso = 'Parece paquete';
  }
  const normales = ofertas.filter((o) => !o.aviso);
  if (normales.length >= 3) {
    const m = mediana(normales.map((o) => o.precio));
    for (const o of normales) {
      if (o.precio < m * UMBRAL_BAJO) o.aviso = 'Precio muy bajo';
      else if (o.precio > m * UMBRAL_ALTO) o.aviso = 'Precio muy alto';
    }
  }
  return ofertas;
}

// Lista ordenada (normales primero, luego las marcadas) y rango calculado sin las marcadas.
function resumir(ofertas) {
  const porPrecio = (a, b) => a.precio - b.precio;
  const normales = ofertas.filter((o) => !o.aviso).sort(porPrecio);
  const marcadas = ofertas.filter((o) => o.aviso).sort(porPrecio);
  const precios = normales.map((o) => o.precio);
  return {
    rango: precios.length ? { min: precios[0], mediana: mediana(precios), max: precios[precios.length - 1] } : null,
    ofertas: [...normales, ...marcadas],
  };
}

// Respuesta de error clara si SerpApi fallo; null si se puede seguir ("sin resultados" no es error).
function errorDeSerpApi(status, datos) {
  const errorSerp = String(datos.error || '');
  if (status === 401 || /invalid api key/i.test(errorSerp)) {
    return json({ ok: false, error: 'La llave de SerpApi no es válida' }, 502);
  }
  if (status === 429 || /run out of searches|limit/i.test(errorSerp)) {
    return json({ ok: false, error: 'Se acabaron las búsquedas de este mes (o de esta hora). Intenta más tarde.' }, 429);
  }
  if (errorSerp && !/hasn't returned any results/i.test(errorSerp)) {
    return json({ ok: false, error: 'El servicio de búsqueda falló. Intenta de nuevo.', detalle: errorSerp.slice(0, 200) }, 502);
  }
  if (status >= 400 && !errorSerp) {
    return json({ ok: false, error: `El servicio de búsqueda respondió ${status}` }, 502);
  }
  return null;
}

async function buscarSerpApi(consulta, env) {
  const params = new URLSearchParams({
    engine: 'google_shopping',
    q: consulta,
    gl: 'mx',
    hl: 'es',
    google_domain: 'google.com.mx',
    api_key: env.SERPAPI_KEY,
  });
  const r = await fetch(`https://serpapi.com/search.json?${params}`);
  let datos = {};
  try {
    datos = await r.json();
  } catch {}
  return { status: r.status, datos };
}

async function precios(request, env) {
  if (request.method !== 'POST') return json({ ok: false, error: 'Usa POST' }, 405);
  const sinPermiso = verificarOrigen(request);
  if (sinPermiso) return sinPermiso;
  if (!env.SERPAPI_KEY) return json({ ok: false, error: 'Falta configurar la llave de SerpApi en Cloudflare' }, 500);

  let consulta = '';
  try {
    consulta = String((await request.json()).consulta || '').replace(/\s+/g, ' ').trim();
  } catch {}
  if (consulta.length < 2 || consulta.length > 120) {
    return json({ ok: false, error: 'Escribe el artículo (entre 2 y 120 caracteres)' }, 400);
  }

  const claveCache = `${VERSION_CACHE}:${normalizar(consulta)}`;
  if (env.CACHE) {
    const guardado = await env.CACHE.get(claveCache, 'json');
    if (guardado) return json({ ...guardado, cache: true });
  }

  const { status, datos } = await buscarSerpApi(consulta, env);
  const fallo = errorDeSerpApi(status, datos);
  if (fallo) return fallo;

  const crudos = [...(datos.shopping_results || []), ...(datos.inline_shopping_results || [])];
  // Solo se quitan repetidos exactos (mismo resultado en dos bloques de Google).
  const vistos = new Set();
  const ofertas = crudos.map(aOferta).filter((o) => {
    if (!o) return false;
    const clave = `${o.tienda}|${o.precio}|${o.titulo}`;
    if (vistos.has(clave)) return false;
    vistos.add(clave);
    return true;
  });

  if (!ofertas.length) {
    // No se cachea: puede ser un error de escritura y el usuario lo corregira.
    return json({ ok: false, vacio: true, error: 'No se encontraron precios para ese artículo. Prueba con otro nombre o modelo.' }, 404);
  }

  const nuevos = resumir(marcarAtipicos(ofertas.filter((o) => !o.usado), consulta));
  const usados = resumir(marcarAtipicos(ofertas.filter((o) => o.usado), consulta));

  // Nombre del producto: el titulo que contiene mas palabras de la consulta; si empatan, el mas corto.
  const palabrasConsulta = normalizar(consulta).split(' ');
  const parecido = (o) => {
    const t = normalizar(o.titulo);
    return palabrasConsulta.filter((p) => t.includes(p)).length;
  };
  const candidatas = ofertas.filter((o) => !o.aviso);
  const representativa = (candidatas.length ? candidatas : ofertas).reduce((a, b) => {
    const diferencia = parecido(b) - parecido(a);
    return diferencia > 0 || (diferencia === 0 && b.titulo.length < a.titulo.length) ? b : a;
  });

  const respuesta = {
    ok: true,
    consulta,
    producto: representativa.titulo,
    nuevos,
    usados,
    tiendas: new Set(ofertas.map((o) => o.tienda)).size,
    total: ofertas.length,
    fecha: new Date().toISOString(),
  };
  if (env.CACHE) await env.CACHE.put(claveCache, JSON.stringify(respuesta), { expirationTtl: CACHE_SEGUNDOS });
  return json({ ...respuesta, cache: false });
}

// ---------- /api/identificar: nombre del articulo a partir de una foto (SerpApi + Google Lens) ----------

const IMAGEN_SEGUNDOS = 10 * 60; // la foto vive maximo 10 minutos y se borra al terminar
const IMAGEN_MAX_BYTES = 1.5 * 1024 * 1024; // el celular la manda reducida (~100-300 KB)
const TIPOS_IMAGEN = ['image/jpeg', 'image/png', 'image/webp'];
const ID_IMAGEN = /^([a-f0-9]{32})\.jpg$/;

// Foto temporal en un Durable Object: a diferencia de KV, lo escrito se lee igual desde cualquier
// region al instante (Google descarga la foto desde EE. UU.). Se borra sola a los 10 minutos.
export class FotoTemporal extends DurableObject {
  async guardar(bytes, tipo) {
    await this.ctx.storage.put('foto', { bytes, tipo });
    await this.ctx.storage.setAlarm(Date.now() + IMAGEN_SEGUNDOS * 1000);
  }
  // Lo llama la ruta pública cuando Google descarga la foto; registra quién la pidió (diagnóstico).
  async leer(quien) {
    const foto = (await this.ctx.storage.get('foto')) || null;
    const lecturas = (await this.ctx.storage.get('lecturas')) || [];
    if (lecturas.length < 5) await this.ctx.storage.put('lecturas', [...lecturas, { quien, encontrada: Boolean(foto) }]);
    return foto;
  }
  async lecturas() {
    return (await this.ctx.storage.get('lecturas')) || [];
  }
  async borrar() {
    await this.ctx.storage.deleteAlarm();
    await this.ctx.storage.deleteAll();
  }
  async alarm() {
    await this.ctx.storage.deleteAll();
  }
}

const fotoTemporal = (env, id) => env.FOTOS.get(env.FOTOS.idFromName(id));

// Quita el "relleno" tipico de los titulos de tienda: "... | MercadoLibre", "... : Amazon.com.mx: ...", "...".
const limpiarTitulo = (t) =>
  t
    .split(/\s[|:]\s|\s[-–]\s(?=[^-–]*$)/)[0]
    .replace(/\s*(\.\.\.|…)\s*$/, '')
    .replace(/[\s:|,–-]+$/, '')
    .replace(/\s+/g, ' ')
    .trim();

function candidatosDeLens(d) {
  const nombres = [];
  const vistos = new Set();
  const agregar = (texto) => {
    const limpio = limpiarTitulo(String(texto || ''));
    const clave = normalizar(limpio);
    if (limpio.length < 3 || limpio.length > 90 || vistos.has(clave)) return;
    vistos.add(clave);
    nombres.push(limpio);
  };
  // 1) Busquedas relacionadas de Google: nombres limpios ("PlayStation 5 Slim").
  for (const r of d.related_content || []) agregar(r.query);
  // 2) Titulos de coincidencias en tiendas (los que traen precio primero).
  const coincidencias = d.visual_matches || [];
  for (const m of coincidencias.filter((m) => m.price)) agregar(m.title);
  for (const m of coincidencias.slice(0, 10)) agregar(m.title);
  return nombres.slice(0, 5);
}

function preciosDeLens(d) {
  return (d.visual_matches || [])
    .filter((m) => m.price?.extracted_value > 0 && m.link && m.source && /mxn|\$/i.test(m.price.value || ''))
    .slice(0, 4)
    .map((m) => ({ titulo: limpiarTitulo(m.title || ''), tienda: m.source, precio: Math.round(m.price.extracted_value), link: m.link }));
}

async function buscarLens(urlImagen, env) {
  const params = new URLSearchParams({ engine: 'google_lens', url: urlImagen, country: 'mx', hl: 'es', api_key: env.SERPAPI_KEY });
  const r = await fetch(`https://serpapi.com/search.json?${params}`);
  let datos = {};
  try {
    datos = await r.json();
  } catch {}
  return { status: r.status, datos };
}

async function identificar(request, env) {
  if (request.method !== 'POST') return json({ ok: false, error: 'Usa POST' }, 405);
  const sinPermiso = verificarOrigen(request);
  if (sinPermiso) return sinPermiso;
  if (!env.SERPAPI_KEY) return json({ ok: false, error: 'Falta configurar la llave de SerpApi en Cloudflare' }, 500);
  if (!env.FOTOS) return json({ ok: false, error: 'Falta configurar el almacenamiento temporal de fotos' }, 500);

  const tipo = (request.headers.get('content-type') || '').split(';')[0].trim().toLowerCase();
  if (!TIPOS_IMAGEN.includes(tipo)) return json({ ok: false, error: 'Manda una foto (JPG, PNG o WebP)' }, 415);
  const imagen = await request.arrayBuffer();
  if (!imagen.byteLength) return json({ ok: false, error: 'La foto llegó vacía. Intenta de nuevo.' }, 400);
  if (imagen.byteLength > IMAGEN_MAX_BYTES) return json({ ok: false, error: 'La foto es demasiado grande' }, 413);

  // Lens necesita la foto en una URL publica: se guarda unos minutos con un ID imposible de adivinar.
  const id = crypto.randomUUID().replace(/-/g, '');
  const foto = fotoTemporal(env, id);
  await foto.guardar(imagen, tipo);
  const urlImagen = `${new URL(request.url).origin}/api/img/${id}.jpg`;

  try {
    let { status, datos } = await buscarLens(urlImagen, env);
    // Si Lens no pudo descargar la foto, un reintento.
    if (/url|image|fetch|download/i.test(String(datos.error || ''))) {
      await new Promise((listo) => setTimeout(listo, 1500));
      ({ status, datos } = await buscarLens(urlImagen, env));
    }
    const fallo = errorDeSerpApi(status, datos);
    if (fallo) return fallo;

    const candidatos = candidatosDeLens(datos);
    if (!candidatos.length) {
      // Diagnóstico: ¿Google descargó la foto? ¿qué contestó Lens?
      const detalle = {
        descargas: await foto.lecturas(),
        lens: { estado: datos.search_metadata?.status, error: datos.error, claves: Object.keys(datos), coincidencias: (datos.visual_matches || []).length },
      };
      return json({ ok: false, vacio: true, error: 'No se reconoció el artículo. Prueba con la etiqueta, la caja o el número de modelo.', detalle }, 404);
    }
    return json({ ok: true, candidatos, precios: preciosDeLens(datos) });
  } finally {
    await foto.borrar();
  }
}

// Ruta publica temporal para que Google Lens descargue la foto. Solo IDs validos y vigentes.
async function servirImagen(nombre, request, env) {
  const id = ID_IMAGEN.exec(nombre)?.[1];
  if (!id || !env.FOTOS) return new Response('No encontrada', { status: 404 });
  const guardada = await fotoTemporal(env, id).leer((request.headers.get('user-agent') || '?').slice(0, 120));
  if (!guardada) return new Response('No encontrada', { status: 404 });
  return new Response(guardada.bytes, {
    headers: { 'content-type': guardada.tipo, 'content-length': String(guardada.bytes.byteLength), 'cache-control': 'no-store' },
  });
}

// ---------- /api/cuota: busquedas restantes de SerpApi (consultar la cuenta no gasta busquedas) ----------

async function cuota(request, env) {
  if (request.method !== 'GET') return json({ ok: false, error: 'Usa GET' }, 405);
  const sinPermiso = verificarOrigen(request);
  if (sinPermiso) return sinPermiso;
  if (!env.SERPAPI_KEY) return json({ ok: false, error: 'Falta configurar la llave de SerpApi en Cloudflare' }, 500);

  const r = await fetch(`https://serpapi.com/account.json?api_key=${encodeURIComponent(env.SERPAPI_KEY)}`);
  const d = await r.json().catch(() => ({}));
  if (!r.ok || typeof d.total_searches_left !== 'number') {
    return json({ ok: false, error: 'No se pudo consultar cuántas búsquedas quedan' }, 502);
  }
  // Solo números: la respuesta de SerpApi trae la llave y el correo de la cuenta.
  return json({
    ok: true,
    restantes: d.total_searches_left,
    mensuales: d.searches_per_month,
    usadas: d.this_month_usage,
    renovacion: d.plan_renewal_date || null,
    porHora: d.account_rate_limit_per_hour,
    estaHora: d.this_hour_searches,
  });
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    // Verificacion: dice que esta configurado, sin mostrar valores.
    if (url.pathname === '/api/salud') {
      return json({
        ok: true,
        gemini: Boolean(env.GEMINI_API_KEY),
        serpapi: Boolean(env.SERPAPI_KEY),
        cache: Boolean(env.CACHE),
      });
    }

    // Historial (D1): productos y operaciones. Protegido con clave.
    if (esRutaHistorial(url.pathname)) {
      try {
        return await historial(request, env, url);
      } catch (e) {
        return json({ ok: false, error: 'Error interno', detalle: String(e).slice(0, 300) }, 500);
      }
    }

    if (url.pathname.startsWith('/api/img/')) {
      return servirImagen(url.pathname.slice('/api/img/'.length), request, env);
    }

    if (url.pathname === '/api/identificar') {
      try {
        return await identificar(request, env);
      } catch (e) {
        return json({ ok: false, error: 'Error interno', detalle: String(e).slice(0, 300) }, 500);
      }
    }

    if (url.pathname === '/api/cuota') {
      try {
        return await cuota(request, env);
      } catch (e) {
        return json({ ok: false, error: 'Error interno', detalle: String(e).slice(0, 300) }, 500);
      }
    }

    if (url.pathname === '/api/precios') {
      try {
        return await precios(request, env);
      } catch (e) {
        return json({ ok: false, error: 'Error interno', detalle: String(e).slice(0, 300) }, 500);
      }
    }

    if (url.pathname === '/api/analizar') {
      try {
        return await analizar(request, env);
      } catch (e) {
        return json({ ok: false, error: 'Error interno', detalle: String(e).slice(0, 300) }, 500);
      }
    }

    // Todo lo demas: la app.
    return env.ASSETS.fetch(request);
  },
};