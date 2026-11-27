// MCP-Zugang (Model Context Protocol, „Streamable HTTP“, ohne Sitzung) unter /mcp.
// KI-Assistenten können damit die Vereinsseite durchsuchen, Inhalte lesen und Termine abrufen.
import { ladeIndex, suche } from './suchmaschine.js';
import { CORS } from './suche.js';

const VERSIONEN = ['2025-06-18', '2025-03-26', '2024-11-05'];
const WERKZEUGE = [
  {
    name: 'suche',
    title: 'Vereinsseite durchsuchen',
    description: 'Volltextsuche über alle Inhalte der Webseite des Flug- und Modellbau Club Dietzenbach e.V. (Modellflugverein in Dietzenbach, Hessen): Beiträge, Seiten, Bildergalerien und Termine. Liefert Titel, Adresse, Art, Datum und einen Textauszug.',
    inputSchema: {
      type: 'object',
      properties: {
        anfrage: { type: 'string', description: 'Suchbegriffe, z. B. „Wasserflugtreffen 2026“ oder „Gastpiloten Versicherung“' },
        art: { type: 'string', enum: ['Beitrag', 'Seite', 'Galerie', 'Termin'], description: 'Optional: nur diese Art von Inhalt' },
        anzahl: { type: 'integer', minimum: 1, maximum: 50, description: 'Höchstzahl der Treffer (Standard 10)' },
      },
      required: ['anfrage'],
    },
    annotations: { readOnlyHint: true, openWorldHint: false },
  },
  {
    name: 'inhalt_lesen',
    title: 'Inhalt vollständig lesen',
    description: 'Gibt den vollständigen Text eines Beitrags, einer Seite oder Galerie zurück. Als Adresse die „url“ aus einem Suchtreffer verwenden (z. B. /gastpiloten/ oder die volle Adresse).',
    inputSchema: { type: 'object', properties: { url: { type: 'string', description: 'Adresse des Inhalts' } }, required: ['url'] },
    annotations: { readOnlyHint: true, openWorldHint: false },
  },
  {
    name: 'termine',
    title: 'Kommende Termine',
    description: 'Listet die kommenden Veranstaltungen und Treffen des Vereins (Datum, Uhrzeit, Ort, Beschreibung).',
    inputSchema: { type: 'object', properties: { anzahl: { type: 'integer', minimum: 1, maximum: 50, description: 'Höchstzahl (Standard 10)' } } },
    annotations: { readOnlyHint: true, openWorldHint: false },
  },
];

const antwort = (id, result) => ({ jsonrpc: '2.0', id, result });
const fehler = (id, code, message) => ({ jsonrpc: '2.0', id, error: { code, message } });
const text = (wert) => ({ content: [{ type: 'text', text: JSON.stringify(wert, null, 2) }], structuredContent: wert });

async function bearbeite(nachricht, env, request) {
  const { id, method, params = {} } = nachricht || {};
  if (id === undefined || id === null) return null; // Benachrichtigung: keine Antwort
  const basis = new URL(request.url).origin;
  switch (method) {
    case 'initialize': {
      const gewuenscht = params.protocolVersion;
      return antwort(id, {
        protocolVersion: VERSIONEN.includes(gewuenscht) ? gewuenscht : VERSIONEN[0],
        capabilities: { tools: { listChanged: false } },
        serverInfo: { name: 'fmc-dietzenbach', title: 'FMC Dietzenbach – Vereinsseite', version: '1.0.0' },
        instructions: 'Inhalte der Webseite des Flug- und Modellbau Club Dietzenbach e.V. Mit „suche“ finden, mit „inhalt_lesen“ vollständig lesen, mit „termine“ kommende Veranstaltungen abrufen. Bitte bei Verwendung die Quelle mit Link angeben.',
      });
    }
    case 'ping':
      return antwort(id, {});
    case 'tools/list':
      return antwort(id, { tools: WERKZEUGE });
    case 'tools/call': {
      const docs = await ladeIndex(env, request);
      const args = params.arguments || {};
      if (params.name === 'suche') {
        if (!args.anfrage) return antwort(id, { content: [{ type: 'text', text: 'Bitte eine Suchanfrage angeben.' }], isError: true });
        const treffer = suche(docs, String(args.anfrage).slice(0, 200), { art: args.art || '', anzahl: args.anzahl || 10 }).map((t) => ({ ...t, url: basis + t.url }));
        return antwort(id, text({ anfrage: args.anfrage, treffer }));
      }
      if (params.name === 'inhalt_lesen') {
        let pfad = String(args.url || '');
        try { pfad = new URL(pfad, basis).pathname; } catch { /* Pfad wie angegeben */ }
        if (!pfad.endsWith('/')) pfad += '/';
        const dok = docs.find((d) => d.url === pfad && d.art !== 'Termin') || docs.find((d) => d.url === pfad);
        if (!dok) return antwort(id, { content: [{ type: 'text', text: `Kein Inhalt unter ${pfad} gefunden. Bitte zuerst mit „suche“ eine gültige Adresse ermitteln.` }], isError: true });
        return antwort(id, text({ titel: dok.titel, url: basis + dok.url, art: dok.art, datum: dok.datum ?? null, kategorien: dok.kategorien ?? [], text: dok.text }));
      }
      if (params.name === 'termine') {
        const heute = new Intl.DateTimeFormat('sv-SE', { timeZone: 'Europe/Berlin' }).format(new Date());
        const liste = docs
          .filter((d) => d.art === 'Termin' && (d.datum ?? '') >= heute)
          .sort((a, b) => a.datum.localeCompare(b.datum))
          .slice(0, Math.min(50, args.anzahl || 10))
          .map((d) => ({ titel: d.titel, datum: d.datum, details: d.auszug, url: basis + d.url }));
        return antwort(id, text({ stand: heute, termine: liste }));
      }
      return fehler(id, -32602, `Unbekanntes Werkzeug: ${params.name}`);
    }
    default:
      return fehler(id, -32601, `Methode nicht unterstützt: ${method}`);
  }
}

export async function onRequestPost({ request, env }) {
  if (env.SUCHE_LIMIT) {
    const { success } = await env.SUCHE_LIMIT.limit({ key: request.headers.get('cf-connecting-ip') || 'unbekannt' });
    if (!success) return Response.json(fehler(null, -32000, 'Zu viele Anfragen. Bitte kurz warten.'), { status: 429, headers: CORS });
  }
  let eingang;
  try {
    eingang = await request.json();
  } catch {
    return Response.json(fehler(null, -32700, 'Ungültiges JSON'), { status: 400, headers: CORS });
  }
  const liste = Array.isArray(eingang) ? eingang : [eingang];
  const antworten = (await Promise.all(liste.map((n) => bearbeite(n, env, request)))).filter(Boolean);
  if (!antworten.length) return new Response(null, { status: 202, headers: CORS });
  return Response.json(Array.isArray(eingang) ? antworten : antworten[0], { headers: { ...CORS, 'cache-control': 'no-store' } });
}
// Kein Server-Sent-Events-Kanal: GET ist laut Protokoll mit 405 zu beantworten
export const onRequestGet = () =>
  new Response('MCP-Zugang des FMC Dietzenbach. Bitte per POST (JSON-RPC) ansprechen, z. B. mit einem MCP-fähigen KI-Assistenten.', { status: 405, headers: { ...CORS, allow: 'POST, OPTIONS', 'content-type': 'text/plain; charset=utf-8' } });
export const onRequestOptions = () => new Response(null, { status: 204, headers: CORS });
