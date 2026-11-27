// Kalenderdatei je Termin (ohne persönliche Daten) – zum Herunterladen für Apple, GMX, Web.de und Outlook.
import type { APIRoute, GetStaticPaths } from 'astro';
import { termineDaten } from '../../../lib/termine-daten';
import { kalender } from '../../../../worker/kalender.js';

export const getStaticPaths = (async () => (await termineDaten()).map((t) => ({ params: { id: t.id }, props: { t } }))) satisfies GetStaticPaths;

export const GET: APIRoute = ({ props, site }) =>
  new Response(kalender(props.t, { basis: site!.href }), { headers: { 'content-type': 'text/calendar; charset=utf-8' } });
