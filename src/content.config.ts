import { defineCollection } from 'astro:content';
import { glob } from 'astro/loaders';
import { z } from 'astro/zod';

// Bilder liegen direkt neben dem jeweiligen Eintrag ("foto.jpg" -> "./foto.jpg")
// Leere Felder aus dem Redaktionssystem ('' oder null) gelten als „nicht ausgefüllt“.
const neben = (v: unknown) => {
  if (v === '' || v === null) return undefined;
  return typeof v === 'string' && !/^(\.{1,2}\/|\/|https?:)/.test(v) ? './' + v : v;
};
const leerZuUndefined = (v: unknown) => (v === '' || v === null ? undefined : v);
const bildliste = (image: () => any) =>
  z.preprocess((v) => (Array.isArray(v) ? v.filter((x) => x !== '' && x !== null) : v ?? []), z.array(z.preprocess(neben, image())).default([]));
const ordnerId = ({ entry }: { entry: string }) => entry.split('/')[0];

export const KATEGORIEN = ['Aktuelles', 'Veranstaltungen', 'Verein', 'Baubericht', 'Kruschelkiste', 'Bembel Crawler'] as const;

const beitraege = defineCollection({
  loader: glob({ pattern: '*/index.md', base: './src/content/beitraege', generateId: ordnerId }),
  schema: ({ image }) =>
    z.object({
      titel: z.string(),
      datum: z.coerce.date(),
      kategorien: z.array(z.string()).default(['Aktuelles']),
      titelbild: z.preprocess(neben, image().optional()),
      titelbild_alt: z.preprocess(leerZuUndefined, z.string().optional()),
      kurztext: z.preprocess(leerZuUndefined, z.string().optional()),
      bilder: bildliste(image),
      entwurf: z.boolean().default(false),
    }),
});

const seiten = defineCollection({
  loader: glob({ pattern: '*/index.md', base: './src/content/seiten', generateId: ordnerId }),
  schema: ({ image }) =>
    z.object({
      titel: z.string(),
      untertitel: z.preprocess(leerZuUndefined, z.string().optional()),
      bilder: bildliste(image),
    }),
});

const galerien = defineCollection({
  loader: glob({ pattern: '*/index.md', base: './src/content/galerien', generateId: ordnerId }),
  schema: ({ image }) =>
    z.object({
      titel: z.string(),
      jahr: z.coerce.number(),
      datum: z.preprocess(leerZuUndefined, z.coerce.date().optional()),
      bilder: bildliste(image),
    }),
});

const termine = defineCollection({
  loader: glob({ pattern: '*.{yml,yaml}', base: './src/content/termine' }),
  schema: ({ image }) => z.object({
    titel: z.string(),
    datum: z.coerce.date(),
    ende: z.preprocess(leerZuUndefined, z.coerce.date().optional().nullable()),
    uhrzeit: z.string().optional().nullable(),
    ort: z.string().optional().nullable(),
    beschreibung: z.string().optional().nullable(),
    link: z.string().optional().nullable(),
    bild: z.preprocess(neben, image().optional()),
    bild_alt: z.preprocess(leerZuUndefined, z.string().optional().nullable()),
    anmeldung: z.boolean().default(false),
    plaetze: z.preprocess(leerZuUndefined, z.coerce.number().int().positive().optional().nullable()),
    anmeldeschluss: z.preprocess(leerZuUndefined, z.coerce.date().optional().nullable()),
  }),
});

// Mitgliederbereich: Dokumente (Dateien liegen in src/mitglieder/dateien, nicht öffentlich)
export const MITGLIEDER_KATEGORIEN = ['Flugbetrieb', 'Verein', 'Protokolle', 'Formulare', 'Sonstiges'] as const;
const mitgliederDokumente = defineCollection({
  loader: glob({ pattern: '*.{yml,yaml}', base: './src/content/mitglieder-dokumente' }),
  schema: z.object({
    titel: z.string(),
    kategorie: z.string().default('Sonstiges'),
    beschreibung: z.preprocess(leerZuUndefined, z.string().optional().nullable()),
    datei: z.string(),
    stand: z.preprocess(leerZuUndefined, z.coerce.date().optional().nullable()),
    sichtbar: z.boolean().default(true),
  }),
});

export const collections = { beitraege, seiten, galerien, termine, mitgliederDokumente };
