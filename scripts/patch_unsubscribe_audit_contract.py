#!/usr/bin/env python3
from pathlib import Path

path = Path('scripts/audit.py')
text = path.read_text(encoding='utf-8')

old_sitemap = '''        if f.endswith(".html") and f not in ("404.html",):
            path = os.path.join(root, f)
            url_path = path.replace("public/", "/").replace("public", "")
            full_url = f"https://yourpetpass.com{url_path}"
            if full_url not in sitemap_urls:
                missing_from_sitemap.append(path)
'''
new_sitemap = '''        if f.endswith(".html") and f not in ("404.html",):
            path = os.path.join(root, f)
            content = open(path, errors='ignore').read()
            # Preference/action pages marked noindex should not be advertised
            # to search engines in sitemap.xml. The unsubscribe page is one
            # such page because its URL carries a signed capability token.
            if re.search(r'<meta[^>]+name=["\\\']robots["\\\'][^>]+content=["\\\'][^"\\\']*noindex', content, re.IGNORECASE):
                continue
            url_path = path.replace("public/", "/").replace("public", "")
            full_url = f"https://yourpetpass.com{url_path}"
            if full_url not in sitemap_urls:
                missing_from_sitemap.append(path)
'''
if old_sitemap not in text:
    raise SystemExit('Could not locate sitemap audit block')
text = text.replace(old_sitemap, new_sitemap, 1)

old_identity = '''        "SIGNUP_WEBHOOK_SECRET" in content
    )
'''
new_identity = '''        "SIGNUP_WEBHOOK_SECRET" in content or
        "verifyUnsubscribeToken(" in content     # signed capability authorizes preference change
    )
'''
if old_identity not in text:
    raise SystemExit('Could not locate endpoint identity verifier block')
text = text.replace(old_identity, new_identity, 1)

path.write_text(text, encoding='utf-8')
print('Updated audit contract for noindex pages and signed unsubscribe capability authorization.')
