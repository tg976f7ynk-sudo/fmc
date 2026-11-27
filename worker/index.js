// Einstiegspunkt des Cloudflare Workers.
// Die fertigen Seiten (dist/) liefert Cloudflare direkt aus; dieser Code
// beantwortet nur die kleinen Serverfunktionen unter /api/.
import * as wetter from './wetter.js';
import * as kontakt from './kontakt.js';
import * as auth from './auth.js';
import * as callback from './callback.js';
import * as zaehler from './zaehler.js';
import * as statistik from './statistik.js';
import * as suche from './suche.js';
import * as mcp from './mcp.js';
import * as anmeldung from './anmeldung.js';

// Schutz-Header für alle Antworten der Serverfunktionen
// (für die fertigen Seiten stehen sie in public/_headers)
const SCHUTZ = {
  'x-content-type-options': 'nosniff',
  'referrer-policy': 'no-referrer',
  'strict-transport-security': 'max-age=31536000',
  'x-frame-options': 'DENY',
  'content-security-policy': "default-src 'none'; frame-ancestors 'none'",
  'x-robots-tag': 'noindex',
};
function absichern(antwort) {
  const neu = new Response(antwort.body, antwort);
  for (const [name, wert] of Object.entries(SCHUTZ)) if (!neu.headers.has(name)) neu.headers.set(name, wert);
  return neu;
}

const routen = {
  '/api/wetter': wetter,
  '/api/kontakt': kontakt,
  '/api/auth': auth,
  '/api/callback': callback,
  '/api/zaehler': zaehler,
  '/api/statistik': statistik,
  '/api/suche': suche,
  '/api/anmeldung': anmeldung.start,
  '/api/anmeldung/status': anmeldung.status,
  '/api/anmeldung/bestaetigen': anmeldung.bestaetigen,
  '/api/anmeldung/abmelden': anmeldung.abmelden,
  '/api/anmeldungen': anmeldung.redaktion,
  '/mcp': mcp,
};

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const modul = routen[url.pathname.replace(/\/$/, '')];
    if (!modul) return env.ASSETS.fetch(request);

    const name = request.method === 'POST' ? 'onRequestPost' : request.method === 'GET' || request.method === 'HEAD' ? 'onRequestGet' : request.method === 'OPTIONS' ? 'onRequestOptions' : null;
    const funktion = name && modul[name];
    if (!funktion) return absichern(new Response('Methode nicht erlaubt', { status: 405 }));
    try {
      return absichern(await funktion({ request, env, ctx }));
    } catch (fehler) {
      console.error(url.pathname, fehler?.message);
      return absichern(Response.json({ ok: false, fehler: 'Interner Fehler' }, { status: 500 }));
    }
  },

  // Täglich (siehe "triggers" in wrangler.jsonc): alte Anmeldungen löschen
  async scheduled(controller, env, ctx) {
    ctx.waitUntil(anmeldung.aufraeumen(env));
  },
};
