/** Tarjetas de IA (Fase V8). Solo se muestran si están activas en FUNCIONES. */
import { ExternalLink, ShieldCheck, Sparkles } from 'lucide-react-native';
import { useState } from 'react';
import { ActivityIndicator, Linking, Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Boton, Destacado, Tarjeta } from '@/components/ui';
import { IconSize, Spacing } from '@/constants/theme';
import * as api from '@/datos/api';
import { useTheme } from '@/hooks/use-theme';

const VEREDICTO = { buena: 'Buena reventa', regular: 'Reventa regular', mala: 'Mala reventa' } as const;
const NIVEL = { sin_alertas: 'Sin señales de alerta', dudoso: 'Dudoso', posible_imitacion: 'Posible imitación' } as const;

type Estado<T> = { cargando: boolean; error: string | null; datos: T | null };

export function TarjetaInsight(props: { nombre: string; nuevo?: number; usado?: number; tus_ventas?: number }) {
  const theme = useTheme();
  const [estado, setEstado] = useState<Estado<api.InsightApi>>({ cargando: false, error: null, datos: null });
  const pedir = async () => {
    setEstado({ cargando: true, error: null, datos: null });
    const r = await api.pedirInsight(props);
    setEstado(r.ok ? { cargando: false, error: null, datos: r.datos } : { cargando: false, error: r.error, datos: null });
  };
  const d = estado.datos?.resultado;

  return (
    <Tarjeta style={styles.tarjeta}>
      <Encabezado Icono={Sparkles} titulo="¿Conviene para revender?" />
      {!estado.datos && !estado.cargando ? <Boton texto="Pedir opinión" variante="secundario" onPress={pedir} /> : null}
      {estado.cargando ? <ActivityIndicator color={theme.primario} /> : null}
      {estado.error ? (
        <ThemedText type="chico" style={{ color: theme.peligro }}>
          {estado.error}
        </ThemedText>
      ) : null}
      {d ? (
        <>
          <Destacado texto={VEREDICTO[d.veredicto] ?? d.veredicto} />
          <ThemedText>{d.resumen}</ThemedText>
          {d.razones.map((t) => (
            <ThemedText key={t} type="chico" themeColor="textoSecundario">
              • {t}
            </ThemedText>
          ))}
          {d.riesgos.map((t) => (
            <ThemedText key={t} type="chico" style={{ color: theme.peligro }}>
              Riesgo: {t}
            </ThemedText>
          ))}
          <Fuentes fuentes={estado.datos?.fuentes ?? []} />
        </>
      ) : null}
    </Tarjeta>
  );
}

export function TarjetaAutenticidad({ foto }: { foto: string }) {
  const theme = useTheme();
  const [estado, setEstado] = useState<Estado<api.AutenticidadApi>>({ cargando: false, error: null, datos: null });
  const revisar = async () => {
    setEstado({ cargando: true, error: null, datos: null });
    const r = await api.revisarAutenticidad(foto);
    setEstado(r.ok ? { cargando: false, error: null, datos: r.datos } : { cargando: false, error: r.error, datos: null });
  };
  const d = estado.datos?.resultado;

  return (
    <Tarjeta style={styles.tarjeta}>
      <Encabezado Icono={ShieldCheck} titulo="¿Es original?" />
      {!estado.datos && !estado.cargando ? <Boton texto="Revisar la foto" variante="secundario" onPress={revisar} /> : null}
      {estado.cargando ? <ActivityIndicator color={theme.primario} /> : null}
      {estado.error ? (
        <ThemedText type="chico" style={{ color: theme.peligro }}>
          {estado.error}
        </ThemedText>
      ) : null}
      {d ? (
        <>
          <Destacado texto={NIVEL[d.nivel] ?? d.nivel} />
          <ThemedText>{d.resumen}</ThemedText>
          {d.señales.map((t) => (
            <ThemedText key={t} type="chico" themeColor="textoSecundario">
              • {t}
            </ThemedText>
          ))}
          {d.revisar.length ? (
            <ThemedText type="chico" themeColor="textoSecundario">
              Revisa en persona: {d.revisar.join(', ')}.
            </ThemedText>
          ) : null}
          <ThemedText type="etiqueta" themeColor="textoTenue">
            Es una opinión sobre la foto, no una garantía.
          </ThemedText>
        </>
      ) : null}
    </Tarjeta>
  );
}

function Encabezado({ Icono, titulo }: { Icono: React.ComponentType<{ size?: number; color?: string }>; titulo: string }) {
  const theme = useTheme();
  return (
    <View style={styles.titulo}>
      <Icono size={IconSize.sm} color={theme.textoSecundario} />
      <ThemedText type="cuerpoFuerte" style={{ flex: 1 }}>
        {titulo}
      </ThemedText>
      <ThemedText type="etiqueta" themeColor="textoTenue">
        CON IA
      </ThemedText>
    </View>
  );
}

function Fuentes({ fuentes }: { fuentes: { titulo: string; url: string }[] }) {
  const theme = useTheme();
  if (!fuentes.length) return null;
  return (
    <View style={{ gap: Spacing.xs }}>
      <ThemedText type="etiqueta" themeColor="textoTenue">
        FUENTES
      </ThemedText>
      {fuentes.slice(0, 4).map((f) => (
        <Pressable
          key={f.url}
          accessibilityRole="link"
          accessibilityLabel={f.titulo || f.url}
          onPress={() => Linking.openURL(f.url)}
          style={styles.fuente}>
          <ThemedText type="chico" numberOfLines={1} style={{ color: theme.primario, flexShrink: 1 }}>
            {f.titulo || f.url}
          </ThemedText>
          <ExternalLink size={12} color={theme.primario} />
        </Pressable>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  tarjeta: { gap: Spacing.sm },
  titulo: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  fuente: { flexDirection: 'row', alignItems: 'center', gap: Spacing.xs, minHeight: 32 },
});
