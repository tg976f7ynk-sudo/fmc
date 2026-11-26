// Bewegung und Live-Elemente für Designvorschlag 2.
// Alles ist Zusatz: Ohne JavaScript oder mit „Bewegung reduzieren“ bleibt die Seite vollständig.
import { holeWetter, richtung, rund } from './wetter-daten';

const ruhig = matchMedia('(prefers-reduced-motion: reduce)').matches;
const feinerZeiger = matchMedia('(pointer: fine)').matches;
const sichtbar = (ziel: Element, rueckruf: () => void, rand = '0px 0px -10% 0px') => {
  const beobachter = new IntersectionObserver(
    (eintraege) => {
      if (eintraege.some((e) => e.isIntersecting)) {
        beobachter.disconnect();
        rueckruf();
      }
    },
    { rootMargin: rand },
  );
  beobachter.observe(ziel);
};

// ---------- Hochzählende Zahlen
document.querySelectorAll<HTMLElement>('[data-zahl]').forEach((el) => {
  if (ruhig) return;
  const ziel = Number(el.dataset.zahl);
  const roh = !!el.dataset.roh;
  const start = roh ? ziel - 60 : 0;
  sichtbar(el, () => {
    const dauer = 1600;
    const t0 = performance.now();
    const schritt = (t: number) => {
      const p = Math.min(1, (t - t0) / dauer);
      const wert = Math.round(start + (ziel - start) * (1 - Math.pow(1 - p, 3)));
      el.textContent = roh ? String(wert) : wert.toLocaleString('de-DE');
      if (p < 1) requestAnimationFrame(schritt);
    };
    requestAnimationFrame(schritt);
  });
});

// ---------- Klappanzeige (Abflugtafel)
const ZEICHEN = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
function klappen(el: HTMLElement, verzoegerung: number) {
  const ziel = el.textContent ?? '';
  if (!ziel.trim()) return;
  el.setAttribute('aria-label', ziel);
  const t0 = performance.now() + verzoegerung;
  const dauer = 700;
  const schritt = (t: number) => {
    const p = (t - t0) / dauer;
    if (p >= 1) {
      el.textContent = ziel;
      el.removeAttribute('aria-label');
      return;
    }
    if (p > 0) {
      const fertig = Math.floor(p * ziel.length);
      el.textContent = [...ziel]
        .map((z, i) => (i < fertig || z === ' ' || z === '.' || z === ':' ? z : ZEICHEN[(Math.random() * ZEICHEN.length) | 0]))
        .join('');
    }
    requestAnimationFrame(schritt);
  };
  requestAnimationFrame(schritt);
}
document.querySelectorAll<HTMLElement>('.tafel').forEach((tafel) => {
  if (ruhig) return;
  sichtbar(tafel, () => {
    tafel.classList.add('klappt');
    tafel.querySelectorAll<HTMLElement>('[data-kommend] .termin').forEach((zeile, i) => {
      zeile.style.setProperty('--i', String(i));
      zeile.querySelectorAll<HTMLElement>('.termin-datum, .termin-zeit, .termin-status').forEach((f) => klappen(f, i * 120));
    });
  });
});

// ---------- Kacheln kippen mit dem Mauszeiger
if (feinerZeiger && !ruhig) {
  document.querySelectorAll<HTMLElement>('[data-kippen]').forEach((el) => {
    el.addEventListener('pointermove', (e) => {
      const r = el.getBoundingClientRect();
      const x = (e.clientX - r.left) / r.width - 0.5;
      const y = (e.clientY - r.top) / r.height - 0.5;
      el.style.setProperty('--ry', `${x * 10}deg`);
      el.style.setProperty('--rx', `${-y * 10}deg`);
      el.style.setProperty('--gx', `${(x + 0.5) * 100}%`);
      el.style.setProperty('--gy', `${(y + 0.5) * 100}%`);
    });
    el.addEventListener('pointerleave', () => {
      el.style.setProperty('--rx', '0deg');
      el.style.setProperty('--ry', '0deg');
    });
  });
}

// ---------- Startbildschirm: Video, Uhr, Live-Telemetrie, Bewegung anhalten
const buehne = document.querySelector<HTMLElement>('.buehne');
if (buehne) {
  const verbindung = (navigator as any).connection;
  const sparen = verbindung?.saveData || /(^|-)2g$/.test(verbindung?.effectiveType ?? '');
  let video: HTMLVideoElement | null = null;
  if (!ruhig && !sparen && matchMedia('(min-width: 760px)').matches && buehne.dataset.video) {
    video = document.createElement('video');
    Object.assign(video, { muted: true, loop: true, playsInline: true, autoplay: true, preload: 'auto' });
    video.setAttribute('muted', '');
    video.setAttribute('aria-hidden', 'true');
    video.className = 'buehne-video';
    video.src = buehne.dataset.video;
    video.addEventListener('playing', () => buehne.classList.add('video-laeuft'), { once: true });
    buehne.prepend(video);
    // Video nur abspielen, solange es zu sehen ist
    new IntersectionObserver(([e]) => {
      if (!video || buehne.classList.contains('angehalten')) return;
      if (e.isIntersecting) video.play().catch(() => {});
      else video.pause();
    }).observe(buehne);
  }

  const knopf = buehne.querySelector<HTMLButtonElement>('[data-bewegung]');
  if (ruhig && knopf) knopf.hidden = true;
  knopf?.addEventListener('click', () => {
    const an = document.documentElement.classList.toggle('bewegung-aus');
    buehne.classList.toggle('angehalten', an);
    knopf.setAttribute('aria-pressed', String(an));
    knopf.querySelector('span')!.textContent = an ? 'Bewegung an' : 'Bewegung aus';
    if (video) an ? video.pause() : video.play().catch(() => {});
  });

  const uhr = buehne.querySelector<HTMLElement>('[data-uhr]');
  if (uhr) {
    const stellen = () => (uhr.textContent = new Date().toLocaleTimeString('de-DE', { timeZone: 'Europe/Berlin' }));
    stellen();
    setInterval(stellen, 1000);
  }

  const tele = buehne.querySelector<HTMLElement>('[data-telemetrie]');
  if (tele) {
    holeWetter()
      .then((w) => {
        const j = w.current;
        const setze = (name: string, wert: string) => {
          const el = tele.querySelector<HTMLElement>(`[data-t="${name}"]`);
          if (el) el.textContent = wert;
        };
        setze('wind', `${String(rund(j.wind_speed_10m)).padStart(3, '0')} km/h ${richtung(j.wind_direction_10m)}`);
        setze('boeen', `${String(rund(j.wind_gusts_10m)).padStart(3, '0')} km/h`);
        setze('temp', `${rund(j.temperature_2m)} °C`);
        setze('qnh', j.pressure_msl ? `${rund(j.pressure_msl)} hPa` : '–');
        tele.classList.add('live');
      })
      .catch(() => tele.classList.add('offline'));
  }
}
