// api/ai-travel.js
// Travel checklist generator with rate limiting:
// - Premium: 8 AI generations/month
// - Free: 0 (travel AI is premium only)

async function logUsage({ userId, userEmail, feature, model, inputTokens, outputTokens, destination, success, error }) {
  try {
    const costPer1kInput = 0.000150;
    const costPer1kOutput = 0.000600;
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
  } catch (e) {
    console.error('Failed to log travel usage:', e.message);
  }
}

async function checkRateLimit(userId) {
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
  const res = await fetch(
    `${process.env.SUPABASE_URL}/rest/v1/ai_usage_log?user_id=eq.${userId}&feature=eq.travel_checklist&success=eq.true&created_at=gte.${monthStart}&select=id`,
    {
      headers: {
        'apikey': process.env.SUPABASE_SERVICE_KEY,
        'Authorization': `Bearer ${process.env.SUPABASE_SERVICE_KEY}`,
        'Prefer': 'count=exact',
        'Range-Unit': 'items',
        'Range': '0-0',
      }
    }
  );
  const countHeader = res.headers.get('content-range');
  return countHeader ? parseInt(countHeader.split('/')[1]) || 0 : 0;
}

async function getUserTier(userId) {
  const res = await fetch(
    `${process.env.SUPABASE_URL}/rest/v1/profiles?id=eq.${userId}&select=subscription_tier`,
    {
      headers: {
        'apikey': process.env.SUPABASE_SERVICE_KEY,
        'Authorization': `Bearer ${process.env.SUPABASE_SERVICE_KEY}`,
      }
    }
  );
  const data = await res.json();
  return data?.[0]?.subscription_tier || 'free';
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

  // Rate limit check
  if (userId) {
    const tier = await getUserTier(userId);
    const isPremium = tier === 'premium' || tier === 'lifetime';

    if (!isPremium) {
      return res.status(403).json({
        error: 'AI Travel Checklist is a Premium feature. Upgrade to generate requirements.',
        requiresUpgrade: true,
      });
    }

    const count = await checkRateLimit(userId);
    const MONTHLY_LIMIT = 8;

    if (count >= MONTHLY_LIMIT) {
      return res.status(429).json({
        error: `Monthly travel checklist limit reached (${MONTHLY_LIMIT}/month). Resets on the 1st of next month.`,
        rateLimitExceeded: true,
        generationsUsed: count,
        generationsLimit: MONTHLY_LIMIT,
      });
    }
  }

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return res.status(500).json({ error: 'OpenAI API key not configured' });

  try {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
      body: JSON.stringify({ model: 'gpt-4o-mini', messages, max_tokens: 2000, temperature: 0.1 }),
    });

    const data = await response.json();
    const usage = data.usage || {};

    if (!response.ok) {
      await logUsage({ userId, userEmail, model: 'gpt-4o-mini', inputTokens: 0, outputTokens: 0, destination, success: false, error: data.error?.message });
      return res.status(500).json({ error: data.error?.message || 'OpenAI request failed' });
    }

    await logUsage({ userId, userEmail, model: 'gpt-4o-mini', inputTokens: usage.prompt_tokens || 0, outputTokens: usage.completion_tokens || 0, destination, success: true });

    return res.status(200).json(data);

  } catch (err) {
    await logUsage({ userId, userEmail, model: 'gpt-4o-mini', inputTokens: 0, outputTokens: 0, destination, success: false, error: err.message });
    return res.status(500).json({ error: err.message });
  }
}
