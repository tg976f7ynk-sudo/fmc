// Kalenderdaten (iCalendar) für Termine: Einladung, Absage und Download.
// Uhrzeiten wie „17–20 Uhr“ oder „ab 10 Uhr“ werden erkannt, sonst ganztägig.
const tag = (iso) => iso.replaceAll('-', '');
const naechsterTag = (iso) => new Date(Date.parse(iso + 'T12:00:00Z') + 864e5).toISOString().slice(0, 10).replaceAll('-', '');
const text = (s) => String(s ?? '').replace(/\\/g, '\\\\').replace(/;/g, '\;').replace(/,/g, '\\,').replace(/\r?\n/g, '\\n');
const falten = (zeile) => {
  const teile = [];
  let rest = zeile;
  const enc = new TextEncoder();
  while (enc.encode(rest).length > 74) {
    let n = 74;
    while (enc.encode(rest.slice(0, n)).length > 74) n--;
    teile.push(rest.slice(0, n));
    rest = ' ' + rest.slice(n);
  }
  teile.push(rest);
  return teile.join('\r\n');
};
const ZEITZONE = ['BEGIN:VTIMEZONE', 'TZID:Europe/Berlin', 'BEGIN:DAYLIGHT', 'TZOFFSETFROM:+0100', 'TZOFFSETTO:+0200', 'TZNAME:CEST', 'DTSTART:19700329T020000', 'RRULE:FREQ=YEARLY;BYMONTH=3;BYDAY=-1SU', 'END:DAYLIGHT', 'BEGIN:STANDARD', 'TZOFFSETFROM:+0200', 'TZOFFSETTO:+0100', 'TZNAME:CET', 'DTSTART:19701025T030000', 'RRULE:FREQ=YEARLY;BYMONTH=10;BYDAY=-1SU', 'END:STANDARD', 'END:VTIMEZONE'];

// Start- und Endzeit eines Termins
export function zeiten(t) {
  const m = /(\d{1,2})(?::(\d{2}))?\s*(?:[–-]\s*(\d{1,2})(?::(\d{2}))?)?\s*Uhr/.exec(t.uhrzeit ?? '');
  if (m && (!t.ende || t.ende === t.datum)) {
    const hh = (h, mm) => `${String(h).padStart(2, '0')}${String(mm ?? '00').padStart(2, '0')}00`;
    const start = `${tag(t.datum)}T${hh(m[1], m[2])}`;
    const ende = m[3] ? `${tag(t.datum)}T${hh(m[3], m[4])}` : `${tag(t.datum)}T${hh(Math.min(23, Number(m[1]) + 3), m[2])}`;
    return { ganztags: false, start, ende };
  }
  return { ganztags: true, start: tag(t.datum), ende: naechsterTag(t.ende || t.datum) };
}

export function kalender(t, { methode = 'PUBLISH', basis, uid, organisator, teilnehmer, abmeldeLink, sequenz = 0 } = {}) {
  const z = zeiten(t);
  const jetzt = new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d+/, '');
  const beschreibung = [t.beschreibung, t.uhrzeit && z.ganztags ? t.uhrzeit : null, `Weitere Infos: ${new URL(t.link || '/termine/', basis).href}`, abmeldeLink ? `Abmelden: ${abmeldeLink}` : null].filter(Boolean).join('\n');
  const zeilen = [
    'BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//FMC Dietzenbach//Termine//DE', 'CALSCALE:GREGORIAN', `METHOD:${methode}`,
    ...(z.ganztags ? [] : ZEITZONE),
    'BEGIN:VEVENT',
    `UID:${uid || t.id}@fmc-dietzenbach.org`,
    `SEQUENCE:${sequenz}`,
    `DTSTAMP:${jetzt}`,
    z.ganztags ? `DTSTART;VALUE=DATE:${z.start}` : `DTSTART;TZID=Europe/Berlin:${z.start}`,
    z.ganztags ? `DTEND;VALUE=DATE:${z.ende}` : `DTEND;TZID=Europe/Berlin:${z.ende}`,
    `SUMMARY:${text(t.titel)}`,
    t.ort ? `LOCATION:${text(t.ort)}` : null,
    `DESCRIPTION:${text(beschreibung)}`,
    `URL:${new URL(t.link || '/termine/', basis).href}`,
    organisator ? `ORGANIZER;CN=${text('FMC Dietzenbach')}:mailto:${organisator}` : null,
    teilnehmer ? `ATTENDEE;CN=${text(teilnehmer.name)};ROLE=REQ-PARTICIPANT;PARTSTAT=ACCEPTED;RSVP=FALSE:mailto:${teilnehmer.email}` : null,
    `STATUS:${methode === 'CANCEL' ? 'CANCELLED' : 'CONFIRMED'}`,
    'TRANSP:OPAQUE',
    'END:VEVENT', 'END:VCALENDAR',
  ].filter(Boolean);
  return zeilen.map(falten).join('\r\n') + '\r\n';
}
