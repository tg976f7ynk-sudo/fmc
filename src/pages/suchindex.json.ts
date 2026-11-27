// Suchindex über alle Inhalte – Grundlage für die Suche auf der Webseite,
// die Such-Schnittstelle /api/suche und den MCP-Zugang /mcp.
import type { APIRoute } from 'astro';
import { getCollection } from 'astro:content';
import { alleBeitraege, alleTermine, beitragUrl, isoTag, kurztext, zeitraum } from '../lib/inhalte';
import { klartext, normal } from '../lib/suchtext';

export type Dokument = {
  id: string;
  url: string;
  titel: string;
  art: 'Beitrag' | 'Seite' | 'Galerie' | 'Termin';
  datum?: string;
  kategorien?: string[];
  auszug: string;
  text: string;
};

export async function suchindex(): Promise<Dokument[]> {
  const docs: Dokument[] = [];
  for (const b of await alleBeitraege()) {
    docs.push({
      id: `beitrag:${b.id}`,
      url: beitragUrl(b),
      titel: b.data.titel,
      art: 'Beitrag',
      datum: isoTag(b.data.datum),
      kategorien: b.data.kategorien,
      auszug: kurztext(b, 220),
      text: (() => {
        const t = klartext(b.body ?? '');
        return b.data.titelbild_alt && !t.includes(b.data.titelbild_alt) ? `${b.data.titelbild_alt}\n${t}` : t;
      })(),
    });
  }
  for (const s of await getCollection('seiten')) {
    const text = klartext(s.body ?? '');
    docs.push({ id: `seite:${s.id}`, url: `/${s.id}/`, titel: s.data.titel, art: 'Seite', auszug: s.data.untertitel || text.slice(0, 220), text: [s.data.untertitel, text].filter(Boolean).join('\n') });
  }
  for (const g of await getCollection('galerien')) {
    const text = klartext(g.body ?? '');
    docs.push({
      id: `galerie:${g.id}`,
      url: `/impressionen/${g.id}/`,
      titel: `${g.data.titel} ${g.data.jahr}`,
      art: 'Galerie',
      datum: g.data.datum ? isoTag(g.data.datum) : `${g.data.jahr}-01-01`,
      auszug: `Bildergalerie mit ${g.data.bilder.length} Fotos vom ${g.data.titel} ${g.data.jahr}.`,
      text: [`Bildergalerie ${g.data.titel} ${g.data.jahr}, ${g.data.bilder.length} Fotos`, text].filter(Boolean).join('\n'),
    });
  }
  for (const t of await alleTermine()) {
    const d = t.data;
    const wann = [zeitraum(d.datum, d.ende), d.uhrzeit].filter(Boolean).join(', ');
    docs.push({
      id: `termin:${t.id}`,
      url: d.link || '/termine/',
      titel: d.titel,
      art: 'Termin',
      datum: isoTag(d.datum),
      auszug: [wann, d.ort, d.beschreibung].filter(Boolean).join(' · '),
      text: [`Termin: ${d.titel}`, wann, d.ort, d.beschreibung, d.bild_alt].filter(Boolean).join('\n'),
    });
  }
  return docs;
}

// Für den Worker vorbereitet: normalisierte Felder schon beim Bau berechnen (spart CPU-Zeit pro Aufruf)
export const GET: APIRoute = async () =>
  new Response(JSON.stringify({
    erstellt: new Date().toISOString(),
    dokumente: (await suchindex()).map((d) => ({ ...d, n: { t: ` ${normal(d.titel)} `, x: ` ${normal(d.text)} `, k: ` ${normal((d.kategorien || []).join(' '))} ` } })),
  }), {
    headers: { 'content-type': 'application/json; charset=utf-8' },
  });
