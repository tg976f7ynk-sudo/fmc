import rss from '@astrojs/rss';
import seite from '../data/einstellungen.json';
import { alleBeitraege, beitragUrl, kurztext } from '../lib/inhalte';

export async function GET(context) {
  const beitraege = await alleBeitraege();
  return rss({
    title: `${seite.name} – Aktuelles`,
    description: seite.beschreibung,
    site: context.site,
    items: beitraege.slice(0, 30).map((b) => ({
      title: b.data.titel,
      pubDate: b.data.datum,
      description: kurztext(b, 300),
      link: beitragUrl(b),
    })),
    customData: '<language>de-de</language>',
  });
}
