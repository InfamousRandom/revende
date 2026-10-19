import { TabList, TabSlot, TabTrigger, Tabs } from 'expo-router/ui';

import { BarraInferior } from '@/components/barra-inferior';

export default function SeccionesLayout() {
  return (
    <Tabs style={{ flex: 1 }}>
      <TabSlot style={{ flex: 1 }} />
      {/* Lista oculta que solo registra las rutas; la barra visible es BarraInferior. */}
      <TabList style={{ display: 'none' }}>
        <TabTrigger name="inventario" href="/" />
        <TabTrigger name="buscar" href="/buscar" />
        <TabTrigger name="historial" href="/historial" />
        <TabTrigger name="estadisticas" href="/estadisticas" />
      </TabList>
      <BarraInferior />
    </Tabs>
  );
}
