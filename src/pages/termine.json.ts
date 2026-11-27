// Öffentliche Termindaten (ohne Teilnehmer). Der Worker bündelt diese Datei für die Anmeldung.
import type { APIRoute } from 'astro';
import { termineDaten } from '../lib/termine-daten';

export const GET: APIRoute = async () => Response.json({ termine: await termineDaten() });
