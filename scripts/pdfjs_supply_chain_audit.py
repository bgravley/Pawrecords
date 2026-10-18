#!/usr/bin/env python3
import json
from pathlib import Path

pkg = json.loads(Path('package.json').read_text(encoding='utf-8'))
lock = json.loads(Path('package-lock.json').read_text(encoding='utf-8'))
paw = Path('src/PawRecord.jsx').read_text(encoding='utf-8')

checks = [
    (pkg.get('dependencies', {}).get('pdfjs-dist') == '6.3.289',
     'pdfjs-dist is pinned exactly to reviewed version 6.3.289'),
    (lock.get('packages', {}).get('node_modules/pdfjs-dist', {}).get('version') == '6.3.289',
     'package-lock resolves the same PDF.js version'),
    ('pdfjs-dist/build/pdf.mjs' in paw,
     'PDF.js library is imported from the bundled package'),
    ('pdfjs-dist/build/pdf.worker.mjs?url' in paw,
     'PDF.js worker is emitted from the same bundled package via Vite'),
    ('cdnjs.cloudflare.com/ajax/libs/pdf.js' not in paw,
     'legacy external PDF.js CDN dependency is absent'),
    ('isEvalSupported:false' in paw,
     'PDF.js eval support remains disabled'),
    ('enableScripting:false' in paw,
     'PDF scripting is explicitly disabled'),
    ('enableXfa:false' in paw,
     'XFA processing is explicitly disabled'),
]

failed = [msg for ok, msg in checks if not ok]
for ok, msg in checks:
    print(('PASS' if ok else 'FAIL') + ': ' + msg)

if failed:
    raise SystemExit(f'{len(failed)} PDF.js supply-chain check(s) failed')

print(f'PDF.js supply-chain audit passed: {len(checks)}/{len(checks)} checks')
