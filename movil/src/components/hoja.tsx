/** Hoja que sube desde abajo (como en SellRaze) para capturas rápidas y menús de acciones. */
import { X } from 'lucide-react-native';
import type { ReactNode } from 'react';
import { KeyboardAvoidingView, Modal, Platform, Pressable, StyleSheet, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { Fonts, IconSize, Radius, Spacing, TocableMinimo } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

export function Hoja({
  visible,
  titulo,
  onCerrar,
  children,
}: {
  visible: boolean;
  titulo: string;
  onCerrar: () => void;
  children: ReactNode;
}) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onCerrar} statusBarTranslucent>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.fondo}>
        <Pressable accessibilityLabel="Cerrar" style={[StyleSheet.absoluteFill, { backgroundColor: theme.velo }]} onPress={onCerrar} />
        <View
          style={[styles.hoja, { backgroundColor: theme.fondo, paddingBottom: Math.max(insets.bottom, Spacing.lg) }]}
          accessibilityViewIsModal>
          <View style={[styles.agarradera, { backgroundColor: theme.borde }]} />
          <View style={styles.encabezado}>
            <ThemedText type="subtitulo" accessibilityRole="header" style={{ flex: 1 }}>
              {titulo}
            </ThemedText>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Cerrar"
              onPress={onCerrar}
              hitSlop={8}
              style={({ pressed }) => [styles.cerrar, { backgroundColor: theme.superficie, opacity: pressed ? 0.6 : 1 }]}>
              <X size={IconSize.sm} color={theme.texto} />
            </Pressable>
          </View>
          {children}
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

/** Campo de pesos con etiqueta visible (solo dígitos). */
export function CampoPesos({
  etiqueta,
  valor,
  onCambio,
  autoFocus,
}: {
  etiqueta: string;
  valor: string;
  onCambio: (v: string) => void;
  autoFocus?: boolean;
}) {
  const theme = useTheme();
  return (
    <View style={{ gap: Spacing.xs }}>
      <ThemedText type="chico" themeColor="textoSecundario">
        {etiqueta}
      </ThemedText>
      <View style={[styles.campo, { borderColor: theme.borde, backgroundColor: theme.superficie }]}>
        <ThemedText themeColor="textoTenue">$</ThemedText>
        <TextInput
          accessibilityLabel={etiqueta}
          value={valor}
          onChangeText={(t) => onCambio(t.replace(/\D/g, ''))}
          keyboardType="number-pad"
          inputMode="numeric"
          autoFocus={autoFocus}
          style={[styles.entrada, { color: theme.texto }]}
        />
      </View>
    </View>
  );
}

/** Fila tocable de un menú de acciones; `peligro` la pinta en rojo (borrar). */
export function OpcionMenu({
  texto,
  Icono,
  onPress,
  peligro,
}: {
  texto: string;
  Icono: React.ComponentType<{ size?: number; color?: string }>;
  onPress: () => void;
  peligro?: boolean;
}) {
  const theme = useTheme();
  const color = peligro ? theme.peligro : theme.texto;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={texto}
      onPress={onPress}
      style={({ pressed }) => [styles.opcion, { backgroundColor: theme.superficie, opacity: pressed ? 0.7 : 1 }]}>
      <Icono size={IconSize.md} color={color} />
      <ThemedText type="cuerpoFuerte" style={{ color }}>
        {texto}
      </ThemedText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  fondo: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  hoja: {
    borderTopLeftRadius: Radius.xl,
    borderTopRightRadius: Radius.xl,
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.sm,
    gap: Spacing.lg,
  },
  agarradera: {
    alignSelf: 'center',
    width: 40,
    height: 4,
    borderRadius: Radius.pildora,
  },
  encabezado: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
  },
  cerrar: {
    width: 40,
    height: 40,
    borderRadius: Radius.pildora,
    alignItems: 'center',
    justifyContent: 'center',
  },
  campo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    minHeight: TocableMinimo,
    borderWidth: 1,
    borderRadius: Radius.md,
    paddingHorizontal: Spacing.md,
  },
  entrada: {
    flex: 1,
    fontFamily: Fonts.seminegrita,
    fontSize: 18,
    minHeight: TocableMinimo,
  },
  opcion: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    minHeight: TocableMinimo + 8,
    borderRadius: Radius.md,
    paddingHorizontal: Spacing.lg,
  },
});
