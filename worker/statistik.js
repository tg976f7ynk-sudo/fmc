// Statistik für die Redaktion: nur mit gültiger GitHub-Anmeldung und Schreibrecht auf das Repository.
import { istRedaktion } from './redaktion.js';
import { heute } from './zaehler.js';

const tageZurueck = (n) => heute(new Date(Date.now() - n * 86400000));

export async function onRequestGet({ request, env }) {
  const json = (daten, status = 200) => Response.json(daten, { status, headers: { 'cache-control': 'no-store' } });
  if (!(await istRedaktion(request))) return json({ fehler: 'Bitte in der Redaktion anmelden.' }, 401);
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
