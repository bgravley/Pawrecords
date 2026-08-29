import json
from pathlib import Path

config = json.loads(Path('vercel.json').read_text(encoding='utf-8'))
headers = {}
for entry in config.get('headers', []):
    if entry.get('source') == '/(.*)':
        for item in entry.get('headers', []):
            headers[item.get('key')] = item.get('value', '')

csp = headers.get('Content-Security-Policy', '')
checks = {
    'CSP header is configured globally': bool(csp),
    "default source is same-origin": "default-src 'self'" in csp,
    'external scripts are not globally wildcarded': 'script-src *' not in csp and 'script-src https:' not in csp,
    'unsafe eval is disabled': "'unsafe-eval'" not in csp,
    'Clarity script host is explicitly allowed': 'https://www.clarity.ms' in csp,
    'Google Tag Manager script host is explicitly allowed': 'https://www.googletagmanager.com' in csp,
    'html2pdf CDN script host is explicitly allowed': 'https://cdnjs.cloudflare.com' in csp,
    'Vercel analytics script host is explicitly allowed': 'https://va.vercel-scripts.com' in csp,
    'Google Fonts stylesheet host is allowed': 'https://fonts.googleapis.com' in csp,
    'Google Fonts binary host is allowed': 'https://fonts.gstatic.com' in csp,
    'Supabase HTTPS connections are allowed': 'https://*.supabase.co' in csp,
    'Supabase realtime WebSockets are allowed': 'wss://*.supabase.co' in csp,
    'object/embed plugins are disabled': "object-src 'none'" in csp,
    'base tags are same-origin only': "base-uri 'self'" in csp,
    'form submissions are same-origin only': "form-action 'self'" in csp,
    'third-party framing of YourPetPass is blocked': "frame-ancestors 'self'" in csp,
    'blob workers remain available for client PDF/browser work': "worker-src 'self' blob:" in csp,
    'mixed content is upgraded': 'upgrade-insecure-requests' in csp,
}

failed = [name for name, ok in checks.items() if not ok]
for name, ok in checks.items():
    print(f"[{'PASS' if ok else 'FAIL'}] {name}")

if failed:
    raise SystemExit('CSP security audit failed: ' + ', '.join(failed))

print(f'CSP security audit passed ({len(checks)}/{len(checks)}).')
