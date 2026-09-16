# Git History Secret Scan Evidence — 2026-09-16

## Scope

- Repository: `bgravley/Pawrecords`
- History inspected: all locally available branches and commits (`git log --all --full-history`)
- Commit count at verification: 987
- Output policy: detector, commit, path, and one-way fingerprint only; matched values are never printed

## Detectors

The scan checks added historical lines for high-confidence forms of:

- private keys;
- AWS access keys;
- GitHub tokens;
- Stripe live/restricted keys and webhook secrets;
- Google API keys;
- Slack tokens;
- Resend API keys;
- quoted generic secret/password/token assignments;
- Supabase JWTs whose decoded role is `service_role`.

Known test fixtures, environment-variable references, and explicit placeholders are excluded.

## Result

`PASS: full Git history contains no high-confidence secret matches.`

No credential values were printed or stored as audit evidence.

## Continuous control

`.github/workflows/git-history-secret-audit.yml` checks out complete history and runs the redacted scanner on pull requests, pushes to `main`, weekly, and on demand.

## Limitations

Pattern scanning cannot prove that every possible secret format is absent. Provider-side secret scanning, credential rotation records, least-privilege configuration, and manual investigation of credible alerts remain necessary. A future detector update should rerun the complete history rather than only new commits.
