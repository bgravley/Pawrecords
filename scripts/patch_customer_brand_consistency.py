#!/usr/bin/env python3
from pathlib import Path

p = Path('index.html')
text = p.read_text(encoding='utf-8')
anchor = '    <link rel="manifest" href="/manifest.json" />\n'
addition = (
    anchor
    + '    <link rel="preconnect" href="https://fonts.googleapis.com" />\n'
    + '    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />\n'
    + '    <link href="https://fonts.googleapis.com/css2?family=Lora:wght@400;600&family=Playfair+Display:wght@700;800&display=swap" rel="stylesheet" />\n'
)
if 'family=Playfair+Display:wght@700;800' in text:
    print('Global brand fonts already present')
else:
    if text.count(anchor) != 1:
        raise SystemExit(f'Expected manifest anchor once, found {text.count(anchor)}')
    p.write_text(text.replace(anchor, addition, 1), encoding='utf-8')
    print('Added global YourPetPass brand fonts')
