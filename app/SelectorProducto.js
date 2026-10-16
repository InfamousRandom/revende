'use client';
import { useEffect, useRef, useState } from 'react';
import { api, CATEGORIAS } from './historial-api';

// Elegir un producto del catálogo con autocompletado, o crearlo en el momento.
// Busca en la base propia (D1) mientras se escribe; no gasta búsquedas de SerpApi.
export default function SelectorProducto({ valor, onElegir, textoInicial = '', onError }) {
  const [texto, setTexto] = useState(textoInicial);
  const [opciones, setOpciones] = useState([]);
  const [buscando, setBuscando] = useState(false);
  const [creando, setCreando] = useState(false);
  const [nuevo, setNuevo] = useState({ categoria: '', marca: '', codigo_barras: '' });
  const onErrorRef = useRef(onError);
  onErrorRef.current = onError;

  useEffect(() => {
    if (valor) return;
    const q = texto.trim();
    if (q.length < 2) {
      setOpciones([]);
      return;
    }
    let vigente = true;
    setBuscando(true);
    const reloj = setTimeout(async () => {
      try {
        const d = await api(`/api/productos?q=${encodeURIComponent(q)}`);
        if (vigente) setOpciones(d.productos);
      } catch (e) {
        if (vigente) onErrorRef.current?.(e);
      } finally {
        if (vigente) setBuscando(false);
      }
    }, 250);
    return () => {
      vigente = false;
      clearTimeout(reloj);
    };
  }, [texto, valor]);

  async function crear() {
    try {
      const esCodigo = /^\d{8,14}$/.test(texto.trim());
      const d = await api('/api/productos', {
        metodo: 'POST',
        datos: {
          nombre: texto.trim(),
          categoria: nuevo.categoria || null,
          marca: nuevo.marca || null,
          codigo_barras: nuevo.codigo_barras || (esCodigo ? texto.trim() : null),
        },
      });
      setCreando(false);
      onElegir(d.producto);
    } catch (e) {
      // Si el código de barras ya existía, usar ese producto.
      if (e.datos?.producto) {
        setCreando(false);
        onElegir(e.datos.producto);
      } else onError?.(e);
    }
  }

  if (valor) {
    return (
      <div className="campo">
        <span className="campo-etiqueta">Producto</span>
        <div className="producto-elegido">
          <div>
            <strong>{valor.nombre}</strong>
            {valor.categoria && <small>{valor.categoria}</small>}
          </div>
          <button type="button" className="enlace" onClick={() => onElegir(null)}>
            Cambiar
          </button>
        </div>
      </div>
    );
  }

  const q = texto.trim();
  return (
    <div className="campo selector-producto">
      <label htmlFor="producto">Producto</label>
      <div className="entrada">
        <input
          id="producto"
          type="text"
          autoComplete="off"
          placeholder="Ej. PS5 Slim, iPhone 13"
          value={texto}
          onChange={(e) => {
            setTexto(e.target.value);
            setCreando(false);
          }}
        />
      </div>
      {q.length >= 2 && !creando && (
        <ul className="sugerencias">
          {opciones.map((p) => (
            <li key={p.id}>
              <button type="button" onClick={() => onElegir(p)}>
                <strong>{p.nombre}</strong>
                <small>{[p.categoria, p.marca, p.operaciones ? `${p.operaciones} registros` : null].filter(Boolean).join(' · ')}</small>
              </button>
            </li>
          ))}
          {!buscando && (
            <li>
              <button type="button" className="sugerencia-nueva" onClick={() => setCreando(true)}>
                + Agregar “{q}” como producto nuevo
              </button>
            </li>
          )}
        </ul>
      )}
      {creando && (
        <div className="producto-nuevo">
          <p className="vacio">Nuevo: “{q}”. La categoría sirve para estimar precios de artículos parecidos.</p>
          <div className="chips" role="group" aria-label="Categoría">
            {CATEGORIAS.map((c) => (
              <button key={c} type="button" className={`chip ${nuevo.categoria === c ? 'activo' : ''}`} onClick={() => setNuevo((n) => ({ ...n, categoria: n.categoria === c ? '' : c }))}>
                {c}
              </button>
            ))}
          </div>
          <div className="campos">
            <div className="campo">
              <label htmlFor="nuevo-marca">Marca (opcional)</label>
              <div className="entrada">
                <input id="nuevo-marca" type="text" autoComplete="off" value={nuevo.marca} onChange={(e) => setNuevo((n) => ({ ...n, marca: e.target.value }))} />
              </div>
            </div>
            <div className="campo">
              <label htmlFor="nuevo-codigo">Código (opcional)</label>
              <div className="entrada">
                <input id="nuevo-codigo" type="text" inputMode="numeric" autoComplete="off" value={nuevo.codigo_barras} onChange={(e) => setNuevo((n) => ({ ...n, codigo_barras: e.target.value }))} />
              </div>
            </div>
          </div>
          <button type="button" className="boton boton-secundario" onClick={crear}>
            Agregar producto
          </button>
        </div>
      )}
    </div>
  );
}
