#!/usr/bin/env python3
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]

APP_FILES = {
    'App': 'src/App.jsx',
    'Travel': 'src/Travel.jsx',
    'Affiliate': 'src/AffiliatePortal.jsx',
}

# Every current and future article/use-case/organizational-author page is a
# customer-facing editorial surface. Discover these instead of maintaining a
# stale hand-written list whenever the daily publisher adds a page.
EDITORIAL_FILES = ['public/blog.html']
for pattern in ('public/blog/*.html', 'public/use-cases/*.html', 'public/authors/*.html'):
    EDITORIAL_FILES.extend(p.relative_to(ROOT).as_posix() for p in sorted(ROOT.glob(pattern)))
EDITORIAL_FILES = list(dict.fromkeys(EDITORIAL_FILES))

LEGACY_TOKENS = [
    'Nunito',
    '#1E5C52', '#2D7D6F', '#FAF6F0', '#F4EFE8', '#E8DDD0',
    '#2C2017', '#5A4535', '#8B7355', '#E8A838', '#F5C45E',
    '#A8D5CE', '#4A9E90',
]
CURRENT_SECONDARY_TOKENS = ['#FAFCFB', '#EAF4EE', '#7C9E87', '#9DC4AA']

checks = []
def check(ok, message):
    checks.append((bool(ok), message))

index = (ROOT / 'index.html').read_text(encoding='utf-8')
app = (ROOT / APP_FILES['App']).read_text(encoding='utf-8')
travel = (ROOT / APP_FILES['Travel']).read_text(encoding='utf-8')
affiliate = (ROOT / APP_FILES['Affiliate']).read_text(encoding='utf-8')
notifications = (ROOT / 'api/send-notifications.js').read_text(encoding='utf-8')

# The SPA must load both official brand typefaces independently of which screen
# happens to render first (important for password-recovery deep links).
check('family=Lora:wght@400;600&family=Playfair+Display:wght@700;800' in index,
      'SPA loads Lora and Playfair Display globally')
check('fonts.googleapis.com' in index and 'fonts.gstatic.com' in index,
      'SPA includes brand font origins')

for label, path in APP_FILES.items():
    text = (ROOT / path).read_text(encoding='utf-8')
    check("'Lora', serif" in text, f'{label} uses Lora for customer body/control typography')
    check('#2C4A38' in text, f'{label} uses Forest Green')
    check('#1A2E22' in text, f'{label} uses Deep Text')
    for legacy in LEGACY_TOKENS:
        check(legacy not in text, f'{label} no longer contains legacy brand token {legacy}')

# Page-level and semantic headline examples remain Playfair rather than turning
# old headings into body-font Lora during palette migration.
check("fontFamily: \"'Playfair Display', serif\", fontSize: 20" in app and 'Set New Password' in app,
      'password recovery title uses Playfair Display')
check("<h3 style={{ fontFamily: \"'Playfair Display', serif\"" in travel,
      'Travel semantic headings use Playfair Display')
check("fontFamily: \"'Playfair Display', serif\", fontSize: 24" in affiliate and 'Welcome back' in affiliate,
      'affiliate dashboard page heading uses Playfair Display')

check(len(EDITORIAL_FILES) >= 8,
      'editorial brand audit discovers the article/use-case/author collection')
for path in EDITORIAL_FILES:
    text = (ROOT / path).read_text(encoding='utf-8')
    check('/privacy-consent.js' in text,
          f'{path} keeps the shared privacy-consent manager')
    check('Playfair+Display' in text and 'Lora' in text,
          f'{path} loads Playfair Display headlines and Lora body')
    check("font-family: 'Lora', serif" in text or "font-family:'Lora',serif" in text,
          f'{path} uses Lora body typography')
    check("font-family: 'Playfair Display', serif" in text or "font-family:'Playfair Display',serif" in text,
          f'{path} uses Playfair Display headline typography')
    check('#2C4A38' in text,
          f'{path} carries Forest Green')
    # Gold is intentionally optional on educational/editorial pages. The brand
    # guide calls it a limited accent, so requiring it everywhere would create
    # artificial decoration rather than enforce the actual design system.
    check(any(token in text for token in CURRENT_SECONDARY_TOKENS),
          f'{path} uses a current light or secondary brand color')
    for legacy in LEGACY_TOKENS:
        check(legacy not in text, f'{path} no longer contains legacy brand token {legacy}')

# Reminder emails are customer-facing but email clients need safe font fallbacks.
check("font-family: 'Lora', Georgia, serif" in notifications,
      'reminder email body uses Lora with email-safe fallback')
check("font-family: 'Playfair Display', Georgia, serif" in notifications,
      'reminder email headings use Playfair with email-safe fallback')
check('#2C4A38' in notifications and '#C9A84C' in notifications and '#FAFCFB' in notifications,
      'reminder emails use current Forest/Gold/Warm White palette')
for legacy in LEGACY_TOKENS:
    check(legacy not in notifications,
          f'reminder emails no longer contain legacy brand token {legacy}')

# Brand-only work must not regress the email preference and compliance behavior.
check('__YPP_UNSUBSCRIBE_URL__' in notifications and 'List-Unsubscribe' in notifications and 'List-Unsubscribe-Post' in notifications,
      'reminder emails retain visible and one-click unsubscribe mechanisms')
check('email_notifications=neq.false' in notifications,
      'notification cron still excludes opted-out accounts')
check('days === 60 || days === 30 || days === 7' in notifications,
      'vaccine reminder cadence is unchanged')
check('days === 14 || days === 7 || days === 3 || days === 2' in notifications,
      'travel reminder cadence is unchanged')
check('if (isMonday)' in notifications and 'weeklyDigestEmail' in notifications,
      'weekly digest behavior is unchanged')

failed = [message for ok, message in checks if not ok]
for ok, message in checks:
    print(('PASS' if ok else 'FAIL') + ': ' + message)
if failed:
    raise SystemExit(f'{len(failed)} customer brand consistency check(s) failed')
print(f'Customer brand consistency audit passed: {len(checks)}/{len(checks)} checks')
