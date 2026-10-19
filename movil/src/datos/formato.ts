const PESOS = new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN', maximumFractionDigits: 0 });
const FECHA_CORTA = new Intl.DateTimeFormat('es-MX', { day: 'numeric', month: 'short', timeZone: 'UTC' });
const MES = new Intl.DateTimeFormat('es-MX', { month: 'long', year: 'numeric', timeZone: 'UTC' });

export function pesos(monto: number): string {
  return PESOS.format(monto);
}

/** Con signo, para ganancias: "+$1,400" o "−$300". */
export function pesosConSigno(monto: number): string {
  return `${monto < 0 ? '−' : '+'}${PESOS.format(Math.abs(monto))}`;
}

/** 'AAAA-MM-DD' → "12 oct". */
export function fechaCorta(fecha: string): string {
  return FECHA_CORTA.format(new Date(`${fecha}T00:00:00Z`));
}

/** 'AAAA-MM-DD' → "Octubre 2026". */
export function mesDe(fecha: string): string {
  const texto = MES.format(new Date(`${fecha}T00:00:00Z`));
  return texto.charAt(0).toUpperCase() + texto.slice(1);
}

export function diasEntre(desde: string, hasta: string): number {
  return Math.round((Date.parse(hasta) - Date.parse(desde)) / 86_400_000);
}
