export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
if (req.query.action === 'stats') {
    const SUPABASE_URL = process.env.SUPABASE_URL;
    const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY;
    try {
      const r = await fetch(`${SUPABASE_URL}/rest/v1/releases?select=median_price`, {
        headers: { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}` }
      });
      const rows = await r.json();
      const total_value = rows.reduce((s, x) => s + (x.median_price || 0), 0);
      return res.status(200).json({ total_value, count: rows.length });
    } catch(e) {
      return res.status(500).json({ error: e.message });
    }
  }
  const serverToken = process.env.DISCOGS_TOKEN;
  let path, discogsMethod, userToken;

  if (req.method === 'POST' && req.body?.path) {
    path = req.body.path;
    discogsMethod = req.body.method || 'POST';
    userToken = req.body.token || null;
  } else {
    path = req.query.path;
    discogsMethod = req.query.method || 'GET';
    userToken = req.query.token || null;
  }

  const token = (userToken && userToken !== serverToken) ? userToken : serverToken;

  if (!path) return res.status(400).json({ error: 'Missing path' });

  const url = `https://api.discogs.com/${path}`;

  try {
    const r = await fetch(url, {
      method: discogsMethod,
      headers: {
        'Authorization': `Discogs token=${token}`,
        'User-Agent': 'OSSATURE/1.0 +https://vinyl-portfolio-eight.vercel.app',
        'Content-Type': 'application/json'
      }
    });

    if (r.status === 204 || r.status === 201) {
      return res.status(r.status).json({ success: true });
    }

    const text = await r.text();
    try {
      res.status(r.status).json(JSON.parse(text));
    } catch(e) {
      res.status(r.status).json({ success: true });
    }
  } catch(e) {
    res.status(500).json({ error: e.message });
  }
}
