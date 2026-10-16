'use client';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import dynamic from 'next/dynamic';
import Precios from './Precios';
import Identificacion, { reducirImagen } from './Foto';
import Historial from './Historial';
import TusVentas from './TusVentas';
import CapturaUsado from './CapturaUsado';
import Checklist from './Checklist';
import VistaRapida from './VistaRapida';
import { api } from './historial-api';

const CamaraFoto = dynamic(() => import('./CamaraFoto'), { ssr: false });

const Escaner = dynamic(() => import('./Escaner'), { ssr: false });

// ---------- Tiendas: búsquedas prearmadas (verifica cada patrón la primera vez) ----------
const enc = (q) => encodeURIComponent(q.trim());
const slug = (q) =>
  q
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

const GRUPOS = [
  {
    titulo: 'Precio nuevo',
    tiendas: [
      { nombre: 'Mercado Libre', nota: 'filtra nuevo o usado ahí', url: (q) => `https://listado.mercadolibre.com.mx/${slug(q)}` },
      { nombre: 'Amazon MX', url: (q) => `https://www.amazon.com.mx/s?k=${enc(q)}` },
      { nombre: 'Walmart', url: (q) => `https://www.walmart.com.mx/search?q=${enc(q)}` },
      { nombre: 'Liverpool', url: (q) => `https://www.liverpool.com.mx/tienda?s=${enc(q)}` },
    ],
  },
  {
    titulo: 'Usado',
    tiendas: [
      { nombre: 'Marketplace', nota: 'tu zona', url: (q) => `https://www.facebook.com/marketplace/search/?query=${enc(q)}` },
      { nombre: 'eBay vendidos', nota: 'en dólares', url: (q) => `https://www.ebay.com/sch/i.html?_nkw=${enc(q)}&LH_Sold=1&LH_Complete=1` },
    ],
  },
  {
    titulo: 'Identificar',
    tiendas: [
      { nombre: 'Google Shopping', nota: 'útil con código de barras', url: (q) => `https://www.google.com/search?tbm=shop&q=${enc(q)}` },
    ],
  },
];

const CLAVE_CALC = 'revende:calculadora';
const ESPERA_MAXIMA_MS = 30000; // precios
const ESPERA_FOTO_MS = 60000; // Google Lens a veces tarda más de 30 s
const POCAS_BUSQUEDAS = 25;
const fechaCorta = (iso) => {
  const d = new Date(`${iso}T12:00:00`);
  return Number.isNaN(d.getTime()) ? '' : d.toLocaleDateString('es-MX', { day: 'numeric', month: 'short' });
};

const leer = (clave, defecto) => {
  try {
    const v = localStorage.getItem(clave);
    return v ? JSON.parse(v) : defecto;
  } catch {
    return defecto;
  }
};
const guardar = (clave, valor) => {
  try {
    localStorage.setItem(clave, JSON.stringify(valor));
  } catch {}
};

const num = (v) => {
  const n = parseFloat(String(v ?? '').replace(/[^0-9.\-]/g, ''));
  return Number.isFinite(n) ? n : 0;
};
const pesos = new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN', maximumFractionDigits: 0 });
const pct = (n) => `${Math.round(n * 100)}%`;

// Barra inferior: una pantalla a la vez para no saturar.
const PESTANAS = [
  { id: 'buscar', nombre: 'Buscar', icono: <><circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" /></> },
  { id: 'calcular', nombre: 'Calcular', icono: <><rect x="5" y="3" width="14" height="18" rx="2" /><path d="M8 7h8M8 12h2M14 12h2M8 16h2M14 16h2" /></> },
  { id: 'historial', nombre: 'Historial', icono: <><path d="M4 6h16M4 12h16M4 18h10" /><circle cx="19" cy="18" r="2" /></> },
];

export default function Inicio() {
  const [busqueda, setBusqueda] = useState('');
  const [escaneando, setEscaneando] = useState(false);
  // Venta en persona o Marketplace: sin comisión. Solo gastos propios (gasolina, envío, limpieza).
  const [calc, setCalc] = useState({ venta: '', gastos: '', margen: '20', compra: '', origen: '' });
  const [listo, setListo] = useState(false);
  const [precios, setPrecios] = useState({ fase: 'inactivo' });
  const [cuota, setCuota] = useState(null);
  const [vista, setVista] = useState('buscar');
  const [modo, setModo] = useState('rapida'); // la rápida siempre al abrir (pedido de Pablo)
  const [prefillCompra, setPrefillCompra] = useState(null);
  const limpiarPrefill = useCallback(() => setPrefillCompra(null), []);
  const fotoRef = useRef(null);
  const [ident, setIdent] = useState({ fase: 'inactivo' });
  const [refs, setRefs] = useState({ fase: 'inactivo' }); // tarjeta "Tus ventas"
  const [tomandoFoto, setTomandoFoto] = useState(false);

  // Cargar lo guardado en este celular
  useEffect(() => {
    setCalc((c) => ({ ...c, margen: leer(CLAVE_CALC, {}).margen ?? c.margen }));
    try {
      localStorage.removeItem('revende:clave'); // el historial ya no usa clave
    } catch {}
    setListo(true);
  }, []);
  useEffect(() => {
    if (listo) guardar(CLAVE_CALC, { margen: calc.margen });
  }, [calc.margen, listo]);

  // Búsquedas restantes de SerpApi. Consultarlas no gasta búsquedas.
  async function cargarCuota() {
    try {
      const r = await fetch('/api/cuota');
      const d = await r.json();
      if (d.ok) setCuota(d);
    } catch {}
  }
  useEffect(() => {
    if (listo) cargarCuota();
  }, [listo]);

  // Escribir a mano el precio de venta borra la nota de dónde salió.
  const set = (campo) => (e) => setCalc((c) => ({ ...c, [campo]: e.target.value, ...(campo === 'venta' ? { origen: '' } : {}) }));

  const r = useMemo(() => {
    const V = num(calc.venta);
    const m = num(calc.margen) / 100;
    const compra = num(calc.compra);
    const neto = V - num(calc.gastos); // lo que te queda después de tus gastos
    const maximo = neto - V * m;
    const ganancia = neto - compra;
    return { V, neto, maximo, ganancia, margenReal: V > 0 ? ganancia / V : 0, hayCompra: compra > 0 };
  }, [calc]);

  const q = busqueda.trim();

  // Busca cuando el usuario lo pide (botón o Enter) o justo después de identificar una foto.
  // Nunca mientras se escribe: cuida la cuota de SerpApi. `texto` fuerza la consulta (foto).
  async function buscarPrecios(e, texto) {
    e?.preventDefault();
    const consulta = (texto ?? q).trim();
    if (consulta.length < 2 || precios.fase === 'cargando') return;
    setPrecios({ fase: 'cargando', consulta });
    setRefs({ fase: 'inactivo' });
    let precioNuevo = null;
    const control = new AbortController();
    const reloj = setTimeout(() => control.abort(), ESPERA_MAXIMA_MS);
    try {
      const r = await fetch('/api/precios', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ consulta }),
        signal: control.signal,
      });
      const datos = await r.json().catch(() => null);
      if (r.ok && datos?.ok) {
        setPrecios({ fase: 'ok', consulta, datos });
        precioNuevo = datos.nuevos?.rango?.mediana || null;
        if (!datos.cache) cargarCuota();
      } else {
        if (r.status === 429) cargarCuota();
        setPrecios({
          fase: 'error',
          consulta,
          vacio: Boolean(datos?.vacio),
          error: datos?.error || 'No se pudieron traer los precios. Intenta de nuevo.',
        });
      }
    } catch (err) {
      setPrecios({
        fase: 'error',
        consulta,
        error: err.name === 'AbortError' ? 'La búsqueda tardó demasiado. Intenta de nuevo.' : 'Sin conexión. Revisa tu internet e intenta de nuevo.',
      });
    } finally {
      clearTimeout(reloj);
    }
    cargarReferencias({ q: consulta, precioNuevo });
  }

  // "Tus ventas". Manda el precio nuevo típico para que el Worker lo recuerde y estime si nunca lo has vendido.
  async function cargarReferencias({ q: texto, productoId, precioNuevo }) {
    const params = new URLSearchParams(productoId ? { producto_id: productoId } : { q: texto });
    if (precioNuevo) params.set('precio_nuevo', precioNuevo);
    setRefs({ fase: 'cargando', consulta: texto });
    try {
      const datos = await api(`/api/referencias?${params}`);
      setRefs({ fase: 'ok', consulta: texto, datos });
      // La calculadora usa por defecto tus ventas (o la estimación), si no tiene ya un precio.
      const sugerido = datos.resumen?.ventas
        ? { valor: datos.resumen.ventas.mediana, origen: `tus ${datos.resumen.ventas.n} ventas de este artículo` }
        : datos.estimacion?.estimado
          ? { valor: datos.estimacion.estimado, origen: `estimado: ${Math.round(datos.estimacion.factor * 100)} % del precio nuevo, según tus ventas de ${datos.estimacion.categoria}` }
          : null;
      if (sugerido) setCalc((c) => (c.venta ? c : { ...c, venta: String(sugerido.valor), origen: sugerido.origen }));
    } catch {
      setRefs({ fase: 'inactivo' });
    }
  }

  // Foto -> Google Lens -> nombre con más coincidencias -> precios (todo solo).
  async function identificarFoto(foto) {
    setTomandoFoto(false);
    if (ident.vista) URL.revokeObjectURL(ident.vista);
    const vista = URL.createObjectURL(foto);
    setIdent({ fase: 'cargando', vista });
    const control = new AbortController();
    const reloj = setTimeout(() => control.abort(), ESPERA_FOTO_MS);
    try {
      const reducida = await reducirImagen(foto);
      const r = await fetch('/api/identificar', {
        method: 'POST',
        headers: { 'content-type': 'image/jpeg' },
        body: reducida,
        signal: control.signal,
      });
      const datos = await r.json().catch(() => null);
      if (r.ok && datos?.ok) {
        setIdent({ fase: 'ok', vista, sugerido: datos.sugerido, candidatos: datos.candidatos || [], catalogo: datos.catalogo || [], precios: datos.precios || [] });
        // El nombre con más coincidencias va al buscador y se buscan sus precios de una vez (pedido de
        // Pablo): cada foto gasta 2 búsquedas, una de Lens y una de Google Shopping.
        if (datos.sugerido) {
          setBusqueda(datos.sugerido);
          buscarPrecios(null, datos.sugerido);
        }
      } else {
        setIdent({ fase: 'error', vista, error: datos?.error || 'No se pudo identificar la foto. Intenta de nuevo.' });
      }
      cargarCuota();
    } catch (err) {
      setIdent({
        fase: 'error',
        vista,
        error: err.name === 'AbortError' ? 'Tardó demasiado. Intenta de nuevo.' : 'No se pudo enviar la foto. Revisa tu internet.',
      });
    } finally {
      clearTimeout(reloj);
    }
  }

  const elegirDeGaleria = (e) => {
    const archivo = e.target.files?.[0];
    e.target.value = ''; // permite volver a elegir la misma foto
    if (archivo) identificarFoto(archivo);
  };

  const cerrarIdent = () => {
    if (ident.vista) URL.revokeObjectURL(ident.vista);
    setIdent({ fase: 'inactivo' });
  };

  const elegirCandidato = (nombre) => {
    setBusqueda(nombre);
    cerrarIdent();
    buscarPrecios(null, nombre);
  };

  const irA = (destino) => {
    setVista(destino);
    window.scrollTo(0, 0);
  };

  const usarReferencia = (valor, origen = '') => {
    setCalc((c) => ({ ...c, venta: String(valor), origen }));
    irA('calcular');
  };


  return (
    <>
      <main className="app">
        {vista === 'buscar' && modo === 'rapida' && (
          <>
            <header className="cabecera">
              <div className="marca-fila">
                <h1 className="marca">Revende</h1>
                <SelectorModo modo={modo} onCambiar={setModo} />
              </div>
            </header>
            <VistaRapida
              busqueda={busqueda}
              setBusqueda={setBusqueda}
              onBuscar={buscarPrecios}
              onFoto={() => setTomandoFoto(true)}
              ident={ident}
              onElegir={elegirCandidato}
              precios={precios}
              refs={refs}
              onDetalle={() => {
                setModo('completa');
                window.scrollTo(0, 0);
              }}
            />
          </>
        )}

        {vista === 'buscar' && modo === 'completa' && (
          <>
            <header className="cabecera">
              <div className="marca-fila">
                <h1 className="marca">Revende</h1>
                <SelectorModo modo={modo} onCambiar={setModo} />
              </div>
              <form className="buscador" role="search" onSubmit={buscarPrecios}>
                <label htmlFor="busqueda" className="sr-only">
                  Artículo, modelo o código de barras
                </label>
                <input
                  id="busqueda"
                  type="search"
                  inputMode="search"
                  autoComplete="off"
                  placeholder="Modelo o código"
                  value={busqueda}
                  enterKeyHint="search"
                  onChange={(e) => setBusqueda(e.target.value)}
                />
                <button type="button" className="boton-icono" onClick={() => setTomandoFoto(true)} disabled={ident.fase === 'cargando'}>
                  <svg viewBox="0 0 24 24" aria-hidden="true">
                    <path d="M4 8h3l2-3h6l2 3h3v11H4z" />
                    <circle cx="12" cy="13" r="3.5" />
                  </svg>
                  <span>Foto</span>
                </button>
                <button type="button" className="boton-icono" onClick={() => setEscaneando(true)}>
                  <svg viewBox="0 0 24 24" aria-hidden="true">
                    <path d="M4 6v12M7 6v12M10 6v12M14 6v12M16 6v12M20 6v12" />
                  </svg>
                  <span>Código</span>
                </button>
              </form>
            </header>

            <section className="bloque">
              <Identificacion estado={ident} onElegir={elegirCandidato} onCerrar={cerrarIdent} />
              {!q ? (
                ident.fase === 'inactivo' && (
                  <>
                    <p className="vacio">Escribe el modelo (ej. “PS5 Slim digital”), escanea el código o toma una foto, y toca “Buscar precios”.</p>
                    <p className="pista">Para la foto: enfoca la etiqueta, la caja o el número de modelo. Funciona mejor que el artículo solo.</p>
                  </>
                )
              ) : (
                <>
                  <button type="button" className="boton boton-buscar" onClick={buscarPrecios} disabled={q.length < 2 || precios.fase === 'cargando'}>
                    {precios.fase === 'cargando' ? 'Buscando…' : 'Buscar precios'}
                  </button>
                  {cuota && (
                    <p className={`cuota ${cuota.restantes <= POCAS_BUSQUEDAS ? 'cuota-pocas' : ''}`}>
                      Quedan {cuota.restantes} búsquedas este mes{cuota.renovacion && ` · se renuevan el ${fechaCorta(cuota.renovacion)}`}
                    </p>
                  )}
                  {/* Si el texto cambió, el resultado ya no corresponde: se oculta hasta volver a buscar. */}
                  {refs.consulta === q && (
                    <TusVentas
                      estado={refs}
                      onUsar={usarReferencia}
                      onElegirOtro={(productoId) => cargarReferencias({ q, productoId })}
                    />
                  )}
                  {refs.fase === 'ok' && refs.consulta === q && (
                    <CapturaUsado
                      key={refs.datos?.producto?.id || 'sin-producto'}
                      producto={refs.datos?.producto}
                      textoInicial={q}
                      onGuardado={(p) => cargarReferencias({ q, productoId: p.id })}
                    />
                  )}
                  {precios.consulta === q && (
                    <Precios key={precios.datos?.fecha || precios.fase} estado={precios} onUsar={usarReferencia} />
                  )}
                  {precios.consulta === q && precios.fase !== 'cargando' && (
                    <Checklist key={q} texto={q} categoriaHistorial={refs.consulta === q ? refs.datos?.producto?.categoria : null} />
                  )}
                  {/^\d{8,14}$/.test(q) && (
                    <p className="pista">Es un código de barras: si no salen resultados, búscalo en Google Shopping para saber el modelo y escribe el nombre.</p>
                  )}
                  <details className="otras-tiendas">
                    <summary>Abrir en otras tiendas</summary>
                    {GRUPOS.map((g) => (
                      <div key={g.titulo} className="grupo">
                        <h3>{g.titulo}</h3>
                        <div className="tiendas">
                          {g.tiendas.map((t) => (
                            <a key={t.nombre} className="tienda" href={t.url(q)} target="_blank" rel="noopener noreferrer">
                              <span className="tienda-nombre">{t.nombre}</span>
                              {t.nota && <span className="tienda-nota">{t.nota}</span>}
                            </a>
                          ))}
                        </div>
                      </div>
                    ))}
                  </details>
                </>
              )}
            </section>
          </>
        )}

        {vista === 'calcular' && (
          <section className="bloque pantalla">
            <h2>¿Cuánto pagar?</h2>

            <div className="campos">
              <Campo
                id="venta"
                etiqueta="Precio de venta esperado"
                prefijo="$"
                valor={calc.venta}
                onChange={set('venta')}
                grande
                ayuda={calc.origen ? `De: ${calc.origen}` : undefined}
              />
              <Campo id="gastos" etiqueta="Tus gastos" prefijo="$" valor={calc.gastos} onChange={set('gastos')} ayuda="Gasolina, envío, limpieza" />
              <Campo id="margen" etiqueta="Ganancia que buscas" sufijo="%" valor={calc.margen} onChange={set('margen')} ayuda="Sobre el precio de venta" />
            </div>

            <div className={`etiqueta ${r.V > 0 && r.maximo <= 0 ? 'etiqueta-no' : ''}`} aria-live="polite">
              {r.V <= 0 ? (
                <p className="etiqueta-vacia">Pon el precio en que crees que se vende y aquí verás lo máximo que deberías pagar.</p>
              ) : r.maximo > 0 ? (
                <>
                  <span className="etiqueta-titulo">Paga máximo</span>
                  <span className="etiqueta-cifra">{pesos.format(Math.floor(r.maximo))}</span>
                  <span className="etiqueta-detalle">
                    Te quedan {pesos.format(r.neto)} después de tus gastos; así ganas al menos {calc.margen || 0}%.
                  </span>
                </>
              ) : (
                <>
                  <span className="etiqueta-titulo">No conviene</span>
                  <span className="etiqueta-detalle">
                    A {pesos.format(r.V)} los gastos se comen el margen que buscas. Baja tu margen o busca un mejor precio de venta.
                  </span>
                </>
              )}
            </div>

            <Campo id="compra" etiqueta="¿Cuánto te piden?" prefijo="$" valor={calc.compra} onChange={set('compra')} ayuda="Opcional: para ver tu ganancia real" />
            {r.V > 0 && r.hayCompra && (
              <p className={`resultado ${r.ganancia >= 0 ? 'positivo' : 'negativo'}`}>
                {r.ganancia >= 0 ? 'Ganarías' : 'Perderías'} {pesos.format(Math.abs(r.ganancia))} ({pct(Math.abs(r.margenReal))} de la venta).
              </p>
            )}
            {r.hayCompra && (
              <button
                type="button"
                className="boton boton-secundario boton-mas"
                onClick={() => {
                  setPrefillCompra({ nombre: q, precio: num(calc.compra) });
                  irA('historial');
                }}
              >
                Lo compré: registrar en historial
              </button>
            )}
          </section>
        )}

        {vista === 'historial' && <Historial prefill={prefillCompra} onPrefillUsado={limpiarPrefill} />}

      </main>

      <input ref={fotoRef} type="file" accept="image/*" hidden onChange={elegirDeGaleria} />

      {tomandoFoto && (
        <CamaraFoto
          onFoto={identificarFoto}
          onGaleria={() => {
            setTomandoFoto(false);
            fotoRef.current?.click();
          }}
          onCerrar={() => setTomandoFoto(false)}
        />
      )}

      {escaneando && (
        <Escaner
          onLeido={(texto) => {
            setBusqueda(texto);
            setEscaneando(false);
          }}
          onCerrar={() => setEscaneando(false)}
        />
      )}

      <nav className="pestanas" aria-label="Secciones">
        {PESTANAS.map((p) => (
          <button
            key={p.id}
            type="button"
            className={`pestana ${vista === p.id ? 'activa' : ''}`}
            aria-current={vista === p.id ? 'page' : undefined}
            onClick={() => irA(p.id)}
          >
            <svg viewBox="0 0 24 24" aria-hidden="true">
              {p.icono}
            </svg>
            <span>{p.nombre}</span>
          </button>
        ))}
      </nav>
    </>
  );
}

// Vista rápida (lo esencial para comprar en persona) o completa (todo el detalle).
function SelectorModo({ modo, onCambiar }) {
  return (
    <div className="selector selector-modo" role="tablist" aria-label="Tipo de vista">
      {[
        ['rapida', 'Rápida'],
        ['completa', 'Completa'],
      ].map(([id, nombre]) => (
        <button key={id} type="button" role="tab" aria-selected={modo === id} className={modo === id ? 'activo' : ''} onClick={() => onCambiar(id)}>
          {nombre}
        </button>
      ))}
    </div>
  );
}

function Campo({ id, etiqueta, prefijo, sufijo, valor, onChange, ayuda, grande }) {
  return (
    <div className={`campo ${grande ? 'campo-grande' : ''}`}>
      <label htmlFor={id}>{etiqueta}</label>
      <div className="entrada">
        {prefijo && <span aria-hidden="true">{prefijo}</span>}
        <input id={id} type="text" inputMode="decimal" autoComplete="off" value={valor} onChange={onChange} />
        {sufijo && <span aria-hidden="true">{sufijo}</span>}
      </div>
      {ayuda && <small>{ayuda}</small>}
    </div>
  );
}
