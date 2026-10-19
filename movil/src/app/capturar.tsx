import { CameraView, useCameraPermissions, type BarcodeScanningResult } from 'expo-camera';
import * as ImagePicker from 'expo-image-picker';
import { router } from 'expo-router';
import { Camera, FlaskConical, Grid3x3, Images, Layers, PencilLine, RefreshCw, X } from 'lucide-react-native';
import { useRef, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { PantallaVacia } from '@/components/pantalla-vacia';
import { ThemedText } from '@/components/themed-text';
import { Boton } from '@/components/ui';
import { IconSize, Radius, Spacing, TocableMinimo } from '@/constants/theme';
import { USAR_DATOS_DE_EJEMPLO } from '@/datos/ejemplo';
import { datosDeCarta, leerEtiqueta, reducirFoto } from '@/datos/escaneo';
import { agregarAlLote, useLote } from '@/datos/lote';
import { useTheme } from '@/hooks/use-theme';

export type Modo = 'identificar' | 'codigo' | 'lote' | 'cartas';
const MODOS: { id: Modo; nombre: string; ayuda: string }[] = [
  { id: 'identificar', nombre: 'IDENTIFICAR', ayuda: 'Tómale foto y te decimos qué es y cuánto vale' },
  { id: 'codigo', nombre: 'CÓDIGO', ayuda: 'Apunta al código de barras' },
  { id: 'lote', nombre: 'LOTE', ayuda: 'Toma una foto o lee el código de cada artículo; al final buscamos todos' },
  { id: 'cartas', nombre: 'CARTAS', ayuda: 'Foto de la carta Pokémon completa, con el nombre y el número visibles' },
];
const CODIGOS = ['ean13', 'ean8', 'upc_a', 'upc_e'] as const;

/** Cámara a pantalla completa (estilo SellRaze): foto para identificar o lectura de código de barras. */
export default function Capturar() {
  const theme = useTheme();
  const [permiso, pedirPermiso] = useCameraPermissions();
  const camara = useRef<CameraView>(null);
  const [modo, setModo] = useState<Modo>('identificar');
  const [frontal, setFrontal] = useState(false);
  const [cuadricula, setCuadricula] = useState(false);
  const [ocupado, setOcupado] = useState(false);
  const leido = useRef(false);
  const lote = useLote();
  const [agregado, setAgregado] = useState<string | null>(null);

  const avisarAgregado = (texto: string) => {
    setAgregado(texto);
    setTimeout(() => setAgregado(null), 1200);
  };

  const irAResultado = (params: { foto?: string; codigo?: string }) => router.replace({ pathname: '/resultado', params });

  const tomarFoto = async () => {
    if (ocupado || !camara.current) return;
    setOcupado(true);
    try {
      const foto = await camara.current.takePictureAsync({ quality: 0.8 });
      if (!foto?.uri) return;
      if (modo === 'lote') {
        agregarAlLote({ tipo: 'foto', uri: foto.uri });
        avisarAgregado(`Agregado al lote (${lote.length + 1})`);
      } else if (modo === 'cartas') {
        avisarAgregado('Leyendo la carta…');
        const datos = datosDeCarta(await leerEtiqueta(await reducirFoto(foto.uri)));
        router.replace({ pathname: '/cartas', params: datos });
      } else {
        irAResultado({ foto: foto.uri });
      }
    } finally {
      setOcupado(false);
    }
  };

  const desdeGaleria = async () => {
    const r = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.8 });
    if (!r.canceled && r.assets[0]) irAResultado({ foto: r.assets[0].uri });
  };

  const alLeerCodigo = ({ data }: BarcodeScanningResult) => {
    if (leido.current || !/^\d{8,14}$/.test(data)) return;
    if (modo === 'lote') {
      if (agregarAlLote({ tipo: 'codigo', codigo: data })) avisarAgregado(`Código ${data} agregado (${lote.length + 1})`);
      return;
    }
    leido.current = true;
    irAResultado({ codigo: data });
  };

  const cerrar = (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="Cerrar"
      onPress={() => router.back()}
      hitSlop={8}
      style={({ pressed }) => [styles.circular, { opacity: pressed ? 0.6 : 1 }]}>
      <X size={IconSize.md} color="#FFFFFF" />
    </Pressable>
  );

  if (!permiso) return <View style={[styles.contenedor, { backgroundColor: '#000' }]} />;

  if (!permiso.granted) {
    return (
      <SafeAreaView style={[styles.contenedor, { backgroundColor: theme.fondo }]}>
        <View style={styles.arriba}>{cerrar}</View>
        <PantallaVacia
          Icono={Camera}
          titulo="Permite usar la cámara"
          texto="La necesitamos para tomarle foto a los artículos y leer códigos de barras. Las fotos solo se usan para buscar precios."
        />
        <View style={styles.opcionesSinCamara}>
          <Boton texto="Permitir cámara" Icono={Camera} onPress={pedirPermiso} />
          <Boton texto="Elegir foto de la galería" variante="secundario" Icono={Images} onPress={desdeGaleria} />
          <Boton texto="Registrar sin foto" variante="secundario" Icono={PencilLine} onPress={() => router.replace('/registrar')} />
        </View>
      </SafeAreaView>
    );
  }

  const ayuda = MODOS.find((m) => m.id === modo)?.ayuda ?? '';

  return (
    <View style={[styles.contenedor, { backgroundColor: '#000' }]}>
      <CameraView
        ref={camara}
        style={StyleSheet.absoluteFill}
        facing={frontal ? 'front' : 'back'}
        barcodeScannerSettings={{ barcodeTypes: [...CODIGOS] }}
        onBarcodeScanned={modo === 'codigo' || modo === 'lote' ? alLeerCodigo : undefined}
      />

      {cuadricula ? (
        <View pointerEvents="none" style={StyleSheet.absoluteFill}>
          {[1, 2].map((i) => (
            <View key={`v${i}`} style={[styles.lineaV, { left: `${(i * 100) / 3}%` }]} />
          ))}
          {[1, 2].map((i) => (
            <View key={`h${i}`} style={[styles.lineaH, { top: `${(i * 100) / 3}%` }]} />
          ))}
        </View>
      ) : null}

      <View pointerEvents="none" style={styles.guia}>
        <View style={[styles.esquina, styles.esqSI]} />
        <View style={[styles.esquina, styles.esqSD]} />
        <View style={[styles.esquina, styles.esqII]} />
        <View style={[styles.esquina, styles.esqID]} />
      </View>

      <SafeAreaView style={styles.capa} pointerEvents="box-none">
        <View style={styles.arriba}>
          {cerrar}
          <Pressable
            accessibilityRole="switch"
            accessibilityLabel="Mostrar cuadrícula"
            aria-checked={cuadricula}
            onPress={() => setCuadricula((v) => !v)}
            hitSlop={8}
            style={({ pressed }) => [styles.circular, cuadricula && styles.circularActivo, { opacity: pressed ? 0.6 : 1 }]}>
            <Grid3x3 size={IconSize.md} color={cuadricula ? '#000000' : '#FFFFFF'} />
          </Pressable>
          <View style={{ flex: 1 }} />
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Registrar sin foto"
            onPress={() => router.replace('/registrar')}
            style={({ pressed }) => [styles.pildoraOscura, { opacity: pressed ? 0.6 : 1 }]}>
            <PencilLine size={IconSize.sm} color="#FFFFFF" />
            <ThemedText type="chico" style={{ color: '#FFFFFF' }}>
              Sin foto
            </ThemedText>
          </Pressable>
        </View>

        <View style={styles.abajo}>
          <View style={styles.globo} aria-live="polite">
            <ThemedText type="cuerpoFuerte" style={styles.textoGlobo}>
              {agregado ?? ayuda}
            </ThemedText>
          </View>

          {modo === 'lote' && lote.length ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`Ver lote, ${lote.length} artículos`}
              onPress={() => router.replace('/lote')}
              style={({ pressed }) => [styles.verLote, { backgroundColor: theme.primario, opacity: pressed ? 0.8 : 1 }]}>
              <Layers size={IconSize.sm} color="#FFFFFF" />
              <ThemedText type="cuerpoFuerte" style={{ color: '#FFFFFF' }}>
                Ver lote ({lote.length})
              </ThemedText>
            </Pressable>
          ) : null}

          <View style={styles.controles}>
            <Pressable accessibilityRole="button" accessibilityLabel="Elegir de la galería" onPress={desdeGaleria} style={styles.circularGrande}>
              <Images size={IconSize.lg} color="#FFFFFF" />
            </Pressable>
            {modo !== 'codigo' ? (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Tomar foto"
                disabled={ocupado}
                onPress={tomarFoto}
                style={({ pressed }) => [styles.disparador, { transform: [{ scale: pressed ? 0.94 : 1 }], opacity: ocupado ? 0.5 : 1 }]}>
                <View style={styles.disparadorInterior} />
              </Pressable>
            ) : (
              <View style={styles.disparadorVacio} />
            )}
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Cambiar de cámara"
              onPress={() => setFrontal((v) => !v)}
              style={styles.circularGrande}>
              <RefreshCw size={IconSize.lg} color="#FFFFFF" />
            </Pressable>
          </View>

          <View style={styles.modos} accessibilityRole="tablist">
            {MODOS.map((m) => (
              <Pressable
                key={m.id}
                accessibilityRole="tab"
                accessibilityLabel={m.nombre}
                aria-selected={modo === m.id}
                onPress={() => {
                  leido.current = false;
                  setModo(m.id);
                }}
                style={styles.modo}>
                <ThemedText type="cuerpoFuerte" style={{ color: modo === m.id ? '#FFFFFF' : 'rgba(255,255,255,0.55)' }}>
                  {m.nombre}
                </ThemedText>
              </Pressable>
            ))}
            {USAR_DATOS_DE_EJEMPLO ? (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Simular un escaneo de ejemplo"
                onPress={() => router.replace({ pathname: '/resultado', params: { consulta: 'Nintendo Switch Lite' } })}
                style={styles.modo}>
                <FlaskConical size={IconSize.sm} color={theme.destacado} />
              </Pressable>
            ) : null}
          </View>
        </View>
      </SafeAreaView>
    </View>
  );
}

const BLANCO_TRANSLUCIDO = 'rgba(255,255,255,0.35)';
const NEGRO_TRANSLUCIDO = 'rgba(0,0,0,0.45)';

const styles = StyleSheet.create({
  contenedor: {
    flex: 1,
  },
  capa: {
    flex: 1,
    justifyContent: 'space-between',
  },
  arriba: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    padding: Spacing.lg,
  },
  circular: {
    width: TocableMinimo,
    height: TocableMinimo,
    borderRadius: Radius.pildora,
    backgroundColor: NEGRO_TRANSLUCIDO,
    alignItems: 'center',
    justifyContent: 'center',
  },
  circularActivo: {
    backgroundColor: '#FFFFFF',
  },
  pildoraOscura: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    minHeight: 40,
    paddingHorizontal: Spacing.md,
    borderRadius: Radius.pildora,
    backgroundColor: NEGRO_TRANSLUCIDO,
  },
  guia: {
    position: 'absolute',
    top: '22%',
    left: '14%',
    right: '14%',
    bottom: '38%',
  },
  esquina: {
    position: 'absolute',
    width: 36,
    height: 36,
    borderColor: 'rgba(255,255,255,0.85)',
  },
  esqSI: { top: 0, left: 0, borderTopWidth: 3, borderLeftWidth: 3, borderTopLeftRadius: 14 },
  esqSD: { top: 0, right: 0, borderTopWidth: 3, borderRightWidth: 3, borderTopRightRadius: 14 },
  esqII: { bottom: 0, left: 0, borderBottomWidth: 3, borderLeftWidth: 3, borderBottomLeftRadius: 14 },
  esqID: { bottom: 0, right: 0, borderBottomWidth: 3, borderRightWidth: 3, borderBottomRightRadius: 14 },
  lineaV: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    width: StyleSheet.hairlineWidth,
    backgroundColor: BLANCO_TRANSLUCIDO,
  },
  lineaH: {
    position: 'absolute',
    left: 0,
    right: 0,
    height: StyleSheet.hairlineWidth,
    backgroundColor: BLANCO_TRANSLUCIDO,
  },
  abajo: {
    gap: Spacing.lg,
    paddingBottom: Spacing.lg,
  },
  globo: {
    alignSelf: 'center',
    maxWidth: '86%',
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm,
    borderRadius: Radius.lg,
    backgroundColor: 'rgba(245,247,251,0.92)',
  },
  textoGlobo: {
    color: '#0B1020',
    textAlign: 'center',
  },
  controles: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    paddingHorizontal: Spacing.xl,
  },
  circularGrande: {
    width: 56,
    height: 56,
    borderRadius: Radius.pildora,
    backgroundColor: NEGRO_TRANSLUCIDO,
    alignItems: 'center',
    justifyContent: 'center',
  },
  disparador: {
    width: 84,
    height: 84,
    borderRadius: 42,
    borderWidth: 4,
    borderColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  disparadorInterior: {
    width: 66,
    height: 66,
    borderRadius: 33,
    backgroundColor: '#FFFFFF',
  },
  verLote: {
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    minHeight: TocableMinimo,
    paddingHorizontal: Spacing.xl,
    borderRadius: Radius.pildora,
  },
  disparadorVacio: {
    width: 84,
    height: 84,
  },
  modos: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: Spacing.xs,
  },
  modo: {
    minHeight: TocableMinimo,
    paddingHorizontal: Spacing.sm,
    justifyContent: 'center',
  },
  opcionesSinCamara: {
    padding: Spacing.lg,
    gap: Spacing.md,
  },
});
