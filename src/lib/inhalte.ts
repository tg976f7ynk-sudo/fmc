import { getCollection, type CollectionEntry } from 'astro:content';

export type Beitrag = CollectionEntry<'beitraege'>;
export type Termin = CollectionEntry<'termine'>;

export function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/ä/g, 'ae').replace(/ö/g, 'oe').replace(/ü/g, 'ue').replace(/ß/g, 'ss')
    .normalize('NFKD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
}

/** Ordnername "2026-10-16-wasserflugtreffen" -> Adresse "wasserflugtreffen" */
export const beitragSlug = (b: Beitrag) => b.id.replace(/^\d{4}-\d{2}-\d{2}-/, '') || b.id;
export const beitragUrl = (b: Beitrag) => `/aktuelles/${beitragSlug(b)}/`;
export const kategorieUrl = (k: string) => `/aktuelles/kategorie/${slugify(k)}/`;

export async function alleBeitraege(): Promise<Beitrag[]> {
  const liste = await getCollection('beitraege', ({ data }) => !data.entwurf);
  return liste.sort((a, b) => b.data.datum.valueOf() - a.data.datum.valueOf());
}

export async function alleTermine(): Promise<Termin[]> {
  const liste = await getCollection('termine');
  return liste.sort((a, b) => a.data.datum.valueOf() - b.data.datum.valueOf());
}

const lang = new Intl.DateTimeFormat('de-DE', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' });
export const datumLang = (d: Date) => lang.format(d);
export const isoTag = (d: Date) => d.toISOString().slice(0, 10);

/** "17.–18. Oktober 2026", "30. Oktober – 1. November 2026" */
export function zeitraum(von: Date, bis?: Date | null): string {
  if (!bis || isoTag(bis) <= isoTag(von)) return datumLang(von);
  const m = new Intl.DateTimeFormat('de-DE', { month: 'long', timeZone: 'UTC' });
  if (von.getUTCFullYear() === bis.getUTCFullYear() && von.getUTCMonth() === bis.getUTCMonth())
    return `${von.getUTCDate()}.–${bis.getUTCDate()}. ${m.format(bis)} ${bis.getUTCFullYear()}`;
  if (von.getUTCFullYear() === bis.getUTCFullYear())
    return `${von.getUTCDate()}. ${m.format(von)} – ${bis.getUTCDate()}. ${m.format(bis)} ${bis.getUTCFullYear()}`;
  return `${datumLang(von)} – ${datumLang(bis)}`;
}

/** Kurzer Vorschautext aus dem Markdown-Text eines Beitrags */
export function kurztext(b: Beitrag, laenge = 170): string {
  if (b.data.kurztext) return b.data.kurztext;
  const text = (b.body ?? '')
    .replace(/!\[[^\]]*\]\([^)]*\)/g, ' ')
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/<[^>]+>/g, ' ')
    .replace(/https?:\/\/\S+/g, ' ')
    .replace(/^\s*\|.*$/gm, ' ')
    .replace(/[#*_>`\\|]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
  if (text.length <= laenge) return text;
  return text.slice(0, laenge).replace(/\s+\S*$/, '') + ' …';
}
