/**
 * Flujo de búsqueda de Revende 2.0. Foto, código o texto terminan en el mismo resultado.
 * Orden para gastar lo menos posible de SerpApi:
 *  - Foto: se lee la etiqueta en el teléfono; si trae un modelo que el catálogo de Mercado Libre
 *    reconoce por completo, no se usa Lens. Si no, Lens (1 búsqueda).
 *  - Código de barras: Mercado Libre o UPCitemdb (gratis).
 *  - Luego: catálogo (gratis), Google Shopping (1 búsqueda, con memoria de 24 h) y tus ventas (gratis).
 */
import { useEffect, useState } from 'react';

import * as api from './api';
import { RESULTADO_EJEMPLO } from './ejemplo';
import { codigoEnFoto, leerEtiqueta, modeloEnEtiqueta, reducirFoto } from './escaneo';

export type Entrada =
  | { tipo: 'texto'; consulta: string }
  | { tipo: 'codigo'; codigo: string }
  /** `extra`: más fotos del mismo artículo (etiqueta, código, otro ángulo). */
  | { tipo: 'foto'; uri: string; extra?: string[] };

type Rango = { min: number; mediana: number; max: number };

export type Resultado = {
  nombre: string;
  marca: string | null;
  lanzamiento: number | null;
  /** De dónde salió el nombre. */
  origen: 'texto' | 'codigo' | 'etiqueta' | 'lens' | 'ejemplo';
  /** Otros nombres que se pueden probar si el sugerido no es. */
  alternativas: string[];
  nuevos: { rango: Rango | null; ofertas: api.OfertaApi[] } | null;
  usados: { rango: Rango | null; ofertas: api.OfertaApi[] } | null;
  mercadoLibre: api.CatalogoApi['precios'];
  lens: api.IdentificacionApi['precios'];
  tusVentas: { rango: Rango & { n: number }; diasMediana: number | null } | null;
  /** Foto reducida (para guardarla en el artículo si se compra). */
  foto: string | null;
  avisos: string[];
};

export const PASOS: Record<Entrada['tipo'], string[]> = {
  foto: ['Revisando la foto', 'Leyendo la etiqueta', 'Identificando el artículo', 'Buscando precios', 'Listo'],
  codigo: ['Buscando el código', 'Buscando precios', 'Listo'],
  texto: ['Buscando el artículo', 'Buscando precios', 'Listo'],
};

type Estado = { paso: number; resultado: Resultado | null; error: string | null };

const esperar = (ms: number) => new Promise((r) => setTimeout(r, ms));

export function useBusqueda(entrada: Entrada, deEjemplo: boolean): Estado {
  const [estado, setEstado] = useState<Estado>({ paso: 0, resultado: null, error: null });

  useEffect(() => {
    let vigente = true;
    const avanzar = (paso: number) => vigente && setEstado((e) => ({ ...e, paso }));
    const terminar = (resultado: Resultado | null, error: string | null) =>
      vigente && setEstado({ paso: PASOS[entrada.tipo].length - 1, resultado, error });

    (deEjemplo ? buscarEjemplo(entrada, avanzar) : buscar(entrada, avanzar))
      .then((r) => terminar(r, null))
      .catch((e: unknown) => terminar(null, e instanceof Error ? e.message : 'Algo falló. Intenta de nuevo.'));
    return () => {
      vigente = false;
    };
    // La búsqueda se repite solo si cambia lo que se busca.
  }, [entrada.tipo, 'consulta' in entrada ? entrada.consulta : 'codigo' in entrada ? entrada.codigo : entrada.uri, deEjemplo]); // eslint-disable-line react-hooks/exhaustive-deps

  return estado;
}

/** La misma búsqueda sin pantalla (para el modo Lote). */
export async function buscar(entrada: Entrada, avanzar: (paso: number) => void = () => {}): Promise<Resultado> {
  let nombre = '';
  let origen: Resultado['origen'] = 'texto';
  let alternativas: string[] = [];
  let lens: Resultado['lens'] = [];
  let foto: string | null = null;
  let catalogo: api.CatalogoApi | null = null;
  const avisos: string[] = [];

  if (entrada.tipo === 'texto') {
    nombre = entrada.consulta;
  } else if (entrada.tipo === 'codigo') {
    const r = await api.buscarCodigo(entrada.codigo);
    if (!r.ok) throw new Error(r.error);
    nombre = r.datos.nombre;
    origen = 'codigo';
    avanzar(1);
  } else {
    // Todas las fotos del artículo (máximo 5), reducidas.
    const fotos = await Promise.all([entrada.uri, ...(entrada.extra ?? [])].slice(0, 5).map(reducirFoto));
    foto = fotos[0];
    avanzar(1);
    // 1) Código de barras en cualquiera de las fotos: gratis y exacto.
    for (const f of fotos) {
      const codigo = await codigoEnFoto(f);
      if (!codigo) continue;
      const r = await api.buscarCodigo(codigo);
      if (r.ok) {
        nombre = r.datos.nombre;
        origen = 'codigo';
        break;
      }
    }
    // 2) Modelo escrito en la etiqueta (se lee el texto de todas las fotos) y reconocido por el catálogo.
    if (!nombre) {
      const lineas = (await Promise.all(fotos.map(leerEtiqueta))).flat();
      const modelo = modeloEnEtiqueta(lineas);
      avanzar(2);
      if (modelo) {
        const c = await api.buscarCatalogo(modelo);
        if (c.ok && c.datos.productos[0]?.completo) {
          catalogo = c.datos;
          nombre = c.datos.productos[0].nombre;
          origen = 'etiqueta';
        }
      }
    }
    // 3) Google Lens con la foto principal; si no reconoce nada, una vez más con la segunda.
    if (!nombre) {
      let r = await api.identificarFoto(fotos[0]);
      if (!r.ok && r.status === 404 && fotos[1]) r = await api.identificarFoto(fotos[1]);
      if (!r.ok) throw new Error(r.error);
      nombre = r.datos.sugerido;
      alternativas = r.datos.candidatos;
      lens = r.datos.precios;
      origen = 'lens';
    }
    avanzar(3);
  }

  const [rPrecios, rCatalogo] = await Promise.all([
    api.buscarPrecios(nombre),
    catalogo ? Promise.resolve(null) : api.buscarCatalogo(nombre),
  ]);
  if (rCatalogo?.ok) catalogo = rCatalogo.datos;
  if (!rPrecios.ok) avisos.push(rPrecios.error);
  const precioNuevo = rPrecios.ok ? rPrecios.datos.nuevos.rango?.mediana : undefined;
  const rRef = await api.buscarReferencias(nombre, precioNuevo ? Math.round(precioNuevo) : undefined);

  const principal = catalogo?.productos.find((p) => p.completo) ?? null;
  for (const p of catalogo?.productos ?? []) {
    if (p !== principal && !alternativas.includes(p.nombre) && alternativas.length < 5) alternativas.push(p.nombre);
  }
  const ventas = rRef.ok ? rRef.datos.resumen?.todo : null;

  return {
    nombre,
    marca: principal?.marca ?? null,
    lanzamiento: principal?.lanzamiento ?? null,
    origen,
    alternativas: alternativas.filter((a) => a !== nombre).slice(0, 5),
    nuevos: rPrecios.ok ? rPrecios.datos.nuevos : null,
    usados: rPrecios.ok ? rPrecios.datos.usados : null,
    mercadoLibre: principal ? (catalogo?.precios ?? null) : null,
    lens,
    tusVentas: ventas ? { rango: ventas, diasMediana: rRef.ok ? (rRef.datos.resumen?.dias_mediana ?? null) : null } : null,
    foto,
    avisos,
  };
}

// Modo de ejemplo: mismo recorrido con pausas y datos inventados.
export async function buscarEjemplo(entrada: Entrada, avanzar: (paso: number) => void = () => {}): Promise<Resultado> {
  const pasos = PASOS[entrada.tipo].length;
  for (let i = 1; i < pasos - 1; i++) {
    await esperar(600);
    avanzar(i);
  }
  await esperar(600);
  const r = RESULTADO_EJEMPLO;
  const oferta = (o: (typeof r.ofertas)[number]): api.OfertaApi => ({ ...o, condicion: o.usado ? 'Usado' : 'Nuevo', miniatura: null });
  return {
    nombre: entrada.tipo === 'texto' ? entrada.consulta : r.nombre,
    marca: r.marca,
    lanzamiento: r.lanzamiento ?? null,
    origen: 'ejemplo',
    alternativas: ['Nintendo Switch Lite Coral', 'Nintendo Switch OLED'],
    nuevos: { rango: r.nuevo, ofertas: r.ofertas.filter((o) => !o.usado).map(oferta) },
    usados: { rango: r.usado, ofertas: r.ofertas.filter((o) => o.usado).map(oferta) },
    mercadoLibre: null,
    lens: [],
    tusVentas: { rango: { n: 2, mediana: 3300, min: 3100, max: 3500 }, diasMediana: 9 },
    foto: entrada.tipo === 'foto' ? entrada.uri : null,
    avisos: [],
  };
}
