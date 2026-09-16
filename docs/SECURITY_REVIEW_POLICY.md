# YourPetPass High-Risk Security Review Policy

Independent review is required before production merge/deployment for changes that affect:
- authentication or sessions
- authorization or Supabase RLS
- private file/storage access
- payments, Stripe webhooks, entitlements, refunds, or billing state
- new or materially changed unauthenticated/public endpoints
- secrets, credentials, signing keys, or security headers
- privacy controls or public sharing
- database migrations that change ownership, access, or security policy

The reviewer must inspect the actual diff and challenge its trust assumptions. A second AI review is useful but is not automatically independent simply because a different model produced it.

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
