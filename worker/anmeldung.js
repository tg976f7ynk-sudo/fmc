// Anmeldungen zu Terminen mit Bestätigung per E-Mail (Double-Opt-in) und Kalendereinladung.
//
// Ablauf:
//   1. Besucher trägt Name, E-Mail und Personenzahl ein  → POST /api/anmeldung
//   2. Mail mit Bestätigungslink. Der Link führt auf /termine/anmeldung/#b=…; erst ein Klick
//      auf der Seite bestätigt (POST /api/anmeldung/bestaetigen). So lösen Virenscanner,
//      die Links in Mails vorab öffnen, keine Bestätigung aus.
//   3. Nach der Bestätigung: Kalendereinladung (iCalendar) per Mail – Google, Apple, Outlook,
//      GMX und Web.de übernehmen sie in den Kalender. Abmelden per Link schickt eine Absage,
//      die den Termin wieder aus dem Kalender entfernt.
// Datenschutz: Teilnehmer werden nie öffentlich gezeigt. Öffentlich ist nur, ob noch Plätze frei sind.
// Unbestätigte Anmeldungen werden nach 48 Stunden gelöscht, alle übrigen 14 Tage nach der Veranstaltung.
import daten from '../dist/termine.json';
import { mailBereit, sendeMail } from './mail.js';
import { kalender } from './kalender.js';
import { heute } from './zaehler.js';
import { pruefeTurnstile, turnstileAktiv } from './kontakt.js';
import { istRedaktion } from './redaktion.js';

const TERMINE = new Map(daten.termine.map((t) => [t.id, t]));
const json = (inhalt, status = 200) => Response.json(inhalt, { status, headers: { 'cache-control': 'no-store' } });
const einzeilig = (s) => String(s ?? '').replace(/[\r\n\t]+/g, ' ').trim();
const EMAIL = /^[^\s@<>"',;]+@[^\s@<>"',;]+\.[a-z]{2,}$/i;
const MAX_PERSONEN = 10;
const AUFHEBEN_TAGE = 14;
const OFFEN_STUNDEN = 48;

const hex = (puffer) => Array.from(new Uint8Array(puffer), (b) => b.toString(16).padStart(2, '0')).join('');
const hash = async (text) => hex(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text)));
const zufall = (n) => {
  const b = crypto.getRandomValues(new Uint8Array(n));
  return btoa(String.fromCharCode(...b)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
};
const basis = (request) => new URL(request.url).origin;
const tagPlus = (iso, tage) => new Date(Date.parse(iso + 'T12:00:00Z') + tage * 864e5).toISOString().slice(0, 10);
const tagDeutsch = (iso) => new Date(iso + 'T12:00:00Z').toLocaleDateString('de-DE', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' });

// Belegte Plätze (bestätigt oder noch offen) – nur Zahlen, nie Namen
async function belegt(env, termin, ohneId = '') {
  const r = await env.ANMELDUNGEN.prepare(
    "SELECT COALESCE(SUM(personen),0) AS n FROM anmeldungen WHERE termin = ? AND status IN ('offen','bestaetigt') AND id != ?",
  ).bind(termin, ohneId).first();
  return r?.n ?? 0;
}

// Ist die Anmeldung für diesen Termin gerade möglich?
function lage(t) {
  if (!t || !t.anmeldung) return { offen: false, grund: 'Für diesen Termin ist keine Online-Anmeldung vorgesehen.' };
  const tag = heute();
  if ((t.ende || t.datum) < tag) return { offen: false, grund: 'Dieser Termin liegt in der Vergangenheit.' };
  if (t.anmeldeschluss && t.anmeldeschluss < tag) return { offen: false, grund: `Der Anmeldeschluss war am ${tagDeutsch(t.anmeldeschluss)}.` };
  return { offen: true };
}

const bereit = (env) => Boolean(env.ANMELDUNGEN) && mailBereit(env);

function pruefeHerkunft(request) {
  const herkunft = request.headers.get('origin');
  return !herkunft || new URL(herkunft).host === new URL(request.url).host;
}
async function leseJson(request, max = 8000) {
  if (Number(request.headers.get('content-length') || 0) > max) return null;
  try {
    const d = await request.json();
    return d && typeof d === 'object' ? d : null;
  } catch {
    return null;
  }
}
async function begrenzen(env, request) {
  if (!env.ANMELDUNG_LIMIT) return true;
  const { success } = await env.ANMELDUNG_LIMIT.limit({ key: request.headers.get('cf-connecting-ip') || 'unbekannt' });
  return success;
}
// Kennung und Schlüssel aus dem Link (#b=ID.SCHLUESSEL)
async function finde(env, d) {
  const id = String(d?.id ?? '');
  const k = String(d?.k ?? '');
  if (!/^[a-z0-9-]{10,40}$/i.test(id) || !/^[\w-]{20,60}$/.test(k)) return null;
  const zeile = await env.ANMELDUNGEN.prepare('SELECT * FROM anmeldungen WHERE id = ?').bind(id).first();
  if (!zeile || zeile.token_hash !== (await hash(k))) return null;
  return zeile;
}

const fussText = (b) => `\n\n--\nFlugmodellbau-Club Dietzenbach e.V.\n${b}/\nDiese Mail wurde automatisch verschickt, weil sich jemand mit dieser Adresse auf unserer Webseite angemeldet hat.`;
const linkFuer = (b, art, id, k) => `${b}/termine/anmeldung/#${art}=${id}.${k}`;
const termineZeile = (t) => [t.wann, t.uhrzeit, t.ort].filter(Boolean).join(' · ');

async function sendeBestaetigungslink(env, b, t, z, k, schonBestaetigt) {
  const text = schonBestaetigt
    ? `Hallo ${z.name},\n\nSie sind für „${t.titel}“ (${termineZeile(t)}) bereits angemeldet.\n\nIhre Anmeldung ansehen, Kalendereinladung erneut erhalten oder abmelden:\n${linkFuer(b, 'b', z.id, k)}${fussText(b)}`
    : `Hallo ${z.name},\n\nvielen Dank für Ihre Anmeldung zu „${t.titel}“ (${termineZeile(t)}).\n\nBitte bestätigen Sie die Anmeldung mit einem Klick auf diesen Link:\n${linkFuer(b, 'b', z.id, k)}\n\nErst danach ist die Anmeldung gültig. Sie erhalten dann eine Kalendereinladung.\nOhne Bestätigung wird die Anmeldung nach ${OFFEN_STUNDEN} Stunden automatisch gelöscht.\n\nSie haben sich nicht angemeldet? Dann können Sie diese Mail einfach ignorieren.${fussText(b)}`;
  await sendeMail(env, { an: z.email, anName: z.name, betreff: schonBestaetigt ? `Ihre Anmeldung: ${t.titel}` : `Bitte bestätigen: Anmeldung zu „${t.titel}“`, text });
}

async function sendeEinladung(env, b, t, z, k) {
  const abmelden = linkFuer(b, 'a', z.id, k);
  const ics = kalender(t, { methode: 'REQUEST', basis: b, uid: z.id, organisator: env.MAIL_VON || env.SMTP_USER, teilnehmer: { name: z.name, email: z.email }, abmeldeLink: abmelden });
  const text = `Hallo ${z.name},\n\nIhre Anmeldung zu „${t.titel}“ ist bestätigt${z.personen > 1 ? ` (${z.personen} Personen)` : ''}.\n\n${termineZeile(t)}${t.beschreibung ? `\n${t.beschreibung}` : ''}\n\nIm Anhang finden Sie die Kalendereinladung. Ihr Kalender (Google, Apple, Outlook, GMX, Web.de) zeigt sie meist direkt an – sonst die Datei „termin.ics“ öffnen.\n\nFalls Sie doch nicht kommen können, melden Sie sich bitte hier ab:\n${abmelden}\n\nWir freuen uns auf Sie!${fussText(b)}`;
  await sendeMail(env, { an: z.email, anName: z.name, betreff: `Anmeldung bestätigt: ${t.titel}`, text, kalender: { methode: 'REQUEST', inhalt: ics, dateiname: 'termin.ics' } });
}

async function sendeAbsage(env, b, t, z) {
  const ics = kalender(t, { methode: 'CANCEL', basis: b, uid: z.id, organisator: env.MAIL_VON || env.SMTP_USER, teilnehmer: { name: z.name, email: z.email }, sequenz: 1 });
  const text = `Hallo ${z.name},\n\nSie haben sich von „${t.titel}“ (${termineZeile(t)}) abgemeldet. Der Termin wird damit auch aus Ihrem Kalender entfernt, sofern Ihr Kalender das unterstützt.\n\nSchade, dass es nicht klappt – vielleicht beim nächsten Mal!${fussText(b)}`;
  await sendeMail(env, { an: z.email, anName: z.name, betreff: `Abgemeldet: ${t.titel}`, text, kalender: { methode: 'CANCEL', inhalt: ics, dateiname: 'absage.ics' } });
}

const oeffentlich = (z, t) => ({
  status: z.status,
  name: z.name,
  personen: z.personen,
  termin: t ? { id: t.id, titel: t.titel, wann: t.wann, uhrzeit: t.uhrzeit, ort: t.ort } : null,
});

// ---------- GET /api/anmeldung?termin=ID – ist eine Anmeldung möglich, wie viele Plätze sind frei?
export const start = {
  async onRequestGet({ request, env }) {
    const t = TERMINE.get(new URL(request.url).searchParams.get('termin') || '');
    if (!t) return json({ offen: false, grund: 'Diesen Termin gibt es nicht (mehr).' }, 404);
    const l = lage(t);
    if (l.offen && !bereit(env)) Object.assign(l, { offen: false, grund: 'Die Online-Anmeldung ist noch nicht freigeschaltet. Bitte melden Sie sich per E-Mail an.' });
    let frei = null;
    if (l.offen && t.plaetze) {
      frei = Math.max(0, t.plaetze - (await belegt(env, t.id)));
      if (frei === 0) Object.assign(l, { offen: false, grund: 'Leider sind alle Plätze vergeben.' });
    }
    return json({ ...l, frei, maxPersonen: MAX_PERSONEN, turnstile: l.offen && turnstileAktiv(env) ? env.TURNSTILE_SITEKEY : null });
  },

  // ---------- POST /api/anmeldung – neue Anmeldung, schickt den Bestätigungslink
  async onRequestPost({ request, env }) {
    if (!pruefeHerkunft(request)) return json({ ok: false, fehler: 'Ungültige Anfrage.' }, 403);
    if (!(await begrenzen(env, request))) return json({ ok: false, fehler: 'Zu viele Anfragen in kurzer Zeit. Bitte versuchen Sie es in einer Minute erneut.' }, 429);
    const d = await leseJson(request);
    if (!d) return json({ ok: false, fehler: 'Ungültige Anfrage.' }, 400);
    // Spam-Schutz wie beim Kontaktformular
    if (einzeilig(d.website) || Number(d.dauer) < 3000) return json({ ok: true });

    const t = TERMINE.get(String(d.termin ?? ''));
    const l = lage(t);
    if (!l.offen) return json({ ok: false, fehler: l.grund }, 409);
    if (!bereit(env)) return json({ ok: false, fehler: 'Die Online-Anmeldung ist noch nicht freigeschaltet. Bitte melden Sie sich per E-Mail an.' }, 503);

    const name = einzeilig(d.name).slice(0, 120);
    const email = einzeilig(d.email).slice(0, 200).toLowerCase();
    const personen = Math.trunc(Number(d.personen) || 1);
    const anmerkung = String(d.anmerkung ?? '').trim().slice(0, 500) || null;
    if (!name || !EMAIL.test(email)) return json({ ok: false, fehler: 'Bitte geben Sie Ihren Namen und eine gültige E-Mail-Adresse an.' }, 400);
    if (personen < 1 || personen > MAX_PERSONEN) return json({ ok: false, fehler: `Bitte eine Personenzahl zwischen 1 und ${MAX_PERSONEN} angeben.` }, 400);
    if (!d.einwilligung) return json({ ok: false, fehler: 'Bitte stimmen Sie der Verwendung Ihrer Angaben zu.' }, 400);

    if (turnstileAktiv(env)) {
      let bestanden = false;
      try {
        bestanden = await pruefeTurnstile(env, d.turnstile, request.headers.get('cf-connecting-ip'));
      } catch (fehler) {
        console.error('Turnstile:', fehler.message);
      }
      if (!bestanden) return json({ ok: false, fehler: 'Die Sicherheitsprüfung ist fehlgeschlagen. Bitte laden Sie die Seite neu und versuchen Sie es erneut.' }, 400);
    }

    const b = basis(request);
    const k = zufall(24);
    const kHash = await hash(k);
    const jetzt = new Date().toISOString();
    const vorhanden = await env.ANMELDUNGEN.prepare("SELECT * FROM anmeldungen WHERE termin = ? AND email = ? AND status IN ('offen','bestaetigt')").bind(t.id, email).first();

    if (vorhanden) {
      // Gleiche Adresse noch einmal: neuen Link schicken (der alte verliert seine Gültigkeit).
      // Die Antwort ist dieselbe wie bei einer neuen Anmeldung – so verrät das Formular nicht, wer angemeldet ist.
      await env.ANMELDUNGEN.prepare('UPDATE anmeldungen SET token_hash = ? WHERE id = ?').bind(kHash, vorhanden.id).run();
      await sendeBestaetigungslink(env, b, t, vorhanden, k, vorhanden.status === 'bestaetigt');
      return json({ ok: true });
    }
    if (t.plaetze && (await belegt(env, t.id)) + personen > t.plaetze) {
      const frei = Math.max(0, t.plaetze - (await belegt(env, t.id)));
      return json({ ok: false, fehler: frei ? `Es sind nur noch ${frei} Plätze frei.` : 'Leider sind alle Plätze vergeben.' }, 409);
    }
    const z = { id: crypto.randomUUID(), name, email, personen };
    await env.ANMELDUNGEN.prepare(
      "INSERT INTO anmeldungen (id, termin, termin_datum, name, email, personen, anmerkung, status, token_hash, erstellt) VALUES (?, ?, ?, ?, ?, ?, ?, 'offen', ?, ?)",
    ).bind(z.id, t.id, t.ende || t.datum, name, email, personen, anmerkung, kHash, jetzt).run();
    try {
      await sendeBestaetigungslink(env, b, t, z, k, false);
    } catch (fehler) {
      console.error('Anmeldung, Mail:', fehler.message);
      await env.ANMELDUNGEN.prepare('DELETE FROM anmeldungen WHERE id = ?').bind(z.id).run();
      return json({ ok: false, fehler: 'Die Bestätigungsmail konnte nicht verschickt werden. Bitte versuchen Sie es später erneut.' }, 502);
    }
    return json({ ok: true });
  },
};

// ---------- POST /api/anmeldung/status – eigene Anmeldung ansehen (nur mit dem Schlüssel aus der Mail)
export const status = {
  async onRequestPost({ request, env }) {
    if (!env.ANMELDUNGEN || !pruefeHerkunft(request)) return json({ ok: false, fehler: 'Ungültige Anfrage.' }, 403);
    const z = await finde(env, await leseJson(request));
    if (!z) return json({ ok: false, fehler: 'Dieser Link ist nicht (mehr) gültig.' }, 404);
    return json({ ok: true, ...oeffentlich(z, TERMINE.get(z.termin)) });
  },
};

// ---------- POST /api/anmeldung/bestaetigen
export const bestaetigen = {
  async onRequestPost({ request, env }) {
    if (!bereit(env) || !pruefeHerkunft(request)) return json({ ok: false, fehler: 'Ungültige Anfrage.' }, 403);
    if (!(await begrenzen(env, request))) return json({ ok: false, fehler: 'Zu viele Anfragen. Bitte in einer Minute erneut versuchen.' }, 429);
    const d = await leseJson(request);
    const z = await finde(env, d);
    if (!z) return json({ ok: false, fehler: 'Dieser Link ist nicht (mehr) gültig. Unbestätigte Anmeldungen werden nach 48 Stunden gelöscht – bitte melden Sie sich einfach neu an.' }, 404);
    const t = TERMINE.get(z.termin);
    if (!t) return json({ ok: false, fehler: 'Diesen Termin gibt es nicht mehr.' }, 404);
    if (z.status === 'abgemeldet') return json({ ok: false, fehler: 'Diese Anmeldung wurde bereits storniert. Bitte melden Sie sich neu an.' }, 409);
    const b = basis(request);
    if (z.status === 'offen') {
      if (t.plaetze && (await belegt(env, t.id, z.id)) + z.personen > t.plaetze)
        return json({ ok: false, fehler: 'Leider sind inzwischen alle Plätze vergeben.' }, 409);
      await env.ANMELDUNGEN.prepare("UPDATE anmeldungen SET status = 'bestaetigt', bestaetigt = ? WHERE id = ?").bind(new Date().toISOString(), z.id).run();
      z.status = 'bestaetigt';
      await sendeEinladung(env, b, t, z, d.k);
    } else if (d.erneut) {
      await sendeEinladung(env, b, t, z, d.k);
    }
    return json({ ok: true, ...oeffentlich(z, t) });
  },
};

// ---------- POST /api/anmeldung/abmelden
export const abmelden = {
  async onRequestPost({ request, env }) {
    if (!env.ANMELDUNGEN || !pruefeHerkunft(request)) return json({ ok: false, fehler: 'Ungültige Anfrage.' }, 403);
    if (!(await begrenzen(env, request))) return json({ ok: false, fehler: 'Zu viele Anfragen. Bitte in einer Minute erneut versuchen.' }, 429);
    const z = await finde(env, await leseJson(request));
    if (!z) return json({ ok: false, fehler: 'Dieser Link ist nicht (mehr) gültig.' }, 404);
    const t = TERMINE.get(z.termin);
    if (z.status !== 'abgemeldet') {
      await env.ANMELDUNGEN.prepare("UPDATE anmeldungen SET status = 'abgemeldet', abgemeldet = ? WHERE id = ?").bind(new Date().toISOString(), z.id).run();
      // Absage nur, wenn vorher eine Einladung verschickt wurde
      if (z.status === 'bestaetigt' && t && mailBereit(env)) {
        try {
          await sendeAbsage(env, basis(request), t, z);
        } catch (fehler) {
          console.error('Abmeldung, Mail:', fehler.message);
        }
      }
      z.status = 'abgemeldet';
    }
    return json({ ok: true, ...oeffentlich(z, t) });
  },
};

// ---------- Redaktion: GET /api/anmeldungen – alle Anmeldungen je Termin
const CSV_SPALTEN = [['name', 'Name'], ['email', 'E-Mail'], ['personen', 'Personen'], ['anmerkung', 'Anmerkung'], ['status', 'Status'], ['erstellt', 'Angemeldet am'], ['bestaetigt', 'Bestätigt am'], ['abgemeldet', 'Abgemeldet am']];
const STATUS_TEXT = { offen: 'unbestätigt', bestaetigt: 'bestätigt', abgemeldet: 'abgemeldet' };
const zeitDeutsch = (iso) => (iso ? new Date(iso).toLocaleString('de-DE', { timeZone: 'Europe/Berlin', day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }).replace(',', '') : '');
const csvFeld = (wert) => {
  let s = String(wert ?? '');
  if (/^[=+\-@\t\r]/.test(s)) s = "'" + s; // keine Formeln in Excel
  return /[";\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};
const dateiname = (s) => s.normalize('NFKD').replace(/[^\w-]+/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '').slice(0, 60) || 'termin';

export const redaktion = {
  async onRequestGet({ request, env }) {
    if (!(await istRedaktion(request))) return json({ fehler: 'Bitte in der Redaktion anmelden.' }, 401);
    if (!env.ANMELDUNGEN) return json({ fehler: 'Die Datenbank für Anmeldungen ist nicht eingerichtet.' }, 503);
    const url = new URL(request.url);
    const terminId = url.searchParams.get('termin');

    if (url.searchParams.get('format') === 'csv' && terminId) {
      const t = TERMINE.get(terminId);
      const { results } = await env.ANMELDUNGEN.prepare("SELECT * FROM anmeldungen WHERE termin = ? ORDER BY CASE status WHEN 'bestaetigt' THEN 0 WHEN 'offen' THEN 1 ELSE 2 END, erstellt").bind(terminId).all();
      const zeilen = [
        CSV_SPALTEN.map(([, k]) => k).join(';'),
        ...results.map((z) => CSV_SPALTEN.map(([f]) => csvFeld(f === 'status' ? STATUS_TEXT[z.status] : ['erstellt', 'bestaetigt', 'abgemeldet'].includes(f) ? zeitDeutsch(z[f]) : z[f])).join(';')),
      ];
      const kopf = t ? `${t.titel};${t.wann}\r\n` : '';
      return new Response('﻿' + kopf + zeilen.join('\r\n') + '\r\n', {
        headers: {
          'content-type': 'text/csv; charset=utf-8',
          'content-disposition': `attachment; filename="anmeldungen-${dateiname(t ? `${t.datum}-${t.titel}` : terminId)}.csv"`,
          'cache-control': 'no-store',
        },
      });
    }

    const { results } = await env.ANMELDUNGEN.prepare(
      'SELECT id, termin, name, email, personen, anmerkung, status, erstellt, bestaetigt, abgemeldet FROM anmeldungen ORDER BY termin_datum, erstellt',
    ).all();
    const gruppen = new Map();
    for (const t of daten.termine) if (t.anmeldung) gruppen.set(t.id, { termin: t.id, eintraege: [] });
    for (const z of results) {
      if (!gruppen.has(z.termin)) gruppen.set(z.termin, { termin: z.termin, eintraege: [] });
      gruppen.get(z.termin).eintraege.push(z);
    }
    return json({ termine: [...gruppen.values()], mailBereit: mailBereit(env), stand: heute() });
  },

  // POST /api/anmeldungen { aktion: 'loeschen', id } – einzelne Anmeldung entfernen
  async onRequestPost({ request, env }) {
    if (!(await istRedaktion(request))) return json({ fehler: 'Bitte in der Redaktion anmelden.' }, 401);
    if (!env.ANMELDUNGEN) return json({ fehler: 'Die Datenbank für Anmeldungen ist nicht eingerichtet.' }, 503);
    const d = await leseJson(request);
    if (d?.aktion !== 'loeschen' || typeof d.id !== 'string') return json({ fehler: 'Ungültige Anfrage.' }, 400);
    const r = await env.ANMELDUNGEN.prepare('DELETE FROM anmeldungen WHERE id = ?').bind(d.id).run();
    return json({ ok: true, geloescht: r.meta?.changes ?? 0 });
  },
};

// ---------- Täglich: alte Daten löschen
export async function aufraeumen(env) {
  if (!env.ANMELDUNGEN) return;
  const grenzeOffen = new Date(Date.now() - OFFEN_STUNDEN * 3600e3).toISOString();
  const grenzeTermin = tagPlus(heute(), -AUFHEBEN_TAGE);
  const a = await env.ANMELDUNGEN.prepare("DELETE FROM anmeldungen WHERE status = 'offen' AND erstellt < ?").bind(grenzeOffen).run();
  const b = await env.ANMELDUNGEN.prepare('DELETE FROM anmeldungen WHERE termin_datum < ?').bind(grenzeTermin).run();
  console.log('Anmeldungen aufgeräumt:', a.meta?.changes ?? 0, 'unbestätigt,', b.meta?.changes ?? 0, 'nach Veranstaltung');
}
