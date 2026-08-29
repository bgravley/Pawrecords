from pathlib import Path

# Patch bulk notification engine without rewriting its large email templates.
p = Path('api/send-notifications.js')
s = p.read_text()
imp = "import { verifyCronRequest } from './_cronAuth.js';\n\n"
if imp not in s:
    anchor = "// Sends vaccine reminders, travel document reminders, and weekly digest\n\n"
    if anchor not in s:
        raise SystemExit('send-notifications import anchor missing')
    s = s.replace(anchor, anchor + imp, 1)
old = """export default async function handler(req, res) {
  // Verify cron secret so this can't be called publicly
  const secret = req.headers['x-cron-secret'];
  if (secret !== process.env.CRON_SECRET) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  if (!RESEND_API_KEY) {
    return res.status(500).json({ error: 'RESEND_API_KEY not configured' });
  }"""
new = """export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'private, no-store');
  if (req.method !== 'GET' && req.method !== 'POST') {
    res.setHeader('Allow', 'GET, POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const cron = verifyCronRequest(req, { header: 'x-cron-secret', bearer: false });
  if (!cron.ok) return res.status(cron.status).json({ error: cron.error });

  if (!RESEND_API_KEY) {
    return res.status(503).json({ error: 'RESEND_API_KEY not configured' });
  }"""
if old in s:
    s = s.replace(old, new, 1)
elif new not in s:
    raise SystemExit('send-notifications auth anchor missing')
p.write_text(s)

# Patch prewarm trigger. Admin calls still work, but CRON_SECRET must exist
# because prewarm uses it for the trusted internal ai-travel hop.
p = Path('api/prewarm-cache.js')
s = p.read_text()
imp = "import { verifyCronRequest } from './_cronAuth.js';\n"
if imp not in s:
    anchor = "import { setCorsHeaders } from './_cors.js';\n"
    if anchor not in s:
        raise SystemExit('prewarm import anchor missing')
    s = s.replace(anchor, anchor + imp, 1)
old = """  const isCron = req.headers['authorization'] === `Bearer ${CRON_SECRET}`;
  let isAdmin = false;

  if (!isCron) {"""
new = """  const cron = verifyCronRequest(req);
  if (cron.status === 503) return res.status(503).json({ error: cron.error });
  const isCron = cron.ok;
  let isAdmin = false;

  if (!isCron) {"""
if old in s:
    s = s.replace(old, new, 1)
elif new not in s:
    raise SystemExit('prewarm cron anchor missing')
p.write_text(s)
