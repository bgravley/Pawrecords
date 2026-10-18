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
