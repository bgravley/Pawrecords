#!/usr/bin/env python3
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
failures = []
passes = []


def check(ok, message):
    (passes if ok else failures).append(message)


html_files = [ROOT / 'index.html', *sorted((ROOT / 'public').rglob('*.html'))]
for path in html_files:
    text = path.read_text(encoding='utf-8', errors='ignore')
    rel = path.relative_to(ROOT)
    check(text.count('/privacy-consent.js') == 1, f'{rel} loads the shared privacy consent manager exactly once')
    check('googletagmanager.com/gtag/js?id=G-GLHNVC9XZV' not in text,
          f'{rel} does not load GA4 directly before consent')
    check('www.clarity.ms/tag/' not in text,
          f'{rel} does not load Microsoft Clarity directly before consent')

consent = (ROOT / 'public/privacy-consent.js').read_text(encoding='utf-8', errors='ignore')
check("ypp_analytics_consent_v1" in consent, 'Analytics preference uses a dedicated local-storage key')
check('globalPrivacyControl === true' in consent, 'Global Privacy Control is honored')
check("getStatus() !== 'granted'" in consent, 'Optional analytics loader fails closed unless consent is granted')
check('Allow analytics' in consent and 'Essential only' in consent, 'Consent UI offers clear allow and reject choices')
check('googletagmanager.com/gtag/js' in consent and 'www.clarity.ms/tag/' in consent,
      'GA4 and Clarity are loaded only by the shared consent manager')
check('Privacy choices' in consent and '/privacy.html' in consent,
      'Visitors can reopen privacy choices and reach the Privacy Policy')
check("previous === 'granted' && status === 'denied'" in consent and 'window.location.reload()' in consent,
      'Withdrawing analytics consent removes already-loaded vendor scripts on reload')
check("window[`ga-disable-${GA_ID}`] = true" in consent,
      'Google Analytics is disabled immediately when consent is denied')
check('clearAnalyticsCookies()' in consent and "name.startsWith('_ga')" in consent and "name === '_clck'" in consent,
      'Known GA4 and Clarity first-party analytics cookies are cleared on denial')

main = (ROOT / 'src/main.jsx').read_text(encoding='utf-8', errors='ignore')
check('ConsentAnalytics' in main and 'return allowed ? <Analytics /> : null' in main,
      'Vercel Analytics is mounted only after analytics consent')

analytics = (ROOT / 'src/lib/analytics.js').read_text(encoding='utf-8', errors='ignore')
check("window.YPPAnalyticsConsent?.isGranted?.() !== true" in analytics,
      'Product analytics events require affirmative analytics consent')

privacy = (ROOT / 'public/privacy.html').read_text(encoding='utf-8', errors='ignore')
for phrase in ['Google Analytics', 'Microsoft Clarity', 'Vercel Analytics', 'Global Privacy Control', 'Privacy choices']:
    check(phrase in privacy, f'Privacy Policy discloses {phrase}')
check('Last Updated: September 6, 2026' in privacy, 'Privacy Policy carries the current consent update date')
check('pet names, medical record contents, document contents, or travel itinerary details' in privacy,
      'Privacy Policy describes the coarse analytics data boundary')

print('\nYourPetPass privacy-consent audit')
print('=' * 36)
for item in passes:
    print(f'PASS  {item}')

if failures:
    print('\nFAILURES')
    for item in failures:
        print(f'FAIL  {item}')
    raise SystemExit(1)

print(f'\nAll {len(passes)} privacy-consent checks passed.')
