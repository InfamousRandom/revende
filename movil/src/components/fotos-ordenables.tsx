/**
 * Tira de fotos de un artículo. Toque: opciones de la foto. Mantener presionada y arrastrar: cambiarla
 * de lugar (la primera es la portada).
 */
import { Image } from 'expo-image';
import type { ReactNode } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { GestureDetector, usePanGesture } from 'react-native-gesture-handler';
import Animated, { useAnimatedStyle, useSharedValue, withTiming, type SharedValue } from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';

import { ThemedText } from '@/components/themed-text';
import { Radius, Spacing } from '@/constants/theme';
import { fuenteFoto } from '@/datos/api';
import type { Foto } from '@/datos/tipos';
import { useTheme } from '@/hooks/use-theme';

const TAMANO = 72;
const PASO = TAMANO + Spacing.sm;

/** Índice al que llega una foto arrastrada `tx` puntos desde `desde`. */
function destino(desde: number, tx: number, total: number) {
  'worklet';
  return Math.min(total - 1, Math.max(0, desde + Math.round(tx / PASO)));
}

export function FotosOrdenables({
  fotos,
  codigo,
  onTocar,
  onReordenar,
  children,
}: {
  fotos: Foto[];
  codigo: string | null;
  onTocar: (foto: Foto) => void;
  /** Ids en el nuevo orden. */
  onReordenar: (ids: number[]) => void;
  /** Lo que va al final de la tira (el botón para agregar). */
  children?: ReactNode;
}) {
  const arrastrada = useSharedValue(-1);
  const tx = useSharedValue(0);

  const mover = (de: number, a: number) => {
    if (de === a) return;
    const nuevo = [...fotos];
    const [f] = nuevo.splice(de, 1);
    nuevo.splice(a, 0, f);
    onReordenar(nuevo.map((x) => x.id));
  };

  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tira}>
      {fotos.map((f, i) => (
        <FotoArrastrable
          key={f.id}
          foto={f}
          indice={i}
          total={fotos.length}
          codigo={codigo}
          arrastrada={arrastrada}
          tx={tx}
          onTocar={onTocar}
          onSoltar={mover}
        />
      ))}
      {children}
    </ScrollView>
  );
}

function FotoArrastrable({
  foto,
  indice,
  total,
  codigo,
  arrastrada,
  tx,
  onTocar,
  onSoltar,
}: {
  foto: Foto;
  indice: number;
  total: number;
  codigo: string | null;
  arrastrada: SharedValue<number>;
  tx: SharedValue<number>;
  onTocar: (foto: Foto) => void;
  onSoltar: (de: number, a: number) => void;
}) {
  const theme = useTheme();

  const gesto = usePanGesture({
    activateAfterLongPress: 250,
    onActivate: () => {
      arrastrada.set(indice);
      tx.set(0);
    },
    onUpdate: (e) => {
      tx.set(e.translationX);
    },
    onDeactivate: (e) => {
      const a = destino(indice, e.translationX, total);
      arrastrada.set(-1);
      tx.set(0);
      scheduleOnRN(onSoltar, indice, a);
    },
  });

  const estilo = useAnimatedStyle(() => {
    const d = arrastrada.get();
    if (d === indice) return { zIndex: 10, transform: [{ translateX: tx.get() }, { scale: 1.08 }] };
    let corrimiento = 0;
    if (d >= 0) {
      const a = destino(d, tx.get(), total);
      if (d < indice && indice <= a) corrimiento = -PASO;
      else if (a <= indice && indice < d) corrimiento = PASO;
    }
    return { zIndex: 0, transform: [{ translateX: withTiming(corrimiento, { duration: 120 }) }, { scale: 1 }] };
  });

  return (
    <GestureDetector gesture={gesto}>
      <Animated.View style={estilo}>
        {/* Toque corto: opciones. El arrastre solo se activa al mantener presionado. */}
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={indice === 0 ? 'Foto de portada' : `Foto ${indice + 1}`}
          accessibilityHint="Mantén presionada y arrastra para cambiarla de lugar"
          onPress={() => onTocar(foto)}>
          <Image source={fuenteFoto(foto.id, codigo)} style={styles.foto} contentFit="cover" />
          {indice === 0 ? (
            <View style={[styles.portada, { backgroundColor: theme.destacado }]}>
              <ThemedText type="etiqueta" style={{ color: theme.sobreDestacado }}>
                Portada
              </ThemedText>
            </View>
          ) : null}
        </Pressable>
      </Animated.View>
    </GestureDetector>
  );
}

const styles = StyleSheet.create({
  tira: {
    gap: Spacing.sm,
    paddingHorizontal: Spacing.lg,
  },
  foto: {
    width: TAMANO,
    height: TAMANO,
    borderRadius: Radius.md,
  },
  portada: {
    position: 'absolute',
    left: 4,
    bottom: 4,
    paddingHorizontal: 4,
    borderRadius: Radius.sm,
  },
});
