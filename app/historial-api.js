// Llamadas a las rutas del historial (D1). Requieren la clave de acceso guardada en el celular.

export const CLAVE_HISTORIAL = 'revende:clave';

export const leerClave = () => {
  try {
    return JSON.parse(localStorage.getItem(CLAVE_HISTORIAL) || '""') || '';
  } catch {
    return '';
  }
};
export const guardarClave = (clave) => {
  try {
    localStorage.setItem(CLAVE_HISTORIAL, JSON.stringify(clave));
  } catch {}
};

export class ErrorApi extends Error {
  constructor(mensaje, { clave = false, datos = null } = {}) {
    super(mensaje);
    this.clave = clave; // true si la clave falta o es incorrecta
    this.datos = datos;
  }
}

// `datos` se manda como JSON; `csv` como texto (importar).
export async function api(ruta, { metodo = 'GET', datos, csv } = {}) {
  const clave = leerClave();
  if (!clave) throw new ErrorApi('Falta la clave de acceso', { clave: true });
  let r;
  try {
    r = await fetch(ruta, {
      method: metodo,
      headers: {
        'x-revende-clave': clave,
        ...(datos ? { 'content-type': 'application/json' } : csv ? { 'content-type': 'text/csv' } : {}),
      },
      body: datos ? JSON.stringify(datos) : csv,
    });
  } catch {
    throw new ErrorApi('Sin conexión. Revisa tu internet e intenta de nuevo.');
  }
  const d = await r.json().catch(() => null);
  if (r.status === 401) throw new ErrorApi('Clave de acceso incorrecta', { clave: true });
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

// Descarga el respaldo CSV del historial (con la clave en el encabezado, no en la URL).
export async function descargarRespaldo() {
  let r;
  try {
    r = await fetch('/api/exportar', { headers: { 'x-revende-clave': leerClave() } });
  } catch {
    throw new ErrorApi('Sin conexión. Revisa tu internet e intenta de nuevo.');
  }
  if (r.status === 401) throw new ErrorApi('Clave de acceso incorrecta', { clave: true });
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
