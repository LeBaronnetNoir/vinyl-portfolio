export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const { image } = req.body || {};
  if (!image) return res.status(400).json({ error: 'No image provided' });

  try {
    // Ask Claude to identify the album from the photo
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 500,
        messages: [{
          role: 'user',
          content: [
            {
              type: 'image',
              source: {
                type: 'base64',
                media_type: 'image/jpeg',
                data: image
              }
            },
            {
              type: 'text',
              text: `Identifie cet album vinyle sur la photo. Réponds UNIQUEMENT en JSON valide sans markdown:
{"artist":"nom de l artiste","title":"titre de l album","year":"année approximative","genre":"genre musical","confidence":"high/medium/low"}`
            }
          ]
        }]
      })
    });

    const data = await response.json();
    if (!data.content?.[0]?.text) {
      return res.status(500).json({ error: 'No response from Claude', data });
    }

    const text = data.content[0].text.replace(/```json|```/g, '').trim();
    const parsed = JSON.parse(text);
    res.status(200).json(parsed);

  } catch(e) {
    res.status(500).json({ error: e.message });
  }
}
