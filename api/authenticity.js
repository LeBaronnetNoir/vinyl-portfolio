export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const { release_id, current_price, median_price, lowest_price, highest_price, num_for_sale, title, artist, year, country, label } = req.body || {};

  if (!release_id) return res.status(400).json({ error: 'Missing release_id' });

  let score = 100;
  const flags = [];
  const positives = [];

  // 1. Prix cohérence
  if (median_price && current_price) {
    const ratio = current_price / median_price;
    if (ratio > 2.5) { score -= 25; flags.push({ icon: '⚠️', text: `Prix ${Math.round((ratio-1)*100)}% au-dessus de la médiane`, severity: 'high' }); }
    else if (ratio > 1.5) { score -= 10; flags.push({ icon: '⚡', text: `Prix ${Math.round((ratio-1)*100)}% au-dessus de la médiane`, severity: 'medium' }); }
    else if (ratio < 0.4) { score -= 15; flags.push({ icon: '⚠️', text: 'Prix anormalement bas — vérifier l\'état', severity: 'high' }); }
    else { positives.push({ icon: '✓', text: 'Prix cohérent avec le marché' }); }
  }

  // 2. Volume de ventes
  if (num_for_sale !== null && num_for_sale !== undefined) {
    if (num_for_sale === 0) { score -= 20; flags.push({ icon: '⚠️', text: 'Aucune annonce active — marché illiquide', severity: 'high' }); }
    else if (num_for_sale < 3) { score -= 10; flags.push({ icon: '⚡', text: `Seulement ${num_for_sale} annonce(s) — données limitées`, severity: 'medium' }); }
    else if (num_for_sale > 20) { positives.push({ icon: '✓', text: `${num_for_sale} annonces actives — marché liquide` }); }
  }

  // 3. Écart prix bas/haut
  if (lowest_price && highest_price) {
    const spread = highest_price / lowest_price;
    if (spread > 10) { score -= 15; flags.push({ icon: '⚡', text: `Écart de prix très large (×${spread.toFixed(1)}) — pressages variables`, severity: 'medium' }); }
    else if (spread > 5) { score -= 5; flags.push({ icon: 'ℹ️', text: `Écart de prix notable (×${spread.toFixed(1)})`, severity: 'low' }); }
    else { positives.push({ icon: '✓', text: 'Prix stables sur ce pressage' }); }
  }

  // 4. Ancienneté pressage
  if (year) {
    const age = new Date().getFullYear() - parseInt(year);
    if (age > 40) { positives.push({ icon: '✓', text: `Pressage vintage ${year} — valeur historique` }); score += 5; }
    else if (age > 20) { positives.push({ icon: '✓', text: `Pressage établi (${year})` }); }
  }

  // 5. Pays pressage
  if (country) {
    const premiumCountries = ['UK', 'US', 'Germany', 'Japan'];
    if (premiumCountries.includes(country)) {
      positives.push({ icon: '✓', text: `Pressage ${country} — origine premium` });
      score += 5;
    }
  }

  // Ask Claude for final analysis
  try {
    const prompt = `Tu es un expert en authentification de vinyles. Analyse ces données et donne une évaluation courte en français.

Album: "${title}" par ${artist} (${year}, ${country})
Label: ${label}
Prix actuel: ${current_price}€ | Médian: ${median_price}€ | Plus bas: ${lowest_price}€ | Plus haut: ${highest_price}€
Annonces actives: ${num_for_sale}

Réponds UNIQUEMENT en JSON:
{"verdict":"Fiable"|"Incertain"|"Suspect","conseil":"une phrase de conseil pratique pour l'acheteur","detail":"une phrase sur ce qui justifie le verdict"}`;

    const r = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-api-key': process.env.ANTHROPIC_API_KEY, 'anthropic-version': '2023-06-01' },
      body: JSON.stringify({ model: 'claude-haiku-4-5-20251001', max_tokens: 300, messages: [{ role: 'user', content: prompt }] })
    });
    const d = await r.json();
    const text = d.content?.[0]?.text?.replace(/```json|```/g,'').trim();
    const ai = JSON.parse(text);

    score = Math.max(0, Math.min(100, score));
    res.status(200).json({ score, flags, positives, ai, release_id });
  } catch(e) {
    score = Math.max(0, Math.min(100, score));
    res.status(200).json({ score, flags, positives, ai: null, release_id });
  }
}
