/** Tipos de la app. Siguen el modelo de D1 (`migrations/0001_historial.sql`); montos en pesos enteros. */

export type Condicion = 'sellado' | 'como_nuevo' | 'usado_bueno' | 'con_detalles';
export type Canal = 'en_persona' | 'marketplace' | 'otro';
export type Estado = 'inventario' | 'publicado' | 'vendido' | 'descartado';
export type Categoria = 'consolas' | 'videojuegos' | 'ropa' | 'tenis' | 'electronica' | 'juguetes' | 'cartas';

export type Articulo = {
  id: number;
  nombre: string;
  marca: string;
  categoria: Categoria;
  condicion: Condicion;
  precioCompra: number;
  fechaCompra: string;
  lugarCompra?: string;
  precioPublicado?: number;
  fechaPublicado?: string;
  precioVenta?: number;
  fechaVenta?: string;
  canal?: Canal;
  fechaDescartado?: string;
  notas?: string;
};

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
  categoria: Categoria;
  /** Año de lanzamiento, si se conoce. Se muestra discreto junto a la marca. */
  lanzamiento?: number;
  nuevo: { min: number; mediana: number; max: number };
  usado: { min: number; mediana: number; max: number };
  ofertas: Oferta[];
};

/** Estado derivado, igual que en D1: vendido si tiene venta; descartado y publicado por su fecha. */
export function estadoDe(a: Articulo): Estado {
  if (a.fechaVenta) return 'vendido';
  if (a.fechaDescartado) return 'descartado';
  if (a.fechaPublicado) return 'publicado';
  return 'inventario';
}

export function gananciaDe(a: Articulo): number | null {
  return a.precioVenta == null ? null : a.precioVenta - a.precioCompra;
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

export const NOMBRE_CATEGORIA: Record<Categoria, string> = {
  consolas: 'Consolas',
  videojuegos: 'Videojuegos',
  ropa: 'Ropa',
  tenis: 'Tenis',
  electronica: 'Electrónica',
  juguetes: 'Juguetes',
  cartas: 'Cartas',
};
