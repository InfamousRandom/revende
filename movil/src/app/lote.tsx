import { Image } from 'expo-image';
import { router } from 'expo-router';
import { Barcode, ChevronRight, Layers, Plus, Trash2, X } from 'lucide-react-native';
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { CampoPesos, Hoja } from '@/components/hoja';
import { PantallaVacia } from '@/components/pantalla-vacia';
import { ThemedText } from '@/components/themed-text';
import { AvisoEjemplo, Boton, Tarjeta } from '@/components/ui';
import { IconSize, Radius, Spacing, TocableMinimo } from '@/constants/theme';
import * as api from '@/datos/api';
import { hoy, useArticulos } from '@/datos/articulos';
import { precioDeReventa, repartirLote } from '@/datos/decision';
import { prepararParaGuardar } from '@/datos/escaneo';
import { buscar, buscarEjemplo } from '@/datos/busqueda';
import { pesos } from '@/datos/formato';
import { actualizarElemento, busquedasEstimadas, quitarDelLote, useLote, vaciarLote, type ElementoLote } from '@/datos/lote';
import { useTheme } from '@/hooks/use-theme';

/** Precio de reventa de un artículo del lote (tus ventas, lo que viste publicado o usados). Nunca inventado. */
function reventa(e: ElementoLote): { precio: number; fuente: string } | null {
  return e.resultado ? precioDeReventa(e.resultado) : null;
}

export default function Lote() {
  const theme = useTheme();
  const lista = useLote();
  const { sonDeEjemplo, registrarCompra } = useArticulos();
  const [comprando, setComprando] = useState(false);
  const [pagado, setPagado] = useState('');
  const [registrando, setRegistrando] = useState(false);
  const [errorCompra, setErrorCompra] = useState<string | null>(null);
  const [restantes, setRestantes] = useState<number | null>(null);
  const [buscando, setBuscando] = useState(false);
  const [ganancia, setGanancia] = useState('300');
  const [piden, setPiden] = useState('');
  const cancelado = useRef(false);

  useEffect(() => {
    if (sonDeEjemplo) return;
    void api.cuota().then((r) => r.ok && setRestantes(r.datos.restantes));
  }, [sonDeEjemplo]);

  const pendientes = lista.filter((e) => e.estado === 'pendiente');
  const estimadas = busquedasEstimadas(lista);
  const listos = lista.filter((e) => e.estado === 'listo');
  const conPrecio = listos.map((e) => ({ e, v: reventa(e) })).filter((x) => x.v);
  const valorTotal = conPrecio.reduce((s, x) => s + (x.v?.precio ?? 0), 0);
  const gananciaPorArticulo = Number(ganancia) || 0;
  const maximoTotal = conPrecio.reduce((s, x) => s + Math.max(0, (x.v?.precio ?? 0) - gananciaPorArticulo), 0);
  const pidenNum = Number(piden) || 0;

  const buscarTodo = async () => {
    setBuscando(true);
    cancelado.current = false;
    // Uno por uno, para no gastar de golpe y poder parar.
    for (const e of pendientes) {
      if (cancelado.current) break;
      actualizarElemento(e.id, { estado: 'buscando' });
      try {
        const resultado = sonDeEjemplo ? await buscarEjemplo(e.entrada) : await buscar(e.entrada);
        actualizarElemento(e.id, { estado: 'listo', resultado });
      } catch (err) {
        actualizarElemento(e.id, { estado: 'error', error: err instanceof Error ? err.message : 'No se encontró' });
      }
    }
    setBuscando(false);
    if (!sonDeEjemplo) void api.cuota().then((r) => r.ok && setRestantes(r.datos.restantes));
  };

  const cerrar = () => router.back();

  // Al comprar el lote, cada artículo queda registrado con su parte de lo pagado (según lo que vale).
  const conResultado = listos.filter((e) => e.resultado);
  const partes = repartirLote(Number(pagado) || 0, conResultado.map((e) => reventa(e)?.precio ?? null));
  const registrarLote = async () => {
    const total = Number(pagado) || 0;
    if (!(total > 0)) return setErrorCompra('Escribe cuánto pagaste por el lote.');
    setRegistrando(true);
    setErrorCompra(null);
    for (const [i, e] of conResultado.entries()) {
      const r = e.resultado!;
      const hecho = await registrarCompra({
        producto: { nombre: r.nombre, marca: r.marca, categoria: null },
        precioCompra: partes[i],
        fechaCompra: hoy(),
        condicion: 'usado_bueno',
        lugarCompra: null,
        notas: `Parte de un lote de ${conResultado.length} artículos (pagaste ${pesos(total)} en total).`,
      });
      if (!hecho.ok) {
        setRegistrando(false);
        return setErrorCompra(`${r.nombre}: ${hecho.error}`);
      }
      if (!sonDeEjemplo && r.foto) await api.subirFoto(hecho.datos.id, await prepararParaGuardar(r.foto), 'image/jpeg');
      // Lo ya registrado sale del lote, por si algo falla a la mitad.
      quitarDelLote(e.id);
    }
    setRegistrando(false);
    setComprando(false);
    vaciarLote();
    router.dismissAll();
  };

  return (
    <SafeAreaView style={[styles.contenedor, { backgroundColor: theme.fondo }]}>
      <View style={styles.barraSuperior}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Cerrar"
          onPress={cerrar}
          style={({ pressed }) => [styles.circular, { backgroundColor: theme.superficie, opacity: pressed ? 0.6 : 1 }]}>
          <X size={IconSize.md} color={theme.texto} />
        </Pressable>
        <ThemedText type="cuerpoFuerte">Lote ({lista.length})</ThemedText>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Agregar más al lote"
          onPress={() => router.replace('/capturar')}
          style={({ pressed }) => [styles.circular, { backgroundColor: theme.superficie, opacity: pressed ? 0.6 : 1 }]}>
          <Plus size={IconSize.md} color={theme.texto} />
        </Pressable>
      </View>

      {!lista.length ? (
        <>
          <PantallaVacia
            Icono={Layers}
            titulo="El lote está vacío"
            texto="En la cámara elige LOTE y toma una foto o lee el código de cada artículo. Luego buscamos todos juntos."
          />
          <View style={styles.margen}>
            <Boton texto="Ir a la cámara" onPress={() => router.replace('/capturar')} />
          </View>
        </>
      ) : (
        <ScrollView contentContainerStyle={styles.contenido}>
          {sonDeEjemplo ? <AvisoEjemplo /> : null}

          {pendientes.length ? (
            <Tarjeta style={{ gap: Spacing.sm }}>
              <ThemedText type="cuerpoFuerte">
                Buscar {pendientes.length} {pendientes.length === 1 ? 'artículo' : 'artículos'}
              </ThemedText>
              <ThemedText themeColor="textoSecundario">
                Puede gastar hasta {estimadas} {estimadas === 1 ? 'búsqueda' : 'búsquedas'} de tu cuota
                {restantes != null ? ` (te quedan ${restantes} este mes)` : ''}. Lo ya buscado en las últimas 24 h no se cobra.
              </ThemedText>
              {restantes != null && estimadas > restantes ? (
                <ThemedText type="chico" style={{ color: theme.peligro }}>
                  No te alcanzan las búsquedas para todo el lote; se buscará hasta donde alcance.
                </ThemedText>
              ) : null}
              {buscando ? (
                <Boton texto="Parar" variante="secundario" onPress={() => (cancelado.current = true)} />
              ) : (
                <Boton texto="Buscar precios" onPress={buscarTodo} />
              )}
            </Tarjeta>
          ) : null}

          {listos.length ? (
            <Tarjeta style={{ gap: Spacing.md }}>
              <ThemedText type="cuerpoFuerte">¿Conviene el lote?</ThemedText>
              <View style={{ gap: 2 }}>
                <ThemedText themeColor="textoSecundario">Lo podrías revender en</ThemedText>
                <ThemedText type="titulo" style={{ color: theme.dinero }}>
                  {pesos(valorTotal)}
                </ThemedText>
                <ThemedText type="chico" themeColor="textoTenue">
                  Suma de {conPrecio.length} de {listos.length} artículos con precio (tus ventas o usados en Google Shopping).
                </ThemedText>
              </View>
              <CampoPesos etiqueta="Ganancia que buscas por artículo" valor={ganancia} onCambio={setGanancia} />
              <CampoPesos etiqueta="¿Cuánto piden por todo el lote?" valor={piden} onCambio={setPiden} />
              <View style={[styles.veredicto, { backgroundColor: theme.superficieAlta }]}>
                <ThemedText themeColor="textoSecundario">Paga como máximo</ThemedText>
                <ThemedText type="titulo" style={{ color: maximoTotal > 0 ? theme.dinero : theme.peligro }}>
                  {maximoTotal > 0 ? pesos(maximoTotal) : 'No conviene'}
                </ThemedText>
                {pidenNum > 0 && maximoTotal > 0 ? (
                  <ThemedText type="cuerpoFuerte" style={{ color: pidenNum <= maximoTotal ? theme.dinero : theme.peligro }}>
                    {pidenNum <= maximoTotal
                      ? `Conviene: te sobran ${pesos(maximoTotal - pidenNum)} de margen`
                      : `No conviene: piden ${pesos(pidenNum - maximoTotal)} de más`}
                  </ThemedText>
                ) : null}
              </View>
              {conResultado.length && !pendientes.length && !buscando ? (
                <Boton
                  texto="Compré el lote"
                  onPress={() => {
                    setPagado(piden);
                    setErrorCompra(null);
                    setComprando(true);
                  }}
                />
              ) : null}
            </Tarjeta>
          ) : null}

          {lista.map((e) => (
            <FilaLote key={e.id} e={e} />
          ))}

          <Hoja visible={comprando} titulo="Registrar el lote" onCerrar={() => setComprando(false)}>
            <CampoPesos etiqueta="¿Cuánto pagaste por todo?" valor={pagado} onCambio={setPagado} autoFocus />
            <ThemedText type="chico" themeColor="textoSecundario">
              {conResultado.every((e) => reventa(e))
                ? 'Se reparte según lo que vale cada artículo:'
                : 'Algunos no tienen precio de reventa, así que se reparte en partes iguales:'}
            </ThemedText>
            <ScrollView style={{ maxHeight: 220 }} contentContainerStyle={{ gap: Spacing.xs }}>
              {conResultado.map((e, i) => (
                <View key={e.id} style={styles.parte}>
                  <ThemedText type="chico" numberOfLines={1} style={{ flex: 1 }}>
                    {e.resultado?.nombre}
                  </ThemedText>
                  <ThemedText type="cuerpoFuerte">{Number(pagado) > 0 ? pesos(partes[i]) : '—'}</ThemedText>
                </View>
              ))}
            </ScrollView>
            {listos.length + pendientes.length < lista.length ? (
              <ThemedText type="chico" themeColor="textoTenue">
                Los artículos que no se encontraron no se registran.
              </ThemedText>
            ) : null}
            {errorCompra ? (
              <ThemedText type="chico" accessibilityRole="alert" style={{ color: theme.peligro }}>
                {errorCompra}
              </ThemedText>
            ) : null}
            <Boton
              texto={registrando ? 'Registrando…' : `Registrar ${conResultado.length} ${conResultado.length === 1 ? 'artículo' : 'artículos'}`}
              onPress={registrando ? () => {} : registrarLote}
            />
          </Hoja>

          <Boton
            texto="Vaciar el lote"
            variante="secundario"
            Icono={Trash2}
            onPress={() => {
              vaciarLote();
              router.back();
            }}
          />
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

function FilaLote({ e }: { e: ElementoLote }) {
  const theme = useTheme();
  const v = reventa(e);
  const r = e.resultado;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={r ? `${r.nombre}, ver detalle` : 'Artículo del lote'}
      disabled={!r}
      onPress={() => r && router.push({ pathname: '/resultado', params: { consulta: r.nombre } })}
      style={({ pressed }) => [styles.fila, { backgroundColor: theme.superficie, opacity: pressed ? 0.75 : 1 }]}>
      {e.entrada.tipo === 'foto' ? (
        <Image source={{ uri: e.entrada.uri }} style={styles.miniatura} contentFit="cover" />
      ) : (
        <View style={[styles.miniatura, styles.codigo, { backgroundColor: theme.superficieAlta }]}>
          <Barcode size={IconSize.md} color={theme.textoSecundario} />
        </View>
      )}
      <View style={{ flex: 1, gap: 2 }}>
        <ThemedText type="cuerpoFuerte" numberOfLines={2}>
          {r?.nombre ?? (e.entrada.tipo === 'codigo' ? `Código ${e.entrada.codigo}` : 'Foto')}
        </ThemedText>
        {e.estado === 'listo' ? (
          <ThemedText type="chico" themeColor="textoTenue">
            {v ? `Reventa ${pesos(v.precio)} · ${v.fuente}` : 'Sin precio de usado'}
          </ThemedText>
        ) : e.estado === 'error' ? (
          <ThemedText type="chico" style={{ color: theme.peligro }}>
            {e.error}
          </ThemedText>
        ) : (
          <ThemedText type="chico" themeColor="textoTenue">
            {e.estado === 'buscando' ? 'Buscando…' : 'Pendiente'}
          </ThemedText>
        )}
      </View>
      {e.estado === 'buscando' ? <ActivityIndicator color={theme.primario} /> : null}
      {r ? <ChevronRight size={IconSize.sm} color={theme.textoTenue} /> : null}
      {e.estado === 'pendiente' || e.estado === 'error' ? (
        <Pressable accessibilityRole="button" accessibilityLabel="Quitar del lote" hitSlop={8} onPress={() => quitarDelLote(e.id)}>
          <Trash2 size={IconSize.sm} color={theme.textoTenue} />
        </Pressable>
      ) : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  contenedor: {
    flex: 1,
  },
  barraSuperior: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm,
  },
  circular: {
    width: TocableMinimo,
    height: TocableMinimo,
    borderRadius: Radius.pildora,
    alignItems: 'center',
    justifyContent: 'center',
  },
  margen: {
    padding: Spacing.lg,
  },
  contenido: {
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing.xxl,
    gap: Spacing.lg,
  },
  veredicto: {
    borderRadius: Radius.md,
    padding: Spacing.md,
    gap: 2,
  },
  parte: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
  },
  fila: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    borderRadius: Radius.md,
    padding: Spacing.md,
    minHeight: 72,
  },
  miniatura: {
    width: 52,
    height: 52,
    borderRadius: Radius.md,
  },
  codigo: {
    alignItems: 'center',
    justifyContent: 'center',
  },
});
