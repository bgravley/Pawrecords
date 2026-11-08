# YourPetPass Security Release Policy

Effective November 8, 2026. The sole founder/owner is the sole human reviewer and release authority. There is **no independent-reviewer requirement** and no second-person sign-off, including for high-risk changes. This replaces the previous independent-review / solo-maintainer-exception policy.

## Owner-authorized release process

High-risk changes affecting authentication, authorization/RLS, private records, payments, secrets, privacy, or schema permissions must follow all applicable technical checks below. None requires an outside reviewer or a paid staging environment.

1. Document the specific vulnerability, affected controls, proposed code and database changes, and any material remaining risk.
2. Record the owner's explicit release authorization and scope in the PR or release record. The November 8, 2026 conversation expressly authorizes security PR #159, its matching database migration, and the existing no-additional-cost production workflow.
3. Run available build, behavioral, dependency/secret, and authorization regression checks. Use existing GitHub CI and disposable CI database fixtures; do not create a billable Supabase project or branch.
4. Verify that any new application code and database migration are compatible and execute them in an order that avoids privilege exposure or data loss.
5. Preserve least privilege, RLS tenant isolation, and server-side administrator/billing checks; do not bypass a failed security gate to accelerate deployment.
6. Confirm the production SHA, environment, and database migration status. Verify live permissions and smoke-test supported anonymous/customer/admin flows after release.
7. Record release SHA, database migration name, test results, remaining risks, monitoring findings, and rollback/recovery steps.

## Stop conditions

Do not ship when build/security tests fail, the migration differs materially from the reviewed content, the production target is uncertain, a secret may be exposed, or a fix could cause irreversible loss of customer data without a recovery path. Resolve the technical blocker and then continue under the owner's existing authorization if the release scope is unchanged.

## Cost controls

Do not create paid staging projects, external reviewers, additional subscriptions, paid scanners, or chargeable resources. Existing GitHub Actions, Vercel and Supabase production features may be used within their normal account limits. If a particular change requires an incremental charge, present that choice to the owner separately; do not incur it without explicit authorization.

## Verification criteria

Review includes cross-user/IDOR and unauthorized write tests; denial by default; Supabase service-role isolation; protected billing and admin fields; authenticated API identity; storage access control; prompt-data boundaries; dependency risk; and current live database grants. Passing repository checks is not proof that migrations or dashboard settings were applied to production.

This policy is maintained by the founder. The founder may revise it explicitly at any time.
