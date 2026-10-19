import { router } from 'expo-router';
import { Search } from 'lucide-react-native';
import { StyleSheet, View } from 'react-native';

import { CampoBusqueda } from '@/components/campo-busqueda';
import { Pantalla } from '@/components/pantalla';
import { PantallaVacia } from '@/components/pantalla-vacia';
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
});
