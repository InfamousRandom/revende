import { StyleSheet, Text, type TextProps } from 'react-native';

import { Fonts, ThemeColor } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

export type ThemedTextProps = TextProps & {
  type?: 'titulo' | 'subtitulo' | 'cuerpo' | 'cuerpoFuerte' | 'chico' | 'etiqueta' | 'precio';
  themeColor?: ThemeColor;
};

export function ThemedText({ style, type = 'cuerpo', themeColor, ...rest }: ThemedTextProps) {
  const theme = useTheme();

  return <Text style={[{ color: theme[themeColor ?? 'texto'] }, styles[type], style]} {...rest} />;
}

const styles = StyleSheet.create({
  titulo: {
    fontFamily: Fonts.extranegrita,
    fontSize: 28,
    lineHeight: 34,
    letterSpacing: -0.5,
  },
  subtitulo: {
    fontFamily: Fonts.negrita,
    fontSize: 20,
    lineHeight: 26,
  },
  cuerpo: {
    fontFamily: Fonts.regular,
    fontSize: 16,
    lineHeight: 24,
  },
  cuerpoFuerte: {
    fontFamily: Fonts.seminegrita,
    fontSize: 16,
    lineHeight: 24,
  },
  chico: {
    fontFamily: Fonts.medio,
    fontSize: 14,
    lineHeight: 20,
  },
  etiqueta: {
    fontFamily: Fonts.seminegrita,
    fontSize: 12,
    lineHeight: 16,
  },
  precio: {
    fontFamily: Fonts.negrita,
    fontSize: 18,
    lineHeight: 24,
    fontVariant: ['tabular-nums'],
  },
});
