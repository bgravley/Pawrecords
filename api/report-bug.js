// Receives authenticated bug reports, saves them for manual admin review, and
// notifies the administrator. Reporter identity is always derived server-side.

import { createClient } from '@supabase/supabase-js';
import { verifyUser } from './_verifyUser.js';
import { setCorsHeaders } from './_cors.js';

const RESEND_API_KEY = process.env.RESEND_API_KEY;
const FROM_EMAIL = 'YourPetPass <notifications@yourpetpass.com>';
const ADMIN_EMAIL = process.env.ADMIN_ALERT_EMAIL || 'bgravley@rdmarketingllc.com';
const RATE_LIMIT = 10;
const RATE_WINDOW_MS = 60 * 60 * 1000;
let adminClient = null;

function esc(value) {
  if (value === null || value === undefined) return '';
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function supabaseAdmin() {
  if (!adminClient) {
    adminClient = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
  }
  return adminClient;
}

function serviceHeaders(extra = {}) {
  return {
    apikey: process.env.SUPABASE_SERVICE_KEY,
    Authorization: `Bearer ${process.env.SUPABASE_SERVICE_KEY}`,
    ...extra,
  };
}

async function rateLimitStatus(ip) {
  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_KEY) {
    return { unavailable: true, limited: false };
  }
  try {
    const since = new Date(Date.now() - RATE_WINDOW_MS).toISOString();
    const form = 'report-bug';
    const countRes = await fetch(
      `${process.env.SUPABASE_URL}/rest/v1/rate_limit_log?ip=eq.${encodeURIComponent(ip)}&form=eq.${form}&created_at=gte.${encodeURIComponent(since)}&select=id`,
      { headers: serviceHeaders({ Prefer: 'count=exact', 'Range-Unit': 'items', Range: '0-0' }) }
    );
    if (!countRes.ok) throw new Error(`count failed ${countRes.status}`);
    const contentRange = countRes.headers.get('content-range');
    const count = contentRange ? parseInt(contentRange.split('/')[1], 10) || 0 : 0;

    const logRes = await fetch(`${process.env.SUPABASE_URL}/rest/v1/rate_limit_log`, {
      method: 'POST',
      headers: serviceHeaders({ 'Content-Type': 'application/json', Prefer: 'return=minimal' }),
      body: JSON.stringify({ ip, form }),
    });
    if (!logRes.ok) throw new Error(`log failed ${logRes.status}`);
    return { unavailable: false, limited: count >= RATE_LIMIT };
  } catch (error) {
    console.error('Bug report rate-limit backend unavailable:', error.message);
    return { unavailable: true, limited: false };
  }
}

function ownedScreenshotPath(raw, userId) {
  if (!raw || typeof raw !== 'string' || raw.length > 1400) return null;
  try {
    const url = new URL(raw, 'https://www.yourpetpass.com');
    if (!['yourpetpass.com', 'www.yourpetpass.com'].includes(url.hostname)) return null;
    if (url.pathname !== '/api/storage-file') return null;
    const path = url.searchParams.get('path') || '';
    const prefix = `${userId}/bug-reports/`;
    if (!path.startsWith(prefix) || path.includes('..') || path.includes('\\')) return null;
    return path;
  } catch {
    return null;
  }
}

async function signScreenshot(path) {
  if (!path) return null;
  const { data, error } = await supabaseAdmin().storage
    .from('documents')
    .createSignedUrl(path, 24 * 60 * 60);
  if (error || !data?.signedUrl) {
    console.error('Bug screenshot signing failed:', error?.message || 'missing signed URL');
    return null;
  }
  return data.signedUrl;
}

export default async function handler(req, res) {
  setCorsHeaders(req, res);
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.setHeader('Cache-Control', 'private, no-store');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_KEY) {
    return res.status(503).json({ error: 'Bug reporting is temporarily unavailable.' });
  }

  const auth = await verifyUser(req);
  if (!auth.ok) return res.status(auth.status).json({ error: auth.error });

  const ip = req.headers['x-forwarded-for']?.split(',')[0]?.trim() || req.socket?.remoteAddress || 'unknown';
  const rate = await rateLimitStatus(ip);
  if (rate.unavailable) return res.status(503).json({ error: 'Bug reporting is temporarily unavailable.' });
  if (rate.limited) {
    return res.status(429).json({ error: 'Too many bug reports submitted. Please wait before submitting another.' });
  }

  // userId/userEmail from older clients are deliberately ignored. Only the
  // verified Supabase session determines who receives credit for a report.
  const { description, screenshotUrl } = req.body || {};
  if (!description || typeof description !== 'string' || !description.trim()) {
    return res.status(400).json({ error: 'Please describe the bug.' });
  }
  if (description.length > 2000) {
    return res.status(400).json({ error: 'Description is too long (max 2000 characters).' });
  }

  const screenshotPath = ownedScreenshotPath(screenshotUrl, auth.userId);
  const adminScreenshotUrl = screenshotPath
    ? `/api/storage-file?path=${encodeURIComponent(screenshotPath)}`
    : null;
  const emailScreenshotUrl = await signScreenshot(screenshotPath);

  try {
    const insertRes = await fetch(`${process.env.SUPABASE_URL}/rest/v1/bug_reports`, {
      method: 'POST',
      headers: serviceHeaders({
        'Content-Type': 'application/json',
        Prefer: 'return=representation',
      }),
      body: JSON.stringify({
        user_id: auth.userId,
        user_email: auth.email || null,
        description: description.trim(),
        screenshot_url: adminScreenshotUrl,
        status: 'pending',
      }),
    });

    if (!insertRes.ok) {
      const detail = await insertRes.text().catch(() => '');
      console.error('Bug report insert failed:', insertRes.status, detail.slice(0, 250));
      return res.status(502).json({ error: 'Could not submit report. Please try again.' });
    }

    if (RESEND_API_KEY && ADMIN_EMAIL) {
      try {
        const emailRes = await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${RESEND_API_KEY}`,
          },
          body: JSON.stringify({
            from: FROM_EMAIL,
            to: ADMIN_EMAIL,
            subject: `Bug report from ${auth.email || 'a signed-in user'}`,
            html: `<div style="font-family:Georgia,'Times New Roman',serif;max-width:540px;margin:0 auto;background:#FAFCFB;color:#1A2E22;">
              <div style="background:#2C4A38;padding:18px 24px;border-radius:12px 12px 0 0;">
                <img src="https://yourpetpass.com/logo_horizontal_cream_transparent.png" alt="YourPetPass" width="170" style="display:block;height:auto;" />
              </div>
              <div style="padding:22px 24px;background:#FFFFFF;border:1px solid #DCE8E0;border-top:0;">
                <h2 style="color:#2C4A38;margin-top:0;">New Bug Report</h2>
                <p><strong>From:</strong> ${esc(auth.email || 'unknown')}</p>
                <p><strong>Description:</strong></p>
                <div style="background:#EAF4EE;padding:14px;border-radius:10px;white-space:pre-wrap;">${esc(description.trim())}</div>
                ${emailScreenshotUrl ? `<p style="margin-top:18px;"><a href="${esc(emailScreenshotUrl)}" style="color:#2C4A38;font-weight:700;">View private screenshot</a> <span style="color:#7C9E87;font-size:12px;">(link expires in 24 hours)</span></p>` : ''}
                <p><a href="https://yourpetpass.com/admin" style="color:#2C4A38;font-weight:700;">Review in Admin →</a></p>
              </div>
            </div>`,
          }),
        });
        if (!emailRes.ok) {
          console.error('Bug report admin notification failed (non-critical):', emailRes.status);
        }
      } catch (emailError) {
        console.error('Bug report admin notification failed (non-critical):', emailError.message);
      }
    }

    return res.status(200).json({ submitted: true });
  } catch (error) {
    console.error('report-bug error:', error.message);
    return res.status(500).json({ error: 'Something went wrong. Please try again.' });
  }
}
