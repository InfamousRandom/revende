import { router, useLocalSearchParams } from 'expo-router';
import { Check, ChevronDown, ChevronUp, Plus, X } from 'lucide-react-native';
import { useEffect, useMemo, useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { CampoPesos } from '@/components/hoja';
import { ThemedText } from '@/components/themed-text';
import { AvisoEjemplo, Boton, Pildora } from '@/components/ui';
import { Fonts, IconSize, Radius, Spacing, TocableMinimo } from '@/constants/theme';
import * as api from '@/datos/api';
import { hoy, useArticulos } from '@/datos/articulos';
import { pesos } from '@/datos/formato';
import { NOMBRE_CONDICION, nombreCategoria, type Condicion, type Producto } from '@/datos/tipos';
import { useTheme } from '@/hooks/use-theme';

const CONDICIONES: Condicion[] = ['sellado', 'como_nuevo', 'usado_bueno', 'con_detalles'];
type Cuando = 'hoy' | 'ayer' | 'otra';

function ayer(): string {
  const d = new Date(`${hoy()}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() - 1);
  return d.toISOString().slice(0, 10);
}

/**
 * Registrar una compra en menos de 30 segundos: solo producto y precio son obligatorios;
 * la fecha es hoy y la condición tiene un valor por defecto.
 */
export default function Registrar() {
  const params = useLocalSearchParams<{ nombre?: string; marca?: string; categoria?: string; maximo?: string; foto?: string }>();
  const { articulos, sonDeEjemplo, registrarCompra, refrescar } = useArticulos();
  const theme = useTheme();

  const [nombre, setNombre] = useState(params.nombre ?? '');
  const [elegido, setElegido] = useState<Producto | null>(null);
  const [sugerencias, setSugerencias] = useState<Producto[]>([]);
  const [marca, setMarca] = useState(params.marca ?? '');
  const [categoria, setCategoria] = useState(params.categoria ?? '');
  const [precio, setPrecio] = useState('');
  const [cuando, setCuando] = useState<Cuando>('hoy');
  const [otraFecha, setOtraFecha] = useState(hoy());
  const [condicion, setCondicion] = useState<Condicion>('usado_bueno');
  const [masDatos, setMasDatos] = useState(false);
  const [lugar, setLugar] = useState('');
  const [notas, setNotas] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [guardando, setGuardando] = useState(false);

  // Productos de ejemplo (sin repetir) para el autocompletado en modo de ejemplo.
  const productosEjemplo = useMemo(() => {
    const vistos = new Map<number, Producto>();
    for (const a of articulos) {
      vistos.set(a.productoId, { id: a.productoId, nombre: a.nombre, marca: a.marca, categoria: a.categoria, modelo: null });
    }
    return [...vistos.values()];
  }, [articulos]);

  // Autocompletado con tu catálogo (D1). No usa SerpApi: no gasta búsquedas.
  const q = nombre.trim();
  const buscar = !elegido && q.length >= 2;
  useEffect(() => {
    if (!buscar || sonDeEjemplo) return;
    const temporizador = setTimeout(async () => {
      const r = await api.buscarProductos(q);
      if (r.ok) setSugerencias(r.datos.productos.slice(0, 5));
    }, 300);
    return () => clearTimeout(temporizador);
  }, [q, buscar, sonDeEjemplo]);
  const visibles = !buscar
    ? []
    : sonDeEjemplo
      ? productosEjemplo.filter((p) => p.nombre.toLowerCase().includes(q.toLowerCase())).slice(0, 5)
      : sugerencias;

  const fecha = cuando === 'hoy' ? hoy() : cuando === 'ayer' ? ayer() : otraFecha;

  const guardar = async () => {
    if (!elegido && !nombre.trim()) return setError('Escribe qué compraste.');
    if (!(Number(precio) > 0)) return setError('Escribe cuánto pagaste.');
    if (!/^\d{4}-\d{2}-\d{2}$/.test(fecha)) return setError('La fecha debe ser como 2026-10-19.');
    setGuardando(true);
    setError(null);
    const r = await registrarCompra({
      producto: elegido
        ? { id: elegido.id }
        : { nombre: nombre.trim(), marca: marca.trim() || null, categoria: categoria.trim() || null },
      precioCompra: Number(precio),
      fechaCompra: fecha,
      condicion,
      lugarCompra: lugar.trim() || null,
      notas: notas.trim() || null,
    });
    if (!r.ok) {
      setGuardando(false);
      return setError(r.error);
    }
    // La foto del escaneo se guarda como portada del artículo (si falla, el artículo ya quedó).
    if (params.foto && !sonDeEjemplo) {
      await api.subirFoto(r.datos.id, params.foto, 'image/jpeg');
      await refrescar(r.datos.id);
    }
    setGuardando(false);
    router.dismissAll();
    router.push({ pathname: '/articulo/[id]', params: { id: String(r.datos.id) } });
  };

  return (
    <SafeAreaView style={[styles.contenedor, { backgroundColor: theme.fondo }]}>
      <View style={styles.barraSuperior}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Cerrar"
          onPress={() => router.back()}
          style={({ pressed }) => [styles.cerrar, { backgroundColor: theme.superficie, opacity: pressed ? 0.6 : 1 }]}>
          <X size={IconSize.md} color={theme.texto} />
        </Pressable>
        <ThemedText type="cuerpoFuerte">Registrar compra</ThemedText>
        <View style={styles.cerrar} />
      </View>

      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={styles.contenido} keyboardShouldPersistTaps="handled">
          {sonDeEjemplo ? <AvisoEjemplo /> : null}

          <Campo etiqueta="¿Qué compraste?">
            {elegido ? (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`${elegido.nombre}, toca para cambiar`}
                onPress={() => {
                  setElegido(null);
                  setNombre(elegido.nombre);
                }}
                style={[styles.elegido, { backgroundColor: theme.superficie, borderColor: theme.primario }]}>
                <Check size={IconSize.sm} color={theme.primario} />
                <View style={{ flex: 1 }}>
                  <ThemedText type="cuerpoFuerte">{elegido.nombre}</ThemedText>
                  <ThemedText type="chico" themeColor="textoTenue">
                    Ya está en tu catálogo · toca para cambiar
                  </ThemedText>
                </View>
              </Pressable>
            ) : (
              <EntradaTexto valor={nombre} onCambio={setNombre} etiqueta="Nombre del artículo" placeholder="Ej. PlayStation 5 Slim" autoFocus={!params.nombre} />
            )}
            {visibles.map((p) => (
              <Pressable
                key={p.id}
                accessibilityRole="button"
                accessibilityLabel={`Usar ${p.nombre}`}
                onPress={() => {
                  setElegido(p);
                }}
                style={({ pressed }) => [styles.sugerencia, { backgroundColor: theme.superficie, opacity: pressed ? 0.7 : 1 }]}>
                <ThemedText numberOfLines={1} style={{ flex: 1 }}>
                  {p.nombre}
                </ThemedText>
                <ThemedText type="chico" themeColor="textoTenue">
                  {nombreCategoria(p.categoria)}
                </ThemedText>
              </Pressable>
            ))}
            {!elegido && nombre.trim().length >= 2 ? (
              <View style={styles.nuevo}>
                <Plus size={14} color={theme.textoTenue} />
                <ThemedText type="chico" themeColor="textoTenue">
                  Si no está en la lista, se guarda como producto nuevo.
                </ThemedText>
              </View>
            ) : null}
          </Campo>

          {!elegido ? (
            <View style={styles.dos}>
              <View style={{ flex: 1 }}>
                <Campo etiqueta="Marca (opcional)">
                  <EntradaTexto valor={marca} onCambio={setMarca} etiqueta="Marca" placeholder="Ej. Sony" />
                </Campo>
              </View>
              <View style={{ flex: 1 }}>
                <Campo etiqueta="Categoría (opcional)">
                  <EntradaTexto valor={categoria} onCambio={setCategoria} etiqueta="Categoría" placeholder="Ej. Consolas" />
                </Campo>
              </View>
            </View>
          ) : null}

          <View style={{ gap: Spacing.xs }}>
            <CampoPesos etiqueta="¿Cuánto pagaste?" valor={precio} onCambio={setPrecio} autoFocus={Boolean(params.nombre)} />
            {params.maximo && Number(params.maximo) > 0 ? (
              <ThemedText type="chico" themeColor="textoSecundario">
                Según la calculadora, convenía pagar como máximo {pesos(Number(params.maximo))}.
              </ThemedText>
            ) : null}
          </View>

          <Campo etiqueta="¿Cuándo?">
            <View style={styles.pildoras}>
              <Pildora texto="Hoy" activa={cuando === 'hoy'} onPress={() => setCuando('hoy')} />
              <Pildora texto="Ayer" activa={cuando === 'ayer'} onPress={() => setCuando('ayer')} />
              <Pildora texto="Otra fecha" activa={cuando === 'otra'} onPress={() => setCuando('otra')} />
            </View>
            {cuando === 'otra' ? (
              <EntradaTexto valor={otraFecha} onCambio={setOtraFecha} etiqueta="Fecha de compra" placeholder="AAAA-MM-DD" />
            ) : null}
          </Campo>

          <Campo etiqueta="Condición">
            <View style={styles.pildoras}>
              {CONDICIONES.map((c) => (
                <Pildora key={c} texto={NOMBRE_CONDICION[c]} activa={condicion === c} onPress={() => setCondicion(c)} />
              ))}
            </View>
          </Campo>

          <Pressable
            accessibilityRole="button"
            aria-expanded={masDatos}
            onPress={() => setMasDatos((v) => !v)}
            style={styles.masDatos}>
            <ThemedText type="cuerpoFuerte" themeColor="textoSecundario">
              Más datos (opcional)
            </ThemedText>
            {masDatos ? <ChevronUp size={IconSize.sm} color={theme.textoSecundario} /> : <ChevronDown size={IconSize.sm} color={theme.textoSecundario} />}
          </Pressable>
          {masDatos ? (
            <>
              <Campo etiqueta="¿Dónde lo compraste?">
                <EntradaTexto valor={lugar} onCambio={setLugar} etiqueta="Lugar de compra" placeholder="Ej. Bazar del domingo" />
              </Campo>
              <Campo etiqueta="Notas">
                <EntradaTexto valor={notas} onCambio={setNotas} etiqueta="Notas" placeholder="Ej. Trae 1 control" multilinea />
              </Campo>
            </>
          ) : null}

          {error ? (
            <ThemedText type="chico" accessibilityRole="alert" style={{ color: theme.peligro }}>
              {error}
            </ThemedText>
          ) : null}
        </ScrollView>

        <SafeAreaView edges={['bottom']} style={[styles.acciones, { borderTopColor: theme.borde, backgroundColor: theme.fondo }]}>
          <Boton texto={guardando ? 'Guardando…' : 'Guardar en inventario'} onPress={guardar} />
        </SafeAreaView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function Campo({ etiqueta, children }: { etiqueta: string; children: React.ReactNode }) {
  return (
    <View style={{ gap: Spacing.sm }}>
      <ThemedText type="cuerpoFuerte">{etiqueta}</ThemedText>
      {children}
    </View>
  );
}

function EntradaTexto({
  valor,
  onCambio,
  etiqueta,
  placeholder,
  autoFocus,
  multilinea,
}: {
  valor: string;
  onCambio: (v: string) => void;
  etiqueta: string;
  placeholder: string;
  autoFocus?: boolean;
  multilinea?: boolean;
}) {
  const theme = useTheme();
  return (
    <TextInput
      accessibilityLabel={etiqueta}
      value={valor}
      onChangeText={onCambio}
      placeholder={placeholder}
      placeholderTextColor={theme.textoTenue}
      autoFocus={autoFocus}
      multiline={multilinea}
      style={[
        styles.entrada,
        multilinea && styles.multilinea,
        { color: theme.texto, backgroundColor: theme.superficie, borderColor: theme.borde },
      ]}
    />
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
  cerrar: {
    width: TocableMinimo,
    height: TocableMinimo,
    borderRadius: Radius.pildora,
    alignItems: 'center',
    justifyContent: 'center',
  },
  contenido: {
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing.xxl,
    gap: Spacing.xl,
  },
  entrada: {
    minHeight: TocableMinimo,
    borderWidth: 1,
    borderRadius: Radius.md,
    paddingHorizontal: Spacing.md,
    fontFamily: Fonts.regular,
    fontSize: 16,
  },
  multilinea: {
    minHeight: 88,
    paddingTop: Spacing.md,
    textAlignVertical: 'top',
  },
  elegido: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    minHeight: TocableMinimo,
    borderWidth: 1.5,
    borderRadius: Radius.md,
    padding: Spacing.md,
  },
  sugerencia: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    minHeight: TocableMinimo,
    borderRadius: Radius.md,
    paddingHorizontal: Spacing.md,
  },
  nuevo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
  },
  dos: {
    flexDirection: 'row',
    gap: Spacing.md,
  },
  pildoras: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm,
  },
  masDatos: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    minHeight: TocableMinimo,
  },
  acciones: {
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.md,
    paddingBottom: Spacing.md,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
});
