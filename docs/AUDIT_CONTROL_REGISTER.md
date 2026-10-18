# YourPetPass Audit Control Register

This is the canonical source of truth for production audit controls. A control is not considered complete merely because code exists in Git.

## Status model
- Unreviewed
- Finding identified
- Remediated
- Verified
- Continuously verified
- Accepted risk

## Severity
- Critical
- High
- Medium
- Low

## Required action
- Block deployment
- Fix before next release
- Scheduled remediation
- Accepted risk

## Evidence requirements
Every Verified or Continuously verified control must record, where applicable:
- code evidence: PR, commit, migration, or test name
- live evidence: production behavior or live configuration state
- environment tested
- date last verified
- whether verification is automated or manual
- next verification trigger/cadence

A migration committed to Git is not, by itself, proof that the migration is applied in production.

## Current production reference

- Production repository SHA verified on October 18, 2026: `e4dd05624c32b03390cc791b67e97579bc24828f`
- Vercel production deployment: `dpl_B8AGvmfnPy3heJLVUQqNrnCRgEvD`
- Deployment state: READY
- Canonical aliases include `www.yourpetpass.com` and `yourpetpass.com`
- Latest exact-main live-smoke check: PASS
- Latest full-history secret scan on main: PASS
- Latest validation check on main: PASS

## Current priority controls

| ID | Area | Control | Severity | Status | Action | Evidence / Notes |
|---|---|---|---|---|---|---|
| AUTH-001 | Authorization | Anonymous/User A/User B cannot cross-access sensitive records | Critical | Continuously verified | Verify each release | Production live-smoke includes anonymous and second-user isolation probes across dogs, documents, health records, trips, and private Storage. Latest main live-smoke passed October 18, 2026. |
| URL-001 | Link safety | Stored/user-controlled clickable URLs allow only HTTPS | High | Continuously verified | Verify each release | `safeExternalUrl` render-boundary enforcement and regression tests remain in main; unsafe schemes/non-HTTPS values fail closed. |
| PUB-001 | Public endpoints | Unauthenticated endpoints receive explicit abuse/threat review | High | Continuously verified | Verify each release | Public endpoint audits include authentication expectations, rate limiting/fail-closed behavior, information leakage, and abuse controls. Travel-share privacy regression prevents internal trip/pet IDs and private photo paths from reaching public payloads. |
| SUP-001 | Supply chain | Third-party JS and package dependencies are inventoried and trust-reviewed | High | Continuously verified | Scheduled dependency review | PDF.js CDN dependency was replaced with bundled `pdfjs-dist 6.3.289` and matching worker via PR #138. `isEvalSupported:false`, `enableScripting:false`, and `enableXfa:false` remain enabled. Production dependency/security audits remain release gates. |
| REPO-001 | Repository exposure | Public repo contains no secrets/private customer data and full Git history is reviewed | Critical | Continuously verified | Weekly + PR/main scan | Redacted full-history secret scanner is installed in CI, scans complete history with `fetch-depth: 0`, and latest main scan passed October 18, 2026. |
| RLS-001 | RLS drift | Live production authorization behavior is tested on a recurring schedule | Critical | Continuously verified | Verify each release + recurring smoke | Live-smoke remains wired to production authorization probes. Live Supabase policies were rechecked October 18, 2026. |
| REV-001 | Change review | High-risk releases use independent review when available or documented solo-maintainer exception | High | Verified | Verify each high-risk release | `SECURITY_REVIEW_POLICY.md` now documents both independent review and the evidence-backed solo-maintainer exception. A failed security/audit/smoke gate still blocks release. |
| ARC-001 | Architecture | Sensitive-table client-vs-server access is deliberately classified and least-privilege | Medium | Verified | Revisit on schema/access changes | Architecture review completed. Owner-scoped health/trip/wallet tables remain direct-RLS; private documents are hybrid; activity/error logs use authenticated self-insert only; backend-only tables have client grants revoked. Live grants/policies verified October 18, 2026. |
| LOG-001 | Operational logs | Browser activity/error logging cannot spoof another user's identity | High | Verified | Recheck on logging/auth changes | Live `activity_log` and `error_log` policies require authenticated self-insert, `user_id = auth.uid()`, and matching JWT email when present. Authenticated roles have INSERT only; anon has no table grant. Verified live October 18, 2026. |
| SRV-001 | Server-only tables | Backend-only operational/cache tables expose no anon/auth table privileges | High | Verified | Recheck on schema/access changes | Live `airport_relief_areas`, `bug_reports`, `newsletter_subscribers`, `prewarm_routes`, `rate_limit_log`, and `travel_route_cache` have no client policies and no anon/auth table grants. Verified October 18, 2026. |
| DEL-001 | Account deletion | Account deletion removes database-owned records and private Storage objects | High | Remediated | Controlled deletion verification | Current code recursively deletes the user's private Storage prefix before profile/auth deletion and fails closed if objects remain. Static/regression coverage exists. A controlled end-to-end deletion test with a synthetic account is still required before moving to Verified. |
| DR-001 | Backup / recovery | Database and private Storage can be restored from an off-site backup | Critical | Finding identified | Scheduled remediation | Current Free Supabase plan has no automatic backup/PITR control. No repository automation currently performs off-site logical DB dumps + private Storage backup + restore verification. Issue #125 remains open. Do not perform destructive legacy Storage cleanup until a verified rollback/recovery path exists. |
| STR-001 | Legacy Storage cleanup | Oversized legacy image objects are safely reduced without broken references | Medium | Finding identified | Blocked by DR-001 | Live `documents` bucket still has 12 objects over 500 KB totaling 16.12 MB as of October 18, 2026. New uploads are compressed; this is legacy cleanup only. Cleanup is blocked until backup/rollback is verified. |
| EXT-001 | Supabase extension placement | `pg_net` risk is understood and dependency-safe | Medium | Accepted risk | Revisit on supported migration path | Live `pg_net` 0.20.0 remains in `public`, reports `extrelocatable = false`, and supports signup/error webhook triggers. Secret moved to Vault and canonical webhook host is in use. Do not attempt unsupported in-place relocation. |
| AUTH-PLAN-001 | Password breach screening | Leaked-password protection is active when plan supports it | Medium | Accepted risk | Reassess on Supabase plan change | Current Supabase Free plan does not provide leaked-password protection. Treat as plan-gated accepted risk; do not report weekly as a new defect unless plan/capability changes. |
| STRIPE-001 | Payment reconciliation | Stripe state, entitlements, refunds/cancellation/failure recovery reconcile end-to-end | High | Finding identified | Resume when live Stripe access works | Static/behavioral webhook tests are in place, including empty successful RPC handling. Live Stripe ↔ app reconciliation remains blocked by connector/access availability and must not be called verified. |

## Verification cadence

- Every release: AUTH-001, URL-001, PUB-001, RLS-001, REV-001 and payment/security regression gates.
- Weekly: REPO-001 full-history scan plus recurring production audit.
- On schema/policy change: ARC-001, LOG-001, SRV-001 and live Supabase grant/policy checks.
- Monthly or after deletion changes: DEL-001 controlled synthetic deletion test once implemented.
- Quarterly after initial setup: DR-001 restore exercise.
- On dependency changes/advisories: SUP-001.
- On Supabase plan change: AUTH-PLAN-001.
- When Stripe access is restored: STRIPE-001 full reconciliation matrix.

## Open remediation order

1. Establish and successfully test off-site database + private Storage recovery (DR-001 / issue #125).
2. Only after DR-001 is verified, perform canary cleanup of the 12 legacy oversized Storage objects (STR-001 / issue #118).
3. Run a controlled synthetic account-deletion test and document retained-vs-deleted data (DEL-001).
4. Resume live Stripe reconciliation when access is available (STRIPE-001).
5. Continue recurring authorization, secret-history, dependency, travel-rule, and production-health monitoring.
