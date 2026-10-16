// Worker de Revende: sirve la app (archivos de ./out) y las rutas /api.
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

const json = (datos, status = 200) => Response.json(datos, { status });

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
  if (!env.REVENDE_CLAVE) return json({ ok: false, error: 'Falta REVENDE_CLAVE en Cloudflare' }, 500);
  if (request.headers.get('x-revende-clave') !== env.REVENDE_CLAVE) {
    return json({ ok: false, error: 'Clave de acceso incorrecta' }, 401);
  }

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
const UMBRAL_ACCESORIO = 0.35; // menos del 35 % de la mediana: casi seguro accesorio o producto distinto
const UMBRAL_ALTO = 2; // mas del doble de la mediana: bundle, edicion especial u otro producto
const PALABRAS_ACCESORIO = [
  'funda', 'case', 'carcasa', 'mica', 'protector', 'skin', 'sticker', 'calcomania', 'vinil',
  'cargador', 'cable', 'base de carga', 'soporte', 'estuche', 'repuesto', 'refaccion', 'adaptador',
  // Paquetes y ediciones especiales: no son el articulo base.
  'bundle', 'paquete', 'pack', 'combo', 'kit', 'aniversario', 'edicion limitada', 'limited edition',
  'mas', 'incluye', 'incluido', 'juego', 'juegos',
];
// Tiendas fuera de Mexico o de vendedores particulares: no sirven como precio de nuevo en MX.
const TIENDAS_EXCLUIDAS = /^ebay\b/i;

// "mercadolibre.com.mx", "Mercado Libre" y "Amazon MX" -> misma tienda.
const claveTienda = (tienda) =>
  normalizar(tienda).replace(/\.com(\.mx)?$|\.mx$/, '').replace(/[^a-z0-9]/g, '').replace(/mx$/, '');

const normalizar = (texto) =>
  texto.toLowerCase().normalize('NFD').replace(/\p{M}/gu, '').replace(/\s+/g, ' ').trim();

function mediana(numeros) {
  const orden = [...numeros].sort((a, b) => a - b);
  const mitad = Math.floor(orden.length / 2);
  return orden.length % 2 ? orden[mitad] : Math.round((orden[mitad - 1] + orden[mitad]) / 2);
}

function verificarClave(request, env) {
  if (!env.REVENDE_CLAVE) return json({ ok: false, error: 'Falta configurar la clave de acceso en Cloudflare' }, 500);
  if (request.headers.get('x-revende-clave') !== env.REVENDE_CLAVE) {
    return json({ ok: false, error: 'Clave de acceso incorrecta. Revisala en Ajustes.' }, 401);
  }
  return null;
}

// Convierte un resultado de SerpApi en oferta; null si no sirve (sin precio, sin tienda o sin link).
function aOferta(r) {
  if (r.second_hand_condition) return null; // usado o reacondicionado: no es precio de nuevo
  const precio = typeof r.extracted_price === 'number' ? Math.round(r.extracted_price) : null;
  const link = r.link || r.product_link || '';
  const tienda = (r.source || '').trim();
  if (!precio || precio <= 0 || !link || !tienda || !r.title || TIENDAS_EXCLUIDAS.test(tienda)) return null;
  return { titulo: r.title.trim(), tienda, precio, link, miniatura: r.thumbnail || '' };
}

function filtrarOfertas(resultados, consulta) {
  const consultaNorm = normalizar(consulta);
  // Solo descarta por palabra si el usuario no la busco (ej. "funda iphone" si debe mostrar fundas).
  const palabras = PALABRAS_ACCESORIO.filter((p) => !consultaNorm.includes(p));
  const esAccesorio = (titulo) => {
    const t = ` ${normalizar(titulo).replace(/[^a-z0-9+]+/g, ' ')} `;
    // Un "+" en el titulo casi siempre es paquete ("PS5 + juego"), salvo que se haya buscado asi.
    if (!consultaNorm.includes('+') && t.includes('+')) return true;
    return palabras.some((p) => t.includes(` ${p} `) || t.includes(` ${p}s `) || t.includes(` ${p}es `));
  };

  let ofertas = resultados.map(aOferta).filter(Boolean).filter((o) => !esAccesorio(o.titulo));

  // Una oferta por tienda: la mas barata.
  const porTienda = new Map();
  for (const o of ofertas) {
    const clave = claveTienda(o.tienda);
    if (!porTienda.has(clave) || o.precio < porTienda.get(clave).precio) porTienda.set(clave, o);
  }
  ofertas = [...porTienda.values()];

  if (ofertas.length >= 3) {
    const m = mediana(ofertas.map((o) => o.precio));
    ofertas = ofertas.filter((o) => o.precio >= m * UMBRAL_ACCESORIO && o.precio <= m * UMBRAL_ALTO);
  }
  return ofertas.sort((a, b) => a.precio - b.precio);
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
  const sinPermiso = verificarClave(request, env);
  if (sinPermiso) return sinPermiso;
  if (!env.SERPAPI_KEY) return json({ ok: false, error: 'Falta configurar la llave de SerpApi en Cloudflare' }, 500);

  let consulta = '';
  try {
    consulta = String((await request.json()).consulta || '').replace(/\s+/g, ' ').trim();
  } catch {}
  if (consulta.length < 2 || consulta.length > 120) {
    return json({ ok: false, error: 'Escribe el articulo (entre 2 y 120 caracteres)' }, 400);
  }

  const claveCache = `precios:${normalizar(consulta)}`;
  if (env.CACHE) {
    const guardado = await env.CACHE.get(claveCache, 'json');
    if (guardado) return json({ ...guardado, cache: true });
  }

  const { status, datos } = await buscarSerpApi(consulta, env);
  const errorSerp = String(datos.error || '');
  if (status === 401 || /invalid api key/i.test(errorSerp)) {
    return json({ ok: false, error: 'La llave de SerpApi no es valida' }, 502);
  }
  if (status === 429 || /run out of searches|limit/i.test(errorSerp)) {
    return json({ ok: false, error: 'Se acabaron las busquedas de SerpApi de este mes (o de esta hora). Intenta mas tarde.' }, 429);
  }
  if (errorSerp && !/hasn't returned any results/i.test(errorSerp)) {
    return json({ ok: false, error: 'El servicio de precios fallo. Intenta de nuevo.', detalle: errorSerp.slice(0, 200) }, 502);
  }
  if (status >= 400 && !errorSerp) {
    return json({ ok: false, error: `El servicio de precios respondio ${status}` }, 502);
  }

  const crudos = [...(datos.shopping_results || []), ...(datos.inline_shopping_results || [])];
  const ofertas = filtrarOfertas(crudos, consulta);

  if (!ofertas.length) {
    // No se cachea: puede ser un error de escritura y el usuario lo corregira.
    return json({ ok: false, vacio: true, error: 'No se encontraron precios para ese articulo. Prueba con otro nombre o modelo.' }, 404);
  }

  const lista = ofertas.map((o) => o.precio);
  const m = mediana(lista);
  // Nombre del producto: el titulo que contiene mas palabras de la consulta; si empatan, el mas corto.
  const palabrasConsulta = normalizar(consulta).split(' ');
  const parecido = (o) => {
    const t = normalizar(o.titulo);
    return palabrasConsulta.filter((p) => t.includes(p)).length;
  };
  const representativa = ofertas.reduce((a, b) => {
    const diferencia = parecido(b) - parecido(a);
    return diferencia > 0 || (diferencia === 0 && b.titulo.length < a.titulo.length) ? b : a;
  });

  const respuesta = {
    ok: true,
    consulta,
    producto: representativa.titulo,
    rango: { min: lista[0], mediana: m, max: lista[lista.length - 1] },
    ofertas: ofertas.slice(0, 5),
    total: ofertas.length,
    fecha: new Date().toISOString(),
  };
  if (env.CACHE) await env.CACHE.put(claveCache, JSON.stringify(respuesta), { expirationTtl: CACHE_SEGUNDOS });
  return json({ ...respuesta, cache: false });
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    // Verificacion: dice que esta configurado, sin mostrar valores.
    if (url.pathname === '/api/salud') {
      return json({
        ok: true,
        gemini: Boolean(env.GEMINI_API_KEY),
        clave: Boolean(env.REVENDE_CLAVE),
        serpapi: Boolean(env.SERPAPI_KEY),
        cache: Boolean(env.CACHE),
      });
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