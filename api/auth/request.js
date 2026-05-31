const SB_URL = process.env.SUPABASE_URL;
const SB_KEY = process.env.SUPABASE_KEY;

export default async function handler(req, res) {
  const CONSUMER_KEY = process.env.DISCOGS_CONSUMER_KEY;
  const CONSUMER_SECRET = process.env.DISCOGS_CONSUMER_SECRET;
  const CALLBACK_URL = 'https://vinyl-portfolio-eight.vercel.app/api/auth/callback';

  const timestamp = Math.floor(Date.now() / 1000).toString();
  const nonce = Math.random().toString(36).substring(2) + Date.now().toString(36);
  const sig = encodeURIComponent(CONSUMER_SECRET) + '%26';

  try {
    const r = await fetch('https://api.discogs.com/oauth/request_token', {
      method: 'POST',
      headers: {
        'Authorization': `OAuth oauth_consumer_key="${CONSUMER_KEY}",oauth_nonce="${nonce}",oauth_signature="${sig}",oauth_signature_method="PLAINTEXT",oauth_timestamp="${timestamp}",oauth_callback="${encodeURIComponent(CALLBACK_URL)}"`,
        'Content-Type': 'application/x-www-form-urlencoded',
        'User-Agent': 'OSSATURE/1.0 +https://vinyl-portfolio-eight.vercel.app'
      }
    });

    const text = await r.text();
    const params = new URLSearchParams(text);
    const token = params.get('oauth_token');
    const secret = params.get('oauth_token_secret');

    if (!token) return res.status(500).json({ error: 'Failed to get request token', raw: text });

    // Store token secret in Supabase instead of cookie
    await fetch(`${SB_URL}/rest/v1/oauth_temp`, {
      method: 'POST',
      headers: {
        'apikey': SB_KEY,
        'Authorization': `Bearer ${SB_KEY}`,
        'Content-Type': 'application/json',
        'Prefer': 'resolution=merge-duplicates'
      },
      body: JSON.stringify({ oauth_token: token, oauth_secret: secret, created_at: new Date().toISOString() })
    });

    res.redirect(302, `https://www.discogs.com/oauth/authorize?oauth_token=${token}`);
  } catch(e) {
    res.status(500).json({ error: e.message });
  }
}
