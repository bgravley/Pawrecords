#!/usr/bin/env python3
"""
audit.py — YourPetPass full-site audit script
==============================================
Run this every time a review is requested instead of improvising checks.
Every check here exists because a real bug or material risk was found.
When a new bug is found, add a check here so it is not missed again.
"""

import json
import os
import re
import subprocess
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
os.chdir(ROOT)

issues = []
passed = []
reminders = []

def fail(msg):
    issues.append(msg)

def ok(msg):
    passed.append(msg)

def remind(msg):
    reminders.append(msg)

def read(path):
    return open(path, errors="ignore").read()

def run(cmd, **kwargs):
    return subprocess.run(cmd, capture_output=True, text=True, **kwargs)

def all_files(base_dirs, suffixes):
    out = []
    for base in base_dirs:
        if not os.path.isdir(base):
            continue
        for root, dirs, files in os.walk(base):
            dirs[:] = [d for d in dirs if d not in {"node_modules", ".git", "dist"}]
            for f in files:
                if f.endswith(suffixes):
                    out.append(os.path.join(root, f))
    return out

def all_html_jsx_files():
    return all_files(("public", "src"), (".html", ".jsx"))

def matching_brace_end(text, start):
    depth = 0
    quote = None
    escape = False
    line_comment = False
    block_comment = False
    i = start
    while i < len(text):
        ch = text[i]
        nxt = text[i + 1] if i + 1 < len(text) else ""
        if line_comment:
            if ch == "\n":
                line_comment = False
            i += 1
            continue
        if block_comment:
            if ch == "*" and nxt == "/":
                block_comment = False
                i += 2
                continue
            i += 1
            continue
        if quote:
            if escape:
                escape = False
            elif ch == "\\":
                escape = True
            elif ch == quote:
                quote = None
            i += 1
            continue
        if ch in {"'", '"', "`"}:
            quote = ch
            i += 1
            continue
        if ch == "/" and nxt == "/":
            line_comment = True
            i += 2
            continue
        if ch == "/" and nxt == "*":
            block_comment = True
            i += 2
            continue
        if ch == "{":
            depth += 1
        elif ch == "}":
            depth -= 1
            if depth == 0:
                return i
        i += 1
    return None

def split_top_level_props(obj_text):
    props = []
    start = 0
    braces = brackets = parens = 0
    quote = None
    escape = False
    line_comment = False
    block_comment = False
    i = 0
    while i < len(obj_text):
        ch = obj_text[i]
        nxt = obj_text[i + 1] if i + 1 < len(obj_text) else ""
        if line_comment:
            if ch == "\n":
                line_comment = False
            i += 1
            continue
        if block_comment:
            if ch == "*" and nxt == "/":
                block_comment = False
                i += 2
                continue
            i += 1
            continue
        if quote:
            if escape:
                escape = False
            elif ch == "\\":
                escape = True
            elif ch == quote:
                quote = None
            i += 1
            continue
        if ch in {"'", '"', "`"}:
            quote = ch
            i += 1
            continue
        if ch == "/" and nxt == "/":
            line_comment = True
            i += 2
            continue
        if ch == "/" and nxt == "*":
            block_comment = True
            i += 2
            continue
        if ch == "{":
            braces += 1
        elif ch == "}":
            braces -= 1
        elif ch == "[":
            brackets += 1
        elif ch == "]":
            brackets -= 1
        elif ch == "(":
            parens += 1
        elif ch == ")":
            parens -= 1
        elif ch == "," and braces == brackets == parens == 0:
            props.append(obj_text[start:i])
            start = i + 1
        i += 1
    props.append(obj_text[start:])
    return props

def first_top_level_colon(prop):
    braces = brackets = parens = 0
    quote = None
    escape = False
    for i, ch in enumerate(prop):
        if quote:
            if escape:
                escape = False
            elif ch == "\\":
                escape = True
            elif ch == quote:
                quote = None
            continue
        if ch in {"'", '"', "`"}:
            quote = ch
            continue
        if ch == "{":
            braces += 1
        elif ch == "}":
            braces -= 1
        elif ch == "[":
            brackets += 1
        elif ch == "]":
            brackets -= 1
        elif ch == "(":
            parens += 1
        elif ch == ")":
            parens -= 1
        elif ch == ":" and braces == brackets == parens == 0:
            return i
    return -1

def extract_object_keys(text, brace_start):
    end = matching_brace_end(text, brace_start)
    if end is None:
        return []
    body = text[brace_start + 1:end]
    keys = []
    reserved = {"null", "undefined", "true", "false", "return", "case", "default"}
    for prop in split_top_level_props(body):
        prop = prop.strip()
        if not prop or prop.startswith("..."):
            continue
        colon = first_top_level_colon(prop)
        if colon < 0:
            continue
        raw_key = prop[:colon].strip()
        m = re.match(r'^[\'\"]([A-Za-z_$][\w$]*)[\'\"]$', raw_key) or re.match(r'^([A-Za-z_$][\w$]*)$', raw_key)
        if not m:
            continue
        key = m.group(1)
        if key not in reserved:
            keys.append(key)
    return keys

print("[ 1/28] Running build...")
result = run(["npm", "run", "build"])
if result.returncode != 0:
    fail(f"BUILD FAILED:\n{result.stdout[-2000:]}\n{result.stderr[-2000:]}")
else:
    ok("Build succeeds cleanly")

print("[ 2/28] Checking for duplicated file content...")
for f in run(["find", "public", "-name", "*.html"]).stdout.split():
    if read(f).count("<!DOCTYPE html>") > 1:
        fail(f"{f} has multiple DOCTYPE declarations — file content is duplicated")
for path in all_files(("src", "api"), (".jsx", ".js")):
    if read(path).count("export default") > 1:
        fail(f"{path} has multiple 'export default' — likely duplicated content")
if not any("DOCTYPE" in i or "export default" in i for i in issues):
    ok("No duplicated file content found")

print("[ 3/28] Checking internal links and image references...")
broken_links, broken_images = [], []
for fpath in all_html_jsx_files():
    content = read(fpath)
    for href in re.findall(r'href=[\'\"](/[^\'\">#]+\.html)[\'\"]', content):
        if "your-post-slug" not in href and not os.path.isfile(os.path.join("public", href.lstrip("/"))):
            broken_links.append((fpath, href))
    for src in re.findall(r'src=[\'\"](/(?!/)[^\'\">]+\.(?:jpg|jpeg|png|svg|webp|gif|ico))[\'\"]', content):
        if not os.path.isfile(os.path.join("public", src.lstrip("/"))):
            broken_images.append((fpath, src))
for fpath, href in broken_links:
    fail(f"{fpath} links to missing page: {href}")
for fpath, src in broken_images:
    fail(f"{fpath} references missing image: {src}")
if not broken_links:
    ok("All internal page links resolve")
if not broken_images:
    ok("All image references resolve to real files")

print("[ 4/28] Checking meta descriptions and page titles...")
descs, titles, missing_desc = {}, {}, []
for path in all_files(("public",), (".html",)):
    content = read(path)
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

print("[ 5/28] Checking metadata self-consistency...")
metadata_issues = []
for path in all_files(("public",), (".html",)):
    content = read(path)
    canonical = re.search(r'<link rel="canonical" href="([^"]*)"', content)
    og_url = re.search(r'<meta property="og:url" content="([^"]*)"', content)
    main_entity = re.search(r'"mainEntityOfPage":\s*"([^"]*)"', content)
    if canonical and og_url and canonical.group(1) != og_url.group(1):
        metadata_issues.append(f"{path}: canonical != og:url (cross-contaminated metadata)")
    if canonical and main_entity and canonical.group(1) != main_entity.group(1):
        metadata_issues.append(f"{path}: canonical != structured data mainEntityOfPage")
for i in metadata_issues:
    fail(i)
if not metadata_issues:
    ok("Canonical/og:url/structured-data are self-consistent on all pages")

print("[ 6/28] Checking for unescaped user input in email templates...")
risky_fields = ["name", "email", "subject", "message", "petName", "tripName", "ownerName", "description", "fullName", "affiliateName", "senderEmail", "userEmail", "vaccineName"]
email_escape_issues = []
for path in all_files(("api",), (".js",)):
    content = read(path)
    for field in risky_fields:
        for m in re.finditer(r'\$\{[^}]*\b' + re.escape(field) + r'\b[^}]*\}', content):
            snippet = m.group(0)
            if 'esc(' in snippet or '.replace(/<' in snippet:
                continue
            context = content[max(0, m.start() - 80):m.start()]
            if '<' in context or 'html' in context.lower():
                email_escape_issues.append(f"{path}: '{field}' is not wrapped in esc() near HTML content")
                break
for i in sorted(set(email_escape_issues)):
    fail(i)
if not email_escape_issues:
    ok("All known risky fields are escaped before reaching email HTML")

print("[ 7/28] Checking for Stripe test-mode artifacts...")
test_artifacts = run(["grep", "-rl", "--exclude-dir=scripts", "--exclude-dir=node_modules", "--exclude-dir=.git", "test_yourportalid", "."]).stdout.strip()
if test_artifacts:
    fail(f"Stripe test-mode placeholder still present: {test_artifacts}")
else:
    ok("No Stripe test-mode artifacts found")

print("[ 8/28] Checking git-tracked file hygiene...")
tracked = run(["git", "ls-tree", "-r", "HEAD", "--name-only"]).stdout
bad = [l for l in tracked.splitlines() if l.startswith("node_modules/") or l.startswith("dist/")]
if bad:
    fail(f"{len(bad)} node_modules/dist files are tracked in git — should be gitignored")
else:
    ok("node_modules and dist are not tracked in git")

print("[ 9/28] Checking sitemap completeness...")
sitemap = read("public/sitemap.xml") if os.path.isfile("public/sitemap.xml") else ""
sitemap_urls = set(re.findall(r'<loc>(https://www\.yourpetpass\.com[^<]*)</loc>', sitemap))
missing_from_sitemap = []
for path in all_files(("public",), (".html",)):
    if os.path.basename(path) == "404.html":
        continue
    content = read(path)
    if re.search(r'<meta[^>]+name=["\']robots["\'][^>]+content=["\'][^"\']*noindex', content, re.IGNORECASE):
        continue
    full_url = "https://www.yourpetpass.com" + path.replace("public/", "/")
    if full_url not in sitemap_urls:
        missing_from_sitemap.append(path)
for path in missing_from_sitemap:
    fail(f"{path} exists but is not listed in sitemap.xml")
if not missing_from_sitemap:
    ok(f"All public pages are listed in sitemap.xml ({len(sitemap_urls)} URLs)")

print("[10/28] Checking image file sizes...")
oversized = []
for path in all_files(("public",), (".jpg", ".jpeg", ".png", ".webp")):
    if path == "public/og-image.png":
        continue
    kb = os.path.getsize(path) / 1024
    if kb > 500:
        oversized.append((path, round(kb)))
for path, kb in oversized:
    fail(f"{path} is {kb}KB — over the 500KB guideline, compress before deploying")
if not oversized:
    ok("No page-load images over 500KB")

print("[11/28] Checking for hardcoded secrets...")
secret_patterns = [(r'sk_live_[A-Za-z0-9]{10,}', "Stripe live secret key"), (r'whsec_[A-Za-z0-9]{10,}', "Stripe webhook secret"), (r're_[A-Za-z0-9]{20,}', "Resend API key"), (r'eyJ[A-Za-z0-9_-]{50,}', "Possible JWT/service key hardcoded")]
found_secrets = []
for path in all_files((".",), (".js", ".jsx", ".html", ".json", ".env")):
    if any(skip in path for skip in ("node_modules", ".git", "dist", "scripts")):
        continue
    content = read(path)
    for pattern, label in secret_patterns:
        if re.search(pattern, content):
            found_secrets.append(f"{path}: looks like a hardcoded {label}")
for s in found_secrets:
    fail(s)
if not found_secrets:
    ok("No hardcoded secrets found in committed code")

print("[12/28] Checking alt text on images...")
missing_alt = []
for fpath in all_html_jsx_files():
    content = read(fpath)
    for tag in re.finditer(r'<img\s[^>]*>', content, re.DOTALL):
        if 'alt=' not in tag.group(0):
            missing_alt.append(f"{fpath}:{content[:tag.start()].count(chr(10)) + 1} — <img> tag with no alt attribute")
for m in missing_alt:
    fail(m)
if not missing_alt:
    ok("Every <img> tag has an alt attribute")

print("[13/28] Checking viewport and favicon presence...")
missing_vp, missing_fav = [], []
for path in all_files(("public",), (".html",)):
    content = read(path)
    if 'name="viewport"' not in content:
        missing_vp.append(path)
    if 'rel="icon"' not in content:
        missing_fav.append(path)
for p in missing_vp:
    fail(f"{p} is missing the viewport meta tag")
for p in missing_fav:
    fail(f"{p} is missing a favicon link")
if not missing_vp:
    ok("Every page has a viewport meta tag")
if not missing_fav:
    ok("Every page has a favicon link")

print("[14/28] Checking public endpoint spam protection...")
for f in ["api/contact-form.js", "api/newsletter-signup.js", "api/report-bug.js"]:
    if os.path.isfile(f) and not re.search(r'rate.?limit|captcha|honeypot', read(f), re.IGNORECASE):
        fail(f"{f} is a public unauthenticated endpoint with no spam protection (known open item — add rate-limiting before heavy marketing traffic)")

print("[15/28] Supabase trigger reminder...")
remind("LIVE DATABASE CHECKS (audit.py can't reach the DB from CI):\n  Run scripts/schema_audit.sql in a Supabase-connected session. It checks signup trigger health, oversized storage photos, RLS on every table, document bucket privacy, and schema snapshot freshness.")
ok("Trigger reminder noted (cannot auto-check from code — see REMINDERS below)")

print("[16/28] Collecting environment variable inventory...")
env_vars = set()
for path in all_files(("api",), (".js",)):
    env_vars.update(re.findall(r'process\.env\.([A-Z0-9_]+)', read(path)))
for path in all_files(("src",), (".js", ".jsx")):
    env_vars.update(re.findall(r'import\.meta\.env\.([A-Z0-9_]+)', read(path)))
ok(f"Found {len(env_vars)} environment variables (see inventory below)")

print("[17/28] Checking endpoint authentication...")
intentionally_public = {"api/contact-form.js", "api/newsletter-signup.js", "api/report-bug.js", "api/create-checkout.js", "api/stripe-webhook.js", "api/prewarm-cache.js", "api/send-notifications.js", "api/notify-error.js", "api/notify-signup.js", "api/notify-affiliate.js", "api/notify-user-action.js"}
def endpoint_verifies_identity(content):
    return any(token in content for token in ["verifyUser(", "/auth/v1/user", "constructEvent", "verifyCronRequest(", "CRON_SECRET", "WEBHOOK_SECRET", "SIGNUP_WEBHOOK_SECRET", "verifyUnsubscribeToken("])
endpoint_auth_issues = []
for f in sorted(all_files(("api",), (".js",))):
    if os.path.basename(f).startswith("_") or f in intentionally_public:
        continue
    content = read(f)
    if re.search(r'\buserId\b|\buser_id\b|\buserEmail\b', content) and not endpoint_verifies_identity(content):
        endpoint_auth_issues.append(f"{f} acts on a user identity but never verifies an auth token (use verifyUser from _verifyUser.js or document the exception).")
for i in endpoint_auth_issues:
    fail(i)
if not endpoint_auth_issues:
    ok("All user-acting endpoints verify identity (or are documented public)")

print("[18/28] Checking for open email relays...")
email_senders_ok_public = {"api/contact-form.js", "api/newsletter-signup.js", "api/report-bug.js", "api/notify-signup.js", "api/notify-error.js", "api/notify-affiliate.js", "api/notify-user-action.js", "api/send-notifications.js", "api/stripe-webhook.js"}
relay_issues = []
for f in sorted(all_files(("api",), (".js",))):
    if os.path.basename(f).startswith("_"):
        continue
    content = read(f)
    if ("api.resend.com" in content or "resend.com/emails" in content) and f not in email_senders_ok_public and not endpoint_verifies_identity(content):
        relay_issues.append(f"{f} sends email via Resend but doesn't verify a user token or secret — possible open relay.")
for i in relay_issues:
    fail(i)
if not relay_issues:
    ok("No unauthenticated email-sending endpoints (no open relays)")

print("[19/28] Checking .env is gitignored...")
gitignore = read(".gitignore") if os.path.isfile(".gitignore") else ""
if re.search(r'^\.env', gitignore, re.MULTILINE):
    ok(".env files are gitignored")
else:
    fail(".gitignore does not exclude .env files — a local .env with secrets could be committed")
tracked_env = [l for l in tracked.splitlines() if l == ".env" or l.startswith(".env.")]
if tracked_env:
    fail(f"A .env file is committed to git: {tracked_env} — remove it and rotate those secrets")

print("[20/28] Checking database schema drift (code vs schema_snapshot.json)...")
snap_path = "scripts/schema_snapshot.json"
src_files = all_files(("src", "api"), (".js", ".jsx"))
snapshot = {}
if not os.path.isfile(snap_path):
    fail("scripts/schema_snapshot.json is missing — cannot check schema drift. Regenerate it with query #1 in scripts/schema_audit.sql.")
else:
    snapshot = {k: set(v) for k, v in json.load(open(snap_path)).items() if not k.startswith("_")}
    chain_pat = re.compile(r'\.from\(\s*[\'"`](\w+)[\'"`]\s*\)\s*\.(insert|update|upsert)\(\s*(\{)', re.DOTALL)
    drift = []
    for fp in src_files:
        content = read(fp)
        for m in chain_pat.finditer(content):
            table = m.group(1)
            if table not in snapshot:
                continue
            for key in extract_object_keys(content, m.start(3)):
                if key not in snapshot[table]:
                    drift.append(f"{fp}: writes '{key}' to '{table}' — column not in schema_snapshot.json (either the DB is missing it, or the snapshot is stale)")
    for d in sorted(set(drift)):
        fail(d)
    if not drift:
        ok("No schema drift — every column the code writes exists in the schema snapshot")

print("[21/28] Checking every supabase.from(...) call references a real table...")
if not snapshot:
    fail("Can't run check 21 without scripts/schema_snapshot.json (see check 20).")
else:
    from_pat = re.compile(r'supabase\s*\.\s*from\(\s*[\'"`](\w+)[\'"`]\s*\)')
    bad_refs = []
    for fp in src_files:
        content = read(fp)
        for m in from_pat.finditer(content):
            table = m.group(1)
            if table not in snapshot:
                line = content[:m.start()].count("\n") + 1
                bad_refs.append(f"{fp}:{line}: supabase.from(\"{table}\") — no such table")
    for r in sorted(set(bad_refs)):
        fail(r)
    if not bad_refs:
        ok("Every supabase.from(...) call references a table that actually exists")

print("[22/28] Checking AI Scan persists the scanned document...")
pawrecord_content = read("src/PawRecord.jsx")
db_content = read("src/lib/db.js")
if "export const addDocument" not in db_content:
    fail("src/lib/db.js no longer defines addDocument — update this check if intentionally renamed.")
elif "db.addDocument(" not in pawrecord_content:
    fail("db.addDocument is defined but never called anywhere in PawRecord.jsx — AI Scan uploads may not be saved.")
else:
    ok("AI Scan calls db.addDocument — scanned files are actually being saved")

print("[23/28] Checking PDF generation doesn't inject a raw HTML document...")
if "extractPdfFragment" not in pawrecord_content:
    fail("extractPdfFragment is missing from PawRecord.jsx — PDF generation may inject a full HTML document into innerHTML again.")
else:
    unsafe = []
    for pos in [m.start() for m in re.finditer(r'window\.html2pdf\(\)', pawrecord_content)]:
        window_before = pawrecord_content[max(0, pos - 400):pos]
        inner_html_sets = re.findall(r'\.innerHTML\s*=\s*([^;]+);', window_before)
        for expr in inner_html_sets[-1:]:
            if "extractPdfFragment(" not in expr:
                unsafe.append(f"src/PawRecord.jsx:~{pawrecord_content[:pos].count(chr(10)) + 1}: innerHTML set to `{expr.strip()}` before window.html2pdf()")
    for u in sorted(set(unsafe)):
        fail(u)
    if not unsafe:
        ok("PDF generation uses extractPdfFragment — no raw document injected into innerHTML")

print("[24/28] Checking prewarm-cache <-> ai-travel trusted-caller header matches...")
prewarm_content = read("api/prewarm-cache.js")
ai_travel_content = read("api/ai-travel.js")
if "x-prewarm-secret" not in prewarm_content:
    fail("api/prewarm-cache.js no longer sends the x-prewarm-secret header.")
elif "x-prewarm-secret" not in ai_travel_content:
    fail("api/ai-travel.js no longer checks the x-prewarm-secret header.")
elif "CRON_SECRET" not in ai_travel_content:
    fail("api/ai-travel.js's prewarm bypass no longer references CRON_SECRET.")
else:
    ok("prewarm-cache.js and ai-travel.js agree on the trusted-caller header")

print("[25/28] Checking npm audit for known vulnerabilities (production deps)...")
try:
    npm_result = run(["npm", "audit", "--production", "--json"], timeout=60)
    audit_data = json.loads(npm_result.stdout) if npm_result.stdout else {}
    vuln_count = audit_data.get("metadata", {}).get("vulnerabilities", {}).get("total")
    if vuln_count is None:
        remind("Could not parse npm audit output — run `npm audit --production` manually.")
    elif vuln_count > 0:
        sev = audit_data.get("metadata", {}).get("vulnerabilities", {})
        fail(f"npm audit found {vuln_count} known vulnerabilities in production dependencies ({sev}).")
    else:
        ok("npm audit — 0 known vulnerabilities in production dependencies")
except Exception as e:
    remind(f"Could not run npm audit ({e}) — run it manually.")

print("[26/28] Checking core security headers are configured in vercel.json...")
try:
    vercel_config = json.load(open("vercel.json"))
    header_entries = vercel_config.get("headers", [])
    all_header_keys = {h.get("key") for entry in header_entries for h in entry.get("headers", [])}
    missing = [h for h in ["X-Content-Type-Options", "X-Frame-Options", "Referrer-Policy"] if h not in all_header_keys]
    if missing:
        fail(f"vercel.json is missing security header(s): {', '.join(missing)}")
    else:
        ok("Core security headers (nosniff, frame-options, referrer-policy) present in vercel.json")
    if "Content-Security-Policy" not in all_header_keys:
        remind("No Content-Security-Policy header configured; worth doing carefully, not as a rushed fix.")
except Exception as e:
    remind(f"Could not check vercel.json security headers ({e}).")

print("[27/28] Checking no unexpected secrets are exposed to the client bundle...")
allowed_public_vars = {"VITE_SUPABASE_ANON_KEY", "VITE_SUPABASE_URL", "VITE_APP_URL"}
found_vite_vars = set()
for fp in src_files:
    found_vite_vars.update(re.findall(r'VITE_[A-Z_]+', read(fp)))
unexpected = found_vite_vars - allowed_public_vars
if unexpected:
    fail(f"Unexpected VITE_-prefixed var(s) referenced in client code: {', '.join(sorted(unexpected))}.")
else:
    ok("No unexpected secrets exposed to the client bundle — only the public anon key/URL")

print("[28/28] Checking no API endpoint uses a wildcard CORS origin...")
wildcard_cors_files = []
for fp in all_files(("api",), (".js",)):
    if re.search(r"Access-Control-Allow-Origin['\"]?\s*,\s*['\"]\*['\"]", read(fp)):
        wildcard_cors_files.append(fp)
if wildcard_cors_files:
    fail(f"Wildcard CORS origin ('*') found in: {', '.join(wildcard_cors_files)} — use api/_cors.js allowlist.")
else:
    ok("No API endpoint uses a wildcard CORS origin — all routed through the allowlist")

print("\n" + "=" * 65)
print(f"PASSED  ({len(passed)})")
for p in passed:
    print(f"  ✓  {p}")
if reminders:
    print(f"\nREMINDERS — manual checks required ({len(reminders)})")
    for r in reminders:
        for line in r.split("\n"):
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
