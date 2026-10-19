import { router } from 'expo-router';
import { ReceiptText } from 'lucide-react-native';
import { useMemo } from 'react';
import { Pressable, RefreshControl, SectionList, StyleSheet, View } from 'react-native';

import { Pantalla } from '@/components/pantalla';
import { PantallaVacia } from '@/components/pantalla-vacia';
import { ThemedText } from '@/components/themed-text';
import { AvisoEjemplo, Miniatura } from '@/components/ui';
import { Spacing } from '@/constants/theme';
import { useArticulos } from '@/datos/articulos';
import { fechaCorta, mesDe, pesos } from '@/datos/formato';
import { NOMBRE_CANAL, type Articulo } from '@/datos/tipos';
import { useTheme } from '@/hooks/use-theme';

type Movimiento = { clave: string; tipo: 'compra' | 'venta'; fecha: string; monto: number; articulo: Articulo };

export default function Historial() {
  const { articulos, sonDeEjemplo, cargando, recargar } = useArticulos();
  const theme = useTheme();

  const secciones = useMemo(() => {
    const movimientos: Movimiento[] = [];
    for (const a of articulos) {
      if (a.precioCompra != null && a.fechaCompra) {
        movimientos.push({ clave: `c${a.id}`, tipo: 'compra', fecha: a.fechaCompra, monto: a.precioCompra, articulo: a });
      }
      if (a.precioVenta != null && a.fechaVenta) {
        movimientos.push({ clave: `v${a.id}`, tipo: 'venta', fecha: a.fechaVenta, monto: a.precioVenta, articulo: a });
      }
    }
    movimientos.sort((x, y) => y.fecha.localeCompare(x.fecha));
    const porMes = new Map<string, Movimiento[]>();
    for (const m of movimientos) {
      const mes = mesDe(m.fecha);
      porMes.set(mes, [...(porMes.get(mes) ?? []), m]);
    }
    return [...porMes].map(([title, data]) => ({ title, data }));
  }, [articulos]);

  if (articulos.length === 0) {
    return (
      <Pantalla titulo="Historial">
        <PantallaVacia
          Icono={ReceiptText}
          titulo="Tus compras y ventas"
          texto="Aquí vas a ver todo lo que has comprado y vendido, con su ganancia."
        />
      </Pantalla>
    );
  }

  return (
    <Pantalla titulo="Historial">
      {sonDeEjemplo ? <AvisoEjemplo /> : null}
      <SectionList
        sections={secciones}
        keyExtractor={(m) => m.clave}
        stickySectionHeadersEnabled={false}
        refreshControl={
          sonDeEjemplo ? undefined : <RefreshControl refreshing={cargando} onRefresh={recargar} tintColor={theme.primario} />
        }
        contentContainerStyle={styles.lista}
        renderSectionHeader={({ section }) => (
          <ThemedText type="cuerpoFuerte" themeColor="textoSecundario" style={styles.mes}>
            {section.title}
          </ThemedText>
        )}
        renderItem={({ item }) => <FilaMovimiento movimiento={item} />}
      />
    </Pantalla>
  );
}

function FilaMovimiento({ movimiento: m }: { movimiento: Movimiento }) {
  const theme = useTheme();
  const venta = m.tipo === 'venta';
  const detalle = venta
    ? `Venta · ${fechaCorta(m.fecha)}${m.articulo.canal ? ` · ${NOMBRE_CANAL[m.articulo.canal]}` : ''}`
    : `Compra · ${fechaCorta(m.fecha)}`;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${venta ? 'Venta' : 'Compra'} de ${m.articulo.nombre}, ${pesos(m.monto)}`}
      onPress={() => router.push({ pathname: '/articulo/[id]', params: { id: String(m.articulo.id) } })}
      style={({ pressed }) => [styles.fila, { opacity: pressed ? 0.7 : 1 }]}>
      <Miniatura categoria={m.articulo.categoria} portadaId={m.articulo.portadaId} tamano="chica" />
      <View style={styles.textos}>
        <ThemedText type="cuerpoFuerte" numberOfLines={1}>
          {m.articulo.nombre}
        </ThemedText>
        <ThemedText type="chico" themeColor="textoTenue" numberOfLines={1}>
          {detalle}
        </ThemedText>
      </View>
      <ThemedText type="precio" style={{ color: venta ? theme.dinero : theme.texto }}>
        {venta ? '+' : '−'}
        {pesos(m.monto)}
      </ThemedText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  lista: {
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing.xxl,
  },
  mes: {
    paddingTop: Spacing.lg,
    paddingBottom: Spacing.sm,
  },
  fila: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    minHeight: 72,
  },
  textos: {
    flex: 1,
    gap: 2,
  },
});
