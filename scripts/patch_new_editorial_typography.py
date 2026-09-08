#!/usr/bin/env python3
from pathlib import Path

replacements = {
    Path('public/blog/usda-accredited-vet-appointment-pet-travel.html'): (
        'body{margin:0;background:#FAFCFB;color:#1A2E22;font:16px/1.78 Lora,serif}',
        "body{margin:0;background:#FAFCFB;color:#1A2E22;font-family:'Lora',serif;font-size:16px;line-height:1.78}",
    ),
    Path('public/authors/travel-desk.html'): (
        'body{margin:0;background:#FAFCFB;color:#1A2E22;font:16px/1.75 Lora,serif}',
        "body{margin:0;background:#FAFCFB;color:#1A2E22;font-family:'Lora',serif;font-size:16px;line-height:1.75}",
    ),
}
for path, (old, new) in replacements.items():
    text = path.read_text(encoding='utf-8')
    count = text.count(old)
    if count != 1:
        raise SystemExit(f'{path}: expected one body shorthand, found {count}')
    path.write_text(text.replace(old, new, 1), encoding='utf-8')
    print(f'Normalized {path} body typography.')
