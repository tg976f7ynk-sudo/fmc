// Zugriffsprüfung für die Redaktion: gültige GitHub-Anmeldung mit Schreibrecht auf das Repository.
import technik from '../site.config.mjs';

const geprueft = new Map(); // Prüfergebnis je Anmeldung, 10 Minuten zwischengespeichert
export async function istRedaktion(request) {
  const token = (request.headers.get('authorization') || '').replace(/^Bearer\s+/i, '');
  if (!token || token.length > 400) return false;
  const schluessel = Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(token))))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
  const treffer = geprueft.get(schluessel);
  if (treffer && treffer.bis > Date.now()) return treffer.ok;
  const antwort = await fetch(`https://api.github.com/repos/${technik.repo}`, {
    headers: { authorization: `Bearer ${token}`, accept: 'application/vnd.github+json', 'user-agent': 'fmc-dietzenbach-website' },
  });
  const daten = antwort.ok ? await antwort.json() : {};
  const ok = !!(daten.permissions && (daten.permissions.push || daten.permissions.maintain || daten.permissions.admin));
  geprueft.set(schluessel, { ok, bis: Date.now() + 10 * 60 * 1000 });
  return ok;
}
