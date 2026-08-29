from pathlib import Path


def read(path):
    return Path(path).read_text(encoding='utf-8', errors='ignore')

helper = read('api/_publicRateLimit.js')
contact = read('api/contact-form.js')
newsletter = read('api/newsletter-signup.js')

checks = {
    'shared limiter fails closed when configuration is missing': (
        "if (!supabaseUrl || !serviceKey)" in helper and
        "status: 503" in helper
    ),
    'shared limiter verifies the count query succeeded': "if (!countRes.ok)" in helper,
    'shared limiter verifies the attempt log succeeded': "if (!logRes.ok)" in helper,
    'shared limiter converts backend failures to temporary unavailability': (
        "Public rate-limit backend unavailable" in helper and
        "status: 503" in helper
    ),
    'contact form uses the shared fail-closed limiter': (
        "checkPublicRateLimit" in contact and
        "if (!rate.ok) return res.status(rate.status)" in contact
    ),
    'newsletter form uses the shared fail-closed limiter': (
        "checkPublicRateLimit" in newsletter and
        "if (!rate.ok) return res.status(rate.status)" in newsletter
    ),
    'contact bot checks happen before rate-limit database work': (
        contact.find("if (website)") < contact.find("checkPublicRateLimit({") and
        contact.find("typeof elapsedMs") < contact.find("checkPublicRateLimit({")
    ),
    'newsletter bot checks happen before rate-limit database work': (
        newsletter.find("if (website)") < newsletter.find("checkPublicRateLimit({") and
        newsletter.find("typeof elapsedMs") < newsletter.find("checkPublicRateLimit({")
    ),
    'contact body parsing cannot throw on an empty request body': "req.body || {}" in contact,
    'newsletter body parsing cannot throw on an empty request body': "req.body || {}" in newsletter,
    'contact message HTML uses the shared escaping function': "${esc(cleanMessage)}" in contact,
    'contact strips CR/LF from email header text': "replace(/[\\r\\n]+/g, ' ')" in contact,
    'newsletter caps addresses at RFC mailbox length': "cleanEmail.length > 254" in newsletter,
}

failed = [name for name, ok in checks.items() if not ok]
for name, ok in checks.items():
    print(f"[{'PASS' if ok else 'FAIL'}] {name}")

if failed:
    raise SystemExit('Public-form security audit failed: ' + ', '.join(failed))

print(f"Public-form security audit passed ({len(checks)}/{len(checks)}).")
