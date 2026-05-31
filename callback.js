export default async function handler(req, res) {
  const CONSUMER_KEY = process.env.DISCOGS_CONSUMER_KEY;
  const CONSUMER_SECRET = process.env.DISCOGS_CONSUMER_SECRET;
  const SUPABASE_URL = process.env.SUPABASE_URL;
  const SUPABASE_KEY = process.env.SUPABASE_KEY;

  const { oauth_token, oauth_verifier } = req.query;
  
  // Get token secret from cookie
  const cookies = Object.fromEntries((req.headers.cookie||'').split(';').map(c => c.trim().split('=')));
  const tokenSecret = cookies.oauth_token_secret;

  try {
    // Exchange for access token
    const r = await fetch('https://api.discogs.com/oauth/access_token', {
      method: 'POST',
      headers: {
        'Authorization': `OAuth oauth_consumer_key="${CONSUMER_KEY}",oauth_token="${oauth_token}",oauth_signature_method="PLAINTEXT",oauth_signature="${CONSUMER_SECRET}&${tokenSecret}",oauth_verifier="${oauth_verifier}"`,
        'Content-Type': 'application/x-www-form-urlencoded',
        'User-Agent': 'OSSATURE/1.0'
      }
    });

    const text = await r.text();
    const params = new URLSearchParams(text);
    const accessToken = params.get('oauth_token');
    const accessSecret = params.get('oauth_token_secret');

    if (!accessToken) return res.status(500).json({ error: 'Failed to get access token', raw: text });

    // Get user identity
    const identity = await fetch('https://api.discogs.com/oauth/identity', {
      headers: {
        'Authorization': `OAuth oauth_consumer_key="${CONSUMER_KEY}",oauth_token="${accessToken}",oauth_signature_method="PLAINTEXT",oauth_signature="${CONSUMER_SECRET}&${accessSecret}"`,
        'User-Agent': 'OSSATURE/1.0'
      }
    });
    const user = await identity.json();
    const username = user.username;

    // Save user to Supabase
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

    // Set session cookie and redirect
    res.setHeader('Set-Cookie', [
      `ossature_user=${username}; Path=/; SameSite=Lax; Max-Age=2592000`,
      `ossature_token=${accessToken}; Path=/; HttpOnly; SameSite=Lax; Max-Age=2592000`,
      `ossature_secret=${accessSecret}; Path=/; HttpOnly; SameSite=Lax; Max-Age=2592000`
    ]);
    
    res.redirect(302, `/?user=${username}&token=${accessToken}`);
  } catch(e) {
    res.status(500).json({ error: e.message });
  }
}
