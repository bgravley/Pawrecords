# YourPetPass Audit Control Register

This is the canonical source of truth for production audit controls. A control is not considered complete merely because code exists in Git.

## Status model
- Unreviewed
- Finding identified
- Remediated
- Verified
- Continuously verified

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

## Current priority controls

| ID | Area | Control | Severity | Status | Action | Evidence / Notes |
|---|---|---|---|---|---|---|
| AUTH-001 | Authorization | Anonymous/User A/User B cannot cross-access sensitive records | Critical | Remediated | Fix before next release | Existing two-user production isolation test expanded to anonymous + health-record tables; becomes continuous after merge to main |
| URL-001 | Link safety | Stored/user-controlled clickable URLs allow only HTTPS | High | Remediated | Fix before next release | safeExternalUrl helper + tests; travel source render paths hardened |
| PUB-001 | Public endpoints | Each unauthenticated endpoint has explicit abuse/threat review | High | Remediated | Fix before next release | travel-share GET receives rate-limit control; all future public endpoints require review |
| SUP-001 | Supply chain | Third-party JS and package dependencies are inventoried and trust-reviewed | High | Remediated | Scheduled remediation | SRI added to html2pdf, QRious and PDF.js loader; PDF.js 3.11.174 eval path disabled. Upgrade/self-host review remains, including worker delivery |
| REPO-001 | Repository exposure | Public repo contains no secrets/private customer data and history is reviewed | Critical | Finding identified | Fix before next release | Repo visibility confirmed public. Current-tree pattern scan found env references/test placeholders but no obvious live secret; full git-history scan remains required |
| RLS-001 | RLS drift | Live production authorization behavior is tested on a recurring schedule | Critical | Finding identified | Fix before next release | Existing live-smoke workflow is the target integration point |
| REV-001 | Change review | High-risk changes receive independent review before production | High | Remediated | Fix before next release | Policy documented in SECURITY_REVIEW_POLICY.md |
| ARC-001 | Architecture | Sensitive-table client-vs-server access is reviewed deliberately | Medium | Unreviewed | Scheduled remediation | Do not wholesale migrate; classify per table based on risk/complexity |
