# Revende — Fase 1

App web instalable para comparar precios y calcular cuánto pagar antes de comprar para revender.
Esta fase no usa IA ni base de datos: todo corre en tu celular y no necesita llaves.

## Qué incluye
- Buscador con escáner de código de barras (cámara trasera, Android y iPhone).
- Botones que abren la búsqueda ya armada en Mercado Libre, Amazon MX, Walmart, Liverpool,
  Marketplace, eBay (vendidos) y Google Shopping.
- Calculadora: precio máximo de compra y ganancia real según canal, envío, gastos y margen.
- Comisiones por canal configurables (se guardan solo en tu celular).

## Probar en tu computadora
Requiere Node.js 18 o más reciente.

    npm install
    npm run dev

Abre http://localhost:3000. La cámara solo funciona en localhost o con HTTPS.

## Publicar en Vercel (gratis)
1. Crea un repositorio privado en GitHub y sube esta carpeta:

       git init
       git add .
       git commit -m "Fase 1"
       git branch -M main
       git remote add origin https://github.com/TU_USUARIO/revende.git
       git push -u origin main

2. En vercel.com: Add New, Project, importa el repositorio y pulsa Deploy.
   No necesitas configurar nada; Vercel detecta Next.js.
3. Vercel te da una URL como https://revende-xxxx.vercel.app

## Instalar en el celular
- Android (Chrome): abre la URL, menú ⋮, "Agregar a la pantalla principal" o "Instalar app".
- iPhone (Safari): abre la URL, botón Compartir, "Agregar a pantalla de inicio".

La primera vez que escanees, acepta el permiso de cámara.

## Primer uso
1. Abre "Comisiones por canal" y captura la comisión real de Mercado Libre y tu envío típico.
2. Verifica que cada botón de tienda abra bien la búsqueda. Si una tienda cambió su URL,
   el patrón está en app/page.js, en la constante GRUPOS.

## Archivos
- app/page.js: pantalla principal, tiendas y calculadora
- app/Escaner.js: lector de código de barras
- app/globals.css: estilos (modo claro y oscuro)
- public/: manifest, íconos y service worker de la PWA
- .env.example: para la Fase 2 (llave de Gemini, solo en Vercel)
