/** Operaciones del editor de fotos. Todo ocurre en el teléfono; nada se manda a servicios externos. */
import { File, Paths } from 'expo-file-system';
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import { Platform } from 'react-native';

import { API_URL, ENCABEZADO_DISPOSITIVO } from './api';

export type Recorte = 'cuadrado' | 'vertical';

async function guardar(contexto: ReturnType<typeof ImageManipulator.manipulate>, png = false): Promise<string> {
  const imagen = await contexto.renderAsync();
  const r = await imagen.saveAsync(png ? { format: SaveFormat.PNG } : { compress: 0.85, format: SaveFormat.JPEG });
  return r.uri;
}

export async function girar(uri: string, png: boolean): Promise<string> {
  return guardar(ImageManipulator.manipulate(uri).rotate(90), png);
}

/** Recorta al centro: cuadrado (1:1) o vertical (4:5, como en los anuncios). */
export async function recortar(uri: string, forma: Recorte, png: boolean): Promise<string> {
  const actual = await ImageManipulator.manipulate(uri).renderAsync();
  const { width, height } = actual;
  const proporcion = forma === 'cuadrado' ? 1 : 4 / 5;
  let w = width;
  let h = Math.round(width / proporcion);
  if (h > height) {
    h = height;
    w = Math.round(height * proporcion);
  }
  const rect = { originX: Math.round((width - w) / 2), originY: Math.round((height - h) / 2), width: w, height: h };
  return guardar(ImageManipulator.manipulate(uri).crop(rect), png);
}

/** Quitar el fondo solo existe en Android (ML Kit Subject Segmentation). */
export const PUEDE_QUITAR_FONDO = Platform.OS === 'android';

export async function quitarFondo(uri: string): Promise<string> {
  if (!PUEDE_QUITAR_FONDO) throw new Error('Quitar el fondo solo funciona en el celular.');
  // Se carga aquí para que la vista previa web no intente cargar el módulo nativo.
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { removeBackground } = require('@six33/react-native-bg-removal') as typeof import('@six33/react-native-bg-removal');
  return removeBackground(uri, { trim: false });
}

/** Copia local de una foto guardada en el Worker (necesita el código del dispositivo). */
export async function descargarFoto(fotoId: number, codigo: string | null): Promise<string> {
  const url = `${API_URL}/api/fotos/${fotoId}`;
  const headers: Record<string, string> = codigo ? { [ENCABEZADO_DISPOSITIVO]: codigo } : {};
  if (Platform.OS === 'web') {
    const r = await fetch(url, { headers });
    if (!r.ok) throw new Error('No se pudo abrir la foto.');
    return URL.createObjectURL(await r.blob());
  }
  const destino = new File(Paths.cache, `foto-${fotoId}-${Date.now()}`);
  const archivo = await File.downloadFileAsync(url, destino, { headers, idempotent: true });
  return archivo.uri;
}
