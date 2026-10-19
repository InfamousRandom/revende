import { router } from 'expo-router';
import { Package } from 'lucide-react-native';
import { useMemo, useState } from 'react';
import { FlatList, Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { Pantalla } from '@/components/pantalla';
import { PantallaVacia } from '@/components/pantalla-vacia';
import { ThemedText } from '@/components/themed-text';
import { AvisoEjemplo, EtiquetaEstado, Miniatura, Pildora } from '@/components/ui';
import { Spacing } from '@/constants/theme';
import { useArticulos } from '@/datos/articulos';
import { pesos, pesosConSigno } from '@/datos/formato';
import { NOMBRE_CONDICION, NOMBRE_ESTADO, estadoDe, gananciaDe, type Articulo, type Estado } from '@/datos/tipos';
import { useTheme } from '@/hooks/use-theme';

const ESTADOS: Estado[] = ['inventario', 'publicado', 'vendido', 'descartado'];

export default function Inventario() {
  const { articulos, sonDeEjemplo } = useArticulos();
  const [estado, setEstado] = useState<Estado>('inventario');
  const theme = useTheme();

  const porEstado = useMemo(() => {
    const grupos: Record<Estado, Articulo[]> = { inventario: [], publicado: [], vendido: [], descartado: [] };
    for (const a of articulos) grupos[estadoDe(a)].push(a);
    return grupos;
  }, [articulos]);

  const invertido = [...porEstado.inventario, ...porEstado.publicado].reduce((s, a) => s + a.precioCompra, 0);
  const visibles = porEstado[estado];

  if (articulos.length === 0) {
    return (
      <Pantalla titulo="Inventario">
        <PantallaVacia
          Icono={Package}
          titulo="Todavía no tienes artículos"
          texto="Toca el botón + para tomarle foto a algo, ver cuánto vale y guardarlo aquí."
        />
      </Pantalla>
    );
  }

  return (
    <Pantalla titulo="Inventario">
      {sonDeEjemplo ? <AvisoEjemplo /> : null}

      <View style={styles.resumen}>
        <ThemedText themeColor="textoSecundario">Tienes invertido</ThemedText>
        <ThemedText type="subtitulo" style={{ color: theme.texto }}>
          {pesos(invertido)}
        </ThemedText>
        <ThemedText type="chico" themeColor="textoTenue">
          en {porEstado.inventario.length + porEstado.publicado.length} artículos sin vender
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
      <Miniatura categoria={articulo.categoria} />
      <View style={styles.textos}>
        <ThemedText type="cuerpoFuerte" numberOfLines={2}>
          {articulo.nombre}
        </ThemedText>
        <ThemedText type="chico" themeColor="textoTenue" numberOfLines={1}>
          {NOMBRE_CONDICION[articulo.condicion]}
        </ThemedText>
        {estado === 'vendido' && ganancia != null ? (
          <>
            <ThemedText type="precio">{pesos(articulo.precioVenta ?? 0)}</ThemedText>
            <ThemedText type="chico" style={{ color: ganancia >= 0 ? theme.dinero : theme.peligro }}>
              {pesosConSigno(ganancia)} de ganancia
            </ThemedText>
          </>
        ) : (
          <>
            <ThemedText type="precio">{pesos(articulo.precioCompra)}</ThemedText>
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
