/** Preparar fotos para identificar: reducirlas y leer el texto de la etiqueta en el teléfono. */
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import { extractTextFromImage, isSupported } from 'expo-text-extractor';

/** Foto reducida a 1024 px de ancho en JPEG (Lens acepta hasta 1.5 MB; queda en ~150-300 KB). */
export async function reducirFoto(uri: string): Promise<string> {
  const imagen = await ImageManipulator.manipulate(uri).resize({ width: 1024 }).renderAsync();
  const resultado = await imagen.saveAsync({ compress: 0.7, format: SaveFormat.JPEG });
  return resultado.uri;
}

/** Líneas de texto de la foto (etiqueta, caja). En la web no hay lectura: regresa vacío. */
export async function leerEtiqueta(uri: string): Promise<string[]> {
  if (!isSupported) return [];
  try {
    return (await extractTextFromImage(uri)).map((t) => t.trim()).filter(Boolean);
  } catch {
    return [];
  }
}

// Palabras que parecen modelo pero no lo son.
const NO_MODELO = /^(\d+(gb|tb|mb|mah|w|v|hz|mm|cm|in)|v\d|usb\d?|hdmi\d?|\d{1,4})$/i;

/**
 * Número de modelo en la etiqueta: mezcla letras y números, de 4 a 15 caracteres
 * (ej. CFI-2015, HDH-001, A2084, WH-1000XM4). Si hay varios, el más largo.
 */
export function modeloEnEtiqueta(lineas: string[]): string | null {
  const candidatos = lineas
    .flatMap((l) => l.split(/[\s,;:()]+/))
    .map((t) => t.replace(/^[^A-Za-z0-9]+|[^A-Za-z0-9]+$/g, ''))
    .filter((t) => t.length >= 4 && t.length <= 15 && /[A-Za-z]/.test(t) && /\d/.test(t) && !NO_MODELO.test(t));
  if (!candidatos.length) return null;
  return candidatos.sort((a, b) => b.length - a.length)[0].toUpperCase();
}
