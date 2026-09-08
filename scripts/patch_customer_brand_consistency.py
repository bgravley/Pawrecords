#!/usr/bin/env python3
from pathlib import Path
import re

ROOT = Path(__file__).resolve().parents[1]


def replace_once(path, old, new, label):
    p = ROOT / path
    text = p.read_text(encoding='utf-8')
    count = text.count(old)
    if count != 1:
        raise SystemExit(f'{label}: expected exactly 1 match, found {count}')
    p.write_text(text.replace(old, new, 1), encoding='utf-8')
    print(f'updated {path}: {label}')

# Load the brand fonts once for all SPA/customer app surfaces, including
# password recovery, Travel, and the affiliate dashboard.
replace_once(
    'index.html',
    '    <link rel="manifest" href="/manifest.json" />\n',
    '    <link rel="manifest" href="/manifest.json" />\n'
    '    <link rel="preconnect" href="https://fonts.googleapis.com" />\n'
    '    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />\n'
    '    <link href="https://fonts.googleapis.com/css2?family=Lora:wght@400;600&family=Playfair+Display:wght@700;800&display=swap" rel="stylesheet" />\n',
    'global brand font links',
)

# Password recovery headings should use the headline face rather than body Lora.
p = ROOT / 'src/App.jsx'
text = p.read_text(encoding='utf-8')
old1 = "<div style={{ fontFamily: \"'Lora', serif\", fontSize: 26, fontWeight: 600, color: '#2C4A38', marginBottom: 6, textAlign: 'center' }}>"
new1 = "<div style={{ fontFamily: \"'Playfair Display', serif\", fontSize: 26, fontWeight: 700, color: '#2C4A38', marginBottom: 6, textAlign: 'center' }}>"
old2 = "<div style={{ fontFamily: \"'Lora', serif\", fontSize: 20, color: '#1A2E22', marginBottom: 20, textAlign: 'center' }}>\n          Set New Password"
new2 = "<div style={{ fontFamily: \"'Playfair Display', serif\", fontSize: 20, fontWeight: 700, color: '#1A2E22', marginBottom: 20, textAlign: 'center' }}>\n          Set New Password"
if text.count(old1) != 1 or text.count(old2) != 1:
    raise SystemExit('App password recovery headline anchors did not match exactly')
text = text.replace(old1, new1, 1).replace(old2, new2, 1)
p.write_text(text, encoding='utf-8')
print('updated src/App.jsx: password recovery headlines')

# Semantic Travel headings should always use Playfair. Keep buttons, fields,
# helper text, and numeric/body content in Lora.
p = ROOT / 'src/Travel.jsx'
text = p.read_text(encoding='utf-8')
text2, count = re.subn(
    r'(<h[123][^>]*style=\{\{[^}]*fontFamily:\s*)"\\\'Lora\\\', serif"',
    r'\1"\\\'Playfair Display\\\', serif"',
    text,
)
# The JSX source uses literal single quotes inside a double-quoted string; the
# regex above can be brittle across formatting, so also apply exact common form.
text2 = text2.replace("<h3 style={{ fontFamily: \"'Lora', serif\"", "<h3 style={{ fontFamily: \"'Playfair Display', serif\"")
text2 = text2.replace("<h2 style={{ fontFamily: \"'Lora', serif\"", "<h2 style={{ fontFamily: \"'Playfair Display', serif\"")
text2 = text2.replace("<h1 style={{ fontFamily: \"'Lora', serif\"", "<h1 style={{ fontFamily: \"'Playfair Display', serif\"")
text2 = text2.replace("fontFamily: \"'Lora', serif\", fontSize: 22, color: \"#fff\", fontWeight: 600 }}>🛂 Travel Planner", "fontFamily: \"'Playfair Display', serif\", fontSize: 22, color: \"#fff\", fontWeight: 700 }}>🛂 Travel Planner")
if text2 == text:
    raise SystemExit('Travel headline typography patch produced no changes')
p.write_text(text2, encoding='utf-8')
print('updated src/Travel.jsx: headline typography')

# Affiliate dashboard: body remains Lora; clear page-level headings use Playfair.
p = ROOT / 'src/AffiliatePortal.jsx'
text = p.read_text(encoding='utf-8')
replacements = [
    ("<div style={{ fontFamily: \"'Lora', serif\", fontSize: 22, marginBottom: 8 }}>No affiliate account found</div>",
     "<div style={{ fontFamily: \"'Playfair Display', serif\", fontSize: 22, fontWeight: 700, color: C.text, marginBottom: 8 }}>No affiliate account found</div>"),
    ("<div style={{ fontFamily: \"'Lora', serif\", fontSize: 24, color: C.text, marginBottom: 4 }}>Welcome back 👋</div>",
     "<div style={{ fontFamily: \"'Playfair Display', serif\", fontSize: 24, fontWeight: 700, color: C.text, marginBottom: 4 }}>Welcome back 👋</div>"),
]
for old, new in replacements:
    if text.count(old) != 1:
        raise SystemExit(f'Affiliate headline anchor expected once, found {text.count(old)}')
    text = text.replace(old, new, 1)
p.write_text(text, encoding='utf-8')
print('updated src/AffiliatePortal.jsx: headline typography')
