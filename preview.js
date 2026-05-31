export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const { artist, title, track } = req.query;
  if (!artist || !track) return res.status(400).json({ error: 'Missing params' });

  try {
    const q = encodeURIComponent(`${artist} ${track}`);
    const r = await fetch(`https://api.deezer.com/search?q=${q}&limit=5`);
    const data = await r.json();
    const results = data.data || [];

    // Find best match
    const match = results.find(item => {
      const t = item.title?.toLowerCase() || '';
      const trackLower = track.toLowerCase();
      return t.includes(trackLower.substring(0, 10)) || trackLower.includes(t.substring(0, 10));
    }) || results[0];

    if (!match || !match.preview) {
      return res.status(404).json({ error: 'No preview found' });
    }

    res.status(200).json({
      preview_url: match.preview,
      title: match.title,
      artist: match.artist?.name,
      duration: match.duration,
      cover: match.album?.cover_small
    });
  } catch(e) {
    res.status(500).json({ error: e.message });
  }
}
