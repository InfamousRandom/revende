'use client';
import { useCallback, useEffect, useState } from 'react';
import SelectorProducto from './SelectorProducto';
import { api, CANALES, CONDICIONES, guardarClave, hoy, leerClave } from './historial-api';

const pesos = new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN', maximumFractionDigits: 0 });
const num = (v) => {
  const n = Number(String(v ?? '').replace(/[$,\s]/g, ''));
  return Number.isFinite(n) ? n : 0;
};
const dias = (n) => (n == null ? '' : n === 1 ? '1 día' : `${n} días`);
// '2026-10-16' -> '16 oct'
const fechaCorta = (iso) => new Date(`${iso}T12:00:00`).toLocaleDateString('es-MX', { day: 'numeric', month: 'short' });
// Cuánto tardó en venderse desde la compra.
const tardo = (n) => (n == null ? null : n === 0 ? 'vendido el mismo día' : `en ${dias(n)}`);

// Pantalla "Historial": registrar compras y ventas en menos de 30 s y ver inventario y ventas.
export default function Historial({ prefill, onPrefillUsado }) {
  const [listo, setListo] = useState(false);
  const [pedirClave, setPedirClave] = useState(false);
  const [modo, setModo] = useState('lista'); // lista | compra | elegir-venta | venta
  const [ventaDe, setVentaDe] = useState(null); // operación en inventario, o null = venta sin compra registrada
  const [datos, setDatos] = useState({ inventario: [], vendidos: [] });
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState('');
  const [aviso, setAviso] = useState('');
  const [datosCompra, setDatosCompra] = useState(null); // copia del atajo "Lo compré"

  const manejarError = useCallback((e) => {
    if (e.clave) setPedirClave(true);
    else setError(e.message);
  }, []);

  const cargar = useCallback(async () => {
    setCargando(true);
    setError('');
    try {
      const [inv, ven] = await Promise.all([api('/api/operaciones?estado=inventario'), api('/api/operaciones?estado=vendido')]);
      setDatos({ inventario: inv.operaciones, vendidos: ven.operaciones });
    } catch (e) {
      manejarError(e);
    } finally {
      setCargando(false);
    }
  }, [manejarError]);

  useEffect(() => {
    if (leerClave()) cargar();
    else setPedirClave(true);
    setListo(true);
  }, [cargar]);

  // Atajo desde Calcular: "Lo compré" abre la compra ya llenada.
  useEffect(() => {
    if (prefill) {
      setDatosCompra(prefill);
      setModo('compra');
      onPrefillUsado?.();
    }
  }, [prefill, onPrefillUsado]);

  const terminar = (mensaje) => {
    setModo('lista');
    setVentaDe(null);
    setDatosCompra(null);
    setAviso(mensaje);
    setTimeout(() => setAviso(''), 3000);
    window.scrollTo(0, 0);
    cargar();
  };

  if (!listo) return null;

  const invertido = datos.inventario.reduce((t, o) => t + (o.precio_compra || 0), 0);

  return (
    <section className="bloque pantalla historial">
      {pedirClave && (
        <PedirClave
          onListo={() => {
            setPedirClave(false);
            cargar();
          }}
        />
      )}

      {modo === 'lista' && (
        <>
          <h2>Historial</h2>
          {aviso && (
            <p className="aviso-ok" role="status">
              {aviso}
            </p>
          )}
          {error && (
            <p className="precios precios-error" role="alert">
              {error}
            </p>
          )}
          <div className="acciones-registro">
            <button type="button" className="boton boton-buscar" onClick={() => setModo('compra')}>
              Registré una compra
            </button>
            <button type="button" className="boton boton-secundario" onClick={() => setModo('elegir-venta')}>
              Registré una venta
            </button>
          </div>

          <h3 className="lista-encabezado">
            En inventario <span>{datos.inventario.length}</span>
            {invertido > 0 && <small>{pesos.format(invertido)} invertido</small>}
          </h3>
          {!datos.inventario.length ? (
            <p className="vacio">{cargando ? 'Cargando…' : 'Nada en inventario.'}</p>
          ) : (
            <ul className="ofertas">
              {datos.inventario.map((o) => (
                <li key={o.id}>
                  <button type="button" className="fila-operacion" onClick={() => { setVentaDe(o); setModo('venta'); }}>
                    <span className="oferta-info">
                      <span className="oferta-tienda">{o.producto}</span>
                      <span className="oferta-titulo">Compraste {o.fecha_compra === hoy() ? 'hoy' : `hace ${dias(o.dias)}`}</span>
                    </span>
                    <span className="oferta-precio">{pesos.format(o.precio_compra)}</span>
                    <span className="fila-accion">Vender</span>
                  </button>
                </li>
              ))}
            </ul>
          )}

          <h3 className="lista-encabezado">
            Vendidos <span>{datos.vendidos.length}</span>
          </h3>
          {!datos.vendidos.length ? (
            <p className="vacio">{cargando ? 'Cargando…' : 'Todavía no hay ventas.'}</p>
          ) : (
            <ul className="ofertas">
              {datos.vendidos.slice(0, 20).map((o) => (
                <li key={o.id} className="oferta">
                  <div className="oferta-info">
                    <span className="oferta-tienda">{o.producto}</span>
                    <span className="oferta-titulo">
                      {[fechaCorta(o.fecha_venta), tardo(o.dias)].filter(Boolean).join(' · ')}
                    </span>
                  </div>
                  <span className="venta-cifras">
                    <span className="oferta-precio">{pesos.format(o.precio_venta)}</span>
                    {o.ganancia != null && (
                      <small className={o.ganancia >= 0 ? 'positivo' : 'negativo'}>
                        {o.ganancia >= 0 ? '+' : '−'}
                        {pesos.format(Math.abs(o.ganancia))}
                      </small>
                    )}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </>
      )}

      {modo === 'compra' && (
        <FormCompra
          prefill={datosCompra}
          onError={manejarError}
          onCancelar={() => {
            setDatosCompra(null);
            setModo('lista');
          }}
          onGuardado={(o) => terminar(`Compra guardada: ${o.producto}`)}
        />
      )}

      {modo === 'elegir-venta' && (
        <>
          <h2>¿Qué vendiste?</h2>
          <ul className="ofertas">
            {datos.inventario.map((o) => (
              <li key={o.id}>
                <button type="button" className="fila-operacion" onClick={() => { setVentaDe(o); setModo('venta'); }}>
                  <span className="oferta-info">
                    <span className="oferta-tienda">{o.producto}</span>
                    <span className="oferta-titulo">Compra {pesos.format(o.precio_compra)}</span>
                  </span>
                  <span className="fila-accion">Elegir</span>
                </button>
              </li>
            ))}
          </ul>
          <button type="button" className="boton boton-secundario boton-mas" onClick={() => { setVentaDe(null); setModo('venta'); }}>
            Otro artículo (no registré la compra)
          </button>
          <button type="button" className="enlace enlace-volver" onClick={() => setModo('lista')}>
            Cancelar
          </button>
        </>
      )}

      {modo === 'venta' && (
        <FormVenta
          operacion={ventaDe}
          onError={manejarError}
          onCancelar={() => { setVentaDe(null); setModo('lista'); }}
          onGuardado={(o) => terminar(`Venta guardada: ${o.producto}${o.ganancia != null ? ` · ganaste ${pesos.format(o.ganancia)}` : ''}`)}
        />
      )}
    </section>
  );
}

function PedirClave({ onListo }) {
  const [clave, setClave] = useState('');
  const [error, setError] = useState('');
  const [probando, setProbando] = useState(false);

  async function probar(e) {
    e.preventDefault();
    if (!clave.trim()) return;
    setProbando(true);
    setError('');
    guardarClave(clave.trim());
    try {
      await api('/api/operaciones?estado=inventario');
      onListo();
    } catch (err) {
      guardarClave('');
      setError(err.clave ? 'Esa clave no es correcta.' : err.message);
    } finally {
      setProbando(false);
    }
  }

  return (
    <div className="ventana-fondo" role="dialog" aria-modal="true" aria-labelledby="t-clave">
      <form className="ventana" onSubmit={probar}>
        <h3 id="t-clave">Clave del historial</h3>
        <p className="vacio">Tu historial es privado. Escribe tu clave una sola vez; se queda guardada en este celular.</p>
        <div className="entrada">
          <input type="password" autoComplete="current-password" autoFocus value={clave} onChange={(e) => setClave(e.target.value)} aria-label="Clave" />
        </div>
        {error && <p className="negativo">{error}</p>}
        <button type="submit" className="boton boton-buscar" disabled={probando || !clave.trim()}>
          {probando ? 'Revisando…' : 'Entrar'}
        </button>
      </form>
    </div>
  );
}

function CampoPesos({ id, etiqueta, valor, onChange, grande, autoFocus }) {
  return (
    <div className={`campo ${grande ? 'campo-grande' : ''}`}>
      <label htmlFor={id}>{etiqueta}</label>
      <div className="entrada">
        <span aria-hidden="true">$</span>
        <input id={id} type="text" inputMode="numeric" autoComplete="off" value={valor} onChange={(e) => onChange(e.target.value)} autoFocus={autoFocus} />
      </div>
    </div>
  );
}

function Chips({ etiqueta, opciones, valor, onChange }) {
  return (
    <div className="campo">
      <span className="campo-etiqueta">{etiqueta}</span>
      <div className="chips" role="radiogroup" aria-label={etiqueta}>
        {opciones.map(([id, nombre]) => (
          <button key={id} type="button" role="radio" aria-checked={valor === id} className={`chip ${valor === id ? 'activo' : ''}`} onClick={() => onChange(id)}>
            {nombre}
          </button>
        ))}
      </div>
    </div>
  );
}

function CampoFecha({ id, etiqueta, valor, onChange }) {
  return (
    <div className="campo">
      <label htmlFor={id}>{etiqueta}</label>
      <div className="entrada">
        <input id={id} type="date" value={valor} max={hoy()} onChange={(e) => onChange(e.target.value)} />
      </div>
    </div>
  );
}

function FormCompra({ prefill, onGuardado, onCancelar, onError }) {
  const [producto, setProducto] = useState(null);
  const [precio, setPrecio] = useState(prefill?.precio ? String(prefill.precio) : '');
  const [fecha, setFecha] = useState(hoy());
  const [condicion, setCondicion] = useState('usado_bueno');
  const [lugar, setLugar] = useState('');
  const [notas, setNotas] = useState('');
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState('');

  async function guardar(e) {
    e.preventDefault();
    if (!producto) return setError('Elige o agrega el producto.');
    if (!(num(precio) > 0)) return setError('Escribe cuánto pagaste.');
    setGuardando(true);
    setError('');
    try {
      const d = await api('/api/operaciones', {
        metodo: 'POST',
        datos: { producto_id: producto.id, precio_compra: num(precio), fecha_compra: fecha, condicion, lugar_compra: lugar || null, notas: notas || null },
      });
      onGuardado(d.operacion);
    } catch (err) {
      if (err.clave) onError(err);
      else setError(err.message);
    } finally {
      setGuardando(false);
    }
  }

  return (
    <form className="formulario" onSubmit={guardar}>
      <h2>Registrar compra</h2>
      <SelectorProducto valor={producto} onElegir={setProducto} textoInicial={prefill?.nombre || ''} onError={(err) => (err.clave ? onError(err) : setError(err.message))} />
      <CampoPesos id="precio-compra" etiqueta="¿Cuánto pagaste?" valor={precio} onChange={setPrecio} grande />
      <Chips etiqueta="Condición" opciones={CONDICIONES} valor={condicion} onChange={setCondicion} />
      <details className="mas-detalles">
        <summary>Más detalles (opcional)</summary>
        <CampoFecha id="fecha-compra" etiqueta="Fecha de compra" valor={fecha} onChange={setFecha} />
        <div className="campo">
          <label htmlFor="lugar">Dónde lo compraste</label>
          <div className="entrada">
            <input id="lugar" type="text" autoComplete="off" placeholder="Ej. Marketplace, tianguis" value={lugar} onChange={(e) => setLugar(e.target.value)} />
          </div>
        </div>
        <div className="campo">
          <label htmlFor="notas-compra">Notas</label>
          <div className="entrada">
            <input id="notas-compra" type="text" autoComplete="off" value={notas} onChange={(e) => setNotas(e.target.value)} />
          </div>
        </div>
      </details>
      {error && <p className="negativo" role="alert">{error}</p>}
      <button type="submit" className="boton boton-buscar" disabled={guardando}>
        {guardando ? 'Guardando…' : 'Guardar compra'}
      </button>
      <button type="button" className="enlace enlace-volver" onClick={onCancelar}>
        Cancelar
      </button>
    </form>
  );
}

function FormVenta({ operacion, onGuardado, onCancelar, onError }) {
  const [producto, setProducto] = useState(null);
  const [precio, setPrecio] = useState('');
  const [fecha, setFecha] = useState(hoy());
  const [canal, setCanal] = useState('marketplace');
  const [condicion, setCondicion] = useState('usado_bueno');
  const [envio, setEnvio] = useState('');
  const [otros, setOtros] = useState('');
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState('');

  const gananciaPrevia = operacion && num(precio) > 0 ? num(precio) - operacion.precio_compra - num(envio) - num(otros) : null;

  async function guardar(e) {
    e.preventDefault();
    if (!operacion && !producto) return setError('Elige o agrega el producto.');
    if (!(num(precio) > 0)) return setError('Escribe en cuánto lo vendiste.');
    if (operacion && fecha < operacion.fecha_compra) return setError('La venta no puede ser antes de la compra.');
    setGuardando(true);
    setError('');
    const venta = { precio_venta: num(precio), fecha_venta: fecha, canal, envio_mxn: num(envio), otros_gastos_mxn: num(otros) };
    try {
      const d = operacion
        ? await api(`/api/operaciones/${operacion.id}`, { metodo: 'PATCH', datos: venta })
        : await api('/api/operaciones', { metodo: 'POST', datos: { ...venta, producto_id: producto.id, condicion } });
      onGuardado(d.operacion);
    } catch (err) {
      if (err.clave) onError(err);
      else setError(err.message);
    } finally {
      setGuardando(false);
    }
  }

  return (
    <form className="formulario" onSubmit={guardar}>
      <h2>Registrar venta</h2>
      {operacion ? (
        <div className="producto-elegido">
          <div>
            <strong>{operacion.producto}</strong>
            <small>
              Lo compraste en {pesos.format(operacion.precio_compra)} {operacion.fecha_compra === hoy() ? 'hoy' : `hace ${dias(operacion.dias)}`}
            </small>
          </div>
        </div>
      ) : (
        <SelectorProducto valor={producto} onElegir={setProducto} onError={(err) => (err.clave ? onError(err) : setError(err.message))} />
      )}
      <CampoPesos id="precio-venta" etiqueta="¿En cuánto lo vendiste?" valor={precio} onChange={setPrecio} grande autoFocus={Boolean(operacion)} />
      {gananciaPrevia != null && (
        <p className={`resultado ${gananciaPrevia >= 0 ? 'positivo' : 'negativo'}`}>
          {gananciaPrevia >= 0 ? 'Ganas' : 'Pierdes'} {pesos.format(Math.abs(gananciaPrevia))}
        </p>
      )}
      <Chips etiqueta="¿Dónde?" opciones={CANALES} valor={canal} onChange={setCanal} />
      {!operacion && <Chips etiqueta="Condición" opciones={CONDICIONES} valor={condicion} onChange={setCondicion} />}
      <details className="mas-detalles">
        <summary>Más detalles (opcional)</summary>
        <CampoFecha id="fecha-venta" etiqueta="Fecha de venta" valor={fecha} onChange={setFecha} />
        <div className="campos">
          <CampoPesos id="envio" etiqueta="Envío" valor={envio} onChange={setEnvio} />
          <CampoPesos id="otros" etiqueta="Otros gastos" valor={otros} onChange={setOtros} />
        </div>
      </details>
      {error && <p className="negativo" role="alert">{error}</p>}
      <button type="submit" className="boton boton-buscar" disabled={guardando}>
        {guardando ? 'Guardando…' : 'Guardar venta'}
      </button>
      <button type="button" className="enlace enlace-volver" onClick={onCancelar}>
        Cancelar
      </button>
    </form>
  );
}
