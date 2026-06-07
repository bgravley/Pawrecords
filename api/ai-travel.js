// api/ai-travel.js
// Travel checklist generator with accurate usage logging

async function logUsage({ userId, userEmail, feature, model, inputTokens, outputTokens, destination, success, error }) {
  try {
    // gpt-4o-mini pricing (as of 2025)
    const costPer1kInput = 0.000150;
    const costPer1kOutput = 0.000600;
    const estimatedCost = (inputTokens / 1000 * costPer1kInput) + (outputTokens / 1000 * costPer1kOutput);
    const res = await fetch(`${process.env.SUPABASE_URL}/rest/v1/ai_usage_log`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': process.env.SUPABASE_SERVICE_KEY,
        'Authorization': `Bearer ${process.env.SUPABASE_SERVICE_KEY}`,
      },
      body: JSON.stringify({
        user_id: userId || null,
        user_email: userEmail || null,
        feature: 'travel_checklist',
        model,
        input_tokens: inputTokens,
        output_tokens: outputTokens,
        total_tokens: inputTokens + outputTokens,
        estimated_cost_usd: estimatedCost,
        pet_name: destination || null,
        success,
        error_message: error || null,
      })
    });
    if (!res.ok) console.error('Log usage failed:', await res.text());
  } catch (e) {
    console.error('Failed to log travel usage:', e.message);
  }
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).end();

  const { messages, userId, userEmail, destination } = req.body;

  if (!messages || !Array.isArray(messages)) {
    return res.status(400).json({ error: 'messages array required' });
  }

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return res.status(500).json({ error: 'OpenAI API key not configured' });

  try {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages,
        max_tokens: 2000,
        temperature: 0.1,
      }),
    });

    const data = await response.json();
    const usage = data.usage || {};

    if (!response.ok) {
      await logUsage({ userId, userEmail, model: 'gpt-4o-mini', inputTokens: 0, outputTokens: 0, destination, success: false, error: data.error?.message });
      return res.status(500).json({ error: data.error?.message || 'OpenAI request failed' });
    }

    await logUsage({
      userId, userEmail, model: 'gpt-4o-mini',
      inputTokens: usage.prompt_tokens || 0,
      outputTokens: usage.completion_tokens || 0,
      destination, success: true,
    });

    return res.status(200).json(data);

  } catch (err) {
    console.error('Travel handler error:', err.message);
    await logUsage({ userId, userEmail, model: 'gpt-4o-mini', inputTokens: 0, outputTokens: 0, destination, success: false, error: err.message });
    return res.status(500).json({ error: err.message });
  }
}
