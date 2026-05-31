const SB_URL = process.env.SUPABASE_URL;
const SB_KEY = process.env.SUPABASE_KEY;

async function sb(path, opts = {}) {
  const r = await fetch(`${SB_URL}/rest/v1${path}`, {
    ...opts,
    headers: {
      'apikey': SB_KEY,
      'Authorization': `Bearer ${SB_KEY}`,
      'Content-Type': 'application/json',
      'Prefer': opts.prefer || '',
      ...opts.headers
    }
  });
  if (r.status === 204 || r.status === 201) return null;
  return r.json();
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const { action } = req.query;

  // GET leaderboard
  if (req.method === 'GET' && action === 'leaderboard') {
    const data = await sb('/public_collections?is_public=eq.true&order=total_value.desc&limit=20');
    return res.status(200).json(data || []);
  }

  // GET user profile
  if (req.method === 'GET' && action === 'profile') {
    const { username } = req.query;
    const data = await sb(`/public_collections?discogs_username=eq.${username}`);
    return res.status(200).json(data?.[0] || null);
  }

  // POST update profile
  if (req.method === 'POST' && action === 'update') {
    const { username, total_value, total_releases, top_genre, badge } = req.body;
    await sb('/public_collections', {
      method: 'POST',
      prefer: 'resolution=merge-duplicates',
      body: JSON.stringify({
        discogs_username: username,
        total_value,
        total_releases,
        top_genre,
        badge,
        updated_at: new Date().toISOString()
      })
    });
    return res.status(200).json({ success: true });
  }

  // POST like
  if (req.method === 'POST' && action === 'like') {
    const { from_user, to_user } = req.body;
    try {
      await sb('/collection_likes', {
        method: 'POST',
        prefer: 'resolution=ignore-duplicates',
        body: JSON.stringify({ from_user, to_user })
      });
      return res.status(200).json({ success: true });
    } catch(e) {
      return res.status(200).json({ success: false });
    }
  }

  // GET likes count
  if (req.method === 'GET' && action === 'likes') {
    const { username } = req.query;
    const data = await sb(`/collection_likes?to_user=eq.${username}&select=count`);
    return res.status(200).json({ count: data?.[0]?.count || 0 });
  }

  res.status(404).json({ error: 'Unknown action' });
}
