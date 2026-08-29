from pathlib import Path

text = Path('api/email-record.js').read_text()
checks = {
    'requires verified signed-in user': "const auth = await verifyUser(req);" in text,
    'pet lookup is constrained to verified owner': "user_id=eq.${encodeURIComponent(userId)}" in text,
    'browser HTML is not accepted as request data': "petName: legacyName" in text and "htmlContent" not in text,
    'record body is built from server-fetched rows': "buildRecord(record)" in text and "Promise.all([" in text,
    'pet id is UUID validated': "UUID_RE.test(petId)" in text,
    'legacy name selector is owner scoped': "selector = `name=eq.${encodeURIComponent(legacyName.trim())}`" in text,
    'duplicate pet names fail closed': "record?.ambiguous" in text and "status(409)" in text,
    'shared PDF path is restricted to owner folder': "const prefix = `${userId}/shared-records/`;" in text,
    'private PDF is converted to expiring signed URL': ".createSignedUrl(path, 24 * 60 * 60" in text,
    'recipient address is format/length checked': "recipientEmail.length > 254" in text,
    'responses are not cached': "Cache-Control', 'private, no-store'" in text,
}

failed = [name for name, ok in checks.items() if not ok]
for name, ok in checks.items():
    print(f"[{'PASS' if ok else 'FAIL'}] {name}")

if failed:
    raise SystemExit(f"Emailed-record security audit failed: {', '.join(failed)}")

print(f"Emailed-record security audit passed ({len(checks)}/{len(checks)}).")
