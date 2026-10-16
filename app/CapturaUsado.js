'use client';
import { useState } from 'react';
import SelectorProducto from './SelectorProducto';
import { api, CONDICIONES, FUENTES } from './historial-api';

const num = (v) => {
  const n = Number(String(v ?? '').replace(/[$,\s]/g, ''));
  return Number.isFinite(n) ? n : 0;
};

// Anotar en segundos un precio de usado visto en Marketplace u otro lado (Facebook no se
// automatiza: ver CLAUDE.md). Se suma a las referencias del producto.
export default function CapturaUsado({ producto: productoInicial, textoInicial, onGuardado }) {
  const [abierta, setAbierta] = useState(false);
  const [producto, setProducto] = useState(productoInicial || null);
  const [precio, setPrecio] = useState('');
  const [fuente, setFuente] = useState('marketplace');
  const [condicion, setCondicion] = useState('usado_bueno');
  const [url, setUrl] = useState('');
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState('');

  if (!abierta) {
    return (
      <button type="button" className="boton boton-secundario boton-mas" onClick={() => setAbierta(true)}>
        Anotar un precio de usado que viste
      </button>
    );
  }

  async function guardar(e) {
    e.preventDefault();
    if (!producto) return setError('Elige o agrega el producto.');
    if (!(num(precio) > 0)) return setError('Escribe el precio que viste.');
    setGuardando(true);
    setError('');
    try {
      await api('/api/capturas', {
        metodo: 'POST',
        datos: { producto_id: producto.id, precio: num(precio), fuente, condicion, url: url.trim() || null },
      });
      setAbierta(false);
      setPrecio('');
      setUrl('');
      onGuardado?.(producto);
    } catch (err) {
      setError(err.message);
    } finally {
      setGuardando(false);
    }
  }

  const chips = (opciones, valor, cambiar, etiqueta) => (
    <div className="campo">
      <span className="campo-etiqueta">{etiqueta}</span>
      <div className="chips" role="radiogroup" aria-label={etiqueta}>
        {opciones.map(([id, nombre]) => (
          <button key={id} type="button" role="radio" aria-checked={valor === id} className={`chip ${valor === id ? 'activo' : ''}`} onClick={() => cambiar(id)}>
            {nombre}
          </button>
        ))}
      </div>
    </div>
  );

  return (
    <form className="precios formulario captura" onSubmit={guardar}>
      <h3 className="ident-subtitulo">Precio de usado que viste</h3>
      <SelectorProducto valor={producto} onElegir={setProducto} textoInicial={textoInicial} onError={(err) => setError(err.message)} />
      <div className="campo campo-grande">
        <label htmlFor="precio-captura">Precio</label>
        <div className="entrada">
          <span aria-hidden="true">$</span>
          <input id="precio-captura" type="text" inputMode="numeric" autoComplete="off" value={precio} onChange={(e) => setPrecio(e.target.value)} autoFocus={Boolean(producto)} />
        </div>
      </div>
      {chips(FUENTES, fuente, setFuente, '¿Dónde?')}
      {chips(CONDICIONES, condicion, setCondicion, 'Condición')}
      <div className="campo">
        <label htmlFor="url-captura">Link (opcional)</label>
        <div className="entrada">
          <input id="url-captura" type="url" inputMode="url" autoComplete="off" placeholder="https://" value={url} onChange={(e) => setUrl(e.target.value)} />
        </div>
      </div>
      {error && <p className="negativo" role="alert">{error}</p>}
      <button type="submit" className="boton boton-buscar" disabled={guardando}>
        {guardando ? 'Guardando…' : 'Guardar precio'}
      </button>
      <button type="button" className="enlace enlace-volver" onClick={() => setAbierta(false)}>
        Cancelar
      </button>
    </form>
  );
}
