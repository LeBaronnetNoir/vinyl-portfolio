export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const token = process.env.DISCOGS_TOKEN;

  // Extraire path et method depuis query (GET) ou body (POST)
  let path, method;
  if (req.method === 'GET') {
    path = req.query.path;
    method = req.query.method || 'GET';
  } else {
    const body = req.body || {};
    path = body.path || req.query.path;
    method = body.method || req.method;
  }

  if (!path) return res.status(400).json({ error: 'Missing path' });

  const url = `https://api.discogs.com/${path}`;

  try {
    const fetchOpts = {
      method: method,
      headers: {
        'Authorization': `Discogs token=${token}`,
        'User-Agent': 'OSSATURE/1.0 +https://vinyl-portfolio-eight.vercel.app',
        'Content-Type': 'application/json'
      }
    };

    // Ajouter body pour POST/PUT si nécessaire
    if (['POST', 'PUT'].includes(method) && req.body?.data) {
      fetchOpts.body = JSON.stringify(req.body.data);
    }

    const r = await fetch(url, fetchOpts);
    
    // Certains endpoints retournent 204 (no content)
    if (r.status === 204 || r.status === 201) {
      return res.status(r.status).json({ success: true });
    }

    const text = await r.text();
    try {
      const data = JSON.parse(text);
      res.status(r.status).json(data);
    } catch(e) {
      res.status(r.status).json({ success: true, raw: text });
    }
  } catch(e) {
    res.status(500).json({ error: e.message });
  }
}
