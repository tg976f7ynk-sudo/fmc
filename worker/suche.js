// Öffentliche Such-Schnittstelle: GET /api/suche?q=wasserflug[&art=Beitrag|Seite|Galerie|Termin][&anzahl=10]
// Antwort als JSON. Nutzbar von der Webseite, von Programmen und von KI-Assistenten.
// Suchanfragen werden nicht gespeichert.
import { ladeIndex, suche } from './suchmaschine.js';

export const CORS = { 'access-control-allow-origin': '*', 'access-control-allow-methods': 'GET, POST, OPTIONS', 'access-control-allow-headers': 'content-type, mcp-protocol-version, mcp-session-id, accept' };

export async function onRequestGet({ request, env }) {
  const url = new URL(request.url);
  const anfrage = (url.searchParams.get('q') || '').slice(0, 200);
  const art = url.searchParams.get('art') || '';
  const anzahl = Number(url.searchParams.get('anzahl')) || 10;
  if (env.SUCHE_LIMIT) {
    const { success } = await env.SUCHE_LIMIT.limit({ key: request.headers.get('cf-connecting-ip') || 'unbekannt' });
    if (!success) return Response.json({ fehler: 'Zu viele Anfragen. Bitte kurz warten.' }, { status: 429, headers: CORS });
  }
  const docs = await ladeIndex(env, request);
  const treffer = suche(docs, anfrage, { art, anzahl }).map((t) => ({ ...t, url: new URL(t.url, url.origin).href }));
  return Response.json(
    { anfrage, anzahl: treffer.length, treffer, hinweis: 'Inhalte des Flug- und Modellbau Club Dietzenbach e.V. Quelle bitte mit Link angeben.' },
    { headers: { ...CORS, 'cache-control': 'public, max-age=60' } },
  );
}
export const onRequestOptions = () => new Response(null, { status: 204, headers: CORS });
