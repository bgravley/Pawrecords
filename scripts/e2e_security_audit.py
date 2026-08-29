#!/usr/bin/env python3
"""Static safety checks for the production authenticated E2E harness."""
from pathlib import Path
import sys

ROOT = Path(__file__).resolve().parents[1]

def read(path):
    return (ROOT / path).read_text(encoding="utf-8")

OIDC = read("api/_github-actions-oidc.js")
LOGIN = read("api/e2e-login.js")
SMOKE = read("scripts/live_smoke.mjs")
WORKFLOW = read(".github/workflows/live-smoke.yml")

checks = []

def check(name, condition):
    checks.append((name, bool(condition)))

# OIDC verifier must be narrowly bound to this exact repository/workflow.
check("GitHub OIDC issuer pinned", "https://token.actions.githubusercontent.com" in OIDC)
check("GitHub JWKS pinned", ".well-known/jwks" in OIDC)
check("Custom E2E audience pinned", "yourpetpass-production-e2e" in OIDC)
check("Repository name pinned", "bgravley/Pawrecords" in OIDC)
check("Stable repository ID pinned", "1248461693" in OIDC)
check("Stable owner ID pinned", "196063928" in OIDC)
check("Main live-smoke workflow_ref pinned", "bgravley/Pawrecords/.github/workflows/live-smoke.yml@refs/heads/main" in OIDC)
check("Main branch pinned", "refs/heads/main" in OIDC)
check("GitHub-hosted runner required", "github-hosted" in OIDC)
check("RS256 required", "RS256" in OIDC and "RSA-SHA256" in OIDC and "crypto.verify" in OIDC)
check("Token expiry/issued-at checked", all(token in OIDC for token in ["claims.exp", "claims.iat", "claims.nbf"]))

# Bootstrap endpoint must be fixed-account, OIDC-only, and low privilege.
check("E2E endpoint POST-only", "req.method !== 'POST'" in LOGIN)
check("E2E endpoint verifies GitHub OIDC", "verifyGitHubActionsOidc" in LOGIN and "readGitHubOidcBearer" in LOGIN)
check("Only fixed primary synthetic email", "e2e-primary@yourpetpass.com" in LOGIN)
check("Only fixed secondary synthetic email", "e2e-secondary@yourpetpass.com" in LOGIN)
check("Caller cannot supply arbitrary email", "req.body?.email" not in LOGIN and "req.body.email" not in LOGIN)
check("Synthetic accounts never admin", "is_admin: false" in LOGIN)
check("Synthetic accounts cover Premium paths", "subscription_tier: 'premium'" in LOGIN)
check("Reset deletes are user-scoped", ".delete().eq('user_id', userId)" in LOGIN)
check("Storage cleanup is user-root constrained", "path.startsWith(`${userId}/`)" in LOGIN)
check("Magic links generated server-side", "auth.admin.generateLink" in LOGIN and "type: 'magiclink'" in LOGIN)
check("Magic-link response is no-store", "Cache-Control" in LOGIN and "no-store" in LOGIN)

# Workflow must use ephemeral identity, never static customer passwords.
check("Workflow can mint OIDC token", "id-token: write" in WORKFLOW)
check("Workflow requests exact E2E audience", "audience=yourpetpass-production-e2e" in WORKFLOW)
check("Workflow masks OIDC token", "::add-mask::" in WORKFLOW)
check("Canonical production host used for E2E", "E2E_BASE_URL: https://www.yourpetpass.com" in WORKFLOW)
check("No static E2E email/password secrets", "E2E_EMAIL" not in WORKFLOW + SMOKE and "E2E_PASSWORD" not in WORKFLOW + SMOKE)
check("No service role secret passed to browser test", "SUPABASE_SERVICE_KEY" not in WORKFLOW + SMOKE)
check("Authenticated smoke cannot silently skip", "E2E_GITHUB_OIDC_TOKEN is required" in SMOKE and "SKIP: Authenticated" not in SMOKE)

# Emergency QR may be displayed on either legitimate YourPetPass hostname,
# but the test must still require the exact high-entropy token-shaped path.
check("Emergency QR hosts restricted to YourPetPass", "['yourpetpass.com', 'www.yourpetpass.com']" in SMOKE)
check("Emergency QR requires 32-char hex token path", "/^\\/emergency\\/[a-f0-9]{32}$/i" in SMOKE)

# Customer journey coverage.
for label, needle in [
    ("Pet create coverage", "Pet can be created through the production UI"),
    ("Pet edit coverage", "Pet profile can be edited and persists"),
    ("Vaccination create/update coverage", "Vaccination can be created and then updated"),
    ("Private document coverage", "Private document upload, metadata, UI listing, and authenticated retrieval work"),
    ("Emergency QR coverage", "Emergency QR generates and exposes only the intended emergency record"),
    ("Travel creation coverage", "Travel planner can create a real trip tied to the pet"),
    ("Logout/re-login coverage", "Sign out works and a second one-time login preserves records"),
    ("Cross-account RLS coverage", "RLS and private Storage isolate one signed-in customer from another"),
    ("Cleanup coverage", "Synthetic E2E records are cleaned after the run"),
]:
    check(label, needle in SMOKE)

failed = [name for name, ok in checks if not ok]
for name, ok in checks:
    print(f"{'PASS' if ok else 'FAIL'}: {name}")

print(f"\nAuthenticated E2E security audit: {len(checks) - len(failed)}/{len(checks)} checks passed")
if failed:
    print("Failures:")
    for name in failed:
        print(f"- {name}")
    sys.exit(1)
