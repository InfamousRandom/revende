'use client';
import { useEffect, useRef, useState } from 'react';

// Abre la cámara trasera y lee códigos de barras (EAN/UPC) o QR.
// Funciona en Android y en iPhone; requiere HTTPS (Vercel ya lo da).
export default function Escaner({ onLeido, onCerrar }) {
  const [error, setError] = useState('');
  const onLeidoRef = useRef(onLeido);
  onLeidoRef.current = onLeido;

  useEffect(() => {
    let lector = null;
    let terminado = false;

    (async () => {
      try {
        const { Html5Qrcode, Html5QrcodeSupportedFormats: F } = await import('html5-qrcode');
        if (terminado) return;
        lector = new Html5Qrcode('lector-camara', {
          verbose: false,
          formatsToSupport: [F.EAN_13, F.EAN_8, F.UPC_A, F.UPC_E, F.CODE_128, F.QR_CODE],
        });
        await lector.start(
          { facingMode: 'environment' },
          { fps: 10, qrbox: { width: 260, height: 140 } },
          (texto) => {
            if (terminado) return;
            terminado = true;
            if (navigator.vibrate) navigator.vibrate(60);
            lector.stop().catch(() => {}).finally(() => onLeidoRef.current(texto));
          }
        );
      } catch {
        setError('No se pudo abrir la cámara. Revisa que el navegador tenga permiso de cámara para este sitio.');
      }
    })();

    return () => {
      terminado = true;
      if (lector && lector.isScanning) lector.stop().catch(() => {});
    };
  }, []);

  return (
    <div className="escaner" role="dialog" aria-label="Escanear código de barras">
      <div id="lector-camara" className="escaner-video" />
      {error ? (
        <p className="escaner-error">{error}</p>
      ) : (
        <p className="escaner-ayuda">Apunta al código de barras de la caja o la etiqueta.</p>
      )}
      <button type="button" className="boton boton-secundario" onClick={onCerrar}>
        Cancelar
      </button>
    </div>
  );
}
