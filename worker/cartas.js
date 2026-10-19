// Revende 2.0, Fase V6: cartas Pokémon. Precios de TCGplayer (dólares, EE. UU.) vía la API pública
// de Pokémon TCG, y tipo de cambio del día (Banco Central Europeo vía Frankfurter) para mostrar el
// equivalente en pesos con su fuente. No gasta SerpApi.
import { json, normalizar } from './util.js';

const API = 'https://api.pokemontcg.io/v2/cards';
const CACHE_SEGUNDOS = 12 * 60 * 60;
const CAMBIO_SEGUNDOS = 6 * 60 * 60;

export async function tipoDeCambio(env) {
  const guardado = await env.CACHE?.get('cambio-usd-mxn', 'json');
  if (guardado) return guardado;
  const r = await fetch('https://api.frankfurter.dev/v1/latest?base=USD&symbols=MXN');
  const d = await r.json().catch(() => ({}));
  if (!d?.rates?.MXN) return null;
  const cambio = { usd_mxn: d.rates.MXN, fecha: d.date, fuente: 'Banco Central Europeo (Frankfurter)' };
  await env.CACHE?.put('cambio-usd-mxn', JSON.stringify(cambio), { expirationTtl: CAMBIO_SEGUNDOS });
  return cambio;
}

// Comillas y caracteres que rompen la consulta de la API.
const limpio = (t) => String(t || '').replace(/["\\*]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 60);

// GET /api/cartas?nombre=Charizard ex&numero=199
export async function cartas(env, url) {
  const nombre = limpio(url.searchParams.get('nombre'));
  const numero = (url.searchParams.get('numero') || '').replace(/[^0-9a-zA-Z]/g, '').slice(0, 8);
  if (nombre.length < 2 && !numero) return json({ ok: false, error: 'Escribe el nombre de la carta o su número' }, 400);

  const clave = `cartas:v1:${normalizar(nombre)}:${numero.toLowerCase()}`;
  let tarjetas = await env.CACHE?.get(clave, 'json');
  if (!tarjetas) {
    const partes = [];
    if (nombre.length >= 2) partes.push(`name:"${nombre}*"`);
    if (numero) partes.push(`number:${numero}`);
    const params = new URLSearchParams({
      q: partes.join(' '),
      pageSize: '12',
      orderBy: '-set.releaseDate',
      select: 'id,name,number,set,tcgplayer,images,rarity',
    });
    const headers = env.POKEMONTCG_KEY ? { 'X-Api-Key': env.POKEMONTCG_KEY } : {};
    const r = await fetch(`${API}?${params}`, { headers });
    if (!r.ok) return json({ ok: false, error: 'El servicio de cartas no respondió. Intenta de nuevo.' }, 502);
    const d = await r.json().catch(() => ({}));
    tarjetas = (d.data || []).map((c) => ({
      id: c.id,
      nombre: c.name,
      numero: c.number,
      total: c.set?.printedTotal ?? null,
      expansion: c.set?.name ?? null,
      lanzamiento: c.set?.releaseDate ? Number(c.set.releaseDate.slice(0, 4)) : null,
      rareza: c.rarity ?? null,
      imagen: c.images?.small ?? null,
      link: c.tcgplayer?.url ?? null,
      actualizado: c.tcgplayer?.updatedAt ?? null,
      // Un precio por variante (normal, holo, reverse holo...): market = precio de mercado.
      precios: Object.entries(c.tcgplayer?.prices || {})
        .map(([variante, p]) => ({ variante, mercado: p.market ?? null, bajo: p.low ?? null, alto: p.high ?? null }))
        .filter((p) => p.mercado || p.bajo),
    }));
    await env.CACHE?.put(clave, JSON.stringify(tarjetas), { expirationTtl: CACHE_SEGUNDOS });
  }
  const cambio = await tipoDeCambio(env).catch(() => null);
  return json({ ok: true, cartas: tarjetas, cambio, fuente: 'TCGplayer (EE. UU.) vía Pokémon TCG API' });
}
