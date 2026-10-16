'use client';

const pesos = new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN', maximumFractionDigits: 0 });
const LADO_MAXIMO = 800; // suficiente para Lens y sube más rápido

// Reduce la foto en el celular (~800 px, JPEG) antes de mandarla: sube rápido y gasta menos datos.
export async function reducirImagen(archivo) {
  let imagen;
  try {
    imagen = await createImageBitmap(archivo, { imageOrientation: 'from-image' });
  } catch {
    imagen = await createImageBitmap(archivo);
  }
  const escala = Math.min(1, LADO_MAXIMO / Math.max(imagen.width, imagen.height));
  const lienzo = document.createElement('canvas');
  lienzo.width = Math.round(imagen.width * escala);
  lienzo.height = Math.round(imagen.height * escala);
  lienzo.getContext('2d').drawImage(imagen, 0, 0, lienzo.width, lienzo.height);
  imagen.close?.();
  return new Promise((resolver, rechazar) =>
    lienzo.toBlob((blob) => (blob ? resolver(blob) : rechazar(new Error('No se pudo leer la foto'))), 'image/jpeg', 0.75),
  );
}

// Tarjeta de identificación. `estado`: { fase: 'inactivo' | 'cargando' | 'ok' | 'error', vista, sugerido, candidatos, precios, error }
// El nombre con más coincidencias ya se puso en el buscador; las otras opciones quedan plegadas.
export default function Identificacion({ estado, onElegir, onCerrar }) {
  if (estado.fase === 'inactivo') return null;

  return (
    <div className={`precios identificacion ${estado.fase === 'error' ? 'precios-error' : ''}`} aria-live="polite">
      <div className="ident-cabecera">
        {estado.vista && <img className="ident-foto" src={estado.vista} alt="Tu foto" />}
        <div className="ident-texto">
          {estado.fase === 'cargando' && <p>Identificando el artículo…</p>}
          {estado.fase === 'ok' && (
            <>
              <p className="precios-pie">Lo identifiqué como</p>
              <p className="precios-producto">{estado.sugerido}</p>
              <p className="precios-pie">Abajo están sus precios. Si el nombre no es exacto, corrígelo en el buscador (capacidad, color) y vuelve a buscar.</p>
            </>
          )}
          {estado.fase === 'error' && <p role="alert">{estado.error}</p>}
        </div>
        <button type="button" className="ident-cerrar" onClick={onCerrar} aria-label="Cerrar">
          ✕
        </button>
      </div>

      {estado.fase === 'cargando' && <div className="barra-carga" />}

      {estado.fase === 'ok' && (
        <>
          {estado.catalogo?.length > 0 && (
            <div className="en-catalogo">
              <h3 className="ident-subtitulo">En tu historial</h3>
              {estado.catalogo.map((p) => (
                <button key={p.id} type="button" className="candidato candidato-catalogo" onClick={() => onElegir(p.nombre)}>
                  {p.nombre}
                </button>
              ))}
            </div>
          )}
          {estado.candidatos.length > 0 && (
            <details className="mas-detalles">
              <summary>¿No es? Ver otras opciones ({estado.candidatos.length})</summary>
              <div className="candidatos">
                {estado.candidatos.map((c) => (
                  <button key={c} type="button" className="candidato" onClick={() => onElegir(c)}>
                    {c}
                  </button>
                ))}
              </div>
            </details>
          )}
          {estado.precios.length > 0 && (
            <details className="mas-detalles">
              <summary>Precios vistos junto a la foto ({estado.precios.length})</summary>
              <ul className="ofertas">
                {estado.precios.map((o, i) => (
                  <li key={`${o.tienda}-${i}`} className="oferta">
                    <div className="oferta-info">
                      <span className="oferta-tienda">{o.tienda}</span>
                      <span className="oferta-titulo">{o.titulo}</span>
                    </div>
                    <span className="oferta-precio">{pesos.format(o.precio)}</span>
                    <a className="oferta-link" href={o.link} target="_blank" rel="noopener noreferrer" aria-label={`Ver en ${o.tienda}`}>
                      Ver
                    </a>
                  </li>
                ))}
              </ul>
            </details>
          )}
        </>
      )}
    </div>
  );
}
