// Wetter für den Flugplatz. Die Abfrage läuft über unseren Server,
// damit Besucher keine Daten direkt an den Wetterdienst übertragen.
import seite from '../src/data/einstellungen.json';

export async function onRequestGet() {
  const { breite, laenge } = seite.flugplatz;
  const url =
    `https://api.open-meteo.com/v1/forecast?latitude=${breite}&longitude=${laenge}` +
    '&current=temperature_2m,precipitation,weather_code,cloud_cover,wind_speed_10m,wind_direction_10m,wind_gusts_10m' +
    '&hourly=temperature_2m,precipitation_probability,weather_code,wind_speed_10m,wind_direction_10m,wind_gusts_10m' +
    '&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_sum,wind_speed_10m_max,wind_gusts_10m_max,wind_direction_10m_dominant' +
    '&timezone=Europe%2FBerlin&forecast_days=5&wind_speed_unit=kmh';
  try {
    const antwort = await fetch(url, { cf: { cacheTtl: 600, cacheEverything: true } });
    if (!antwort.ok) throw new Error(`Wetterdienst antwortet mit ${antwort.status}`);
    return new Response(await antwort.text(), {
      headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'public, max-age=600' },
    });
  } catch (fehler) {
    return Response.json({ fehler: 'Wetterdaten nicht verfügbar' }, { status: 502 });
  }
}
