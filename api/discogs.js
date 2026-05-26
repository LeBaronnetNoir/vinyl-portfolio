export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const { path } = req.query;
  if (!path) return res.status(400).json({ error: 'Missing path' });

  const token = process.env.DISCOGS_TOKEN;
  const url = `https://api.discogs.com/${path}`;

  try {
    const r = await fetch(url, {
      headers: {
        'Authorization': `Discogs token=${token}`,
        'User-Agent': 'VinylPortfolio/1.0'
      }
    });
    const data = await r.json();
    res.status(r.status).json(data);
  } catch(e) {
    res.status(500).json({ error: e.message });
  }
}
