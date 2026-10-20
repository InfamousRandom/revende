/**
 * Gastos del mes que no son de un artículo (gasolina, publicidad, bolsas…). Solo sirven para la
 * ganancia neta en Estadísticas; la calculadora de compra no los usa.
 */
import { Receipt, X } from 'lucide-react-native';
import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, TextInput, View } from 'react-native';

import { CampoPesos, Hoja } from '@/components/hoja';
import { ThemedText } from '@/components/themed-text';
import { Boton, Tarjeta } from '@/components/ui';
import { Fonts, IconSize, Radius, Spacing, TocableMinimo } from '@/constants/theme';
import * as api from '@/datos/api';
import { hoy, useArticulos } from '@/datos/articulos';
import { fechaCorta, pesos } from '@/datos/formato';
import { useTheme } from '@/hooks/use-theme';

const EJEMPLO: api.GastoApi[] = [{ id: 1, concepto: 'Gasolina (ejemplo)', monto: 350, fecha: '2026-10-11' }];

/** Lista y total de gastos de un mes ('AAAA-MM'). `onTotal` avisa el total para la ganancia neta. */
export function TarjetaGastos({ mes, titulo, onTotal }: { mes: string; titulo: string; onTotal: (total: number) => void }) {
  const theme = useTheme();
  const { sonDeEjemplo } = useArticulos();
  const [gastos, setGastos] = useState<api.GastoApi[]>(sonDeEjemplo ? EJEMPLO : []);
  const [abierta, setAbierta] = useState(false);
  const [porBorrar, setPorBorrar] = useState<api.GastoApi | null>(null);
  const [concepto, setConcepto] = useState('');
  const [monto, setMonto] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [guardando, setGuardando] = useState(false);
  const total = gastos.reduce((s, g) => s + g.monto, 0);

  useEffect(() => {
    if (sonDeEjemplo) return;
    let vigente = true;
    void api.listarGastos(mes).then((r) => {
      if (vigente && r.ok) setGastos(r.datos.gastos);
    });
    return () => {
      vigente = false;
    };
  }, [sonDeEjemplo, mes]);

  useEffect(() => onTotal(total), [total, onTotal]);

  const guardar = async () => {
    if (!concepto.trim()) return setError('Escribe en qué gastaste.');
    if (!(Number(monto) > 0)) return setError('Escribe cuánto gastaste.');
    setGuardando(true);
    setError(null);
    const datos = { concepto: concepto.trim(), monto: Number(monto), fecha: hoy() };
    if (sonDeEjemplo) {
      setGastos((g) => [{ id: Date.now(), ...datos }, ...g]);
    } else {
      const r = await api.crearGasto(datos);
      if (!r.ok) {
        setGuardando(false);
        return setError(r.error);
      }
      setGastos((g) => [r.datos.gasto, ...g]);
    }
    setGuardando(false);
    setConcepto('');
    setMonto('');
    setAbierta(false);
  };

  const borrar = async (g: api.GastoApi) => {
    if (!sonDeEjemplo) {
      const r = await api.borrarGasto(g.id);
      if (!r.ok) return setError(r.error);
    }
    setGastos((lista) => lista.filter((x) => x.id !== g.id));
    setPorBorrar(null);
  };

  return (
    <Tarjeta style={{ gap: Spacing.sm }}>
      <View style={styles.titulo}>
        <Receipt size={IconSize.sm} color={theme.textoSecundario} />
        <ThemedText type="cuerpoFuerte" style={{ flex: 1 }}>
          {titulo}
        </ThemedText>
        <ThemedText type="cuerpoFuerte" style={{ color: total ? theme.peligro : theme.textoTenue }}>
          {total ? `−${pesos(total)}` : '$0'}
        </ThemedText>
      </View>
      {gastos.map((g) => (
        <View key={g.id} style={styles.fila}>
          <View style={{ flex: 1 }}>
            <ThemedText numberOfLines={1}>{g.concepto}</ThemedText>
            <ThemedText type="chico" themeColor="textoTenue">
              {fechaCorta(g.fecha)}
            </ThemedText>
          </View>
          <ThemedText type="cuerpoFuerte">{pesos(g.monto)}</ThemedText>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`Quitar ${g.concepto}`}
            hitSlop={8}
            onPress={() => setPorBorrar(g)}
            style={styles.quitar}>
            <X size={IconSize.sm} color={theme.textoTenue} />
          </Pressable>
        </View>
      ))}
      {!gastos.length ? (
        <ThemedText type="chico" themeColor="textoSecundario">
          Gasolina, publicidad, bolsas… lo que no es de un artículo. Se resta de tu ganancia del mes.
        </ThemedText>
      ) : null}
      <Boton texto="Agregar gasto" variante="secundario" onPress={() => setAbierta(true)} />

      <Hoja visible={abierta} titulo="Agregar gasto" onCerrar={() => setAbierta(false)}>
        <View style={{ gap: Spacing.xs }}>
          <ThemedText type="chico" themeColor="textoSecundario">
            ¿En qué?
          </ThemedText>
          <TextInput
            accessibilityLabel="En qué gastaste"
            value={concepto}
            onChangeText={setConcepto}
            placeholder="Ej. Gasolina"
            placeholderTextColor={theme.textoTenue}
            autoFocus
            style={[styles.entrada, { color: theme.texto, borderColor: theme.borde, backgroundColor: theme.superficie }]}
          />
        </View>
        <CampoPesos etiqueta="¿Cuánto?" valor={monto} onCambio={setMonto} />
        {error ? (
          <ThemedText type="chico" accessibilityRole="alert" style={{ color: theme.peligro }}>
            {error}
          </ThemedText>
        ) : null}
        <Boton texto={guardando ? 'Guardando…' : 'Guardar'} onPress={guardar} />
      </Hoja>

      <Hoja visible={porBorrar != null} titulo="¿Quitar este gasto?" onCerrar={() => setPorBorrar(null)}>
        <ThemedText themeColor="textoSecundario">
          {porBorrar ? `${porBorrar.concepto}, ${pesos(porBorrar.monto)}` : ''}
        </ThemedText>
        <Boton texto="Sí, quitar" onPress={() => porBorrar && borrar(porBorrar)} />
        <Boton texto="Cancelar" variante="secundario" onPress={() => setPorBorrar(null)} />
      </Hoja>
    </Tarjeta>
  );
}

const styles = StyleSheet.create({
  titulo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  fila: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
  },
  quitar: {
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  entrada: {
    minHeight: TocableMinimo,
    borderWidth: 1,
    borderRadius: Radius.md,
    paddingHorizontal: Spacing.md,
    fontFamily: Fonts.regular,
    fontSize: 16,
  },
});
