import { router } from 'expo-router';
import { Layers, Package, Search } from 'lucide-react-native';
import { StyleSheet, View } from 'react-native';

import { CampoBusqueda } from '@/components/campo-busqueda';
import { ListaPendientes } from '@/components/lista-pendientes';
import { Pantalla } from '@/components/pantalla';
import { PantallaVacia } from '@/components/pantalla-vacia';
import { Boton } from '@/components/ui';
import { Spacing } from '@/constants/theme';

export default function Buscar() {
  return (
    <Pantalla titulo="Buscar">
      <View style={styles.campo}>
        <CampoBusqueda
          etiqueta="Nombre o modelo del artículo"
          placeholder="Nombre o modelo, ej. PS5 Slim"
          onBuscar={(consulta) => router.push({ pathname: '/resultado', params: { consulta } })}
        />
      </View>
      <View style={styles.atajos}>
        <Boton texto="Cartas Pokémon" variante="secundario" Icono={Layers} onPress={() => router.push('/cartas')} />
        <Boton texto="Ver lote" variante="secundario" Icono={Package} onPress={() => router.push('/lote')} />
      </View>
      <ListaPendientes />
      <PantallaVacia
        Icono={Search}
        titulo="Busca por nombre o modelo"
        texto="Escribe el nombre, el modelo o los dos, y toca la lupa para ver precios nuevos y usados con su tienda."
      />
    </Pantalla>
  );
}

const styles = StyleSheet.create({
  campo: {
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.sm,
  },
  atajos: {
    flexDirection: 'row',
    gap: Spacing.md,
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.md,
  },
});
