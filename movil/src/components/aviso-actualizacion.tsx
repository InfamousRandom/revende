/**
 * Las actualizaciones (EAS Update) se descargan solas al abrir la app. Cuando una está lista, este
 * aviso permite aplicarla en el momento en vez de esperar a la próxima vez que se abra.
 */
import * as Updates from 'expo-updates';
import { RefreshCw } from 'lucide-react-native';
import { Pressable, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { IconSize, Radius, Spacing, TocableMinimo } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

export function AvisoActualizacion() {
  const { isUpdatePending } = Updates.useUpdates();
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  if (!isUpdatePending) return null;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="Hay una versión nueva de Revende. Toca para actualizar"
      onPress={() => void Updates.reloadAsync()}
      style={({ pressed }) => [
        styles.aviso,
        { backgroundColor: theme.primario, top: insets.top + Spacing.sm, opacity: pressed ? 0.8 : 1 },
      ]}>
      <RefreshCw size={IconSize.sm} color={theme.sobrePrimario} />
      <ThemedText type="cuerpoFuerte" style={{ color: theme.sobrePrimario, flex: 1 }}>
        Versión nueva lista. Toca para actualizar
      </ThemedText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  aviso: {
    position: 'absolute',
    left: Spacing.lg,
    right: Spacing.lg,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    minHeight: TocableMinimo,
    paddingHorizontal: Spacing.lg,
    borderRadius: Radius.pildora,
  },
});
