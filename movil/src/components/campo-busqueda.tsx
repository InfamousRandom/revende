import { Search, X } from 'lucide-react-native';
import { useState } from 'react';
import { Pressable, StyleSheet, TextInput, View } from 'react-native';

import { BotonVoz } from '@/components/boton-voz';
import { ThemedText } from '@/components/themed-text';
import { Fonts, IconSize, Radius, Spacing, TocableMinimo } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

type Props = {
  etiqueta: string;
  placeholder: string;
  valorInicial?: string;
  autoFocus?: boolean;
  /** Se llama solo al confirmar (Enter o lupa), nunca mientras se escribe: cuida la cuota de búsquedas. */
  onBuscar: (consulta: string) => void;
};

/** Campo de búsqueda por nombre y/o modelo. */
export function CampoBusqueda({ etiqueta, placeholder, valorInicial = '', autoFocus, onBuscar }: Props) {
  const theme = useTheme();
  const [texto, setTexto] = useState(valorInicial);
  const [errorVoz, setErrorVoz] = useState<string | null>(null);
  const consulta = texto.trim();
  const buscar = () => {
    if (consulta.length >= 2) onBuscar(consulta);
  };

  return (
    <View style={{ gap: Spacing.xs }}>
      <View style={[styles.campo, { backgroundColor: theme.superficie }]}>
        <TextInput
          accessibilityLabel={etiqueta}
          value={texto}
          onChangeText={setTexto}
          onSubmitEditing={buscar}
          placeholder={placeholder}
          placeholderTextColor={theme.textoTenue}
          returnKeyType="search"
          autoCorrect={false}
          autoFocus={autoFocus}
          style={[styles.entrada, { color: theme.texto }]}
        />
        {texto ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Borrar texto"
            onPress={() => setTexto('')}
            hitSlop={8}
            style={styles.icono}>
            <X size={IconSize.sm} color={theme.textoTenue} />
          </Pressable>
        ) : null}
        <BotonVoz
          onTexto={(t) => {
            setErrorVoz(null);
            setTexto(t);
          }}
          onError={setErrorVoz}
        />
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Buscar precios"
          aria-disabled={consulta.length < 2}
          onPress={buscar}
          style={({ pressed }) => [
            styles.lupa,
            { backgroundColor: consulta.length >= 2 ? theme.primario : theme.superficieAlta, opacity: pressed ? 0.7 : 1 },
          ]}>
          <Search size={IconSize.sm} color={consulta.length >= 2 ? theme.sobrePrimario : theme.textoTenue} />
        </Pressable>
      </View>
      {errorVoz ? (
        <ThemedText type="chico" accessibilityRole="alert" style={{ color: theme.peligro, paddingHorizontal: Spacing.lg }}>
          {errorVoz}
        </ThemedText>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  campo: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: TocableMinimo + 8,
    borderRadius: Radius.pildora,
    paddingLeft: Spacing.lg,
    paddingRight: Spacing.xs,
    gap: Spacing.xs,
  },
  entrada: {
    flex: 1,
    fontFamily: Fonts.regular,
    fontSize: 16,
    minHeight: TocableMinimo,
  },
  icono: {
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  lupa: {
    width: TocableMinimo,
    height: TocableMinimo,
    borderRadius: Radius.pildora,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
