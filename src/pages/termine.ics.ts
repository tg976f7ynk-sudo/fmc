// Alle Termine als Kalenderdatei (iCalendar), zum Herunterladen oder Abonnieren.
import type { APIRoute } from 'astro';
import { alleTermine, isoTag } from '../lib/inhalte';
import seite from '../data/einstellungen.json';

const tag = (d: Date) => isoTag(d).replaceAll('-', '');
const naechsterTag = (d: Date) => tag(new Date(d.getTime() + 86400000));
const text = (s: string) => s.replace(/\\/g, '\\\\').replace(/;/g, '\;').replace(/,/g, '\\,').replace(/\r?\n/g, '\\n');
// Zeilen nach RFC 5545 auf 75 Zeichen umbrechen
const falten = (zeile: string) => {
  const teile: string[] = [];
  let rest = zeile;
  while (new TextEncoder().encode(rest).length > 74) {
    let n = 74;
    while (new TextEncoder().encode(rest.slice(0, n)).length > 74) n--;
    teile.push(rest.slice(0, n));
    rest = ' ' + rest.slice(n);
  }
  teile.push(rest);
  return teile.join('\r\n');
};

export const GET: APIRoute = async ({ site }) => {
  const termine = await alleTermine();
  const jetzt = new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d+/, '');
  const zeilen = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//FMC Dietzenbach//Termine//DE',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    `X-WR-CALNAME:${text(seite.kurzname)} – Termine`,
    'X-WR-TIMEZONE:Europe/Berlin',
    'REFRESH-INTERVAL;VALUE=DURATION:PT12H',
    'BEGIN:VTIMEZONE',
    'TZID:Europe/Berlin',
    'BEGIN:DAYLIGHT',
    'TZOFFSETFROM:+0100',
    'TZOFFSETTO:+0200',
    'TZNAME:CEST',
    'DTSTART:19700329T020000',
    'RRULE:FREQ=YEARLY;BYMONTH=3;BYDAY=-1SU',
    'END:DAYLIGHT',
    'BEGIN:STANDARD',
    'TZOFFSETFROM:+0200',
    'TZOFFSETTO:+0100',
    'TZNAME:CET',
    'DTSTART:19701025T030000',
    'RRULE:FREQ=YEARLY;BYMONTH=10;BYDAY=-1SU',
    'END:STANDARD',
    'END:VTIMEZONE',
  ];
  for (const t of termine) {
    const d = t.data;
    // Uhrzeit wie „17–20 Uhr“ oder „ab 10 Uhr“ erkennen; sonst ganztägig
    const m = /(\d{1,2})(?::(\d{2}))?\s*(?:[–-]\s*(\d{1,2})(?::(\d{2}))?)?\s*Uhr/.exec(d.uhrzeit ?? '');
    zeilen.push('BEGIN:VEVENT', `UID:${t.id}@fmc-dietzenbach.org`, `DTSTAMP:${jetzt}`);
    if (m && (!d.ende || isoTag(d.ende) === isoTag(d.datum))) {
      const hh = (h: string, mm?: string) => `${h.padStart(2, '0')}${(mm ?? '00').padStart(2, '0')}00`;
      zeilen.push(`DTSTART;TZID=Europe/Berlin:${tag(d.datum)}T${hh(m[1], m[2])}`);
      zeilen.push(m[3] ? `DTEND;TZID=Europe/Berlin:${tag(d.datum)}T${hh(m[3], m[4])}` : 'DURATION:PT3H');
    } else {
      zeilen.push(`DTSTART;VALUE=DATE:${tag(d.datum)}`, `DTEND;VALUE=DATE:${naechsterTag(d.ende ?? d.datum)}`);
    }
    zeilen.push(`SUMMARY:${text(d.titel)}`);
    if (d.ort) zeilen.push(`LOCATION:${text(d.ort)}`);
    const beschreibung = [d.beschreibung, d.uhrzeit && !m ? d.uhrzeit : ''].filter(Boolean).join('\n');
    if (beschreibung) zeilen.push(`DESCRIPTION:${text(beschreibung)}`);
    zeilen.push(`URL:${new URL(d.link || '/termine/', site).href}`, 'END:VEVENT');
  }
  zeilen.push('END:VCALENDAR');
  return new Response(zeilen.map(falten).join('\r\n') + '\r\n', {
    headers: { 'content-type': 'text/calendar; charset=utf-8', 'content-disposition': 'inline; filename="fmcd-termine.ics"' },
  });
};
