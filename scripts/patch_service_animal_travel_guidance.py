#!/usr/bin/env python3
from pathlib import Path

path = Path('src/PawRecord.jsx')
text = path.read_text(encoding='utf-8')
old = '✈️ Service animals have special travel rights. Airlines must allow them in cabin. Carry documentation at all times.'
new = '✈️ Service-animal air-travel rights and forms vary by route and jurisdiction. For flights to, within, or from the U.S., DOT rules require airlines to recognize qualifying trained service dogs, subject to safety, health, and permitted-form requirements. Check the destination government and carrier rules before each trip.'
old_esa = '✈️ ESAs have different rules than service animals. Always check with airline and property before travel.'
new_esa = '✈️ Emotional support animals are treated differently from service animals. Airline, destination, and housing rules vary, so check the current government, carrier, and property requirements that apply to your trip.'
for before, after, label in [(old,new,'service animal'),(old_esa,new_esa,'ESA')]:
    count = text.count(before)
    if count != 1:
        raise SystemExit(f'{label}: expected exactly one match, found {count}')
    text = text.replace(before, after, 1)
path.write_text(text, encoding='utf-8')
print('Updated service-animal and ESA travel guidance.')
