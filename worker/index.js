// Einstiegspunkt des Cloudflare Workers.
// Die fertigen Seiten (dist/) liefert Cloudflare direkt aus; dieser Code
// beantwortet nur die kleinen Serverfunktionen unter /api/.
import * as wetter from './wetter.js';
import * as kontakt from './kontakt.js';
import * as auth from './auth.js';
import * as callback from './callback.js';

const routen = { '/api/wetter': wetter, '/api/kontakt': kontakt, '/api/auth': auth, '/api/callback': callback };

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const modul = routen[url.pathname.replace(/\/$/, '')];
    if (!modul) return env.ASSETS.fetch(request);

    const name = request.method === 'POST' ? 'onRequestPost' : request.method === 'GET' || request.method === 'HEAD' ? 'onRequestGet' : null;
    const funktion = name && modul[name];
    if (!funktion) return new Response('Methode nicht erlaubt', { status: 405 });
    try {
      return await funktion({ request, env, ctx });
    } catch (fehler) {
      console.error(url.pathname, fehler?.message);
      return Response.json({ ok: false, fehler: 'Interner Fehler' }, { status: 500 });
    }
  },
};
