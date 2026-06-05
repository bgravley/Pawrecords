// Log AI usage to Supabase
async function logUsage({ userId, userEmail, petName, feature, model, inputTokens, outputTokens, success, error }) {
  try {
    const costPer1kInput = 0.0025;  // gpt-4o input cost per 1k tokens
    const costPer1kOutput = 0.01;   // gpt-4o output cost per 1k tokens
    const estimatedCost = (inputTokens / 1000 * costPer1kInput) + (outputTokens / 1000 * costPer1kOutput);

    await fetch(`${process.env.SUPABASE_URL}/rest/v1/ai_usage_log`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': process.env.SUPABASE_SERVICE_KEY,
        'Authorization': `Bearer ${process.env.SUPABASE_SERVICE_KEY}`,
      },
      body: JSON.stringify({
        user_id: userId || null,
        user_email: userEmail || null,
        feature,
        model,
        input_tokens: inputTokens,
        output_tokens: outputTokens,
        total_tokens: inputTokens + outputTokens,
        estimated_cost_usd: estimatedCost,
        pet_name: petName || null,
        success,
        error_message: error || null,
      })
    });
  } catch (e) {
    console.error('Failed to log usage:', e.message);
  }
}

// api/ai-scan.js
// Vercel serverless function for AI document scanning (vision)
export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const { imageBase64, mediaType, userId, userEmail, petName } = req.body;
    if (!imageBase64) return res.status(400).json({ error: 'No image data provided' });

    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) return res.status(500).json({ error: 'OpenAI API key not configured' });

    const prompt = `You are a veterinary record parser. Analyze this vet document image and extract ALL information visible. Return ONLY raw JSON with no markdown, no code fences, no explanation — just the JSON object.

{
  "visitDate": "YYYY-MM-DD or null",
  "vetName": "string or null",
  "clinicName": "string or null",
  "reason": "string or null",
  "diagnosis": "string or null",
  "treatment": "string or null",
  "weight": number or null,
  "cost": number or null,
  "notes": "string or null",
  "vaccines": [
    {
      "name": "string",
      "dateGiven": "YYYY-MM-DD or null",
      "nextDue": "YYYY-MM-DD or null",
      "lotNumber": "string or null",
      "type": "core or optional"
    }
  ],
  "medications": [
    {
      "name": "string",
      "dosage": "string or null",
      "frequency": "string or null",
      "reason": "string or null"
    }
  ]
}

Rules:
- Rabies, DHPP, DA2PP = core. All others = optional.
- If nextDue is not shown, calculate it: Rabies=12 months, DHPP/DA2PP=36 months, all others=12 months from dateGiven.
- Extract weight in lbs as a number only (no units).
- Extract cost/total as a number only (no $ sign).
- Return only the JSON object. Nothing else.`;

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o',
        max_tokens: 1500,
        messages: [
          {
            role: 'user',
            content: [
              {
                type: 'image_url',
                image_url: {
                  url: `data:${mediaType};base64,${imageBase64}`,
                  detail: 'high'
                }
              },
              {
                type: 'text',
                text: prompt
              }
            ]
          }
        ]
      })
    });

    if (!response.ok) {
      const errData = await response.json();
      console.error('OpenAI error:', errData);
      return res.status(500).json({ error: errData.error?.message || 'OpenAI request failed' });
    }

    const data = await response.json();
    const usage = data.usage || {};
    console.log('AI Scan - tokens used:', usage);

    const text = data.choices?.[0]?.message?.content || '';
    console.log('AI Scan - raw response:', text.slice(0, 200));

    // Clean and parse JSON
    const clean = text.replace(/```json|```/g, '').trim();

    let parsed;
    try {
      parsed = JSON.parse(clean);
    } catch (e) {
      console.error('JSON parse failed:', clean);
      // Log failed attempt
      await logUsage({ userId, userEmail, petName, feature: 'document_scan', model: 'gpt-4o',
        inputTokens: usage.prompt_tokens || 0, outputTokens: usage.completion_tokens || 0,
        success: false, error: 'JSON parse failed' });
      return res.status(500).json({ error: 'AI returned invalid JSON. Try a clearer photo.' });
    }

    // Log successful usage
    await logUsage({ userId, userEmail, petName, feature: 'document_scan', model: 'gpt-4o',
      inputTokens: usage.prompt_tokens || 0, outputTokens: usage.completion_tokens || 0,
      success: true });

    return res.status(200).json({ extracted: parsed });

  } catch (err) {
    console.error('AI Scan error:', err);
    return res.status(500).json({ error: err.message || 'Scan failed' });
  }
}
