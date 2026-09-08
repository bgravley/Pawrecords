#!/usr/bin/env python3
from pathlib import Path

p = Path('scripts/audit.py')
text = p.read_text(encoding='utf-8')
old_regex = "r'<loc>(https://yourpetpass\\.com[^<]*)</loc>'"
new_regex = "r'<loc>(https://www\\.yourpetpass\\.com[^<]*)</loc>'"
old_url = 'full_url = f"https://yourpetpass.com{url_path}"'
new_url = 'full_url = f"https://www.yourpetpass.com{url_path}"'

if old_regex in text:
    text = text.replace(old_regex, new_regex, 1)
elif new_regex not in text:
    raise SystemExit('sitemap regex anchor missing')

if old_url in text:
    text = text.replace(old_url, new_url, 1)
elif new_url not in text:
    raise SystemExit('sitemap full_url anchor missing')

p.write_text(text, encoding='utf-8')
print('audit.py sitemap host aligned to canonical www production host')
