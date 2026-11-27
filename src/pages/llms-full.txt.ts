// Alle Inhalte als reiner Text in einer Datei – für Sprachmodelle und Archivierung.
import type { APIRoute } from 'astro';
import seite from '../data/einstellungen.json';
import { suchindex } from './suchindex.json';

export const GET: APIRoute = async ({ site }) => {
  const docs = await suchindex();
  const reihenfolge = ['Seite', 'Termin', 'Beitrag', 'Galerie'];
  docs.sort((a, b) => reihenfolge.indexOf(a.art) - reihenfolge.indexOf(b.art) || (b.datum ?? '').localeCompare(a.datum ?? ''));
  const teile = [
    `# ${seite.name} – alle Inhalte`,
    '',
    `> ${seite.beschreibung}`,
    `> Stand: ${new Date().toISOString().slice(0, 10)} · Quelle: ${new URL('/', site).href} · Bitte bei Verwendung die Quelle mit Link angeben.`,
    '',
    ...docs.map((d) =>
      [`## ${d.titel}`, '', `- Art: ${d.art}`, d.datum ? `- Datum: ${d.datum}` : '', d.kategorien?.length ? `- Kategorien: ${d.kategorien.join(', ')}` : '', `- Adresse: ${new URL(d.url, site).href}`, '', d.text, '']
        .filter((z) => z !== '')
        .join('\n') + '\n',
    ),
  ];
  return new Response(teile.join('\n'), { headers: { 'content-type': 'text/plain; charset=utf-8' } });
};
