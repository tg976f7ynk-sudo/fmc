// Zentrale Einstellungen für Technik und Redaktionssystem.
export default {
  // Öffentliche Adresse der Seite (ohne Schrägstrich am Ende).
  // Vorläufig die Cloudflare-Adresse; nach dem Umzug der Domain: 'https://fmc-dietzenbach.org'
  url: 'https://fmc.sehnen-randvoll1q.workers.dev',
  // GitHub-Repository, in dem die Inhalte liegen (BESITZER/NAME)
  repo: 'tg976f7ynk-sudo/fmc',
  branch: 'main',
  // Mitgliederbereich: erst einschalten, wenn der Zugangsschutz (z. B. Cloudflare Access für
  // /mitglieder/*) eingerichtet ist. Solange false, werden keine Mitgliederdokumente veröffentlicht.
  mitgliederbereich: false,
};
