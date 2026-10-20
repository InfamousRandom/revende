/**
 * Dictar en vez de escribir (reconocimiento de voz del teléfono, en español de México). Solo llena el
 * texto: la búsqueda se sigue confirmando con la lupa, para no gastar búsquedas por error.
 */
import { ExpoSpeechRecognitionModule, useSpeechRecognitionEvent } from 'expo-speech-recognition';
import { Mic, MicOff } from 'lucide-react-native';
import { useState } from 'react';
import { Pressable, StyleSheet } from 'react-native';

import { IconSize, Radius } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

function disponible(): boolean {
  try {
    return ExpoSpeechRecognitionModule.isRecognitionAvailable();
  } catch {
    return false;
  }
}

export function BotonVoz({ onTexto, onError }: { onTexto: (texto: string) => void; onError?: (mensaje: string) => void }) {
  const theme = useTheme();
  const [hayVoz] = useState(disponible);
  // Puede haber varios campos montados: cada uno solo atiende lo que él empezó a escuchar.
  const [escuchando, setEscuchando] = useState(false);

  useSpeechRecognitionEvent('result', (e) => {
    if (escuchando) onTexto(e.results[0]?.transcript ?? '');
  });
  useSpeechRecognitionEvent('end', () => setEscuchando(false));
  useSpeechRecognitionEvent('error', (e) => {
    if (!escuchando) return;
    setEscuchando(false);
    if (e.error === 'no-speech' || e.error === 'aborted') return;
    onError?.(e.error === 'not-allowed' ? 'Para dictar, permite el micrófono en los ajustes del celular.' : 'No se pudo escuchar. Intenta de nuevo.');
  });

  if (!hayVoz) return null;

  const empezar = async () => {
    const permiso = await ExpoSpeechRecognitionModule.requestPermissionsAsync();
    if (!permiso.granted) return onError?.('Para dictar, permite el micrófono en los ajustes del celular.');
    setEscuchando(true);
    ExpoSpeechRecognitionModule.start({ lang: 'es-MX', interimResults: true, continuous: false });
  };

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={escuchando ? 'Dejar de escuchar' : 'Dictar lo que buscas'}
      onPress={escuchando ? () => ExpoSpeechRecognitionModule.stop() : empezar}
      hitSlop={6}
      style={({ pressed }) => [styles.boton, { backgroundColor: escuchando ? theme.peligro : 'transparent', opacity: pressed ? 0.7 : 1 }]}>
      {escuchando ? <MicOff size={IconSize.sm} color={theme.fondo} /> : <Mic size={IconSize.sm} color={theme.textoSecundario} />}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  boton: {
    width: 40,
    height: 40,
    borderRadius: Radius.pildora,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
