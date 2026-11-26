// Anmeldung der Redaktion, Schritt 2: GitHub schickt den Besucher hierher zurück.
// Das Zugriffstoken wird nur an das Redaktionssystem auf derselben Adresse übergeben.
const seite = (status, inhalt, nonce = crypto.randomUUID().replaceAll('-', '')) =>
  new Response(
    `<!doctype html><html lang="de"><head><meta charset="utf-8"><title>Anmeldung</title></head><body><p>Anmeldung wird abgeschlossen …</p><script nonce="${nonce}">
(() => {
  const nachricht = 'authorization:github:${status}:' + ${JSON.stringify(JSON.stringify(inhalt))};
  if (!window.opener) { document.body.textContent = 'Dieses Fenster kann geschlossen werden.'; return; }
  window.addEventListener('message', (e) => {
    if (e.origin !== location.origin) return;
    window.opener.postMessage(nachricht, location.origin);
  });
  window.opener.postMessage('authorizing:github', location.origin);
})();
</script></body></html>`,
    {
      headers: {
        'content-type': 'text/html; charset=utf-8',
        'cache-control': 'no-store',
        // nur dieses eine Skript darf laufen
        'content-security-policy': `default-src 'none'; script-src 'nonce-${nonce}'; frame-ancestors 'none'`,
        'set-cookie': 'fmc_oauth=; HttpOnly; Secure; SameSite=Lax; Path=/api; Max-Age=0',
      },
    },
  );

export async function onRequestGet({ request, env }) {
  const url = new URL(request.url);
  const code = url.searchParams.get('code');
  const state = url.searchParams.get('state');
  const cookie = /(?:^|;\s*)fmc_oauth=([^;]+)/.exec(request.headers.get('cookie') || '')?.[1];
  if (!code || !state || !cookie || state !== cookie) return seite('error', { error: 'Die Anmeldung ist abgelaufen. Bitte erneut versuchen.' });

  try {
    const antwort = await fetch('https://github.com/login/oauth/access_token', {
      method: 'POST',
      headers: { 'content-type': 'application/json', accept: 'application/json', 'user-agent': 'fmc-dietzenbach-website' },
      body: JSON.stringify({ client_id: env.GITHUB_CLIENT_ID, client_secret: env.GITHUB_CLIENT_SECRET, code }),
    });
    const daten = await antwort.json();
    if (!daten.access_token) return seite('error', { error: daten.error_description || 'GitHub hat die Anmeldung abgelehnt.' });
    return seite('success', { token: daten.access_token, provider: 'github' });
  } catch {
    return seite('error', { error: 'GitHub ist nicht erreichbar. Bitte später erneut versuchen.' });
  }
}
