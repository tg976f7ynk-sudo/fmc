// Cloudflare Turnstile für Formulare: wird erst geladen, wenn jemand das Formular benutzt,
// und nur, wenn der Schlüssel eingerichtet ist (die Schnittstelle liefert ihn mit).
export function sicherheitspruefung(form: HTMLFormElement, holeSchluessel: () => Promise<string | null | undefined>) {
  let aktiv = false;
  let token = '';
  const wartende: ((t: string) => void)[] = [];
  let laden: Promise<void> | null = null;
  const lade = () =>
    (laden ??= (async () => {
      const schluessel = await holeSchluessel().catch(() => null);
      if (!schluessel) return;
      if (!(window as any).turnstile) {
        await new Promise<void>((fertig, fehler) => {
          const s = document.createElement('script');
          s.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';
          s.onload = () => fertig();
          s.onerror = () => fehler(new Error('Sicherheitsprüfung nicht ladbar'));
          document.head.append(s);
        });
      }
      (window as any).turnstile.render(form.querySelector('[data-pruefung]'), {
        sitekey: schluessel,
        language: 'de',
        appearance: 'interaction-only',
        callback: (t: string) => {
          token = t;
          wartende.splice(0).forEach((w) => w(t));
        },
        'expired-callback': () => (token = ''),
        'error-callback': () => (token = ''),
      });
      aktiv = true;
    })().catch(() => {}));
  form.addEventListener('focusin', lade, { once: true });
  return {
    // liefert '' ohne Prüfung, null wenn die Prüfung aktiv, aber nicht abgeschlossen ist
    async token(): Promise<string | null> {
      await lade();
      if (!aktiv) return '';
      if (token) return token;
      return new Promise<string | null>((fertig) => {
        wartende.push(fertig);
        setTimeout(() => fertig(null), 15000);
      });
    },
    // ein Token gilt nur einmal
    zuruecksetzen() {
      if (!aktiv) return;
      token = '';
      (window as any).turnstile?.reset();
    },
  };
}
