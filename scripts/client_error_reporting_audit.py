#!/usr/bin/env python3
"""Privacy/security regression checks for global client crash reporting."""

from pathlib import Path
import sys

ROOT = Path(__file__).resolve().parents[1]


def read(path):
    p = ROOT / path
    if not p.exists():
        raise SystemExit(f"Missing required file: {path}")
    return p.read_text(encoding="utf-8", errors="ignore")


api = read("api/client-error.js")
reporter = read("src/lib/clientErrorReporter.js")
boundary = read("src/components/AppErrorBoundary.jsx")
main = read("src/main.jsx")
smoke = read(".github/workflows/live-smoke.yml")

checks = {
    "crash endpoint is POST-only and no-store": (
        "req.method !== 'POST'" in api and
        "Cache-Control', 'private, no-store'" in api
    ),
    "crash endpoint requires verified signed-in identity": (
        "const auth = await verifyUser(req);" in api and
        "if (!auth.ok) return res.status(auth.status)" in api
    ),
    "stored reporter identity is server-derived": (
        "userId: auth.userId" in api and
        "userEmail: auth.email" in api and
        "user_id: userId" in api and
        "user_email: userEmail" in api
    ),
    "browser-supplied identity is never consumed": (
        "body.userId" not in api and "body.userEmail" not in api and
        "body.user_id" not in api and "body.user_email" not in api
    ),
    "only explicit crash classes are accepted": (
        "'window_error', 'unhandled_rejection', 'react_error'" in api and
        "ALLOWED_TYPES.has(type)" in api
    ),
    "server sanitizes message identifiers and secrets": (
        "sanitizeMessage" in api and "[email]" in api and "[id]" in api and
        "[token]" in api and "[redacted]" in api and
        "access_token|refresh_token|apikey|api_key|token" in api
    ),
    "server strips query/hash from diagnostic route": (
        "value.split(/[?#]/, 1)[0]" in api and
        "withoutQuery.startsWith('/')" in api
    ),
    "server caps crash-loop volume per signed-in account": (
        "MAX_REPORTS_PER_HOUR = 20" in api and
        "recentReportCount(auth.userId)" in api and
        "count >= MAX_REPORTS_PER_HOUR" in api
    ),
    "client deduplicates and rate-caps reports": (
        "DEDUPE_MS = 60 * 1000" in reporter and
        "CLIENT_MAX_PER_MINUTE = 5" in reporter and
        "recentFingerprints" in reporter and "recentSendTimes" in reporter
    ),
    "client only reports while authenticated": (
        "supabase.auth.getSession()" in reporter and
        "if (!accessToken) return" in reporter and
        "Authorization: `Bearer ${accessToken}`" in reporter
    ),
    "client sends only coarse crash fields": (
        "body: JSON.stringify({ type, message, route })" in reporter and
        "stack" not in reporter.lower() and
        "componentstack" not in reporter.lower() and
        "pet_name" not in reporter.lower() and
        "diagnosis" not in reporter.lower() and
        "medication" not in reporter.lower() and
        "document_name" not in reporter.lower()
    ),
    "arbitrary promise rejection objects are never serialized": (
        "event.reason instanceof Error ? event.reason : null" in reporter and
        "JSON.stringify(event.reason)" not in reporter and
        "JSON.stringify(error)" not in reporter
    ),
    "global browser error listener is installed": (
        "window.addEventListener('error'" in reporter and
        "type: 'window_error'" in reporter
    ),
    "global unhandled-rejection listener is installed": (
        "window.addEventListener('unhandledrejection'" in reporter and
        "type: 'unhandled_rejection'" in reporter
    ),
    "React render crashes are caught without component stack upload": (
        "componentDidCatch(error)" in boundary and
        "type: 'react_error'" in boundary and
        "componentStack" not in boundary
    ),
    "application root installs both crash layers": (
        "<AppErrorBoundary>" in main and "<App />" in main and
        "installGlobalErrorReporting()" in main
    ),
    "crash fallback offers a clear recovery action": (
        "Reload YourPetPass" in boundary and "window.location.reload()" in boundary
    ),
    "production smoke rejects anonymous crash-log writes": (
        "Verify crash reporting rejects anonymous writes" in smoke and
        "https://www.yourpetpass.com/api/client-error" in smoke and
        'test "$STATUS" = "401"' in smoke
    ),
}

failed = [name for name, ok in checks.items() if not ok]
for name, ok in checks.items():
    print(f"[{'PASS' if ok else 'FAIL'}] {name}")

if failed:
    raise SystemExit("Client crash-reporting audit failed: " + ", ".join(failed))

print(f"Client crash-reporting privacy/security audit passed ({len(checks)}/{len(checks)}).")
