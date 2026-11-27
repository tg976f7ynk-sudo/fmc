# Webseite des Flug- und Modellbau Club Dietzenbach e.V.

Neuaufbau von fmc-dietzenbach.org als schnelle, wartungsarme Seite ohne WordPress,
PHP und Datenbank. Alle Inhalte liegen als Textdateien und Bilder in diesem Repository;
die Redaktion pflegt sie über eine Eingabemaske im Browser.

- **Für Redakteure:** [ANLEITUNG-REDAKTION.md](ANLEITUNG-REDAKTION.md)
- **Technik:** [Astro](https://astro.build) (erzeugt fertige HTML-Seiten),
  [Sveltia CMS](https://sveltiacms.app) (Eingabemaske unter `/admin/`),
  Cloudflare Workers (Hosting der fertigen Seiten und kleine Serverfunktionen)

## Was die Seite kann

| Bereich | Umsetzung |
| --- | --- |
| Beiträge mit Kategorien, Titelbild, Bildern, Galerie, Videos | `src/content/beitraege/` |
| Feste Seiten (Über uns, Gastpiloten, Impressum …) | `src/content/seiten/` |
| Bildergalerien nach Jahren mit Großansicht | `src/content/galerien/` |
| Termine (vergangene werden automatisch ausgeblendet) | `src/content/termine/` |
| Downloads, Menü, allgemeine Angaben | `src/data/` |
| Kontaktformular mit Mailversand über das Vereinspostfach | `worker/kontakt.js` |
| Wetter und Wind am Flugplatz (Open-Meteo) | `worker/wetter.js` |
| Anmeldung der Redaktion über GitHub | `worker/auth.js`, `callback.js` |
| Weiterleitung aller alten WordPress-Adressen | `public/_redirects` |
| Anonyme Zählung der Seitenaufrufe, Statistik für die Redaktion (`/admin/statistik/`) | `worker/zaehler.js`, `worker/statistik.js`, D1-Datenbank `fmc-statistik` |

Datenschutz: keine Cookies, keine Schriften oder Skripte von fremden Servern.
YouTube-Videos und die Karte werden erst nach einem Klick geladen; die Wetterdaten
ruft der eigene Server ab.

## Einmalige Einrichtung

### 1. Repository

In `site.config.mjs` stehen der Name dieses Repositorys und die Adresse der Seite.
Bei einem Umzug beides dort anpassen.

### 2. Cloudflare Worker

Die Seite läuft als Cloudflare Worker mit dem Namen `fmc` (siehe `wrangler.jsonc`), der mit
diesem Repository verbunden ist. Bei jeder Änderung auf dem Zweig `main` baut Cloudflare die
Seite neu (`npm run build`) und veröffentlicht sie (`npx wrangler deploy`). Das dauert ein
bis zwei Minuten.

Vorläufige Adresse: https://fmc.sehnen-randvoll1q.workers.dev

Wird der Worker umbenannt oder in ein anderes Cloudflare-Konto übertragen, den Namen in
`wrangler.jsonc` und die Adresse in `site.config.mjs` anpassen.

### 3. Anmeldung der Redaktion (GitHub)

1. Auf GitHub unter *Settings → Developer settings → OAuth Apps* eine neue App anlegen.
   *Homepage URL:* Adresse der Seite, *Authorization callback URL:* `https://ADRESSE/api/callback`.
2. Im Cloudflare-Dashboard beim Worker `fmc` unter *Einstellungen → Variablen und Secrets*
   eintragen: `GITHUB_CLIENT_ID` und `GITHUB_CLIENT_SECRET` (als Secret).
3. Jede Redakteurin und jeder Redakteur braucht ein GitHub-Konto mit Schreibrecht
   auf dieses Repository (*Settings → Collaborators*).

### 4. Kontaktformular (Mailversand)

Beim Worker unter *Einstellungen → Variablen und Secrets* eintragen:

| Name | Beispiel |
| --- | --- |
| `SMTP_HOST` | `smtp.ionos.de` (die Domain und ihre Postfächer liegen bei IONOS) |
| `SMTP_PORT` | `465` |
| `SMTP_USER` | Adresse des Postfachs |
| `SMTP_PASS` | Passwort des Postfachs (**Secret**) |
| `MAIL_AN` | Empfänger der Anfragen (freiwillig, sonst `SMTP_USER`) |

Ohne diese Angaben zeigt das Formular einen Hinweis und verweist auf die E-Mail-Adresse.

Am besten ein eigenes Postfach nur für das Formular anlegen, nicht das Postfach des Vorstands.

**Sicherheitsprüfung (Captcha) einschalten:** Im Cloudflare-Dashboard unter *Turnstile* ein
Widget anlegen (Modus „Managed“, als Hostnamen die Adresse der Seite eintragen) und beim
Worker zwei weitere Einträge anlegen: `TURNSTILE_SITEKEY` (Site Key) und `TURNSTILE_SECRET`
(Secret Key, als **Secret**). Sobald beide vorhanden sind, verlangt das Formular die Prüfung;
für Besucher ist sie in der Regel unsichtbar.

### 5. Domain umstellen

1. In `site.config.mjs` die Adresse auf `https://fmc-dietzenbach.org` ändern.
2. Beim Worker unter *Einstellungen → Domains & Routen* die Domain hinzufügen. Dafür muss
   die Domain über Cloudflare verwaltet werden: Nameserver bei IONOS auf Cloudflare umstellen
   und vorher alle Mail-Einträge (MX, SPF, DMARC) in Cloudflare übernehmen, sonst kommen
   keine E-Mails mehr an.
3. In der GitHub-OAuth-App die beiden Adressen aus Schritt 3 auf die neue Domain ändern.
4. Im Turnstile-Widget die neue Domain als Hostnamen ergänzen.
5. In `wrangler.jsonc` `"workers_dev": false` setzen, damit die vorläufige Adresse abgeschaltet wird.

## Statistik

Jeder Seitenaufruf im Browser zählt einen Eintrag in der D1-Datenbank `fmc-statistik`
(Tabelle `aufrufe`: Seite, Tag, Anzahl – keine IP-Adressen, keine Cookies). Programme und
Suchmaschinen werden nicht gezählt, ebenso nur Adressen, die es wirklich gibt.
Die Seite `/admin/statistik/` zeigt die Zahlen; sie ist nur mit der GitHub-Anmeldung der
Redaktion und Schreibrecht auf dieses Repository abrufbar.

Die Tabelle wurde einmalig angelegt mit:

```sql
CREATE TABLE aufrufe (pfad TEXT NOT NULL, tag TEXT NOT NULL, anzahl INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (pfad, tag)) WITHOUT ROWID;
CREATE INDEX aufrufe_tag ON aufrufe(tag);
```

## Sicherheit

| Maßnahme | Wo |
| --- | --- |
| Content-Security-Policy, HSTS und weitere Schutz-Header für alle Seiten | `public/_headers` |
| Schutz-Header für die Serverfunktionen | `worker/index.js` |
| Kontaktformular: verstecktes Feld, Mindestzeit, höchstens 3 Nachrichten pro Minute je Besucher, optional Turnstile | `worker/kontakt.js`, `wrangler.jsonc` |
| Monatliche Prüfung auf veraltete Bausteine (Dependabot) | `.github/dependabot.yml` |

Das Redaktionssystem unter `/admin/` ist von der Content-Security-Policy ausgenommen, weil es
direkt mit GitHub spricht. Geschützt ist es über die GitHub-Anmeldung: Schreiben kann nur, wer
Schreibrecht auf dieses Repository hat.

Wer neue fremde Dienste einbindet (z. B. einen anderen Videoanbieter), muss dessen Adresse in
der Content-Security-Policy in `public/_headers` ergänzen, sonst blockiert der Browser sie.

Noch offen und nicht im Repository lösbar: Zwei-Faktor-Anmeldung für GitHub, Cloudflare und
IONOS, ein eigenes GitHub-Konto für die Redaktion, Abschalten der alten WordPress-Seite nach
dem Umzug und die Sicherheitshinweise von GitHub (*Settings → Advanced Security →
Dependabot alerts* einschalten).

## Lokal arbeiten

```bash
npm install
npm run dev        # Entwicklung unter http://localhost:4321
npm run build      # fertige Seite nach dist/
npm run vorschau   # dist/ mit Serverfunktionen ansehen (Wrangler, http://localhost:8787)
```

Für die Serverfunktionen lokal eine Datei `.dev.vars` mit den Variablen aus Schritt 3
und 4 anlegen (wird nicht ins Repository übernommen).

## Aufbau

```
src/content/      Inhalte (Markdown + Bilder, je Eintrag ein Ordner)
src/data/         Einstellungen, Menü, Downloads (JSON)
src/pages/        Seitenvorlagen
src/components/   Bausteine (Galerie, Termine, Wetter, Formular, Karte)
src/layouts/      Grundgerüst mit Kopf, Menü, Fuß
src/styles/       Gestaltung (Farben aus dem Vereinslogo)
src/lib/          Hilfsfunktionen, Markdown-Erweiterungen
worker/           Serverfunktionen (Cloudflare Worker)
public/           unveränderte Dateien: Downloads, Symbole, Weiterleitungen
werkzeuge/        einmalige Übernahme der Inhalte aus WordPress (nur zur Dokumentation)
```

## Übernahme aus WordPress (November 2026)

Übernommen wurden 32 Beiträge, 11 Seiten, 17 Bildergalerien mit 1.248 Bildern,
die Downloads und die Termine 2026. Nicht übernommen werden konnten:

- **Flugleiter** und **Flugplatzordnung / Meldekarte** – diese Seiten waren nur für
  angemeldete Mitglieder sichtbar. Die neue Seite hat (noch) keinen Mitgliederbereich.
- Zwei Bilder im Beitrag „Das erste Modell, fast vollständig aus dem 3D Drucker …“ und die
  Datei „Hinweis zu Witterungsverhältnissen“ – sie fehlten bereits auf dem alten Server.
- Die leeren Seiten *Wetter*, *Einsatzplanung*, *Galerie* und *Bembel Crawlers*
  (die Wetterseite wurde neu gebaut).
- Der veraltete Veranstaltungskalender (Einträge von 2019 und 2023) und der
  Google-Kalender (letzter Eintrag 2018). Termine werden jetzt direkt gepflegt.
