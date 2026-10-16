'use client';

const pesos = new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN', maximumFractionDigits: 0 });

const haceCuanto = (iso) => {
  const min = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  if (!Number.isFinite(min) || min < 2) return 'hace un momento';
  if (min < 60) return `hace ${min} min`;
  const h = Math.round(min / 60);
  return `hace ${h} ${h === 1 ? 'hora' : 'horas'}`;
};

// Tarjeta de precios de nuevo. `estado`: { fase: 'inactivo' | 'cargando' | 'ok' | 'error', datos, error, consulta }
export default function Precios({ estado, onUsar, onAbrirAjustes }) {
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
        {estado.faltaClave && (
          <button type="button" className="boton boton-secundario" onClick={onAbrirAjustes}>
            Poner clave de acceso
          </button>
        )}
      </div>
    );
  }

  const d = estado.datos;
  return (
    <div className="precios" aria-live="polite">
      <p className="precios-producto">{d.producto}</p>

      <div className="precios-rango">
        <div className="precios-tipico">
          <span className="precios-etiqueta">Precio nuevo típico</span>
          <span className="precios-cifra">{pesos.format(d.rango.mediana)}</span>
        </div>
        <dl className="precios-extremos">
          <div>
            <dt>Mínimo</dt>
            <dd>{pesos.format(d.rango.min)}</dd>
          </div>
          <div>
            <dt>Máximo</dt>
            <dd>{pesos.format(d.rango.max)}</dd>
          </div>
        </dl>
      </div>

      <ul className="ofertas">
        {d.ofertas.map((o) => (
          <li key={o.tienda + o.precio} className="oferta">
            <div className="oferta-info">
              <span className="oferta-tienda">{o.tienda}</span>
              <span className="oferta-titulo">{o.titulo}</span>
            </div>
            <span className="oferta-precio">{pesos.format(o.precio)}</span>
            <a className="oferta-link" href={o.link} target="_blank" rel="noopener noreferrer" aria-label={`Ver oferta de ${o.tienda}`}>
              Ver
            </a>
          </li>
        ))}
      </ul>

      <button type="button" className="boton boton-referencia" onClick={() => onUsar(d.rango.mediana)}>
        Usar {pesos.format(d.rango.mediana)} como referencia
      </button>

      <p className="precios-pie">
        {d.total} {d.total === 1 ? 'tienda' : 'tiendas'} en Google Shopping · {d.cache ? `guardado ${haceCuanto(d.fecha)}` : 'recién consultado'}.
        Precio de nuevo: el usado suele venderse por menos.
      </p>
    </div>
  );
}
