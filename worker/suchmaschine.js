// Volltextsuche über den Suchindex (/suchindex.json). Wird von /api/suche und /mcp genutzt.
// Deutsch-freundlich: Groß-/Kleinschreibung egal, ä = ae usw., Wortanfänge genügen („wasserflug“ findet „Wasserflugtreffen“).
const STOPP = new Set('der die das den dem des ein eine einen einem einer und oder in im am an auf aus bei mit von vom zu zum zur für fuer ist sind war wie was wer wo wann ich du wir ihr sie es nicht auch noch nur so als bis über ueber unter nach vor um'.split(' '));
export const normal = (s) =>
  String(s ?? '')
    .toLowerCase()
    .replace(/ä/g, 'ae').replace(/ö/g, 'oe').replace(/ü/g, 'ue').replace(/ß/g, 'ss')
    .normalize('NFKD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();

// Der Suchindex wird beim Bau der Seite erzeugt (dist/suchindex.json) und beim Veröffentlichen
// direkt in den Worker eingebunden. So wird er beim Start der Worker-Instanz eingelesen –
// nicht bei jeder Anfrage – und die CPU-Zeit pro Suche bleibt klein.
import daten from '../dist/suchindex.json';

// Vorbereitung einmal beim Start der Instanz
const index = daten.dokumente.map((d) => ({
  ...d,
  _titel: d.n?.t ?? ' ' + normal(d.titel) + ' ',
  _text: d.n?.x ?? ' ' + normal(d.text) + ' ',
  _kat: d.n?.k ?? ' ' + normal((d.kategorien || []).join(' ')) + ' ',
  n: undefined,
}));
export async function ladeIndex() {
  return index;
}

const zaehle = (heuhaufen, wort) => {
  let n = 0, i = heuhaufen.indexOf(' ' + wort);
  while (i !== -1 && n < 50) { n++; i = heuhaufen.indexOf(' ' + wort, i + 1); }
  return n;
};
// Treffer innerhalb zusammengesetzter Wörter („versicherung“ in „haftpflichtversicherung“), ab 5 Buchstaben
const zaehleInnen = (heuhaufen, wort) => {
  if (wort.length < 5) return 0;
  let n = 0, i = heuhaufen.indexOf(wort);
  while (i !== -1 && n < 50) { if (heuhaufen[i - 1] !== ' ') n++; i = heuhaufen.indexOf(wort, i + 1); }
  return n;
};
// Suchwort als regulärer Ausdruck für den Originaltext (ä ↔ ae usw.)
const muster = (wort) =>
  new RegExp(wort.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/ae/g, '(?:ae|ä)').replace(/oe/g, '(?:oe|ö)').replace(/ue/g, '(?:ue|ü)').replace(/ss/g, '(?:ss|ß)'), 'i');

function auszug(dok, woerter) {
  const text = dok.text.replace(/\s+/g, ' ');
  let pos = -1;
  for (const w of woerter) {
    const m = muster(w).exec(text);
    if (m && (pos === -1 || m.index < pos)) pos = m.index;
  }
  if (pos === -1) return dok.auszug;
  const start = Math.max(0, pos - 90);
  const ende = Math.min(text.length, pos + 160);
  let stueck = text.slice(start, ende);
  if (start > 0) stueck = stueck.replace(/^\S*\s/, ''); // nicht mitten im Wort beginnen …
  if (ende < text.length) stueck = stueck.replace(/\s\S*$/, ''); // … und nicht mitten im Wort enden
  return (start > 0 ? '… ' : '') + stueck + (ende < text.length ? ' …' : '');
}

export function suche(docs, anfrage, { art = '', anzahl = 10 } = {}) {
  const woerter = [...new Set(normal(anfrage).split(' ').filter((w) => w && (w.length > 1 || /\d/.test(w)) && !STOPP.has(w)))].slice(0, 8);
  if (!woerter.length) return [];
  const satz = normal(anfrage);
  const heute = new Date().toISOString().slice(0, 10);
  const treffer = [];
  for (const d of docs) {
    if (art && d.art.toLowerCase() !== art.toLowerCase()) continue;
    let punkte = 0, gefunden = 0;
    for (const w of woerter) {
      const t = zaehle(d._titel, w), k = zaehle(d._kat, w), x = zaehle(d._text, w);
      const ti = zaehleInnen(d._titel, w), xi = zaehleInnen(d._text, w);
      if (t + k + x + ti + xi > 0) gefunden++;
      // Titel zählt am meisten; ganze Wörter mehr als Wortanfänge, Wortteile am wenigsten
      const ganz = d._titel.includes(' ' + w + ' ') ? 4 : 0;
      punkte += t * 8 + ganz + k * 3 + Math.min(x, 10) + (x > 0 ? 2 : 0) + ti * 3 + Math.min(xi, 10) * 0.5 + (xi > 0 ? 1 : 0);
    }
    // ganze Wortgruppe wie eingegeben (z. B. „do x“) besonders gewichten
    if (satz.includes(' ')) {
      if (d._titel.includes(' ' + satz + ' ') || d._titel.includes(' ' + satz)) punkte += 20;
      else if (d._text.includes(' ' + satz + ' ')) punkte += 8;
    }
    if (!gefunden) continue;
    punkte *= (gefunden / woerter.length) ** 2;
    if (gefunden < woerter.length && woerter.length > 1) punkte *= 0.5;
    // Aktuelles leicht bevorzugen; kommende Termine besonders
    if (d.datum) {
      const alter = (Date.parse(heute) - Date.parse(d.datum)) / 864e5;
      punkte *= d.art === 'Termin' ? (alter <= 0 ? 1.3 : 0.6) : 1 + Math.max(0, 1 - alter / 1500) * 0.3;
    }
    treffer.push({ d, punkte });
  }
  treffer.sort((a, b) => b.punkte - a.punkte);
  return treffer.slice(0, Math.min(50, Math.max(1, anzahl))).map(({ d, punkte }) => ({
    titel: d.titel,
    url: d.url,
    art: d.art,
    datum: d.datum ?? null,
    kategorien: d.kategorien ?? [],
    auszug: auszug(d, woerter),
    relevanz: Math.round(punkte * 10) / 10,
  }));
}
