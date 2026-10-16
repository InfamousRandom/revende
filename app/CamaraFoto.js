'use client';
import { useEffect, useRef, useState } from 'react';

const CLAVE_CAMARA = 'revende:camara';
const leerCamara = () => {
  try {
    return localStorage.getItem(CLAVE_CAMARA) || '';
  } catch {
    return '';
  }
};
const guardarCamara = (id) => {
  try {
    localStorage.setItem(CLAVE_CAMARA, id);
  } catch {}
};

// Cámaras traseras ordenadas para que la principal quede primero. En Samsung (Chrome) se llaman
// "camera2 0, facing back", "camera2 2, facing back"...; la principal suele ser la de número menor.
// Pedir solo "environment" a veces da la gran angular o la macro, que no enfocan de cerca (borroso).
async function camarasTraseras() {
  const todas = (await navigator.mediaDevices.enumerateDevices()).filter((d) => d.kind === 'videoinput');
  const traseras = todas.filter((d) => /back|rear|trasera|environment/i.test(d.label));
  // El último número del nombre ("camera2 0, facing back" -> 0), no el de "camera2".
  const numero = (d) => Number(/(\d+)\D*$/.exec(d.label)?.[1] ?? 99);
  return (traseras.length ? traseras : todas).sort((a, b) => numero(a) - numero(b));
}

async function abrirCamara(deviceId) {
  const tamano = { width: { ideal: 1920 }, height: { ideal: 1080 } };
  const flujo = await navigator.mediaDevices.getUserMedia({
    video: deviceId ? { ...tamano, deviceId: { exact: deviceId } } : { ...tamano, facingMode: { ideal: 'environment' } },
    audio: false,
  });
  // Enfoque automático continuo cuando el celular lo permite (sin él la foto de cerca sale borrosa).
  const pista = flujo.getVideoTracks()[0];
  const puede = pista?.getCapabilities?.() || {};
  if (puede.focusMode?.includes('continuous')) {
    await pista.applyConstraints({ advanced: [{ focusMode: 'continuous' }] }).catch(() => {});
  }
  return flujo;
}

// Cámara dentro de la app para identificar un artículo, con "Galería" como alternativa.
export default function CamaraFoto({ onFoto, onGaleria, onCerrar }) {
  const videoRef = useRef(null);
  const flujoRef = useRef(null);
  const [lista, setLista] = useState(false);
  const [error, setError] = useState('');
  const [traseras, setTraseras] = useState([]);
  const [actual, setActual] = useState('');

  async function mostrar(deviceId) {
    flujoRef.current?.getTracks().forEach((t) => t.stop());
    setLista(false);
    const flujo = await abrirCamara(deviceId);
    flujoRef.current = flujo;
    const video = videoRef.current;
    video.srcObject = flujo;
    await video.play();
    setActual(flujo.getVideoTracks()[0]?.getSettings?.().deviceId || deviceId || '');
    setLista(true);
  }

  useEffect(() => {
    let cancelado = false;
    (async () => {
      try {
        // Primero se abre cualquier trasera: con el permiso dado ya se ven los nombres de las cámaras.
        try {
          await mostrar(leerCamara() || undefined);
        } catch {
          guardarCamara(''); // la cámara guardada ya no existe: usar la predeterminada
          await mostrar(undefined);
        }
        if (cancelado) return;
        const lista = await camarasTraseras();
        setTraseras(lista);
        const guardada = leerCamara();
        const elegida = lista.find((d) => d.deviceId === guardada) || lista[0];
        const enUso = flujoRef.current?.getVideoTracks()[0]?.getSettings?.().deviceId;
        if (elegida && elegida.deviceId !== enUso && !cancelado) await mostrar(elegida.deviceId);
      } catch {
        if (!cancelado) setError('No se pudo abrir la cámara. Revisa el permiso de cámara para este sitio o elige una foto de tu galería.');
      }
    })();
    return () => {
      cancelado = true;
      flujoRef.current?.getTracks().forEach((t) => t.stop());
    };
  }, []);

  async function cambiarCamara() {
    if (traseras.length < 2) return;
    const i = traseras.findIndex((d) => d.deviceId === actual);
    const siguiente = traseras[(i + 1) % traseras.length];
    guardarCamara(siguiente.deviceId);
    try {
      await mostrar(siguiente.deviceId);
    } catch {
      setError('No se pudo usar esa cámara. Prueba otra.');
    }
  }

  const disparar = () => {
    const video = videoRef.current;
    if (!video?.videoWidth) return;
    const lienzo = document.createElement('canvas');
    lienzo.width = video.videoWidth;
    lienzo.height = video.videoHeight;
    lienzo.getContext('2d').drawImage(video, 0, 0);
    if (navigator.vibrate) navigator.vibrate(40);
    lienzo.toBlob((blob) => blob && onFoto(blob), 'image/jpeg', 0.92);
  };

  const numeroActual = traseras.findIndex((d) => d.deviceId === actual) + 1;

  return (
    <div className="escaner camara" role="dialog" aria-label="Tomar foto del artículo">
      <div className="camara-visor">
        <video ref={videoRef} playsInline muted />
      </div>
      {error ? (
        <p className="escaner-error">{error}</p>
      ) : (
        <p className="escaner-ayuda">Enfoca la etiqueta, la caja o el número de modelo, a un palmo de distancia.</p>
      )}
      {traseras.length > 1 && (
        <button type="button" className="camara-cambiar" onClick={cambiarCamara}>
          Cambiar cámara{numeroActual > 0 && ` (${numeroActual} de ${traseras.length})`}
        </button>
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
