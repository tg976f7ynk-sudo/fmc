// Kontaktformular: prüft die Eingaben und verschickt sie per E-Mail über das
// Postfach des Vereins (SMTP). Einstellungen (im Worker unter Einstellungen → Variablen und Secrets):
//   SMTP_HOST   Postausgangsserver, z. B. smtp.ionos.de
//   SMTP_PORT   465 (Standard, verschlüsselt)
//   SMTP_USER   Postfach-Adresse, z. B. kontakt@fmc-dietzenbach.org
//   SMTP_PASS   Passwort des Postfachs (als Secret anlegen!)
//   MAIL_AN     Empfänger der Anfragen (Standard: SMTP_USER)
//   MAIL_VON    Absenderadresse (Standard: SMTP_USER)
// Schutz vor Spam und Missbrauch:
//   - verstecktes Feld und Mindestzeit (immer aktiv)
//   - höchstens 3 Nachrichten pro Minute je Besucher (KONTAKT_LIMIT, siehe wrangler.jsonc)
//   - Cloudflare Turnstile, sobald TURNSTILE_SITEKEY und TURNSTILE_SECRET eingetragen sind
import { sendeMail } from './mail.js';

const json = (daten, status = 200) => Response.json(daten, { status, headers: { 'cache-control': 'no-store' } });
const einzeilig = (s) => String(s ?? '').replace(/[\r\n\t]+/g, ' ').trim();

export const turnstileAktiv = (env) => Boolean(env.TURNSTILE_SITEKEY && env.TURNSTILE_SECRET);

// Das Formular fragt hier ab, ob (und mit welchem Schlüssel) die Sicherheitsprüfung aktiv ist.
export async function onRequestGet({ env }) {
  return json({ turnstile: turnstileAktiv(env) ? env.TURNSTILE_SITEKEY : null });
}

export async function pruefeTurnstile(env, token, ip) {
  if (!token || typeof token !== 'string' || token.length > 2048) return false;
  const daten = new URLSearchParams({ secret: env.TURNSTILE_SECRET, response: token });
  if (ip) daten.set('remoteip', ip);
  const antwort = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', { method: 'POST', body: daten });
  const ergebnis = await antwort.json().catch(() => ({}));
  return ergebnis.success === true;
}

export async function onRequestPost({ request, env }) {
  const ip = request.headers.get('cf-connecting-ip') || '';
  if ((request.headers.get('content-length') || 0) > 20000) return json({ ok: false, fehler: 'Die Nachricht ist zu lang.' }, 413);
  const herkunft = request.headers.get('origin');
  if (herkunft && new URL(herkunft).host !== new URL(request.url).host) return json({ ok: false, fehler: 'Ungültige Anfrage.' }, 403);

  // Begrenzung je Besucher
  if (env.KONTAKT_LIMIT) {
    const { success } = await env.KONTAKT_LIMIT.limit({ key: ip || 'unbekannt' });
    if (!success) return json({ ok: false, fehler: 'Zu viele Nachrichten in kurzer Zeit. Bitte versuchen Sie es in einer Minute erneut.' }, 429);
  }

  let d;
  try {
    d = await request.json();
  } catch {
    return json({ ok: false, fehler: 'Ungültige Anfrage.' }, 400);
  }
  if (!d || typeof d !== 'object') return json({ ok: false, fehler: 'Ungültige Anfrage.' }, 400);

  // Spam-Schutz: verstecktes Feld ausgefüllt oder Formular in unter 3 Sekunden abgeschickt
  if (einzeilig(d.website) || Number(d.dauer) < 3000) return json({ ok: true });

  const name = einzeilig(d.name).slice(0, 120);
  const email = einzeilig(d.email).slice(0, 200);
  const betreff = einzeilig(d.betreff).slice(0, 200) || 'Anfrage über die Webseite';
  const nachricht = String(d.nachricht ?? '').trim().slice(0, 5000);
  if (!name || !nachricht || !/^[^\s@<>"',;]+@[^\s@<>"',;]+\.[a-z]{2,}$/i.test(email))
    return json({ ok: false, fehler: 'Bitte füllen Sie Name, E-Mail-Adresse und Nachricht vollständig aus.' }, 400);
  if (!d.einwilligung) return json({ ok: false, fehler: 'Bitte stimmen Sie der Verwendung Ihrer Angaben zu.' }, 400);

  if (turnstileAktiv(env)) {
    let bestanden = false;
    try {
      bestanden = await pruefeTurnstile(env, d.turnstile, ip);
    } catch (fehler) {
      console.error('Turnstile:', fehler.message);
    }
    if (!bestanden) return json({ ok: false, fehler: 'Die Sicherheitsprüfung ist fehlgeschlagen. Bitte laden Sie die Seite neu und versuchen Sie es erneut.' }, 400);
  }

  if (!env.SMTP_HOST || !env.SMTP_USER || !env.SMTP_PASS) {
    console.error('Kontaktformular: SMTP ist nicht eingerichtet');
    return json({ ok: false, fehler: 'Das Formular ist noch nicht eingerichtet. Bitte schreiben Sie uns direkt per E-Mail.' }, 503);
  }

  const text = `Neue Nachricht über das Kontaktformular der Webseite\n\nName:    ${name}\nE-Mail:  ${email}\nBetreff: ${betreff}\n\n${nachricht}\n`;
  try {
    await sendeMail(env, { vonName: 'Kontaktformular FMCD', antwortAn: email, betreff: `[Webseite] ${betreff}`, text });
    return json({ ok: true });
  } catch (fehler) {
    console.error('Kontaktformular:', fehler.message);
    return json({ ok: false, fehler: 'Die Nachricht konnte nicht gesendet werden. Bitte schreiben Sie uns direkt per E-Mail.' }, 502);
  }
}
