// Gleicht die Mitgliederliste (src/data/mitglieder.json, gepflegt im Redaktionssystem)
// mit einer Cloudflare-Access-Gruppe ab. Erst nach dem Domain-Umzug und der Einrichtung
// von Cloudflare Access verwenden (siehe README, Abschnitt Mitgliederbereich).
//
//   CLOUDFLARE_ACCOUNT_ID=…  CLOUDFLARE_API_TOKEN=…  ACCESS_GROUP_ID=…  node scripts/access-mitglieder-abgleich.mjs [--ausfuehren]
//
// Ohne --ausfuehren wird nur angezeigt, was sich ändern würde.
import { readFile } from 'node:fs/promises';

const { CLOUDFLARE_ACCOUNT_ID: konto, CLOUDFLARE_API_TOKEN: schluessel, ACCESS_GROUP_ID: gruppe } = process.env;
const ausfuehren = process.argv.includes('--ausfuehren');
if (!konto || !schluessel || !gruppe) {
  console.error('Bitte CLOUDFLARE_ACCOUNT_ID, CLOUDFLARE_API_TOKEN und ACCESS_GROUP_ID setzen.');
  process.exit(1);
}

const { mitglieder = [] } = JSON.parse(await readFile(new URL('../src/data/mitglieder.json', import.meta.url), 'utf8'));
const soll = [...new Set(mitglieder.filter((m) => m.aktiv !== false && m.email).map((m) => m.email.trim().toLowerCase()))].sort();

const api = `https://api.cloudflare.com/client/v4/accounts/${konto}/access/groups/${gruppe}`;
const kopf = { authorization: `Bearer ${schluessel}`, 'content-type': 'application/json' };
const aktuell = await (await fetch(api, { headers: kopf })).json();
if (!aktuell.success) throw new Error(JSON.stringify(aktuell.errors));
const ist = (aktuell.result.include || []).map((r) => r.email?.email).filter(Boolean).map((e) => e.toLowerCase()).sort();

const neu = soll.filter((e) => !ist.includes(e));
const weg = ist.filter((e) => !soll.includes(e));
console.log(`Mitglieder mit Zugang: ${soll.length} · neu: ${neu.length} · entfernen: ${weg.length}`);
neu.forEach((e) => console.log('  + ' + e));
weg.forEach((e) => console.log('  - ' + e));
if (!ausfuehren) { console.log('Nur Vorschau. Mit --ausfuehren übernehmen.'); process.exit(0); }
if (!soll.length) { console.error('Die Liste ist leer – zur Sicherheit wird nichts übernommen.'); process.exit(1); }

const antwort = await (await fetch(api, {
  method: 'PUT',
  headers: kopf,
  body: JSON.stringify({ name: aktuell.result.name, include: soll.map((email) => ({ email: { email } })), exclude: aktuell.result.exclude || [], require: aktuell.result.require || [] }),
})).json();
if (!antwort.success) throw new Error(JSON.stringify(antwort.errors));
console.log('Übernommen.');
