// Gemeinsamer Abruf der Wetterdaten: Startbildschirm und Instrumentenpanel
// nutzen dieselbe Anfrage.
export const LAGE: Record<number, string> = {
  0: 'Klar', 1: 'Überwiegend klar', 2: 'Teils bewölkt', 3: 'Bedeckt', 45: 'Nebel', 48: 'Reifnebel',
  51: 'Leichter Niesel', 53: 'Niesel', 55: 'Starker Niesel', 56: 'Gefrierender Niesel', 57: 'Gefrierender Niesel',
  61: 'Leichter Regen', 63: 'Regen', 65: 'Starker Regen', 66: 'Gefrierender Regen', 67: 'Gefrierender Regen',
  71: 'Leichter Schneefall', 73: 'Schneefall', 75: 'Starker Schneefall', 77: 'Schneegriesel',
  80: 'Leichte Schauer', 81: 'Schauer', 82: 'Starke Schauer', 85: 'Schneeschauer', 86: 'Starke Schneeschauer',
  95: 'Gewitter', 96: 'Gewitter mit Hagel', 99: 'Gewitter mit Hagel',
};
const RICHTUNG = ['N', 'NO', 'O', 'SO', 'S', 'SW', 'W', 'NW'];
export const richtung = (grad: number) => RICHTUNG[Math.round(grad / 45) % 8];
export const rund = (n: number) => Math.round(n);
export const uhrzeit = (iso: string) => iso.slice(11, 16);
// Pfeil zeigt, wohin der Wind weht (meteorologische Richtung = woher)
export const pfeil = (grad: number) =>
  `<svg class="windpfeil" viewBox="0 0 24 24" style="transform:rotate(${grad + 180}deg)" aria-hidden="true"><path d="M12 2 5 20l7-4 7 4z" fill="currentColor"/></svg>`;

let anfrage: Promise<any> | null = null;
export function holeWetter(): Promise<any> {
  return (anfrage ??= fetch('/api/wetter').then((r) => {
    if (!r.ok) throw new Error(String(r.status));
    return r.json();
  }));
}
