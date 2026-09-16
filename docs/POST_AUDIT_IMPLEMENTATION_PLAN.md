# YourPetPass Post-Audit Implementation Plan

## Purpose

This plan converts the September 2026 audit findings, deferred operational work, travel-rule maintenance items, and recommended product improvements into one sequenced program.

The original seven travel phases and the follow-up travel-support release are complete. This plan does not reopen them. It addresses the work required to secure, operate, maintain, and extend what is already live.

## Completion standard

An item is not complete merely because code exists. Depending on the item, completion requires:

- code evidence: pull request, commit, migration, or automated test;
- live evidence: production behavior or live configuration state;
- the environment and date verified;
- an owner and reviewer for high-risk work;
- a repeat cadence when the control can drift;
- rollback or recovery instructions for infrastructure and data changes.

High-risk security changes require independent diff review under the security review policy introduced by PR #115. A second AI review is useful, but is not automatically independent.

## Delivery rules

1. Finish and verify one release tranche before beginning the next dependent tranche.
2. Do not combine destructive storage cleanup, database-extension changes, or payment reconciliation with unrelated product features.
3. Use official government sources for entry, export, transit, health, customs, and quarantine rules.
4. Use airline sources only for airline-specific policy and airport sources for airport logistics.
5. Never present estimated trip costs or calculate a trip total. Display only exact published fees with a source and as-of date.
6. Preserve existing trips, documents, entitlements, and sharing links unless a migration explicitly documents otherwise.
7. No production merge for high-risk changes without independent review and live verification.

## Workstream 0 — Coordinate the open audit release

### 0.1 Complete PR #115

Scope already implemented in the open branch:

- expanded anonymous/User A/User B authorization tests;
- HTTPS-only rendering of stored travel links;
- rate limiting for public travel-summary reads;
- SRI and immediate PDF.js mitigation;
- upload compression on the shared profile/document helper paths;
- Supabase notification secret moved to Vault;
- canonical notification webhook host;
- audit control register and high-risk review policy;
- corrected audit parser and travel-summary source-date language.

Required actions:

1. Obtain independent diff review.
2. Resolve all review findings and rerun the complete 38-step audit.
3. Decide whether the Cloudflare Workers check is production-relevant. If not, remove or clearly mark the obsolete integration as non-blocking. If it is relevant, repair it before merge.
4. Merge only after the current head is approved and green.
5. Verify the exact merge SHA reaches Vercel production.
6. Run authenticated production smoke tests, including anonymous/User A/User B isolation.
7. Record production evidence in the audit control register.

Exit criteria:

- PR merged and production deployment is READY;
- no unresolved review threads;
- full audit green on the merged SHA;
- production smoke and cross-user isolation pass;
- controls introduced by the PR move from Remediated to Verified or Continuously verified as appropriate.

## Workstream 1 — Close audit findings and operational risks

### 1.1 Repository-history secret scan

Actions:

- scan the complete Git history, not only the current tree;
- review results without printing secret values into logs;
- rotate and revoke any confirmed exposed credential before rewriting history;
- document false positives and the recurring scan mechanism.

Exit criteria:

- scan evidence recorded;
- confirmed findings remediated and rotated;
- recurring secret scanning runs on pull requests and the default branch.

### 1.2 Backup restoration test

Actions:

- document what the current Supabase plan actually backs up and retains;
- export a controlled, non-production test dataset and storage sample;
- restore into an isolated test project or approved recovery environment;
- verify row counts, relationships, RLS, private storage behavior, and a representative user journey;
- document recovery point and recovery time observations.

Exit criteria:

- a restore has actually succeeded;
- restoration instructions are reproducible;
- evidence includes database, authentication dependencies, and private file recovery limitations;
- an affordable recurring cadence is defined.

### 1.3 Account and data-deletion verification

Actions:

- create a controlled test account containing pets, health records, documents, trips, shared summaries, wallet records, analytics references, and billing identifiers where available;
- run the deletion process;
- confirm what is deleted immediately, queued, anonymized, or retained for legal/accounting reasons;
- confirm private files and public tokens become inaccessible;
- publish a retained-versus-deleted data matrix for policy and support use.

Exit criteria:

- no unintended user-owned records or usable public tokens remain;
- required retained records are documented and minimized;
- privacy and account UI accurately describe the behavior.

### 1.4 Sensitive-table architecture review

Classify every sensitive table as:

- client-accessible with owner-scoped RLS;
- hybrid, with limited client access and privileged server operations;
- server-only through authenticated APIs or service-role functions.

Prioritize health records, private documents, trips and shares, entitlements, affiliate/payment data, error logs, activity logs, wallet records, and notification tables.

Exit criteria:

- table-by-table classification exists;
- grants and RLS match the classification;
- negative authorization tests cover every client-accessible sensitive table;
- service-role use is justified and minimized.

### 1.5 Investigate production warnings

Actions:

- reproduce or explain the isolated `/api/travel-share` 404;
- identify the dependency or runtime path emitting the `url.parse()` deprecation/security warning;
- add regression coverage if either originates in application behavior;
- close as documented dependency behavior only with evidence.

Exit criteria:

- root cause and disposition recorded;
- no unexplained recurring production error cluster remains.

### 1.6 PDF and third-party script hardening

Actions:

- retain PR #115's immediate eval-path mitigation and SRI controls;
- evaluate upgrading PDF.js, self-hosting the main library and worker, or replacing the viewer path;
- inventory all remote JavaScript and define an owner/update process;
- test representative uploaded PDFs after the final change.

Exit criteria:

- no unsupported or unreviewed remote executable dependency remains;
- PDF rendering works with malformed-file and privacy tests;
- supply-chain decision is recorded in the audit register.

## Workstream 2 — Storage and upload performance

### 2.1 Compress trip-document images

Actions:

- route image uploads in `Travel.jsx` through the reviewed compression helper;
- leave PDFs and unsupported formats unchanged;
- enforce sensible pixel and byte limits before upload;
- preserve document legibility and orientation;
- add tests for compressed images, PDFs, unsupported files, and failures.

Exit criteria:

- every customer-facing image upload path has an explicit size policy;
- travel-document images remain readable and upload reliably on mobile.

### 2.2 Clean existing oversized storage objects

Actions:

- inventory objects and references without exposing user identifiers;
- define conservative compression thresholds and a backup/rollback method;
- process a small canary batch first;
- verify database references, access policies, dimensions, and visual quality;
- process the remaining approved objects with an audit log.

Exit criteria:

- no targeted object is orphaned or corrupted;
- before/after sizes and rollback evidence are retained;
- private access controls remain intact.

## Workstream 3 — Supabase infrastructure hardening

### 3.1 Review `pg_net` extension placement

Actions:

- inventory every function, trigger, and scheduled job depending on `pg_net`;
- confirm Supabase-supported extension schemas and migration constraints;
- test moving or reinstalling it in an isolated environment;
- verify signup and error notifications before and after;
- keep the extension in place and document accepted risk if a safe supported move is not available.

Exit criteria:

- dependency map and decision recorded;
- any migration is reversible and production notifications are verified.

### 3.2 Free-plan authentication limitation

Leaked-password protection is unavailable on the current Supabase plan. Track it as a plan-gated accepted risk rather than repeatedly reporting it as an unowned defect.

Actions:

- maintain reasonable password requirements and normal rate/abuse controls;
- reassess the feature whenever the Supabase plan changes;
- make no misleading claim that compromised-password screening is active.

Exit criteria:

- accepted-risk entry includes the reason, compensating controls, and review trigger.

## Workstream 4 — Stripe and entitlement reconciliation

Begin only when live Stripe access is restored.

Actions:

- reconcile Stripe products and prices with customer-facing plan names;
- verify checkout identity binding and return handling;
- test monthly, annual, lifetime, and travel-credit purchases as applicable;
- verify activation, renewal, cancellation, failed payment, recovery, refund, and Billing Portal behavior;
- verify webhook idempotency, out-of-order delivery, replay safety, and affiliate-credit behavior;
- reconcile Stripe state, database entitlement state, and the customer-visible UI;
- define Stripe/webhook events as the source of truth for paid conversion analytics.

Exit criteria:

- a lifecycle matrix passes in test mode and approved live canaries;
- no duplicate entitlement or affiliate credit occurs under replay;
- the account UI agrees with Stripe after every tested transition;
- old product naming is removed or mapped deliberately;
- ongoing reconciliation can detect drift.

## Workstream 5 — Wallet and external-provider validation

Begin when Apple/Google provider credentials and test devices are available.

Actions:

- verify pass creation, update, revocation, and per-pet ownership;
- test Emergency QR privacy and selected-field behavior from real devices;
- test expired/revoked sessions and cross-user access;
- document provider outages and fallback behavior.

Exit criteria:

- Apple and Google results are recorded separately;
- real-device screenshots/log evidence exists without exposing customer data;
- unsupported provider states fail clearly and safely.

## Workstream 6 — Travel-rule maintenance corrections

### 6.1 Portugal assistance-dog fee exception

- verify the current DGAV source and effective scope;
- store the exact exemption, authority, source URL, source date, last checked date, and applicability conditions;
- do not generalize the exemption to emotional-support animals or other categories without authority support;
- test that it suppresses only the applicable exact fee.

### 6.2 Bahamas screwworm watch item

- add the route to the monitoring queue;
- treat USDA/APHIS material as a U.S.-side watch source, not final Bahamas destination authority;
- do not publish a Bahamas traveler-facing rule until the responsible Bahamas authority confirms it.

### 6.3 Mexico supplementary traveler source

- add the newer SENASICA traveler page as supplementary Mexico-side guidance;
- keep USDA/CDC as controlling authorities for U.S. import requirements;
- preserve the active New World screwworm monitoring flag.

Exit criteria:

- each rule or watch item has jurisdiction, scope, source hierarchy, source/as-of dates, last checked date, and review status;
- traveler-facing output distinguishes confirmed rules from monitoring items.

## Workstream 7 — Operationalize travel verification

### 7.1 Internal travel-rule review center

Provide an admin workflow for:

- rules awaiting review;
- official sources that changed or disappeared;
- sources due for recheck;
- conflicting official pages;
- urgent disease-control monitoring;
- reviewer, decision, notes, and timestamps;
- publish, hold, supersede, or reject actions.

Exit criteria:

- unreviewed automated findings cannot silently become confirmed traveler guidance;
- every published change has traceable human-review evidence;
- stale and conflicting sources are visible and actionable.

### 7.2 Recurring rule-change monitoring

- schedule focused official-source checks using route demand and risk;
- stay quiet when nothing meaningful changed;
- notify reviewers only for detected changes, source failures, urgent alerts, or required action;
- retain before/after evidence without reproducing copyrighted pages excessively.

Exit criteria:

- monitoring cadence and route priorities are documented;
- alerts feed the review center rather than publishing directly.

## Workstream 8 — Product improvements built on the completed phases

### 8.1 Reusable pet travel profile

Store reusable, owner-confirmed values such as carrier/kennel dimensions, typical combined weight, service status, preferred contacts, and regular shipper. Copy them into a trip as editable snapshots so historical trips do not change when the profile changes.

Exit criteria:

- new trips can reuse data without overwriting history;
- each copied value can be confirmed or changed per trip.

### 8.2 Itinerary-change impact checking

When airline, airport, layover, date, country, species, or travel arrangement changes:

- identify affected airport guides, sources, tasks, documents, fees, and deadlines;
- mark only affected verification as stale;
- preserve unrelated completed work;
- explain what changed and what needs reconfirmation before regeneration.

Exit criteria:

- automated tests cover each change type and prevent unrelated progress loss.

### 8.3 Document-to-requirement assistance

- suggest which requirement an uploaded document may satisfy;
- extract pet, route, dates, document type, and expiry for owner review;
- detect missing or conflicting fields;
- use `Uploaded awaiting review` rather than declaring the requirement complete automatically;
- preserve official/human validation boundaries.

Exit criteria:

- user approval is required before extracted data is relied on;
- expired or ambiguous documents cannot silently complete critical tasks.

### 8.4 Privacy-conscious offline travel packet

- let the owner explicitly choose what to download;
- include the Travel Summary, critical contacts, checklist status, source links, and selected documents;
- protect local/private file handling and explain device-storage risk;
- provide refresh and deletion controls;
- never silently cache all private documents.

Exit criteria:

- packet works without connectivity on representative mobile devices;
- revoked online shares do not create a false claim that an already downloaded copy can be remotely erased.

### 8.5 Targeted change and deadline notifications

- notify only when a verified change affects the user's route, dates, species, segment, or travel arrangement;
- include deadline reminders and document-expiry warnings;
- do not send unreviewed AI findings as established requirements;
- provide notification preferences and quiet defaults.

Exit criteria:

- routing tests prevent irrelevant notifications;
- every rule-change alert links to its official source and review date;
- delivery failures and unsubscribe behavior are auditable.

## Workstream 9 — Mature recurring audit operations

After the remediation work is stable:

- automate broken-link and dead-end crawling;
- retain recurring authenticated and cross-user regression tests;
- centralize production error and dependency-health monitoring;
- add formal performance budgets for mobile and upload flows;
- keep accessibility checks in the release gate and add periodic manual testing;
- maintain the permanent issue/control register with severity, owner, status, and evidence;
- schedule restore, deletion, payment-reconciliation, travel-rule, and external-provider checks at risk-appropriate cadences;
- distinguish application failures from Supabase, Vercel, Stripe, AI, email, or wallet-provider outages.

Exit criteria:

- every recurring control has a cadence, owner, failure notification, and last-success evidence;
- unchanged/non-actionable monitoring remains quiet;
- high-risk releases cannot bypass required review and verification.

## Recommended release sequence

| Tranche | Scope | Production gate |
|---|---|---|
| 0 | Review, merge, and verify PR #115 | Independent approval, full audit, exact-SHA production smoke |
| 1 | Secret history, backup restore, deletion, architecture, warnings, PDF decision | Findings resolved or explicitly accepted with evidence |
| 2 | Trip-image compression and canary storage cleanup | Visual/access/privacy verification and rollback proof |
| 3 | `pg_net` review and any isolated database migration | Dependency map, reversible migration, notification smoke |
| 4 | Stripe lifecycle and reconciliation | Connection restored; test/live canary matrix passes |
| 5 | Travel-rule corrections and internal review center | Official sources and human approval workflow |
| 6 | Reusable travel profile and itinerary impact checker | Backward compatibility and no loss of completed progress |
| 7 | Document matching, offline packet, targeted alerts | Privacy, expiry, notification, and mobile/offline tests |
| 8 | Wallet provider validation and mature recurring operations | Credentials/devices available; recurring controls evidenced |

## Explicitly out of scope

- estimated trip-cost calculator;
- subjective trip-difficulty score;
- accommodation planning;
- general immigration planning unrelated to pet travel;
- restaurant or general tourism discovery;
- automatic publication of unreviewed AI-detected travel-rule changes.

## Immediate next action

Do not start a competing implementation branch for PR #115's scope. First obtain independent review of PR #115, merge the approved head, verify the exact production deployment, and update the audit control evidence. In parallel, planning and non-mutating discovery may begin for backup restoration, deletion verification, secret-history scanning, storage cleanup, `pg_net` dependencies, and Stripe reconnection prerequisites.
