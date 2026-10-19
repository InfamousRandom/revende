/**
 * Sistema de diseño de Revende 2.0. Estilo inspirado en SellRaze: azul marino oscuro, azul eléctrico
 * solo para la acción principal, verde para dinero y amarillo-lima para destacar.
 * Contraste revisado (WCAG AA): texto principal >= 7:1, secundario >= 4.5:1 en ambos modos.
 * Los componentes usan estos nombres, nunca colores sueltos.
 */

export const Colors = {
  light: {
    fondo: '#F5F7FB',
    superficie: '#FFFFFF',
    superficieAlta: '#EEF1F7',
    borde: '#DCE1EB',
    texto: '#0B1020',
    textoSecundario: '#4A5468',
    textoTenue: '#5F6880',
    primario: '#1F5EFF',
    sobrePrimario: '#FFFFFF',
    dinero: '#047857',
    sobreDinero: '#FFFFFF',
    destacado: '#C6EE1F',
    sobreDestacado: '#1A1F00',
    peligro: '#DC2626',
    velo: 'rgba(11, 16, 32, 0.5)',
  },
  dark: {
    fondo: '#0B1020',
    superficie: '#151B2E',
    superficieAlta: '#1E2640',
    borde: '#2A3350',
    texto: '#F5F7FB',
    textoSecundario: '#A3ADC2',
    textoTenue: '#7A859C',
    primario: '#1F5EFF',
    sobrePrimario: '#FFFFFF',
    dinero: '#34D399',
    sobreDinero: '#052E1C',
    destacado: '#D4F53C',
    sobreDestacado: '#1A1F00',
    peligro: '#F87171',
    velo: 'rgba(0, 0, 0, 0.6)',
  },
} as const;

export type ThemeColor = keyof typeof Colors.light;

/** Plus Jakarta Sans en una sola familia; la jerarquía la dan el tamaño y el grosor. */
export const Fonts = {
  regular: 'PlusJakartaSans_400Regular',
  medio: 'PlusJakartaSans_500Medium',
  seminegrita: 'PlusJakartaSans_600SemiBold',
  negrita: 'PlusJakartaSans_700Bold',
  extranegrita: 'PlusJakartaSans_800ExtraBold',
} as const;

/** Espacios en múltiplos de 4 y 8. */
export const Spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
  xxxl: 48,
} as const;

export const Radius = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  pildora: 999,
} as const;

/** Mínimo tocable: 48 en Android. */
export const TocableMinimo = 48;

export const IconSize = {
  sm: 18,
  md: 24,
  lg: 28,
} as const;
