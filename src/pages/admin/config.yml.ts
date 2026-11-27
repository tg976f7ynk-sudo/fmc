// Einstellungen des Redaktionssystems (Sveltia CMS) – erzeugt /admin/config.yml.
// Hier wird festgelegt, welche Eingabefelder die Redaktion sieht.
import type { APIRoute } from 'astro';
import technik from '../../../site.config.mjs';
import { KATEGORIEN, MITGLIEDER_KATEGORIEN } from '../../content.config';

const neben = { media_folder: '', public_folder: '' }; // Bilder liegen direkt beim Eintrag
const datum = (name: string, label: string, extra = {}) => ({
  name, label, widget: 'datetime', format: 'YYYY-MM-DD', date_format: 'DD.MM.YYYY', time_format: false, ...extra,
});
const text = { name: 'body', label: 'Text', widget: 'markdown', required: false, buttons: ['bold', 'italic', 'link', 'heading-two', 'heading-three', 'bulleted-list', 'numbered-list', 'quote'], editor_components: ['image'], hint: 'Bilder über das Bild-Symbol einfügen und im Feld „Alternativtext“ kurz beschreiben, was zu sehen ist. Mehrere Bilder direkt hintereinander werden automatisch als Bilderreihe dargestellt. Ein YouTube-Link in einer eigenen Zeile wird zum Video.' };
const galerie = (hint: string) => ({ name: 'bilder', label: 'Bildergalerie', widget: 'image', multiple: true, required: false, hint });

const config = {
  backend: {
    name: 'github',
    repo: technik.repo,
    branch: technik.branch,
    base_url: technik.url,
    auth_endpoint: 'api/auth',
    commit_messages: {
      create: '{{collection}}: „{{slug}}“ angelegt',
      update: '{{collection}}: „{{slug}}“ geändert',
      delete: '{{collection}}: „{{slug}}“ gelöscht',
      uploadMedia: 'Datei hochgeladen: {{path}}',
      deleteMedia: 'Datei gelöscht: {{path}}',
    },
  },
  site_url: technik.url,
  display_url: technik.url,
  app_title: 'FMCD Redaktion',
  logo: { src: '/apple-touch-icon.png' },
  logout_redirect_url: '/',
  media_folder: 'public/dateien',
  public_folder: '/dateien',
  slug: { encoding: 'ascii', clean_accents: true, maxlength: 60 },
  // Fotos werden beim Hochladen automatisch verkleinert (max. 2000 px) und platzsparend gespeichert
  media_libraries: {
    default: { config: { slugify_filename: true, max_file_size: 24_000_000, transformations: { raster_image: { format: 'webp', quality: 82, width: 2000, height: 2000 } } } },
  },
  collections: [
    {
      name: 'beitraege',
      label: 'Beiträge',
      label_singular: 'Beitrag',
      description: 'Neuigkeiten, Berichte und Ankündigungen. Erscheinen unter „Aktuelles“ und auf der Startseite.',
      icon: 'newspaper',
      folder: 'src/content/beitraege',
      path: '{{slug}}/index',
      slug: '{{year}}-{{month}}-{{day}}-{{slug}}',
      create: true,
      identifier_field: 'titel',
      thumbnail: 'titelbild',
      summary: "{{titel}} · {{datum | date('DD.MM.YYYY')}}{{entwurf | ternary(' · ENTWURF', '')}}",
      // „Auf Website ansehen“ im Editor (Weiterleitung auf die Adresse ohne Datum)
      preview_path: 'aktuelles/{{slug}}',
      sortable_fields: { fields: ['datum', 'titel'], default: { field: 'datum', direction: 'descending' } },
      view_groups: [{ label: 'Jahr', field: 'datum', pattern: '\\d{4}' }],
      view_filters: [{ label: 'Entwürfe', field: 'entwurf', pattern: true }, ...KATEGORIEN.map((k) => ({ label: k, field: 'kategorien', pattern: k }))],
      ...neben,
      fields: [
        { name: 'titel', label: 'Überschrift', widget: 'string', hint: 'Kurz und aussagekräftig, z. B. „Wasserflugtreffen 2026 – ein Rückblick“.' },
        datum('datum', 'Datum', { default: '{{now}}', hint: 'Bestimmt die Reihenfolge unter „Aktuelles“. Der neueste Beitrag steht oben.' }),
        { name: 'kategorien', label: 'Kategorie', widget: 'select', multiple: true, min: 1, options: [...KATEGORIEN], default: ['Aktuelles'], hint: 'Mindestens eine. Bauberichte zusätzlich unter „Baubericht“ einordnen.' },
        { name: 'entwurf', label: 'Entwurf – noch nicht veröffentlichen', widget: 'boolean', default: false, required: false, hint: 'Eingeschaltet: Der Beitrag wird gespeichert, erscheint aber noch nicht auf der Seite.' },
        { name: 'titelbild', label: 'Titelbild', widget: 'image', required: false, hint: 'Erscheint in der Übersicht und oben im Beitrag. Ohne Titelbild wird das Vereinslogo gezeigt.' },
        { name: 'titelbild_alt', label: 'Bildbeschreibung zum Titelbild', widget: 'string', required: false, hint: 'Kurz beschreiben, was zu sehen ist – für blinde Besucher und Suchmaschinen. Zum Beispiel „Rotes Wasserflugzeug startet auf dem Badesee“.' },
        text,
        galerie('Optional: viele Fotos auf einmal hochladen. Sie erscheinen als Galerie unter dem Text.'),
        { name: 'kurztext', label: 'Kurztext für die Übersicht', widget: 'text', required: false, hint: 'Optional, ein bis zwei Sätze. Ohne Angabe wird der Anfang des Textes verwendet.' },
      ],
    },
    {
      name: 'termine',
      label: 'Termine',
      label_singular: 'Termin',
      description: 'Veranstaltungen und Treffen. Vergangene Termine werden automatisch ausgeblendet.',
      icon: 'event',
      folder: 'src/content/termine',
      // Bilder zu Terminen liegen in src/content/termine/bilder/
      media_folder: 'bilder',
      public_folder: 'bilder',
      extension: 'yml',
      format: 'yaml',
      slug: '{{fields.datum}}-{{fields.titel}}',
      create: true,
      identifier_field: 'titel',
      summary: "{{datum | date('DD.MM.YYYY')}} – {{titel}}{{ort | ternary(' · ', '')}}{{ort}}",
      thumbnail: 'bild',
      preview_path: 'termine',
      view_groups: [{ label: 'Jahr', field: 'datum', pattern: '\\d{4}' }],
      editor: { preview: false },
      sortable_fields: { fields: ['datum', 'titel'], default: { field: 'datum', direction: 'descending' } },
      fields: [
        { name: 'titel', label: 'Bezeichnung', widget: 'string' },
        datum('datum', 'Datum (erster Tag)'),
        datum('ende', 'Letzter Tag', { required: false, hint: 'Nur bei mehrtägigen Veranstaltungen ausfüllen.' }),
        { name: 'uhrzeit', label: 'Uhrzeit', widget: 'string', required: false, hint: 'z. B. „17–20 Uhr“ oder „ab 10 Uhr“. So geschrieben erkennt die Seite die Uhrzeit.' },
        { name: 'ort', label: 'Ort', widget: 'string', required: false },
        { name: 'beschreibung', label: 'Kurzbeschreibung', widget: 'text', required: false },
        { name: 'link', label: 'Link zu weiteren Infos', widget: 'string', required: false, hint: 'z. B. Adresse eines Beitrags: /aktuelles/…/' },
        { name: 'bild', label: 'Bild (z. B. Plakat oder Einladung)', widget: 'image', required: false, hint: 'Optional. Erscheint als kleines Vorschaubild beim Termin und lässt sich zum Vergrößern antippen.' },
        { name: 'bild_alt', label: 'Bildbeschreibung', widget: 'string', required: false, hint: 'Kurz beschreiben, was zu sehen ist – für blinde Besucher und Suchmaschinen. Zum Beispiel „Rotes Wasserflugzeug startet auf dem Badesee“.' },
        { name: 'anmeldung', label: 'Online-Anmeldung möglich', widget: 'boolean', default: false, required: false, hint: 'Einschalten, wenn sich Besucher über die Webseite anmelden sollen. Die Anmeldungen sehen Sie unter „Anmeldungen“ – sie werden nie öffentlich gezeigt.' },
        { name: 'plaetze', label: 'Höchstzahl Teilnehmer (Personen)', widget: 'number', value_type: 'int', min: 1, required: false, hint: 'Optional. Ist die Zahl erreicht, ist keine Anmeldung mehr möglich. Leer lassen = unbegrenzt. Die freien Plätze stehen öffentlich beim Termin.' },
        { name: 'geraete', label: 'Höchstzahl Fluggeräte', widget: 'number', value_type: 'int', min: 1, required: false, hint: 'Optional, z. B. beim Hallenfliegen. Dann fragt das Formular, wie viele Fluggeräte jemand mitbringt. Ist die Zahl erreicht, sind nur noch Anmeldungen ohne Fluggerät möglich. Leer lassen = keine Grenze.' },
        datum('anmeldeschluss', 'Anmeldeschluss', { required: false, hint: 'Optional. Letzter Tag, an dem man sich anmelden kann. Leer lassen = bis zum Veranstaltungstag.' }),
      ],
    },
    {
      name: 'galerien',
      label: 'Bildergalerien',
      label_singular: 'Bildergalerie',
      description: 'Fotos von Veranstaltungen. Erscheinen unter „Impressionen“, nach Jahren sortiert.',
      icon: 'photo_library',
      folder: 'src/content/galerien',
      path: '{{slug}}/index',
      slug: '{{fields.jahr}}-{{fields.titel}}',
      create: true,
      identifier_field: 'titel',
      summary: '{{jahr}} – {{titel}}',
      thumbnail: 'bilder',
      preview_path: 'impressionen/{{slug}}',
      sortable_fields: { fields: ['jahr', 'titel'], default: { field: 'jahr', direction: 'descending' } },
      ...neben,
      fields: [
        { name: 'titel', label: 'Veranstaltung', widget: 'string', hint: 'z. B. „Wasserflugtreffen“ – das Jahr wird automatisch ergänzt.' },
        { name: 'jahr', label: 'Jahr', widget: 'number', value_type: 'int', min: 1971, max: 2100 },
        datum('datum', 'Datum der Veranstaltung', { required: false, hint: 'Optional, für die Reihenfolge innerhalb eines Jahres.' }),
        galerie('Alle Fotos auf einmal auswählen. Das erste Bild wird als Vorschaubild verwendet.'),
        { ...text, label: 'Beschreibung', hint: 'Optional.' },
      ],
    },
    {
      name: 'seiten',
      label: 'Seiten',
      label_singular: 'Seite',
      description: 'Feste Seiten wie „Über uns“, „Gastpiloten“ oder „Impressum“. Neue Seiten anschließend unter Einstellungen → Menü verlinken.',
      icon: 'description',
      folder: 'src/content/seiten',
      path: '{{slug}}/index',
      slug: '{{slug}}',
      create: true,
      identifier_field: 'titel',
      summary: '{{titel}}',
      preview_path: '{{slug}}',
      ...neben,
      fields: [
        { name: 'titel', label: 'Überschrift', widget: 'string' },
        { name: 'untertitel', label: 'Untertitel', widget: 'string', required: false },
        text,
        galerie('Optional: Bilder, die als Galerie unter dem Text erscheinen.'),
      ],
    },
    { divider: true },
    {
      name: 'mitglieder_dokumente',
      label: 'Mitglieder-Dokumente',
      label_singular: 'Dokument',
      description: 'Unterlagen nur für Mitglieder (z. B. Flugleiter-Plan, Protokolle). Keine personenbezogenen Daten einstellen. Erscheint erst, wenn der Mitgliederbereich freigeschaltet ist.',
      icon: 'lock',
      folder: 'src/content/mitglieder-dokumente',
      extension: 'yml',
      format: 'yaml',
      slug: '{{fields.titel}}',
      create: true,
      identifier_field: 'titel',
      summary: '{{kategorie}} – {{titel}}{{sichtbar | ternary(\'\', \' · AUSGEBLENDET\')}}',
      sortable_fields: { fields: ['titel', 'kategorie', 'stand'], default: { field: 'kategorie', direction: 'ascending' } },
      view_groups: [{ label: 'Kategorie', field: 'kategorie' }],
      editor: { preview: false },
      fields: [
        { name: 'titel', label: 'Bezeichnung', widget: 'string', hint: 'z. B. „Flugleiter-Einteilung 2027“' },
        { name: 'kategorie', label: 'Kategorie', widget: 'select', options: [...MITGLIEDER_KATEGORIEN], default: 'Flugbetrieb' },
        { name: 'datei', label: 'Datei (PDF, Word, Excel …)', widget: 'file', media_folder: '/src/mitglieder/dateien', public_folder: '/mitglieder/dateien', hint: 'Die Datei ist nur über den geschützten Mitgliederbereich erreichbar. Höchstens 24 MB.' },
        { name: 'beschreibung', label: 'Kurzbeschreibung', widget: 'string', required: false },
        datum('stand', 'Stand', { required: false, hint: 'Datum der Fassung, z. B. bei Protokollen oder Plänen.' }),
        { name: 'sichtbar', label: 'Für Mitglieder sichtbar', widget: 'boolean', default: true, required: false, hint: 'Ausschalten, um ein Dokument vorübergehend auszublenden, ohne es zu löschen.' },
      ],
    },
    {
      name: 'mitgliederbereich',
      label: 'Mitgliederbereich',
      description: 'Begrüßungstext und Liste der Mitglieder, die Zugang zum Mitgliederbereich bekommen.',
      icon: 'group',
      editor: { preview: false },
      files: [
        {
          name: 'mitgliederliste',
          label: 'Mitgliederliste (Zugang)',
          file: 'src/data/mitglieder.json',
          fields: [
            {
              name: 'mitglieder', label: 'Mitglieder mit Zugang', label_singular: 'Mitglied', widget: 'list', required: false,
              summary: '{{name}} · {{email}}{{aktiv | ternary(\'\', \' · GESPERRT\')}}',
              hint: 'Wer hier mit E-Mail-Adresse eingetragen und aktiv ist, kann sich im Mitgliederbereich mit einem Code per E-Mail anmelden. Ausgetretene Mitglieder einfach auf „gesperrt“ stellen oder löschen. Diese Liste wird nicht veröffentlicht.',
              fields: [
                { name: 'name', label: 'Name', widget: 'string' },
                { name: 'email', label: 'E-Mail-Adresse', widget: 'string', pattern: ['^[^\\s@]+@[^\\s@]+\\.[^\\s@]{2,}$', 'Bitte eine gültige E-Mail-Adresse eingeben'] },
                { name: 'aktiv', label: 'Zugang aktiv', widget: 'boolean', default: true },
                { name: 'notiz', label: 'Notiz (intern)', widget: 'string', required: false, hint: 'z. B. „Flugleiter“ oder „Jugendgruppe“' },
              ],
            },
          ],
        },
        {
          name: 'texte',
          label: 'Texte im Mitgliederbereich',
          file: 'src/data/mitgliederbereich.json',
          fields: [
            { name: 'titel', label: 'Überschrift', widget: 'string' },
            { name: 'begruessung', label: 'Begrüßung', widget: 'text' },
            { name: 'hinweis', label: 'Hinweis über der Dokumentliste', widget: 'string', required: false },
          ],
        },
      ],
    },
    {
      name: 'einstellungen',
      label: 'Einstellungen',
      description: 'Downloads, Menü und allgemeine Angaben. Selten nötig – Änderungen wirken auf der ganzen Seite.',
      editor: { preview: false },
      icon: 'settings',
      files: [
        {
          name: 'downloads',
          label: 'Downloads',
          file: 'src/data/downloads.json',
          fields: [
            { name: 'einleitung', label: 'Einleitung', widget: 'text', required: false },
            {
              name: 'dateien', label: 'Dateien', label_singular: 'Datei', widget: 'list', summary: '{{titel}}',
              fields: [
                { name: 'titel', label: 'Bezeichnung', widget: 'string' },
                { name: 'beschreibung', label: 'Hinweis', widget: 'string', required: false, hint: 'z. B. „Stand April 2023“' },
                { name: 'datei', label: 'Datei (PDF, Word …)', widget: 'file', media_folder: '/public/dateien', public_folder: '/dateien' },
              ],
            },
          ],
        },
        {
          name: 'navigation',
          label: 'Menü',
          file: 'src/data/navigation.json',
          fields: [
            {
              name: 'haupt', label: 'Hauptmenü', label_singular: 'Menüpunkt', widget: 'list', summary: '{{titel}}',
              fields: [
                { name: 'titel', label: 'Bezeichnung', widget: 'string' },
                { name: 'link', label: 'Adresse', widget: 'string', hint: 'z. B. /gastpiloten/' },
                {
                  name: 'unterpunkte', label: 'Unterpunkte', label_singular: 'Unterpunkt', widget: 'list', required: false, summary: '{{titel}}',
                  fields: [
                    { name: 'titel', label: 'Bezeichnung', widget: 'string' },
                    { name: 'link', label: 'Adresse', widget: 'string' },
                  ],
                },
              ],
            },
            {
              name: 'fuss', label: 'Fußzeile', label_singular: 'Link', widget: 'list', summary: '{{titel}}',
              fields: [
                { name: 'titel', label: 'Bezeichnung', widget: 'string' },
                { name: 'link', label: 'Adresse', widget: 'string' },
              ],
            },
          ],
        },
        {
          name: 'allgemein',
          label: 'Allgemeine Angaben',
          file: 'src/data/einstellungen.json',
          fields: [
            { name: 'name', label: 'Name des Vereins', widget: 'string' },
            { name: 'kurzname', label: 'Kurzname', widget: 'string' },
            { name: 'claim', label: 'Leitspruch', widget: 'string', required: false },
            { name: 'beschreibung', label: 'Beschreibung für Suchmaschinen', widget: 'text' },
            { name: 'anschrift', label: 'Anschrift', widget: 'text' },
            { name: 'email', label: 'E-Mail-Adresse', widget: 'string' },
            { name: 'telefon', label: 'Telefon', widget: 'string', required: false },
            {
              name: 'flugplatz', label: 'Flugplatz (für Karte und Wetter)', widget: 'object',
              fields: [
                { name: 'name', label: 'Bezeichnung', widget: 'string' },
                { name: 'breite', label: 'Breitengrad', widget: 'number', value_type: 'float' },
                { name: 'laenge', label: 'Längengrad', widget: 'number', value_type: 'float' },
              ],
            },
          ],
        },
      ],
    },
  ],
};

// JSON ist gültiges YAML – so bleibt die Datei für das Redaktionssystem lesbar.
export const GET: APIRoute = () => new Response(JSON.stringify(config, null, 2), { headers: { 'content-type': 'text/yaml; charset=utf-8' } });
