'use client';
import { useRef, useState } from 'react';
import { api, descargarRespaldo } from './historial-api';

// Exportar el historial a CSV e importar ventas pasadas. Importar primero prueba sin guardar
// y muestra qué pasaría; solo guarda al confirmar. Lo repetido se omite (no duplica).
export default function Respaldo({ onImportado, onError }) {
  const archivoRef = useRef(null);
  const [prueba, setPrueba] = useState(null); // { nombre, csv, resultado }
  const [ocupado, setOcupado] = useState(false);
  const [mensaje, setMensaje] = useState('');

  const fallo = (e) => setMensaje(e.message);

  async function descargar() {
    setOcupado(true);
    setMensaje('');
    try {
      setMensaje(`Descargado: ${await descargarRespaldo()}`);
    } catch (e) {
      fallo(e);
    } finally {
      setOcupado(false);
    }
  }

  async function elegir(e) {
    const archivo = e.target.files?.[0];
    e.target.value = '';
    if (!archivo) return;
    setOcupado(true);
    setMensaje('');
    try {
      const csv = await archivo.text();
      const resultado = await api('/api/importar?probar=1', { metodo: 'POST', csv });
      setPrueba({ nombre: archivo.name, csv, resultado });
    } catch (err) {
      fallo(err);
    } finally {
      setOcupado(false);
    }
  }

  async function confirmar() {
    setOcupado(true);
    try {
      const r = await api('/api/importar', { metodo: 'POST', csv: prueba.csv });
      setPrueba(null);
      const plural = (n, uno, varios) => `${n} ${n === 1 ? uno : varios}`;
      onImportado(
        `Importado: ${plural(r.registros, 'registro', 'registros')}${r.productos_nuevos ? ` y ${plural(r.productos_nuevos, 'producto nuevo', 'productos nuevos')}` : ''}`,
      );
    } catch (e) {
      fallo(e);
    } finally {
      setOcupado(false);
    }
  }

  const r = prueba?.resultado;
  return (
    <details className="mas-detalles respaldo">
      <summary>Respaldo (exportar e importar)</summary>
      <p className="vacio">Descarga todo tu historial en un archivo que abre Excel, o sube ventas pasadas.</p>
      <button type="button" className="boton boton-secundario" onClick={descargar} disabled={ocupado}>
        Descargar respaldo (CSV)
      </button>
      <button type="button" className="boton boton-secundario" onClick={() => archivoRef.current?.click()} disabled={ocupado}>
        Importar ventas (CSV)
      </button>
      <input ref={archivoRef} type="file" accept=".csv,text/csv" hidden onChange={elegir} />
      <p className="precios-pie">
        Columnas mínimas: producto, precio_venta, fecha_venta (AAAA-MM-DD o DD/MM/AAAA). Opcionales: categoria, precio_compra,
        fecha_compra, condicion, canal, notas y las demás del respaldo.
      </p>
      {mensaje && <p className="precios-pie">{mensaje}</p>}

      {r && (
        <div className="precios importacion" role="status">
          <p className="precios-producto">{prueba.nombre}</p>
          <ul className="lista-resumen">
            <li>
              <strong>{r.registros}</strong> {r.registros === 1 ? 'registro nuevo' : 'registros nuevos'}
              {r.productos_nuevos > 0 && ` (${r.productos_nuevos} ${r.productos_nuevos === 1 ? 'producto nuevo' : 'productos nuevos'})`}
            </li>
            {r.repetidos > 0 && <li>{r.repetidos} {r.repetidos === 1 ? 'repetido: se omite' : 'repetidos: se omiten'}</li>}
            {r.con_error > 0 && <li className="negativo">{r.con_error} {r.con_error === 1 ? 'fila con error: no se importa' : 'filas con error: no se importan'}</li>}
          </ul>
          {r.errores.length > 0 && (
            <ul className="errores-importacion">
              {r.errores.map((e) => (
                <li key={e.linea}>
                  Fila {e.linea}: {e.error}
                </li>
              ))}
            </ul>
          )}
          {r.registros > 0 ? (
            <button type="button" className="boton boton-buscar" onClick={confirmar} disabled={ocupado}>
              {ocupado ? 'Importando…' : `Importar ${r.registros} ${r.registros === 1 ? 'registro' : 'registros'}`}
            </button>
          ) : (
            <p className="precios-pie">No hay nada nuevo que importar.</p>
          )}
          <button type="button" className="enlace enlace-volver" onClick={() => setPrueba(null)}>
            Cancelar
          </button>
        </div>
      )}
    </details>
  );
}
