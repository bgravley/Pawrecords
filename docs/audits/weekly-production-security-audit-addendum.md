# Approved scope for YourPetPass's recurring production security audit

Prepared 2026-10-31; **do not change the currently scheduled ChatGPT task until the separate production release approval.** Add these read-only checks alongside the existing audit, rather than replacing them.

## Every Monday

1. Match the deployed Vercel production Git SHA to the expected reviewed GitHub `main` commit. Flag unexpected releases, failed deployments, or branch drift.
2. Verify that customer/affiliate browser roles cannot `INSERT`, `DELETE`, or `UPDATE` server-controlled fields using `has_table_privilege` and `has_column_privilege`. Specifically cover `profiles.is_admin`, `subscription_tier`, Stripe customer/subscription identifiers, AI-limit overrides, `travel_credits_balance`, `referral_code_used`, `affiliates.commission_rate`, `affiliates.status`, and commission history. Confirm benign personal/profile and payout editing remains granted. Query RLS policy catalog and flag new broad `FOR ALL` policies on sensitive tables.
3. Confirm auth middleware still rejects invalid sessions and ordinary users at admin endpoints, and no email-only authorization bypass has returned. Check GitHub audit workflow status and the disposable database permission test.
4. Check the Supabase security advisor for leaked-password protection, exposed extensions, permissive RLS or grants, and other new issues. Report known unresolved dashboard actions separately from code regressions; do not change settings automatically.
5. Review read-only aggregate billing/affiliate signals: unexpected administrator-count changes, out-of-policy commission rates, unusual premium/credit changes, suspicious referral growth, and Stripe webhook retries/failures. Avoid printing customers' emails, documents, tokens, or full payment identifiers.
6. Check AI source/prompt boundaries, no-store response headers, no pet/email/trip identity in usage-log writes, and recent AI error/usage anomalies. Continue source-quality and privacy-consent checks. Never fetch customer document contents for a routine audit.
7. Report CSP policy regressions, `unsafe-inline` remediation progress, and authentication/MFA/CAPTCHA rollout status. Validate public documents bucket remains private and privileged server credentials are not present in browser builds.
8. Produce a severity-ranked summary with exact proof, false-positive caveats, affected environment, recommended owner, and whether action is safe to stage or needs the founder's separate production approval. **Read only**: never automatically deploy, migrate, revoke tokens, rotate keys, email customers, or modify production data.

## Immediate escalation

Flag as Critical if a browser role can write `is_admin`, paid tier, credits, commission rate, affiliate status, or commission accounting; if service-role credentials appear in public assets; or if an admin endpoint accepts an ordinary user. Include the exact table/column or endpoint, minimal verification steps, and reversible mitigation options—without testing privilege escalation against real customer records.
