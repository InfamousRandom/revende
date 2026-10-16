// Worker de Revende: sirve la app (archivos de ./out) y las rutas /api.
export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    // Verificacion: dice si la llave esta configurada, sin mostrarla.
    if (url.pathname === '/api/salud') {
      return Response.json({ ok: true, gemini: Boolean(env.GEMINI_API_KEY) });
    }

    // Todo lo demas: la app.
    return env.ASSETS.fetch(request);
  },
};
