/** Piezas reutilizables de la interfaz: miniatura, píldoras, tarjeta, botones y avisos. */
import {
  Disc3,
  FlaskConical,
  Footprints,
  Gamepad2,
  Headphones,
  Layers,
  Shirt,
  ToyBrick,
  type LucideIcon,
} from 'lucide-react-native';
import type { ReactNode } from 'react';
import { Pressable, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import type { Categoria, Estado } from '@/datos/tipos';
import { NOMBRE_ESTADO } from '@/datos/tipos';
import { IconSize, Radius, Spacing, TocableMinimo } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

const ICONO_CATEGORIA: Record<Categoria, LucideIcon> = {
  consolas: Gamepad2,
  videojuegos: Disc3,
  ropa: Shirt,
  tenis: Footprints,
  electronica: Headphones,
  juguetes: ToyBrick,
  cartas: Layers,
};

/** Lugar de la foto. Mientras no hay fotos reales, muestra el ícono de la categoría. */
export function Miniatura({ categoria, tamano = 'grande' }: { categoria: Categoria; tamano?: 'grande' | 'chica' }) {
  const theme = useTheme();
  const Icono = ICONO_CATEGORIA[categoria];
  const chica = tamano === 'chica';

  return (
    <View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={[
        chica ? styles.miniaturaChica : styles.miniaturaGrande,
        { backgroundColor: theme.superficieAlta },
      ]}>
      <Icono size={chica ? IconSize.md : 40} color={theme.textoTenue} strokeWidth={1.5} />
    </View>
  );
}

export function Pildora({
  texto,
  activa,
  onPress,
  cuenta,
}: {
  texto: string;
  activa: boolean;
  onPress: () => void;
  cuenta?: number;
}) {
  const theme = useTheme();

  return (
    <Pressable
      accessibilityRole="button"
      aria-selected={activa}
      onPress={onPress}
      style={({ pressed }) => [
        styles.pildora,
        { backgroundColor: activa ? theme.texto : theme.superficie, opacity: pressed ? 0.7 : 1 },
      ]}>
      <ThemedText type="chico" style={{ color: activa ? theme.fondo : theme.texto }}>
        {texto}
        {cuenta != null ? `  ${cuenta}` : ''}
      </ThemedText>
    </Pressable>
  );
}

export function Tarjeta({ children, style }: { children: ReactNode; style?: StyleProp<ViewStyle> }) {
  const theme = useTheme();
  return <View style={[styles.tarjeta, { backgroundColor: theme.superficie }, style]}>{children}</View>;
}

export function Boton({
  texto,
  onPress,
  variante = 'primario',
  Icono,
}: {
  texto: string;
  onPress: () => void;
  variante?: 'primario' | 'secundario';
  Icono?: LucideIcon;
}) {
  const theme = useTheme();
  const primario = variante === 'primario';
  const color = primario ? theme.sobrePrimario : theme.texto;

  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [
        styles.boton,
        primario
          ? { backgroundColor: theme.primario }
          : { backgroundColor: theme.superficie, borderColor: theme.borde, borderWidth: 1 },
        { transform: [{ scale: pressed ? 0.97 : 1 }] },
      ]}>
      {Icono ? <Icono size={IconSize.sm} color={color} /> : null}
      <ThemedText type="cuerpoFuerte" style={{ color }}>
        {texto}
      </ThemedText>
    </Pressable>
  );
}

/** Etiqueta del estado de un artículo. El color no es el único indicador: siempre lleva texto. */
export function EtiquetaEstado({ estado }: { estado: Estado }) {
  const theme = useTheme();
  const fondo = estado === 'vendido' ? theme.dinero : estado === 'publicado' ? theme.primario : theme.superficieAlta;
  const texto =
    estado === 'vendido' ? theme.sobreDinero : estado === 'publicado' ? theme.sobrePrimario : theme.textoSecundario;

  return (
    <View style={[styles.etiqueta, { backgroundColor: fondo }]}>
      <ThemedText type="etiqueta" style={{ color: texto }}>
        {NOMBRE_ESTADO[estado]}
      </ThemedText>
    </View>
  );
}

/** Etiqueta amarilla-lima para lo destacado ("SUGERIDO"). */
export function Destacado({ texto }: { texto: string }) {
  const theme = useTheme();
  return (
    <View style={[styles.etiqueta, { backgroundColor: theme.destacado }]}>
      <ThemedText type="etiqueta" style={{ color: theme.sobreDestacado }}>
        {texto}
      </ThemedText>
    </View>
  );
}

/** Aviso visible mientras la app muestra datos inventados. */
export function AvisoEjemplo() {
  const theme = useTheme();
  return (
    <View style={[styles.aviso, { borderColor: theme.destacado }]}>
      <FlaskConical size={IconSize.sm} color={theme.texto} />
      <ThemedText type="chico" style={{ flex: 1 }}>
        Datos de ejemplo, inventados. Solo para ver cómo se ve la app.
      </ThemedText>
    </View>
  );
}

const styles = StyleSheet.create({
  miniaturaGrande: {
    aspectRatio: 1,
    width: '100%',
    borderRadius: Radius.lg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  miniaturaChica: {
    width: 56,
    height: 56,
    borderRadius: Radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pildora: {
    minHeight: 40,
    paddingHorizontal: Spacing.lg,
    borderRadius: Radius.pildora,
    justifyContent: 'center',
  },
  tarjeta: {
    borderRadius: Radius.lg,
    padding: Spacing.lg,
  },
  boton: {
    minHeight: TocableMinimo + 4,
    borderRadius: Radius.pildora,
    paddingHorizontal: Spacing.xl,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
  },
  etiqueta: {
    alignSelf: 'flex-start',
    paddingHorizontal: Spacing.sm,
    paddingVertical: 2,
    borderRadius: Radius.sm,
  },
  aviso: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    marginHorizontal: Spacing.lg,
    marginBottom: Spacing.sm,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderStyle: 'dashed',
  },
});
