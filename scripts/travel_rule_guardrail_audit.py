#!/usr/bin/env python3
from pathlib import Path

travel = Path('src/Travel.jsx').read_text(encoding='utf-8')

checks = [
    ('Vet completes APHIS Form 7001' not in travel,
     'generator no longer hard-codes APHIS Form 7001 for every U.S.-involved trip'),
    ('Skipping this step means the pet will be quarantined for 28 days' not in travel,
     'generator no longer hard-codes universal 28-day quarantine consequence'),
    ('there is NOT one universal health certificate' in travel,
     'U.S. export prompt requires destination-specific certificate research'),
    ('full 6-month country history' in travel and 'vaccination origin' in travel,
     'U.S. dog re-entry prompt requires CDC risk-history and vaccination-origin distinctions'),
    ('valid for entry for 10 days' in travel and 'October 1, 2026' in travel,
     'EU transition guardrail records current certificate timing and effective date'),
    ('issued digitally by the USDA-accredited veterinarian and digitally endorsed by APHIS' in travel,
     'Cayman October 1 digital-certificate transition is explicitly guarded'),
    ("travel-support-v2:\${trip.departure_date || 'date-unknown'}" in travel,
     'route cache key is scoped to departure date so time-sensitive rules do not reuse a different-date checklist'),
]

failed = [msg for ok, msg in checks if not ok]
for ok, msg in checks:
    print(('PASS' if ok else 'FAIL') + ': ' + msg)
if failed:
    raise SystemExit(f'{len(failed)} travel rule guardrail check(s) failed')
print(f'Travel rule guardrail audit passed: {len(checks)}/{len(checks)} checks')
