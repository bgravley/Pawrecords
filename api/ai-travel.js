// api/ai-travel.js
// Travel checklist generator with dual-LLM verification:
// - GPT-4o-mini generates the checklist
// - Claude claude-sonnet-4-20250514 reviews each item and flags uncertain ones
// Rate limits: Premium: 8 AI generations/month (overridable per user in Admin)

// ── Logging ────────────────────────────────────────────────────────────────
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

// ── Rate limit ─────────────────────────────────────────────────────────────
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

// ── User profile (tier + limit override) ──────────────────────────────────
async function getUserProfile(userId) {
  const res = await fetch(
    `${process.env.SUPABASE_URL}/rest/v1/profiles?id=eq.${userId}&select=subscription_tier,ai_travel_limit_override`,
    {
      headers: {
        'apikey': process.env.SUPABASE_SERVICE_KEY,
        'Authorization': `Bearer ${process.env.SUPABASE_SERVICE_KEY}`,
      }
    }
  );
  const data = await res.json();
  return {
    tier: data?.[0]?.subscription_tier || 'free',
    travelLimitOverride: data?.[0]?.ai_travel_limit_override ?? null,
  };
}

// ── Claude verification ────────────────────────────────────────────────────
// Takes the GPT-generated checklist JSON array and asks Claude to flag any
// items where specific details (deadlines, costs, URLs, form numbers) might
// be outdated or uncertain. Claude appends " (⚠️ Verify before travel)" to
// the title of any flagged items. If this step fails, we return the
// original checklist unchanged — the verification is additive only.
async function verifyWithClaude(checklistItems) {
  const anthropicKey = process.env.ANTHROPIC_API_KEY;
  if (!anthropicKey) return checklistItems; // skip if key not configured

  try {
    const verifyPrompt = `You are a pet travel compliance expert reviewing a generated travel checklist.

Review each item in the JSON array below. Pet travel regulations change frequently. For any item where you are NOT fully confident that the specific requirements, deadlines, costs, form numbers, URLs, or agency names are accurate and current, append " (⚠️ Verify before travel)" to that item's "title" field only.

Do not change any other fields. Do not add new items. Do not remove items.
Return ONLY the complete JSON array. No markdown, no explanation, no backticks.

CHECKLIST:
${JSON.stringify(checklistItems)}`;

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': anthropicKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 4096,
        messages: [{ role: 'user', content: verifyPrompt }],
      }),
    });

    if (!response.ok) return checklistItems; // fallback on error

    const data = await response.json();
    const text = data.content?.[0]?.text || '';
    const clean = text.replace(/```json|```/g, '').trim();

    const start = clean.indexOf('[');
    const end = clean.lastIndexOf(']') + 1;
    if (start === -1 || end === 0) return checklistItems;

    const verified = JSON.parse(clean.slice(start, end));
    return Array.isArray(verified) ? verified : checklistItems;

  } catch (e) {
    console.error('Claude verification failed, using original:', e.message);
    return checklistItems; // always fall back to original if anything goes wrong
  }
}

// ── Handler ────────────────────────────────────────────────────────────────
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

  // ── Auth / tier / rate limit ────────────────────────────────────────────
  if (userId) {
    const { tier, travelLimitOverride } = await getUserProfile(userId);
    const isPremium = tier === 'premium' || tier === 'lifetime';

    if (!isPremium) {
      return res.status(403).json({
        error: 'AI Travel Checklist is a Premium feature. Upgrade to generate requirements.',
        requiresUpgrade: true,
      });
    }

    const count = await checkRateLimit(userId);
    // Use per-user override if set, otherwise default 8
    const MONTHLY_LIMIT = travelLimitOverride !== null ? travelLimitOverride : 8;

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
    // ── Step 1: GPT-4o-mini generates the checklist ───────────────────────
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

    // ── Step 2: Parse the JSON checklist ─────────────────────────────────
    const rawText = data.choices?.[0]?.message?.content || '';
    const start = rawText.indexOf('[');
    const end = rawText.lastIndexOf(']') + 1;

    let checklistItems = null;
    if (start !== -1 && end > 0) {
      try {
        checklistItems = JSON.parse(rawText.slice(start, end));
      } catch (e) {
        // parse failed — return the original response so client handles it
      }
    }

    // ── Step 3: Claude verifies (only if we could parse the JSON) ─────────
    if (Array.isArray(checklistItems)) {
      const verified = await verifyWithClaude(checklistItems);
      // Replace the content in the response with the verified version
      data.choices[0].message.content = JSON.stringify(verified);
    }

    await logUsage({ userId, userEmail, model: 'gpt-4o-mini', inputTokens: usage.prompt_tokens || 0, outputTokens: usage.completion_tokens || 0, destination, success: true });

    return res.status(200).json(data);

  } catch (err) {
    await logUsage({ userId, userEmail, model: 'gpt-4o-mini', inputTokens: 0, outputTokens: 0, destination, success: false, error: err.message });
    return res.status(500).json({ error: err.message });
  }
}
