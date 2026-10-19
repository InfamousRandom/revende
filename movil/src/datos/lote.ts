/**
 * Modo Lote: artículos capturados seguidos (fotos o códigos) que se buscan al terminar.
 * Vive en memoria mientras la app está abierta.
 */
import { useSyncExternalStore } from 'react';

import type { Entrada, Resultado } from './busqueda';

export type ElementoLote = {
  id: string;
  entrada: Exclude<Entrada, { tipo: 'texto' }>;
  estado: 'pendiente' | 'buscando' | 'listo' | 'error';
  resultado?: Resultado;
  error?: string;
};

let elementos: ElementoLote[] = [];
const oyentes = new Set<() => void>();
const avisar = () => oyentes.forEach((o) => o());

function suscribir(oyente: () => void) {
  oyentes.add(oyente);
  return () => oyentes.delete(oyente);
}

export function useLote(): ElementoLote[] {
  return useSyncExternalStore(suscribir, () => elementos, () => elementos);
}

export function agregarAlLote(entrada: ElementoLote['entrada']) {
  // Un mismo código leído dos veces seguidas no se duplica.
  if (entrada.tipo === 'codigo' && elementos.some((e) => e.entrada.tipo === 'codigo' && e.entrada.codigo === entrada.codigo)) return false;
  elementos = [...elementos, { id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`, entrada, estado: 'pendiente' }];
  avisar();
  return true;
}

export function actualizarElemento(id: string, cambios: Partial<ElementoLote>) {
  elementos = elementos.map((e) => (e.id === id ? { ...e, ...cambios } : e));
  avisar();
}

export function quitarDelLote(id: string) {
  elementos = elementos.filter((e) => e.id !== id);
  avisar();
}

export function vaciarLote() {
  elementos = [];
  avisar();
}

/** Búsquedas de SerpApi que puede gastar el lote: foto hasta 2 (Lens + precios), código 1. */
export function busquedasEstimadas(lista: ElementoLote[]): number {
  return lista.filter((e) => e.estado === 'pendiente').reduce((n, e) => n + (e.entrada.tipo === 'foto' ? 2 : 1), 0);
}
