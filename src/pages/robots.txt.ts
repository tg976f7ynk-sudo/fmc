import type { APIRoute } from 'astro';

export const GET: APIRoute = ({ site }) =>
  new Response(`User-agent: *\nAllow: /api/suche\nAllow: /api/openapi.json\nAllow: /mcp\nDisallow: /admin/\nDisallow: /api/\nDisallow: /mitglieder/\n\n# Übersicht für Sprachmodelle: ${new URL('llms.txt', site).href}\nSitemap: ${new URL('sitemap-index.xml', site).href}\n`, {
    headers: { 'content-type': 'text/plain; charset=utf-8' },
  });
