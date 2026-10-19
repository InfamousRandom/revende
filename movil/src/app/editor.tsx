import { Image } from 'expo-image';
import { router, useLocalSearchParams } from 'expo-router';
import { ChevronLeft, Crop, Eraser, Redo2, RotateCw, Square, Trash2, Undo2 } from 'lucide-react-native';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { IconSize, Radius, Spacing, TocableMinimo } from '@/constants/theme';
import * as api from '@/datos/api';
import { useArticulos } from '@/datos/articulos';
import { PUEDE_QUITAR_FONDO, descargarFoto, girar, quitarFondo, recortar } from '@/datos/editor';
import { useEmparejado } from '@/datos/emparejado';
import { useTheme } from '@/hooks/use-theme';

/**
 * Editor de fotos (estilo SellRaze): recortar, girar, quitar fondo, deshacer y rehacer.
 * Parámetros: `operacion` (artículo), y `uri` (foto nueva) o `foto` (id de una foto guardada).
 * Al terminar se sube la foto editada; si era una foto guardada, la reemplaza (y sigue de portada).
 */
export default function Editor() {
  const p = useLocalSearchParams<{ operacion: string; uri?: string; foto?: string; portada?: string }>();
  const operacionId = Number(p.operacion);
  const fotoId = p.foto ? Number(p.foto) : null;
  const theme = useTheme();
  const { codigo } = useEmparejado();
  const { refrescar } = useArticulos();

  const [historial, setHistorial] = useState<string[]>(p.uri ? [p.uri] : []);
  const [indice, setIndice] = useState(0);
  const [png, setPng] = useState(false);
  const [ocupado, setOcupado] = useState<string | null>(fotoId != null && !p.uri ? 'Abriendo la foto…' : null);
  const [error, setError] = useState<string | null>(null);
  const actual = historial[indice];

  useEffect(() => {
    if (fotoId == null || p.uri) return;
    let vigente = true;
    descargarFoto(fotoId, codigo)
      .then((uri) => {
        if (!vigente) return;
        setHistorial([uri]);
        setOcupado(null);
      })
      .catch((e: unknown) => {
        if (!vigente) return;
        setOcupado(null);
        setError(e instanceof Error ? e.message : 'No se pudo abrir la foto.');
      });
    return () => {
      vigente = false;
    };
  }, [fotoId, p.uri, codigo]);

  const aplicar = async (etiqueta: string, op: (uri: string) => Promise<string>, resultaPng = png) => {
    if (!actual || ocupado) return;
    setOcupado(etiqueta);
    setError(null);
    try {
      const nuevo = await op(actual);
      setHistorial((h) => [...h.slice(0, indice + 1), nuevo]);
      setIndice((i) => i + 1);
      setPng(resultaPng);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo editar la foto.');
    } finally {
      setOcupado(null);
    }
  };

  const terminar = async () => {
    if (!actual || ocupado) return;
    // Sin cambios en una foto guardada: no hay nada que subir.
    if (fotoId != null && indice === 0) return router.back();
    setOcupado('Guardando…');
    const subida = await api.subirFoto(operacionId, actual, png ? 'image/png' : 'image/jpeg');
    if (!subida.ok) {
      setOcupado(null);
      return setError(subida.error);
    }
    if (fotoId != null) {
      if (p.portada === '1') await api.hacerPortada(subida.datos.foto.id);
      await api.borrarFoto(fotoId);
    }
    await refrescar(operacionId);
    setOcupado(null);
    router.back();
  };

  const descartar = async () => {
    if (fotoId != null) {
      setOcupado('Borrando…');
      await api.borrarFoto(fotoId);
      await refrescar(operacionId);
      setOcupado(null);
    }
    router.back();
  };

  return (
    <SafeAreaView style={[styles.contenedor, { backgroundColor: '#000' }]}>
      <View style={styles.arriba}>
        <BotonOscuro etiqueta="Regresar sin guardar" Icono={ChevronLeft} onPress={() => router.back()} />
        <View style={styles.deshacer}>
          <BotonOscuro etiqueta="Deshacer" Icono={Undo2} disabled={indice === 0} onPress={() => setIndice((i) => i - 1)} />
          <BotonOscuro
            etiqueta="Rehacer"
            Icono={Redo2}
            disabled={indice >= historial.length - 1}
            onPress={() => setIndice((i) => i + 1)}
          />
        </View>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Listo"
          onPress={terminar}
          style={({ pressed }) => [styles.listo, { opacity: pressed || ocupado ? 0.6 : 1 }]}>
          <ThemedText type="cuerpoFuerte" style={{ color: '#000' }}>
            Listo
          </ThemedText>
        </Pressable>
      </View>

      <View style={styles.lienzo}>
        {actual ? <Image source={{ uri: actual }} style={styles.imagen} contentFit="contain" /> : null}
        {ocupado ? (
          <View style={styles.ocupado}>
            <ActivityIndicator color="#FFFFFF" />
            <ThemedText style={{ color: '#FFFFFF' }}>{ocupado}</ThemedText>
          </View>
        ) : null}
      </View>

      {error ? (
        <ThemedText type="chico" accessibilityRole="alert" style={[styles.error, { color: theme.peligro }]}>
          {error}
        </ThemedText>
      ) : null}

      <View style={styles.herramientas}>
        <Herramienta texto="Cuadrado" Icono={Square} onPress={() => aplicar('Recortando…', (u) => recortar(u, 'cuadrado', png))} />
        <Herramienta texto="Vertical" Icono={Crop} onPress={() => aplicar('Recortando…', (u) => recortar(u, 'vertical', png))} />
        <Herramienta texto="Girar" Icono={RotateCw} onPress={() => aplicar('Girando…', (u) => girar(u, png))} />
        {PUEDE_QUITAR_FONDO ? (
          <Herramienta texto="Quitar fondo" Icono={Eraser} onPress={() => aplicar('Quitando el fondo…', quitarFondo, true)} />
        ) : null}
        <Herramienta texto={fotoId != null ? 'Borrar' : 'Descartar'} Icono={Trash2} peligro onPress={descartar} />
      </View>
    </SafeAreaView>
  );
}

function BotonOscuro({
  etiqueta,
  Icono,
  onPress,
  disabled,
}: {
  etiqueta: string;
  Icono: React.ComponentType<{ size?: number; color?: string }>;
  onPress: () => void;
  disabled?: boolean;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={etiqueta}
      aria-disabled={disabled}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [styles.circular, { opacity: disabled ? 0.35 : pressed ? 0.6 : 1 }]}>
      <Icono size={IconSize.md} color="#FFFFFF" />
    </Pressable>
  );
}

function Herramienta({
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
  const color = peligro ? '#F87171' : '#FFFFFF';
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={texto} onPress={onPress} style={({ pressed }) => [styles.herramienta, { opacity: pressed ? 0.6 : 1 }]}>
      <View style={styles.iconoHerramienta}>
        <Icono size={IconSize.md} color={color} />
      </View>
      <ThemedText type="etiqueta" style={{ color }}>
        {texto}
      </ThemedText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  contenedor: {
    flex: 1,
  },
  arriba: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: Spacing.lg,
  },
  deshacer: {
    flexDirection: 'row',
    gap: Spacing.sm,
  },
  circular: {
    width: TocableMinimo,
    height: TocableMinimo,
    borderRadius: Radius.pildora,
    backgroundColor: 'rgba(255,255,255,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  listo: {
    minHeight: TocableMinimo,
    paddingHorizontal: Spacing.xl,
    borderRadius: Radius.pildora,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  lienzo: {
    flex: 1,
    marginHorizontal: Spacing.lg,
    // Cuadros grises para que se note la transparencia al quitar el fondo.
    backgroundColor: '#1E2640',
    borderRadius: Radius.lg,
    overflow: 'hidden',
  },
  imagen: {
    flex: 1,
  },
  ocupado: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    backgroundColor: 'rgba(0,0,0,0.55)',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
  },
  error: {
    textAlign: 'center',
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.sm,
  },
  herramientas: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.lg,
  },
  herramienta: {
    alignItems: 'center',
    gap: Spacing.xs,
    minWidth: 64,
  },
  iconoHerramienta: {
    width: 52,
    height: 52,
    borderRadius: Radius.lg,
    backgroundColor: 'rgba(255,255,255,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
