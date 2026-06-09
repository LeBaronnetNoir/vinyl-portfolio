export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  // Utiliser le token de l'utilisateur si fourni, sinon le token serveur
  const serverToken = process.env.DISCOGS_TOKEN;
  let token = serverToken;

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

  // Si un token utilisateur est fourni, l'utiliser pour les actions sur sa collection
  if (userToken && userToken !== serverToken) {
    token = userToken;
  }

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
