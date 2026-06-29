#!/usr/bin/env python3
"""
audit.py — YourPetPass full-site audit script

Run this every time a review is requested instead of improvising checks
from scratch. Every category here was a real bug found at some point.
When a new category of bug is found in the future, add a check for it
HERE so it's never missed again — the list only grows, never shrinks.

Usage: python3 scripts/audit.py
Run from the repo root.
"""

import re, os, subprocess, sys, json

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
os.chdir(ROOT)

issues = []
passed = []

def fail(msg):
    issues.append(msg)

def ok(msg):
    passed.append(msg)


# ── 1. Build succeeds ────────────────────────────────────────────────────
print("Running build...")
result = subprocess.run(["npm", "run", "build"], capture_output=True, text=True)
if result.returncode != 0:
    fail(f"BUILD FAILED:\n{result.stdout[-1500:]}\n{result.stderr[-1500:]}")
else:
    ok("Build succeeds")


# ── 2. Duplicate file content (the Travel.jsx/db.js/terms.html bug) ─────
for f in subprocess.run(["find", "public", "-name", "*.html"], capture_output=True, text=True).stdout.split():
    count = open(f, errors='ignore').read().count("<!DOCTYPE html>")
    if count > 1:
        fail(f"{f} has {count} DOCTYPE declarations — file content is duplicated")
if not any("DOCTYPE" in i for i in issues):
    ok("No duplicated HTML file content")

for root, dirs, files in os.walk("src"):
    dirs[:] = [d for d in dirs if d != "node_modules"]
    for f in files:
        if f.endswith((".jsx", ".js")):
            path = os.path.join(root, f)
            content = open(path, errors='ignore').read()
            if content.count("export default") > 1:
                fail(f"{path} has multiple 'export default' — likely duplicated content")
for root, dirs, files in os.walk("api"):
    for f in files:
        if f.endswith(".js"):
            path = os.path.join(root, f)
            content = open(path, errors='ignore').read()
            if content.count("export default") > 1:
                fail(f"{path} has multiple 'export default' — likely duplicated content")


# ── 3. Broken internal links and image references ───────────────────────
def all_html_jsx_files():
    out = []
    for base in ("public", "src"):
        for root, dirs, files in os.walk(base):
            dirs[:] = [d for d in dirs if d != "node_modules"]
            for f in files:
                if f.endswith((".html", ".jsx")):
                    out.append(os.path.join(root, f))
    return out

broken_links = []
broken_images = []
for fpath in all_html_jsx_files():
    content = open(fpath, errors='ignore').read()
    for r in re.findall(r'href=[\'"](/[^\'">#]+\.html)[\'"]', content):
        if "your-post-slug" in r:  # known placeholder in blog.html's example comment
            continue
        if not os.path.isfile(os.path.join("public", r.lstrip("/"))):
            broken_links.append((fpath, r))
    for r in re.findall(r'src=[\'"](/(?!\/)[^\'">]+\.(?:jpg|jpeg|png|svg|webp|gif|ico))[\'"]', content):
        if not os.path.isfile(os.path.join("public", r.lstrip("/"))):
            broken_images.append((fpath, r))

for fpath, r in broken_links:
    fail(f"{fpath} links to missing page: {r}")
for fpath, r in broken_images:
    fail(f"{fpath} references missing image: {r}")
if not broken_links:
    ok("All internal page links resolve")
if not broken_images:
    ok("All image references resolve")


# ── 4. Every HTML page has required SEO meta tags, no duplicates ────────
descs, titles = {}, {}
missing_desc = []
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
    fail(f"{path} is missing a meta description tag entirely")
for desc, paths in descs.items():
    if len(paths) > 1:
        fail(f"Duplicate meta description across: {paths}")
for title, paths in titles.items():
    if len(paths) > 1:
        fail(f"Duplicate <title> across: {paths}")
if not missing_desc and not any("Duplicate meta description" in i for i in issues):
    ok("Every page has a unique meta description")


# ── 5. Canonical / og:url / structured-data self-consistency ────────────
# (catches the health-certificates-page-claiming-to-be-the-moving-page bug)
for root, dirs, files in os.walk("public"):
    for f in files:
        if f.endswith(".html"):
            path = os.path.join(root, f)
            content = open(path, errors='ignore').read()
            canonical = re.search(r'<link rel="canonical" href="([^"]*)"', content)
            og_url = re.search(r'<meta property="og:url" content="([^"]*)"', content)
            main_entity = re.search(r'"mainEntityOfPage":\s*"([^"]*)"', content)
            if canonical and og_url and canonical.group(1) != og_url.group(1):
                fail(f"{path}: canonical != og:url — likely copy-paste cross-contamination")
            if canonical and main_entity and canonical.group(1) != main_entity.group(1):
                fail(f"{path}: canonical != structured data mainEntityOfPage")
if not any("cross-contamination" in i or "mainEntityOfPage" in i for i in issues):
    ok("Canonical/og:url/structured-data are self-consistent on every page")


# ── 6. Unescaped user input reaching email HTML (XSS/injection risk) ────
# Targeted, not generic: check the SPECIFIC fields we know are free-text
# and user-controlled (not every variable in the file - that produced too
# many false positives on server-controlled values like numbers and CSS
# class names). Add a name here the next time a new risky field is found.
RISKY_FIELDS = ["name", "email", "subject", "message", "petName", "tripName",
                "ownerName", "description", "fullName", "affiliateName",
                "senderEmail", "userEmail", "vaccineName"]

for root, dirs, files in os.walk("api"):
    for f in files:
        if f.endswith(".js"):
            path = os.path.join(root, f)
            content = open(path, errors='ignore').read()
            for field in RISKY_FIELDS:
                pattern = r'\$\{(?:esc\()?' + re.escape(field) + r'(?:[.\)][^}]*)?\}'
                for m in re.finditer(r'\$\{[^}]*\b' + re.escape(field) + r'\b[^}]*\}', content):
                    snippet = m.group(0)
                    if 'esc(' in snippet or '.replace(/<' in snippet:
                        continue
                    # only count it if this field is actually destructured/used as a parameter in this file
                    if re.search(r'\b' + re.escape(field) + r'\b\s*[,:}]', content[:m.start()]) or True:
                        context = content[max(0, m.start()-80):m.start()]
                        if '<' in context or 'html' in context.lower():
                            fail(f"{path}: '{snippet}' (risky field '{field}') is not wrapped in esc() near HTML content")
                            break  # one flag per field per file is enough signal

if not any("is not wrapped in esc()" in i for i in issues):
    ok("All known risky fields (names, emails, descriptions) are escaped before reaching email HTML")


# ── 7. No leftover Stripe test-mode artifacts ────────────────────────────
test_artifacts = subprocess.run(
    ["grep", "-rl", "--exclude-dir=scripts", "--exclude-dir=node_modules", "--exclude-dir=.git",
     "test_yourportalid", "."],
    capture_output=True, text=True
).stdout.strip()
if test_artifacts:
    fail(f"Stripe test-mode placeholder still present: {test_artifacts}")
else:
    ok("No Stripe test-mode artifacts found")


# ── 8. node_modules / dist are gitignored, not tracked ───────────────────
tracked = subprocess.run(
    ["git", "ls-tree", "-r", "HEAD", "--name-only"],
    capture_output=True, text=True
).stdout
bad_tracked = [l for l in tracked.splitlines() if l.startswith("node_modules/") or l.startswith("dist/")]
if bad_tracked:
    fail(f"{len(bad_tracked)} node_modules/dist files are tracked in git — should be gitignored")
else:
    ok("node_modules/dist are not tracked in git")


# ── Report ─────────────────────────────────────────────────────────────
print("\n" + "="*60)
print(f"PASSED: {len(passed)}")
for p in passed:
    print(f"  ✓ {p}")
print(f"\nISSUES FOUND: {len(issues)}")
for i in issues:
    print(f"  ✗ {i}")
print("="*60)

sys.exit(1 if issues else 0)
