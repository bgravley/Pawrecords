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

privacy = Path('public/privacy.html')
text = privacy.read_text(encoding='utf-8')
original = text
text = text.replace(
    'Effective Date: June 7, 2026 &nbsp;·&nbsp; Last Updated: June 7, 2026',
    'Effective Date: June 7, 2026 &nbsp;·&nbsp; Last Updated: September 6, 2026'
)
text = text.replace(
    '        <li><strong>Resend</strong> — transactional email delivery</li>',
    '        <li><strong>Resend</strong> — transactional email delivery</li>\n'
    '        <li><strong>Google Analytics</strong> — optional website and product analytics</li>\n'
    '        <li><strong>Microsoft Clarity</strong> — optional usability and session analytics</li>\n'
    '        <li><strong>Vercel Analytics</strong> — optional website and product analytics</li>'
)
text = text.replace(
    '      <p>These providers are contractually bound to use your data only as needed to provide their services to us.</p>',
    '      <p>These providers are used only as described in this policy. Optional analytics providers are not loaded until you choose to allow analytics, and YourPetPass product analytics are limited to coarse feature events rather than pet names, medical record contents, document contents, or travel details.</p>'
)

# Renumber the existing sections 5+ before inserting the new analytics section.
def renumber(match):
    number = int(match.group(1))
    return f'<h2>{number + 1}. ' if number >= 5 else match.group(0)
text = re.sub(r'<h2>(\d+)\. ', renumber, text)

analytics_section = '''\n    <section>\n      <h2>5. Analytics, Cookies, and Privacy Choices</h2>\n      <p>YourPetPass uses optional analytics to understand which pages and features are useful, improve reliability, and measure broad product activity. These analytics are not required for the Service to function.</p>\n      <p><strong>Your choice comes first:</strong> Google Analytics, Microsoft Clarity, and Vercel Analytics are kept off until you select “Allow analytics.” If you select “Essential only,” those optional analytics remain off. You can change your choice later using the “Privacy choices” button shown on the site.</p>\n      <p>We use local storage to remember your analytics preference. If you allow analytics, the analytics providers may use cookies or similar technologies in accordance with their services and privacy practices.</p>\n      <p><strong>Global Privacy Control:</strong> If your browser sends a Global Privacy Control signal, YourPetPass keeps optional analytics off while that signal is enabled.</p>\n      <p>Our product analytics are intentionally coarse. We do not send pet names, medical record contents, document contents, or travel itinerary details as analytics event data.</p>\n    </section>\n'''
marker = '    <!-- 5 -->\n'
if analytics_section.strip() not in text:
    if marker not in text:
        raise SystemExit('privacy.html: could not locate section 5 insertion point')
    text = text.replace(marker, analytics_section + '\n    <!-- 6 -->\n', 1)
else:
    text = text.replace(marker, '    <!-- 6 -->\n', 1)

if text != original:
    privacy.write_text(text, encoding='utf-8')
    if str(privacy) not in changed:
        changed.append(str(privacy))

print(f'Updated {len(changed)} files')
for path in changed:
    print(path)
