'use client';
import { useEffect, useMemo, useRef, useState } from 'react';
import dynamic from 'next/dynamic';
import Precios from './Precios';

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
const CLAVE_ACCESO = 'revende:clave';
const ESPERA_MAXIMA_MS = 20000;
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
  { id: 'ajustes', nombre: 'Ajustes', icono: <><circle cx="12" cy="12" r="3" /><path d="M12 2v3M12 19v3M2 12h3M19 12h3M4.9 4.9l2.1 2.1M17 17l2.1 2.1M4.9 19.1 7 17M17 7l2.1-2.1" /></> },
];

export default function Inicio() {
  const [busqueda, setBusqueda] = useState('');
  const [escaneando, setEscaneando] = useState(false);
  // Venta en persona o Marketplace: sin comisión. Solo gastos propios (gasolina, envío, limpieza).
  const [calc, setCalc] = useState({ venta: '', gastos: '', margen: '20', compra: '' });
  const [listo, setListo] = useState(false);
  const [clave, setClave] = useState('');
  const [precios, setPrecios] = useState({ fase: 'inactivo' });
  const [cuota, setCuota] = useState(null);
  const [vista, setVista] = useState('buscar');
  const claveRef = useRef(null);

  // Cargar lo guardado en este celular
  useEffect(() => {
    setCalc((c) => ({ ...c, margen: leer(CLAVE_CALC, {}).margen ?? c.margen }));
    setClave(leer(CLAVE_ACCESO, ''));
    setListo(true);
  }, []);
  useEffect(() => {
    if (listo) guardar(CLAVE_CALC, { margen: calc.margen });
  }, [calc.margen, listo]);
  useEffect(() => {
    if (listo) guardar(CLAVE_ACCESO, clave.trim());
  }, [clave, listo]);

  // Búsquedas restantes de SerpApi. Consultarlas no gasta búsquedas.
  async function cargarCuota(claveActual) {
    if (!claveActual) return;
    try {
      const r = await fetch('/api/cuota', { headers: { 'x-revende-clave': claveActual } });
      const d = await r.json();
      if (d.ok) setCuota(d);
    } catch {}
  }
  useEffect(() => {
    if (listo) cargarCuota(leer(CLAVE_ACCESO, '').trim());
  }, [listo]);

  const set = (campo) => (e) => setCalc((c) => ({ ...c, [campo]: e.target.value }));

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

  // Solo busca cuando el usuario lo pide (botón o Enter): cuida la cuota de SerpApi.
  async function buscarPrecios(e) {
    e?.preventDefault();
    if (q.length < 2 || precios.fase === 'cargando') return;
    if (!clave.trim()) {
      setPrecios({ fase: 'error', consulta: q, faltaClave: true, error: 'Falta la clave de acceso para buscar precios. Ponla en Ajustes.' });
      return;
    }
    setPrecios({ fase: 'cargando', consulta: q });
    const control = new AbortController();
    const reloj = setTimeout(() => control.abort(), ESPERA_MAXIMA_MS);
    try {
      const r = await fetch('/api/precios', {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'x-revende-clave': clave.trim() },
        body: JSON.stringify({ consulta: q }),
        signal: control.signal,
      });
      const datos = await r.json().catch(() => null);
      if (r.ok && datos?.ok) {
        setPrecios({ fase: 'ok', consulta: q, datos });
        if (!datos.cache) cargarCuota(clave.trim());
      } else {
        if (r.status === 429) cargarCuota(clave.trim());
        setPrecios({
          fase: 'error',
          consulta: q,
          vacio: Boolean(datos?.vacio),
          faltaClave: r.status === 401,
          error: datos?.error || 'No se pudieron traer los precios. Intenta de nuevo.',
        });
      }
    } catch (err) {
      setPrecios({
        fase: 'error',
        consulta: q,
        error: err.name === 'AbortError' ? 'La búsqueda tardó demasiado. Intenta de nuevo.' : 'Sin conexión. Revisa tu internet e intenta de nuevo.',
      });
    } finally {
      clearTimeout(reloj);
    }
  }

  const irA = (destino) => {
    setVista(destino);
    window.scrollTo(0, 0);
  };

  const usarReferencia = (valor) => {
    setCalc((c) => ({ ...c, venta: String(valor) }));
    irA('calcular');
  };

  const abrirAjustesClave = () => {
    irA('ajustes');
    setTimeout(() => claveRef.current?.focus(), 50);
  };

  const sinClave = listo && !clave.trim();

  return (
    <>
      <main className="app">
        {vista === 'buscar' && (
          <>
            <header className="cabecera">
              <h1 className="marca">Revende</h1>
              <form className="buscador" role="search" onSubmit={buscarPrecios}>
                <label htmlFor="busqueda" className="sr-only">
                  Artículo, modelo o código de barras
                </label>
                <input
                  id="busqueda"
                  type="search"
                  inputMode="search"
                  autoComplete="off"
                  placeholder="Modelo o código de barras"
                  value={busqueda}
                  enterKeyHint="search"
                  onChange={(e) => setBusqueda(e.target.value)}
                />
                <button type="button" className="boton boton-escanear" onClick={() => setEscaneando(true)}>
                  Escanear
                </button>
              </form>
            </header>

            <section className="bloque">
              {!q ? (
                <p className="vacio">Escribe el modelo (ej. “PS5 Slim digital”) o escanea el código y toca “Buscar precios”.</p>
              ) : (
                <>
                  <button type="button" className="boton boton-buscar" onClick={buscarPrecios} disabled={q.length < 2 || precios.fase === 'cargando'}>
                    {precios.fase === 'cargando' ? 'Buscando…' : 'Buscar precios'}
                  </button>
                  {cuota && cuota.restantes <= POCAS_BUSQUEDAS && (
                    <p className="cuota cuota-pocas">Quedan {cuota.restantes} búsquedas este mes.</p>
                  )}
                  {/* Si el texto cambió, el resultado ya no corresponde: se oculta hasta volver a buscar. */}
                  {precios.consulta === q && (
                    <Precios key={precios.datos?.fecha || precios.fase} estado={precios} onUsar={usarReferencia} onAbrirAjustes={abrirAjustesClave} />
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
              <Campo id="venta" etiqueta="Precio de venta esperado" prefijo="$" valor={calc.venta} onChange={set('venta')} grande />
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
          </section>
        )}

        {vista === 'ajustes' && (
          <section className="bloque pantalla">
            <h2>Ajustes</h2>

            <div className="ajuste">
              <h3>Clave de acceso {sinClave && <span className="falta">falta</span>}</h3>
              <p className="vacio">La necesitas para buscar precios dentro de la app. Se guarda solo en este celular.</p>
              <div className="campo">
                <label htmlFor="clave">Clave</label>
                <div className="entrada">
                  <input id="clave" ref={claveRef} type="password" autoComplete="off" value={clave} onChange={(e) => setClave(e.target.value)} />
                </div>
              </div>
            </div>

            <div className="ajuste">
              <h3>Búsquedas de precios</h3>
              {cuota ? (
                <p className={cuota.restantes <= POCAS_BUSQUEDAS ? 'cuota-pocas' : ''}>
                  Te quedan <strong>{cuota.restantes}</strong> de {cuota.mensuales} este mes
                  {cuota.renovacion && `; se renuevan el ${fechaCorta(cuota.renovacion)}`}.
                </p>
              ) : (
                <p className="vacio">{sinClave ? 'Pon tu clave para ver cuántas te quedan.' : 'Cargando…'}</p>
              )}
              <p className="vacio">Repetir una búsqueda el mismo día no gasta.</p>
            </div>
          </section>
        )}
      </main>

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
            {p.id === 'ajustes' && sinClave && <i className="punto" aria-label="falta la clave" />}
          </button>
        ))}
      </nav>
    </>
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
