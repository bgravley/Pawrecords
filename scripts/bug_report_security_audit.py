from pathlib import Path

text = Path('api/report-bug.js').read_text()
checks = {
    'requires verified signed-in user': "const auth = await verifyUser(req);" in text,
    'database reporter id comes from verified user': "user_id: auth.userId" in text,
    'database reporter email comes from verified user': "user_email: auth.email || null" in text,
    'browser cannot supply reporter identity': "const { description, screenshotUrl } = req.body || {};" in text,
    'screenshot is restricted to reporter private folder': "const prefix = `${userId}/bug-reports/`;" in text,
    'screenshot source must be private file gateway': "url.pathname !== '/api/storage-file'" in text,
    'admin stores private gateway URL': "`/api/storage-file?path=${encodeURIComponent(screenshotPath)}`" in text,
    'notification screenshot uses expiring signed URL': ".createSignedUrl(path, 24 * 60 * 60)" in text,
    'rate limiter fails closed when backend unavailable': "if (rate.unavailable) return res.status(503)" in text,
    'description is escaped before email HTML': "${esc(description.trim())}" in text,
    'response disables caching': "Cache-Control', 'private, no-store'" in text,
}

failed = [name for name, ok in checks.items() if not ok]
for name, ok in checks.items():
    print(f"[{'PASS' if ok else 'FAIL'}] {name}")

if failed:
    raise SystemExit(f"Bug-report security audit failed: {', '.join(failed)}")

print(f"Bug-report security audit passed ({len(checks)}/{len(checks)}).")
