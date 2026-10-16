'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
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

const ESTADOS = [
  ['', 'Todo'],
  ['inventario', 'En inventario'],
  ['vendido', 'Vendidos'],
];
const pct = (n) => `${Math.round(n * 100)} %`;

// Pantalla "Historial": registrar compras y ventas en menos de 30 s, buscar, filtrar, ver
// totales y corregir o borrar registros.
export default function Historial({ prefill, onPrefillUsado }) {
  const [listo, setListo] = useState(false);
  const [pedirClave, setPedirClave] = useState(false);
  const [modo, setModo] = useState('lista'); // lista | compra | elegir-venta | venta | editar
  const [ventaDe, setVentaDe] = useState(null); // operación en inventario, o null = venta sin compra registrada
  const [editando, setEditando] = useState(null);
  const [filtros, setFiltros] = useState({ estado: '', categoria: '', q: '' });
  const [datos, setDatos] = useState({ operaciones: [], totales: null, categorias: [] });
  const [inventario, setInventario] = useState([]);
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState('');
  const [aviso, setAviso] = useState('');
  const [datosCompra, setDatosCompra] = useState(null); // copia del atajo "Lo compré"
  const [recarga, setRecarga] = useState(0);
  const relojAviso = useRef(null);

  const manejarError = useCallback((e) => {
    if (e.clave) setPedirClave(true);
    else setError(e.message);
  }, []);

  useEffect(() => {
    if (!leerClave()) setPedirClave(true);
    setListo(true);
  }, []);

  // Carga la lista con los filtros (el texto espera a que dejes de escribir).
  useEffect(() => {
    if (!listo || pedirClave || modo !== 'lista') return;
    let vigente = true;
    const params = new URLSearchParams(Object.entries(filtros).filter(([, v]) => v));
    const reloj = setTimeout(async () => {
      setCargando(true);
      setError('');
      try {
        const d = await api(`/api/operaciones?${params}`);
        if (vigente) setDatos(d);
      } catch (e) {
        if (vigente) manejarError(e);
      } finally {
        if (vigente) setCargando(false);
      }
    }, filtros.q ? 300 : 0);
    return () => {
      vigente = false;
      clearTimeout(reloj);
    };
  }, [listo, pedirClave, modo, filtros, recarga, manejarError]);

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
    setEditando(null);
    setDatosCompra(null);
    setAviso(mensaje);
    clearTimeout(relojAviso.current); // un aviso nuevo no debe borrarse con el temporizador del anterior
    relojAviso.current = setTimeout(() => setAviso(''), 3000);
    window.scrollTo(0, 0);
    setRecarga((n) => n + 1);
  };

  async function elegirVenta() {
    setModo('elegir-venta');
    try {
      setInventario((await api('/api/operaciones?estado=inventario')).operaciones);
    } catch (e) {
      manejarError(e);
    }
  }

  const vender = (o) => {
    setVentaDe(o);
    setModo('venta');
  };
  const filtrar = (cambio) => setFiltros((f) => ({ ...f, ...cambio }));

  if (!listo) return null;
  const t = datos.totales;

  return (
    <section className="bloque pantalla historial">
      {pedirClave && <PedirClave onListo={() => setPedirClave(false)} />}

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
            <button type="button" className="boton boton-secundario" onClick={elegirVenta}>
              Registré una venta
            </button>
          </div>

          <div className="filtros">
            <div className="entrada">
              <input type="search" placeholder="Buscar en tu historial" aria-label="Buscar en tu historial" value={filtros.q} onChange={(e) => filtrar({ q: e.target.value })} />
            </div>
            <div className="selector" role="tablist" aria-label="Estado">
              {ESTADOS.map(([id, nombre]) => (
                <button key={id || 'todo'} type="button" role="tab" aria-selected={filtros.estado === id} className={filtros.estado === id ? 'activo' : ''} onClick={() => filtrar({ estado: id })}>
                  {nombre}
                </button>
              ))}
            </div>
            {datos.categorias.length > 1 && (
              <div className="chips chips-chicos" role="radiogroup" aria-label="Categoría">
                {['', ...datos.categorias].map((c) => (
                  <button key={c || 'todas'} type="button" role="radio" aria-checked={filtros.categoria === c} className={`chip ${filtros.categoria === c ? 'activo' : ''}`} onClick={() => filtrar({ categoria: c })}>
                    {c || 'Todas'}
                  </button>
                ))}
              </div>
            )}
          </div>

          {t && t.registros > 0 && (
            <dl className="totales">
              <div>
                <dt>Ganancia real</dt>
                <dd className={t.ganancia >= 0 ? 'positivo' : 'negativo'}>{pesos.format(t.ganancia)}</dd>
              </div>
              <div>
                <dt>Margen</dt>
                <dd>{t.margen == null ? '—' : pct(t.margen)}</dd>
              </div>
              <div>
                <dt>Tardas en vender</dt>
                <dd>{t.dias_promedio == null ? '—' : dias(t.dias_promedio) || '0 días'}</dd>
              </div>
              <div>
                <dt>Dinero parado</dt>
                <dd>
                  {pesos.format(t.dinero_parado)}
                  <small> en {t.en_inventario}</small>
                </dd>
              </div>
            </dl>
          )}

          {!datos.operaciones.length ? (
            <p className="vacio">{cargando ? 'Cargando…' : filtros.q || filtros.estado || filtros.categoria ? 'Nada con esos filtros.' : 'Todavía no hay registros.'}</p>
          ) : (
            <ul className="ofertas">
              {datos.operaciones.map((o) => (
                <li key={o.id} className="fila-con-accion">
                  <button type="button" className="fila-operacion" onClick={() => { setEditando(o); setModo('editar'); }}>
                    <span className="oferta-info">
                      <span className="oferta-tienda">{o.producto}</span>
                      <span className="oferta-titulo">
                        {o.estado === 'inventario'
                          ? `En inventario · compraste ${o.fecha_compra === hoy() ? 'hoy' : `hace ${dias(o.dias)}`}`
                          : [fechaCorta(o.fecha_venta), tardo(o.dias)].filter(Boolean).join(' · ')}
                      </span>
                    </span>
                    <span className="venta-cifras">
                      <span className="oferta-precio">{pesos.format(o.estado === 'inventario' ? o.precio_compra : o.precio_venta)}</span>
                      {o.ganancia != null && (
                        <small className={o.ganancia >= 0 ? 'positivo' : 'negativo'}>
                          {o.ganancia >= 0 ? '+' : '−'}
                          {pesos.format(Math.abs(o.ganancia))}
                        </small>
                      )}
                    </span>
                  </button>
                  {o.estado === 'inventario' && (
                    <button type="button" className="fila-accion boton-vender" onClick={() => vender(o)}>
                      Vender
                    </button>
                  )}
                </li>
              ))}
            </ul>
          )}
          {t?.registros > datos.operaciones.length && <p className="precios-pie">Se muestran los {datos.operaciones.length} más recientes; los totales cuentan todo.</p>}
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
            {inventario.map((o) => (
              <li key={o.id}>
                <button type="button" className="fila-operacion" onClick={() => vender(o)}>
                  <span className="oferta-info">
                    <span className="oferta-tienda">{o.producto}</span>
                    <span className="oferta-titulo">Compra {pesos.format(o.precio_compra)}</span>
                  </span>
                  <span className="fila-accion">Elegir</span>
                </button>
              </li>
            ))}
          </ul>
          <button type="button" className="boton boton-secundario boton-mas" onClick={() => vender(null)}>
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

      {modo === 'editar' && editando && (
        <FormEditar
          operacion={editando}
          onError={manejarError}
          onCancelar={() => { setEditando(null); setModo('lista'); }}
          onGuardado={(mensaje) => terminar(mensaje)}
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

// Corregir un registro: cualquier campo, deshacer la venta (vuelve a inventario) o borrarlo.
function FormEditar({ operacion: o, onGuardado, onCancelar, onError }) {
  const texto = (v) => (v == null ? '' : String(v));
  const [c, setC] = useState({
    precio_compra: texto(o.precio_compra),
    fecha_compra: texto(o.fecha_compra),
    condicion: o.condicion || '',
    lugar_compra: texto(o.lugar_compra),
    precio_venta: texto(o.precio_venta),
    fecha_venta: texto(o.fecha_venta),
    canal: o.canal || '',
    envio_mxn: o.envio_mxn ? String(o.envio_mxn) : '',
    otros_gastos_mxn: o.otros_gastos_mxn ? String(o.otros_gastos_mxn) : '',
    notas: texto(o.notas),
  });
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState('');
  const cambiar = (campo) => (valor) => setC((x) => ({ ...x, [campo]: valor }));
  const vendido = o.estado === 'vendido';

  async function enviar(datos, mensaje) {
    setGuardando(true);
    setError('');
    try {
      await api(`/api/operaciones/${o.id}`, { metodo: 'PATCH', datos });
      onGuardado(mensaje);
    } catch (err) {
      if (err.clave) onError(err);
      else setError(err.message);
    } finally {
      setGuardando(false);
    }
  }

  const guardar = (e) => {
    e.preventDefault();
    const pesosONulo = (v) => (String(v).trim() === '' ? null : num(v));
    if (c.precio_compra.trim() === '' && c.precio_venta.trim() === '') return setError('Debe quedar el precio de compra o el de venta.');
    enviar(
      {
        precio_compra: pesosONulo(c.precio_compra),
        fecha_compra: c.fecha_compra || null,
        condicion: c.condicion || null,
        lugar_compra: c.lugar_compra || null,
        precio_venta: pesosONulo(c.precio_venta),
        fecha_venta: c.fecha_venta || null,
        canal: c.canal || null,
        envio_mxn: num(c.envio_mxn),
        otros_gastos_mxn: num(c.otros_gastos_mxn),
        notas: c.notas || null,
      },
      `Cambios guardados: ${o.producto}`,
    );
  };

  async function borrar() {
    if (!window.confirm(`¿Borrar este registro de ${o.producto}? No se puede deshacer.`)) return;
    setGuardando(true);
    try {
      await api(`/api/operaciones/${o.id}`, { metodo: 'DELETE' });
      onGuardado(`Registro borrado: ${o.producto}`);
    } catch (err) {
      if (err.clave) onError(err);
      else setError(err.message);
      setGuardando(false);
    }
  }

  return (
    <form className="formulario" onSubmit={guardar}>
      <h2>Corregir registro</h2>
      <div className="producto-elegido">
        <div>
          <strong>{o.producto}</strong>
          <small>{vendido ? 'Vendido' : 'En inventario'}</small>
        </div>
      </div>

      <h3 className="ident-subtitulo">Compra</h3>
      <div className="campos">
        <CampoPesos id="e-precio-compra" etiqueta="Precio" valor={c.precio_compra} onChange={cambiar('precio_compra')} />
        <CampoFecha id="e-fecha-compra" etiqueta="Fecha" valor={c.fecha_compra} onChange={cambiar('fecha_compra')} />
      </div>
      <Chips etiqueta="Condición" opciones={CONDICIONES} valor={c.condicion} onChange={(v) => cambiar('condicion')(c.condicion === v ? '' : v)} />
      <div className="campo">
        <label htmlFor="e-lugar">Dónde lo compraste</label>
        <div className="entrada">
          <input id="e-lugar" type="text" autoComplete="off" value={c.lugar_compra} onChange={(e) => cambiar('lugar_compra')(e.target.value)} />
        </div>
      </div>

      <h3 className="ident-subtitulo">Venta {!vendido && '(déjala vacía si aún no se vende)'}</h3>
      <div className="campos">
        <CampoPesos id="e-precio-venta" etiqueta="Precio" valor={c.precio_venta} onChange={cambiar('precio_venta')} />
        <CampoFecha id="e-fecha-venta" etiqueta="Fecha" valor={c.fecha_venta} onChange={cambiar('fecha_venta')} />
        <CampoPesos id="e-envio" etiqueta="Envío" valor={c.envio_mxn} onChange={cambiar('envio_mxn')} />
        <CampoPesos id="e-otros" etiqueta="Otros gastos" valor={c.otros_gastos_mxn} onChange={cambiar('otros_gastos_mxn')} />
      </div>
      <Chips etiqueta="¿Dónde?" opciones={CANALES} valor={c.canal} onChange={(v) => cambiar('canal')(c.canal === v ? '' : v)} />
      <div className="campo">
        <label htmlFor="e-notas">Notas</label>
        <div className="entrada">
          <input id="e-notas" type="text" autoComplete="off" value={c.notas} onChange={(e) => cambiar('notas')(e.target.value)} />
        </div>
      </div>

      {error && <p className="negativo" role="alert">{error}</p>}
      <button type="submit" className="boton boton-buscar" disabled={guardando}>
        {guardando ? 'Guardando…' : 'Guardar cambios'}
      </button>
      {vendido && o.precio_compra != null && (
        <button type="button" className="boton boton-secundario" disabled={guardando} onClick={() => enviar({ precio_venta: null }, `Venta deshecha: ${o.producto} volvió a inventario`)}>
          Deshacer venta (vuelve a inventario)
        </button>
      )}
      <button type="button" className="boton boton-borrar" disabled={guardando} onClick={borrar}>
        Borrar registro
      </button>
      <button type="button" className="enlace enlace-volver" onClick={onCancelar}>
        Cancelar
      </button>
    </form>
  );
}
