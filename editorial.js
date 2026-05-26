export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const { title, artist, year, genre, label } = req.body;

  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': process.env.ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01'
    },
    body: JSON.stringify({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 1000,
      messages: [{
        role: 'user',
        content: `Tu es un critique musical expert. Rédige une fiche éditoriale courte et élégante pour cet album vinyle en français.

Album: "${title}"
Artiste: ${artist}
Année: ${year}
Genre: ${genre}
Label: ${label}

Réponds UNIQUEMENT en JSON valide avec exactement cette structure (pas de markdown, pas de backticks):
{"intro":"2 phrases d accroche sur l album et son importance","contexte":"1-2 phrases sur le contexte historique et musical","son":"1-2 phrases décrivant le son et l ambiance","anecdote":"1 anecdote ou fait marquant","citation":"une courte phrase évocatrice style critique musical","mots_cles":["mot1","mot2","mot3","mot4"]}`
      }]
    })
  });

  const data = await response.json();
  const text = data.content?.[0]?.text || '';
  const clean = text.replace(/```json|```/g, '').trim();
  try {
    res.status(200).json(JSON.parse(clean));
  } catch(e) {
    res.status(500).json({ error: 'Parse error', raw: text });
  }
}
