/**
 * Reglas para decidir una compra. Solo usan precios con fuente (tus ventas, lo que viste publicado o
 * Google Shopping) y los números que escribe Pablo; nunca inventan un precio.
 */
import type { Resultado } from './busqueda';

function mediana(numeros: number[]): number {
  const orden = [...numeros].sort((a, b) => a - b);
  const mitad = Math.floor(orden.length / 2);
  return orden.length % 2 ? orden[mitad] : Math.round((orden[mitad - 1] + orden[mitad]) / 2);
}

/** Precio de reventa: tus ventas, luego lo que viste publicado (Marketplace), luego usados en Google. */
export function precioDeReventa(r: Pick<Resultado, 'tusVentas' | 'capturas' | 'usados'>): { precio: number; fuente: string } | null {
  if (r.tusVentas) {
    const n = r.tusVentas.rango.n;
    return { precio: r.tusVentas.rango.mediana, fuente: `Mediana de tus ${n} ${n === 1 ? 'venta' : 'ventas'}` };
  }
  if (r.capturas.length) {
    const n = r.capturas.length;
    return { precio: mediana(r.capturas.map((c) => c.precio)), fuente: `Mediana de ${n} ${n === 1 ? 'precio que viste' : 'precios que viste'} publicados` };
  }
  if (r.usados?.rango) return { precio: Math.round(r.usados.rango.mediana), fuente: 'Mediana de usados en Google Shopping' };
  return null;
}

export type Veredicto = { tipo: 'compra' | 'regatea' | 'no'; titulo: string; detalle: string };

/**
 * Con lo que piden: compra si cabe tu ganancia, regatea si todavía ganas algo, no si pierdes.
 * `venta` y `maximo` son los de la calculadora.
 */
export function veredicto(venta: number, maximo: number, piden: number): Veredicto | null {
  if (!(venta > 0) || !(piden > 0)) return null;
  const ganarias = venta - piden;
  if (piden <= maximo) return { tipo: 'compra', titulo: 'Cómpralo', detalle: `Ganarías unos $${miles(ganarias)} si lo vendes en $${miles(venta)}.` };
  if (ganarias > 0) {
    return {
      tipo: 'regatea',
      titulo: 'Regatea',
      detalle: `A ese precio solo ganarías $${miles(ganarias)}. Ofrece${maximo > 0 ? ` hasta $${miles(maximo)}` : ' menos'}.`,
    };
  }
  return { tipo: 'no', titulo: 'No lo compres', detalle: ganarias === 0 ? 'No ganarías nada.' : `Perderías unos $${miles(-ganarias)}.` };
}

const miles = (n: number) => Math.round(n).toLocaleString('es-MX');

/** Reparte lo pagado por un lote según lo que vale cada artículo; sin precio para alguno, en partes iguales. */
export function repartirLote(pagado: number, valores: (number | null)[]): number[] {
  if (!valores.length) return [];
  const todos = valores.every((v): v is number => v != null && v > 0);
  const total = todos ? valores.reduce<number>((s, v) => s + (v ?? 0), 0) : valores.length;
  const partes = valores.map((v) => Math.floor((pagado * (todos ? (v as number) : 1)) / total));
  // Lo que sobra por redondeo va al primero, para que la suma sea exacta.
  partes[0] += pagado - partes.reduce((s, p) => s + p, 0);
  return partes;
}
