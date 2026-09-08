#!/usr/bin/env python3
from pathlib import Path
import subprocess

ROOT = Path(__file__).resolve().parents[1]
helper = (ROOT / 'src/lib/legalAttestation.js').read_text(encoding='utf-8')
auth = (ROOT / 'src/components/Auth.jsx').read_text(encoding='utf-8')
app = (ROOT / 'src/App.jsx').read_text(encoding='utf-8')
endpoint = (ROOT / 'api/confirm-legal-attestation.js').read_text(encoding='utf-8')
e2e = (ROOT / 'api/e2e-login.js').read_text(encoding='utf-8')
smoke = (ROOT / 'scripts/live_smoke.mjs').read_text(encoding='utf-8')

checks = []
def check(ok, msg): checks.append((bool(ok), msg))

# Shared state is privacy-minimal and short-lived before authentication.
check("LEGAL_ATTESTATION_VERSION = '2026-09-07'" in helper,
      'attestation version is explicit and current')
check('30 * 60 * 1000' in helper,
      'pre-auth attestation handoff expires after 30 minutes')
check('window.sessionStorage' in helper and 'localStorage' not in helper,
      'pre-auth confirmation uses tab-scoped sessionStorage, not persistent localStorage')
check('email' not in helper.lower() and 'birthday' not in helper.lower() and 'birth_date' not in helper.lower() and 'date_of_birth' not in helper.lower(),
      'pre-auth handoff stores no email or birth-date data')
check('user?.app_metadata' in helper and 'user?.user_metadata' not in helper,
      'durable gate trusts protected app metadata rather than browser-editable user metadata')
check("['email_signup', 'google_signup', 'post_auth_gate']" in helper,
      'only expected human attestation methods are allowed client-side')

# Email and Google signup both require the explicit checkbox.
check('const [legalAccepted, setLegalAccepted] = useState(false)' in auth,
      'signup starts without implicit legal acceptance')
check('I confirm I am at least 18 years old (or the age of majority where I live)' in auth,
      'signup presents explicit adult self-attestation language')
check('Terms of Service' in auth and 'Privacy Policy' in auth,
      'signup attestation links Terms and Privacy')
check('if (!legalAccepted) return setErr("Please confirm the age and legal terms before creating your account.")' in auth,
      'email signup refuses to proceed without confirmation')
check("markPendingLegalAttestation('email_signup')" in auth,
      'email signup carries explicit confirmation to the first authenticated session')
check("markPendingLegalAttestation('google_signup')" in auth,
      'Google signup carries explicit confirmation through OAuth')
check('disabled={loading || (authMode === "signup" && !legalAccepted)}' in auth,
      'signup actions are visibly disabled until confirmed')
check('clearPendingLegalAttestation();' in auth,
      'failed or duplicate signup does not leave stale pending proof')

# The post-auth gate closes the OAuth sign-in/new-account bypass and existing-account gap.
check('const resolveLegalAttestation = async (activeSession)' in app and 'hasCurrentLegalAttestation(activeSession.user)' in app,
      'every authenticated session is evaluated for current attestation')
check('readPendingLegalAttestation()' in app and 'persistLegalAttestation(activeSession, pending.method)' in app,
      'valid pre-auth confirmation is persisted only after authentication')
check('setLegalAttestationRequired(true)' in app,
      'missing durable confirmation fails closed into the one-time gate')
check("persistLegalAttestation(currentSession, 'post_auth_gate')" in app,
      'one-time post-auth gate records an explicit confirmation')
check("fetch('/api/confirm-legal-attestation'" in app and "'Authorization': `Bearer ${token}`" in app,
      'browser sends confirmation only through authenticated server endpoint')
check('supabase.auth.refreshSession()' in app,
      'client refreshes the session after protected app metadata changes')
check('<h1' in app and 'One quick account confirmation' in app,
      'one-time gate has a semantic heading')
check('Sign out instead' in app,
      'user can decline the gate by signing out')
check(app.index('if (legalAttestationRequired)') < app.index('// Admin route - only for admin email'),
      'attestation gate runs before Admin, Travel, affiliate, or pet-record application routes')
check("onSignup={() => { setAuthEntryMode('signup'); setShowAuthScreen(true); }}" in app,
      'marketing signup CTA opens directly on Create Account')

# Durable server write is identity-bound and browser cannot choose the account.
check("if (req.method !== 'POST')" in endpoint and 'noStore(res)' in endpoint,
      'attestation endpoint is POST-only and no-store')
check('const auth = await verifyUser(req)' in endpoint and 'auth.userId' in endpoint,
      'server derives the account from verified signed-in identity')
check('req.body?.userId' not in endpoint and 'req.body.userId' not in endpoint and 'req.body?.email' not in endpoint,
      'browser cannot select another account for attestation')
check("req.body?.confirmed === true" in endpoint,
      'server requires explicit affirmative confirmation')
check("new Set(['email_signup', 'google_signup', 'post_auth_gate'])" in endpoint,
      'server allowlists attestation methods independently of the browser')
check('supabase.auth.admin.getUserById(auth.userId)' in endpoint,
      'server loads existing protected metadata for the verified user')
check('...(existing.user.app_metadata || {})' in endpoint,
      'server preserves unrelated protected app metadata')
check('supabase.auth.admin.updateUserById(auth.userId' in endpoint and 'app_metadata:' in endpoint,
      'durable attestation is written to protected app metadata')
check('user_metadata:' not in endpoint,
      'attestation endpoint never writes browser-editable user metadata')
check("current.ypp_legal_attestation_version === LEGAL_ATTESTATION_VERSION" in endpoint,
      'repeated confirmation is idempotent for the current version')

# Synthetic production smoke remains fixed-account/OIDC-only and cannot become a customer bypass.
check("ypp_legal_attestation_method: 'synthetic_e2e'" in e2e and 'app_metadata:' in e2e,
      'fixed synthetic E2E accounts receive protected test-only attestation metadata')
check("e2e-primary@yourpetpass.com" in e2e and "e2e-secondary@yourpetpass.com" in e2e and 'verifyGitHubActionsOidc' in e2e,
      'synthetic bypass remains constrained to the two OIDC-gated test accounts')
check('synthetic_e2e' not in app and 'e2e-primary@yourpetpass.com' not in app and 'e2e-secondary@yourpetpass.com' not in app,
      'customer app contains no synthetic-email or synthetic-method bypass')

# Production smoke proves the public gating and anonymous API boundary.
check("getByRole('checkbox', { name: 'Confirm adult age and legal terms', exact: true })" in smoke,
      'live smoke verifies the signup attestation control')
check("Signup actions were enabled before adult/legal confirmation" in smoke and "Signup actions stayed disabled after adult/legal confirmation" in smoke,
      'live smoke verifies both signup actions are gated')
check("Adult attestation endpoint rejects anonymous writes" in smoke,
      'live smoke verifies anonymous callers cannot record attestation')

behavior = subprocess.run(
    ['node', '--test', 'scripts/legal_attestation_behavior.test.mjs'],
    cwd=ROOT,
    text=True,
    capture_output=True,
)
check(behavior.returncode == 0,
      'stateful legal-attestation helper behavior tests pass')
if behavior.returncode != 0:
    print(behavior.stdout)
    print(behavior.stderr)

failed = [msg for ok, msg in checks if not ok]
for ok, msg in checks:
    print(('PASS' if ok else 'FAIL') + ': ' + msg)
if failed:
    raise SystemExit(f'{len(failed)} adult-attestation audit check(s) failed')
print(f'Adult-attestation audit passed: {len(checks)}/{len(checks)} checks')
