export default async function handler(req, res) {
  const CONSUMER_KEY = process.env.DISCOGS_CONSUMER_KEY;
  const CONSUMER_SECRET = process.env.DISCOGS_CONSUMER_SECRET;
  const SUPABASE_URL = process.env.SUPABASE_URL;
  const SUPABASE_KEY = process.env.SUPABASE_KEY;

  const { oauth_token, oauth_verifier } = req.query;

  // Parse cookies properly
  const cookieHeader = req.headers.cookie || '';
  const tokenSecret = cookieHeader
    .split(';')
    .map(c => c.trim().split('='))
    .find(([k]) => k === 'oauth_token_secret')?.[1] || '';

  console.log('Token secret from cookie:', tokenSecret ? 'found' : 'NOT FOUND');
  console.log('Cookie header:', cookieHeader.substring(0, 100));

  const timestamp = Math.floor(Date.now() / 1000).toString();
  const nonce = Math.random().toString(36).substring(2) + Date.now().toString(36);

  // Signature for PLAINTEXT = CONSUMER_SECRET&TOKEN_SECRET (both URL encoded)
  const signature = encodeURIComponent(CONSUMER_SECRET) + '%26' + encodeURIComponent(tokenSecret);

  try {
    const r = await fetch('https://api.discogs.com/oauth/access_token', {
      method: 'POST',
      headers: {
        'Authorization': `OAuth oauth_consumer_key="${CONSUMER_KEY}",oauth_nonce="${nonce}",oauth_token="${oauth_token}",oauth_signature="${signature}",oauth_signature_method="PLAINTEXT",oauth_timestamp="${timestamp}",oauth_verifier="${oauth_verifier}"`,
        'Content-Type': 'application/x-www-form-urlencoded',
        'User-Agent': 'OSSATURE/1.0 +https://vinyl-portfolio-eight.vercel.app'
      }
    });

    const text = await r.text();
    console.log('Access token response:', r.status, text.substring(0, 100));

    const params = new URLSearchParams(text);
    const accessToken = params.get('oauth_token');
    const accessSecret = params.get('oauth_token_secret');

    if (!accessToken) return res.status(500).json({ error: 'Failed to get access token', raw: text });

    // Get user identity
    const ts2 = Math.floor(Date.now() / 1000).toString();
    const n2 = Math.random().toString(36).substring(2);
    const sig2 = encodeURIComponent(CONSUMER_SECRET) + '%26' + encodeURIComponent(accessSecret);

    const identity = await fetch('https://api.discogs.com/oauth/identity', {
      headers: {
        'Authorization': `OAuth oauth_consumer_key="${CONSUMER_KEY}",oauth_nonce="${n2}",oauth_token="${accessToken}",oauth_signature="${sig2}",oauth_signature_method="PLAINTEXT",oauth_timestamp="${ts2}"`,
        'User-Agent': 'OSSATURE/1.0 +https://vinyl-portfolio-eight.vercel.app'
      }
    });
    const user = await identity.json();
    const username = user.username;
    console.log('Logged in user:', username);

    // Save to Supabase
    if(SUPABASE_URL && SUPABASE_KEY && username) {
      await fetch(`${SUPABASE_URL}/rest/v1/users`, {
        method: 'POST',
        headers: {
          'apikey': SUPABASE_KEY,
          'Authorization': `Bearer ${SUPABASE_KEY}`,
          'Content-Type': 'application/json',
          'Prefer': 'resolution=merge-duplicates'
        },
        body: JSON.stringify({
          discogs_username: username,
          discogs_token: accessToken,
          discogs_secret: accessSecret,
          last_login: new Date().toISOString()
        })
      });
    }

    const maxAge = 2592000;
    res.setHeader('Set-Cookie', [
      `ossature_user=${username}; Path=/; SameSite=Lax; Max-Age=${maxAge}`,
      `ossature_token=${accessToken}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAge}`,
      `oauth_token_secret=; Path=/; Max-Age=0`
    ]);

    res.writeHead(302, { 'Location': `/?user=${encodeURIComponent(username)}&token=${encodeURIComponent(accessToken)}` });
    res.end();

  } catch(e) {
    console.error('Callback error:', e);
    res.status(500).json({ error: e.message });
  }
}
