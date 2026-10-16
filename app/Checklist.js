'use client';
import { useState } from 'react';
import { CHECKLISTS, GENERAL, categoriaDe } from './checklist-datos';

// Tarjeta "Antes de comprar": puntos generales + los de la categoría del artículo, para marcar.
// La categoría sale de tu historial o del nombre; se puede cambiar con un toque.
export default function Checklist({ texto, categoriaHistorial }) {
  const [elegida, setElegida] = useState(null);
  const [marcados, setMarcados] = useState(() => new Set());
  const categoria = elegida ?? categoriaDe(texto, categoriaHistorial);
  const puntos = [...(CHECKLISTS[categoria]?.puntos || []), ...GENERAL];
  const revisados = puntos.filter((p) => marcados.has(p.texto)).length;
  const pendientesFraude = puntos.filter((p) => p.fraude && !marcados.has(p.texto)).length;

  const alternar = (t) =>
    setMarcados((m) => {
      const n = new Set(m);
      if (n.has(t)) n.delete(t);
      else n.add(t);
      return n;
    });

  return (
    <details className="precios checklist" open>
      <summary>
        <span className="checklist-titulo">Antes de comprar</span>
        <span className="checklist-avance">
          {revisados} de {puntos.length} revisados
          {pendientesFraude > 0 && <em> · {pendientesFraude} antifraude pendientes</em>}
        </span>
      </summary>

      <div className="chips chips-chicos" role="radiogroup" aria-label="Categoría del artículo">
        {Object.entries(CHECKLISTS).map(([id, c]) => (
          <button key={id} type="button" role="radio" aria-checked={categoria === id} className={`chip ${categoria === id ? 'activo' : ''}`} onClick={() => setElegida(id)}>
            {c.nombre}
          </button>
        ))}
      </div>
      {!categoria && <p className="precios-pie">Elige la categoría para ver qué revisar de este tipo de artículo.</p>}

      <ul className="checklist-puntos">
        {puntos.map((p) => (
          <li key={p.texto}>
            <label className={`checklist-punto ${p.fraude ? 'fraude' : ''} ${marcados.has(p.texto) ? 'hecho' : ''}`}>
              <input type="checkbox" checked={marcados.has(p.texto)} onChange={() => alternar(p.texto)} />
              <span>
                {p.fraude && <strong className="etiqueta-fraude">Antifraude</strong>}
                {p.texto}
              </span>
            </label>
          </li>
        ))}
      </ul>
    </details>
  );
}
