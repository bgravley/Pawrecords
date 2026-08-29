from pathlib import Path

p = Path('scripts/audit.py')
s = p.read_text()
old = '''        "constructEvent" in content or          # stripe signature check
        "CRON_SECRET" in content or
        "WEBHOOK_SECRET" in content or'''
new = '''        "constructEvent" in content or          # stripe signature check
        "verifyCronRequest(" in content or       # shared fail-closed cron helper
        "CRON_SECRET" in content or
        "WEBHOOK_SECRET" in content or'''
if old in s:
    s = s.replace(old, new, 1)
elif new not in s:
    raise SystemExit('audit identity helper anchor missing')
p.write_text(s)
