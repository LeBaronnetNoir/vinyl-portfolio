export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const { master_id, release_id } = req.query;
  const TOKEN = process.env.DISCOGS_TOKEN;

  try {
    // Get master release to find all versions
    let masterId = master_id;
    
    if (!masterId && release_id) {
      const r = await fetch(`https://api.discogs.com/releases/${release_id}`, {
        headers: { 'Authorization': `Discogs token=${TOKEN}`, 'User-Agent': 'VinylPortfolio/1.0' }
      });
      const d = await r.json();
      masterId = d.master_id;
    }

    if (!masterId) return res.status(404).json({ error: 'No master release found' });

    // Get all versions
    const versionsRes = await fetch(
      `https://api.discogs.com/masters/${masterId}/versions?per_page=20&sort=released`,
      { headers: { 'Authorization': `Discogs token=${TOKEN}`, 'User-Agent': 'VinylPortfolio/1.0' } }
    );
    const versionsData = await versionsRes.json();
    const versions = (versionsData.versions || []).filter(v => v.format?.includes('Vinyl') || v.format?.includes('LP'));

    // Get stats for top 8 versions
    const enriched = [];
    for (const v of versions.slice(0, 8)) {
      try {
        await new Promise(r => setTimeout(r, 300));
        const statsRes = await fetch(`https://api.discogs.com/marketplace/stats/${v.id}`, {
          headers: { 'Authorization': `Discogs token=${TOKEN}`, 'User-Agent': 'VinylPortfolio/1.0' }
        });
        const stats = await statsRes.json();
        
        // Rarity score based on num_for_sale and community want
        const numForSale = stats.num_for_sale || 0;
        const rarityScore = numForSale === 0 ? 100 : numForSale < 5 ? 85 : numForSale < 20 ? 60 : numForSale < 50 ? 40 : 20;
        
        // Value score
        const median = stats.median_price?.value || 0;
        const lowest = stats.lowest_price?.value || 0;

        // Premium country bonus
        const premiumCountries = { 'Japan': 30, 'UK': 20, 'Germany': 15, 'US': 10 };
        const countryBonus = premiumCountries[v.country] || 0;

        // First press bonus
        const isFirst = v.released && parseInt(v.released) <= 1975;
        const firstBonus = isFirst ? 20 : 0;

        const collectScore = Math.min(100, rarityScore + countryBonus + firstBonus);

        enriched.push({
          id: v.id,
          title: v.title,
          country: v.country || '—',
          year: v.released || '—',
          label: v.label || '—',
          format: v.format || 'Vinyl',
          cover: v.thumb || null,
          median_price: median,
          lowest_price: lowest,
          num_for_sale: numForSale,
          rarity_score: rarityScore,
          collector_score: collectScore,
          is_first_press: isFirst,
          catno: v.catno || '—'
        });
      } catch(e) {
        enriched.push({ id: v.id, title: v.title, country: v.country || '—', year: v.released || '—', label: v.label || '—', format: v.format || 'Vinyl', cover: v.thumb || null, median_price: 0, lowest_price: 0, num_for_sale: 0, rarity_score: 0, collector_score: 0 });
      }
    }

    enriched.sort((a, b) => b.collector_score - a.collector_score);
    res.status(200).json({ master_id: masterId, versions: enriched, total: versionsData.pagination?.items || enriched.length });

  } catch(e) {
    res.status(500).json({ error: e.message });
  }
}
