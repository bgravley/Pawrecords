from pathlib import Path

files = [
    Path('api/storage-file.js'),
    Path('api/emergency-record.js'),
    Path('api/wallet/config.js'),
]

failed = False
for path in files:
    text = path.read_text()
    ok = 'req.query' not in text and 'new URL(' in text and '.searchParams.get(' in text
    print(f"{'PASS' if ok else 'FAIL'}: {path} uses WHATWG query parsing")
    failed = failed or not ok

if failed:
    raise SystemExit(1)
