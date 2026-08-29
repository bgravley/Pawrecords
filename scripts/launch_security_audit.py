#!/usr/bin/env python3
"""Focused launch-security regression checks for YourPetPass.

These checks complement scripts/audit.py. They are intentionally small and
explicit so the launch blockers discovered in August 2026 cannot regress
without failing CI.
"""

from pathlib import Path
import json
import sys

ROOT = Path(__file__).resolve().parents[1]
failures = []
passes = []


def read(path):
    p = ROOT / path
    if not p.exists():
        failures.append(f"Missing required file: {path}")
        return ""
    return p.read_text(encoding="utf-8", errors="ignore")


def require(condition, message):
    if condition:
        passes.append(message)
    else:
        failures.append(message)


# 1. Cron reliability / Supabase keep-alive
vercel_raw = read("vercel.json")
try:
    vercel = json.loads(vercel_raw)
except Exception as exc:
    vercel = {}
    failures.append(f"vercel.json is invalid JSON: {exc}")

cron_paths = {c.get("path") for c in vercel.get("crons", [])}
require("/api/supabase-health" in cron_paths, "Daily Supabase health cron is configured")
require("/api/cron-notifications" in cron_paths, "Notification compatibility cron is configured")
require("/api/send-notifications" not in cron_paths, "Vercel no longer calls the legacy notification endpoint directly")

cron_wrapper = read("api/cron-notifications.js")
require("req.headers.authorization" in cron_wrapper and "Bearer ${cronSecret}" in cron_wrapper,
        "Notification cron validates Vercel Authorization bearer token")

health = read("api/supabase-health.js")
require("profiles?select=id&limit=1" in health and "dogs?select=id&limit=1" in health and "trips?select=id&limit=1" in health,
        "Supabase health check performs tiny read-only database requests")
require("Supabase Health Check Failed" in health, "Supabase health failures have an admin alert path")

# 2. Emergency QR architecture
emergency_ui = read("src/Emergency.jsx")
require("/api/emergency-record?token=" in emergency_ui, "Emergency UI uses token-scoped server endpoint")
require("supabase.from(" not in emergency_ui and ".from(\"dogs\")" not in emergency_ui,
        "Emergency UI does not query Supabase tables anonymously")
require("getPublicUrl" not in emergency_ui, "Emergency UI contains no direct document links")

emergency_api = read("api/emergency-record.js")
require("emergency_token=eq." in emergency_api, "Emergency API requires exact emergency token lookup")
require("vet_visits" not in emergency_api and "documents?" not in emergency_api,
        "Emergency API omits visit history and document records")
require("user_id" not in emergency_api, "Emergency API does not expose user IDs")

# 3. Private document storage architecture
supabase_client = read("src/lib/supabase.js")
require("/api/storage-file?path=" in supabase_client, "Legacy document URLs are routed through private file gateway")
require("/api/session-cookie" in supabase_client, "Private file gateway has authenticated session bridge")
require("path.startsWith('shared-records/')" in supabase_client and "path.startsWith('bug-reports/')" in supabase_client,
        "Special Storage uploads are rewritten under the signed-in user folder")

storage_gateway = read("api/storage-file.js")
require("path.startsWith(`${user.id}/`)" in storage_gateway, "Private file gateway enforces user-root ownership")
require("SUPABASE_SERVICE_KEY" in storage_gateway, "Storage service credential remains server-side")

migration = read("supabase/migrations/20260829143000_launch_security_hardening.sql")
require("set public = false" in migration.lower(), "Launch migration makes documents bucket private")
require('drop policy if exists "Auth users upload documents"' in migration and
        'drop policy if exists "Auth users update documents"' in migration,
        "Launch migration removes broad authenticated Storage writes")
require('drop policy if exists "Public can view pets with emergency token"' in migration and
        migration.count('drop policy if exists "Public can view via dog emergency token"') >= 6,
        "Launch migration removes anonymous Emergency table policies")
require("revoke execute on function public.handle_new_user()" in migration and
        "revoke execute on function public.notify_new_signup()" in migration and
        "revoke execute on function public.notify_new_error()" in migration,
        "Launch migration revokes direct RPC access to trigger-only SECURITY DEFINER functions")

# 4. Health-certificate content regression
article = read("public/blog/pet-health-certificates-explained.html")
article_lower = article.lower()
require("<h1>pet health certificates explained</h1>" in article_lower,
        "Health-certificate page has the correct visible H1")
require("pet-health-certificate-hero.jpeg" in article,
        "Health-certificate page uses its dedicated hero image")
require("moving across the country with pets" not in article_lower,
        "Moving-across-country article is not duplicated into health-certificate page")
require("aphis.usda.gov/pet-travel" in article,
        "Health-certificate article links readers to official USDA APHIS guidance")

print("\nYourPetPass launch-security audit")
print("=" * 37)
for item in passes:
    print(f"PASS  {item}")

if failures:
    print("\nFAILURES")
    for item in failures:
        print(f"FAIL  {item}")
    sys.exit(1)

print(f"\nAll {len(passes)} launch-security checks passed.")
