import { router } from 'expo-router';
import { TabTrigger, type TabTriggerSlotProps } from 'expo-router/ui';
import { ChartColumn, Package, Plus, ReceiptText, Search, type LucideIcon } from 'lucide-react-native';
import { Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { IconSize, Spacing, TocableMinimo } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

type Seccion = { name: string; href: '/' | '/buscar' | '/historial' | '/estadisticas'; etiqueta: string; Icono: LucideIcon };

const IZQUIERDA: Seccion[] = [
  { name: 'inventario', href: '/', etiqueta: 'Inventario', Icono: Package },
  { name: 'buscar', href: '/buscar', etiqueta: 'Buscar', Icono: Search },
];
const DERECHA: Seccion[] = [
  { name: 'historial', href: '/historial', etiqueta: 'Historial', Icono: ReceiptText },
  { name: 'estadisticas', href: '/estadisticas', etiqueta: 'Estadísticas', Icono: ChartColumn },
];

/** Barra de 5: cuatro secciones y el botón ＋ al centro, que abre la cámara encima. */
export function BarraInferior() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();

  return (
    <View
      style={[
        styles.barra,
        { backgroundColor: theme.fondo, borderTopColor: theme.borde, paddingBottom: Math.max(insets.bottom, Spacing.sm) },
      ]}>
      {IZQUIERDA.map((s) => (
        <TabTrigger key={s.name} name={s.name} href={s.href} asChild>
          <BotonSeccion etiqueta={s.etiqueta} Icono={s.Icono} />
        </TabTrigger>
      ))}

      <View style={styles.centro}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Agregar artículo con la cámara"
          onPress={() => router.push('/capturar')}
          style={({ pressed }) => [
            styles.botonMas,
            { backgroundColor: theme.primario, transform: [{ scale: pressed ? 0.95 : 1 }] },
          ]}>
          <Plus size={IconSize.lg} color={theme.sobrePrimario} strokeWidth={2.5} />
        </Pressable>
      </View>

      {DERECHA.map((s) => (
        <TabTrigger key={s.name} name={s.name} href={s.href} asChild>
          <BotonSeccion etiqueta={s.etiqueta} Icono={s.Icono} />
        </TabTrigger>
      ))}
    </View>
  );
}

// La ref que inyecta TabTrigger no hace falta aquí y su tipo no coincide con el de Pressable.
type BotonSeccionProps = Omit<TabTriggerSlotProps, 'ref'> & { etiqueta: string; Icono: LucideIcon };

function BotonSeccion({ etiqueta, Icono, isFocused, ref: _ref, ...props }: BotonSeccionProps & { ref?: unknown }) {
  const theme = useTheme();
  const color = isFocused ? theme.texto : theme.textoTenue;

  return (
    <Pressable
      {...props}
      accessibilityRole="tab"
      accessibilityLabel={etiqueta}
      aria-selected={isFocused}
      style={({ pressed }) => [styles.seccion, pressed && styles.presionado]}>
      <Icono size={IconSize.md} color={color} strokeWidth={isFocused ? 2.25 : 1.75} />
      <ThemedText type="etiqueta" numberOfLines={1} style={{ color }}>
        {etiqueta}
      </ThemedText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  barra: {
    flexDirection: 'row',
    alignItems: 'center',
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingTop: Spacing.sm,
    paddingHorizontal: Spacing.xs,
  },
  seccion: {
    flex: 1,
    minHeight: TocableMinimo,
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.xs,
  },
  presionado: {
    opacity: 0.6,
  },
  centro: {
    flex: 1,
    alignItems: 'center',
  },
  botonMas: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
