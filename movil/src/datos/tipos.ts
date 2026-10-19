/** Tipos de la app. Siguen el modelo de D1 (`migrations/`); montos en pesos enteros. */

export type Condicion = 'sellado' | 'como_nuevo' | 'usado_bueno' | 'con_detalles';
export type Canal = 'en_persona' | 'marketplace' | 'otro';
export type Estado = 'inventario' | 'publicado' | 'vendido' | 'descartado';

/** Una operación de compra/venta con los datos de su producto. */
export type Articulo = {
  id: number;
  productoId: number;
  nombre: string;
  marca: string | null;
  /** Texto libre, guardado en minúsculas y sin acentos (ej. "consolas"). */
  categoria: string | null;
  condicion: Condicion | null;
  /** Puede faltar en ventas importadas sin compra registrada. */
  precioCompra: number | null;
  fechaCompra: string | null;
  lugarCompra?: string | null;
  precioPublicado?: number | null;
  fechaPublicado?: string | null;
  precioVenta?: number | null;
  fechaVenta?: string | null;
  canal?: Canal | null;
  fechaDescartado?: string | null;
  notas?: string | null;
  fotos: number;
  portadaId: number | null;
};

export type Producto = {
  id: number;
  nombre: string;
  marca: string | null;
  categoria: string | null;
  modelo: string | null;
  operaciones?: number;
};

export type Foto = { id: number; tipo: string; orden: number };

export type Oferta = {
  titulo: string;
  tienda: string;
  precio: number;
  link: string;
  usado: boolean;
};

export type ResultadoEscaneo = {
  nombre: string;
  marca: string;
  categoria: string;
  /** Año de lanzamiento, si se conoce. Se muestra discreto junto a la marca. */
  lanzamiento?: number;
  nuevo: { min: number; mediana: number; max: number };
  usado: { min: number; mediana: number; max: number };
  ofertas: Oferta[];
};

/** Mismo criterio que la columna `situacion` del Worker. */
export function estadoDe(a: Articulo): Estado {
  if (a.fechaVenta) return 'vendido';
  if (a.fechaDescartado) return 'descartado';
  if (a.fechaPublicado) return 'publicado';
  return 'inventario';
}

export function gananciaDe(a: Articulo): number | null {
  return a.precioVenta == null || a.precioCompra == null ? null : a.precioVenta - a.precioCompra;
}

export const NOMBRE_CONDICION: Record<Condicion, string> = {
  sellado: 'Sellado',
  como_nuevo: 'Como nuevo',
  usado_bueno: 'Usado, buen estado',
  con_detalles: 'Con detalles',
};

export const NOMBRE_ESTADO: Record<Estado, string> = {
  inventario: 'En inventario',
  publicado: 'Publicado',
  vendido: 'Vendido',
  descartado: 'Descartado',
};

export const NOMBRE_CANAL: Record<Canal, string> = {
  en_persona: 'En persona',
  marketplace: 'Marketplace',
  otro: 'Otro',
};

/** "consolas" → "Consolas"; sin categoría → "Sin categoría". */
export function nombreCategoria(categoria: string | null): string {
  if (!categoria) return 'Sin categoría';
  return categoria.charAt(0).toUpperCase() + categoria.slice(1);
}

/** Operación tal como la devuelve el Worker (`SELECT_OPERACION`). */
export type OperacionApi = {
  id: number;
  producto_id: number;
  producto: string;
  marca: string | null;
  categoria: string | null;
  condicion: Condicion | null;
  precio_compra: number | null;
  fecha_compra: string | null;
  lugar_compra: string | null;
  precio_publicado: number | null;
  fecha_publicado: string | null;
  precio_venta: number | null;
  fecha_venta: string | null;
  canal: Canal | null;
  fecha_descartado: string | null;
  notas: string | null;
  fotos: number;
  portada_id: number | null;
};

export function articuloDeApi(o: OperacionApi): Articulo {
  return {
    id: o.id,
    productoId: o.producto_id,
    nombre: o.producto,
    marca: o.marca,
    categoria: o.categoria,
    condicion: o.condicion,
    precioCompra: o.precio_compra,
    fechaCompra: o.fecha_compra,
    lugarCompra: o.lugar_compra,
    precioPublicado: o.precio_publicado,
    fechaPublicado: o.fecha_publicado,
    precioVenta: o.precio_venta,
    fechaVenta: o.fecha_venta,
    canal: o.canal,
    fechaDescartado: o.fecha_descartado,
    notas: o.notas,
    fotos: o.fotos ?? 0,
    portadaId: o.portada_id ?? null,
  };
}
