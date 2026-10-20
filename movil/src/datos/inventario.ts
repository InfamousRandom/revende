/**
 * Cuentas sobre lo que tienes sin vender: cuánto tiempo lleva cada artículo, cuáles están estancados
 * y cuánto vale hoy (precio publicado o última mediana de usados en Google Shopping; nunca estimado).
 */
import { useEffect, useMemo, useState } from 'react';

import * as api from './api';
import { hoy, useArticulos } from './articulos';
import { diasEntre } from './formato';
import { estadoDe, type Articulo, type Condicion } from './tipos';
import { NOMBRE_CONDICION } from './tipos';

const sinVender = (a: Articulo) => ['inventario', 'publicado'].includes(estadoDe(a));

/** Días desde la compra de un artículo que sigue sin venderse. */
export function diasSinVender(a: Articulo): number | null {
  return sinVender(a) && a.fechaCompra ? diasEntre(a.fechaCompra, hoy()) : null;
}

/** Cuánto tardas en vender (mediana); null si hay menos de 3 ventas con fecha de compra. */
export function diasTipicosDeVenta(articulos: Articulo[]): number | null {
  const dias = articulos
    .filter((a) => a.fechaVenta && a.fechaCompra)
    .map((a) => diasEntre(a.fechaCompra as string, a.fechaVenta as string))
    .sort((x, y) => x - y);
  return dias.length >= 3 ? dias[Math.floor(dias.length / 2)] : null;
}

/** A partir de cuántos días un artículo se considera estancado: el doble de lo que sueles tardar, o 30. */
export function umbralEstancado(articulos: Articulo[]): number {
  const tipico = diasTipicosDeVenta(articulos);
  return tipico != null ? Math.max(14, tipico * 2) : 30;
}

export function estancados(articulos: Articulo[]): { articulo: Articulo; dias: number }[] {
  const umbral = umbralEstancado(articulos);
  return articulos
    .map((articulo) => ({ articulo, dias: diasSinVender(articulo) ?? 0 }))
    .filter((x) => x.dias > umbral)
    .sort((a, b) => b.dias - a.dias);
}

export type ValorHoy = { precio: number; fuente: 'publicado' | 'google'; fecha: string | null };

/** Valor de hoy de cada artículo sin vender, por id. En modo de ejemplo solo cuenta el precio publicado. */
export function useValorInventario(): Map<number, ValorHoy> {
  const { articulos, sonDeEjemplo } = useArticulos();
  const [remoto, setRemoto] = useState<api.ValorArticuloApi[]>([]);
  // Se vuelve a pedir cuando cambian los artículos sin vender o sus precios publicados.
  const firma = articulos
    .filter(sinVender)
    .map((a) => `${a.id}:${a.precioPublicado ?? ''}`)
    .join(',');

  useEffect(() => {
    if (sonDeEjemplo) return;
    let vigente = true;
    void api.valorInventario().then((r) => {
      if (vigente && r.ok) setRemoto(r.datos.articulos);
    });
    return () => {
      vigente = false;
    };
  }, [sonDeEjemplo, firma]);

  return useMemo(() => {
    const mapa = new Map<number, ValorHoy>();
    if (sonDeEjemplo) {
      for (const a of articulos) if (sinVender(a) && a.precioPublicado) mapa.set(a.id, { precio: a.precioPublicado, fuente: 'publicado', fecha: null });
    } else {
      for (const v of remoto) if (v.precio != null && v.fuente) mapa.set(v.id, { precio: v.precio, fuente: v.fuente, fecha: v.fecha });
    }
    return mapa;
  }, [sonDeEjemplo, articulos, remoto]);
}

/** Texto inicial del anuncio; Pablo lo edita antes de compartir. Las notas son privadas y no se incluyen. */
export function borradorAnuncio(a: Articulo, precio: number | null): { titulo: string; descripcion: string } {
  const condicion = a.condicion ? NOMBRE_CONDICION[a.condicion as Condicion] : null;
  const titulo = [a.nombre, condicion].filter(Boolean).join(' · ');
  const descripcion = [
    `${a.nombre}${a.marca && !a.nombre.toLowerCase().includes(a.marca.toLowerCase()) ? ` (${a.marca})` : ''}.`,
    condicion ? `Condición: ${condicion.toLowerCase()}.` : null,
    precio ? `Precio: $${precio.toLocaleString('es-MX')}.` : null,
    'Entrega en persona. Pregunta sin compromiso.',
  ]
    .filter(Boolean)
    .join('\n');
  return { titulo, descripcion };
}
