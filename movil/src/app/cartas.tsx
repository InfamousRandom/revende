import { Image } from 'expo-image';
import { router, useLocalSearchParams } from 'expo-router';
import { ExternalLink, Search, X } from 'lucide-react-native';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Linking, Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { PantallaVacia } from '@/components/pantalla-vacia';
import { ThemedText } from '@/components/themed-text';
import { Boton, Tarjeta } from '@/components/ui';
import { Fonts, IconSize, Radius, Spacing, TocableMinimo } from '@/constants/theme';
import * as api from '@/datos/api';
import { pesos } from '@/datos/formato';
import { useTheme } from '@/hooks/use-theme';

const DOLARES = new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'USD', maximumFractionDigits: 2 });
const VARIANTES: Record<string, string> = {
  normal: 'Normal',
  holofoil: 'Holo',
  reverseHolofoil: 'Reverse holo',
  '1stEditionHolofoil': '1a edición holo',
  '1stEditionNormal': '1a edición',
  unlimitedHolofoil: 'Unlimited holo',
};

/** Cartas Pokémon: precio de mercado de TCGplayer en dólares y su equivalente en pesos con la fuente. */
export default function Cartas() {
  const p = useLocalSearchParams<{ nombre?: string; numero?: string }>();
  const theme = useTheme();
  const [nombre, setNombre] = useState(p.nombre ?? '');
  const [numero, setNumero] = useState(p.numero ?? '');
  const [estado, setEstado] = useState<{ cargando: boolean; error: string | null; datos: { cartas: api.CartaApi[]; cambio: api.CambioApi; fuente: string } | null }>({
    cargando: Boolean(p.nombre || p.numero),
    error: null,
    datos: null,
  });

  const buscar = useCallback(async (n: string, num: string) => {
    if (n.trim().length < 2 && !num.trim()) return;
    setEstado({ cargando: true, error: null, datos: null });
    const r = await api.buscarCartas(n.trim(), num.trim());
    setEstado(r.ok ? { cargando: false, error: null, datos: r.datos } : { cargando: false, error: r.error, datos: null });
  }, []);

  // Si viene de la cámara, se busca al abrir.
  useEffect(() => {
    if (!p.nombre && !p.numero) return;
    let vigente = true;
    void api.buscarCartas((p.nombre ?? '').trim(), (p.numero ?? '').trim()).then((r) => {
      if (vigente) setEstado(r.ok ? { cargando: false, error: null, datos: r.datos } : { cargando: false, error: r.error, datos: null });
    });
    return () => {
      vigente = false;
    };
  }, [p.nombre, p.numero]);

  const cambio = estado.datos?.cambio ?? null;

  return (
    <SafeAreaView style={[styles.contenedor, { backgroundColor: theme.fondo }]}>
      <View style={styles.barraSuperior}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Cerrar"
          onPress={() => router.back()}
          style={({ pressed }) => [styles.circular, { backgroundColor: theme.superficie, opacity: pressed ? 0.6 : 1 }]}>
          <X size={IconSize.md} color={theme.texto} />
        </Pressable>
        <ThemedText type="cuerpoFuerte">Cartas Pokémon</ThemedText>
        <View style={styles.circular} />
      </View>

      <ScrollView contentContainerStyle={styles.contenido} keyboardShouldPersistTaps="handled">
        <View style={styles.formulario}>
          <View style={{ flex: 2, gap: Spacing.xs }}>
            <ThemedText type="chico" themeColor="textoSecundario">
              Nombre
            </ThemedText>
            <TextInput
              accessibilityLabel="Nombre de la carta"
              value={nombre}
              onChangeText={setNombre}
              placeholder="Ej. Charizard ex"
              placeholderTextColor={theme.textoTenue}
              autoCorrect={false}
              onSubmitEditing={() => buscar(nombre, numero)}
              style={[styles.entrada, { color: theme.texto, backgroundColor: theme.superficie, borderColor: theme.borde }]}
            />
          </View>
          <View style={{ flex: 1, gap: Spacing.xs }}>
            <ThemedText type="chico" themeColor="textoSecundario">
              Número
            </ThemedText>
            <TextInput
              accessibilityLabel="Número de la carta"
              value={numero}
              onChangeText={(t) => setNumero(t.replace(/[^0-9a-zA-Z]/g, ''))}
              placeholder="199"
              placeholderTextColor={theme.textoTenue}
              autoCapitalize="characters"
              onSubmitEditing={() => buscar(nombre, numero)}
              style={[styles.entrada, { color: theme.texto, backgroundColor: theme.superficie, borderColor: theme.borde }]}
            />
          </View>
        </View>
        <Boton texto="Buscar carta" Icono={Search} onPress={() => buscar(nombre, numero)} />

        {estado.cargando ? <ActivityIndicator color={theme.primario} style={{ marginTop: Spacing.xl }} /> : null}
        {estado.error ? (
          <ThemedText accessibilityRole="alert" style={{ color: theme.peligro }}>
            {estado.error}
          </ThemedText>
        ) : null}
        {estado.datos && !estado.datos.cartas.length ? (
          <PantallaVacia Icono={Search} titulo="No encontramos esa carta" texto="Revisa el nombre en inglés y el número de la esquina (ej. 199 de 199/165)." />
        ) : null}

        {estado.datos?.cartas.map((c) => (
          <Tarjeta key={c.id} style={styles.carta}>
            {c.imagen ? <Image source={{ uri: c.imagen }} style={styles.imagen} contentFit="contain" accessibilityLabel={`Carta ${c.nombre}`} /> : null}
            <View style={{ flex: 1, gap: Spacing.xs }}>
              <ThemedText type="cuerpoFuerte">{c.nombre}</ThemedText>
              <ThemedText type="chico" themeColor="textoTenue">
                {[`${c.numero}${c.total ? `/${c.total}` : ''}`, c.expansion, c.lanzamiento, c.rareza].filter(Boolean).join(' · ')}
              </ThemedText>
              {c.precios.length ? (
                c.precios.map((pr) => (
                  <View key={pr.variante} style={{ gap: 0 }}>
                    <ThemedText type="chico" themeColor="textoSecundario">
                      {VARIANTES[pr.variante] ?? pr.variante}
                    </ThemedText>
                    <ThemedText type="precio" style={{ color: theme.dinero }}>
                      {pr.mercado != null ? DOLARES.format(pr.mercado) : '—'}
                      {pr.mercado != null && cambio ? `  ≈ ${pesos(Math.round(pr.mercado * cambio.usd_mxn))}` : ''}
                    </ThemedText>
                  </View>
                ))
              ) : (
                <ThemedText type="chico" themeColor="textoTenue">
                  Sin precio en TCGplayer
                </ThemedText>
              )}
              <View style={styles.acciones}>
                {c.link ? (
                  <Pressable accessibilityRole="link" accessibilityLabel="Ver en TCGplayer" onPress={() => c.link && Linking.openURL(c.link)} style={styles.enlace}>
                    <ThemedText type="chico" style={{ color: theme.primario }}>
                      TCGplayer
                    </ThemedText>
                    <ExternalLink size={14} color={theme.primario} />
                  </Pressable>
                ) : null}
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={`Registrar compra de ${c.nombre}`}
                  onPress={() =>
                    router.push({
                      pathname: '/registrar',
                      params: {
                        nombre: `${c.nombre} ${c.numero}${c.total ? `/${c.total}` : ''}${c.expansion ? ` (${c.expansion})` : ''}`,
                        marca: 'Pokémon TCG',
                        categoria: 'Cartas',
                      },
                    })
                  }
                  style={styles.enlace}>
                  <ThemedText type="chico" style={{ color: theme.primario }}>
                    Lo compré
                  </ThemedText>
                </Pressable>
              </View>
            </View>
          </Tarjeta>
        ))}

        {estado.datos?.cartas.length ? (
          <ThemedText type="etiqueta" themeColor="textoTenue">
            Precio de mercado: {estado.datos.fuente}
            {estado.datos.cartas[0]?.actualizado ? `, actualizado ${estado.datos.cartas[0].actualizado}` : ''}.
            {cambio ? ` Pesos con tipo de cambio $${cambio.usd_mxn.toFixed(2)} del ${cambio.fecha} (${cambio.fuente}).` : ' Sin tipo de cambio disponible.'}
          </ThemedText>
        ) : null}
      </ScrollView>
    </SafeAreaView>
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
  contenido: {
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing.xxl,
    gap: Spacing.lg,
  },
  formulario: {
    flexDirection: 'row',
    gap: Spacing.md,
  },
  entrada: {
    minHeight: TocableMinimo,
    borderWidth: 1,
    borderRadius: Radius.md,
    paddingHorizontal: Spacing.md,
    fontFamily: Fonts.regular,
    fontSize: 16,
  },
  carta: {
    flexDirection: 'row',
    gap: Spacing.md,
  },
  imagen: {
    width: 96,
    height: 134,
    borderRadius: Radius.sm,
  },
  acciones: {
    flexDirection: 'row',
    gap: Spacing.lg,
    marginTop: Spacing.xs,
  },
  enlace: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    minHeight: 40,
  },
});
