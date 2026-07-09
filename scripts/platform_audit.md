# platform_audit.md — cross-checking CODE against VERCEL and STRIPE

Added July 2026, when Vercel and Stripe MCP connectors became available in
Claude alongside the existing Supabase connector. `audit.py` and
`db_audit.sql` can't see these two platforms at all — they're blind to the
exact bug pattern this project has hit before: code gets updated, but the
matching setting in Supabase/Vercel/Stripe doesn't, and the mismatch fails
silently. Run this checklist during any review where Vercel and/or Stripe
tools are connected.

Project IDs:
- Supabase: `pqqfwgwbwofzfpzzuilq`
- Vercel team: `bgravleys-projects` (id `team_n9MYbQRaDtWgqTi76w1SDwGV`)
- Vercel project: look up via `list_projects` (not yet confirmed as of this
  writing — Vercel calls were blocked by a pending approval prompt)

## 1. Environment variables: code expects vs. Vercel actually has

`audit.py` check 16 collects every `process.env.X` / `import.meta.env.X` the
code references. As of July 2026 that list is:

```
ANTHROPIC_API_KEY        CRON_SECRET               OPENAI_API_KEY
RESEND_API_KEY           SIGNUP_WEBHOOK_SECRET      STRIPE_SECRET_KEY
STRIPE_WEBHOOK_SECRET    SUPABASE_SERVICE_KEY       SUPABASE_URL
VITE_APP_URL             VITE_SUPABASE_ANON_KEY     VITE_SUPABASE_URL
```

**Action:** pull the live Vercel project env vars (Production environment)
and diff against this list. Flag anything: (a) the code expects but Vercel
doesn't have — that feature is silently broken right now; (b) Vercel has but
the code no longer references — safe to remove, but confirm first.

## 2. SIGNUP_WEBHOOK_SECRET must match the value hardcoded in Supabase

Two Supabase trigger functions (`notify_new_signup`, `notify_new_error`)
POST to `/api/notify-signup` and `/api/notify-error` with a hardcoded header:

```
x-webhook-secret: yppsignup2026
```

Those API routes reject the request unless it matches
`process.env.SIGNUP_WEBHOOK_SECRET` exactly. **Action:** confirm Vercel's
`SIGNUP_WEBHOOK_SECRET` is literally `yppsignup2026`. If it's anything else
(including unset), every signup and error notification email has been
silently failing. If you rotate this, update it in **both** places — the
Vercel env var AND the two `net.http_post` calls in Supabase (via
`apply_migration`) — or notifications break again.

## 3. Stripe price IDs: code vs. live Stripe account

Price IDs currently hardcoded in the client:

```
src/PawRecord.jsx  monthly:   price_1TknmwB5s5OlwZVJsgXTq1JA
src/PawRecord.jsx  annual:    price_1TknmuB5s5OlwZVJLGQI4rt0
src/PawRecord.jsx  lifetime:  price_1TknmvB5s5OlwZVJU867MMjE
src/Travel.jsx     credits:   price_1TkvYNB5s5OlwZVJ737k5nA5
```

**Action:** fetch each by ID from Stripe (`fetch_stripe_resources`) and
confirm: (a) it exists, (b) `active: true`, (c) it's a **live** mode price,
not a leftover test price, (d) the amount/interval matches what the pricing
page claims. A stale or archived price ID here means checkout silently
fails at Stripe's end for that plan.

Also confirm `STRIPE_WEBHOOK_SECRET` (Vercel) matches the signing secret on
the actual live webhook endpoint in the Stripe dashboard for
`https://yourpetpass.com/api/stripe-webhook` — a mismatch means subscription
status updates silently stop reaching the database.

## 4. Vercel runtime errors (last 7 days)

`get_runtime_errors` for the project, production environment. This is the
one live signal none of the code-only checks can produce — recurring 500s
mean something's breaking for real users right now, independent of anything
in this codebase snapshot.

## 5. Update this file

When a new cross-platform bug is found (code/Supabase/Vercel/Stripe out of
sync), add a check for it here the same way audit.py's checks were built —
one per real bug found, list only grows.
