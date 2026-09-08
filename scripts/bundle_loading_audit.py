#!/usr/bin/env python3
from pathlib import Path
import gzip
import re

APP = Path('src/App.jsx').read_text(encoding='utf-8')
MAIN = Path('src/main.jsx').read_text(encoding='utf-8')
DIST_INDEX = Path('dist/index.html')

checks = []
def check(ok, msg):
    checks.append((bool(ok), msg))

lazy_routes = {
    'Auth': './components/Auth.jsx',
    'YourPetPass': './PawRecord.jsx',
    'Admin': './Admin.jsx',
    'Emergency': './Emergency.jsx',
    'Travel': './Travel.jsx',
    'AffiliatePortal': './AffiliatePortal.jsx',
}

check('import Marketing from "./Marketing.jsx";' in APP,
      'Public Marketing surface remains eager for first paint')
for name, path in lazy_routes.items():
    check(f'const {name} = lazy(() => import("{path}"));' in APP,
          f'{name} is route-lazy loaded')
    check(f'import {name} from "{path}";' not in APP,
          f'{name} has no eager static import')

check('<React.Suspense fallback={' in MAIN,
      'Lazy routes are protected by a Suspense loading state')
check('Loading YourPetPass...' in MAIN and '#2C4A38' in MAIN,
      'Suspense fallback is branded and user-readable')

check(DIST_INDEX.exists(), 'Production build output exists before bundle audit')
entry_path = None
if DIST_INDEX.exists():
    html = DIST_INDEX.read_text(encoding='utf-8')
    match = re.search(r'<script[^>]+type="module"[^>]+src="(/assets/index-[^"]+\.js)"', html)
    if not match:
        match = re.search(r'<script[^>]+src="(/assets/index-[^"]+\.js)"[^>]+type="module"', html)
    check(match is not None, 'Production HTML references a hashed Vite entry bundle')
    if match:
        entry_path = Path('dist') / match.group(1).lstrip('/')
        check(entry_path.exists(), 'Referenced public entry bundle exists')

if entry_path and entry_path.exists():
    raw = entry_path.read_bytes()
    raw_kb = len(raw) / 1024
    gzip_kb = len(gzip.compress(raw, compresslevel=9)) / 1024
    # Keep modest headroom above the launch build (~402 KB raw / ~114 KB gzip)
    # while preventing the old ~1.15 MB all-routes entry bundle from returning.
    check(raw_kb <= 460, f'Public entry bundle stays <= 460 KB raw (actual {raw_kb:.1f} KB)')
    check(gzip_kb <= 135, f'Public entry bundle stays <= 135 KB gzip (actual {gzip_kb:.1f} KB)')

assets = Path('dist/assets')
if assets.exists():
    names = [p.name for p in assets.glob('*.js')]
    for prefix in ['Auth-', 'PawRecord-', 'Admin-', 'Emergency-', 'Travel-', 'AffiliatePortal-']:
        check(any(name.startswith(prefix) for name in names),
              f'Build emits separate {prefix[:-1]} chunk')

failed = [msg for ok, msg in checks if not ok]
for ok, msg in checks:
    print(('PASS' if ok else 'FAIL') + ': ' + msg)
if failed:
    raise SystemExit(f'{len(failed)} bundle/loading audit check(s) failed')
print(f'Bundle/loading audit passed: {len(checks)}/{len(checks)} checks')
