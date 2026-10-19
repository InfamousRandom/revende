# Revende 2.0 (app de Android)

App nativa de Revende con Expo. Plan y decisiones: `../docs/PLAN-v2.md`.

```bash
npm install
npx expo start --web     # vista previa en el navegador (datos de ejemplo)
npx tsc --noEmit         # revisar tipos
npx eslint src           # revisar estilo
```

APK: `npx eas-cli@latest build -p android --profile apk` (perfil en `eas.json`).
