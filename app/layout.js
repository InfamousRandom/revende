import './globals.css';
import RegistrarSW from './RegistrarSW';

export const metadata = {
  title: 'Revende',
  description: 'Compara precios y calcula cuánto pagar antes de comprar para revender.',
  manifest: '/manifest.webmanifest',
  appleWebApp: { capable: true, title: 'Revende', statusBarStyle: 'default' },
  icons: { icon: '/icon-192.png', apple: '/icon-192.png' },
};

export const viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#EEF1EC' },
    { media: '(prefers-color-scheme: dark)', color: '#151917' },
  ],
};

export default function RootLayout({ children }) {
  return (
    <html lang="es-MX">
      <body>
        {children}
        <RegistrarSW />
      </body>
    </html>
  );
}
