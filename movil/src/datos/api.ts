/**
 * Llamadas al Worker de Revende. Toda llamada lleva el código del dispositivo en un encabezado;
 * ninguna llave de servicios externos vive en la app.
 */
import { File } from 'expo-file-system';
import { Platform } from 'react-native';

import { leerCodigo } from './dispositivo';
import type { Foto, OperacionApi, Producto } from './tipos';

/** Se puede cambiar con EXPO_PUBLIC_API_URL (por ejemplo http://127.0.0.1:8787 para probar en local). */
export const API_URL = process.env.EXPO_PUBLIC_API_URL ?? 'https://revende.molinapablo990.workers.dev';
export const ENCABEZADO_DISPOSITIVO = 'x-revende-dispositivo';

export type Respuesta<T> = { ok: true; datos: T } | { ok: false; error: string; status: number };

/** Lo registra EmparejadoProvider: si el Worker ya no acepta el código guardado, se vuelve a emparejar. */
let alRechazarCodigo: (() => void) | null = null;
export function cuandoSeRechaceElCodigo(fn: (() => void) | null) {
  alRechazarCodigo = fn;
}

export async function llamar<T>(ruta: string, opciones: RequestInit = {}, codigo?: string): Promise<Respuesta<T>> {
  const clave = codigo ?? (await leerCodigo());
  try {
    const r = await fetch(`${API_URL}${ruta}`, {
      ...opciones,
      headers: { ...(opciones.headers ?? {}), ...(clave ? { [ENCABEZADO_DISPOSITIVO]: clave } : {}) },
    });
    const cuerpo = await r.json().catch(() => null);
    if (r.status === 401 && codigo === undefined) alRechazarCodigo?.();
    if (!r.ok || cuerpo?.ok === false) {
      return { ok: false, status: r.status, error: cuerpo?.error ?? `El servidor respondió ${r.status}.` };
    }
    return { ok: true, datos: cuerpo as T };
  } catch {
    return { ok: false, status: 0, error: 'No hay conexión con el servidor. Revisa tu internet.' };
  }
}

/**
 * Bytes de una foto local para mandarla tal cual. En Android un Blob de `fetch(uri)` sale sin tipo y
 * el Worker la rechaza ("Manda una foto"); por eso se leen los bytes del archivo.
 */
async function bytesDeFoto(uri: string): Promise<BodyInit> {
  if (Platform.OS === 'web') return (await fetch(uri)).blob();
  return new File(uri).arrayBuffer();
}

/** Tipo de imagen según la extensión del archivo (por defecto JPEG). */
export function tipoDeFoto(uri: string): string {
  const u = uri.toLowerCase();
  if (u.endsWith('.png')) return 'image/png';
  if (u.endsWith('.webp')) return 'image/webp';
  return 'image/jpeg';
}

const conJson = (metodo: string, cuerpo: unknown): RequestInit => ({
  method: metodo,
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(cuerpo),
});

/** Confirma con el Worker que el código es correcto, sin guardarlo. */
export function probarCodigo(codigo: string) {
  return llamar<{ ok: true }>('/api/emparejar', {}, codigo);
}

// ---------- Historial ----------

export function listarOperaciones() {
  return llamar<{ operaciones: OperacionApi[] }>('/api/operaciones');
}

export function leerOperacion(id: number) {
  return llamar<{ operacion: OperacionApi }>(`/api/operaciones/${id}`);
}

/** Campos en el formato del Worker (snake_case). Solo se mandan los que cambian. */
export type CambiosOperacion = Partial<{
  producto_id: number;
  condicion: string | null;
  precio_compra: number | null;
  fecha_compra: string | null;
  lugar_compra: string | null;
  precio_publicado: number | null;
  fecha_publicado: string | null;
  precio_venta: number | null;
  fecha_venta: string | null;
  canal: string | null;
  fecha_descartado: string | null;
  notas: string | null;
}>;

export function crearOperacion(datos: CambiosOperacion & { producto_id: number }) {
  return llamar<{ operacion: OperacionApi }>('/api/operaciones', conJson('POST', datos));
}

export function actualizarOperacion(id: number, cambios: CambiosOperacion) {
  return llamar<{ operacion: OperacionApi }>(`/api/operaciones/${id}`, conJson('PATCH', cambios));
}

export function borrarOperacion(id: number) {
  return llamar<{ borrada: number }>(`/api/operaciones/${id}`, { method: 'DELETE' });
}

export function buscarProductos(q: string) {
  return llamar<{ productos: Producto[] }>(`/api/productos?q=${encodeURIComponent(q)}`);
}

export function crearProducto(datos: { nombre: string; marca?: string | null; categoria?: string | null }) {
  return llamar<{ producto: Producto }>('/api/productos', conJson('POST', datos));
}

// ---------- Fotos ----------

export function listarFotos(operacionId: number) {
  return llamar<{ fotos: Foto[] }>(`/api/operaciones/${operacionId}/fotos`);
}

export async function subirFoto(operacionId: number, uri: string, tipo?: string) {
  return llamar<{ foto: Foto }>(`/api/operaciones/${operacionId}/fotos`, {
    method: 'POST',
    headers: { 'Content-Type': tipo ?? tipoDeFoto(uri) },
    body: await bytesDeFoto(uri),
  });
}

export function hacerPortada(fotoId: number) {
  return llamar<{ fotos: Foto[] }>(`/api/fotos/${fotoId}/portada`, { method: 'POST' });
}

export function borrarFoto(fotoId: number) {
  return llamar<{ fotos: Foto[] }>(`/api/fotos/${fotoId}`, { method: 'DELETE' });
}

/** Fuente para expo-image: la foto requiere el código del dispositivo en el encabezado. */
export function fuenteFoto(fotoId: number, codigo: string | null) {
  return { uri: `${API_URL}/api/fotos/${fotoId}`, headers: codigo ? { [ENCABEZADO_DISPOSITIVO]: codigo } : undefined };
}

// ---------- Búsqueda e identificación ----------

/** Oferta tal como la devuelve /api/precios. */
export type OfertaApi = {
  titulo: string;
  tienda: string;
  precio: number;
  link: string;
  usado: boolean;
  condicion: string;
  miniatura: string | null;
  aviso?: string;
};
type Resumen = { rango: { min: number; mediana: number; max: number } | null; ofertas: OfertaApi[] };
export type PreciosApi = { consulta: string; producto: string; imagen: string | null; nuevos: Resumen; usados: Resumen; total: number; cache: boolean };

/** Google Shopping vía SerpApi: gasta 1 búsqueda si no está en la memoria de 24 h. */
export function buscarPrecios(consulta: string) {
  return llamar<PreciosApi>('/api/precios', conJson('POST', { consulta }));
}

export type ProductoCatalogo = {
  id: string;
  nombre: string;
  marca: string | null;
  modelo: string | null;
  color: string | null;
  lanzamiento: number | null;
  imagen: string | null;
  link: string;
  completo: boolean;
};
export type CatalogoApi = {
  productos: ProductoCatalogo[];
  precios: { fuente: string; link: string; total: number; precios: { precio: number; condicion: string; usado: boolean }[] } | null;
};

/** Catálogo de Mercado Libre (gratis). */
export function buscarCatalogo(q: string) {
  return llamar<CatalogoApi>(`/api/catalogo?q=${encodeURIComponent(q)}`);
}

export function buscarCodigo(codigo: string) {
  return llamar<{ nombre: string; marca: string | null; fuente: string }>(`/api/codigo?c=${encodeURIComponent(codigo)}`);
}

export type IdentificacionApi = {
  sugerido: string;
  candidatos: string[];
  catalogo: { id: number; nombre: string }[];
  precios: { titulo: string; tienda: string; precio: number; link: string }[];
};

/** Google Lens vía SerpApi (1 búsqueda). La foto se manda reducida (JPEG). */
export async function identificarFoto(uri: string) {
  return llamar<IdentificacionApi>('/api/identificar', {
    method: 'POST',
    headers: { 'Content-Type': 'image/jpeg' },
    body: await bytesDeFoto(uri),
  });
}

export type ReferenciasApi = {
  producto: { id: number; nombre: string } | null;
  resumen?: {
    ventas: { n: number; mediana: number; min: number; max: number } | null;
    capturas: { n: number; mediana: number; min: number; max: number } | null;
    todo: { n: number; mediana: number; min: number; max: number } | null;
    dias_mediana: number | null;
  };
};

/** Lo que ya vendiste de este artículo (tu historial en D1, gratis). */
export function buscarReferencias(q: string, precioNuevo?: number) {
  const extra = precioNuevo ? `&precio_nuevo=${precioNuevo}` : '';
  return llamar<ReferenciasApi>(`/api/referencias?q=${encodeURIComponent(q)}${extra}`);
}

/** Búsquedas de SerpApi que quedan este mes. */
export function cuota() {
  return llamar<{ restantes: number; mensuales: number }>('/api/cuota');
}

// ---------- Cartas Pokémon ----------

export type CartaApi = {
  id: string;
  nombre: string;
  numero: string;
  total: number | null;
  expansion: string | null;
  lanzamiento: number | null;
  rareza: string | null;
  imagen: string | null;
  link: string | null;
  actualizado: string | null;
  precios: { variante: string; mercado: number | null; bajo: number | null; alto: number | null }[];
};
export type CambioApi = { usd_mxn: number; fecha: string; fuente: string } | null;

/** Pokémon TCG API (precios de TCGplayer en dólares) + tipo de cambio del día. Gratis. */
export function buscarCartas(nombre: string, numero: string) {
  const p = new URLSearchParams();
  if (nombre) p.set('nombre', nombre);
  if (numero) p.set('numero', numero);
  return llamar<{ cartas: CartaApi[]; cambio: CambioApi; fuente: string }>(`/api/cartas?${p}`);
}

// ---------- IA (Fase V8, oculta con FUNCIONES) ----------

export type InsightApi = {
  resultado: { veredicto: 'buena' | 'regular' | 'mala'; resumen: string; razones: string[]; riesgos: string[] };
  fuentes: { titulo: string; url: string }[];
};

export function pedirInsight(datos: { nombre: string; nuevo?: number; usado?: number; tus_ventas?: number }) {
  return llamar<InsightApi>('/api/insight', conJson('POST', datos));
}

export type AutenticidadApi = {
  resultado: { nivel: 'sin_alertas' | 'dudoso' | 'posible_imitacion'; resumen: string; señales: string[]; revisar: string[] };
};

export async function revisarAutenticidad(uri: string) {
  return llamar<AutenticidadApi>('/api/autenticidad', {
    method: 'POST',
    headers: { 'Content-Type': 'image/jpeg' },
    body: await bytesDeFoto(uri),
  });
}
