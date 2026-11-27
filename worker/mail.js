// Mailversand über das Postfach des Vereins (SMTP, z. B. smtp.ionos.de).
// Einstellungen im Worker: SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS (Secret), MAIL_VON, MAIL_AN.
import { connect } from 'cloudflare:sockets';

export const mailBereit = (env) => Boolean(env.SMTP_HOST && env.SMTP_USER && env.SMTP_PASS);
export const b64 = (text) => {
  const bytes = typeof text === 'string' ? new TextEncoder().encode(text) : text;
  let bin = '';
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin);
};
const zeilen76 = (s) => s.replace(/(.{76})/g, '$1\r\n');
const kopfwort = (text) => (/^[\x20-\x7e]*$/.test(text) ? text : `=?UTF-8?B?${b64(text)}?=`);
const sauber = (s) => String(s ?? '').replace(/[\r\n<>"]/g, ' ').trim();

// Baut die Nachricht: Text, optional mit Kalendereinladung (für Google, Apple, Outlook, GMX, Web.de)
function nachricht({ von, vonName, an, anName, antwortAn, betreff, text, kalender }) {
  const domain = von.split('@')[1] || 'fmc-dietzenbach.org';
  const kopf = [
    `From: ${kopfwort(vonName)} <${von}>`,
    `To: ${anName ? kopfwort(sauber(anName)) + ' ' : ''}<${an}>`,
    antwortAn ? `Reply-To: <${antwortAn}>` : null,
    `Subject: ${kopfwort(betreff)}`,
    `Date: ${new Date().toUTCString().replace('GMT', '+0000')}`,
    `Message-ID: <${crypto.randomUUID()}@${domain}>`,
    'MIME-Version: 1.0',
  ].filter(Boolean);
  const textTeil = ['Content-Type: text/plain; charset=UTF-8', 'Content-Transfer-Encoding: base64', '', zeilen76(b64(text))];
  if (!kalender) return [...kopf, ...textTeil].join('\r\n');
  const g1 = `gemischt-${crypto.randomUUID()}`, g2 = `alternativ-${crypto.randomUUID()}`;
  const ics = zeilen76(b64(kalender.inhalt));
  return [
    ...kopf,
    `Content-Type: multipart/mixed; boundary="${g1}"`,
    '',
    `--${g1}`,
    `Content-Type: multipart/alternative; boundary="${g2}"`,
    '',
    `--${g2}`,
    ...textTeil,
    `--${g2}`,
    `Content-Type: text/calendar; charset=UTF-8; method=${kalender.methode}`,
    'Content-Transfer-Encoding: base64',
    '',
    ics,
    `--${g2}--`,
    `--${g1}`,
    `Content-Type: application/ics; name="${kalender.dateiname}"`,
    `Content-Disposition: attachment; filename="${kalender.dateiname}"`,
    'Content-Transfer-Encoding: base64',
    '',
    ics,
    `--${g1}--`,
  ].join('\r\n');
}

export async function sendeMail(env, { an, anName, antwortAn, betreff, text, vonName = 'FMC Dietzenbach', kalender }) {
  const von = env.MAIL_VON || env.SMTP_USER;
  an = an || env.MAIL_AN || env.SMTP_USER;
  const socket = connect({ hostname: env.SMTP_HOST, port: Number(env.SMTP_PORT || 465) }, { secureTransport: env.SMTP_SECURE === 'off' ? 'off' : 'on' });
  const schreiber = socket.writable.getWriter();
  const leser = socket.readable.getReader();
  const enc = new TextEncoder(), dec = new TextDecoder();
  let puffer = '';
  // Liest eine vollständige (ggf. mehrzeilige) Antwort des Mailservers
  const lies = async () => {
    for (;;) {
      const z = puffer.split('\r\n');
      for (let i = 0; i < z.length - 1; i++) {
        if (/^\d{3}(?: |$)/.test(z[i])) { puffer = z.slice(i + 1).join('\r\n'); return z[i]; }
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
    // Punkt am Zeilenanfang verdoppeln (SMTP-Regel)
    const inhalt = nachricht({ von, vonName, an, anName, antwortAn, betreff, text, kalender }).replace(/\r\n\./g, '\r\n..');
    await befehl(inhalt + '\r\n.', 250, 'Nachricht');
    await schreiber.write(enc.encode('QUIT\r\n'));
  } finally {
    try { await socket.close(); } catch {}
  }
}
