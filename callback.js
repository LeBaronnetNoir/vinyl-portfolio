const SB_URL = process.env.SUPABASE_URL;
const SB_KEY = process.env.SUPABASE_KEY;

export default async function handler(req, res) {
  const CONSUMER_KEY = process.env.DISCOGS_CONSUMER_KEY;
  const CONSUMER_SECRET = process.env.DISCOGS_CONSUMER_SECRET;

  const { oauth_token, oauth_verifier } = req.query;

  try {
    // Get token secret from Supabase
    const tempRes = await fetch(`${SB_URL}/rest/v1/oauth_temp?oauth_token=eq.${oauth_token}`, {
      headers: { 'apikey': SB_KEY, 'Authorization': `Bearer ${SB_KEY}` }
    });
    const tempData = await tempRes.json();
    const tokenSecret = tempData?.[0]?.oauth_secret || '';

    console.log('Token secret from Supabase:', tokenSecret ? 'found' : 'NOT FOUND');

    const timestamp = Math.floor(Date.now() / 1000).toString();
    const nonce = Math.random().toString(36).substring(2) + Date.now().toString(36);
    const sig = encodeURIComponent(CONSUMER_SECRET) + '%26' + encodeURIComponent(tokenSecret);

    const r = await fetch('https://api.discogs.com/oauth/access_token', {
      method: 'POST',
      headers: {
        'Authorization': `OAuth oauth_consumer_key="${CONSUMER_KEY}",oauth_nonce="${nonce}",oauth_token="${oauth_token}",oauth_signature="${sig}",oauth_signature_method="PLAINTEXT",oauth_timestamp="${timestamp}",oauth_verifier="${oauth_verifier}"`,
        'Content-Type': 'application/x-www-form-urlencoded',
        'User-Agent': 'OSSATURE/1.0 +https://vinyl-portfolio-eight.vercel.app'
      }
    });

    const text = await r.text();
    console.log('Access token:', r.status, text.substring(0, 80));

    const params = new URLSearchParams(text);
    const accessToken = params.get('oauth_token');
    const accessSecret = params.get('oauth_token_secret');

    if (!accessToken) return res.status(500).json({ error: 'Failed', raw: text });

    // Get identity
    const ts2 = Math.floor(Date.now() / 1000).toString();
    const n2 = Math.random().toString(36).substring(2);
    const sig2 = encodeURIComponent(CONSUMER_SECRET) + '%26' + encodeURIComponent(accessSecret);

    const identity = await fetch('https://api.discogs.com/oauth/identity', {
      headers: {
        'Authorization': `OAuth oauth_consumer_key="${CONSUMER_KEY}",oauth_nonce="${n2}",oauth_token="${accessToken}",oauth_signature="${sig2}",oauth_signature_method="PLAINTEXT",oauth_timestamp="${ts2}"`,
        'User-Agent': 'OSSATURE/1.0'
      }
    });
    const user = await identity.json();
    const username = user.username;

    // Save user
    if(username) {
      await fetch(`${SB_URL}/rest/v1/users`, {
        method: 'POST',
        headers: { 'apikey': SB_KEY, 'Authorization': `Bearer ${SB_KEY}`, 'Content-Type': 'application/json', 'Prefer': 'resolution=merge-duplicates' },
        body: JSON.stringify({ discogs_username: username, discogs_token: accessToken, discogs_secret: accessSecret, last_login: new Date().toISOString() })
      });
      // Clean temp token
      await fetch(`${SB_URL}/rest/v1/oauth_temp?oauth_token=eq.${oauth_token}`, {
        method: 'DELETE',
        headers: { 'apikey': SB_KEY, 'Authorization': `Bearer ${SB_KEY}` }
      });
    }

    const maxAge = 31536000; // 1 an au lieu de 30 jours
    res.setHeader('Set-Cookie', [
      `ossature_user=${username}; Path=/; SameSite=Lax; Max-Age=${maxAge}`,
      `ossature_token=${accessToken}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAge}`
    ]);
    res.writeHead(302, { 'Location': `/?user=${encodeURIComponent(username)}&token=${encodeURIComponent(accessToken)}` });
    res.end();

  } catch(e) {
    res.status(500).json({ error: e.message });
  }
}
