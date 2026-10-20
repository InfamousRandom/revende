/** Búsquedas guardadas sin señal, con su estado. Al estar listas se abre su resultado ya buscado. */
import { Image } from 'expo-image';
import { router } from 'expo-router';
import { Barcode, ChevronRight, Search, WifiOff, X } from 'lucide-react-native';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { IconSize, Radius, Spacing } from '@/constants/theme';
import { quitarPendiente, textoDeEntrada, usePendientes, type Pendiente } from '@/datos/pendientes';
import { useTheme } from '@/hooks/use-theme';

export function ListaPendientes() {
  const theme = useTheme();
  const pendientes = usePendientes();
  if (!pendientes.length) return null;
  const esperando = pendientes.filter((p) => p.estado === 'esperando').length;

  return (
    <View style={styles.contenedor}>
      <View style={styles.titulo}>
        <WifiOff size={IconSize.sm} color={theme.textoSecundario} />
        <ThemedText type="cuerpoFuerte">Guardadas sin señal ({pendientes.length})</ThemedText>
      </View>
      {esperando ? (
        <ThemedText type="chico" themeColor="textoTenue">
          Se buscan solas cuando vuelva el internet.
        </ThemedText>
      ) : null}
      {pendientes.map((p) => (
        <Fila key={p.id} p={p} />
      ))}
    </View>
  );
}

function Fila({ p }: { p: Pendiente }) {
  const theme = useTheme();
  const listo = p.estado === 'listo' && p.resultado;
  const detalle =
    p.estado === 'listo'
      ? 'Listo: toca para ver precios'
      : p.estado === 'buscando'
        ? 'Buscando…'
        : p.estado === 'error'
          ? (p.error ?? 'No se encontró')
          : 'Esperando señal';

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${p.resultado?.nombre ?? textoDeEntrada(p.entrada)}, ${detalle}`}
      disabled={!listo}
      onPress={() => router.push({ pathname: '/resultado', params: { pendiente: p.id } })}
      style={({ pressed }) => [styles.fila, { backgroundColor: theme.superficie, opacity: pressed ? 0.75 : 1 }]}>
      {p.entrada.tipo === 'foto' ? (
        <Image source={{ uri: p.entrada.uri }} style={styles.miniatura} contentFit="cover" />
      ) : (
        <View style={[styles.miniatura, styles.icono, { backgroundColor: theme.superficieAlta }]}>
          {p.entrada.tipo === 'codigo' ? (
            <Barcode size={IconSize.md} color={theme.textoSecundario} />
          ) : (
            <Search size={IconSize.md} color={theme.textoSecundario} />
          )}
        </View>
      )}
      <View style={{ flex: 1, gap: 2 }}>
        <ThemedText type="cuerpoFuerte" numberOfLines={1}>
          {p.resultado?.nombre ?? textoDeEntrada(p.entrada)}
        </ThemedText>
        <ThemedText type="chico" numberOfLines={2} style={{ color: p.estado === 'error' ? theme.peligro : theme.textoTenue }}>
          {detalle}
        </ThemedText>
      </View>
      {p.estado === 'buscando' ? <ActivityIndicator color={theme.primario} /> : null}
      {listo ? <ChevronRight size={IconSize.sm} color={theme.textoTenue} /> : null}
      {p.estado !== 'buscando' ? (
        <Pressable accessibilityRole="button" accessibilityLabel="Quitar" hitSlop={8} onPress={() => quitarPendiente(p.id)} style={styles.quitar}>
          <X size={IconSize.sm} color={theme.textoTenue} />
        </Pressable>
      ) : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  contenedor: {
    gap: Spacing.sm,
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.lg,
  },
  titulo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  fila: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    borderRadius: Radius.md,
    padding: Spacing.md,
  },
  miniatura: {
    width: 48,
    height: 48,
    borderRadius: Radius.md,
  },
  icono: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  quitar: {
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
