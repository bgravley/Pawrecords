// api/ai-travel.js
// Travel checklist generator — testing OpenAI's native web search as a
// cheaper alternative to Claude's web search tool (which was pulling huge
// raw page content into context, ~130k+ tokens per request).
//
// - GPT-4o (with OpenAI's native web search tool) researches and generates
// - Claude (Sonnet, no search needed) reviews the checklist and flags uncertainty
// - Results are cached by origin/destination country pair for 30 days
// Rate limits: Premium: 3 AI generations/month included (overridable per user in Admin)

// ── Logging ────────────────────────────────────────────────────────────────
async function logUsage({ userId, userEmail, model, inputTokens, outputTokens, destination, success, error }) {
  try {
    // Cost estimate varies by model — check current provider pricing pages for exact figures.
    const rates = {
      'gpt-4o': { input: 0.0025, output: 0.01 },
      'claude-sonnet-4-6': { input: 0.003, output: 0.015 },
    };
    const rate = rates[model] || rates['gpt-4o'];
    const estimatedCost = (inputTokens / 1000 * rate.input) + (outputTokens / 1000 * rate.output);
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
  if (!res.ok) {
    console.error('Rate limit check failed:', res.status, await res.text().catch(() => ''));
    throw new Error('Could not verify usage limit — please try again.');
  }
  const countHeader = res.headers.get('content-range');
  return countHeader ? parseInt(countHeader.split('/')[1]) || 0 : 0;
}

// ── User profile (tier + limit override + bonus credits) ──────────────────
async function getUserProfile(userId) {
  const res = await fetch(
    `${process.env.SUPABASE_URL}/rest/v1/profiles?id=eq.${userId}&select=subscription_tier,ai_travel_limit_override,travel_credits_balance`,
    {
      headers: {
        'apikey': process.env.SUPABASE_SERVICE_KEY,
        'Authorization': `Bearer ${process.env.SUPABASE_SERVICE_KEY}`,
      }
    }
  );
  if (!res.ok) {
    console.error('Profile lookup failed:', res.status, await res.text().catch(() => ''));
    throw new Error('Could not verify your account — please try again.');
  }
  const data = await res.json();
  return {
    tier: data?.[0]?.subscription_tier || 'free',
    travelLimitOverride: data?.[0]?.ai_travel_limit_override ?? null,
    creditsBalance: data?.[0]?.travel_credits_balance || 0,
  };
}

// Spend one purchased bonus credit (called only when the monthly free quota is exhausted)
async function spendOneCredit(userId, currentBalance) {
  try {
    await fetch(`${process.env.SUPABASE_URL}/rest/v1/profiles?id=eq.${userId}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'apikey': process.env.SUPABASE_SERVICE_KEY,
        'Authorization': `Bearer ${process.env.SUPABASE_SERVICE_KEY}`,
        'Prefer': 'return=minimal',
      },
      body: JSON.stringify({ travel_credits_balance: Math.max(0, currentBalance - 1) }),
    });
  } catch (e) {
    console.error('Failed to spend travel credit:', e.message);
  }
}

// ── Route cache ──────────────────────────────────────────────────────────
// Pet travel regulations are the same for everyone flying the same route —
// no reason to pay for fresh research on a route already researched recently.
const CACHE_TTL_DAYS = 30;

function normalizeCountry(c) {
  return (c || '').trim().toLowerCase();
}

async function getCachedChecklist(originCountry, destinationCountry, transportMode) {
  if (!originCountry || !destinationCountry) return null;
  const mode = (transportMode || 'air').toLowerCase();
  const cutoff = new Date(Date.now() - CACHE_TTL_DAYS * 24 * 60 * 60 * 1000).toISOString();
  try {
    const res = await fetch(
      `${process.env.SUPABASE_URL}/rest/v1/travel_route_cache?origin_country=eq.${encodeURIComponent(normalizeCountry(originCountry))}&destination_country=eq.${encodeURIComponent(normalizeCountry(destinationCountry))}&transportation_mode=eq.${encodeURIComponent(mode)}&created_at=gte.${cutoff}&select=checklist_json&order=created_at.desc&limit=1`,
      { headers: { 'apikey': process.env.SUPABASE_SERVICE_KEY, 'Authorization': `Bearer ${process.env.SUPABASE_SERVICE_KEY}` } }
    );
    if (!res.ok) {
      console.error('Cache lookup failed (non-critical, falling back to fresh generation):', res.status);
      return null;
    }
    const rows = await res.json();
    return rows?.[0]?.checklist_json || null;
  } catch (e) {
    console.error('Cache lookup failed (non-critical):', e.message);
    return null;
  }
}

async function saveToCache(originCountry, destinationCountry, checklistItems, transportMode) {
  if (!originCountry || !destinationCountry) return;
  try {
    await fetch(`${process.env.SUPABASE_URL}/rest/v1/travel_route_cache`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': process.env.SUPABASE_SERVICE_KEY,
        'Authorization': `Bearer ${process.env.SUPABASE_SERVICE_KEY}`,
        'Prefer': 'return=minimal',
      },
      body: JSON.stringify({
        origin_country: normalizeCountry(originCountry),
        destination_country: normalizeCountry(destinationCountry),
        transportation_mode: (transportMode || 'air').toLowerCase(),
        checklist_json: checklistItems,
      }),
    });
  } catch (e) {
    console.error('Cache save failed (non-critical):', e.message);
  }
}

// ── GPT-4o generates using OpenAI's native web search tool ─────────────────
const SOURCE_INSTRUCTION = `You are conducting official regulatory research for pet travel compliance. A real pet owner will rely on this information to avoid their pet being denied boarding, quarantined, or fined — accuracy and source quality are critical.

SOURCE REQUIREMENTS — read carefully before searching:
- ONLY use official sources: government agency websites (e.g. USDA APHIS, CDC, the destination country's official agriculture/customs ministry site), official airline websites, and IATA (International Air Transport Association).
- DO NOT use pet travel blogs, forums (Reddit, Quora), "top tips" listicles, or any third-party aggregator site — even if they rank highly in search results and look informative. These are frequently outdated or simply wrong.
- For each checklist item, the "source_url" field must be the actual official URL you found via search. If no official source exists for a specific requirement, say so explicitly in the "notes" field (e.g. "No official source found — verify directly with airline or embassy") rather than citing a non-official source.
- Prioritize domains ending in .gov, official country-government TLDs (e.g. .gc.ca, .gov.uk, .gov.au), europa.eu for EU rules, and the relevant country's official customs/agriculture ministry site.
- For airline-specific requirements, search the airline's own official site directly — not third-party "airline pet policy" comparison sites.

Search the web now to research the specific route below, then provide your final answer as a JSON array in the exact format requested.

`;

async function generateWithGPT4o(promptText) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error('OPENAI_API_KEY not configured');

  const response = await fetch('https://api.openai.com/v1/responses', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: 'gpt-4o',
      input: SOURCE_INSTRUCTION + promptText,
      tools: [{ type: 'web_search' }],
    }),
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err.error?.message || `OpenAI request failed (${response.status})`);
  }

  const data = await response.json();

  // Defensive extraction — the Responses API nests text inside output[].content[].
  // Try the expected shape first, fall back to scanning the whole payload if
  // OpenAI's exact field names differ from what's expected here.
  let fullText = '';
  try {
    const messageItems = (data.output || []).filter(item => item.type === 'message');
    const textParts = [];
    for (const item of messageItems) {
      for (const c of (item.content || [])) {
        if (c.type === 'output_text' && c.text) textParts.push(c.text);
        if (c.type === 'text' && c.text) textParts.push(c.text);
      }
    }
    fullText = textParts.join('\n');
  } catch (e) {
    console.error('Unexpected response shape, falling back to raw scan:', e.message);
  }

  // Fallback: Chat-Completions-style shape, in case this account routes differently
  if (!fullText && data.choices?.[0]?.message?.content) {
    fullText = data.choices[0].message.content;
  }

  // Last resort: stringify the whole response and hope the JSON array is in there
  if (!fullText) {
    console.error('Could not find text in expected fields — raw response:', JSON.stringify(data).slice(0, 2000));
    fullText = JSON.stringify(data);
  }

  const usage = data.usage || {};
  return {
    fullText,
    usage: {
      input_tokens: usage.input_tokens || usage.prompt_tokens || 0,
      output_tokens: usage.output_tokens || usage.completion_tokens || 0,
    },
  };
}

// ── Claude verifies (no search needed — just judgment on what GPT-4o found) ──
async function verifyWithClaude(checklistItems) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return { items: checklistItems, usage: null };

  try {
    const verifyPrompt = `You are a pet travel compliance expert reviewing a generated travel checklist for accuracy AND source quality.

Review each item in the JSON array below. For each item, check TWO things:

1. ACCURACY: Are you confident the specific requirements, deadlines, costs, form numbers, and agency names are correct and current? Pet travel regulations change frequently.

2. SOURCE QUALITY: Look at the "source_url" field. Is it an official government website (.gov, official ministry/agency site), an official airline website, or IATA? Or does it look like a third-party blog, forum, "top tips" site, or other unofficial/aggregator source?

If an item fails EITHER check — you're not confident it's accurate, OR the source doesn't look official — append " (⚠️ Verify before travel)" to that item's "title" field.

Do not change any other fields. Do not add new items. Do not remove items.
Return ONLY the complete JSON array. No markdown, no explanation, no backticks.

CHECKLIST:
${JSON.stringify(checklistItems)}`;

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
        messages: [{ role: 'user', content: verifyPrompt }],
      }),
    });

    if (!response.ok) return { items: checklistItems, usage: null };

    const data = await response.json();
    const text = data.content?.[0]?.text || '';
    const clean = text.replace(/```json|```/g, '').trim();
    const usage = data.usage || null;

    const start = clean.indexOf('[');
    const end = clean.lastIndexOf(']') + 1;
    if (start === -1 || end === 0) return { items: checklistItems, usage };

    const verified = JSON.parse(clean.slice(start, end));
    return { items: Array.isArray(verified) ? verified : checklistItems, usage };

  } catch (e) {
    console.error('Claude verification failed, using original:', e.message);
    return { items: checklistItems, usage: null };
  }
}

// ── Handler ────────────────────────────────────────────────────────────────
export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).end();

  const { messages, userId, userEmail, destination, originCountry, destinationCountry, transportationType } = req.body;

  if (!messages || !Array.isArray(messages)) {
    return res.status(400).json({ error: 'messages array required' });
  }

  let userProfile = null;

  try {
    // ── Premium gate — applies regardless of cache ──────────────────────────
    if (userId) {
      userProfile = await getUserProfile(userId);
      const isPremium = userProfile.tier === 'premium' || userProfile.tier === 'lifetime';
      if (!isPremium) {
        return res.status(403).json({
          error: 'AI Travel Checklist is a Premium feature. Upgrade to generate requirements.',
          requiresUpgrade: true,
        });
      }
    }

    // ── Check the route cache — free for everyone, no quota cost ────────────
    const cached = await getCachedChecklist(originCountry, destinationCountry, transportationType);
    if (cached) {
      console.log(`Cache hit for ${originCountry} → ${destinationCountry} (${transportationType || 'air'})`);
      return res.status(200).json({
        choices: [{ message: { content: JSON.stringify(cached) } }],
        cached: true,
      });
    }
  } catch (err) {
    console.error('Pre-generation check failed:', err.message);
    return res.status(503).json({ error: 'Could not verify your account right now — please try again in a moment.' });
  }

  // ── Rate limit + bonus credits — only applies when we pay for generation ──
  let useCreditInstead = false;
  if (userId && userProfile) {
    let count;
    try {
      count = await checkRateLimit(userId);
    } catch (err) {
      console.error('Rate limit check failed:', err.message);
      return res.status(503).json({ error: 'Could not verify your usage limit right now — please try again in a moment.' });
    }
    const MONTHLY_LIMIT = userProfile.travelLimitOverride !== null ? userProfile.travelLimitOverride : 3;

    if (count >= MONTHLY_LIMIT) {
      if (userProfile.creditsBalance > 0) {
        useCreditInstead = true; // they've bought extra — let it through, spend a credit after success
      } else {
        return res.status(429).json({
          error: `Monthly travel checklist limit reached (${MONTHLY_LIMIT}/month). Buy more checklists or wait until the 1st of next month.`,
          rateLimitExceeded: true,
          generationsUsed: count,
          generationsLimit: MONTHLY_LIMIT,
          creditsBalance: userProfile.creditsBalance,
        });
      }
    }
  }

  try {
    const promptText = messages[messages.length - 1]?.content || '';

    // ── Step 1: GPT-4o researches and generates (with native web search) ───
    const { fullText, usage } = await generateWithGPT4o(promptText);

    // ── Step 2: Parse the JSON checklist out of the response ──────────────
    const start = fullText.indexOf('[');
    const end = fullText.lastIndexOf(']') + 1;

    let checklistItems = null;
    if (start !== -1 && end > 0) {
      try {
        checklistItems = JSON.parse(fullText.slice(start, end));
      } catch (e) {
        // checklistItems stays null
      }
    }

    const gotRealResult = Array.isArray(checklistItems) && checklistItems.length > 0;

    if (!gotRealResult) {
      await logUsage({
        userId, userEmail, model: 'gpt-4o',
        inputTokens: usage.input_tokens || 0,
        outputTokens: usage.output_tokens || 0,
        destination, success: false,
        error: 'GPT-4o returned no parseable checklist',
      });
      return res.status(500).json({
        error: 'The AI could not generate a checklist for this route. This attempt was NOT counted against your monthly limit — please try again.',
      });
    }

    // ── Step 3: Claude verifies the real result ────────────────────────────
    const verifyResult = await verifyWithClaude(checklistItems);
    checklistItems = verifyResult.items;

    // Save to cache so the next request for this route is free
    await saveToCache(originCountry, destinationCountry, checklistItems, transportationType);

    // Log BOTH models used for this single request as separate rows —
    // GPT-4o did the web search/generation, Claude did the verification.
    await logUsage({
      userId, userEmail, model: 'gpt-4o',
      inputTokens: usage.input_tokens || 0,
      outputTokens: usage.output_tokens || 0,
      destination, success: true,
    });
    if (verifyResult.usage) {
      await logUsage({
        userId, userEmail, model: 'claude-sonnet-4-6',
        inputTokens: verifyResult.usage.input_tokens || 0,
        outputTokens: verifyResult.usage.output_tokens || 0,
        destination, success: true,
      });
    }

    // If they were over quota and this ran on a purchased credit, spend it now
    if (useCreditInstead && userId && userProfile) {
      await spendOneCredit(userId, userProfile.creditsBalance);
    }

    return res.status(200).json({
      choices: [{ message: { content: JSON.stringify(checklistItems) } }]
    });

  } catch (err) {
    await logUsage({ userId, userEmail, model: 'gpt-4o', inputTokens: 0, outputTokens: 0, destination, success: false, error: err.message });
    return res.status(500).json({ error: `${err.message} — this attempt was NOT counted against your monthly limit.` });
  }
}
