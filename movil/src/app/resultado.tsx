import { router, useLocalSearchParams } from 'expo-router';
import { Calculator, ExternalLink, X } from 'lucide-react-native';
import { useEffect, useState } from 'react';
import { Linking, Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { CampoBusqueda } from '@/components/campo-busqueda';
import { ThemedText } from '@/components/themed-text';
import { AvisoEjemplo, Boton, Destacado, Miniatura, Tarjeta } from '@/components/ui';
import { Fonts, IconSize, Radius, Spacing, TocableMinimo } from '@/constants/theme';
import { RESULTADO_EJEMPLO } from '@/datos/ejemplo';
import { pesos } from '@/datos/formato';
import type { Oferta } from '@/datos/tipos';
import { useTheme } from '@/hooks/use-theme';

const PASOS_FOTO = ['Revisando la foto', 'Identificando el artículo', 'Buscando precios', 'Listo'];
const PASOS_TEXTO = ['Buscando el artículo', 'Buscando precios', 'Listo'];

/**
 * Resultado de una búsqueda: por foto (desde el ＋) o por texto (`consulta`, nombre y/o modelo).
 * Por ahora siempre muestra el resultado de ejemplo.
 */
export default function Resultado() {
  const { consulta } = useLocalSearchParams<{ consulta?: string }>();
  // La clave reinicia el avance cada vez que cambia la búsqueda.
  return <Flujo key={consulta ?? 'foto'} consulta={consulta} />;
}

function Flujo({ consulta }: { consulta?: string }) {
  const pasos = consulta ? PASOS_TEXTO : PASOS_FOTO;
  const [paso, setPaso] = useState(0);
  const listo = paso >= pasos.length - 1;

  useEffect(() => {
    if (listo) return;
    const t = setTimeout(() => setPaso((p) => p + 1), 700);
    return () => clearTimeout(t);
  }, [paso, listo]);

  return listo ? <VistaResultado consulta={consulta} /> : <Procesando pasos={pasos} paso={paso} consulta={consulta} />;
}

function Procesando({ pasos, paso, consulta }: { pasos: string[]; paso: number; consulta?: string }) {
  const theme = useTheme();

  return (
    <SafeAreaView style={[styles.contenedor, styles.centrado, { backgroundColor: theme.fondo }]}>
      {consulta ? (
        <ThemedText type="subtitulo" style={{ textAlign: 'center' }}>
          «{consulta}»
        </ThemedText>
      ) : (
        <View style={styles.procesandoFoto}>
          <Miniatura categoria={RESULTADO_EJEMPLO.categoria} />
        </View>
      )}
      <View style={styles.pasos} accessibilityRole="progressbar" aria-valuenow={paso + 1} aria-valuemax={pasos.length}>
        {pasos.map((p, i) => (
          <View key={p} style={[styles.segmento, { backgroundColor: i <= paso ? theme.primario : theme.superficieAlta }]} />
        ))}
      </View>
      <ThemedText type="cuerpoFuerte" themeColor="textoSecundario" aria-live="polite">
        {pasos[paso]}…
      </ThemedText>
    </SafeAreaView>
  );
}

function VistaResultado({ consulta }: { consulta?: string }) {
  const theme = useTheme();
  const r = RESULTADO_EJEMPLO;
  const [venta, setVenta] = useState(String(r.usado.mediana));
  const [ganancia, setGanancia] = useState('800');
  const [aviso, setAviso] = useState<string | null>(null);

  const maximo = (Number(venta) || 0) - (Number(ganancia) || 0);
  const nuevos = r.ofertas.filter((o) => !o.usado);
  const usados = r.ofertas.filter((o) => o.usado);

  return (
    <SafeAreaView edges={['top']} style={[styles.contenedor, { backgroundColor: theme.fondo }]}>
      <View style={styles.barraSuperior}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Cerrar"
          onPress={() => router.dismissAll()}
          style={({ pressed }) => [styles.cerrar, { backgroundColor: theme.superficie, opacity: pressed ? 0.6 : 1 }]}>
          <X size={IconSize.md} color={theme.texto} />
        </Pressable>
        <ThemedText type="cuerpoFuerte">Resultado</ThemedText>
        <View style={styles.cerrar} />
      </View>

      <ScrollView contentContainerStyle={styles.contenido} keyboardShouldPersistTaps="handled">
        <AvisoEjemplo />
        {consulta ? (
          <ThemedText type="chico" themeColor="textoSecundario">
            Buscaste «{consulta}». Con datos de ejemplo siempre sale el mismo artículo.
          </ThemedText>
        ) : null}

        <CampoBusqueda
          etiqueta="Corregir el nombre o modelo"
          placeholder="¿No es? Corrige el nombre"
          onBuscar={(nueva) => router.setParams({ consulta: nueva })}
        />

        <Tarjeta style={styles.sugerencia}>
          <View style={styles.sugerenciaFoto}>
            <Miniatura categoria={r.categoria} tamano="chica" />
          </View>
          <View style={{ flex: 1, gap: Spacing.xs }}>
            <Destacado texto="SUGERIDO" />
            <ThemedText type="cuerpoFuerte">{r.nombre}</ThemedText>
            <ThemedText type="chico" themeColor="textoTenue">
              {r.marca}
              {r.lanzamiento ? ` · Lanzado en ${r.lanzamiento}` : ''}
            </ThemedText>
          </View>
        </Tarjeta>

        <View style={styles.dosColumnas}>
          <Rango titulo="Nuevo" rango={r.nuevo} />
          <Rango titulo="Usado" rango={r.usado} />
        </View>

        <Tarjeta style={styles.calculadora}>
          <View style={styles.tituloSeccion}>
            <Calculator size={IconSize.sm} color={theme.textoSecundario} />
            <ThemedText type="cuerpoFuerte">¿Cuánto pagar como máximo?</ThemedText>
          </View>
          <Campo etiqueta="Lo venderías en" valor={venta} onCambio={setVenta} />
          <Campo etiqueta="Ganancia que buscas" valor={ganancia} onCambio={setGanancia} />
          <View style={[styles.maximo, { backgroundColor: theme.superficieAlta }]}>
            <ThemedText themeColor="textoSecundario">Paga como máximo</ThemedText>
            <ThemedText type="titulo" style={{ color: maximo > 0 ? theme.dinero : theme.peligro }}>
              {maximo > 0 ? pesos(maximo) : 'No conviene'}
            </ThemedText>
          </View>
        </Tarjeta>

        <ListaOfertas titulo={`Nuevos (${nuevos.length})`} ofertas={nuevos} />
        <ListaOfertas titulo={`Usados y reacondicionados (${usados.length})`} ofertas={usados} />

        {aviso ? (
          <ThemedText type="chico" themeColor="textoSecundario" style={{ textAlign: 'center' }}>
            {aviso}
          </ThemedText>
        ) : null}
      </ScrollView>

      <SafeAreaView edges={['bottom']} style={[styles.acciones, { borderTopColor: theme.borde, backgroundColor: theme.fondo }]}>
        <View style={{ flex: 1 }}>
          <Boton texto={consulta ? 'Buscar otro' : 'Otra foto'} variante="secundario" onPress={() => router.back()} />
        </View>
        <View style={{ flex: 1 }}>
          <Boton texto="Lo compré" onPress={() => setAviso('«Lo compré» guardará en tu inventario en la Fase V2.')} />
        </View>
      </SafeAreaView>
    </SafeAreaView>
  );
}

function Rango({ titulo, rango }: { titulo: string; rango: { min: number; mediana: number; max: number } }) {
  const theme = useTheme();
  return (
    <Tarjeta style={{ flex: 1, gap: 2 }}>
      <ThemedText type="chico" themeColor="textoSecundario">
        {titulo}, precio típico
      </ThemedText>
      <ThemedText type="subtitulo" style={{ color: theme.dinero }}>
        {pesos(rango.mediana)}
      </ThemedText>
      <ThemedText type="chico" themeColor="textoTenue">
        {pesos(rango.min)} – {pesos(rango.max)}
      </ThemedText>
    </Tarjeta>
  );
}

function Campo({ etiqueta, valor, onCambio }: { etiqueta: string; valor: string; onCambio: (v: string) => void }) {
  const theme = useTheme();
  return (
    <View style={{ gap: Spacing.xs }}>
      <ThemedText type="chico" themeColor="textoSecundario">
        {etiqueta}
      </ThemedText>
      <View style={[styles.campo, { borderColor: theme.borde, backgroundColor: theme.fondo }]}>
        <ThemedText themeColor="textoTenue">$</ThemedText>
        <TextInput
          accessibilityLabel={etiqueta}
          value={valor}
          onChangeText={(t) => onCambio(t.replace(/\D/g, ''))}
          keyboardType="number-pad"
          inputMode="numeric"
          style={[styles.entrada, { color: theme.texto }]}
        />
      </View>
    </View>
  );
}

function ListaOfertas({ titulo, ofertas }: { titulo: string; ofertas: Oferta[] }) {
  const theme = useTheme();
  return (
    <View style={{ gap: Spacing.sm }}>
      <ThemedText type="cuerpoFuerte">{titulo}</ThemedText>
      {ofertas.map((o) => (
        <Pressable
          key={o.link}
          accessibilityRole="link"
          accessibilityLabel={`${o.titulo}, ${o.tienda}, ${pesos(o.precio)}`}
          onPress={() => Linking.openURL(o.link)}
          style={({ pressed }) => [styles.oferta, { backgroundColor: theme.superficie, opacity: pressed ? 0.7 : 1 }]}>
          <View style={{ flex: 1, gap: 2 }}>
            <ThemedText numberOfLines={1}>{o.titulo}</ThemedText>
            <View style={styles.tienda}>
              <ThemedText type="chico" themeColor="textoTenue">
                {o.tienda}
              </ThemedText>
              <ExternalLink size={14} color={theme.textoTenue} />
            </View>
          </View>
          <ThemedText type="precio">{pesos(o.precio)}</ThemedText>
        </Pressable>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  contenedor: {
    flex: 1,
  },
  centrado: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.xl,
    paddingHorizontal: Spacing.xxl,
  },
  procesandoFoto: {
    width: 160,
  },
  pasos: {
    flexDirection: 'row',
    gap: Spacing.sm,
    width: '100%',
    maxWidth: 320,
  },
  segmento: {
    flex: 1,
    height: 6,
    borderRadius: Radius.pildora,
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
    gap: Spacing.lg,
  },
  sugerencia: {
    flexDirection: 'row',
    gap: Spacing.md,
    alignItems: 'center',
  },
  sugerenciaFoto: {
    alignSelf: 'flex-start',
  },
  dosColumnas: {
    flexDirection: 'row',
    gap: Spacing.lg,
  },
  calculadora: {
    gap: Spacing.md,
  },
  tituloSeccion: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  campo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    minHeight: TocableMinimo,
    borderWidth: 1,
    borderRadius: Radius.md,
    paddingHorizontal: Spacing.md,
  },
  entrada: {
    flex: 1,
    fontFamily: Fonts.seminegrita,
    fontSize: 16,
    minHeight: TocableMinimo,
  },
  maximo: {
    borderRadius: Radius.md,
    padding: Spacing.md,
    gap: 2,
  },
  oferta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    borderRadius: Radius.md,
    padding: Spacing.md,
    minHeight: TocableMinimo + 16,
  },
  tienda: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
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
