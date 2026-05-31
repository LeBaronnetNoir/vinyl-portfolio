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

  // GET messages for a room
  if (req.method === 'GET') {
    const { room = 'general', since } = req.query;
    let path = `/chat_messages?room=eq.${room}&order=created_at.asc&limit=50`;
    if (since) path += `&created_at=gt.${since}`;
    const data = await sb(path);
    return res.status(200).json(data || []);
  }

  // POST new message
  if (req.method === 'POST') {
    const { username, message, room = 'general' } = req.body;
    if (!username || !message) return res.status(400).json({ error: 'Missing fields' });
    if (message.length > 500) return res.status(400).json({ error: 'Message too long' });
    
    await sb('/chat_messages', {
      method: 'POST',
      prefer: 'return=minimal',
      body: JSON.stringify({ username, message: message.trim(), room })
    });
    return res.status(200).json({ success: true });
  }

  res.status(405).json({ error: 'Method not allowed' });
}
