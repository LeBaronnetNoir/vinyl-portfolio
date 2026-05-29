export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const { image, mode } = req.body || {};
  if (!image) return res.status(400).json({ error: 'No image provided' });

  const isMacaron = mode === 'macaron';

  const prompt = isMacaron
    ? `Tu es un expert en pressages vinyle. Analyse ce macaron (label central du vinyle) en detail.

Cherche et identifie:
1. La couleur et le design du label (ex: Atlantic orange, Parlophone rouge, etc.)
2. Le nom du label imprime
3. Les codes matrice si visibles (ex: A//1, XZAL-1234, etc.)
4. L'artiste et le titre si imprimes
5. L'annee ou la periode approximative selon le design
6. Le pays de fabrication si mentionne
7. Si c'est un original ou une reissue selon les indices visuels

Reponds UNIQUEMENT en JSON valide sans markdown:
{"artist":"nom artiste ou inconnu","title":"titre ou inconnu","year":"annee ou periode","label":"nom du label","label_color":"couleur du label","matrix_code":"code matrice ou null","country":"pays ou inconnu","pressing_type":"Original|Reissue|Unknown","pressing_details":"description du pressage en 1 phrase","confidence":"high|medium|low","notes":"observations importantes sur ce pressage"}`
    : `Tu es un expert en identification d album vinyle. Analyse cette pochette.

Identifie:
1. L artiste
2. Le titre de l album
3. L annee approximative
4. Le genre musical
5. Le label si visible

Reponds UNIQUEMENT en JSON valide sans markdown:
{"artist":"nom de l artiste","title":"titre de l album","year":"annee approximative","genre":"genre musical","label":"label si visible ou null","confidence":"high|medium|low"}`;

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 600,
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
    res.status(200).json({ ...parsed, mode: isMacaron ? 'macaron' : 'cover' });

  } catch(e) {
    res.status(500).json({ error: e.message });
  }
}
