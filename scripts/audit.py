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
print("[ 1/16] Running build...")
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
print("[ 2/16] Checking for duplicated file content...")
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
print("[ 3/16] Checking internal links and image references...")

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
print("[ 4/16] Checking meta descriptions and page titles...")
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
print("[ 5/16] Checking metadata self-consistency...")
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
print("[ 6/16] Checking for unescaped user input in email templates...")
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
print("[ 7/16] Checking for Stripe test-mode artifacts...")
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
print("[ 8/16] Checking git-tracked file hygiene...")
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
print("[ 9/16] Checking sitemap completeness...")
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
print("[10/16] Checking image file sizes...")
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
print("[11/16] Checking for hardcoded secrets...")
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
print("[12/16] Checking alt text on images...")
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
print("[13/16] Checking viewport and favicon presence...")
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
print("[14/16] Checking public endpoint spam protection...")
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
print("[15/16] Supabase trigger reminder...")
remind(
    "MANUAL CHECK after any 'ALTER TABLE profiles ADD COLUMN':\n"
    "  Verify handle_new_user trigger in Supabase SQL editor:\n"
    "  SELECT pg_get_functiondef(oid) FROM pg_proc WHERE proname = 'handle_new_user';\n"
    "  A broken trigger causes ALL new signups to fail silently."
)
ok("Trigger reminder noted (cannot auto-check from code — see REMINDERS below)")


# ════════════════════════════════════════════════════════════════════════════
# 16. ENVIRONMENT VARIABLES INVENTORY
#     (informational — cross-check these are all set in Vercel dashboard)
# ════════════════════════════════════════════════════════════════════════════
print("[16/16] Collecting environment variable inventory...")
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
