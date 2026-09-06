#!/usr/bin/env python3
from pathlib import Path
import subprocess

ROOT = Path(__file__).resolve().parents[1]
api_dir = ROOT / 'api'
failures = []
checked = 0

for path in sorted(api_dir.rglob('*.js')):
    checked += 1
    result = subprocess.run(
        ['node', '--check', str(path)],
        cwd=ROOT,
        text=True,
        capture_output=True,
    )
    if result.returncode != 0:
        detail = (result.stderr or result.stdout).strip()
        failures.append(f'{path.relative_to(ROOT)}: {detail}')

if failures:
    print('YourPetPass serverless syntax audit FAILED')
    print('=' * 44)
    for failure in failures:
        print(f'FAIL  {failure}')
    raise SystemExit(1)

print(f'PASS: all {checked} serverless JavaScript modules parse cleanly with Node')
