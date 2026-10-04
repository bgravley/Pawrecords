# YourPetPass High-Risk Security Review Policy

Independent review is preferred before production merge/deployment for changes that affect:
- authentication or sessions
- authorization or Supabase RLS
- private file/storage access
- payments, Stripe webhooks, entitlements, refunds, or billing state
- new or materially changed unauthenticated/public endpoints
- secrets, credentials, signing keys, or security headers
- privacy controls or public sharing
- database migrations that change ownership, access, or security policy

When an independent reviewer is available, the reviewer must inspect the actual diff and challenge its trust assumptions. A second AI review is useful but is not automatically independent simply because a different model produced it.

## Solo-maintainer exception

YourPetPass currently has one repository owner. When no qualified independent reviewer is reasonably available, a high-risk release may proceed through the solo-maintainer exception instead of remaining permanently blocked.

The exception requires all of the following:

- the owner gives explicit approval for the named pull request and exact release scope;
- the pull request records that the solo-maintainer exception is being used and why;
- the complete automated test suite, security audits, secret-history scan, and production build pass on the exact release SHA;
- the exact release SHA has a successful Vercel preview deployment;
- database migrations are reviewed for backward compatibility, least privilege, and a documented recovery path before application;
- the production deployment uses the approved and verified SHA, without unrelated changes;
- authenticated production smoke tests cover anonymous, User A, and User B isolation where applicable;
- post-deployment health and error signals are checked, with a rollback target identified;
- the date, production SHA, verification results, and any accepted residual risk are recorded in the pull request or audit control register.

The exception must not be used to ignore a failed gate, unresolved critical finding, unexplained secret exposure, destructive migration without recovery evidence, or a production smoke-test failure. Any such result stops the release until it is resolved.

Time-limited dependency exceptions may be recorded only when no patched upstream release exists, the affected code path is demonstrably unreachable, the exact advisory and rationale are enforced by an automated gate, and the exception has a near-term expiry date that makes the gate fail closed. These exceptions remain accepted residual risk and must be listed in the release record.

At minimum, review should consider:
- cross-user/IDOR access
- fail-open behavior
- service-role key exposure or overuse
- missing rate/abuse controls
- unsafe URL rendering
- public data leakage
- incorrect identity binding
- missing negative tests
- live configuration drift outside Git

For high-risk controls, verification evidence should include both code evidence and live-production evidence when the control can change outside Git.
