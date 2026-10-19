/**
 * Artículos de la app. Emparejado: vienen del historial en D1 a través del Worker.
 * En modo de ejemplo (solo desarrollo): datos inventados que se pueden modificar en memoria
 * para probar los flujos sin tocar nada real.
 */
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';

import * as api from './api';
import type { CambiosOperacion, Respuesta } from './api';
import { ARTICULOS_EJEMPLO } from './ejemplo';
import { useEmparejado } from './emparejado';
import { articuloDeApi, type Articulo, type Condicion, type OperacionApi } from './tipos';

export type NuevaCompra = {
  producto: { id: number } | { nombre: string; marca: string | null; categoria: string | null };
  precioCompra: number;
  fechaCompra: string;
  condicion: Condicion;
  lugarCompra: string | null;
  notas: string | null;
};

type Contexto = {
  articulos: Articulo[];
  sonDeEjemplo: boolean;
  cargando: boolean;
  error: string | null;
  recargar: () => Promise<void>;
  actualizar: (id: number, cambios: CambiosOperacion) => Promise<Respuesta<Articulo>>;
  registrarCompra: (datos: NuevaCompra) => Promise<Respuesta<Articulo>>;
  borrar: (id: number) => Promise<Respuesta<null>>;
  /** Vuelve a leer un artículo (por ejemplo después de agregar fotos). */
  refrescar: (id: number) => Promise<void>;
};

const ArticulosContexto = createContext<Contexto | null>(null);

// Aplica cambios en formato del Worker a un artículo local (modo de ejemplo).
function aplicar(a: Articulo, c: CambiosOperacion): Articulo {
  const r = { ...a };
  if ('precio_publicado' in c) {
    r.precioPublicado = c.precio_publicado;
    r.fechaPublicado = c.precio_publicado == null ? null : (c.fecha_publicado ?? hoy());
  }
  if ('precio_venta' in c) {
    r.precioVenta = c.precio_venta;
    r.fechaVenta = c.precio_venta == null ? null : (c.fecha_venta ?? hoy());
  }
  if ('canal' in c) r.canal = c.canal as Articulo['canal'];
  if ('fecha_descartado' in c) r.fechaDescartado = c.fecha_descartado;
  if ('notas' in c) r.notas = c.notas;
  return r;
}

/** Fecha de hoy en México como 'AAAA-MM-DD'. */
export function hoy(): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Mexico_City' }).format(new Date());
}

export function ArticulosProvider({ children }: { children: ReactNode }) {
  const { estado } = useEmparejado();
  const ejemplo = estado === 'ejemplo';
  // Dos listas separadas: la de ejemplo vive en memoria; la real viene del Worker.
  const [listaEjemplo, setListaEjemplo] = useState<Articulo[]>(ARTICULOS_EJEMPLO);
  const [listaReal, setListaReal] = useState<Articulo[]>([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const articulos = ejemplo ? listaEjemplo : listaReal;
  const setArticulos = useCallback(
    (cambio: (lista: Articulo[]) => Articulo[]) => (ejemplo ? setListaEjemplo : setListaReal)(cambio),
    [ejemplo],
  );

  const aplicarRespuesta = useCallback((r: Respuesta<{ operaciones: OperacionApi[] }>) => {
    setCargando(false);
    if (r.ok) {
      setListaReal(r.datos.operaciones.map(articuloDeApi));
      setError(null);
    } else {
      setError(r.error);
    }
  }, []);

  // Carga inicial al emparejar.
  useEffect(() => {
    if (estado !== 'emparejado') return;
    let vigente = true;
    void api.listarOperaciones().then((r) => {
      if (vigente) aplicarRespuesta(r);
    });
    return () => {
      vigente = false;
    };
  }, [estado, aplicarRespuesta]);

  // Para "jalar para actualizar" y el botón Reintentar.
  const recargar = useCallback(async () => {
    if (ejemplo) return;
    setCargando(true);
    aplicarRespuesta(await api.listarOperaciones());
  }, [ejemplo, aplicarRespuesta]);

  const reemplazar = useCallback(
    (a: Articulo) => setArticulos((lista) => lista.map((x) => (x.id === a.id ? a : x))),
    [setArticulos],
  );

  const actualizar = useCallback(
    async (id: number, cambios: CambiosOperacion): Promise<Respuesta<Articulo>> => {
      if (ejemplo) {
        const actual = articulos.find((a) => a.id === id);
        if (!actual) return { ok: false, status: 404, error: 'Ese artículo no existe' };
        const nuevo = aplicar(actual, cambios);
        reemplazar(nuevo);
        return { ok: true, datos: nuevo };
      }
      const r = await api.actualizarOperacion(id, cambios);
      if (!r.ok) return r;
      const nuevo = articuloDeApi(r.datos.operacion);
      reemplazar(nuevo);
      return { ok: true, datos: nuevo };
    },
    [ejemplo, articulos, reemplazar],
  );

  const registrarCompra = useCallback(
    async (d: NuevaCompra): Promise<Respuesta<Articulo>> => {
      if (ejemplo) {
        const nombre = 'id' in d.producto ? (articulos.find((a) => a.productoId === (d.producto as { id: number }).id)?.nombre ?? 'Artículo') : d.producto.nombre;
        const nuevo: Articulo = {
          id: Math.max(0, ...articulos.map((a) => a.id)) + 1,
          productoId: 'id' in d.producto ? d.producto.id : Math.max(0, ...articulos.map((a) => a.productoId)) + 1,
          nombre,
          marca: 'id' in d.producto ? null : d.producto.marca,
          categoria: 'id' in d.producto ? null : d.producto.categoria,
          condicion: d.condicion,
          precioCompra: d.precioCompra,
          fechaCompra: d.fechaCompra,
          lugarCompra: d.lugarCompra,
          notas: d.notas,
          fotos: 0,
          portadaId: null,
        };
        setArticulos((lista) => [nuevo, ...lista]);
        return { ok: true, datos: nuevo };
      }
      let productoId: number;
      if ('id' in d.producto) {
        productoId = d.producto.id;
      } else {
        const p = await api.crearProducto(d.producto);
        if (!p.ok) return p;
        productoId = p.datos.producto.id;
      }
      const r = await api.crearOperacion({
        producto_id: productoId,
        precio_compra: d.precioCompra,
        fecha_compra: d.fechaCompra,
        condicion: d.condicion,
        lugar_compra: d.lugarCompra,
        notas: d.notas,
      });
      if (!r.ok) return r;
      const nuevo = articuloDeApi(r.datos.operacion);
      setArticulos((lista) => [nuevo, ...lista]);
      return { ok: true, datos: nuevo };
    },
    [ejemplo, articulos, setArticulos],
  );

  const borrar = useCallback(
    async (id: number): Promise<Respuesta<null>> => {
      if (!ejemplo) {
        const r = await api.borrarOperacion(id);
        if (!r.ok) return r;
      }
      setArticulos((lista) => lista.filter((a) => a.id !== id));
      return { ok: true, datos: null };
    },
    [ejemplo, setArticulos],
  );

  const refrescar = useCallback(
    async (id: number) => {
      if (ejemplo) return;
      const r = await api.leerOperacion(id);
      if (r.ok) reemplazar(articuloDeApi(r.datos.operacion));
    },
    [ejemplo, reemplazar],
  );

  const valor = useMemo(
    () => ({ articulos, sonDeEjemplo: ejemplo, cargando: !ejemplo && cargando, error, recargar, actualizar, registrarCompra, borrar, refrescar }),
    [articulos, ejemplo, cargando, error, recargar, actualizar, registrarCompra, borrar, refrescar],
  );

  return <ArticulosContexto.Provider value={valor}>{children}</ArticulosContexto.Provider>;
}

export function useArticulos(): Contexto {
  const c = useContext(ArticulosContexto);
  if (!c) throw new Error('useArticulos fuera de ArticulosProvider');
  return c;
}

export function useArticulo(id: number): Articulo | undefined {
  return useArticulos().articulos.find((a) => a.id === id);
}
