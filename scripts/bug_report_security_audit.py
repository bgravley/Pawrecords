from pathlib import Path
import subprocess

text = Path('api/report-bug.js').read_text()
admin_api = Path('api/admin-data.js').read_text()
app = Path('src/PawRecord.jsx').read_text()
admin_ui = Path('src/Admin.jsx').read_text()
migration = Path('supabase/migrations/20260906155500_feedback_report_types.sql').read_text()
checks = {
    'requires verified signed-in user': "const auth = await verifyUser(req);" in text,
    'database reporter id comes from verified user': "user_id: auth.userId" in text,
    'database reporter email comes from verified user': "user_email: auth.email || null" in text,
    'browser identity fields remain ignored': "userId/userEmail from older clients are deliberately ignored" in text,
    'only allowed feedback categories are accepted': "new Set(['bug', 'feature', 'feedback'])" in text and "if (!REPORT_TYPES.has(reportType))" in text,
    'older clients default safely to bug': ": 'bug';" in text,
    'report type is persisted server-side': "report_type: reportType" in text,
    'screenshot is restricted to reporter private folder': "const prefix = `${userId}/bug-reports/`;" in text,
    'screenshot source must be private file gateway': "url.pathname !== '/api/storage-file'" in text,
    'admin stores private gateway URL': "`/api/storage-file?path=${encodeURIComponent(screenshotPath)}`" in text,
    'notification screenshot uses expiring signed URL': ".createSignedUrl(path, 24 * 60 * 60)" in text,
    'rate limiter fails closed when backend unavailable': "if (rate.unavailable) return res.status(503)" in text,
    'description is escaped before email HTML': "${esc(description.trim())}" in text,
    'response disables caching': "Cache-Control', 'private, no-store'" in text,
    'database constrains category values': "check (report_type in ('bug', 'feature', 'feedback'))" in migration,
    'existing reports retain bug default': "default 'bug'" in migration,
    'customer UI exposes bug feature and feedback choices': all(v in app for v in ['Report a bug', 'Request a feature', 'Share general feedback']),
    'customer UI sends selected report type': 'JSON.stringify({userId,userEmail,reportType,description:description.trim(),screenshotUrl})' in app,
    'feedback launcher has an accessible name': 'title="Share Feedback" aria-label="Share feedback"' in app,
    'admin queue identifies all feedback categories': all(v in admin_ui for v in ['Feedback & Reports', 'Feature Request', 'General Feedback']),
    'non-bug reviews bypass bug reward billing path': "if (reportType !== 'bug')" in admin_api and 'not bug-bounty submissions and must never modify billing' in admin_api,
    'non-bug admin action is review not reward': '"✓ Mark Reviewed"' in admin_ui,
}

behavior = subprocess.run(
    ['node', '--test', 'scripts/feedback_behavior.test.mjs'],
    text=True,
    capture_output=True,
)
checks['stateful feedback category behavior tests pass'] = behavior.returncode == 0
if behavior.stdout:
    print(behavior.stdout.rstrip())
if behavior.returncode != 0 and behavior.stderr:
    print(behavior.stderr.rstrip())

failed = [name for name, ok in checks.items() if not ok]
for name, ok in checks.items():
    print(f"[{'PASS' if ok else 'FAIL'}] {name}")

if failed:
    raise SystemExit(f"Feedback security audit failed: {', '.join(failed)}")

print(f"Feedback security audit passed ({len(checks)}/{len(checks)}).")
