'use client';

const pesos = new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN', maximumFractionDigits: 0 });
const dias = (n) => (n === 0 ? 'el mismo día' : n === 1 ? '1 día' : `${n} días`);
const fechaCorta = (iso) => new Date(`${iso}T12:00:00`).toLocaleDateString('es-MX', { day: 'numeric', month: 'short' });
const CONDICION = { sellado: 'sellado', como_nuevo: 'como nuevo', usado_bueno: 'usado bueno', con_detalles: 'con detalles' };
const CANAL = { marketplace: 'Marketplace', en_persona: 'en persona', otro: 'otro' };

// Tarjeta "Tus ventas": lo que ya vendiste de este artículo (o una estimación por categoría).
// `estado`: { fase: 'cargando' | 'ok', datos } — si no hay producto ni estimación, no se muestra.
export default function TusVentas({ estado, onUsar, onElegirOtro }) {
  if (estado.fase !== 'ok' || !estado.datos?.producto) return null;
  const { producto, otros, ventas, resumen, contraste, estimacion } = estado.datos;
  const r = resumen.ventas;

  return (
    <div className="precios tus-ventas" aria-live="polite">
      <div className="tus-ventas-cabecera">
        <span className="precios-etiqueta">Tus ventas</span>
        <span className="tus-ventas-producto">{producto.nombre}</span>
      </div>

      {r ? (
        <>
          <div className="tus-ventas-cifra">
            <span className="precios-cifra">{pesos.format(r.mediana)}</span>
            <span className="resumen-rango">
              típico de {r.n} {r.n === 1 ? 'venta' : 'ventas'}
              {r.n > 1 && ` · ${pesos.format(r.min)} – ${pesos.format(r.max)}`}
              {resumen.dias_mediana != null && ` · tardas ${dias(resumen.dias_mediana)}`}
            </span>
          </div>
          {contraste && (
            <p className="contraste">
              {contraste.map((c) => `${pesos.format(c.precio)} en ${dias(c.dias)}`).join(' · ')}
            </p>
          )}
          <ul className="ofertas">
            {ventas.slice(0, 3).map((v) => (
              <li key={v.id} className="oferta">
                <div className="oferta-info">
                  <span className="oferta-tienda">{fechaCorta(v.fecha_venta)}</span>
                  <span className="oferta-titulo">
                    {[v.dias != null && `en ${dias(v.dias)}`, CONDICION[v.condicion], CANAL[v.canal], v.descuento > 0 && `bajaste ${pesos.format(v.descuento)}`]
                      .filter(Boolean)
                      .join(' · ')}
                  </span>
                </div>
                <span className="oferta-precio">{pesos.format(v.precio_venta)}</span>
              </li>
            ))}
          </ul>
          <button type="button" className="boton boton-referencia" onClick={() => onUsar(r.mediana, `tus ${r.n} ${r.n === 1 ? 'venta' : 'ventas'} de este artículo`)}>
            Usar {pesos.format(r.mediana)} en calculadora
          </button>
        </>
      ) : estimacion?.estimado ? (
        <>
          <div className="tus-ventas-cifra">
            <span className="precios-cifra">{pesos.format(estimacion.estimado)}</span>
            <span className="resumen-rango">estimado · aún no has vendido este artículo</span>
          </div>
          <p className="precios-pie">
            En {estimacion.categoria} sueles vender al {Math.round(estimacion.factor * 100)} % del precio nuevo ({estimacion.n}{' '}
            {estimacion.n === 1 ? 'venta' : 'ventas'}). Precio nuevo típico: {pesos.format(estimacion.precio_nuevo)}.
          </p>
          <button
            type="button"
            className="boton boton-referencia"
            onClick={() => onUsar(estimacion.estimado, `estimado: ${Math.round(estimacion.factor * 100)} % del precio nuevo, según tus ventas de ${estimacion.categoria}`)}
          >
            Usar {pesos.format(estimacion.estimado)} en calculadora
          </button>
        </>
      ) : (
        <p className="precios-pie">Aún no has vendido este artículo.</p>
      )}

      {otros?.length > 0 && (
        <p className="precios-pie">
          ¿Era otro?{' '}
          {otros.map((o, i) => (
            <span key={o.id}>
              {i > 0 && ' · '}
              <button type="button" className="enlace" onClick={() => onElegirOtro(o.id)}>
                {o.nombre}
              </button>
            </span>
          ))}
        </p>
      )}
    </div>
  );
}
