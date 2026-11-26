# Webseite des Flug- und Modellbau Club Dietzenbach e.V.

Neuaufbau von fmc-dietzenbach.org als schnelle, wartungsarme Seite ohne WordPress,
PHP und Datenbank. Alle Inhalte liegen als Textdateien und Bilder in diesem Repository;
die Redaktion pflegt sie über eine Eingabemaske im Browser.

- **Für Redakteure:** [ANLEITUNG-REDAKTION.md](ANLEITUNG-REDAKTION.md)
- **Technik:** [Astro](https://astro.build) (erzeugt fertige HTML-Seiten),
  [Sveltia CMS](https://sveltiacms.app) (Eingabemaske unter `/admin/`),
  Cloudflare Pages (Hosting, kleine Serverfunktionen)

## Was die Seite kann

| Bereich | Umsetzung |
| --- | --- |
| Beiträge mit Kategorien, Titelbild, Bildern, Galerie, Videos | `src/content/beitraege/` |
| Feste Seiten (Über uns, Gastpiloten, Impressum …) | `src/content/seiten/` |
| Bildergalerien nach Jahren mit Großansicht | `src/content/galerien/` |
| Termine (vergangene werden automatisch ausgeblendet) | `src/content/termine/` |
| Downloads, Menü, allgemeine Angaben | `src/data/` |
| Kontaktformular mit Mailversand über das Vereinspostfach | `functions/api/kontakt.js` |
| Wetter und Wind am Flugplatz (Open-Meteo) | `functions/api/wetter.js` |
| Anmeldung der Redaktion über GitHub | `functions/api/auth.js`, `callback.js` |
| Weiterleitung aller alten WordPress-Adressen | `public/_redirects` |

Datenschutz: keine Cookies, keine Schriften oder Skripte von fremden Servern.
YouTube-Videos und die Karte werden erst nach einem Klick geladen; die Wetterdaten
ruft der eigene Server ab.

## Einmalige Einrichtung

### 1. Repository

In `site.config.mjs` stehen der Name dieses Repositorys und die Adresse der Seite.
Bei einem Umzug beides dort anpassen.

### 2. Cloudflare Pages

Neues Pages-Projekt anlegen und mit diesem Repository verbinden:

| Einstellung | Wert |
| --- | --- |
| Build-Befehl | `npm run build` |
| Ausgabeverzeichnis | `dist` |
| Umgebungsvariable | `NODE_VERSION` = `22` |

Der erste Bau dauert einige Minuten (rund 1.400 Bilder werden verarbeitet),
spätere Änderungen sind in ein bis zwei Minuten online.

### 3. Anmeldung der Redaktion (GitHub)

1. Auf GitHub unter *Settings → Developer settings → OAuth Apps* eine neue App anlegen.
   *Homepage URL:* Adresse der Seite, *Authorization callback URL:* `https://ADRESSE/api/callback`.
2. In Cloudflare Pages unter *Einstellungen → Variablen und Secrets* eintragen:
   `GITHUB_CLIENT_ID` und `GITHUB_CLIENT_SECRET` (als Secret).
3. Jede Redakteurin und jeder Redakteur braucht ein GitHub-Konto mit Schreibrecht
   auf dieses Repository (*Settings → Collaborators*).

### 4. Kontaktformular (Mailversand)

In Cloudflare Pages als Variablen bzw. Secrets eintragen:

| Name | Beispiel |
| --- | --- |
| `SMTP_HOST` | `smtp.strato.de` |
| `SMTP_PORT` | `465` |
| `SMTP_USER` | Adresse des Postfachs |
| `SMTP_PASS` | Passwort des Postfachs (**Secret**) |
| `MAIL_AN` | Empfänger der Anfragen (freiwillig, sonst `SMTP_USER`) |

Ohne diese Angaben zeigt das Formular einen Hinweis und verweist auf die E-Mail-Adresse.

### 5. Domain umstellen

Im Pages-Projekt unter *Benutzerdefinierte Domains* die Domain hinzufügen und die
angezeigten DNS-Einträge beim Domain-Anbieter setzen. Erst danach ist die neue Seite
unter der gewohnten Adresse erreichbar; bis dahin läuft sie unter `*.pages.dev`.

## Lokal arbeiten

```bash
npm install
npm run dev        # Entwicklung unter http://localhost:4321
npm run build      # fertige Seite nach dist/
npm run vorschau   # dist/ mit Serverfunktionen ansehen (Wrangler)
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
functions/api/    Serverfunktionen (Cloudflare Pages Functions)
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
