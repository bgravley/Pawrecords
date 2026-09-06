#!/usr/bin/env python3
from pathlib import Path
import re

FILES = [Path('index.html'), *sorted(Path('public').rglob('*.html'))]
LOADER = '    <script src="/privacy-consent.js"></script>\n'

clarity_re = re.compile(
    r'\s*(?:<!--\s*Microsoft Clarity\s*-->\s*)?'
    r'<script[^>]*>\s*\(function\(c,l,a,r,i,t,y\).*?www\.clarity\.ms/tag/.*?</script>\s*',
    re.S,
)
ga_re = re.compile(
    r'\s*(?:<!--\s*Google Analytics \(GA4\)\s*-->\s*)?'
    r'<script[^>]*src="https://www\.googletagmanager\.com/gtag/js\?id=G-GLHNVC9XZV"[^>]*></script>\s*'
    r'<script[^>]*>.*?gtag\(["\']config["\'],\s*["\']G-GLHNVC9XZV["\']\);.*?</script>\s*',
    re.S,
)

changed = []
for path in FILES:
    text = path.read_text(encoding='utf-8')
    original = text
    text = clarity_re.sub('\n', text)
    text = ga_re.sub('\n', text)

    if '/privacy-consent.js' not in text:
        if '<head>' not in text:
            raise SystemExit(f'{path}: missing <head>')
        text = text.replace('<head>', '<head>\n' + LOADER, 1)

    if 'www.clarity.ms/tag/' in text or 'googletagmanager.com/gtag/js?id=G-GLHNVC9XZV' in text:
        raise SystemExit(f'{path}: direct analytics loader remains')
    if text.count('/privacy-consent.js') != 1:
        raise SystemExit(f'{path}: expected exactly one consent loader')

    if text != original:
        path.write_text(text, encoding='utf-8')
        changed.append(str(path))

print(f'Updated {len(changed)} files')
for path in changed:
    print(path)
