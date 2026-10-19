import { Image } from 'expo-image';
import { FlaskConical, KeyRound } from 'lucide-react-native';
import { useState } from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Platform, StyleSheet, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { Boton } from '@/components/ui';
import { Fonts, IconSize, Radius, Spacing, TocableMinimo } from '@/constants/theme';
import { probarCodigo } from '@/datos/api';
import { useEmparejado } from '@/datos/emparejado';
import { useTheme } from '@/hooks/use-theme';

/** Primera vez: el celular se empareja con el código guardado en Cloudflare (REVENDE_DISPOSITIVO). */
export default function Emparejar() {
  const theme = useTheme();
  const { emparejar, entrarConEjemplo } = useEmparejado();
  const [codigo, setCodigo] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [probando, setProbando] = useState(false);

  const enviar = async () => {
    const limpio = codigo.trim();
    if (!limpio || probando) return;
    setProbando(true);
    setError(null);
    const r = await probarCodigo(limpio);
    setProbando(false);
    if (r.ok) await emparejar(limpio);
    else setError(r.error);
  };

  return (
    <SafeAreaView style={[styles.contenedor, { backgroundColor: theme.fondo }]}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.centro}>
        <Image source={require('@/assets/images/logo-revende.png')} style={styles.logo} accessibilityLabel="Logo de Revende" />
        <ThemedText type="titulo" accessibilityRole="header" style={styles.texto}>
          Empareja este celular
        </ThemedText>
        <ThemedText themeColor="textoSecundario" style={styles.texto}>
          Escribe el código que guardaste en Cloudflare. Solo se pide una vez y queda guardado cifrado en el celular.
        </ThemedText>

        <View style={styles.formulario}>
          <ThemedText type="chico" themeColor="textoSecundario">
            Código del dispositivo
          </ThemedText>
          <View style={[styles.campo, { backgroundColor: theme.superficie, borderColor: error ? theme.peligro : theme.borde }]}>
            <KeyRound size={IconSize.sm} color={theme.textoTenue} />
            <TextInput
              accessibilityLabel="Código del dispositivo"
              value={codigo}
              onChangeText={(t) => {
                setCodigo(t);
                setError(null);
              }}
              onSubmitEditing={enviar}
              secureTextEntry
              autoCapitalize="none"
              autoCorrect={false}
              returnKeyType="done"
              style={[styles.entrada, { color: theme.texto }]}
            />
          </View>
          {error ? (
            <ThemedText type="chico" style={{ color: theme.peligro }} accessibilityRole="alert">
              {error}
            </ThemedText>
          ) : null}

          {probando ? (
            <ActivityIndicator color={theme.primario} style={{ minHeight: TocableMinimo + 4 }} />
          ) : (
            <Boton texto="Emparejar" onPress={enviar} />
          )}
        </View>

        {__DEV__ ? (
          <View style={styles.formulario}>
            <Boton texto="Ver con datos de ejemplo" variante="secundario" Icono={FlaskConical} onPress={entrarConEjemplo} />
            <ThemedText type="chico" themeColor="textoTenue" style={styles.texto}>
              Solo aparece mientras se desarrolla la app.
            </ThemedText>
          </View>
        ) : null}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  contenedor: {
    flex: 1,
  },
  centro: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: Spacing.xl,
    gap: Spacing.lg,
  },
  logo: {
    width: 88,
    height: 88,
    alignSelf: 'center',
    marginBottom: Spacing.sm,
  },
  texto: {
    textAlign: 'center',
  },
  formulario: {
    gap: Spacing.sm,
    width: '100%',
    maxWidth: 420,
    alignSelf: 'center',
  },
  campo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    minHeight: TocableMinimo + 4,
    borderWidth: 1,
    borderRadius: Radius.md,
    paddingHorizontal: Spacing.md,
  },
  entrada: {
    flex: 1,
    fontFamily: Fonts.seminegrita,
    fontSize: 16,
    minHeight: TocableMinimo,
  },
});
