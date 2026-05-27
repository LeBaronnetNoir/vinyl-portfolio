export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const { title, artist, year, genre, label } = req.body || {};

  if (!title || !artist) {
    return res.status(400).json({ error: 'Missing title or artist', received: req.body });
  }

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-opus-4-5',
        max_tokens: 1000,
        messages: [{
          role: 'user',
          content: `Tu es un critique musical expert. Redige une fiche editoriale pour cet album vinyle en francais.

Album: "${title}"
Artiste: ${artist}
Annee: ${year || 'inconnue'}
Genre: ${genre || 'inconnu'}
Label: ${label || 'inconnu'}

Reponds UNIQUEMENT avec un objet JSON valide, sans markdown, sans backticks, sans texte avant ou apres:
{"intro":"2 phrases d accroche sur l album","contexte":"contexte historique et musical","son":"description du son et ambiance","anecdote":"une anecdote marquante","citation":"phrase evocatrice style critique","mots_cles":["mot1","mot2","mot3","mot4"]}`
        }]
      })
    });

    const raw = await response.text();
    let data;
    try { data = JSON.parse(raw); } catch(e) { return res.status(500).json({ error: 'Invalid JSON from Anthropic', raw }); }
    
    if (!data.content || !data.content[0]) {
      return res.status(500).json({ error: 'No content from API', data });
    }

    const text = data.content[0].text || '';
    const clean = text.replace(/```json/g, '').replace(/```/g, '').trim();
    
    try {
      const parsed = JSON.parse(clean);
      res.status(200).json(parsed);
    } catch(e) {
      res.status(500).json({ error: 'Parse error', text });
    }

  } catch(e) {
    res.status(500).json({ error: e.message });
  }
}
