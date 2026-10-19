import { router, useLocalSearchParams } from 'expo-router';
import { ChevronLeft, CircleCheck, Tag } from 'lucide-react-native';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { AvisoEjemplo, Boton, EtiquetaEstado, Miniatura, Tarjeta } from '@/components/ui';
import { IconSize, Radius, Spacing, TocableMinimo } from '@/constants/theme';
import { useArticulo, useArticulos } from '@/datos/articulos';
import { diasEntre, fechaCorta, pesos, pesosConSigno } from '@/datos/formato';
import {
  NOMBRE_CANAL,
  NOMBRE_CATEGORIA,
  NOMBRE_CONDICION,
  estadoDe,
  gananciaDe,
} from '@/datos/tipos';
import { useTheme } from '@/hooks/use-theme';

export default function FichaArticulo() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const articulo = useArticulo(Number(id));
  const { sonDeEjemplo } = useArticulos();
  const theme = useTheme();
  const [aviso, setAviso] = useState<string | null>(null);

  if (!articulo) {
    return (
      <SafeAreaView style={[styles.contenedor, { backgroundColor: theme.fondo }]}>
        <BotonAtras />
        <ThemedText style={styles.margen}>No encontramos este artículo.</ThemedText>
      </SafeAreaView>
    );
  }

  const estado = estadoDe(articulo);
  const ganancia = gananciaDe(articulo);
  const avisar = (accion: string) =>
    setAviso(`«${accion}» todavía no guarda nada: se conecta en la Fase V2.`);

  return (
    <SafeAreaView edges={['top']} style={[styles.contenedor, { backgroundColor: theme.fondo }]}>
      <BotonAtras />
      <ScrollView contentContainerStyle={styles.contenido}>
        {sonDeEjemplo ? <AvisoEjemplo /> : null}

        <View style={styles.margen}>
          <Miniatura categoria={articulo.categoria} />
        </View>

        <View style={[styles.margen, styles.encabezado]}>
          <EtiquetaEstado estado={estado} />
          <ThemedText type="titulo" accessibilityRole="header">
            {articulo.nombre}
          </ThemedText>
          <ThemedText themeColor="textoSecundario">
            {articulo.marca} · {NOMBRE_CATEGORIA[articulo.categoria]} · {NOMBRE_CONDICION[articulo.condicion]}
          </ThemedText>
        </View>

        {ganancia != null ? (
          <Tarjeta style={styles.margen}>
            <ThemedText themeColor="textoSecundario">Ganancia</ThemedText>
            <ThemedText type="titulo" style={{ color: ganancia >= 0 ? theme.dinero : theme.peligro }}>
              {pesosConSigno(ganancia)}
            </ThemedText>
            {articulo.fechaVenta ? (
              <ThemedText type="chico" themeColor="textoTenue">
                Vendido en {diasEntre(articulo.fechaCompra, articulo.fechaVenta)} días
              </ThemedText>
            ) : null}
          </Tarjeta>
        ) : null}

        <Tarjeta style={[styles.margen, styles.filas]}>
          <Fila titulo="Compra" valor={pesos(articulo.precioCompra)} detalle={detalleCompra(articulo.fechaCompra, articulo.lugarCompra)} />
          {articulo.precioPublicado && articulo.fechaPublicado ? (
            <Fila titulo="Publicado" valor={pesos(articulo.precioPublicado)} detalle={fechaCorta(articulo.fechaPublicado)} />
          ) : null}
          {articulo.precioVenta != null && articulo.fechaVenta ? (
            <Fila
              titulo="Venta"
              valor={pesos(articulo.precioVenta)}
              detalle={`${fechaCorta(articulo.fechaVenta)}${articulo.canal ? ` · ${NOMBRE_CANAL[articulo.canal]}` : ''}`}
            />
          ) : null}
          {articulo.fechaDescartado ? (
            <Fila titulo="Descartado" valor="—" detalle={fechaCorta(articulo.fechaDescartado)} />
          ) : null}
        </Tarjeta>

        {articulo.notas ? (
          <Tarjeta style={styles.margen}>
            <ThemedText type="chico" themeColor="textoTenue">
              Notas
            </ThemedText>
            <ThemedText>{articulo.notas}</ThemedText>
          </Tarjeta>
        ) : null}

        {aviso ? (
          <ThemedText type="chico" themeColor="textoSecundario" style={[styles.margen, { textAlign: 'center' }]}>
            {aviso}
          </ThemedText>
        ) : null}
      </ScrollView>

      {estado === 'inventario' || estado === 'publicado' ? (
        <SafeAreaView edges={['bottom']} style={[styles.acciones, { borderTopColor: theme.borde, backgroundColor: theme.fondo }]}>
          {estado === 'inventario' ? (
            <View style={{ flex: 1 }}>
              <Boton texto="Publicado" variante="secundario" Icono={Tag} onPress={() => avisar('Publicado')} />
            </View>
          ) : null}
          <View style={{ flex: 1 }}>
            <Boton texto="Lo vendí" Icono={CircleCheck} onPress={() => avisar('Lo vendí')} />
          </View>
        </SafeAreaView>
      ) : null}
    </SafeAreaView>
  );
}

function detalleCompra(fecha: string, lugar?: string) {
  return lugar ? `${fechaCorta(fecha)} · ${lugar}` : fechaCorta(fecha);
}

function Fila({ titulo, valor, detalle }: { titulo: string; valor: string; detalle: string }) {
  return (
    <View style={styles.fila}>
      <View style={{ flex: 1, gap: 2 }}>
        <ThemedText type="cuerpoFuerte">{titulo}</ThemedText>
        <ThemedText type="chico" themeColor="textoTenue">
          {detalle}
        </ThemedText>
      </View>
      <ThemedText type="precio">{valor}</ThemedText>
    </View>
  );
}

function BotonAtras() {
  const theme = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="Regresar"
      onPress={() => (router.canGoBack() ? router.back() : router.replace('/'))}
      style={({ pressed }) => [styles.atras, { backgroundColor: theme.superficie, opacity: pressed ? 0.6 : 1 }]}>
      <ChevronLeft size={IconSize.md} color={theme.texto} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  contenedor: {
    flex: 1,
  },
  contenido: {
    gap: Spacing.lg,
    paddingBottom: Spacing.xxl,
  },
  margen: {
    marginHorizontal: Spacing.lg,
  },
  encabezado: {
    gap: Spacing.sm,
  },
  filas: {
    gap: Spacing.lg,
  },
  fila: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
  },
  atras: {
    width: TocableMinimo,
    height: TocableMinimo,
    borderRadius: Radius.pildora,
    alignItems: 'center',
    justifyContent: 'center',
    margin: Spacing.lg,
    marginBottom: Spacing.sm,
  },
  acciones: {
    flexDirection: 'row',
    gap: Spacing.md,
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.md,
    paddingBottom: Spacing.md,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
});
