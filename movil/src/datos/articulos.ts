import { ARTICULOS_EJEMPLO, USAR_DATOS_DE_EJEMPLO } from './ejemplo';
import type { Articulo } from './tipos';

/**
 * Fuente de los artículos. Por ahora solo datos de ejemplo en desarrollo; en la Fase V2 se conecta
 * con el historial de D1 a través del Worker.
 */
export function useArticulos(): { articulos: Articulo[]; sonDeEjemplo: boolean } {
  return USAR_DATOS_DE_EJEMPLO
    ? { articulos: ARTICULOS_EJEMPLO, sonDeEjemplo: true }
    : { articulos: [], sonDeEjemplo: false };
}

export function useArticulo(id: number): Articulo | undefined {
  return useArticulos().articulos.find((a) => a.id === id);
}
