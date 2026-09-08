#!/usr/bin/env python3
from pathlib import Path

TERMS = Path('public/terms.html').read_text(encoding='utf-8')
PRIVACY = Path('public/privacy.html').read_text(encoding='utf-8')
CONTACT = Path('public/contact.html').read_text(encoding='utf-8')
COPYRIGHT = Path('public/copyright.html').read_text(encoding='utf-8')
SITEMAP = Path('public/sitemap.xml').read_text(encoding='utf-8')

checks = []
def check(ok, msg):
    checks.append((bool(ok), msg))

# Operator and current-policy identity.
for name, text in [('Terms', TERMS), ('Privacy', PRIVACY), ('Contact', CONTACT), ('Copyright', COPYRIGHT)]:
    check('RD Marketing LLC' in text, f'{name} identifies RD Marketing LLC')

check('Last Updated: September 7, 2026' in TERMS, 'Terms carries current launch-hygiene update date')
check('Last Updated: September 7, 2026' in PRIVACY, 'Privacy carries current launch-hygiene update date')

# Terms must match actual product/privacy boundaries.
check('planning aid only' in TERMS and 'relevant government agencies, airlines, and veterinary authorities' in TERMS,
      'Terms preserves AI travel verification responsibility')
check('tokenized, no-login emergency page' in TERMS and 'not a public pet directory' in TERMS,
      'Terms accurately describes Emergency QR access model')
check("does not expose the pet's full medical record or private uploaded documents" in TERMS,
      'Terms documents Emergency QR private-record boundary')
check('You retain ownership' in TERMS and 'limited, non-exclusive license' in TERMS,
      'Terms preserves user ownership while granting a limited service-operation license')
check('/copyright.html' in TERMS and 'Copyright Complaints' in TERMS,
      'Terms links a copyright complaint process')
check('no online service can promise uninterrupted operation or absolute security' in TERMS,
      'Terms short version avoids an absolute availability/security promise')
check('at least 18 years old, or the age of majority' in TERMS,
      'Terms defines adult account eligibility')

# Privacy must disclose current processors and actual retention/QR behavior.
check('<strong>OpenAI</strong>' in PRIVACY and '<strong>Anthropic</strong>' in PRIVACY,
      'Privacy discloses both current AI providers')
check('secondary AI review of generated travel checklist output' in PRIVACY,
      'Privacy explains Anthropic role narrowly')
check('high-entropy, tokenized link' in PRIVACY and 'not a public pet directory' in PRIVACY,
      'Privacy accurately describes Emergency QR token model')
check('full medical record and private uploaded documents are not exposed' in PRIVACY,
      'Privacy documents Emergency QR private-record boundary')
check('Operational records such as activity, error, abuse-prevention, or AI-usage logs may be retained in de-identified or account-disassociated form' in PRIVACY,
      'Privacy retention language matches de-identified operational-log behavior')
check('Request account deletion' in PRIVACY and 'Data Retention section' in PRIVACY,
      'Privacy does not promise deletion beyond the stated retention model')
check('Accounts are intended for adults who are at least 18 years old' in PRIVACY,
      'Privacy age statement agrees with Terms')
check('Google Analytics' in PRIVACY and 'Microsoft Clarity' in PRIVACY and 'Vercel Analytics' in PRIVACY,
      'Privacy continues to disclose optional analytics providers')
check('Global Privacy Control' in PRIVACY and 'Essential only' in PRIVACY,
      'Privacy continues to describe analytics consent and GPC')

# Public support content must not resurrect removed or unsupported product behavior.
check('Emergency Pet Lookup' not in CONTACT,
      'Contact page does not advertise the removed public Emergency Pet Lookup')
check('does not provide a public pet directory or name-based emergency lookup' in CONTACT,
      'Contact page tells lost-pet finders to use the tokenized QR only')
check('view invoices, or cancel a subscription' in CONTACT and 'change plans' not in CONTACT,
      'Contact page only advertises Billing Portal actions currently configured')
check("keep access through the end of the billing period you've already paid for" in CONTACT,
      'Cancellation FAQ accurately describes end-of-period access')
check('/copyright.html' in CONTACT and 'Copyright Complaints page' in CONTACT,
      'Support path explains where copyright notices go')

# Copyright process is operationally usable without overclaiming statutory status.
for phrase in [
    'Copyright Complaint',
    'copyrighted work',
    'specific material',
    'good-faith belief',
    'accurate',
    'physical or electronic signature',
    'Copyright Counter-Notice',
    'RD Marketing LLC',
]:
    check(phrase in COPYRIGHT, f'Copyright page includes required operational element: {phrase}')
check('does not expand or limit rights or obligations created by applicable law' in COPYRIGHT,
      'Copyright page avoids overstating legal status')
check('/contact.html' in COPYRIGHT,
      'Copyright complaint and counter-notice path is reachable through support')

# Brand consistency for the legal/support surface.
for name, text in [('Terms', TERMS), ('Privacy', PRIVACY), ('Contact', CONTACT), ('Copyright', COPYRIGHT)]:
    check('#2C4A38' in text, f'{name} uses Forest Green')
    check('#C9A84C' in text, f'{name} uses Gold')
    check("Playfair Display" in text and "Lora" in text, f'{name} uses Playfair headlines and Lora body')
    check('Nunito' not in text, f'{name} no longer uses legacy Nunito styling')

check('https://www.yourpetpass.com/copyright.html' in SITEMAP,
      'Copyright page is included in canonical sitemap')

failed = [msg for ok, msg in checks if not ok]
for ok, msg in checks:
    print(('PASS' if ok else 'FAIL') + ': ' + msg)
if failed:
    raise SystemExit(f'{len(failed)} legal/admin hygiene audit check(s) failed')
print(f'Legal/admin hygiene audit passed: {len(checks)}/{len(checks)} checks')
