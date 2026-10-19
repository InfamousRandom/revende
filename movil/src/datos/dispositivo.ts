/**
 * Código de emparejamiento del celular (Secret REVENDE_DISPOSITIVO del Worker).
 * En Android se guarda cifrado con expo-secure-store; en la web (solo pruebas) en localStorage.
 */
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

const CLAVE = 'revende_dispositivo';

export async function leerCodigo(): Promise<string | null> {
  if (Platform.OS === 'web') return globalThis.localStorage?.getItem(CLAVE) ?? null;
  return SecureStore.getItemAsync(CLAVE);
}

export async function guardarCodigo(codigo: string): Promise<void> {
  if (Platform.OS === 'web') return globalThis.localStorage?.setItem(CLAVE, codigo);
  await SecureStore.setItemAsync(CLAVE, codigo);
}

export async function borrarCodigo(): Promise<void> {
  if (Platform.OS === 'web') return globalThis.localStorage?.removeItem(CLAVE);
  await SecureStore.deleteItemAsync(CLAVE);
}
