#!/usr/bin/env python3
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
OLD = 'https://yourpetpass.com'
NEW = 'https://www.yourpetpass.com'

changed = []

for base in ('api', 'src'):
    for path in (ROOT / base).rglob('*'):
        if not path.is_file() or path.suffix not in {'.js', '.jsx'}:
            continue
        rel = path.relative_to(ROOT).as_posix()
        # Keep the redirecting bare domain as an accepted browser origin.
        if rel == 'api/_cors.js':
            continue
        text = path.read_text(encoding='utf-8')
        if OLD not in text:
            continue
        path.write_text(text.replace(OLD, NEW), encoding='utf-8')
        changed.append(rel)

# Keep the operational audit note aligned with the actual live webhook host.
ops = ROOT / 'scripts/platform_audit.md'
if ops.exists():
    text = ops.read_text(encoding='utf-8')
    if OLD in text:
        ops.write_text(text.replace(OLD, NEW), encoding='utf-8')
        changed.append('scripts/platform_audit.md')

if not changed:
    raise SystemExit('No non-canonical runtime URLs found to update')

for rel in changed:
    print(f'updated {rel}')
