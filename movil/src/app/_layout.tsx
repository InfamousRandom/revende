import {
  PlusJakartaSans_400Regular,
  PlusJakartaSans_500Medium,
  PlusJakartaSans_600SemiBold,
  PlusJakartaSans_700Bold,
  PlusJakartaSans_800ExtraBold,
  useFonts,
} from '@expo-google-fonts/plus-jakarta-sans';
import { DarkTheme, DefaultTheme, Stack, ThemeProvider } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';

import { Colors } from '@/constants/theme';
import { ArticulosProvider } from '@/datos/articulos';
import { EmparejadoProvider, useEmparejado } from '@/datos/emparejado';
import { useColorScheme } from '@/hooks/use-color-scheme';

SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const scheme = useColorScheme() === 'dark' ? 'dark' : 'light';
  const colores = Colors[scheme];
  const [fuentesListas, errorFuentes] = useFonts({
    PlusJakartaSans_400Regular,
    PlusJakartaSans_500Medium,
    PlusJakartaSans_600SemiBold,
    PlusJakartaSans_700Bold,
    PlusJakartaSans_800ExtraBold,
  });

  useEffect(() => {
    if (fuentesListas || errorFuentes) SplashScreen.hideAsync();
  }, [fuentesListas, errorFuentes]);

  if (!fuentesListas && !errorFuentes) return null;

  const base = scheme === 'dark' ? DarkTheme : DefaultTheme;
  const tema = {
    ...base,
    colors: {
      ...base.colors,
      background: colores.fondo,
      card: colores.fondo,
      text: colores.texto,
      border: colores.borde,
      primary: colores.primario,
    },
  };

  return (
    <ThemeProvider value={tema}>
      <StatusBar style={scheme === 'dark' ? 'light' : 'dark'} />
      <EmparejadoProvider>
        <ArticulosProvider>
          <Rutas />
        </ArticulosProvider>
      </EmparejadoProvider>
    </ThemeProvider>
  );
}

/** Sin código guardado solo se puede ver la pantalla de emparejar. */
function Rutas() {
  const { estado } = useEmparejado();
  if (estado === 'cargando') return null;
  const dentro = estado === 'emparejado' || estado === 'ejemplo';

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Protected guard={dentro}>
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="capturar" options={{ presentation: 'fullScreenModal', animation: 'slide_from_bottom' }} />
        <Stack.Screen name="resultado" options={{ presentation: 'fullScreenModal' }} />
        <Stack.Screen name="articulo/[id]" />
        <Stack.Screen name="registrar" options={{ presentation: 'fullScreenModal', animation: 'slide_from_bottom' }} />
        <Stack.Screen name="editor" options={{ presentation: 'fullScreenModal' }} />
      </Stack.Protected>
      <Stack.Protected guard={!dentro}>
        <Stack.Screen name="emparejar" />
      </Stack.Protected>
    </Stack>
  );
}
