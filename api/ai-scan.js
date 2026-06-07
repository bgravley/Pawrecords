// api/ai-scan.js
// Smart document scanner with rate limiting:
// - Premium: 20 AI scans/month (overridable per user in Admin)
// - Free: 0 (AI scan is premium only)

// ── MIME validation ────────────────────────────────────────────────────────
// Checks the actual base64 content matches the declared media type.
// Prevents someone from renaming a file to trick the scanner.
const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'application/pdf'];
const MAGIC = {
  'image/jpeg':      '/9j/',
  'image/png':       'iVBOR',
  'image/gif':       'R0lG',
  'image/webp':      'UklGR',
  'application/pdf': 'JVBER',
};

function validateMime(base64, declaredType) {
  if (!ALLOWED_TYPES.includes(declaredType)) return false;
  const prefix = (base64 || '').slice(0, 8);
  const expected = MAGIC[declaredType];
  return expected ? prefix.startsWith(expected) : false;
}

// ── Logging ────────────────────────────────────────────────────────────────
async function logUsage({ userId, userEmail, petName, feature, model, inputTokens, outputTokens, success, error }) {
  try {
    const costPer1kInput = 0.0025;
    const costPer1kOutput = 0.01;
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

// ── Rate limit ─────────────────────────────────────────────────────────────
async function checkRateLimit(userId) {
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
  const res = await fetch(
    `${process.env.SUPABASE_URL}/rest/v1/ai_usage_log?user_id=eq.${userId}&feature=eq.document_scan&success=eq.true&created_at=gte.${monthStart}&select=id`,
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
    `${process.env.SUPABASE_URL}/rest/v1/profiles?id=eq.${userId}&select=subscription_tier,ai_scan_limit_override`,
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
    scanLimitOverride: data?.[0]?.ai_scan_limit_override ?? null,
  };
}

// ── Handler ────────────────────────────────────────────────────────────────
export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const { imageBase64, mediaType, images, userId, userEmail, petName } = req.body;

    // ── Auth / tier / rate limit ──────────────────────────────────────────
    if (userId) {
      const { tier, scanLimitOverride } = await getUserProfile(userId);
      const isPremium = tier === 'premium' || tier === 'lifetime';

      if (!isPremium) {
        return res.status(403).json({
          error: 'AI Document Scan is a Premium feature. Upgrade to scan documents.',
          rateLimitExceeded: false,
          requiresUpgrade: true,
        });
      }

      const scanCount = await checkRateLimit(userId);
      // Use per-user override if set, otherwise default 20
      const MONTHLY_LIMIT = scanLimitOverride !== null ? scanLimitOverride : 20;

      if (scanCount >= MONTHLY_LIMIT) {
        return res.status(429).json({
          error: `Monthly scan limit reached (${MONTHLY_LIMIT} scans/month). Resets on the 1st of next month.`,
          rateLimitExceeded: true,
          scansUsed: scanCount,
          scansLimit: MONTHLY_LIMIT,
        });
      }
    }

    // ── Normalize image list ──────────────────────────────────────────────
    let imageList = [];
    if (images && Array.isArray(images)) {
      imageList = images;
    } else if (imageBase64) {
      imageList = [{ base64: imageBase64, mediaType: mediaType || 'image/jpeg' }];
    }

    if (imageList.length === 0) return res.status(400).json({ error: 'No image data provided' });
    if (imageList.length > 4) return res.status(400).json({ error: 'Maximum 4 images per scan' });

    // ── MIME validation ───────────────────────────────────────────────────
    for (const img of imageList) {
      const declaredType = img.mediaType || 'image/jpeg';
      if (!validateMime(img.base64, declaredType)) {
        return res.status(400).json({
          error: `Invalid file type. Only JPEG, PNG, GIF, WebP, and PDF are allowed.`,
        });
      }
    }

    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) return res.status(500).json({ error: 'OpenAI API key not configured' });

    const pageCount = imageList.length;

    const prompt = `You are a smart veterinary and pet document parser. Analyze ${pageCount > 1 ? `these ${pageCount} pages` : 'this document'} and:

STEP 1 — Identify the document type. It will be one of:
- "vet_visit" — vet invoice, clinical record, visit summary, health exam
- "service_animal_cert" — service animal certification, ADA service dog certificate
- "esa_letter" — emotional support animal letter from a mental health professional
- "health_certificate" — USDA health certificate, travel health cert, APHIS form
- "vaccine_record" — standalone vaccine record or rabies certificate
- "unknown" — anything else

STEP 2 — Extract ALL relevant information based on document type.

Return ONLY raw JSON, no markdown, no explanation:

{
  "documentType": "vet_visit" | "service_animal_cert" | "esa_letter" | "health_certificate" | "vaccine_record" | "unknown",
  "documentSummary": "one sentence describing what this document is",
  "vetVisit": {
    "visitDate": "YYYY-MM-DD or null",
    "vetName": "string or null",
    "clinicName": "string or null",
    "reason": "string or null",
    "diagnosis": "string or null",
    "treatment": "string or null",
    "weight": null,
    "cost": null,
    "notes": "string or null",
    "vaccines": [{"name":"string","dateGiven":"YYYY-MM-DD or null","nextDue":"YYYY-MM-DD or null","lotNumber":"string or null","type":"core or optional"}],
    "medications": [{"name":"string","dosage":"string or null","frequency":"string or null","reason":"string or null"}],
    "allergies": [{"allergen":"string","reaction":"string or null","severity":"mild or moderate or severe"}]
  },
  "serviceAnimal": {
    "petName": "string or null",
    "petType": "service_animal",
    "breed": "string or null",
    "dateOfBirth": "YYYY-MM-DD or null",
    "microchip": "string or null",
    "weight": null,
    "handlerName": "string or null",
    "certificationNumber": "string or null",
    "issuingOrganization": "string or null",
    "issueDate": "YYYY-MM-DD or null",
    "expirationDate": "YYYY-MM-DD or null",
    "tasksPerformed": [],
    "trainerName": "string or null",
    "trainerCertification": "string or null"
  },
  "esaLetter": {
    "petName": "string or null",
    "petType": "esa",
    "breed": "string or null",
    "handlerName": "string or null",
    "therapistName": "string or null",
    "therapistLicense": "string or null",
    "issueDate": "YYYY-MM-DD or null",
    "expirationDate": "YYYY-MM-DD or null",
    "issuingPractice": "string or null"
  },
  "healthCertificate": {
    "visitDate": "YYYY-MM-DD or null",
    "vetName": "string or null",
    "clinicName": "string or null",
    "destination": "string or null",
    "validThrough": "YYYY-MM-DD or null",
    "weight": null,
    "microchip": "string or null",
    "vaccines": []
  }
}

Rules:
- Only populate the section matching the documentType. Leave others as null/empty.
- Rabies/DHPP/DA2PP = core vaccines. All others = optional.
- Calculate nextDue if missing: Rabies=12mo, DHPP/DA2PP=36mo, others=12mo from dateGiven.
- Weight always in lbs as a number only.
- Cost as number only, no $ sign.
- Return only the JSON. Nothing else.`;

    const contentArray = imageList.map(img => ({
      type: 'image_url',
      image_url: { url: `data:${img.mediaType};base64,${img.base64}`, detail: 'high' }
    }));
    contentArray.push({ type: 'text', text: prompt });

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: 'gpt-4o', max_tokens: 2500, messages: [{ role: 'user', content: contentArray }] })
    });

    if (!response.ok) {
      const errData = await response.json();
      await logUsage({ userId, userEmail, petName, feature: 'document_scan', model: 'gpt-4o', inputTokens: 0, outputTokens: 0, success: false, error: errData.error?.message });
      return res.status(500).json({ error: errData.error?.message || 'OpenAI request failed' });
    }

    const data = await response.json();
    const usage = data.usage || {};
    const text = data.choices?.[0]?.message?.content || '';
    const clean = text.replace(/```json|```/g, '').trim();

    let parsed;
    try {
      parsed = JSON.parse(clean);
    } catch (e) {
      await logUsage({ userId, userEmail, petName, feature: 'document_scan', model: 'gpt-4o', inputTokens: usage.prompt_tokens || 0, outputTokens: usage.completion_tokens || 0, success: false, error: 'JSON parse failed' });
      return res.status(500).json({ error: 'AI returned invalid JSON. Try a clearer photo.' });
    }

    await logUsage({ userId, userEmail, petName, feature: 'document_scan', model: 'gpt-4o', inputTokens: usage.prompt_tokens || 0, outputTokens: usage.completion_tokens || 0, success: true });

    return res.status(200).json({ extracted: parsed });

  } catch (err) {
    console.error('AI Scan error:', err);
    return res.status(500).json({ error: err.message || 'Scan failed' });
  }
}
