'use client';
import { useEffect, useMemo, useState } from 'react';
import dynamic from 'next/dynamic';

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

// ---------- Canales de venta: comisión y envío los capturas tú ----------
const CANALES_INICIALES = [
  { id: 'ml', nombre: 'Mercado Libre', comision: '', envio: '' },
  { id: 'marketplace', nombre: 'Marketplace', comision: '0', envio: '0' },
  { id: 'directo', nombre: 'Venta directa', comision: '0', envio: '0' },
];

const CLAVE_CANALES = 'revende:canales';
const CLAVE_CALC = 'revende:calculadora';

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

export default function Inicio() {
  const [busqueda, setBusqueda] = useState('');
  const [escaneando, setEscaneando] = useState(false);
  const [canales, setCanales] = useState(CANALES_INICIALES);
  const [calc, setCalc] = useState({ venta: '', canal: 'marketplace', envio: '0', otros: '', margen: '20', compra: '' });
  const [listo, setListo] = useState(false);

  // Cargar lo guardado en este celular
  useEffect(() => {
    setCanales(leer(CLAVE_CANALES, CANALES_INICIALES));
    setCalc((c) => ({ ...c, ...leer(CLAVE_CALC, {}) }));
    setListo(true);
  }, []);
  useEffect(() => {
    if (listo) guardar(CLAVE_CANALES, canales);
  }, [canales, listo]);
  useEffect(() => {
    if (listo) guardar(CLAVE_CALC, { canal: calc.canal, margen: calc.margen });
  }, [calc.canal, calc.margen, listo]);

  const canal = canales.find((c) => c.id === calc.canal) || canales[0];
  const sinComision = canal.comision === '';

  const set = (campo) => (e) => setCalc((c) => ({ ...c, [campo]: e.target.value }));
  const elegirCanal = (id) => {
    const nuevo = canales.find((c) => c.id === id);
    setCalc((c) => ({ ...c, canal: id, envio: nuevo?.envio ?? '0' }));
  };
  const editarCanal = (id, campo, valor) =>
    setCanales((cs) => cs.map((c) => (c.id === id ? { ...c, [campo]: valor } : c)));

  const r = useMemo(() => {
    const V = num(calc.venta);
    const c = num(canal.comision) / 100;
    const e = num(calc.envio);
    const o = num(calc.otros);
    const m = num(calc.margen) / 100;
    const compra = num(calc.compra);
    const neto = V * (1 - c) - e - o; // lo que te queda después de comisión y gastos
    const maximo = neto - V * m;
    const ganancia = neto - compra;
    return { V, neto, maximo, ganancia, margenReal: V > 0 ? ganancia / V : 0, hayCompra: compra > 0 };
  }, [calc, canal]);

  const q = busqueda.trim();

  return (
    <main className="app">
      <header className="cabecera">
        <h1 className="marca">Revende</h1>
        <div className="buscador">
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
            onChange={(e) => setBusqueda(e.target.value)}
          />
          <button type="button" className="boton boton-escanear" onClick={() => setEscaneando(true)}>
            Escanear
          </button>
        </div>
      </header>

      {escaneando && (
        <Escaner
          onLeido={(texto) => {
            setBusqueda(texto);
            setEscaneando(false);
          }}
          onCerrar={() => setEscaneando(false)}
        />
      )}

      <section className="bloque" aria-labelledby="t-precios">
        <h2 id="t-precios">Buscar precios</h2>
        {!q ? (
          <p className="vacio">Escribe el modelo (ej. “PS5 Slim digital”) o escanea el código para abrir la búsqueda en cada tienda.</p>
        ) : (
          GRUPOS.map((g) => (
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
          ))
        )}
        {/^\d{8,14}$/.test(q) && (
          <p className="pista">Es un código de barras: si las tiendas no lo encuentran, usa Google Shopping para saber el modelo y búscalo por nombre.</p>
        )}
      </section>

      <section className="bloque" aria-labelledby="t-calc">
        <h2 id="t-calc">¿Cuánto pagar?</h2>

        <fieldset className="canales">
          <legend>Dónde lo vas a vender</legend>
          {canales.map((c) => (
            <label key={c.id} className={`canal ${calc.canal === c.id ? 'activo' : ''}`}>
              <input type="radio" name="canal" value={c.id} checked={calc.canal === c.id} onChange={() => elegirCanal(c.id)} />
              {c.nombre}
            </label>
          ))}
        </fieldset>

        <div className="campos">
          <Campo id="venta" etiqueta="Precio de venta esperado" prefijo="$" valor={calc.venta} onChange={set('venta')} grande />
          <Campo id="envio" etiqueta="Envío" prefijo="$" valor={calc.envio} onChange={set('envio')} />
          <Campo id="otros" etiqueta="Otros gastos" prefijo="$" valor={calc.otros} onChange={set('otros')} ayuda="Limpieza, refacción, retenciones" />
          <Campo id="margen" etiqueta="Ganancia que buscas" sufijo="%" valor={calc.margen} onChange={set('margen')} ayuda="Sobre el precio de venta" />
        </div>

        {sinComision && (
          <p className="aviso">
            Falta la comisión de {canal.nombre}. Captúrala en “Comisiones por canal”, abajo; mientras tanto se calcula como 0%.
          </p>
        )}

        <div className={`etiqueta ${r.V > 0 && r.maximo <= 0 ? 'etiqueta-no' : ''}`} aria-live="polite">
          {r.V <= 0 ? (
            <p className="etiqueta-vacia">Pon el precio en que crees que se vende y aquí verás lo máximo que deberías pagar.</p>
          ) : r.maximo > 0 ? (
            <>
              <span className="etiqueta-titulo">Paga máximo</span>
              <span className="etiqueta-cifra">{pesos.format(Math.floor(r.maximo))}</span>
              <span className="etiqueta-detalle">
                Te quedan {pesos.format(r.neto)} después de comisión y gastos; así ganas al menos {calc.margen || 0}%.
              </span>
            </>
          ) : (
            <>
              <span className="etiqueta-titulo">No conviene</span>
              <span className="etiqueta-detalle">
                A {pesos.format(r.V)} la comisión y los gastos se comen el margen que buscas. Baja tu margen o busca un mejor precio de venta.
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

      <details className="bloque ajustes">
        <summary>Comisiones por canal</summary>
        <p className="vacio">Se guardan solo en este celular. Pon la comisión real que te cobran y tu envío típico.</p>
        {canales.map((c) => (
          <div key={c.id} className="ajuste-canal">
            <span className="ajuste-nombre">{c.nombre}</span>
            <Campo id={`com-${c.id}`} etiqueta="Comisión" sufijo="%" valor={c.comision} onChange={(e) => editarCanal(c.id, 'comision', e.target.value)} />
            <Campo id={`env-${c.id}`} etiqueta="Envío típico" prefijo="$" valor={c.envio} onChange={(e) => editarCanal(c.id, 'envio', e.target.value)} />
          </div>
        ))}
      </details>
    </main>
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
