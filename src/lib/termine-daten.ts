// Öffentliche Termindaten (ohne Teilnehmer) für Anmeldeseite, Kalenderdateien und den Worker.
import { alleTermine, isoTag, zeitraum } from './inhalte';

export async function termineDaten() {
  return (await alleTermine()).map((t) => ({
    id: t.id,
    titel: t.data.titel,
    datum: isoTag(t.data.datum),
    ende: t.data.ende ? isoTag(t.data.ende) : null,
    wann: zeitraum(t.data.datum, t.data.ende),
    uhrzeit: t.data.uhrzeit ?? null,
    ort: t.data.ort ?? null,
    beschreibung: t.data.beschreibung ?? null,
    link: t.data.link ?? null,
    anmeldung: t.data.anmeldung === true,
    plaetze: t.data.plaetze ?? null,
    anmeldeschluss: t.data.anmeldeschluss ? isoTag(t.data.anmeldeschluss) : null,
  }));
}
