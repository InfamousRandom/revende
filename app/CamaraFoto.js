'use client';
import { useEffect, useRef, useState } from 'react';

// Cámara dentro de la app para identificar un artículo (no depende de que el celular
// respete el atributo "capture" del selector de archivos). Galería como alternativa.
export default function CamaraFoto({ onFoto, onGaleria, onCerrar }) {
  const videoRef = useRef(null);
  const [lista, setLista] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    let flujo = null;
    let terminado = false;
    (async () => {
      try {
        const s = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: 'environment' }, width: { ideal: 1920 }, height: { ideal: 1080 } },
          audio: false,
        });
        if (terminado) {
          s.getTracks().forEach((t) => t.stop());
          return;
        }
        flujo = s;
        const video = videoRef.current;
        video.srcObject = s;
        await video.play();
        setLista(true);
      } catch {
        setError('No se pudo abrir la cámara. Revisa el permiso de cámara para este sitio o elige una foto de tu galería.');
      }
    })();
    return () => {
      terminado = true;
      flujo?.getTracks().forEach((t) => t.stop());
    };
  }, []);

  const disparar = () => {
    const video = videoRef.current;
    if (!video?.videoWidth) return;
    const lienzo = document.createElement('canvas');
    lienzo.width = video.videoWidth;
    lienzo.height = video.videoHeight;
    lienzo.getContext('2d').drawImage(video, 0, 0);
    if (navigator.vibrate) navigator.vibrate(40);
    lienzo.toBlob((blob) => blob && onFoto(blob), 'image/jpeg', 0.9);
  };

  return (
    <div className="escaner camara" role="dialog" aria-label="Tomar foto del artículo">
      <div className="camara-visor">
        <video ref={videoRef} playsInline muted />
      </div>
      {error ? (
        <p className="escaner-error">{error}</p>
      ) : (
        <p className="escaner-ayuda">Enfoca la etiqueta, la caja o el número de modelo.</p>
      )}
      <div className="camara-controles">
        <button type="button" className="camara-lateral" onClick={onCerrar}>
          Cancelar
        </button>
        <button type="button" className="camara-disparador" onClick={disparar} disabled={!lista} aria-label="Tomar foto" />
        <button type="button" className="camara-lateral" onClick={onGaleria}>
          Galería
        </button>
      </div>
    </div>
  );
}
