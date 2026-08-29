from pathlib import Path

text = Path('src/PawRecord.jsx').read_text(encoding='utf-8', errors='ignore')

legacy_tokens = [
    'Nunito',
    '#1E5C52', '#2D7D6F', '#FAF6F0', '#F4EFE8', '#E8DDD0',
    '#2C2017', '#5A4535', '#8B7355', '#E8A838', '#F5C45E', '#A8D5CE',
]
checks = {
    'authenticated app no longer references legacy Nunito': 'Nunito' not in text,
    'authenticated app loads Lora': 'family=Lora' in text and "font-family:'Lora',serif" in text,
    'authenticated app loads Playfair Display': 'Playfair+Display' in text and "font-family:'Playfair Display',serif" in text,
    'Forest Green is used in the authenticated app': '#2C4A38' in text,
    'Warm White is used in the authenticated app': '#FAFCFB' in text,
    'Mint Cream is used in the authenticated app': '#EAF4EE' in text,
    'Gold is used in the authenticated app': '#C9A84C' in text,
    'Deep Text is used in the authenticated app': '#1A2E22' in text,
    'legacy customer-facing palette is removed from PawRecord': not any(token in text for token in legacy_tokens),
}

failed = [name for name, ok in checks.items() if not ok]
for name, ok in checks.items():
    print(f"[{'PASS' if ok else 'FAIL'}] {name}")

if failed:
    raise SystemExit('Authenticated-app brand audit failed: ' + ', '.join(failed))

print(f'Authenticated-app brand audit passed ({len(checks)}/{len(checks)}).')
