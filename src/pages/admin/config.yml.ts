// Einstellungen des Redaktionssystems (Sveltia CMS) – erzeugt /admin/config.yml.
// Hier wird festgelegt, welche Eingabefelder die Redaktion sieht.
import type { APIRoute } from 'astro';
import technik from '../../../site.config.mjs';
import { KATEGORIEN } from '../../content.config';

const neben = { media_folder: '', public_folder: '' }; // Bilder liegen direkt beim Eintrag
const datum = (name: string, label: string, extra = {}) => ({
  name, label, widget: 'datetime', format: 'YYYY-MM-DD', date_format: 'DD.MM.YYYY', time_format: false, picker_utc: true, ...extra,
});
const text = { name: 'body', label: 'Text', widget: 'markdown', required: false, buttons: ['bold', 'italic', 'link', 'heading-two', 'heading-three', 'bulleted-list', 'numbered-list', 'quote'], editor_components: ['image'], hint: 'Bilder über das Bild-Symbol einfügen. Mehrere Bilder direkt hintereinander werden automatisch als Bilderreihe dargestellt. Ein YouTube-Link in einer eigenen Zeile wird zum Video.' };
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
  logo_url: '/apple-touch-icon.png',
  locale: 'de',
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
      summary: '{{titel}}',
      sortable_fields: { fields: ['datum', 'titel'], default: { field: 'datum', direction: 'descending' } },
      view_filters: KATEGORIEN.map((k) => ({ label: k, field: 'kategorien', pattern: k })),
      ...neben,
      fields: [
        { name: 'titel', label: 'Überschrift', widget: 'string' },
        datum('datum', 'Datum', { default: '{{now}}' }),
        { name: 'kategorien', label: 'Kategorie', widget: 'select', multiple: true, min: 1, options: [...KATEGORIEN], default: ['Aktuelles'] },
        { name: 'titelbild', label: 'Titelbild', widget: 'image', required: false, hint: 'Erscheint in der Übersicht und oben im Beitrag. Ohne Titelbild wird das Vereinslogo gezeigt.' },
        text,
        galerie('Optional: viele Fotos auf einmal hochladen. Sie erscheinen als Galerie unter dem Text.'),
        { name: 'kurztext', label: 'Kurztext für die Übersicht', widget: 'text', required: false, hint: 'Optional. Ohne Angabe wird der Anfang des Textes verwendet.' },
        { name: 'entwurf', label: 'Entwurf (noch nicht veröffentlichen)', widget: 'boolean', default: false, required: false },
      ],
    },
    {
      name: 'termine',
      label: 'Termine',
      label_singular: 'Termin',
      description: 'Veranstaltungen und Treffen. Vergangene Termine werden automatisch ausgeblendet.',
      icon: 'event',
      folder: 'src/content/termine',
      extension: 'yml',
      format: 'yaml',
      slug: '{{fields.datum}}-{{fields.titel}}',
      create: true,
      identifier_field: 'titel',
      summary: '{{datum}} – {{titel}}',
      sortable_fields: { fields: ['datum', 'titel'], default: { field: 'datum', direction: 'descending' } },
      fields: [
        { name: 'titel', label: 'Bezeichnung', widget: 'string' },
        datum('datum', 'Datum (erster Tag)'),
        datum('ende', 'Letzter Tag', { required: false, hint: 'Nur bei mehrtägigen Veranstaltungen ausfüllen.' }),
        { name: 'uhrzeit', label: 'Uhrzeit', widget: 'string', required: false, hint: 'z. B. „ab 10 Uhr“' },
        { name: 'ort', label: 'Ort', widget: 'string', required: false },
        { name: 'beschreibung', label: 'Kurzbeschreibung', widget: 'text', required: false },
        { name: 'link', label: 'Link zu weiteren Infos', widget: 'string', required: false, hint: 'z. B. Adresse eines Beitrags: /aktuelles/…/' },
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
      ...neben,
      fields: [
        { name: 'titel', label: 'Überschrift', widget: 'string' },
        { name: 'untertitel', label: 'Untertitel', widget: 'string', required: false },
        text,
        galerie('Optional: Bilder, die als Galerie unter dem Text erscheinen.'),
      ],
    },
    {
      name: 'einstellungen',
      label: 'Einstellungen',
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
