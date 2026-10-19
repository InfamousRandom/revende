import { router } from 'expo-router';
import { Camera, FlaskConical, X } from 'lucide-react-native';
import { Pressable, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { PantallaVacia } from '@/components/pantalla-vacia';
import { Boton } from '@/components/ui';
import { USAR_DATOS_DE_EJEMPLO } from '@/datos/ejemplo';
import { IconSize, Radius, Spacing, TocableMinimo } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

/** Lugar de la cámara (Fase V3). Por ahora solo se abre y se cierra. */
export default function Capturar() {
  const theme = useTheme();

  return (
    <SafeAreaView style={[styles.contenedor, { backgroundColor: theme.fondo }]}>
      <View style={styles.arriba}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Cerrar"
          onPress={() => router.back()}
          hitSlop={8}
          style={({ pressed }) => [styles.cerrar, { backgroundColor: theme.superficieAlta }, pressed && { opacity: 0.6 }]}>
          <X size={IconSize.md} color={theme.texto} />
        </Pressable>
      </View>
      <PantallaVacia
        Icono={Camera}
        titulo="Aquí va la cámara"
        texto="Tómale foto a un artículo y te diremos qué es y cuánto vale. Llega en la Fase V3."
      />
      {USAR_DATOS_DE_EJEMPLO ? (
        <View style={styles.simular}>
          <Boton texto="Simular un escaneo (ejemplo)" Icono={FlaskConical} onPress={() => router.push('/resultado')} />
        </View>
      ) : null}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  contenedor: {
    flex: 1,
  },
  arriba: {
    flexDirection: 'row',
    padding: Spacing.lg,
  },
  simular: {
    padding: Spacing.lg,
  },
  cerrar: {
    width: TocableMinimo,
    height: TocableMinimo,
    borderRadius: Radius.pildora,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
