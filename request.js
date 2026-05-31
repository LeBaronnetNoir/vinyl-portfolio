export default async function handler(req, res) {
  const CONSUMER_KEY = process.env.DISCOGS_CONSUMER_KEY;
  const CONSUMER_SECRET = process.env.DISCOGS_CONSUMER_SECRET;
  const CALLBACK_URL = 'https://vinyl-portfolio-eight.vercel.app/api/auth/callback';

  try {
    const r = await fetch('https://api.discogs.com/oauth/request_token', {
      method: 'GET',
      headers: {
        'Authorization': `OAuth oauth_consumer_key="${CONSUMER_KEY}",oauth_signature_method="PLAINTEXT",oauth_signature="${CONSUMER_SECRET}&",oauth_callback="${encodeURIComponent(CALLBACK_URL)}"`,
        'Content-Type': 'application/x-www-form-urlencoded',
        'User-Agent': 'OSSATURE/1.0'
      }
    });

    const text = await r.text();
    const params = new URLSearchParams(text);
    const token = params.get('oauth_token');
    const secret = params.get('oauth_token_secret');

    if (!token) return res.status(500).json({ error: 'Failed to get request token', raw: text });

    res.setHeader('Set-Cookie', `oauth_token_secret=${secret}; Path=/; HttpOnly; SameSite=Lax; Max-Age=600`);
    res.redirect(302, `https://www.discogs.com/oauth/authorize?oauth_token=${token}`);
  } catch(e) {
    res.status(500).json({ error: e.message });
  }
}
