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
