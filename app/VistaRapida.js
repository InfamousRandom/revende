'use client';
import { useState } from 'react';
import { api } from './historial-api';
import { CHECKLISTS, categoriaDe } from './checklist-datos';

const pesos = new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN', maximumFractionDigits: 0 });
const num = (v) => {
  const n = Number(String(v ?? '').replace(/[$,\s]/g, ''));
  return Number.isFinite(n) ? n : 0;
};

// Vista rápida (pedido de Pablo): compra de segunda en persona. Foto o nombre, una idea del
// precio, y tú pones cuánto te piden y en cuánto lo venderías. Lo demás está en "Ver detalle".
export default function VistaRapida({ busqueda, setBusqueda, onBuscar, onFoto, ident, onElegir, precios, refs, onDetalle }) {
  const q = busqueda.trim();
  const datos = precios.consulta === q && precios.fase === 'ok' ? precios.datos : null;
  const mios = refs.consulta === q && refs.fase === 'ok' ? refs.datos : null;
  const nombre = datos?.producto || q;

  return (
    <section className="bloque rapida">
      <div className="rapida-entrada">
        <button type="button" className="boton boton-buscar rapida-foto" onClick={onFoto} disabled={ident.fase === 'cargando'}>
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="M4 8h3l2-3h6l2 3h3v11H4z" />
            <circle cx="12" cy="13" r="3.5" />
          </svg>
          Tomar foto
        </button>
        <form className="buscador" role="search" onSubmit={onBuscar}>
          <label htmlFor="busqueda-rapida" className="sr-only">
            Nombre del artículo
          </label>
          <input
            id="busqueda-rapida"
            type="search"
            inputMode="search"
            autoComplete="off"
            enterKeyHint="search"
            placeholder="o escribe el nombre"
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
          />
          <button type="submit" className="boton-icono" aria-label="Buscar precios" disabled={q.length < 2 || precios.fase === 'cargando'}>
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <circle cx="11" cy="11" r="7" />
              <path d="m20 20-3.5-3.5" />
            </svg>
            <span>Buscar</span>
          </button>
        </form>
      </div>

      <Avance ident={ident} precios={precios} q={q} />

      {ident.fase === 'error' && (
        <p className="precios precios-error" role="alert">
          {ident.error}
        </p>
      )}
      {precios.consulta === q && precios.fase === 'error' && (
        <p className="precios precios-error" role="alert">
          {precios.error}
        </p>
      )}

      {datos && (
        <Resultado
          key={`${q}|${datos.fecha}`}
          q={q}
          nombre={nombre}
          datos={datos}
          mios={mios}
          ident={ident}
          onElegir={onElegir}
          onDetalle={onDetalle}
        />
      )}
    </section>
  );
}

function Avance({ ident, precios, q }) {
  const paso = ident.fase === 'cargando' ? 'Identificando el artículo…' : precios.fase === 'cargando' && precios.consulta === q ? 'Buscando precios…' : null;
  if (!paso) return null;
  return (
    <div className="precios precios-cargando" aria-live="polite" aria-busy="true">
      <p>{paso}</p>
      <small className="precios-pie">Con foto puede tardar unos 20 segundos.</small>
    </div>
  );
}

function Resultado({ q, nombre, datos, mios, ident, onElegir, onDetalle }) {
  const [pide, setPide] = useState('');
  const [vende, setVende] = useState('');
  const [verOtros, setVerOtros] = useState(false);
  const [guardado, setGuardado] = useState('');
  const [guardando, setGuardando] = useState(false);

  // El precio grande: el típico de usado; si Google no trae usados, el de nuevo (y lo dice).
  const usado = datos.usados?.rango;
  const nuevo = datos.nuevos?.rango;
  const principal = usado ? { etiqueta: 'Usado se vende en', rango: usado } : nuevo ? { etiqueta: 'Nuevo cuesta', rango: nuevo } : null;
  const miVenta = mios?.resumen?.ventas;

  // Botones de referencia: tocas uno y llena "Lo venderé en"; si no te gusta, escribes el tuyo.
  const referencias = [
    miVenta && ['Tu venta', miVenta.mediana],
    usado && ['Usado', usado.mediana],
    nuevo && ['Nuevo', nuevo.mediana],
    !miVenta && mios?.estimacion?.estimado && ['Estimado', mios.estimacion.estimado],
  ].filter(Boolean);

  const P = num(pide);
  const V = num(vende);
  const ganancia = P > 0 && V > 0 ? V - P : null;

  const categoria = categoriaDe(nombre, mios?.producto?.categoria);
  const alerta = CHECKLISTS[categoria]?.puntos.find((p) => p.fraude)?.texto;

  const otros = [...(ident.catalogo || []).map((p) => p.nombre), ...(ident.fase === 'ok' ? ident.candidatos : [])];

  async function loCompre() {
    if (!(P > 0)) return setGuardado('Escribe cuánto te piden.');
    setGuardando(true);
    setGuardado('');
    try {
      let producto = mios?.producto;
      if (!producto) {
        producto = (await api('/api/productos', { metodo: 'POST', datos: { nombre: q, categoria } })).producto;
      }
      await api('/api/operaciones', { metodo: 'POST', datos: { producto_id: producto.id, precio_compra: P, condicion: 'usado_bueno' } });
      setGuardado(`Guardado en tu historial: ${producto.nombre} a ${pesos.format(P)}`);
    } catch (e) {
      setGuardado(e.message);
    } finally {
      setGuardando(false);
    }
  }

  return (
    <div className="precios rapida-resultado">
      <div className="producto-cabecera">
        {datos.imagen && <img className="producto-imagen" src={datos.imagen} alt="" referrerPolicy="no-referrer" />}
        <div>
          <p className="precios-producto">{q}</p>
          {otros.length > 0 && (
            <button type="button" className="enlace" onClick={() => setVerOtros(!verOtros)}>
              {verOtros ? 'Ocultar opciones' : '¿No es? Cambiar'}
            </button>
          )}
        </div>
      </div>
      {verOtros && (
        <div className="candidatos">
          {otros.map((o) => (
            <button key={o} type="button" className="candidato" onClick={() => onElegir(o)}>
              {o}
            </button>
          ))}
        </div>
      )}

      {principal && (
        <div className="rapida-precio">
          <span className="precios-etiqueta">{principal.etiqueta}</span>
          <span className="precios-cifra">{pesos.format(principal.rango.mediana)}</span>
          <span className="resumen-rango">
            {pesos.format(principal.rango.min)} – {pesos.format(principal.rango.max)}
            {usado && nuevo && ` · nuevo ${pesos.format(nuevo.mediana)}`}
          </span>
          {miVenta && (
            <span className="rapida-mia">
              Tú lo vendiste en {pesos.format(miVenta.mediana)}
              {mios.resumen.dias_mediana != null && ` · tardaste ${mios.resumen.dias_mediana} días`}
            </span>
          )}
        </div>
      )}

      <div className="campos">
        <div className="campo">
          <label htmlFor="rapida-pide">Te piden</label>
          <div className="entrada">
            <span aria-hidden="true">$</span>
            <input id="rapida-pide" type="text" inputMode="numeric" autoComplete="off" value={pide} onChange={(e) => setPide(e.target.value)} />
          </div>
        </div>
        <div className="campo">
          <label htmlFor="rapida-vende">Lo venderé en</label>
          <div className="entrada">
            <span aria-hidden="true">$</span>
            <input id="rapida-vende" type="text" inputMode="numeric" autoComplete="off" value={vende} onChange={(e) => setVende(e.target.value)} />
          </div>
        </div>
      </div>
      {referencias.length > 0 && (
        <div className="chips chips-chicos" aria-label="Precios de referencia">
          {referencias.map(([etiqueta, valor]) => (
            <button key={etiqueta} type="button" className={`chip ${V === valor ? 'activo' : ''}`} onClick={() => setVende(String(valor))}>
              {etiqueta} {pesos.format(valor)}
            </button>
          ))}
        </div>
      )}

      {ganancia != null && (
        <div className={`rapida-ganancia ${ganancia > 0 ? 'gana' : 'pierde'}`} aria-live="polite">
          <strong>
            {ganancia > 0 ? 'Ganas' : ganancia < 0 ? 'Pierdes' : 'Quedas igual'} {ganancia !== 0 && pesos.format(Math.abs(ganancia))}
          </strong>
          {ganancia !== 0 && <span>{Math.round((Math.abs(ganancia) / V) * 100)} % del precio de venta</span>}
        </div>
      )}

      {alerta && (
        <p className="rapida-alerta">
          <strong className="etiqueta-fraude">Revisa</strong>
          {alerta}
        </p>
      )}

      <div className="rapida-acciones">
        <button type="button" className="boton boton-secundario" onClick={loCompre} disabled={guardando}>
          {guardando ? 'Guardando…' : 'Lo compré'}
        </button>
        <button type="button" className="boton boton-secundario" onClick={onDetalle}>
          Ver detalle
        </button>
      </div>
      {guardado && (
        <p className="precios-pie" role="status">
          {guardado}
        </p>
      )}
    </div>
  );
}
