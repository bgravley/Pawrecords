from pathlib import Path

app = Path('src/App.jsx').read_text()
funnel = Path('src/SignupFunnel.jsx').read_text()

checks = {
    'signup route renders funnel': "path === '/signup'" in app and '<SignupFunnel' in app,
    'funnel preserves existing auth flow': "setAuthEntryMode('signup')" in app and 'setShowAuthScreen(true)' in app,
    'funnel contains free-account CTA': 'Create Free Account' in funnel,
    'funnel communicates no-card free start': 'No credit card required' in funnel and 'Free to start' in funnel,
    'funnel covers records value': 'Health records in one place' in funnel,
    'funnel covers travel value': 'AI-assisted travel planning' in funnel,
    'funnel covers emergency value': 'Emergency-ready information' in funnel,
    'funnel supports contextual travel messaging': "'pet-travel'" in funnel and 'from.includes' in funnel,
    'funnel is mobile responsive': '@media(max-width:820px)' in funnel,
}

failed = [name for name, ok in checks.items() if not ok]
for name, ok in checks.items():
    print(('PASS' if ok else 'FAIL') + ': ' + name)

if failed:
    raise SystemExit('Signup funnel audit failed: ' + ', '.join(failed))
