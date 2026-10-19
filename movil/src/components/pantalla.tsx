import type { ReactNode } from 'react';
import { StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

/** Marco de cada sección: fondo del tema, margen seguro arriba y título grande. */
export function Pantalla({ titulo, children }: { titulo: string; children: ReactNode }) {
  const theme = useTheme();

  return (
    <SafeAreaView edges={['top']} style={[styles.contenedor, { backgroundColor: theme.fondo }]}>
      <ThemedText type="titulo" accessibilityRole="header" style={styles.titulo}>
        {titulo}
      </ThemedText>
      {children}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  contenedor: {
    flex: 1,
  },
  titulo: {
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.lg,
    paddingBottom: Spacing.sm,
  },
});
