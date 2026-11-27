-- Tabelle der D1-Datenbank „fmc-anmeldungen“ (Binding ANMELDUNGEN).
-- Einmalig anlegen: npx wrangler d1 execute fmc-anmeldungen --remote --file worker/anmeldungen.sql
CREATE TABLE IF NOT EXISTS anmeldungen (
  id TEXT PRIMARY KEY,
  termin TEXT NOT NULL,
  termin_datum TEXT NOT NULL,          -- letzter Tag der Veranstaltung, für das automatische Löschen
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  personen INTEGER NOT NULL DEFAULT 1,
  geraete INTEGER,                     -- mitgebrachte Fluggeräte (nur bei Terminen mit Grenze)
  rolle TEXT,
  anmerkung TEXT,
  status TEXT NOT NULL DEFAULT 'offen', -- offen (unbestätigt) | bestaetigt | abgemeldet
  token_hash TEXT NOT NULL,            -- nur der Hash des Schlüssels aus der Mail
  erstellt TEXT NOT NULL,
  bestaetigt TEXT,
  abgemeldet TEXT
);
CREATE INDEX IF NOT EXISTS anmeldungen_termin ON anmeldungen (termin, status);
CREATE UNIQUE INDEX IF NOT EXISTS anmeldungen_einmalig ON anmeldungen (termin, email) WHERE status IN ('offen', 'bestaetigt');
-- Nachträglich ergänzt (Dezember 2026), für bestehende Datenbanken:
-- ALTER TABLE anmeldungen ADD COLUMN geraete INTEGER;
