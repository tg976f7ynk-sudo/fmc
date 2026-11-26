// Kontaktformular: prüft die Eingaben und verschickt sie per E-Mail über das
// Postfach des Vereins (SMTP). Einstellungen (in Cloudflare als Variablen/Secrets):
//   SMTP_HOST   z. B. smtp.strato.de
//   SMTP_PORT   465 (Standard, verschlüsselt)
//   SMTP_USER   Postfach-Adresse, z. B. kontakt@fmc-dietzenbach.org
//   SMTP_PASS   Passwort des Postfachs (als Secret anlegen!)
//   MAIL_AN     Empfänger der Anfragen (Standard: SMTP_USER)
//   MAIL_VON    Absenderadresse (Standard: SMTP_USER)
import { connect } from 'cloudflare:sockets';

const json = (daten, status = 200) => Response.json(daten, { status, headers: { 'cache-control': 'no-store' } });
const einzeilig = (s) => String(s ?? '').replace(/[\r\n\t]+/g, ' ').trim();
const b64 = (text) => {
  const bytes = new TextEncoder().encode(text);
  let bin = '';
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin);
};
const kopfwort = (text) => `=?UTF-8?B?${b64(text)}?=`;

export async function onRequestPost({ request, env }) {
  let d;
  try {
    d = await request.json();
  } catch {
    return json({ ok: false, fehler: 'Ungültige Anfrage.' }, 400);
  }
  const herkunft = request.headers.get('origin');
  if (herkunft && new URL(herkunft).host !== new URL(request.url).host) return json({ ok: false, fehler: 'Ungültige Anfrage.' }, 403);

  // Spam-Schutz: verstecktes Feld ausgefüllt oder Formular in unter 3 Sekunden abgeschickt
  if (einzeilig(d.website) || Number(d.dauer) < 3000) return json({ ok: true });

  const name = einzeilig(d.name).slice(0, 120);
  const email = einzeilig(d.email).slice(0, 200);
  const betreff = einzeilig(d.betreff).slice(0, 200) || 'Anfrage über die Webseite';
  const nachricht = String(d.nachricht ?? '').trim().slice(0, 5000);
  if (!name || !nachricht || !/^[^\s@<>"',;]+@[^\s@<>"',;]+\.[a-z]{2,}$/i.test(email))
    return json({ ok: false, fehler: 'Bitte füllen Sie Name, E-Mail-Adresse und Nachricht vollständig aus.' }, 400);
  if (!d.einwilligung) return json({ ok: false, fehler: 'Bitte stimmen Sie der Verwendung Ihrer Angaben zu.' }, 400);

  if (!env.SMTP_HOST || !env.SMTP_USER || !env.SMTP_PASS) {
    console.error('Kontaktformular: SMTP ist nicht eingerichtet');
    return json({ ok: false, fehler: 'Das Formular ist noch nicht eingerichtet. Bitte schreiben Sie uns direkt per E-Mail.' }, 503);
  }

  const text = `Neue Nachricht über das Kontaktformular der Webseite\n\nName:    ${name}\nE-Mail:  ${email}\nBetreff: ${betreff}\n\n${nachricht}\n`;
  try {
    await sendeMail(env, { antwortAn: email, betreff: `[Webseite] ${betreff}`, text });
    return json({ ok: true });
  } catch (fehler) {
    console.error('Kontaktformular:', fehler.message);
    return json({ ok: false, fehler: 'Die Nachricht konnte nicht gesendet werden. Bitte schreiben Sie uns direkt per E-Mail.' }, 502);
  }
}

async function sendeMail(env, { antwortAn, betreff, text }) {
  const von = env.MAIL_VON || env.SMTP_USER;
  const an = env.MAIL_AN || env.SMTP_USER;
  const socket = connect(
    { hostname: env.SMTP_HOST, port: Number(env.SMTP_PORT || 465) },
    { secureTransport: env.SMTP_SECURE === 'off' ? 'off' : 'on' },
  );
  const schreiber = socket.writable.getWriter();
  const leser = socket.readable.getReader();
  const enc = new TextEncoder();
  const dec = new TextDecoder();
  let puffer = '';

  // Liest eine vollständige (ggf. mehrzeilige) Antwort des Mailservers
  const lies = async () => {
    for (;;) {
      const zeilen = puffer.split('\r\n');
      for (let i = 0; i < zeilen.length - 1; i++) {
        if (/^\d{3}(?: |$)/.test(zeilen[i])) {
          puffer = zeilen.slice(i + 1).join('\r\n');
          return zeilen[i];
        }
      }
      const { value, done } = await leser.read();
      if (done) throw new Error('Verbindung zum Mailserver wurde beendet');
      puffer += dec.decode(value, { stream: true });
    }
  };
  const befehl = async (zeile, erwartet, was) => {
    if (zeile !== null) await schreiber.write(enc.encode(zeile + '\r\n'));
    const antwort = await lies();
    if (!antwort.startsWith(String(erwartet))) throw new Error(`Mailserver lehnt ab bei „${was}“: ${antwort.slice(0, 120)}`);
  };

  try {
    await befehl(null, 220, 'Begrüßung');
    await befehl('EHLO fmc-dietzenbach.org', 250, 'EHLO');
    await befehl('AUTH LOGIN', 334, 'Anmeldung');
    await befehl(b64(env.SMTP_USER), 334, 'Benutzername');
    await befehl(b64(env.SMTP_PASS), 235, 'Passwort');
    await befehl(`MAIL FROM:<${von}>`, 250, 'Absender');
    await befehl(`RCPT TO:<${an}>`, 250, 'Empfänger');
    await befehl('DATA', 354, 'DATA');
    const koerper = b64(text).replace(/(.{76})/g, '$1\r\n');
    const mail = [
      `From: ${kopfwort('Kontaktformular FMCD')} <${von}>`,
      `To: <${an}>`,
      `Reply-To: <${antwortAn}>`,
      `Subject: ${kopfwort(betreff)}`,
      `Date: ${new Date().toUTCString().replace('GMT', '+0000')}`,
      `Message-ID: <${crypto.randomUUID()}@${von.split('@')[1] || 'fmc-dietzenbach.org'}>`,
      'MIME-Version: 1.0',
      'Content-Type: text/plain; charset=UTF-8',
      'Content-Transfer-Encoding: base64',
      '',
      koerper,
    ].join('\r\n');
    await befehl(mail + '\r\n.', 250, 'Nachricht');
    await schreiber.write(enc.encode('QUIT\r\n'));
  } finally {
    try {
      await socket.close();
    } catch {}
  }
}
