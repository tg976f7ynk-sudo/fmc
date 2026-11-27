// Hilfsfunktionen für den Suchindex: Markdown in reinen Text umwandeln.
export function klartext(markdown: string): string {
  return (markdown ?? '')
    .replace(/!\[([^\]]*)\]\([^)]*\)/g, (_, alt) => (alt ? ` ${alt} ` : ' ')) // Bilder: Beschreibung behalten
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1') // Links: Linktext
    .replace(/<[^>]+>/g, ' ')
    .replace(/https?:\/\/\S+/g, ' ')
    .replace(/^\s{0,3}#{1,6}\s*/gm, '')
    .replace(/^\s*[-*+]\s+/gm, '')
    .replace(/^\s*\|?[-:\s|]+\|?\s*$/gm, ' ')
    .replace(/[|*_`>~]/g, ' ')
    .replace(/\\\n/g, ' ')
    .replace(/[ \t]+/g, ' ')
    .replace(/\s*\n\s*/g, '\n')
    .trim();
}

// Muss mit normal() in worker/suchmaschine.js übereinstimmen
export const normal = (s: string) =>
  String(s ?? '')
    .toLowerCase()
    .replace(/ä/g, 'ae').replace(/ö/g, 'oe').replace(/ü/g, 'ue').replace(/ß/g, 'ss')
    .normalize('NFKD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
