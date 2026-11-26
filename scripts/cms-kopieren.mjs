// Kopiert das Redaktionssystem (Sveltia CMS) aus node_modules nach public/admin,
// damit es von unserer eigenen Adresse geladen wird (kein fremder Server nötig).
import { cp, mkdir, rm } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const wurzel = join(dirname(fileURLToPath(import.meta.url)), '..');
const quelle = join(wurzel, 'node_modules', '@sveltia', 'cms', 'dist');
const ziel = join(wurzel, 'public', 'admin');
const ohneKarten = (pfad) => !pfad.endsWith('.map');

await mkdir(ziel, { recursive: true });
await rm(join(ziel, 'chunks'), { recursive: true, force: true });
await cp(join(quelle, 'sveltia-cms.js'), join(ziel, 'sveltia-cms.js'));
await cp(join(quelle, 'chunks'), join(ziel, 'chunks'), { recursive: true, filter: ohneKarten });
console.log('Redaktionssystem nach public/admin kopiert.');
