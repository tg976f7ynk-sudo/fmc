// Statistik für die Redaktion: nur mit gültiger GitHub-Anmeldung und Schreibrecht auf das Repository.
import technik from '../site.config.mjs';
import { heute } from './zaehler.js';

const geprueft = new Map(); // Prüfergebnis je Anmeldung, 10 Minuten zwischengespeichert

async function darfLesen(token) {
  if (!token || token.length > 400) return false;
  const schluessel = Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(token))))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
  const treffer = geprueft.get(schluessel);
  if (treffer && treffer.bis > Date.now()) return treffer.ok;
  const antwort = await fetch(`https://api.github.com/repos/${technik.repo}`, {
    headers: { authorization: `Bearer ${token}`, accept: 'application/vnd.github+json', 'user-agent': 'fmc-dietzenbach-website' },
  });
  const daten = antwort.ok ? await antwort.json() : {};
  const ok = !!(daten.permissions && (daten.permissions.push || daten.permissions.maintain || daten.permissions.admin));
  geprueft.set(schluessel, { ok, bis: Date.now() + 10 * 60 * 1000 });
  return ok;
}

const tageZurueck = (n) => heute(new Date(Date.now() - n * 86400000));

export async function onRequestGet({ request, env }) {
  const json = (daten, status = 200) => Response.json(daten, { status, headers: { 'cache-control': 'no-store' } });
  const token = (request.headers.get('authorization') || '').replace(/^Bearer\s+/i, '');
  if (!(await darfLesen(token))) return json({ fehler: 'Bitte in der Redaktion anmelden.' }, 401);
  if (!env.STATISTIK) return json({ fehler: 'Die Statistik ist nicht eingerichtet.' }, 503);

  const t0 = heute(), t7 = tageZurueck(6), t30 = tageZurueck(29), t90 = tageZurueck(89);
  const [seiten, verlauf, beginn] = await env.STATISTIK.batch([
    env.STATISTIK.prepare(
      `SELECT pfad,
              SUM(anzahl) AS gesamt,
              SUM(CASE WHEN tag >= ?1 THEN anzahl ELSE 0 END) AS d30,
              SUM(CASE WHEN tag >= ?2 THEN anzahl ELSE 0 END) AS d7,
              SUM(CASE WHEN tag = ?3 THEN anzahl ELSE 0 END) AS heute
         FROM aufrufe GROUP BY pfad ORDER BY d30 DESC, gesamt DESC LIMIT 1000`,
    ).bind(t30, t7, t0),
    env.STATISTIK.prepare('SELECT tag, SUM(anzahl) AS anzahl FROM aufrufe WHERE tag >= ?1 GROUP BY tag ORDER BY tag').bind(t90),
    env.STATISTIK.prepare('SELECT MIN(tag) AS seit FROM aufrufe'),
  ]);
  return json({ stand: t0, seit: beginn.results[0]?.seit ?? null, seiten: seiten.results, verlauf: verlauf.results });
}
