import { defineCollection } from 'astro:content';
import { glob } from 'astro/loaders';
import { z } from 'astro/zod';

// Bilder liegen direkt neben dem jeweiligen Eintrag ("foto.jpg" -> "./foto.jpg")
const neben = (v: unknown) => (typeof v === 'string' && v && !/^(\.{1,2}\/|\/|https?:)/.test(v) ? './' + v : v);
const ordnerId = ({ entry }: { entry: string }) => entry.split('/')[0];

export const KATEGORIEN = ['Aktuelles', 'Veranstaltungen', 'Verein', 'Baubericht', 'Kruschelkiste', 'Bembel Crawler'] as const;

const beitraege = defineCollection({
  loader: glob({ pattern: '*/index.md', base: './src/content/beitraege', generateId: ordnerId }),
  schema: ({ image }) =>
    z.object({
      titel: z.string(),
      datum: z.coerce.date(),
      kategorien: z.array(z.string()).default(['Aktuelles']),
      titelbild: z.preprocess(neben, image()).optional(),
      kurztext: z.string().optional(),
      bilder: z.array(z.preprocess(neben, image())).default([]),
      entwurf: z.boolean().default(false),
    }),
});

const seiten = defineCollection({
  loader: glob({ pattern: '*/index.md', base: './src/content/seiten', generateId: ordnerId }),
  schema: ({ image }) =>
    z.object({
      titel: z.string(),
      untertitel: z.string().optional(),
      bilder: z.array(z.preprocess(neben, image())).default([]),
    }),
});

const galerien = defineCollection({
  loader: glob({ pattern: '*/index.md', base: './src/content/galerien', generateId: ordnerId }),
  schema: ({ image }) =>
    z.object({
      titel: z.string(),
      jahr: z.coerce.number(),
      datum: z.coerce.date().optional(),
      bilder: z.array(z.preprocess(neben, image())).default([]),
    }),
});

const termine = defineCollection({
  loader: glob({ pattern: '*.{yml,yaml}', base: './src/content/termine' }),
  schema: z.object({
    titel: z.string(),
    datum: z.coerce.date(),
    ende: z.coerce.date().optional().nullable(),
    uhrzeit: z.string().optional().nullable(),
    ort: z.string().optional().nullable(),
    beschreibung: z.string().optional().nullable(),
    link: z.string().optional().nullable(),
  }),
});

export const collections = { beitraege, seiten, galerien, termine };
