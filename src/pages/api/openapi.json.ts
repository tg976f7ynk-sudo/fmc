// OpenAPI-Beschreibung der Such-Schnittstelle (z. B. für eigene GPTs oder andere KI-Werkzeuge)
import type { APIRoute } from 'astro';

export const GET: APIRoute = ({ site }) =>
  Response.json({
    openapi: '3.1.0',
    info: {
      title: 'FMC Dietzenbach – Suche',
      version: '1.0.0',
      description: 'Volltextsuche über Beiträge, Seiten, Bildergalerien und Termine des Flug- und Modellbau Club Dietzenbach e.V. Nur lesend, ohne Anmeldung. Bitte bei Verwendung die Quelle mit Link angeben.',
    },
    servers: [{ url: new URL('/', site).href.replace(/\/$/, '') }],
    paths: {
      '/api/suche': {
        get: {
          operationId: 'suche',
          summary: 'Inhalte der Vereinsseite durchsuchen',
          parameters: [
            { name: 'q', in: 'query', required: true, schema: { type: 'string', maxLength: 200 }, description: 'Suchbegriffe, z. B. „Wasserflugtreffen“' },
            { name: 'art', in: 'query', required: false, schema: { type: 'string', enum: ['Beitrag', 'Seite', 'Galerie', 'Termin'] }, description: 'Nur diese Art von Inhalt' },
            { name: 'anzahl', in: 'query', required: false, schema: { type: 'integer', minimum: 1, maximum: 50, default: 10 } },
          ],
          responses: {
            '200': {
              description: 'Treffer, nach Relevanz sortiert',
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: {
                      anfrage: { type: 'string' },
                      anzahl: { type: 'integer' },
                      treffer: {
                        type: 'array',
                        items: {
                          type: 'object',
                          properties: {
                            titel: { type: 'string' },
                            url: { type: 'string', format: 'uri' },
                            art: { type: 'string', enum: ['Beitrag', 'Seite', 'Galerie', 'Termin'] },
                            datum: { type: ['string', 'null'], format: 'date' },
                            kategorien: { type: 'array', items: { type: 'string' } },
                            auszug: { type: 'string' },
                            relevanz: { type: 'number' },
                          },
                        },
                      },
                    },
                  },
                },
              },
            },
            '429': { description: 'Zu viele Anfragen' },
          },
        },
      },
    },
  });
