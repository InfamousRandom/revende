import { ChartColumn, Clock, TrendingUp, Wallet, type LucideIcon } from 'lucide-react-native';
import { useMemo, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';

import { Pantalla } from '@/components/pantalla';
import { PantallaVacia } from '@/components/pantalla-vacia';
import { ThemedText } from '@/components/themed-text';
import { TarjetaGastos } from '@/components/gastos';
import { AvisoEjemplo, Tarjeta } from '@/components/ui';
import { IconSize, Radius, Spacing } from '@/constants/theme';
import { hoy, useArticulos } from '@/datos/articulos';
import { diasEntre, mesDe, pesos, pesosConSigno } from '@/datos/formato';
import { estadoDe, gananciaDe, nombreCategoria } from '@/datos/tipos';
import { useTheme } from '@/hooks/use-theme';

const HOY = hoy();

export default function Estadisticas() {
  const { articulos, sonDeEjemplo } = useArticulos();
  const theme = useTheme();
  const [gastosMes, setGastosMes] = useState(0);
  const tituloGastos = `Gastos de ${mesDe(HOY).toLowerCase()}`;

  const datos = useMemo(() => {
    const mesActual = HOY.slice(0, 7);
    const vendidos = articulos.filter((a) => a.fechaVenta);
    const delMes = vendidos.filter((a) => a.fechaVenta?.startsWith(mesActual));
    const gananciaMes = delMes.reduce((s, a) => s + (gananciaDe(a) ?? 0), 0);
    const invertido = articulos
      .filter((a) => ['inventario', 'publicado'].includes(estadoDe(a)))
      .reduce((s, a) => s + (a.precioCompra ?? 0), 0);
    const dias = vendidos.filter((a) => a.fechaCompra).map((a) => diasEntre(a.fechaCompra as string, a.fechaVenta as string));
    const diasPromedio = dias.length ? Math.round(dias.reduce((s, d) => s + d, 0) / dias.length) : null;

    const porCategoria = new Map<string | null, number>();
    for (const a of vendidos) {
      const g = gananciaDe(a);
      if (g != null) porCategoria.set(a.categoria, (porCategoria.get(a.categoria) ?? 0) + g);
    }
    const categorias = [...porCategoria].sort((x, y) => y[1] - x[1]);

    return { gananciaMes, vendidosMes: delMes.length, invertido, diasPromedio, categorias, hayVentas: vendidos.length > 0 };
  }, [articulos]);

  if (!datos.hayVentas) {
    return (
      <Pantalla titulo="Estadísticas">
        <PantallaVacia
          Icono={ChartColumn}
          titulo="Aún no hay números"
          texto="Cuando registres ventas verás tu ganancia del mes, lo invertido y cuánto tardas en vender."
        />
        <View style={styles.contenido}>
          <TarjetaGastos mes={HOY.slice(0, 7)} titulo={tituloGastos} onTotal={setGastosMes} />
        </View>
      </Pantalla>
    );
  }

  const maxCategoria = Math.max(...datos.categorias.map(([, g]) => Math.abs(g)), 1);

  return (
    <Pantalla titulo="Estadísticas">
      {sonDeEjemplo ? <AvisoEjemplo /> : null}
      <ScrollView contentContainerStyle={styles.contenido}>
        <Tarjeta>
          <ThemedText themeColor="textoSecundario">Ganancia de {mesDe(HOY).toLowerCase()}</ThemedText>
          <ThemedText type="titulo" style={{ color: datos.gananciaMes >= 0 ? theme.dinero : theme.peligro }}>
            {pesosConSigno(datos.gananciaMes)}
          </ThemedText>
          <ThemedText type="chico" themeColor="textoTenue">
            {datos.vendidosMes} {datos.vendidosMes === 1 ? 'venta' : 'ventas'} este mes
          </ThemedText>
          {gastosMes ? (
            <ThemedText type="cuerpoFuerte" style={{ marginTop: Spacing.sm }}>
              Después de gastos:{' '}
              <ThemedText
                type="cuerpoFuerte"
                style={{ color: datos.gananciaMes - gastosMes >= 0 ? theme.dinero : theme.peligro }}>
                {pesosConSigno(datos.gananciaMes - gastosMes)}
              </ThemedText>
            </ThemedText>
          ) : null}
        </Tarjeta>

        <TarjetaGastos mes={HOY.slice(0, 7)} titulo={tituloGastos} onTotal={setGastosMes} />

        <View style={styles.cuadros}>
          <Cuadro Icono={Wallet} titulo="Invertido ahora" valor={pesos(datos.invertido)} />
          <Cuadro
            Icono={Clock}
            titulo="Días para vender"
            valor={datos.diasPromedio != null ? `${datos.diasPromedio} días` : '—'}
          />
        </View>

        <Tarjeta style={styles.categorias}>
          <View style={styles.tituloSeccion}>
            <TrendingUp size={IconSize.sm} color={theme.textoSecundario} />
            <ThemedText type="cuerpoFuerte">Ganancia por categoría</ThemedText>
          </View>
          {datos.categorias.map(([categoria, ganancia]) => (
            <View key={categoria ?? 'sin'} style={styles.categoria}>
              <View style={styles.filaCategoria}>
                <ThemedText>{nombreCategoria(categoria)}</ThemedText>
                <ThemedText type="cuerpoFuerte" style={{ color: ganancia >= 0 ? theme.dinero : theme.peligro }}>
                  {pesosConSigno(ganancia)}
                </ThemedText>
              </View>
              <View style={[styles.barraFondo, { backgroundColor: theme.superficieAlta }]}>
                <View
                  style={[
                    styles.barra,
                    {
                      width: `${(Math.abs(ganancia) / maxCategoria) * 100}%`,
                      backgroundColor: ganancia >= 0 ? theme.dinero : theme.peligro,
                    },
                  ]}
                />
              </View>
            </View>
          ))}
        </Tarjeta>
      </ScrollView>
    </Pantalla>
  );
}

function Cuadro({ Icono, titulo, valor }: { Icono: LucideIcon; titulo: string; valor: string }) {
  const theme = useTheme();
  return (
    <Tarjeta style={styles.cuadro}>
      <Icono size={IconSize.sm} color={theme.textoSecundario} />
      <ThemedText type="chico" themeColor="textoSecundario">
        {titulo}
      </ThemedText>
      <ThemedText type="subtitulo">{valor}</ThemedText>
    </Tarjeta>
  );
}

const styles = StyleSheet.create({
  contenido: {
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing.xxl,
    gap: Spacing.lg,
  },
  cuadros: {
    flexDirection: 'row',
    gap: Spacing.lg,
  },
  cuadro: {
    flex: 1,
    gap: Spacing.xs,
  },
  categorias: {
    gap: Spacing.lg,
  },
  tituloSeccion: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  categoria: {
    gap: Spacing.xs,
  },
  filaCategoria: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  barraFondo: {
    height: 8,
    borderRadius: Radius.pildora,
    overflow: 'hidden',
  },
  barra: {
    height: '100%',
    borderRadius: Radius.pildora,
  },
});
