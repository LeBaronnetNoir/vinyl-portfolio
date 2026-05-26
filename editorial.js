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
        content: `Tu es un critique musical expert. Rédige une fiche éditoriale pour cet album vinyle en français.

Album: "${title}"
Artiste: ${artist}
Année: ${year}
Genre: ${genre}
Label: ${label}

Réponds UNIQUEMENT avec un objet JSON valide, sans markdown, sans backticks, sans texte avant ou après:
{"intro":"2 phrases d accroche","contexte":"contexte historique et musical","son":"description du son et ambiance","anecdote":"une anecdote marquante","citation":"phrase évocatrice style critique","mots_cles":["mot1","mot2","mot3","mot4"]}`
      }]
    })
  });

  const data = await response.json();
  
  if (!data.content || !data.content[0]) {
    return res.status(500).json({ error: 'No content from API', data });
  }

  const text = data.content[0].text || '';
  const clean = text.replace(/```json/g, '').replace(/```/g, '').trim();
  
  try {
    const parsed = JSON.parse(clean);
    res.status(200).json(parsed);
  } catch(e) {
    res.status(500).json({ error: 'Parse error', raw: text });
  }
}
