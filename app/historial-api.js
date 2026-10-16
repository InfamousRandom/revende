// Llamadas a las rutas del historial (D1). Sin clave: el Worker solo acepta llamadas desde la app.

export class ErrorApi extends Error {
  constructor(mensaje, { datos = null } = {}) {
    super(mensaje);
    this.datos = datos;
  }
}

// `datos` se manda como JSON; `csv` como texto (importar).
export async function api(ruta, { metodo = 'GET', datos, csv } = {}) {
  let r;
  try {
    r = await fetch(ruta, {
      method: metodo,
      headers: datos ? { 'content-type': 'application/json' } : csv ? { 'content-type': 'text/csv' } : {},
      body: datos ? JSON.stringify(datos) : csv,
    });
  } catch {
    throw new ErrorApi('Sin conexión. Revisa tu internet e intenta de nuevo.');
  }
  const d = await r.json().catch(() => null);
  if (!d?.ok) throw new ErrorApi(d?.error || 'No se pudo guardar. Intenta de nuevo.', { datos: d });
  return d;
}

// Hoy en México como 'AAAA-MM-DD' (valor por defecto de las fechas).
export const hoy = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Mexico_City' }).format(new Date());

export const CONDICIONES = [
  ['sellado', 'Sellado'],
  ['como_nuevo', 'Como nuevo'],
  ['usado_bueno', 'Usado bueno'],
  ['con_detalles', 'Con detalles'],
];
export const CANALES = [
  ['marketplace', 'Marketplace'],
  ['en_persona', 'En persona'],
  ['otro', 'Otro'],
];
export const CATEGORIAS = ['celulares', 'consolas', 'videojuegos', 'laptops', 'tablets', 'audio', 'relojes', 'tenis', 'ropa', 'otro'];
export const FUENTES = [
  ['marketplace', 'Marketplace'],
  ['ml_usado', 'ML usado'],
  ['otro', 'Otro'],
];

// Descarga el respaldo CSV del historial.
export async function descargarRespaldo() {
  let r;
  try {
    r = await fetch('/api/exportar');
  } catch {
    throw new ErrorApi('Sin conexión. Revisa tu internet e intenta de nuevo.');
  }
  if (!r.ok) throw new ErrorApi('No se pudo descargar el respaldo.');
  const nombre = /filename="([^"]+)"/.exec(r.headers.get('content-disposition') || '')?.[1] || 'revende-historial.csv';
  const enlace = document.createElement('a');
  enlace.href = URL.createObjectURL(await r.blob());
  enlace.download = nombre;
  document.body.appendChild(enlace);
  enlace.click();
  enlace.remove();
  setTimeout(() => URL.revokeObjectURL(enlace.href), 10000);
  return nombre;
}
