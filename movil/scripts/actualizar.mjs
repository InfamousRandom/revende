// Publica una actualización sin recompilar (EAS Update) para los APK del canal "apk".
// Uso (desde movil/): npm run actualizar -- "qué cambió"
// Siempre apunta al Worker de producción: `.env.local` (Worker local) no se usa aquí porque una
// variable ya definida en el entorno tiene prioridad sobre los archivos .env.
// Si se agregó algo nativo (un paquete nuevo con código Android), esto no basta: hay que compilar
// un APK nuevo. La versión de ejecución (fingerprint) evita que una actualización llegue a un APK
// que no la soporta.
import { spawnSync } from 'node:child_process';

const mensaje = (process.argv.slice(2).join(' ') || 'Actualización').replace(/"/g, "'");
const r = spawnSync(
  'npx',
  ['eas-cli@latest', 'update', '--channel', 'apk', '--platform', 'android', '--environment', 'production', '--message', `"${mensaje}"`],
  { stdio: 'inherit', shell: true, env: { ...process.env, EXPO_PUBLIC_API_URL: 'https://revende.molinapablo990.workers.dev' } },
);
process.exit(r.status ?? 1);
