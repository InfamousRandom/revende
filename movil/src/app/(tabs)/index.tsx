import { router } from 'expo-router';
import { Package, Plus } from 'lucide-react-native';
import { useMemo, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, RefreshControl, ScrollView, StyleSheet, View } from 'react-native';

import { Pantalla } from '@/components/pantalla';
import { PantallaVacia } from '@/components/pantalla-vacia';
import { ThemedText } from '@/components/themed-text';
import { AvisoEjemplo, Boton, EtiquetaEstado, Miniatura, Pildora } from '@/components/ui';
import { IconSize, Radius, Spacing, TocableMinimo } from '@/constants/theme';
import { useArticulos } from '@/datos/articulos';
import { pesos, pesosConSigno } from '@/datos/formato';
import { NOMBRE_CONDICION, NOMBRE_ESTADO, estadoDe, gananciaDe, type Articulo, type Estado } from '@/datos/tipos';
import { useTheme } from '@/hooks/use-theme';

const ESTADOS: Estado[] = ['inventario', 'publicado', 'vendido', 'descartado'];

export default function Inventario() {
  const { articulos, sonDeEjemplo, cargando, error, recargar } = useArticulos();
  const [estado, setEstado] = useState<Estado>('inventario');
  const theme = useTheme();

  const porEstado = useMemo(() => {
    const grupos: Record<Estado, Articulo[]> = { inventario: [], publicado: [], vendido: [], descartado: [] };
    for (const a of articulos) grupos[estadoDe(a)].push(a);
    return grupos;
  }, [articulos]);

  const sinVender = [...porEstado.inventario, ...porEstado.publicado];
  const invertido = sinVender.reduce((s, a) => s + (a.precioCompra ?? 0), 0);
  const visibles = porEstado[estado];

  const botonRegistrar = (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="Registrar una compra"
      onPress={() => router.push('/registrar')}
      style={({ pressed }) => [styles.registrar, { backgroundColor: theme.superficie, opacity: pressed ? 0.6 : 1 }]}>
      <Plus size={IconSize.md} color={theme.texto} />
    </Pressable>
  );

  if (cargando && !articulos.length) {
    return (
      <Pantalla titulo="Inventario" accion={botonRegistrar}>
        <ActivityIndicator color={theme.primario} style={{ marginTop: Spacing.xxxl }} />
      </Pantalla>
    );
  }

  if (error && !articulos.length) {
    return (
      <Pantalla titulo="Inventario" accion={botonRegistrar}>
        <PantallaVacia Icono={Package} titulo="No se pudo cargar tu inventario" texto={error} />
        <View style={styles.reintentar}>
          <Boton texto="Reintentar" onPress={recargar} />
        </View>
      </Pantalla>
    );
  }

  if (articulos.length === 0) {
    return (
      <Pantalla titulo="Inventario" accion={botonRegistrar}>
        <PantallaVacia
          Icono={Package}
          titulo="Todavía no tienes artículos"
          texto="Toca el botón + para tomarle foto a algo, ver cuánto vale y guardarlo aquí."
        />
      </Pantalla>
    );
  }

  return (
    <Pantalla titulo="Inventario" accion={botonRegistrar}>
      {sonDeEjemplo ? <AvisoEjemplo /> : null}

      <View style={styles.resumen}>
        <ThemedText themeColor="textoSecundario">Tienes invertido</ThemedText>
        <ThemedText type="subtitulo">{pesos(invertido)}</ThemedText>
        <ThemedText type="chico" themeColor="textoTenue">
          en {sinVender.length} {sinVender.length === 1 ? 'artículo' : 'artículos'} sin vender
        </ThemedText>
      </View>

      <View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.pildoras}>
          {ESTADOS.map((e) => (
            <Pildora
              key={e}
              texto={NOMBRE_ESTADO[e]}
              cuenta={porEstado[e].length}
              activa={estado === e}
              onPress={() => setEstado(e)}
            />
          ))}
        </ScrollView>
      </View>

      <FlatList
        data={visibles}
        keyExtractor={(a) => String(a.id)}
        numColumns={2}
        columnWrapperStyle={styles.fila}
        contentContainerStyle={styles.lista}
        refreshControl={
          sonDeEjemplo ? undefined : <RefreshControl refreshing={cargando} onRefresh={recargar} tintColor={theme.primario} />
        }
        renderItem={({ item }) => <TarjetaArticulo articulo={item} />}
        ListEmptyComponent={
          <ThemedText themeColor="textoSecundario" style={styles.vacio}>
            No hay artículos en «{NOMBRE_ESTADO[estado]}».
          </ThemedText>
        }
      />
    </Pantalla>
  );
}

function TarjetaArticulo({ articulo }: { articulo: Articulo }) {
  const theme = useTheme();
  const estado = estadoDe(articulo);
  const ganancia = gananciaDe(articulo);

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${articulo.nombre}, ${NOMBRE_ESTADO[estado]}`}
      onPress={() => router.push({ pathname: '/articulo/[id]', params: { id: String(articulo.id) } })}
      style={({ pressed }) => [styles.tarjeta, { opacity: pressed ? 0.75 : 1 }]}>
      <Miniatura categoria={articulo.categoria} portadaId={articulo.portadaId} />
      <View style={styles.textos}>
        <ThemedText type="cuerpoFuerte" numberOfLines={2}>
          {articulo.nombre}
        </ThemedText>
        {articulo.condicion ? (
          <ThemedText type="chico" themeColor="textoTenue" numberOfLines={1}>
            {NOMBRE_CONDICION[articulo.condicion]}
          </ThemedText>
        ) : null}
        {estado === 'vendido' ? (
          <>
            <ThemedText type="precio">{pesos(articulo.precioVenta ?? 0)}</ThemedText>
            {ganancia != null ? (
              <ThemedText type="chico" style={{ color: ganancia >= 0 ? theme.dinero : theme.peligro }}>
                {pesosConSigno(ganancia)} de ganancia
              </ThemedText>
            ) : null}
          </>
        ) : (
          <>
            <ThemedText type="precio">{articulo.precioCompra != null ? pesos(articulo.precioCompra) : '—'}</ThemedText>
            <ThemedText type="chico" themeColor="textoTenue">
              {estado === 'publicado' && articulo.precioPublicado
                ? `Publicado en ${pesos(articulo.precioPublicado)}`
                : 'Precio de compra'}
            </ThemedText>
          </>
        )}
        {estado === 'publicado' ? <EtiquetaEstado estado={estado} /> : null}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  registrar: {
    width: TocableMinimo,
    height: TocableMinimo,
    borderRadius: Radius.pildora,
    alignItems: 'center',
    justifyContent: 'center',
  },
  reintentar: {
    padding: Spacing.lg,
  },
  resumen: {
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing.md,
    gap: 2,
  },
  pildoras: {
    gap: Spacing.sm,
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing.md,
  },
  lista: {
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing.xxl,
    gap: Spacing.xl,
  },
  fila: {
    gap: Spacing.lg,
  },
  tarjeta: {
    flex: 1,
    maxWidth: '50%',
    gap: Spacing.sm,
  },
  textos: {
    gap: 2,
  },
  vacio: {
    textAlign: 'center',
    paddingTop: Spacing.xxl,
  },
});
