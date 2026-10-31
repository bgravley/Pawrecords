# YourPetPass security remediation preflight — 2026-10-31

Status: preparation only. No production SQL, deployment, policy toggle, secret rotation, merge, or recurring-task change is authorized yet. A separate, explicit production release approval is required.

## Confirmed priority risks

1. Authenticated customers can update privileged `public.profiles` columns, including `is_admin`, `subscription_tier`, billing identifiers, and usage balances. The `profiles` ownership RLS policy does not constrain columns.
2. An authenticated affiliate can update their own `commission_rate` and `status` through the overly broad UPDATE grant.
3. Administrative API routes read the editable `profiles.is_admin` flag and some also trust the editable `profiles.email` value.

## Prepared Stage 1: critical authorization repairs

1. `api/_requireAdmin.js` verifies a real Supabase session and reads `profiles.is_admin` through the server role. It denies access on lookup errors and never uses an email allowlist. Admin data, affiliate notifications, and manual cache prewarming now use it. The client dashboard also drops its email fallback.
2. The Supabase migration revokes old broad Data API grants and allows browser UPDATEs only for ordinary profile-contact fields or an affiliate's payout destination. `profiles.is_admin`, billing entitlements/Stripe IDs, credits, referral attribution, affiliate status, commission rate, and accounting rows are server-controlled.
3. A new authenticated `POST /api/apply-referral` handles one-time referral attribution. It verifies the caller, checks the active affiliate and self-referral rule, and conditionally updates only the caller's own profile through the service role.
4. Test guards assert that the former founder email cannot bypass the protected admin flag. A read-only live preflight on 2026-10-31 confirmed one currently flagged administrator, including the founder email. It also confirmed all six active affiliate codes are compatible with the new input rules and unique after uppercase normalization.

## Prepared Stage 2: security hardening

- The updated Monday GitHub Actions audit checks column grants, privilege escalation, API authorization delegation, and prompt/data boundaries. A second job boots a disposable PostgreSQL 17 database with test users and executes the actual migration plus owner/cross-account RLS probes. This CI job is not a substitute for a post-release verification against live policy state.
- **Deferred production settings (not modified):** turn on Supabase leaked-password protection; evaluate CAPTCHA and MFA for privileged users; move `pg_net` out of the `public` schema after checking dependencies and grants; assess removing CSP `unsafe-inline` using a report-only policy, nonces/hashes, and browser telemetry.
- **Deferred operational defenses:** review logs for historical changes to `is_admin`, tier/credits, affiliate commission rates, unusual billing activity, and newly created admin sessions. If suspicious, investigate as an incident before release and decide on token/session or credential rotation. Do not bulk-reset legitimate entitlements.

## Prepared Stage 3: AI and privacy review

- Travel research puts authoritative source instructions into the Responses API's dedicated `instructions` field and browser-supplied route text into `input`. It explicitly labels route and web-search material untrusted, limits the message payload, and rejects raw provider metadata as a response. This reduces prompt-injection risk; it cannot guarantee factual accuracy or immunity to model manipulation.
- Document scanning puts extraction rules in a system message, treating images and document text as user data. Private AI responses are non-cacheable and provider failures yield generic user-facing errors.
- AI usage logs now omit account email and pet/trip labels while retaining the server-verified user ID, feature, token count, cost estimate, and success status for quota and support purposes. Browser-built travel research no longer includes individual pet names.
- **Deferred business/legal review:** confirm OpenAI and Anthropic retention/training settings and processing agreements, user notice and consent, how long AI usage logs remain, whether minors' or sensitive veterinary documents need additional controls, and deletion/export completeness. No provider data-processing setting was changed here.

## Prepared Stage 4: weekly production audit

- `.github/workflows/audit.yml` now includes a privileged-column audit and an AI data-boundary audit, running on pull requests, weekly Mondays, and manually. The isolated PostgreSQL job tests grant/RLS behavior on every PR.
- An existing separate ChatGPT recurring Monday production audit should eventually include a *read-only* live privilege/policy review: protected profile and affiliate columns, anonymous grants, elevated-account counts, Supabase security advisories (including leaked-password protection), AI log minimization, referral abuse, Stripe lifecycle anomalies, and CSP findings. Prepare the updated recurring task prompt but do not change the live task until release sign-off.

## Verification evidence — preparation branch

- `npm test`: 123 passing tests as of 2026-10-31, including new admin, referral, and AI-boundary behavior cases.
- `npm run build`: production Vite compilation succeeded locally.
- `python3 scripts/audit.py`: 0 findings after teaching the older heuristic to recognize central admin authorization.
- Existing specialized audits: privileged notification, cron, launch, backend grants, AI source claims, travel quota, and travel-rule checks pass.
- New static checks: privileged column 18/18; AI data boundary 9/9.
- **Awaiting GitHub CI:** disposable PostgreSQL 17 migration/role test; ensure the draft PR is green before release approval.
- **Awaiting approved release window:** live database privilege checks, two distinct test-user sessions, admin and affiliate workflow smoke, and production monitoring. No live-write test should be run before release approval.

## Release order and checkpoints

1. Freeze the reviewed commit/PR and capture the pre-release Supabase policy/grant inventory and Vercel rollback deployment SHA. Announce a short maintenance/restricted-change window.
2. Deploy the compatible API/browser code first (the old broad database grants remain a known temporary risk during this short interval). Verify the new referral endpoint, administrative role, and profile editor in a preview environment before release; ensure no old browser bundle continues writing `referral_code_used`.
3. Apply the matching database migration in the same approved window. Do not apply it before the new API is available: otherwise older referral writes fail. Immediately run `scripts/privileged_column_live_verification.sql`, check live RLS policies and cross-user denial, and smoke-test profile edits, referrals, commissions, billing, and admin access.
4. Turn on the non-code settings incrementally only after individually checking impact; CSP changes must first be evaluated in report-only mode. Audit-task changes follow the production sign-off.
5. Monitor privilege errors, referral 4xx/5xx rates, failed profile edits, admin denials, checkout/webhook delivery, and AI failures for 24–48 hours. Record exact SHA, migration ID, time, and pass/fail results in the release log.

**Rollback safety:** Reverting the code bundle is an option, but never automatically restore blanket `UPDATE`/`ALL` grants for authenticated roles: that would reintroduce confirmed privilege escalation. If an editable personal field was omitted, grant that precise column after review. For a broken referral API, temporarily disable/queue referrals and repair through a trusted server-side operation. Keep the privilege boundary in place while investigating.

## Release gates

- Preserve ordinary profile editing, signup referrals, administrative support, billing, and affiliate payout workflows.
- Deny unauthorized INSERT/UPDATE/DELETE on protected profile and affiliate fields.
- Test anonymous, customer A, customer B, affiliate, and administrator roles.
- Run existing production audits plus behavioral tests.
- Perform independent review and record the exact deployment SHA and live privilege verification.
- Require founder approval before production deployment and migration.
