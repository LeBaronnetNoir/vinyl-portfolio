export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const { image, mode } = req.body || {};
  if (!image) return res.status(400).json({ error: 'No image provided' });

  const isMacaron = mode === 'macaron';

  const prompt = isMacaron
    ? `You are a world-class vinyl record expert and Discogs specialist. Analyze this vinyl label (macaron) with extreme precision.

Extract EVERY visible detail:
1. Label name and exact color/design (e.g. "Atlantic - orange with white logo", "Parlophone - black with silver ring")
2. Artist name EXACTLY as printed
3. Album/record title EXACTLY as printed
4. Catalog number (e.g. "SD 2-704", "SKAO-391", "2C 064-96157")
5. Matrix/runout code if visible (e.g. "A//1", "XZAL-1234-A", "1C 064-96 157 A")
6. Country of manufacture (look for "Made in...", "Printed in...", "Manufactured in...")
7. Year or copyright date (look for ℗ or © symbol followed by year)
8. Original vs reissue indicators (look for "Original", "RE-1", "MO" stamp, or matrix suffix like "-1", "-2")
9. Any special markings: "PROMO", "DJ COPY", "STEREO", "MONO", "33 1/3 RPM"
10. Publisher/distributor info if visible

Then determine the most likely Discogs release_id by analyzing all details.

Respond ONLY in valid JSON without markdown:
{"artist":"exact artist name","title":"exact album title","year":"year or period","label":"label name","label_color":"exact label color description","catalog_number":"catalog number or null","matrix_code":"full matrix code or null","country":"country of manufacture","pressing_type":"Original|Reissue|Promo|Unknown","pressing_details":"one detailed sentence describing this specific pressing","confidence":"certain|high|medium|low","release_id":null,"notes":"any important observations about rarity or value"}`
    : `You are a vinyl record expert. Analyze this album cover precisely.
Identify:
1. Artist name exactly as shown
2. Album title exactly as shown
3. Approximate year
4. Musical genre
5. Label if visible
6. Any catalog number visible

Respond ONLY in valid JSON without markdown:
{"artist":"artist name","title":"album title","year":"approximate year","genre":"musical genre","label":"label if visible or null","catalog_number":"catalog number or null","confidence":"high|medium|low"}`;

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-6',
        max_tokens: 800,
        messages: [{
          role: 'user',
          content: [
            { type: 'image', source: { type: 'base64', media_type: 'image/jpeg', data: image } },
            { type: 'text', text: prompt }
          ]
        }]
      })
    });

    const data = await response.json();
    if (!data.content?.[0]?.text) return res.status(500).json({ error: 'No response', data });

    const text = data.content[0].text.replace(/```json|```/g, '').trim();
    const parsed = JSON.parse(text);

    // Chercher le release_id sur Discogs si pas trouvé par Claude
    if (!parsed.release_id && parsed.artist && parsed.title) {
      try {
        const token = process.env.DISCOGS_TOKEN;
        const q = encodeURIComponent(`${parsed.artist} ${parsed.title} ${parsed.catalog_number || ''}`);
        const searchRes = await fetch(
          `https://api.discogs.com/database/search?q=${q}&type=release&per_page=5&format=vinyl`,
          { headers: { 'Authorization': `Discogs token=${token}`, 'User-Agent': 'OSSATURE/1.0' } }
        );
        const searchData = await searchRes.json();
        const results = searchData.results || [];

        // Trouver le meilleur match (pays + année + catalog)
        const scored = results.map(r => {
          let score = 0;
          if (parsed.year && String(r.year || '') === String(parsed.year)) score += 3;
          if (parsed.country && (r.country || '').toLowerCase().includes(parsed.country.toLowerCase())) score += 3;
          if (parsed.catalog_number && (r.catno || '').toLowerCase().includes(parsed.catalog_number.toLowerCase())) score += 5;
          if (parsed.label && (r.label?.[0] || '').toLowerCase().includes(parsed.label.toLowerCase())) score += 2;
          return { ...r, _score: score };
        }).sort((a, b) => b._score - a._score);

        if (scored.length > 0 && scored[0]._score >= 3) {
          parsed.release_id = scored[0].id;
          parsed.discogs_url = `https://www.discogs.com/release/${scored[0].id}`;
        }
      } catch(searchErr) {
        // Silently fail — release_id stays null
      }
    }

    res.status(200).json({ ...parsed, mode: isMacaron ? 'macaron' : 'cover' });
  } catch(e) {
    res.status(500).json({ error: e.message });
  }
}
