#!/usr/bin/env python3
"""
audit.py — YourPetPass full-site audit script
==============================================
Run this every time a review is requested instead of improvising checks
from scratch. Every check here was added because a real bug was found.
When a new bug is found in the future, add a check for it HERE so it is
never missed again — the list only grows, never shrinks.

Usage:  python3 scripts/audit.py
Run from the repo root directory.
"""

import re, os, subprocess, sys, json

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
os.chdir(ROOT)

issues  = []
passed  = []
reminders = []

def fail(msg):    issues.append(msg)
def ok(msg):      passed.append(msg)
def remind(msg):  reminders.append(msg)


# ════════════════════════════════════════════════════════════════════════════
# 1. BUILD SUCCEEDS
# ════════════════════════════════════════════════════════════════════════════
print("[ 1/27] Running build...")
result = subprocess.run(["npm", "run", "build"], capture_output=True, text=True)
if result.returncode != 0:
    fail(f"BUILD FAILED:\n{result.stdout[-2000:]}\n{result.stderr[-2000:]}")
else:
    ok("Build succeeds cleanly")


# ════════════════════════════════════════════════════════════════════════════
# 2. NO DUPLICATED FILE CONTENT
#    (Travel.jsx, db.js, terms.html have all had this bug — whole file
#     content copy-pasted onto itself, causing silent double-execution)
# ════════════════════════════════════════════════════════════════════════════
print("[ 2/27] Checking for duplicated file content...")
for f in subprocess.run(
    ["find", "public", "-name", "*.html"], capture_output=True, text=True
).stdout.split():
    count = open(f, errors='ignore').read().count("<!DOCTYPE html>")
    if count > 1:
        fail(f"{f} has {count} DOCTYPE declarations — file content is duplicated")

for root, dirs, files in os.walk("src"):
    dirs[:] = [d for d in dirs if d != "node_modules"]
    for f in files:
        if f.endswith((".jsx", ".js")):
            path = os.path.join(root, f)
            if open(path, errors='ignore').read().count("export default") > 1:
                fail(f"{path} has multiple 'export default' — likely duplicated content")

for root, dirs, files in os.walk("api"):
    for f in files:
        if f.endswith(".js"):
            path = os.path.join(root, f)
            if open(path, errors='ignore').read().count("export default") > 1:
                fail(f"{path} has multiple 'export default' — likely duplicated content")

if not any("DOCTYPE" in i or "export default" in i for i in issues):
    ok("No duplicated file content found")


# ════════════════════════════════════════════════════════════════════════════
# 3. BROKEN INTERNAL LINKS AND IMAGE REFERENCES
# ════════════════════════════════════════════════════════════════════════════
print("[ 3/27] Checking internal links and image references...")

def all_html_jsx_files():
    out = []
    for base in ("public", "src"):
        for root, dirs, files in os.walk(base):
            dirs[:] = [d for d in dirs if d != "node_modules"]
            for f in files:
                if f.endswith((".html", ".jsx")):
                    out.append(os.path.join(root, f))
    return out

broken_links, broken_images = [], []
for fpath in all_html_jsx_files():
    content = open(fpath, errors='ignore').read()
    for r in re.findall(r'href=[\'"](/[^\'">#]+\.html)[\'"]', content):
        if "your-post-slug" in r:
            continue  # known placeholder in blog.html example comment
        if not os.path.isfile(os.path.join("public", r.lstrip("/"))):
            broken_links.append((fpath, r))
    for r in re.findall(
        r'src=[\'"](/(?!\/)[^\'">]+\.(?:jpg|jpeg|png|svg|webp|gif|ico))[\'"]', content
    ):
        if not os.path.isfile(os.path.join("public", r.lstrip("/"))):
            broken_images.append((fpath, r))

for fpath, r in broken_links:  fail(f"{fpath} links to missing page: {r}")
for fpath, r in broken_images: fail(f"{fpath} references missing image: {r}")
if not broken_links:  ok("All internal page links resolve")
if not broken_images: ok("All image references resolve to real files")


# ════════════════════════════════════════════════════════════════════════════
# 4. EVERY HTML PAGE HAS A META DESCRIPTION — NO DUPLICATES
#    (Bing flagged 3 pages missing this; duplicates hurt SEO ranking)
# ════════════════════════════════════════════════════════════════════════════
print("[ 4/27] Checking meta descriptions and page titles...")
descs, titles, missing_desc = {}, {}, []
for root, dirs, files in os.walk("public"):
    for f in files:
        if f.endswith(".html"):
            path = os.path.join(root, f)
            content = open(path, errors='ignore').read()
            m = re.search(r'<meta name="description" content="([^"]*)"', content)
            if not m:
                missing_desc.append(path)
            else:
                descs.setdefault(m.group(1), []).append(path)
            m2 = re.search(r'<title>([^<]*)</title>', content)
            if m2:
                titles.setdefault(m2.group(1), []).append(path)

for path in missing_desc:
    fail(f"{path} is missing a meta description tag")
for desc, paths in descs.items():
    if len(paths) > 1:
        fail(f"Duplicate meta description used by: {paths}")
for title, paths in titles.items():
    if len(paths) > 1:
        fail(f"Duplicate <title> used by: {paths}")
if not missing_desc:
    ok(f"Every page has a meta description ({len(descs)} unique descriptions)")


# ════════════════════════════════════════════════════════════════════════════
# 5. CANONICAL / OG:URL / STRUCTURED-DATA SELF-CONSISTENCY
#    (pet-health-certificates page claimed to be the moving-page — same
#     root cause as duplicated content, metadata cross-contaminated)
# ════════════════════════════════════════════════════════════════════════════
print("[ 5/27] Checking metadata self-consistency...")
for root, dirs, files in os.walk("public"):
    for f in files:
        if f.endswith(".html"):
            path = os.path.join(root, f)
            content = open(path, errors='ignore').read()
            canonical   = re.search(r'<link rel="canonical" href="([^"]*)"', content)
            og_url      = re.search(r'<meta property="og:url" content="([^"]*)"', content)
            main_entity = re.search(r'"mainEntityOfPage":\s*"([^"]*)"', content)
            if canonical and og_url and canonical.group(1) != og_url.group(1):
                fail(f"{path}: canonical != og:url (cross-contaminated metadata)")
            if canonical and main_entity and canonical.group(1) != main_entity.group(1):
                fail(f"{path}: canonical != structured data mainEntityOfPage")
if not any("og:url" in i or "mainEntityOfPage" in i for i in issues):
    ok("Canonical/og:url/structured-data are self-consistent on all pages")


# ════════════════════════════════════════════════════════════════════════════
# 6. UNESCAPED USER INPUT IN EMAIL HTML
#    (pet names, trip names, contact form fields were going into email HTML
#     with no escaping — someone could inject HTML/script tags)
# ════════════════════════════════════════════════════════════════════════════
print("[ 6/27] Checking for unescaped user input in email templates...")
RISKY_FIELDS = [
    "name", "email", "subject", "message", "petName", "tripName",
    "ownerName", "description", "fullName", "affiliateName",
    "senderEmail", "userEmail", "vaccineName",
]
for root, dirs, files in os.walk("api"):
    for f in files:
        if f.endswith(".js"):
            path = os.path.join(root, f)
            content = open(path, errors='ignore').read()
            for field in RISKY_FIELDS:
                for m in re.finditer(
                    r'\$\{[^}]*\b' + re.escape(field) + r'\b[^}]*\}', content
                ):
                    snippet = m.group(0)
                    if 'esc(' in snippet or '.replace(/<' in snippet:
                        continue
                    context = content[max(0, m.start()-80):m.start()]
                    if '<' in context or 'html' in context.lower():
                        fail(f"{path}: '{field}' is not wrapped in esc() near HTML content")
                        break
if not any("esc()" in i for i in issues):
    ok("All known risky fields are escaped before reaching email HTML")


# ════════════════════════════════════════════════════════════════════════════
# 7. NO LEFTOVER STRIPE TEST-MODE ARTIFACTS
# ════════════════════════════════════════════════════════════════════════════
print("[ 7/27] Checking for Stripe test-mode artifacts...")
test_artifacts = subprocess.run(
    ["grep", "-rl",
     "--exclude-dir=scripts", "--exclude-dir=node_modules", "--exclude-dir=.git",
     "test_yourportalid", "."],
    capture_output=True, text=True
).stdout.strip()
if test_artifacts:
    fail(f"Stripe test-mode placeholder still present: {test_artifacts}")
else:
    ok("No Stripe test-mode artifacts found")


# ════════════════════════════════════════════════════════════════════════════
# 8. NODE_MODULES / DIST ARE GITIGNORED — NOT TRACKED
#    (accidentally committed 3,800+ node_modules files in one session)
# ════════════════════════════════════════════════════════════════════════════
print("[ 8/27] Checking git-tracked file hygiene...")
tracked = subprocess.run(
    ["git", "ls-tree", "-r", "HEAD", "--name-only"],
    capture_output=True, text=True
).stdout
bad = [l for l in tracked.splitlines()
       if l.startswith("node_modules/") or l.startswith("dist/")]
if bad:
    fail(f"{len(bad)} node_modules/dist files are tracked in git — should be gitignored")
else:
    ok("node_modules and dist are not tracked in git")


# ════════════════════════════════════════════════════════════════════════════
# 9. EVERY PUBLIC PAGE IS IN SITEMAP.XML
# ════════════════════════════════════════════════════════════════════════════
print("[ 9/27] Checking sitemap completeness...")
sitemap = open("public/sitemap.xml", errors='ignore').read() \
    if os.path.isfile("public/sitemap.xml") else ""
sitemap_urls = set(re.findall(
    r'<loc>(https://yourpetpass\.com[^<]*)</loc>', sitemap
))
missing_from_sitemap = []
for root, dirs, files in os.walk("public"):
    for f in files:
        if f.endswith(".html") and f not in ("404.html",):
            path = os.path.join(root, f)
            url_path = path.replace("public/", "/").replace("public", "")
            full_url = f"https://yourpetpass.com{url_path}"
            if full_url not in sitemap_urls:
                missing_from_sitemap.append(path)
for path in missing_from_sitemap:
    fail(f"{path} exists but is not listed in sitemap.xml")
if not missing_from_sitemap:
    ok(f"All public pages are listed in sitemap.xml ({len(sitemap_urls)} URLs)")


# ════════════════════════════════════════════════════════════════════════════
# 10. NO OVERSIZED PAGE-LOAD IMAGES
#     (3MB+ blog hero images caused page speed issues — fixed by compressing
#      them to ~130KB JPEGs; og-image.png is exempt, social platforms cache it)
# ════════════════════════════════════════════════════════════════════════════
print("[10/27] Checking image file sizes...")
MAX_KB = 500
EXEMPT = {"public/og-image.png"}
oversized = []
for root, dirs, files in os.walk("public"):
    for f in files:
        if f.lower().endswith((".jpg", ".jpeg", ".png", ".webp")):
            path = os.path.join(root, f)
            if path in EXEMPT:
                continue
            kb = os.path.getsize(path) / 1024
            if kb > MAX_KB:
                oversized.append((path, round(kb)))
for path, kb in oversized:
    fail(f"{path} is {kb}KB — over the {MAX_KB}KB guideline, compress before deploying")
if not oversized:
    ok(f"No page-load images over {MAX_KB}KB")


# ════════════════════════════════════════════════════════════════════════════
# 11. NO HARDCODED SECRETS COMMITTED
# ════════════════════════════════════════════════════════════════════════════
print("[11/27] Checking for hardcoded secrets...")
SECRET_PATTERNS = [
    (r'sk_live_[A-Za-z0-9]{10,}', "Stripe live secret key"),
    (r'whsec_[A-Za-z0-9]{10,}', "Stripe webhook secret"),
    (r're_[A-Za-z0-9]{20,}', "Resend API key"),
    (r'eyJ[A-Za-z0-9_-]{50,}', "Possible JWT/service key hardcoded"),
]
found_secrets = []
for root, dirs, files in os.walk("."):
    if any(skip in root for skip in ("node_modules", ".git", "dist", "scripts")):
        continue
    for f in files:
        if f.endswith((".js", ".jsx", ".html", ".json", ".env")):
            path = os.path.join(root, f)
            try:
                content = open(path, errors='ignore').read()
            except Exception:
                continue
            for pattern, label in SECRET_PATTERNS:
                if re.search(pattern, content):
                    found_secrets.append(f"{path}: looks like a hardcoded {label}")
for s in found_secrets:
    fail(s)
if not found_secrets:
    ok("No hardcoded secrets found in committed code")


# ════════════════════════════════════════════════════════════════════════════
# 12. EVERY <IMG> TAG HAS ALT TEXT
#     (7 images across PawRecord.jsx, Travel.jsx, Auth.jsx had none —
#      affects screen readers and SEO image indexing)
# ════════════════════════════════════════════════════════════════════════════
print("[12/27] Checking alt text on images...")
missing_alt = []
for fpath in all_html_jsx_files():
    content = open(fpath, errors='ignore').read()
    for tag in re.finditer(r'<img\s[^>]*>', content, re.DOTALL):
        if 'alt=' not in tag.group(0):
            line = content[:tag.start()].count('\n') + 1
            missing_alt.append(f"{fpath}:{line} — <img> tag with no alt attribute")
for m in missing_alt:
    fail(m)
if not missing_alt:
    ok("Every <img> tag has an alt attribute")


# ════════════════════════════════════════════════════════════════════════════
# 13. EVERY PAGE HAS VIEWPORT META TAG AND FAVICON LINK
# ════════════════════════════════════════════════════════════════════════════
print("[13/27] Checking viewport and favicon presence...")
missing_vp, missing_fav = [], []
for root, dirs, files in os.walk("public"):
    for f in files:
        if f.endswith(".html"):
            path = os.path.join(root, f)
            content = open(path, errors='ignore').read()
            if 'name="viewport"' not in content:
                missing_vp.append(path)
            if 'rel="icon"' not in content:
                missing_fav.append(path)
for p in missing_vp:  fail(f"{p} is missing the viewport meta tag")
for p in missing_fav: fail(f"{p} is missing a favicon link")
if not missing_vp:  ok("Every page has a viewport meta tag")
if not missing_fav: ok("Every page has a favicon link")


# ════════════════════════════════════════════════════════════════════════════
# 14. PUBLIC UNAUTHENTICATED ENDPOINTS — SPAM PROTECTION REMINDER
#     (contact-form, newsletter-signup, report-bug have no rate-limiting)
# ════════════════════════════════════════════════════════════════════════════
print("[14/27] Checking public endpoint spam protection...")
PUBLIC_ENDPOINTS = [
    "api/contact-form.js",
    "api/newsletter-signup.js",
    "api/report-bug.js",
]
for f in PUBLIC_ENDPOINTS:
    if os.path.isfile(f):
        content = open(f, errors='ignore').read()
        if not re.search(r'rate.?limit|captcha|honeypot', content, re.IGNORECASE):
            fail(f"{f} is a public unauthenticated endpoint with no spam protection (known open item — add rate-limiting before heavy marketing traffic)")


# ════════════════════════════════════════════════════════════════════════════
# 15. SUPABASE handle_new_user TRIGGER — MANUAL REMINDER
#     (June 29 2026: trigger was missing travel_credits_balance column after
#      we added it via ALTER TABLE — caused ALL new signups to fail silently
#      with "Database error saving new user". Fixed by rewriting the trigger
#      with EXCEPTION WHEN OTHERS THEN RETURN NEW safety net.)
#
#     WHAT TO DO AFTER EVERY "ALTER TABLE profiles ADD COLUMN" IN SUPABASE:
#     Run this in the Supabase SQL editor and verify the trigger INSERT
#     includes the new column (or that the column has a default so it's safe
#     to omit):
#
#     SELECT pg_get_functiondef(oid)
#     FROM pg_proc
#     WHERE proname = 'handle_new_user';
#
#     The current known-good trigger (as of June 29 2026) inserts:
#       id, email, full_name, avatar_url, subscription_tier (='free'),
#       travel_credits_balance (=0), email_notifications (=true),
#       is_admin (=false), phone_country_code (='+1'),
#       whatsapp_country_code (='+1')
#     All other columns have schema-level defaults and are safe to omit.
# ════════════════════════════════════════════════════════════════════════════
print("[15/27] Supabase trigger reminder...")
remind(
    "LIVE DATABASE CHECKS (audit.py can't reach the DB from CI):\n"
    "  Run the queries in scripts/schema_audit.sql in any Supabase-connected\n"
    "  session (MCP connector or SQL editor). They catch what the snapshot can't:\n"
    "    - handle_new_user trigger health (broken trigger = all signups fail silently)\n"
    "    - oversized storage photos (>500KB = slow/broken image loads)\n"
    "    - RLS enabled on every table (missing = data leak)\n"
    "    - documents bucket is public (private = every photo 404s)\n"
    "  ALSO: after ANY schema change, regenerate scripts/schema_snapshot.json\n"
    "  (query #1 in schema_audit.sql) or check 20 will drift."
)
ok("Trigger reminder noted (cannot auto-check from code — see REMINDERS below)")


# ════════════════════════════════════════════════════════════════════════════
# ─────────────────────────────────────────────────────────────────────────────
# DATABASE AUDIT — see scripts/db_audit.sql
# This code audit CANNOT see the Supabase database. The worst bugs of the
# June 2026 session were all database problems (missing columns, broken signup
# trigger) invisible to any code-only check. When a Supabase connection is
# available, ALSO run scripts/db_audit.sql — it checks the signup trigger,
# schema-vs-code column drift, RLS coverage, storage bucket visibility, and
# orphaned photo URLs. Run it during every review that has DB access.
# ─────────────────────────────────────────────────────────────────────────────

# 16. ENVIRONMENT VARIABLES INVENTORY
#     (informational — cross-check these are all set in Vercel dashboard)
# ════════════════════════════════════════════════════════════════════════════
print("[16/27] Collecting environment variable inventory...")
env_vars = set()
for root, dirs, files in os.walk("api"):
    for f in files:
        if f.endswith(".js"):
            content = open(os.path.join(root, f), errors='ignore').read()
            env_vars.update(re.findall(r'process\.env\.([A-Z_]+)', content))
for root, dirs, files in os.walk("src"):
    dirs[:] = [d for d in dirs if d != "node_modules"]
    for f in files:
        if f.endswith((".js", ".jsx")):
            content = open(os.path.join(root, f), errors='ignore').read()
            env_vars.update(re.findall(r'import\.meta\.env\.([A-Z_]+)', content))
ok(f"Found {len(env_vars)} environment variables (see inventory below)")


# ════════════════════════════════════════════════════════════════════════════
# 17. ENDPOINTS THAT ACT ON A USER MUST VERIFY THE TOKEN, NOT TRUST BODY userId
#     (ai-scan.js & ai-travel.js used to rate-limit on an unverified userId from
#      the request body — anyone could pass a fake id, skip the Premium gate,
#      and run up the AI bill. email-record.js was an open mail relay. The fix
#      pattern is verifyUser(req) from _verifyUser.js. This check flags any
#      endpoint that reads userId from the body but never calls verifyUser or
#      otherwise verifies an auth token.)
# ════════════════════════════════════════════════════════════════════════════
print("[17/27] Checking endpoint authentication...")
# Endpoints that are intentionally public (no user identity needed) — anything
# NOT in this list that touches userId/email must verify a token.
INTENTIONALLY_PUBLIC = {
    "api/contact-form.js",       # public form, rate-limited instead
    "api/newsletter-signup.js",  # public form, rate-limited instead
    "api/report-bug.js",         # public form, rate-limited instead
    "api/create-checkout.js",    # Stripe session; webhook verifies the truth
    "api/stripe-webhook.js",     # verifies Stripe signature instead of a user
    "api/prewarm-cache.js",      # protected by CRON_SECRET instead
    "api/send-notifications.js", # cron job, protected by CRON_SECRET
    "api/notify-error.js",       # internal, protected by webhook secret
    "api/notify-signup.js",      # internal webhook, verifies its own secret
    "api/notify-affiliate.js",   # called server-side by admin-data (already authed)
    "api/notify-user-action.js", # called server-side after an authed action
}
def endpoint_verifies_identity(content):
    return (
        "verifyUser(" in content or
        "/auth/v1/user" in content or
        "constructEvent" in content or          # stripe signature check
        "CRON_SECRET" in content or
        "WEBHOOK_SECRET" in content or
        "SIGNUP_WEBHOOK_SECRET" in content
    )
for f in sorted(subprocess.run(["find", "api", "-name", "*.js"],
                capture_output=True, text=True).stdout.split()):
    base = os.path.basename(f)
    if base.startswith("_"):
        continue  # helper module, not an endpoint
    if f in INTENTIONALLY_PUBLIC:
        continue
    content = open(f, errors='ignore').read()
    touches_user = re.search(r'\buserId\b|\buser_id\b|\buserEmail\b', content)
    if touches_user and not endpoint_verifies_identity(content):
        fail(f"{f} acts on a user identity but never verifies an auth token "
             f"(use verifyUser from _verifyUser.js). If it's intentionally public, "
             f"add it to INTENTIONALLY_PUBLIC in audit.py with a reason.")
if not any("never verifies an auth token" in i for i in issues):
    ok("All user-acting endpoints verify identity (or are documented public)")


# ════════════════════════════════════════════════════════════════════════════
# 18. NO ENDPOINT SENDS EMAIL FROM OUR DOMAIN WITHOUT AUTH OR A SECRET
#     (email-record.js was an open relay — anyone could send YourPetPass-branded
#      email to anyone. Any endpoint that calls Resend must first verify a user
#      token OR a server secret, or be a known public/rate-limited form.)
# ════════════════════════════════════════════════════════════════════════════
print("[18/27] Checking for open email relays...")
EMAIL_SENDERS_OK_PUBLIC = {
    "api/contact-form.js",       # rate-limited, only emails the admin (fixed recipient)
    "api/newsletter-signup.js",  # rate-limited, only stores/notifies admin
    "api/report-bug.js",         # rate-limited, only emails the admin (fixed recipient)
    "api/notify-signup.js", "api/notify-error.js", "api/notify-affiliate.js",
    "api/notify-user-action.js", "api/send-notifications.js", "api/stripe-webhook.js",
}
for f in sorted(subprocess.run(["find", "api", "-name", "*.js"],
                capture_output=True, text=True).stdout.split()):
    if os.path.basename(f).startswith("_"):
        continue
    content = open(f, errors='ignore').read()
    sends_email = "api.resend.com" in content or "resend.com/emails" in content
    if not sends_email:
        continue
    if f in EMAIL_SENDERS_OK_PUBLIC:
        continue
    # Must verify a user token or a secret before sending
    if not endpoint_verifies_identity(content):
        fail(f"{f} sends email via Resend but doesn't verify a user token or secret "
             f"— possible open relay. Add verifyUser or document it in audit.py.")
if not any("possible open relay" in i for i in issues):
    ok("No unauthenticated email-sending endpoints (no open relays)")


# ════════════════════════════════════════════════════════════════════════════
# 19. .env FILES ARE GITIGNORED
#     (prevents accidentally committing secrets in a local .env)
# ════════════════════════════════════════════════════════════════════════════
print("[19/27] Checking .env is gitignored...")
gitignore = open(".gitignore", errors='ignore').read() if os.path.isfile(".gitignore") else ""
if re.search(r'^\.env', gitignore, re.MULTILINE):
    ok(".env files are gitignored")
else:
    fail(".gitignore does not exclude .env files — a local .env with secrets could be committed")
# Also confirm no .env is actually tracked right now
tracked_env = [l for l in subprocess.run(
    ["git", "ls-tree", "-r", "HEAD", "--name-only"],
    capture_output=True, text=True).stdout.splitlines()
    if l == ".env" or l.startswith(".env.")]
if tracked_env:
    fail(f"A .env file is committed to git: {tracked_env} — remove it and rotate those secrets")


# ════════════════════════════════════════════════════════════════════════════
# 20. DATABASE SCHEMA DRIFT — CODE WRITES COLUMNS THAT EXIST IN THE DB
#     (This is the big one. The trips.transportation_type bug and the
#      affiliates.payout_paypal/payout_stripe_email bug were BOTH this: the
#      code writes a column the database doesn't have, so the operation fails
#      silently — trip creation broke, affiliate payout saving broke, with no
#      error the user could understand.
#
#      audit.py has no live DB connection in CI, so it checks the code against
#      scripts/schema_snapshot.json — a committed snapshot of the real schema.
#      REGENERATE THE SNAPSHOT after any schema change using query #1 in
#      scripts/schema_audit.sql. If the snapshot is stale this check gives false
#      positives, which is itself a useful signal that someone changed the DB
#      without updating the snapshot.)
# ════════════════════════════════════════════════════════════════════════════
print("[20/27] Checking database schema drift (code vs schema_snapshot.json)...")
snap_path = "scripts/schema_snapshot.json"
if not os.path.isfile(snap_path):
    fail("scripts/schema_snapshot.json is missing — cannot check schema drift. "
         "Regenerate it with query #1 in scripts/schema_audit.sql.")
else:
    snapshot = json.load(open(snap_path))
    snapshot = {k: set(v) for k, v in snapshot.items() if not k.startswith("_")}

    drift = []
    src_files = []
    for base in ("src", "api"):
        for root, dirs, files in os.walk(base):
            dirs[:] = [d for d in dirs if d != "node_modules"]
            for f in files:
                if f.endswith((".js", ".jsx")):
                    src_files.append(os.path.join(root, f))

    # Only match DIRECTLY chained .from("table").insert/update/upsert({...})
    # to avoid the false positives that plagued the naive version.
    chain_pat = re.compile(
        r'\.from\(\s*[\'"`](\w+)[\'"`]\s*\)\s*\.(insert|update|upsert)\(\s*(\{)',
        re.DOTALL,
    )
    for fp in src_files:
        content = open(fp, errors="ignore").read()
        for m in chain_pat.finditer(content):
            table = m.group(1)
            if table not in snapshot:
                continue  # unknown table (view, storage, etc.) — skip
            obj_start = m.start(3)
            depth = 0
            keys = []
            i = obj_start
            buf = content[obj_start:obj_start + 3000]
            # extract only top-level keys of the object literal
            d = 0
            for km in re.finditer(r'([{}])|(\w+)\s*:', buf):
                if km.group(1) == "{":
                    d += 1
                elif km.group(1) == "}":
                    d -= 1
                    if d == 0:
                        break
                elif km.group(2) and d == 1:
                    keys.append(km.group(2))
            for k in keys:
                if k not in snapshot[table]:
                    drift.append(f"{fp}: writes '{k}' to '{table}' — column not in schema_snapshot.json "
                                 f"(either the DB is missing it, or the snapshot is stale)")
    for d in sorted(set(drift)):
        fail(d)
    if not drift:
        ok("No schema drift — every column the code writes exists in the schema snapshot")


# ════════════════════════════════════════════════════════════════════════════
# 21. NO SUPABASE QUERY REFERENCES A TABLE THAT DOESN'T EXIST
#     (This exact bug hit 3 times this session: admin-data.js's delete_user
#      called a table named "vets" (real: saved_vets); PawRecord.jsx's pet
#      deletion and Emergency.jsx's public QR page both called a table named
#      "visits" (real: vet_visits). Every one of them failed silently or
#      partially. This check would have caught all three in one run.)
# ════════════════════════════════════════════════════════════════════════════
print("[21/27] Checking every supabase.from(...) call references a real table...")
if not os.path.isfile(snap_path):
    fail("Can't run check 21 without scripts/schema_snapshot.json (see check 20).")
else:
    known_tables = {k for k in json.load(open(snap_path)) if not k.startswith("_")}
    from_pat = re.compile(r'supabase\s*\.\s*from\(\s*[\'"`](\w+)[\'"`]\s*\)')
    bad_refs = []
    for fp in src_files:
        content = open(fp, errors="ignore").read()
        for m in from_pat.finditer(content):
            table = m.group(1)
            if table not in known_tables:
                line = content[:m.start()].count("\n") + 1
                bad_refs.append(f"{fp}:{line}: supabase.from(\"{table}\") — no such table "
                                 f"(check for a typo, e.g. missing prefix/suffix like vet_ or saved_)")
    for r in sorted(set(bad_refs)):
        fail(r)
    if not bad_refs:
        ok("Every supabase.from(...) call references a table that actually exists")


# ════════════════════════════════════════════════════════════════════════════
# 22. AI SCAN ACTUALLY SAVES THE SCANNED DOCUMENT, NOT JUST THE EXTRACTED DATA
#     (db.addDocument existed but was never called by anything — AI Scan
#      extracted structured data from an upload and silently discarded the
#      source file. 0 rows in the documents table despite real usage.)
# ════════════════════════════════════════════════════════════════════════════
print("[22/27] Checking AI Scan persists the scanned document...")
pawrecord_content = open("src/PawRecord.jsx", errors="ignore").read()
db_content = open("src/lib/db.js", errors="ignore").read()
if "export const addDocument" not in db_content:
    fail("src/lib/db.js no longer defines addDocument — if this was intentionally "
         "renamed/removed, update this check too.")
elif "db.addDocument(" not in pawrecord_content:
    fail("db.addDocument is defined but never called anywhere in PawRecord.jsx — "
         "the AI Scan (or any other) upload flow isn't actually saving documents. "
         "This is exactly the bug fixed July 2026; don't let it regress.")
else:
    ok("AI Scan calls db.addDocument — scanned files are actually being saved")


# ════════════════════════════════════════════════════════════════════════════
# 23. PDF GENERATION DOESN'T INJECT A FULL HTML DOCUMENT INTO innerHTML
#     (buildRecordHTML() returns a full <!DOCTYPE><html><head><body> document.
#      Assigning that directly to a <div>'s innerHTML before handing it to
#      html2pdf/html2canvas produces a BLANK PDF — browsers silently drop
#      structural tags a fragment parser can't place. Must go through
#      extractPdfFragment() first, which pulls out just the <style> + body
#      content. Emailed and directly-exported PDFs both hit this.)
# ════════════════════════════════════════════════════════════════════════════
print("[23/27] Checking PDF generation doesn't inject a raw HTML document...")
if "extractPdfFragment" not in pawrecord_content:
    fail("extractPdfFragment is missing from PawRecord.jsx — PDF generation may be "
         "injecting a full HTML document into innerHTML again (blank PDF bug).")
else:
    # Every container.innerHTML= immediately preceding a window.html2pdf() call
    # (within a small window of code) must go through extractPdfFragment(...).
    html2pdf_calls = [m.start() for m in re.finditer(r'window\.html2pdf\(\)', pawrecord_content)]
    unsafe = []
    for pos in html2pdf_calls:
        window_before = pawrecord_content[max(0, pos - 400):pos]
        inner_html_sets = re.findall(r'\.innerHTML\s*=\s*([^;]+);', window_before)
        for expr in inner_html_sets[-1:]:  # the one immediately before this html2pdf() call
            if "extractPdfFragment(" not in expr:
                line = pawrecord_content[:pos].count("\n") + 1
                unsafe.append(f"src/PawRecord.jsx:~{line}: innerHTML set to `{expr.strip()}` "
                               f"right before window.html2pdf() — should be wrapped in extractPdfFragment(...)")
    for u in sorted(set(unsafe)):
        fail(u)
    if not unsafe:
        ok("PDF generation uses extractPdfFragment — no raw document injected into innerHTML")


# ════════════════════════════════════════════════════════════════════════════
# 24. PREWARM-CACHE AND AI-TRAVEL AGREE ON THE TRUSTED-CALLER HEADER
#     (ai-travel.js was hardened to require a real verified user session, but
#      prewarm-cache.js still called it with no auth at all — 100% failure
#      rate, silently, on every single route, every run. Fixed with a scoped
#      bypass using CRON_SECRET as the trust boundary; this check makes sure
#      a future refactor of either file can't quietly break that pairing.)
# ════════════════════════════════════════════════════════════════════════════
print("[24/27] Checking prewarm-cache <-> ai-travel trusted-caller header matches...")
prewarm_content = open("api/prewarm-cache.js", errors="ignore").read()
ai_travel_content = open("api/ai-travel.js", errors="ignore").read()
if "x-prewarm-secret" not in prewarm_content:
    fail("api/prewarm-cache.js no longer sends the x-prewarm-secret header — "
         "every prewarm call will silently fail ai-travel.js's auth check again.")
elif "x-prewarm-secret" not in ai_travel_content:
    fail("api/ai-travel.js no longer checks the x-prewarm-secret header — "
         "prewarm-cache.js's calls will be rejected by verifyUser() with no bypass.")
elif "CRON_SECRET" not in ai_travel_content:
    fail("api/ai-travel.js's prewarm bypass no longer references CRON_SECRET — "
         "confirm the trust boundary is still tied to a real secret, not left open.")
else:
    ok("prewarm-cache.js and ai-travel.js agree on the trusted-caller header")


# ════════════════════════════════════════════════════════════════════════════
# 25. NO KNOWN VULNERABILITIES IN PRODUCTION DEPENDENCIES
#     (Added July 2026 as part of a full security review. Client-side file
#      type validation, dependency health, security headers, and CORS
#      posture were all reviewed together — this and the next two checks
#      cover what's meaningfully automatable from that pass.)
# ════════════════════════════════════════════════════════════════════════════
print("[25/27] Checking npm audit for known vulnerabilities (production deps)...")
try:
    npm_result = subprocess.run(
        ["npm", "audit", "--production", "--json"],
        capture_output=True, text=True, timeout=60
    )
    audit_data = json.loads(npm_result.stdout) if npm_result.stdout else {}
    vuln_count = audit_data.get("metadata", {}).get("vulnerabilities", {}).get("total", None)
    if vuln_count is None:
        remind("Could not parse npm audit output — run `npm audit --production` manually to check.")
    elif vuln_count > 0:
        sev = audit_data.get("metadata", {}).get("vulnerabilities", {})
        fail(f"npm audit found {vuln_count} known vulnerabilities in production dependencies "
             f"({sev}). Run `npm audit --production` for details, `npm audit fix` for auto-fixable ones.")
    else:
        ok("npm audit — 0 known vulnerabilities in production dependencies")
except Exception as e:
    remind(f"Could not run npm audit ({e}) — run it manually to check dependency vulnerabilities.")


# ════════════════════════════════════════════════════════════════════════════
# 26. CORE SECURITY HEADERS PRESENT IN vercel.json
#     (nosniff and frame-options are cheap, meaningful, easy to accidentally
#      lose in a future vercel.json edit — worth a permanent check.)
# ════════════════════════════════════════════════════════════════════════════
print("[26/27] Checking core security headers are configured in vercel.json...")
try:
    vercel_config = json.load(open("vercel.json"))
    header_entries = vercel_config.get("headers", [])
    all_header_keys = set()
    for entry in header_entries:
        for h in entry.get("headers", []):
            all_header_keys.add(h.get("key"))
    required_headers = ["X-Content-Type-Options", "X-Frame-Options", "Referrer-Policy"]
    missing = [h for h in required_headers if h not in all_header_keys]
    if missing:
        fail(f"vercel.json is missing security header(s): {', '.join(missing)}")
    else:
        ok("Core security headers (nosniff, frame-options, referrer-policy) present in vercel.json")
    if "Content-Security-Policy" not in all_header_keys:
        remind("No Content-Security-Policy header configured. Meaningful additional XSS defense, "
               "but takes real care to configure correctly for this stack (Stripe, CDN scripts, "
               "Supabase storage, etc.) without breaking something — worth doing eventually, not urgent "
               "given the other protections already in place.")
except Exception as e:
    remind(f"Could not check vercel.json security headers ({e}).")


# ════════════════════════════════════════════════════════════════════════════
# 27. NO SERVICE-ROLE OR OTHER SECRET KEYS LEAK INTO THE CLIENT BUNDLE
#     (Only VITE_-prefixed env vars ever reach the browser — anything else
#      referenced with import.meta.env in src/ would be undefined at
#      runtime, but catching a stray reference here is cheap insurance.
#      VITE_SUPABASE_ANON_KEY and VITE_SUPABASE_URL are supposed to be
#      public — Supabase's security model relies on RLS, not on hiding the
#      anon key. Anything else is a red flag.)
# ════════════════════════════════════════════════════════════════════════════
print("[27/27] Checking no unexpected secrets are exposed to the client bundle...")
allowed_public_vars = {"VITE_SUPABASE_ANON_KEY", "VITE_SUPABASE_URL", "VITE_APP_URL"}
found_vite_vars = set()
for fp in src_files:
    content = open(fp, errors="ignore").read()
    found_vite_vars.update(re.findall(r'VITE_[A-Z_]+', content))
unexpected = found_vite_vars - allowed_public_vars
if unexpected:
    fail(f"Unexpected VITE_-prefixed var(s) referenced in client code (these get bundled into "
         f"the public JS): {', '.join(sorted(unexpected))}. If any of these are meant to be secret, "
         f"they must never be prefixed VITE_ — move the logic server-side instead.")
else:
    ok("No unexpected secrets exposed to the client bundle — only the public anon key/URL")


# ════════════════════════════════════════════════════════════════════════════
# REPORT
# ════════════════════════════════════════════════════════════════════════════
print("\n" + "=" * 65)
print(f"PASSED  ({len(passed)})")
for p in passed:
    print(f"  ✓  {p}")

if reminders:
    print(f"\nREMINDERS — manual checks required ({len(reminders)})")
    for r in reminders:
        for line in r.split('\n'):
            print(f"  ▸  {line}")

print(f"\nISSUES FOUND  ({len(issues)})")
if issues:
    for i in issues:
        print(f"  ✗  {i}")
else:
    print("  None — site is clean.")

print(f"\nENVIRONMENT VARIABLES EXPECTED ({len(env_vars)})")
print("  Cross-check these are all set in your Vercel dashboard:")
for v in sorted(env_vars):
    print(f"  -  {v}")

print("=" * 65)
sys.exit(1 if issues else 0)
