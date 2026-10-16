'use client';
import { useState } from 'react';

const pesos = new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN', maximumFractionDigits: 0 });
const VISIBLES = 6;

const haceCuanto = (iso) => {
  const min = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  if (!Number.isFinite(min) || min < 2) return 'hace un momento';
  if (min < 60) return `hace ${min} min`;
  const h = Math.round(min / 60);
  return `hace ${h} ${h === 1 ? 'hora' : 'horas'}`;
};

// Tarjeta de precios. `estado`: { fase: 'inactivo' | 'cargando' | 'ok' | 'error', datos, error, consulta }
export default function Precios({ estado, onUsar }) {
  const [lista, setLista] = useState('nuevos');
  const [todas, setTodas] = useState(false);

  if (estado.fase === 'inactivo') return null;

  if (estado.fase === 'cargando') {
    return (
      <div className="precios precios-cargando" aria-live="polite" aria-busy="true">
        <p>Buscando precios de “{estado.consulta}”…</p>
      </div>
    );
  }

  if (estado.fase === 'error') {
    return (
      <div className={`precios precios-error ${estado.vacio ? 'precios-vacio' : ''}`} role="alert">
        <p>{estado.error}</p>
      </div>
    );
  }

  const d = estado.datos;
  const ofertas = d[lista].ofertas;
  const visibles = todas ? ofertas : ofertas.slice(0, VISIBLES);
  const elegir = (id) => {
    setLista(id);
    setTodas(false);
  };

  return (
    <div className="precios" aria-live="polite">
      <p className="precios-producto">{d.producto}</p>

      <div className="precios-resumen">
        <Resumen titulo="Nuevo" grupo={d.nuevos} onUsar={onUsar} />
        <Resumen titulo="Usado" grupo={d.usados} onUsar={onUsar} />
      </div>

      <div className="selector" role="tablist" aria-label="Lista de precios">
        {[
          ['nuevos', 'Nuevos'],
          ['usados', 'Usados'],
        ].map(([id, nombre]) => (
          <button key={id} type="button" role="tab" aria-selected={lista === id} className={lista === id ? 'activo' : ''} onClick={() => elegir(id)}>
            {nombre} <span>{d[id].ofertas.length}</span>
          </button>
        ))}
      </div>

      {!ofertas.length ? (
        <p className="precios-pie">
          {lista === 'usados'
            ? 'Google Shopping no mostró usados para este artículo. Prueba Marketplace en “Abrir en otras tiendas”.'
            : 'Google Shopping no mostró precios de nuevo para este artículo.'}
        </p>
      ) : (
        <ul className="ofertas">
          {visibles.map((o, i) => (
            <li key={`${o.tienda}-${o.precio}-${i}`} className={`oferta ${o.aviso ? 'oferta-marcada' : ''}`}>
              <div className="oferta-info">
                <span className="oferta-tienda">{o.tienda}</span>
                <span className="oferta-titulo">{o.titulo}</span>
                {(o.aviso || o.condicion === 'Reacondicionado') && <span className="oferta-aviso">{o.aviso || o.condicion}</span>}
              </div>
              <span className="oferta-precio">{pesos.format(o.precio)}</span>
              <a className="oferta-link" href={o.link} target="_blank" rel="noopener noreferrer" aria-label={`Ver oferta de ${o.tienda}`}>
                Ver
              </a>
            </li>
          ))}
        </ul>
      )}
      {ofertas.length > VISIBLES && (
        <button type="button" className="boton boton-secundario boton-mas" onClick={() => setTodas(!todas)}>
          {todas ? 'Ver menos' : `Ver los ${ofertas.length}`}
        </button>
      )}

      <p className="precios-pie">
        {d.tiendas} tiendas · {d.cache ? `guardado ${haceCuanto(d.fecha)}` : 'recién consultado'}
        {ofertas.some((o) => o.aviso) && ' · en gris: no cuentan para el precio típico'}
      </p>
    </div>
  );
}

function Resumen({ titulo, grupo, onUsar }) {
  if (!grupo.rango) {
    return (
      <div className="resumen resumen-vacio">
        <span className="precios-etiqueta">{titulo}</span>
        <span className="resumen-sin">Sin datos</span>
      </div>
    );
  }
  const { min, mediana, max } = grupo.rango;
  return (
    <div className="resumen">
      <span className="precios-etiqueta">{titulo} típico</span>
      <span className="precios-cifra">{pesos.format(mediana)}</span>
      <span className="resumen-rango">{min === max ? 'un solo precio' : `${pesos.format(min)} – ${pesos.format(max)}`}</span>
      <button type="button" className="boton boton-referencia" onClick={() => onUsar(mediana)}>
        Usar precio
      </button>
    </div>
  );
}
