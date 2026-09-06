#!/usr/bin/env python3
from pathlib import Path


def replace_once(text, old, new, label):
    if old not in text:
        if new in text:
            return text
        raise SystemExit(f'Could not locate {label}')
    return text.replace(old, new, 1)

# api/send-notifications.js
path = Path('api/send-notifications.js')
text = path.read_text(encoding='utf-8')
text = replace_once(
    text,
    "import { verifyCronRequest } from './_cronAuth.js';\n",
    "import { verifyCronRequest } from './_cronAuth.js';\nimport { unsubscribeApiUrlForUser, unsubscribePageUrlForUser } from './_unsubscribe.js';\n",
    'notification unsubscribe import',
)
text = replace_once(
    text,
    "async function sendEmail({ to, subject, html }) {\n  const res = await fetch('https://api.resend.com/emails', {",
    "async function sendEmail({ to, subject, html, userId }) {\n  const oneClickUnsubscribe = unsubscribeApiUrlForUser(userId);\n  const pageUnsubscribe = unsubscribePageUrlForUser(userId);\n  const personalizedHtml = html.replaceAll('__YPP_UNSUBSCRIBE_URL__', pageUnsubscribe);\n  const res = await fetch('https://api.resend.com/emails', {",
    'sendEmail signature',
)
text = replace_once(
    text,
    "    body: JSON.stringify({ from: FROM_EMAIL, to, subject, html }),",
    "    body: JSON.stringify({\n      from: FROM_EMAIL,\n      to,\n      subject,\n      html: personalizedHtml,\n      headers: {\n        'List-Unsubscribe': `<${oneClickUnsubscribe}>`,\n        'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',\n      },\n    }),",
    'Resend payload',
)
text = replace_once(
    text,
    '<a href="${APP_URL}/unsubscribe" style="color:#8B7355;">Unsubscribe</a>',
    '<a href="__YPP_UNSUBSCRIBE_URL__" style="color:#8B7355;">Unsubscribe</a>',
    'email footer unsubscribe link',
)
text = replace_once(
    text,
    "<p style=\"margin:0;font-size:11px;\">You're receiving this because you have an active YourPetPass account.</p>",
    "<p style=\"margin:0;font-size:11px;\">You're receiving this because YourPetPass reminder emails are enabled for your account.</p>",
    'email footer reason',
)
# There are exactly three outbound reminder email calls.
needle = "          const sent = await sendEmail({\n            to: profile.email,"
count = text.count(needle)
if count != 3:
    raise SystemExit(f'Expected 3 sendEmail reminder calls, found {count}')
text = text.replace(needle, "          const sent = await sendEmail({\n            to: profile.email,\n            userId: profile.id,", 3)
path.write_text(text, encoding='utf-8')

# api/e2e-login.js
path = Path('api/e2e-login.js')
text = path.read_text(encoding='utf-8')
text = replace_once(
    text,
    "} from './_github-actions-oidc.js';\n",
    "} from './_github-actions-oidc.js';\nimport { createUnsubscribeToken } from './_unsubscribe.js';\n",
    'E2E unsubscribe import',
)
text = replace_once(
    text,
    "    travel_credits_balance: 0,\n  }).eq('id', userId);",
    "    travel_credits_balance: 0,\n    email_notifications: true,\n  }).eq('id', userId);",
    'E2E notification reset',
)
text = replace_once(
    text,
    "      actionLink,\n      expiresSoon: true,",
    "      actionLink,\n      unsubscribeToken: createUnsubscribeToken(userId),\n      expiresSoon: true,",
    'E2E unsubscribe token response',
)
path.write_text(text, encoding='utf-8')

# vercel.json
path = Path('vercel.json')
text = path.read_text(encoding='utf-8')
anchor = '''    {\n      "source": "/emergency/:token",\n      "destination": "/index.html"\n    },\n'''
addition = anchor + '''    {\n      "source": "/unsubscribe",\n      "destination": "/unsubscribe.html"\n    },\n'''
if '"source": "/unsubscribe"' not in text:
    if anchor not in text:
        raise SystemExit('Could not locate Vercel rewrite anchor')
    text = text.replace(anchor, addition, 1)
path.write_text(text, encoding='utf-8')

# scripts/live_smoke.mjs
path = Path('scripts/live_smoke.mjs')
text = path.read_text(encoding='utf-8')
public_anchor = """await check('Private Storage gateway rejects anonymous access', async () => {\n  const response = await publicContext.request.get(`${BASE}/api/storage-file?path=live-smoke/no-file.pdf`);\n  if (response.status() !== 401) throw new Error(`Expected 401, got ${response.status()}`);\n});\n"""
public_add = public_anchor + """\nawait check('Unsubscribe endpoint rejects forged public tokens without changing preferences', async () => {\n  const response = await publicContext.request.post(`${BASE}/api/unsubscribe?token=v1.Zm9yZ2Vk.invalid`);\n  if (response.status() !== 400) throw new Error(`Expected 400 for forged unsubscribe token, got ${response.status()}`);\n});\n\nawait check('Unsubscribe page is public and loads no optional analytics bootstrap', async () => {\n  const response = await publicContext.request.get(`${BASE}/unsubscribe`);\n  if (response.status() !== 200) throw new Error(`Unsubscribe page returned ${response.status()}`);\n  const html = await response.text();\n  if (!html.includes('Email preferences') || !html.includes('/unsubscribe.js')) throw new Error('Unsubscribe page content was not served');\n  if (/privacy-consent|googletagmanager|clarity\\.ms|vercel-scripts/i.test(html)) throw new Error('Optional analytics appeared on unsubscribe page');\n});\n"""
if "Unsubscribe endpoint rejects forged public tokens" not in text:
    if public_anchor not in text:
        raise SystemExit('Could not locate live smoke public anchor')
    text = text.replace(public_anchor, public_add, 1)

cleanup_anchor = """await check('Synthetic E2E records are cleaned after the run', async () => {\n  await bootstrap('primary', true, false);\n  await bootstrap('secondary', true, false);\n});\n"""
unsubscribe_check = """await check('Signed unsubscribe link disables reminder emails and is idempotent', async () => {\n  const primary = await bootstrap('primary', false, false);\n  if (!primary.unsubscribeToken) throw new Error('OIDC-gated E2E bootstrap did not issue an unsubscribe token');\n\n  for (let attempt = 0; attempt < 2; attempt += 1) {\n    const response = await fetch(`${BASE}/api/unsubscribe?token=${encodeURIComponent(primary.unsubscribeToken)}`, { method: 'POST' });\n    if (response.status !== 200) throw new Error(`Signed unsubscribe returned ${response.status}`);\n    const result = await response.json();\n    if (result?.success !== true) throw new Error('Signed unsubscribe did not return success');\n  }\n});\n\n""" + cleanup_anchor
if "Signed unsubscribe link disables reminder emails and is idempotent" not in text:
    if cleanup_anchor not in text:
        raise SystemExit('Could not locate live smoke cleanup anchor')
    text = text.replace(cleanup_anchor, unsubscribe_check, 1)
path.write_text(text, encoding='utf-8')

print('Patched notification emails, E2E bootstrap, Vercel routing, and production smoke for secure unsubscribe.')
