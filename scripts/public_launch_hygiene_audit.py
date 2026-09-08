#!/usr/bin/env python3
from pathlib import Path

marketing = Path('src/Marketing.jsx').read_text(encoding='utf-8')

checks = []
def check(ok, message):
    checks.append((bool(ok), message))

# Do not advertise unfinished customer surfaces on the launch homepage.
check('href="#store"' not in marketing,
      'homepage navigation does not advertise an unfinished Store')
check('id="store"' not in marketing,
      'homepage contains no hidden or visible unfinished Store section')
check('YourPetPass Store — Coming Soon' not in marketing and 'STORE — coming soon stub' not in marketing,
      'homepage contains no Store coming-soon placeholder')

# Keep objective performance/speed claims out unless they have evidence behind them.
check('in seconds' not in marketing.lower(),
      'homepage makes no unsubstantiated in-seconds completion promise')
check('From vet visit to your pocket, without the paper chase' in marketing,
      'how-it-works headline uses a benefit claim rather than an unsupported speed claim')
check('Export a health summary and email it to a vet, hotel, or daycare when you need to share records.' in marketing,
      'export feature describes the action without a completion-time promise')

# Human-facing FAQ and features must match the bounded AI/source language already
# used by the public AI policy and crawler-facing metadata.
check('AI-assisted travel planning checklists with official-source links' in marketing,
      'homepage FAQ describes travel AI as assisted planning with source links')
check('responsible government authority' in marketing and
      'carrier-specific policies with the carrier before travel' in marketing,
      'homepage travel FAQ tells users where current requirements must be confirmed')
check('AI-generated travel checklists for flying or driving with your pet' not in marketing,
      'homepage no longer carries the older unbounded AI-generated checklist claim')

# Emergency QR must not read like a public/full-record directory.
check('share a tokenized emergency page with the supported details you choose' in marketing,
      'homepage QR feature describes owner-controlled tokenized sharing')
check('without exposing full medical records or private uploads' in marketing,
      'homepage QR feature preserves the private-record boundary')
check('owner-controlled QR emergency card' in marketing,
      'homepage pricing FAQ retains the owner-control boundary')

# Launch cleanup must not remove intentional conversion/navigation surfaces.
for label in ['Features', 'Use Cases', 'Pricing', 'Pet Guides', 'Login', 'Sign Up Free']:
    check(label in marketing, f'homepage retains core navigation/action: {label}')
check('Add to Your Phone' in marketing,
      'homepage retains intentional PWA install action')
check('Get Started Free' in marketing,
      'homepage retains free-start conversion action')
check('AI & Sources' in marketing and '/ai-policy.html' in marketing,
      'homepage retains direct access to AI/source policy')

failed = [message for ok, message in checks if not ok]
for ok, message in checks:
    print(('PASS' if ok else 'FAIL') + ': ' + message)
if failed:
    raise SystemExit(f'{len(failed)} public launch hygiene check(s) failed')
print(f'Public launch hygiene audit passed: {len(checks)}/{len(checks)} checks')
