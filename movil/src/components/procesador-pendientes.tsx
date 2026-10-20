/**
 * Hace solas las búsquedas guardadas sin señal en cuanto vuelve el internet (una por una).
 * No dibuja nada; la lista y sus resultados se ven en la pestaña Buscar.
 */
import { useNetworkState } from 'expo-network';
import { useEffect, useRef, useState } from 'react';

import { buscar, SinConexion } from '@/datos/busqueda';
import { useEmparejado } from '@/datos/emparejado';
import { actualizarPendiente, usePendientes } from '@/datos/pendientes';

// Si el celular dice que hay internet pero el servidor no responde (wifi sin salida), no reintentar
// sin parar: esperar un poco entre intentos.
const ESPERA_MS = 30_000;

export function ProcesadorPendientes() {
  const red = useNetworkState();
  const { estado } = useEmparejado();
  const pendientes = usePendientes();
  const corriendo = useRef(false);
  const [pausaHasta, setPausaHasta] = useState(0);
  const [, setTic] = useState(0);
  const conectado = red.isConnected === true && red.isInternetReachable !== false;
  const hayEsperando = pendientes.some((p) => p.estado === 'esperando');

  useEffect(() => {
    if (estado !== 'emparejado' || !conectado || !hayEsperando || corriendo.current) return;
    const falta = pausaHasta - Date.now();
    if (falta > 0) {
      const t = setTimeout(() => setTic((n) => n + 1), falta);
      return () => clearTimeout(t);
    }
    corriendo.current = true;
    void (async () => {
      for (const p of pendientes.filter((x) => x.estado === 'esperando')) {
        actualizarPendiente(p.id, { estado: 'buscando' });
        try {
          actualizarPendiente(p.id, { estado: 'listo', resultado: await buscar(p.entrada), error: undefined });
        } catch (e) {
          // Se volvió a ir la señal: se queda esperando y se reintenta después.
          if (e instanceof SinConexion) {
            setPausaHasta(Date.now() + ESPERA_MS);
            actualizarPendiente(p.id, { estado: 'esperando' });
            break;
          }
          actualizarPendiente(p.id, { estado: 'error', error: e instanceof Error ? e.message : 'No se encontró' });
        }
      }
      corriendo.current = false;
    })();
  });

  return null;
}
