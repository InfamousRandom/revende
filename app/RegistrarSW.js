'use client';
import { useEffect } from 'react';

// Registra el service worker para que el celular permita instalar la app.
export default function RegistrarSW() {
  useEffect(() => {
    if ('serviceWorker' in navigator && process.env.NODE_ENV === 'production') {
      navigator.serviceWorker.register('/sw.js').catch(() => {});
    }
  }, []);
  return null;
}
