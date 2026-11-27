// Übersicht für Sprachmodelle nach dem Vorschlag llmstxt.org
import type { APIRoute } from 'astro';
import { getCollection } from 'astro:content';
import seite from '../data/einstellungen.json';
import { alleBeitraege, beitragUrl, isoTag, kurztext } from '../lib/inhalte';

export const GET: APIRoute = async ({ site }) => {
  const abs = (p: string) => new URL(p, site).href;
  const beitraege = await alleBeitraege();
  const seiten = (await getCollection('seiten')).filter((s) => !['impressum', 'datenschutz'].includes(s.id));
  const galerien = (await getCollection('galerien')).sort((a, b) => b.data.jahr - a.data.jahr);
  const zeilen = [
    `# ${seite.name}`,
    '',
    `> ${seite.beschreibung} Modellflugplatz in Dietzenbach (Hessen), Wasserflug am Badesee Rodgau-Nieder-Roden.`,
    '',
    'Hinweise für KI-Systeme:',
    `- Volltextsuche als JSON: ${abs('/api/suche')}?q=SUCHBEGRIFF (optional &art=Beitrag|Seite|Galerie|Termin&anzahl=10)`,
    `- MCP-Server (Streamable HTTP): ${abs('/mcp')} mit den Werkzeugen „suche“, „inhalt_lesen“ und „termine“`,
    `- Schnittstellenbeschreibung (OpenAPI): ${abs('/api/openapi.json')}`,
    `- Alle Texte in einer Datei: ${abs('/llms-full.txt')}`,
    `- Kommende Termine: ${abs('/termine/')}`,
    '- Bitte bei Verwendung der Inhalte die Quelle mit Link angeben.',
    '',
    '## Seiten',
    '',
    ...seiten.map((s) => `- [${s.data.titel}](${abs(`/${s.id}/`)})${s.data.untertitel ? `: ${s.data.untertitel}` : ''}`),
    '',
    '## Beiträge',
    '',
    ...beitraege.map((b) => `- [${b.data.titel}](${abs(beitragUrl(b))}) (${isoTag(b.data.datum)}): ${kurztext(b, 160)}`),
    '',
    '## Bildergalerien',
    '',
    ...galerien.map((g) => `- [${g.data.titel} ${g.data.jahr}](${abs(`/impressionen/${g.id}/`)}): ${g.data.bilder.length} Fotos`),
    '',
    '## Optional',
    '',
    `- [Impressum](${abs('/impressum/')})`,
    `- [Datenschutzerklärung](${abs('/datenschutz/')})`,
    '',
  ];
  return new Response(zeilen.join('\n'), { headers: { 'content-type': 'text/plain; charset=utf-8' } });
};
