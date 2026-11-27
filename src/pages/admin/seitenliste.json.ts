// Titel aller Seiten für die Statistik der Redaktion (Adresse → Titel und Art).
import type { APIRoute } from 'astro';
import { getCollection } from 'astro:content';
import { alleBeitraege, beitragUrl } from '../../lib/inhalte';

export const GET: APIRoute = async () => {
  const liste: Record<string, { titel: string; art: string }> = {
    '/': { titel: 'Startseite', art: 'Seite' },
    '/aktuelles/': { titel: 'Aktuelles (Übersicht)', art: 'Seite' },
    '/impressionen/': { titel: 'Impressionen (Übersicht)', art: 'Seite' },
  };
  for (const b of await alleBeitraege()) liste[beitragUrl(b)] = { titel: b.data.titel, art: 'Beitrag' };
  for (const s of await getCollection('seiten')) liste[`/${s.id}/`] = { titel: s.data.titel, art: 'Seite' };
  for (const g of await getCollection('galerien')) liste[`/impressionen/${g.id}/`] = { titel: `${g.data.titel} ${g.data.jahr}`, art: 'Galerie' };
  return new Response(JSON.stringify(liste), { headers: { 'content-type': 'application/json; charset=utf-8' } });
};
