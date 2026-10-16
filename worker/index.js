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

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    // Verificacion: dice que esta configurado, sin mostrar valores.
    if (url.pathname === '/api/salud') {
      return json({ ok: true, gemini: Boolean(env.GEMINI_API_KEY), clave: Boolean(env.REVENDE_CLAVE) });
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