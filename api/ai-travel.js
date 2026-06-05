export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).end();

  try {
    const { messages } = req.body;

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages,
        max_tokens: 2000,
        temperature: 0.1,
      }),
    });

    const data = await response.json();

    // Log the raw content so we can see what OpenAI returned
    const rawContent = data.choices?.[0]?.message?.content || '';
    console.log('OpenAI raw response:', rawContent.slice(0, 500));

    // Try to parse and validate it's a valid JSON array
    const start = rawContent.indexOf('[');
    const end = rawContent.lastIndexOf(']') + 1;
    if (start === -1 || end === 0) {
      console.error('No JSON array found in response:', rawContent.slice(0, 300));
    } else {
      try {
        const parsed = JSON.parse(rawContent.slice(start, end));
        console.log('Parsed items count:', parsed.length);
      } catch (e) {
        console.error('JSON parse error:', e.message, 'Content:', rawContent.slice(start, start + 200));
      }
    }

    return res.status(200).json(data);
  } catch (err) {
    console.error('Handler error:', err.message);
    return res.status(500).json({ error: err.message });
  }
}
