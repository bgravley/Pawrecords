#!/usr/bin/env python3
from pathlib import Path

PAW = Path('src/PawRecord.jsx').read_text(encoding='utf-8')
TERMS = Path('public/terms.html').read_text(encoding='utf-8')

checks = []
def check(ok, msg):
    checks.append((bool(ok), msg))

# Service-animal air-travel language must stay route/jurisdiction specific.
# U.S. DOT rules recognize qualifying trained service dogs on flights to,
# within, and from the U.S., but allow safety/health denials and permitted
# DOT forms; foreign jurisdictions may impose different requirements.
check('Service-animal air-travel rights and forms vary by route and jurisdiction.' in PAW,
      'Signed-in service-animal guidance starts with route/jurisdiction variability')
check('For flights to, within, or from the U.S., DOT rules require airlines to recognize qualifying trained service dogs' in PAW,
      'Signed-in service-animal guidance scopes the U.S. DOT rule to qualifying trained service dogs')
check('subject to safety, health, and permitted-form requirements' in PAW,
      'Signed-in service-animal guidance preserves important U.S. DOT conditions')
check('Check the destination government and carrier rules before each trip.' in PAW,
      'Signed-in service-animal guidance requires current route-specific verification')
check('Airlines must allow them in cabin' not in PAW,
      'Product does not make an unconditional airline-cabin promise')
check('Carry documentation at all times' not in PAW,
      'Product does not invent a universal documentation-at-all-times rule')

# ESA language should not imply service-animal status or one universal rule.
check('Emotional support animals are treated differently from service animals.' in PAW,
      'Signed-in ESA guidance distinguishes ESAs from service animals')
check('Airline, destination, and housing rules vary' in PAW,
      'Signed-in ESA guidance acknowledges rule variability')
check('check the current government, carrier, and property requirements' in PAW,
      'Signed-in ESA guidance sends users to the relevant current authorities')

# Terms should continue to carry the broader travel-verification boundary.
check('Pet travel regulations change frequently and vary by country, airline, and circumstance.' in TERMS and
      'verifying all requirements with the relevant government agencies, airlines, and veterinary authorities before traveling.' in TERMS,
      'Terms preserve independent travel-rule verification responsibility')

failed = [msg for ok, msg in checks if not ok]
for ok, msg in checks:
    print(('PASS' if ok else 'FAIL') + ': ' + msg)
if failed:
    raise SystemExit(f'{len(failed)} travel claims hygiene audit check(s) failed')
print(f'Travel claims hygiene audit passed: {len(checks)}/{len(checks)} checks')
