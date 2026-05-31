export default async function handler(req, res) {
  const CONSUMER_KEY = process.env.DISCOGS_CONSUMER_KEY;
  const CONSUMER_SECRET = process.env.DISCOGS_CONSUMER_SECRET;
  const SUPABASE_URL = process.env.SUPABASE_URL;
  const SUPABASE_KEY = process.env.SUPABASE_KEY;

  const { oauth_token, oauth_verifier } = req.query;

  // Get token secret from cookie
  const cookieHeader = req.headers.cookie || '';
  const cookies = {};
  cookieHeader.split(';').forEach(c => {
    const [k, v] = c.trim().split('=');
    if(k && v) cookies[k] = v;
  });
  const tokenSecret = cookies.oauth_token_secret || '';

  const timestamp = Math.floor(Date.now() / 1000).toString();
  const nonce = Math.random().toString(36).substring(2) + Math.random().toString(36).substring(2);

  try {
    // Exchange for access token
    const r = await fetch('https://api.discogs.com/oauth/access_token', {
      method: 'POST',
      headers: {
        'Authorization': `OAuth oauth_consumer_key="${CONSUMER_KEY}",oauth_nonce="${nonce}",oauth_token="${oauth_token}",oauth_signature="${encodeURIComponent(CONSUMER_SECRET + '&' + tokenSecret)}",oauth_signature_method="PLAINTEXT",oauth_timestamp="${timestamp}",oauth_verifier="${oauth_verifier}"`,
        'Content-Type': 'application/x-www-form-urlencoded',
        'User-Agent': 'OSSATURE/1.0 +https://vinyl-portfolio-eight.vercel.app'
      }
    });

    const text = await r.text();
    console.log('Access token response:', r.status, text);

    const params = new URLSearchParams(text);
    const accessToken = params.get('oauth_token');
    const accessSecret = params.get('oauth_token_secret');

    if (!accessToken) return res.status(500).json({ error: 'Failed to get access token', raw: text });

    // Get user identity
    const ts2 = Math.floor(Date.now() / 1000).toString();
    const n2 = Math.random().toString(36).substring(2);
    const identity = await fetch('https://api.discogs.com/oauth/identity', {
      headers: {
        'Authorization': `OAuth oauth_consumer_key="${CONSUMER_KEY}",oauth_nonce="${n2}",oauth_token="${accessToken}",oauth_signature="${encodeURIComponent(CONSUMER_SECRET + '&' + accessSecret)}",oauth_signature_method="PLAINTEXT",oauth_timestamp="${ts2}"`,
        'User-Agent': 'OSSATURE/1.0 +https://vinyl-portfolio-eight.vercel.app'
      }
    });
    const user = await identity.json();
    const username = user.username;

    console.log('User:', username);

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

    // Set cookies and redirect
    const maxAge = 2592000; // 30 days
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
