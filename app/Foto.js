'use client';

const pesos = new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN', maximumFractionDigits: 0 });
const LADO_MAXIMO = 1024;

// Reduce la foto en el celular (~1024 px, JPEG) antes de mandarla: sube rápido y gasta menos datos.
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
    lienzo.toBlob((blob) => (blob ? resolver(blob) : rechazar(new Error('No se pudo leer la foto'))), 'image/jpeg', 0.8),
  );
}

// Tarjeta de identificación. `estado`: { fase: 'inactivo' | 'cargando' | 'ok' | 'error', vista, candidatos, precios, error }
export default function Identificacion({ estado, onElegir, onCerrar, onAbrirAjustes }) {
  if (estado.fase === 'inactivo') return null;

  return (
    <div className={`precios identificacion ${estado.fase === 'error' ? 'precios-error' : ''}`} aria-live="polite">
      <div className="ident-cabecera">
        {estado.vista && <img className="ident-foto" src={estado.vista} alt="Tu foto" />}
        <div className="ident-texto">
          {estado.fase === 'cargando' && <p>Identificando el artículo…</p>}
          {estado.fase === 'ok' && <p className="precios-producto">¿Cuál es?</p>}
          {estado.fase === 'ok' && <p className="precios-pie">Toca el nombre correcto; luego puedes ajustarlo (capacidad, color) antes de buscar.</p>}
          {estado.fase === 'error' && <p role="alert">{estado.error}</p>}
        </div>
        <button type="button" className="ident-cerrar" onClick={onCerrar} aria-label="Cerrar">
          ✕
        </button>
      </div>

      {estado.fase === 'cargando' && <div className="barra-carga" />}

      {estado.fase === 'error' && estado.faltaClave && (
        <button type="button" className="boton boton-secundario" onClick={onAbrirAjustes}>
          Ir a Ajustes
        </button>
      )}

      {estado.fase === 'ok' && (
        <>
          <div className="candidatos">
            {estado.candidatos.map((c) => (
              <button key={c} type="button" className="candidato" onClick={() => onElegir(c)}>
                {c}
              </button>
            ))}
          </div>
          {estado.precios.length > 0 && (
            <>
              <h3 className="ident-subtitulo">Precios vistos junto a la foto</h3>
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
            </>
          )}
        </>
      )}
    </div>
  );
}
