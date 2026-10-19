import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

/** Marco de cada sección: fondo del tema, margen seguro arriba, título grande y una acción opcional. */
export function Pantalla({ titulo, accion, children }: { titulo: string; accion?: ReactNode; children: ReactNode }) {
  const theme = useTheme();

  return (
    <SafeAreaView edges={['top']} style={[styles.contenedor, { backgroundColor: theme.fondo }]}>
      <View style={styles.encabezado}>
        <ThemedText type="titulo" accessibilityRole="header" style={{ flex: 1 }}>
          {titulo}
        </ThemedText>
        {accion}
      </View>
      {children}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  contenedor: {
    flex: 1,
  },
  encabezado: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.lg,
    paddingBottom: Spacing.sm,
    gap: Spacing.md,
  },
});
