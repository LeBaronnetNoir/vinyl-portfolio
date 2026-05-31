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

  // ── COMMUNITY ──
  if (action === 'leaderboard') {
    const data = await sb('/public_collections?is_public=eq.true&order=total_value.desc&limit=20');
    return res.status(200).json(data || []);
  }

  if (action === 'profile') {
    const { username } = req.query;
    const data = await sb(`/public_collections?discogs_username=eq.${username}`);
    return res.status(200).json(data?.[0] || null);
  }

  if (action === 'update' && req.method === 'POST') {
    const { username, total_value, total_releases, top_genre, badge } = req.body;
    await sb('/public_collections', {
      method: 'POST',
      prefer: 'resolution=merge-duplicates',
      body: JSON.stringify({ discogs_username: username, total_value, total_releases, top_genre, badge, updated_at: new Date().toISOString() })
    });
    return res.status(200).json({ success: true });
  }

  if (action === 'like' && req.method === 'POST') {
    const { from_user, to_user } = req.body;
    try {
      await sb('/collection_likes', { method: 'POST', prefer: 'resolution=ignore-duplicates', body: JSON.stringify({ from_user, to_user }) });
      return res.status(200).json({ success: true });
    } catch(e) { return res.status(200).json({ success: false }); }
  }

  // ── CHAT ──
  if (action === 'messages' && req.method === 'GET') {
    const { room = 'general', since } = req.query;
    let path = `/chat_messages?room=eq.${room}&order=created_at.asc&limit=50`;
    if (since) path += `&created_at=gt.${since}`;
    const data = await sb(path);
    return res.status(200).json(data || []);
  }

  if (action === 'send' && req.method === 'POST') {
    const { username, message, room = 'general' } = req.body;
    if (!username || !message) return res.status(400).json({ error: 'Missing fields' });
    if (message.length > 500) return res.status(400).json({ error: 'Message too long' });
    await sb('/chat_messages', { method: 'POST', prefer: 'return=minimal', body: JSON.stringify({ username, message: message.trim(), room }) });
    return res.status(200).json({ success: true });
  }

  res.status(404).json({ error: 'Unknown action' });
}
