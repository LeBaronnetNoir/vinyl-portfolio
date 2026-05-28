export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const SUPABASE_URL = process.env.SUPABASE_URL || 'https://vtfuzcxkdrnkbonrlxbk.supabase.co';
  const SUPABASE_KEY = process.env.SUPABASE_KEY;
  const DISCOGS_TOKEN = process.env.DISCOGS_TOKEN;

  try {
    // Get price history from last 30 days
    const since = new Date();
    since.setDate(since.getDate() - 30);

    const histRes = await fetch(
      `${SUPABASE_URL}/rest/v1/price_history?recorded_at=gte.${since.toISOString()}&order=recorded_at.asc&limit=10000`,
      { headers: { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}` } }
    );
    const history = await histRes.json();

    // Group by release_id and compute price change
    const byRelease = {};
    for (const row of history) {
      if (!byRelease[row.release_id]) byRelease[row.release_id] = [];
      byRelease[row.release_id].push({ price: row.price || row.median_price, date: row.recorded_at });
    }

    const gainers = [], undervalued = [];
    for (const [id, pts] of Object.entries(byRelease)) {
      if (pts.length < 2) continue;
      const first = pts[0].price, last = pts[pts.length-1].price;
      if (!first || !last) continue;
      const change = ((last - first) / first * 100).toFixed(1);
      gainers.push({ release_id: id, price: last, change: parseFloat(change), pts: pts.length });
    }

    gainers.sort((a, b) => b.change - a.change);

    // Get release info for top 20
    const top = gainers.slice(0, 20);
    const enriched = [];
    for (const g of top.slice(0, 10)) {
      try {
        const r = await fetch(`https://api.discogs.com/releases/${g.release_id}`, {
          headers: { 'Authorization': `Discogs token=${DISCOGS_TOKEN}`, 'User-Agent': 'VinylPortfolio/1.0' }
        });
        const d = await r.json();
        enriched.push({
          ...g,
          title: d.title || 'Unknown',
          artist: d.artists?.[0]?.name || 'Unknown',
          year: d.year,
          cover: d.images?.[0]?.uri || null,
          genres: d.genres || [],
          country: d.country || ''
        });
        await new Promise(res => setTimeout(res, 300));
      } catch(e) { enriched.push({ ...g, title: 'Unknown', artist: 'Unknown' }); }
    }

    res.status(200).json({
      top_gainers: enriched,
      total_tracked: Object.keys(byRelease).length,
      generated_at: new Date().toISOString()
    });

  } catch(e) {
    res.status(500).json({ error: e.message });
  }
}
