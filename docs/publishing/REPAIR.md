# Publishing repair — October 18, 2026

## Verified starting point

- Production serves main commit `96a263d88eb836877c58ffb8667a37206852ba64`.
- The prior SEO chat reports connector content-write safety rejections. Its available history contains summaries, not the underlying rejection payloads; their precise policy cause is unverified.
- Authenticated Git CLI fetch works; GitHub reports ADMIN access. Main has no branch protection returned by the branch protection endpoint.
- Existing SEO branches contain no changes relative to main for the pending health-records pillar.
- The catch-all rewrite sends missing non-API paths to index.html.

## Release procedure

Use an authorized local checkout, a dedicated branch, reviewed commits, and a pull request. Verify the Vercel preview against its commit before merging. Verify the production alias, deployment commit, actual page contents, canonical metadata, sitemap and missing-page status before reporting publication.

A connector rejection is not proof that GitHub permissions are missing. Record the exact error and escalate actionable failures instead of repeatedly retrying the same write operation.

## Monitoring

`Publishing Health` validates source on PRs and main. It checks live production every 30 minutes and on terminal Production deployment-status events. A consolidated issue assigned to bgravley includes failed URLs/checks and a run link. It updates on meaningful changes, reminds after 24 hours, escalates at 48 hours, and closes after recovery. GitHub notification delivery follows the account's notification settings.

The build publishes a non-sensitive commit and content-hash manifest at `/publishing-build.json`. Monitoring detects a stale main commit after a 30-minute build allowance and verifies page content, canonical, organizational author, breadcrumbs, sitemap/hub inclusion, CTA and actual 404s. Checks fail on network errors rather than reporting success.

Add pending work to `backlog.json` with `status: "draft"`, an ISO `dueAt`, owner, and concrete nextAction. No publication for seven days alone is not a failure: due work is what triggers the backlog alert. `published` entries describe the expected released state; live checks must pass before reporting those entries as actually published.

Run `workflow_dispatch` with `alert_drill: true` to test a clearly labeled simulated failure without breaking production. A subsequent normal healthy run closes the drill issue. Verify both runs and the issue; account-level email/push receipt requires the recipient to confirm delivery.

## Release QA and dependency gate

- Preview `e858667` confirmed a nonexistent blog URL returns HTTP 404 with the custom missing-page document.
- Phone (375px) and desktop (1440px) checks cover all three guides, Pet Guides and 404: no horizontal overflow or broken images.
- The existing release audit exposed Joi GHSA-wr44-6hxh-3jwq. The override is patched from 17.13.7 to 17.13.8 with its lockfile and existing Wallet audit assertion updated. All 84 behavior tests and 33 Wallet checks pass locally.
- The pre-existing node-forge advisory exception remains unchanged and expires November 1, 2026. This release does not broaden it or alter Wallet signing behavior.
- Rollback target is the previously verified production commit `96a263d88eb836877c58ffb8667a37206852ba64`.
