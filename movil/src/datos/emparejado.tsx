import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';

import { cuandoSeRechaceElCodigo } from './api';
import { borrarCodigo, guardarCodigo, leerCodigo } from './dispositivo';

type Estado = 'cargando' | 'emparejado' | 'sin_emparejar' | 'ejemplo';

type Contexto = {
  estado: Estado;
  /** Código guardado (para las fotos, que lo mandan en el encabezado). */
  codigo: string | null;
  emparejar: (codigo: string) => Promise<void>;
  olvidar: () => Promise<void>;
  /** Solo en desarrollo: entrar sin emparejar para ver la app con datos de ejemplo. */
  entrarConEjemplo: () => void;
};

const EmparejadoContexto = createContext<Contexto | null>(null);

export function EmparejadoProvider({ children }: { children: ReactNode }) {
  const [estado, setEstado] = useState<Estado>('cargando');
  const [codigo, setCodigo] = useState<string | null>(null);

  useEffect(() => {
    leerCodigo()
      .then((c) => {
        setCodigo(c);
        setEstado(c ? 'emparejado' : 'sin_emparejar');
      })
      .catch(() => setEstado('sin_emparejar'));
  }, []);

  const emparejar = useCallback(async (nuevo: string) => {
    await guardarCodigo(nuevo);
    setCodigo(nuevo);
    setEstado('emparejado');
  }, []);

  const olvidar = useCallback(async () => {
    await borrarCodigo();
    setCodigo(null);
    setEstado('sin_emparejar');
  }, []);

  // Si el código cambió en Cloudflare, el Worker responde 401: se pide emparejar otra vez.
  useEffect(() => {
    cuandoSeRechaceElCodigo(() => {
      void olvidar();
    });
    return () => cuandoSeRechaceElCodigo(null);
  }, [olvidar]);

  const entrarConEjemplo = useCallback(() => {
    if (__DEV__) setEstado('ejemplo');
  }, []);

  return (
    <EmparejadoContexto.Provider value={{ estado, codigo, emparejar, olvidar, entrarConEjemplo }}>
      {children}
    </EmparejadoContexto.Provider>
  );
}

export function useEmparejado(): Contexto {
  const c = useContext(EmparejadoContexto);
  if (!c) throw new Error('useEmparejado fuera de EmparejadoProvider');
  return c;
}
