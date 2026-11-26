// Anmeldung der Redaktion: leitet zu GitHub weiter (OAuth).
// Benötigt in Cloudflare: GITHUB_CLIENT_ID und GITHUB_CLIENT_SECRET (Secret).
export async function onRequestGet({ request, env }) {
  const url = new URL(request.url);
  if (!env.GITHUB_CLIENT_ID || !env.GITHUB_CLIENT_SECRET)
    return new Response('Die Anmeldung ist noch nicht eingerichtet (GITHUB_CLIENT_ID / GITHUB_CLIENT_SECRET fehlen).', { status: 503 });
  if ((url.searchParams.get('provider') || 'github') !== 'github') return new Response('Unbekannter Anbieter', { status: 400 });

  const state = crypto.randomUUID();
  const ziel = new URL('https://github.com/login/oauth/authorize');
  ziel.searchParams.set('client_id', env.GITHUB_CLIENT_ID);
  ziel.searchParams.set('redirect_uri', `${url.origin}/api/callback`);
  ziel.searchParams.set('scope', 'repo,user');
  ziel.searchParams.set('state', state);
  return new Response(null, {
    status: 302,
    headers: {
      location: ziel.href,
      'set-cookie': `fmc_oauth=${state}; HttpOnly; Secure; SameSite=Lax; Path=/api; Max-Age=600`,
      'cache-control': 'no-store',
    },
  });
}
