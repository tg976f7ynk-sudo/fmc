// Nach dem Bau: Mitgliederdokumente nur dann veröffentlichen, wenn der Mitgliederbereich
// freigeschaltet ist (site.config.mjs → mitgliederbereich: true) und damit hinter dem Zugangsschutz liegt.
import { cp, rm, readdir } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import technik from '../site.config.mjs';

const wurzel = join(dirname(fileURLToPath(import.meta.url)), '..');
const quelle = join(wurzel, 'src', 'mitglieder', 'dateien');
const ziel = join(wurzel, 'dist', 'mitglieder', 'dateien');

await rm(ziel, { recursive: true, force: true });
if (technik.mitgliederbereich) {
  await cp(quelle, ziel, { recursive: true, filter: (p) => !p.endsWith('.gitkeep') });
  console.log(`Mitgliederbereich: ${(await readdir(quelle)).filter((f) => f !== '.gitkeep').length} Dokumente veröffentlicht.`);
} else {
  console.log('Mitgliederbereich ist noch nicht freigeschaltet – keine Mitgliederdokumente veröffentlicht.');
}
