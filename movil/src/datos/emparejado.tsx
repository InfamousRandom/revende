import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';

import { borrarCodigo, guardarCodigo, leerCodigo } from './dispositivo';

type Estado = 'cargando' | 'emparejado' | 'sin_emparejar' | 'ejemplo';

type Contexto = {
  estado: Estado;
  emparejar: (codigo: string) => Promise<void>;
  olvidar: () => Promise<void>;
  /** Solo en desarrollo: entrar sin emparejar para ver la app con datos de ejemplo. */
  entrarConEjemplo: () => void;
};

const EmparejadoContexto = createContext<Contexto | null>(null);

export function EmparejadoProvider({ children }: { children: ReactNode }) {
  const [estado, setEstado] = useState<Estado>('cargando');

  useEffect(() => {
    leerCodigo()
      .then((c) => setEstado(c ? 'emparejado' : 'sin_emparejar'))
      .catch(() => setEstado('sin_emparejar'));
  }, []);

  const emparejar = useCallback(async (codigo: string) => {
    await guardarCodigo(codigo);
    setEstado('emparejado');
  }, []);

  const olvidar = useCallback(async () => {
    await borrarCodigo();
    setEstado('sin_emparejar');
  }, []);

  const entrarConEjemplo = useCallback(() => {
    if (__DEV__) setEstado('ejemplo');
  }, []);

  return (
    <EmparejadoContexto.Provider value={{ estado, emparejar, olvidar, entrarConEjemplo }}>
      {children}
    </EmparejadoContexto.Provider>
  );
}

export function useEmparejado(): Contexto {
  const c = useContext(EmparejadoContexto);
  if (!c) throw new Error('useEmparejado fuera de EmparejadoProvider');
  return c;
}
