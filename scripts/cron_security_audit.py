from pathlib import Path

helper = Path('api/_cronAuth.js').read_text()
send = Path('api/send-notifications.js').read_text()
prewarm = Path('api/prewarm-cache.js').read_text()
wrapper = Path('api/cron-notifications.js').read_text()
health = Path('api/supabase-health.js').read_text()
travel = Path('api/ai-travel.js').read_text()

checks = {
    'cron helper fails closed without configured secret': "status: 503" in helper and "CRON_SECRET" in helper,
    'cron helper uses constant-time comparison': "timingSafeEqual" in helper,
    'bulk notification engine uses shared cron helper': "verifyCronRequest(req, { header: 'x-cron-secret', bearer: false })" in send,
    'bulk notification engine disables caching': "Cache-Control', 'private, no-store'" in send,
    'prewarm trigger uses shared cron helper': "const cron = verifyCronRequest(req);" in prewarm,
    'prewarm fails closed when cron secret is missing': "if (cron.status === 503)" in prewarm,
    'cron wrapper uses shared cron helper': "const cron = verifyCronRequest(req);" in wrapper,
    'Supabase health check uses shared cron helper': "const cron = verifyCronRequest(req);" in health,
    'AI travel prewarm bypass independently requires configured secret': "!!process.env.CRON_SECRET" in travel and "x-prewarm-secret" in travel,
    'no temporary cron patch files remain': not Path('scripts/patch_cron_auth_temp.py').exists() and not Path('.github/workflows/cron-auth-patch-temp.yml').exists(),
}

failed = [name for name, ok in checks.items() if not ok]
for name, ok in checks.items():
    print(f"[{'PASS' if ok else 'FAIL'}] {name}")

if failed:
    raise SystemExit(f"Cron security audit failed: {', '.join(failed)}")

print(f"Cron security audit passed ({len(checks)}/{len(checks)}).")
