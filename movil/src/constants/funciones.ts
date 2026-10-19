/**
 * Interruptor de funciones (Fase V8). Las que dependen de IA (Gemini) están construidas pero
 * apagadas: no aparecen en la app hasta cambiar aquí a `true`, volver a compilar el APK y tener
 * saldo en Google (hoy responde 402). Decisión de Pablo, 2026-10-19.
 */
export const FUNCIONES = {
  /** "¿Conviene para revender?": opinión de la IA con fuentes, a partir de los precios encontrados. */
  insight: false,
  /** "¿Es original?": señales visibles de original o imitación en la foto. */
  autenticidad: false,
} as const;
