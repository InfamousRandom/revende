/**
 * Búsquedas guardadas sin señal (bazar, tianguis). Se guardan en el celular (fotos incluidas) y se
 * hacen solas cuando vuelve el internet; el resultado queda listo para verlo después.
 * Guardarla cuenta como confirmación, igual que tomar una foto.
 */
import { Directory, File, Paths } from 'expo-file-system';
import { useSyncExternalStore } from 'react';
import { Platform } from 'react-native';

import type { Entrada, Resultado } from './busqueda';

export type Pendiente = {
  id: string;
  entrada: Entrada;
  creado: string;
  estado: 'esperando' | 'buscando' | 'listo' | 'error';
  resultado?: Resultado;
  error?: string;
};

// En la vista previa web solo vive en memoria.
const PERSISTE = Platform.OS !== 'web';
const carpeta = () => new Directory(Paths.document, 'pendientes');
const archivo = () => new File(Paths.document, 'pendientes.json');

let lista: Pendiente[] = [];
const oyentes = new Set<() => void>();

function cambiar(nueva: Pendiente[]) {
  lista = nueva;
  oyentes.forEach((o) => o());
  if (PERSISTE) void archivo().write(JSON.stringify(lista)).catch(() => {});
}

// Al abrir la app: lo guardado; lo que se quedó "buscando" (la app se cerró a la mitad) vuelve a esperar.
const cargado: Promise<void> = (async () => {
  if (!PERSISTE) return;
  try {
    const a = archivo();
    if (!a.exists) return;
    const guardados = JSON.parse(await a.text()) as Pendiente[];
    lista = guardados.map((p) => (p.estado === 'buscando' ? { ...p, estado: 'esperando' } : p));
    oyentes.forEach((o) => o());
  } catch {
    lista = [];
  }
})();

export function usePendientes(): Pendiente[] {
  return useSyncExternalStore(
    (o) => {
      oyentes.add(o);
      return () => oyentes.delete(o);
    },
    () => lista,
    () => lista,
  );
}

export const leerPendiente = (id: string) => lista.find((p) => p.id === id);

// Las fotos de la cámara viven en la memoria temporal y el sistema las puede borrar: se copian.
async function copiarFoto(uri: string, id: string, n: number): Promise<string> {
  if (!PERSISTE) return uri;
  const dir = carpeta();
  dir.create({ intermediates: true, idempotent: true });
  const destino = new File(dir, `${id}-${n}.jpg`);
  await new File(uri).copy(destino);
  return destino.uri;
}

export async function guardarPendiente(entrada: Entrada): Promise<void> {
  await cargado;
  const id = `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
  let guardada = entrada;
  if (entrada.tipo === 'foto') {
    const uri = await copiarFoto(entrada.uri, id, 0);
    const extra = await Promise.all((entrada.extra ?? []).map((u, i) => copiarFoto(u, id, i + 1)));
    guardada = { tipo: 'foto', uri, extra };
  }
  cambiar([{ id, entrada: guardada, creado: new Date().toISOString(), estado: 'esperando' }, ...lista]);
}

export function actualizarPendiente(id: string, cambios: Partial<Pendiente>) {
  cambiar(lista.map((p) => (p.id === id ? { ...p, ...cambios } : p)));
}

export function quitarPendiente(id: string) {
  const p = lista.find((x) => x.id === id);
  if (PERSISTE && p?.entrada.tipo === 'foto') {
    for (const uri of [p.entrada.uri, ...(p.entrada.extra ?? [])]) {
      try {
        if (uri.includes('/pendientes/')) new File(uri).delete();
      } catch {}
    }
  }
  cambiar(lista.filter((x) => x.id !== id));
}

export function textoDeEntrada(e: Entrada): string {
  if (e.tipo === 'texto') return e.consulta;
  if (e.tipo === 'codigo') return `Código ${e.codigo}`;
  return (e.extra?.length ?? 0) > 0 ? `${(e.extra?.length ?? 0) + 1} fotos` : 'Foto';
}
