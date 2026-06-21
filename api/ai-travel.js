// api/ai-travel.js
// Travel checklist generator with dual-LLM verification:
// - Claude (Sonnet, with native web search) researches and generates the checklist
// - GPT-4o reviews the checklist and flags any items it's uncertain about
// Rate limits: Premium: 8 AI generations/month (overridable per user in Admin)

// ── Logging ────────────────────────────────────────────────────────────────
async function logUsage({ userId, userEmail, model, inputTokens, outputTokens, destination, success, error }) {
  try {
    // Rough cost estimate — Claude Sonnet token pricing. Web search adds a small
    // per-search fee on top of this; check current Anthropic pricing for exact figures.
    const costPer1kInput = 0.003;
    const costPer1kOutput = 0.015;
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

// ── Claude generates using native web search ───────────────────────────────
// Returns the full assistant text (Claude interleaves search calls with
// reasoning, so we concatenate every text block) plus token usage.
async function generateWithClaude(promptText) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error('ANTHROPIC_API_KEY not configured');

  const searchInstruction = `Use your web search tool to verify current requirements before answering — pet travel regulations change frequently and your training data may be outdated. Search for the specific country/airline requirements mentioned below, then provide your final answer.\n\n`;

  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: 'claude-sonnet-4-6',
      max_tokens: 4096,
      messages: [{ role: 'user', content: searchInstruction + promptText }],
      tools: [{ type: 'web_search_20250305', name: 'web_search' }],
    }),
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err.error?.message || `Claude request failed (${response.status})`);
  }

  const data = await response.json();

  // Claude's response interleaves text blocks with search tool-use blocks.
  // Concatenate all text blocks — the final JSON answer is typically in the last one.
  const textBlocks = (data.content || []).filter(b => b.type === 'text').map(b => b.text);
  const fullText = textBlocks.join('\n');

  return { fullText, usage: data.usage || {} };
}

// ── GPT-4o verifies ──────────────────────────────────────────────────────
// Takes the Claude-generated checklist and flags any items it's uncertain
// about. Falls back to the original checklist unchanged if anything fails.
async function verifyWithGPT4o(checklistItems) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return checklistItems;

  try {
    const verifyPrompt = `You are a pet travel compliance expert reviewing a generated travel checklist.

Review each item in the JSON array below. Pet travel regulations change frequently. For any item where you are NOT fully confident that the specific requirements, deadlines, costs, form numbers, URLs, or agency names are accurate and current, append " (⚠️ Verify before travel)" to that item's "title" field only.

Do not change any other fields. Do not add new items. Do not remove items.
Return ONLY the complete JSON array. No markdown, no explanation, no backticks.

CHECKLIST:
${JSON.stringify(checklistItems)}`;

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
      body: JSON.stringify({
        model: 'gpt-4o',
        messages: [{ role: 'user', content: verifyPrompt }],
        max_tokens: 4096,
        temperature: 0.1,
      }),
    });

    if (!response.ok) return checklistItems;

    const data = await response.json();
    const text = data.choices?.[0]?.message?.content || '';
    const clean = text.replace(/```json|```/g, '').trim();

    const start = clean.indexOf('[');
    const end = clean.lastIndexOf(']') + 1;
    if (start === -1 || end === 0) return checklistItems;

    const verified = JSON.parse(clean.slice(start, end));
    return Array.isArray(verified) ? verified : checklistItems;

  } catch (e) {
    console.error('GPT-4o verification failed, using original:', e.message);
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

  try {
    // The frontend (Travel.jsx) sends one big user message with the full prompt.
    const promptText = messages[messages.length - 1]?.content || '';

    // ── Step 1: Claude researches and generates (with web search) ─────────
    const { fullText, usage } = await generateWithClaude(promptText);

    // ── Step 2: Parse the JSON checklist out of Claude's response ─────────
    const start = fullText.indexOf('[');
    const end = fullText.lastIndexOf(']') + 1;

    let checklistItems = null;
    if (start !== -1 && end > 0) {
      try {
        checklistItems = JSON.parse(fullText.slice(start, end));
      } catch (e) {
        // parse failed — fall through, client will handle the raw text
      }
    }

    // ── Step 3: GPT-4o verifies (only if we could parse the JSON) ─────────
    if (Array.isArray(checklistItems)) {
      checklistItems = await verifyWithGPT4o(checklistItems);
    }

    await logUsage({
      userId, userEmail, model: 'claude-sonnet-4-6',
      inputTokens: usage.input_tokens || 0,
      outputTokens: usage.output_tokens || 0,
      destination, success: true,
    });

    // Return in the same shape the frontend already expects, so Travel.jsx
    // needs no changes at all.
    return res.status(200).json({
      choices: [{ message: { content: JSON.stringify(checklistItems || []) } }]
    });

  } catch (err) {
    await logUsage({ userId, userEmail, model: 'claude-sonnet-4-6', inputTokens: 0, outputTokens: 0, destination, success: false, error: err.message });
    return res.status(500).json({ error: err.message });
  }
}
