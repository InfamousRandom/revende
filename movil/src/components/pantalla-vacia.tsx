import type { LucideIcon } from 'lucide-react-native';
import { StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { IconSize, Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

type Props = {
  Icono: LucideIcon;
  titulo: string;
  texto: string;
};

/** Estado vacío de una sección: qué va a aparecer aquí y cómo empezar. */
export function PantallaVacia({ Icono, titulo, texto }: Props) {
  const theme = useTheme();

  return (
    <View style={styles.contenedor}>
      <View style={[styles.circulo, { backgroundColor: theme.superficie }]}>
        <Icono size={IconSize.lg} color={theme.textoSecundario} />
      </View>
      <ThemedText type="subtitulo" style={styles.centrado}>
        {titulo}
      </ThemedText>
      <ThemedText themeColor="textoSecundario" style={styles.centrado}>
        {texto}
      </ThemedText>
    </View>
  );
}

const styles = StyleSheet.create({
  contenedor: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Spacing.xxl,
    gap: Spacing.md,
  },
  circulo: {
    width: 72,
    height: 72,
    borderRadius: Radius.pildora,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.sm,
  },
  centrado: {
    textAlign: 'center',
    maxWidth: 320,
  },
});
