export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const { title, artist, year, genre, label } = req.body || {};
  if (!title || !artist) return res.status(400).json({ error: 'Missing title or artist' });

  try {
    const prompt = 'Tu es un critique musical expert. Redige une fiche editoriale pour cet album vinyle en francais.\n\nAlbum: "' + title + '"\nArtiste: ' + artist + '\nAnnee: ' + (year || 'inconnue') + '\nGenre: ' + (genre || 'inconnu') + '\nLabel: ' + (label || 'inconnu') + '\n\nReponds UNIQUEMENT avec un objet JSON valide, sans markdown:\n{"intro":"2 phrases daccroche","contexte":"contexte historique et musical","son":"description du son et ambiance","anecdote":"une anecdote marquante","citation":"phrase evocatrice style critique","mots_cles":["mot1","mot2","mot3","mot4"]}';

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
        messages: [{ role: 'user', content: prompt }]
      })
    });

    const data = await response.json();
    if (!data.content?.[0]?.text) return res.status(500).json({ error: 'No content from API' });

    const text = data.content[0].text.replace(/```json/g, '').replace(/```/g, '').trim();
    try {
      res.status(200).json(JSON.parse(text));
    } catch(e) {
      res.status(500).json({ error: 'Parse error', text });
    }
  } catch(e) {
    res.status(500).json({ error: e.message });
  }
}
