// Anonyme Zählung der Seitenaufrufe.
// Gespeichert werden nur Seite, Tag und Anzahl (Tabelle „aufrufe“ in der D1-Datenbank fmc-statistik).
// Keine IP-Adressen, keine Cookies, nichts im Browser der Besucher.
const ROBOTER = /bot|crawl|spider|slurp|preview|fetch|headless|lighthouse|monitor|curl|wget|python|httpclient|facebookexternalhit|embedly/i;
export const heute = (d = new Date()) => new Intl.DateTimeFormat('sv-SE', { timeZone: 'Europe/Berlin' }).format(d);

export async function onRequestPost({ request, env, ctx }) {
  const leer = () => new Response(null, { status: 204, headers: { 'cache-control': 'no-store' } });
  if (!env.STATISTIK) return leer();
  if (ROBOTER.test(request.headers.get('user-agent') || '')) return leer();
  const herkunft = request.headers.get('origin');
  if (herkunft && new URL(herkunft).host !== new URL(request.url).host) return leer();

  if (env.ZAEHLER_LIMIT) {
    // Die IP-Adresse dient nur als Schlüssel für die Begrenzung und wird nicht gespeichert
    const { success } = await env.ZAEHLER_LIMIT.limit({ key: request.headers.get('cf-connecting-ip') || 'unbekannt' });
    if (!success) return leer();
  }

  let pfad = '';
  try {
    pfad = String((await request.json()).p || '');
  } catch {
    return leer();
  }
  pfad = pfad.split(/[?#]/)[0];
  if (!pfad.startsWith('/') || pfad.length > 200 || /^\/(admin|api|mitglieder)(\/|$)/.test(pfad) || pfad.includes('..')) return leer();
  if (!pfad.endsWith('/') && !/\.[a-z0-9]{2,5}$/i.test(pfad)) pfad += '/';

  ctx.waitUntil(
    (async () => {
      // Nur Seiten zählen, die es wirklich gibt (keine erfundenen Adressen in der Statistik)
      const seite = await env.ASSETS.fetch(new Request(new URL(pfad, request.url), { method: 'HEAD' }));
      if (seite.status !== 200 || !(seite.headers.get('content-type') || '').includes('text/html')) return;
      await env.STATISTIK.prepare(
        'INSERT INTO aufrufe (pfad, tag, anzahl) VALUES (?1, ?2, 1) ON CONFLICT (pfad, tag) DO UPDATE SET anzahl = anzahl + 1',
      )
        .bind(pfad, heute())
        .run();
    })().catch((fehler) => console.error('Zähler:', fehler.message)),
  );
  return leer();
}
