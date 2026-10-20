// Referencia internacional: publicaciones activas de USADOS en eBay que se envían a México.
// Con el contexto de comprador en México, eBay convierte el precio a pesos (y conserva el original
// en dólares) y traduce los títulos. Son precios que piden, no ventas cerradas. No gasta SerpApi.
import { json, normalizar } from './util.js';

const API = 'https://api.ebay.com';
const CACHE_SEGUNDOS = 24 * 60 * 60;
const VERSION = 'v3';
// Títulos en español (traducidos por eBay) y en inglés. "Juego" o "control" no: muchas consolas los
// incluyen; los juegos sueltos baratos los marca la regla de precio muy bajo.
const ACCESORIOS = [
  'estuche', 'funda', 'carcasa', 'pantalla', 'lcd', 'repuesto', 'refaccion', 'cargador', 'cable', 'adaptador',
  'protector', 'mica', 'skin', 'cartucho', 'botones', 'bateria',
  'case', 'cover', 'shell', 'screen', 'replacement', 'parts', 'charger', 'cartridge',
];

async function tokenEbay(env) {
  const guardado = await env.CACHE?.get('ebay-token');
  if (guardado) return guardado;
  const r = await fetch(`${API}/identity/v1/oauth2/token`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Authorization: `Basic ${btoa(`${env.EBAY_CLIENT_ID}:${env.EBAY_CLIENT_SECRET}`)}`,
    },
    body: new URLSearchParams({ grant_type: 'client_credentials', scope: 'https://api.ebay.com/oauth/api_scope' }),
  });
  const t = await r.json().catch(() => ({}));
  if (!t.access_token) throw new Error(`eBay no dio token (${r.status})`);
  // Dura 2 h; se guarda un poco menos para no usarlo vencido.
  await env.CACHE?.put('ebay-token', t.access_token, { expirationTtl: Math.max(300, (t.expires_in || 7200) - 600) });
  return t.access_token;
}

function mediana(numeros) {
  const orden = [...numeros].sort((a, b) => a - b);
  const mitad = Math.floor(orden.length / 2);
  return orden.length % 2 ? orden[mitad] : (orden[mitad - 1] + orden[mitad]) / 2;
}

// GET /api/ebay?q=nombre o modelo
export async function ebay(env, url) {
  if (!env.EBAY_CLIENT_ID || !env.EBAY_CLIENT_SECRET) {
    return json({ ok: false, error: 'Falta configurar EBAY_CLIENT_ID y EBAY_CLIENT_SECRET en Cloudflare' }, 500);
  }
  const q = (url.searchParams.get('q') || '').replace(/\s+/g, ' ').trim().slice(0, 120);
  if (q.length < 2) return json({ ok: false, error: 'Escribe el artículo' }, 400);

  const clave = `ebay:${VERSION}:${normalizar(q)}`;
  const guardado = await env.CACHE?.get(clave, 'json');
  if (guardado) return json({ ...guardado, cache: true });

  const token = await tokenEbay(env);
  const params = new URLSearchParams({ q, limit: '40', filter: 'conditions:{USED},buyingOptions:{FIXED_PRICE}' });
  const r = await fetch(`${API}/buy/browse/v1/item_summary/search?${params}`, {
    headers: {
      Authorization: `Bearer ${token}`,
      'X-EBAY-C-MARKETPLACE-ID': 'EBAY_US',
      'X-EBAY-C-ENDUSERCTX': 'contextualLocation=country=MX,zip=06700',
      'Accept-Language': 'es-MX',
    },
  });
  if (!r.ok) return json({ ok: false, error: 'eBay no respondió. Intenta de nuevo.' }, 502);
  const d = await r.json().catch(() => ({}));

  const ofertas = (d.itemSummaries || [])
    .map((i) => {
      const p = i.price || {};
      const precio = Number(p.value);
      if (!(precio > 0) || p.currency !== 'MXN' || !i.itemWebUrl) return null;
      return {
        titulo: String(i.title || '').trim(),
        precio: Math.round(precio),
        dolares: p.convertedFromCurrency === 'USD' ? Number(p.convertedFromValue) : null,
        condicion: i.condition || 'Usado',
        pais: i.itemLocation?.country || null,
        link: i.itemWebUrl,
        imagen: i.image?.imageUrl?.replace(/^http:/, 'https:') || null,
      };
    })
    .filter(Boolean)
    .sort((a, b) => a.precio - b.precio);

  // Se marca (no se quita) lo que parece accesorio, refacción o precio fuera de lo normal, igual que en
  // Google Shopping; lo marcado no cuenta para el rango.
  const consulta = ` ${normalizar(q)} `;
  for (const o of ofertas) {
    const t = ` ${normalizar(o.titulo).replace(/[^a-z0-9]+/g, ' ')} `;
    if (ACCESORIOS.some((a) => t.includes(` ${a} `) && !consulta.includes(` ${a} `))) o.aviso = 'Parece accesorio o refacción';
  }
  const normales = ofertas.filter((o) => !o.aviso);
  if (normales.length >= 3) {
    const m = mediana(normales.map((o) => o.precio));
    for (const o of normales) {
      if (o.precio < m * 0.35) o.aviso = 'Precio muy bajo';
      else if (o.precio > m * 2) o.aviso = 'Precio muy alto';
    }
  }
  const precios = ofertas.filter((o) => !o.aviso).map((o) => o.precio);
  const conDolares = ofertas.filter((o) => o.dolares > 0);
  const respuesta = {
    ok: true,
    consulta: q,
    total: d.total ?? ofertas.length,
    rango: precios.length ? { min: Math.min(...precios), mediana: Math.round(mediana(precios)), max: Math.max(...precios) } : null,
    // Tipo de cambio que usó eBay (pesos ÷ dólares), para mostrarlo con la fuente.
    tipoCambio: conDolares.length ? Math.round((conDolares[0].precio / conDolares[0].dolares) * 100) / 100 : null,
    ofertas: [...ofertas.filter((o) => !o.aviso), ...ofertas.filter((o) => o.aviso)],
    fuente: 'eBay: publicaciones activas de usados con envío a México (precio que piden, convertido por eBay)',
    fecha: new Date().toISOString(),
  };
  if (ofertas.length) await env.CACHE?.put(clave, JSON.stringify(respuesta), { expirationTtl: CACHE_SEGUNDOS });
  return json({ ...respuesta, cache: false });
}
