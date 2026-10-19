/**
 * Llamadas al Worker de Revende. Toda llamada lleva el código del dispositivo en un encabezado;
 * ninguna llave de servicios externos vive en la app.
 */
import { leerCodigo } from './dispositivo';

/** Se puede cambiar con EXPO_PUBLIC_API_URL (por ejemplo http://127.0.0.1:8787 para probar en local). */
export const API_URL = process.env.EXPO_PUBLIC_API_URL ?? 'https://revende.molinapablo990.workers.dev';
export const ENCABEZADO_DISPOSITIVO = 'x-revende-dispositivo';

export type Respuesta<T> = { ok: true; datos: T } | { ok: false; error: string; status: number };

export async function llamar<T>(ruta: string, opciones: RequestInit = {}, codigo?: string): Promise<Respuesta<T>> {
  const clave = codigo ?? (await leerCodigo());
  try {
    const r = await fetch(`${API_URL}${ruta}`, {
      ...opciones,
      headers: { ...(opciones.headers ?? {}), ...(clave ? { [ENCABEZADO_DISPOSITIVO]: clave } : {}) },
    });
    const cuerpo = await r.json().catch(() => null);
    if (!r.ok || cuerpo?.ok === false) {
      return { ok: false, status: r.status, error: cuerpo?.error ?? `El servidor respondió ${r.status}.` };
    }
    return { ok: true, datos: cuerpo as T };
  } catch {
    return { ok: false, status: 0, error: 'No hay conexión con el servidor. Revisa tu internet.' };
  }
}

/** Confirma con el Worker que el código es correcto, sin guardarlo. */
export function probarCodigo(codigo: string) {
  return llamar<{ ok: true }>('/api/emparejar', {}, codigo);
}
