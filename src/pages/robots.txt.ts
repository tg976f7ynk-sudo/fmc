import type { APIRoute } from 'astro';

export const GET: APIRoute = ({ site }) =>
  new Response(`User-agent: *\nDisallow: /\n`, {
    headers: { 'content-type': 'text/plain; charset=utf-8' },
  });
