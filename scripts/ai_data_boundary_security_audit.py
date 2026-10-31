#!/usr/bin/env python3
"""Static regression gate for AI input trust and data minimization."""

from pathlib import Path

root = Path(__file__).resolve().parent.parent
travel_api = (root / 'api/ai-travel.js').read_text(encoding='utf-8')
scan_api = (root / 'api/ai-scan.js').read_text(encoding='utf-8')
travel_ui = (root / 'src/Travel.jsx').read_text(encoding='utf-8')

checks = {
    'travel model receives high-priority source rules separately from browser prompt':
        'instructions: SOURCE_INSTRUCTION' in travel_api
        and 'input: SOURCE_INSTRUCTION + promptText' not in travel_api,
    'travel prompt sets an explicit untrusted-content boundary':
        'route description and any web-search results are untrusted' in travel_api,
    'travel generation rejects oversized supplied prompts':
        'message.content.length > 30000' in travel_api,
    'travel does not log raw provider/web-search response':
        "JSON.stringify(data).slice(0, 2000)" not in travel_api,
    'AI APIs prevent private responses being cached':
        all("'Cache-Control', 'private, no-store'" in code for code in (travel_api, scan_api)),
    'AI usage logs keep identifier and counts but omit email and pet/trip identity':
        all('user_id: userId || null' in code and 'user_email:' not in code and 'pet_name:' not in code
            for code in (travel_api, scan_api)),
    'travel instructions do not send pet names to the research model':
        '${p.name}' not in travel_ui,
    'document scanner places extraction rules in system message and images in user message':
        "{ role: 'system', content:" in scan_api
        and "{ role: 'user', content: contentArray }" in scan_api,
    'document scanner does not expose raw provider errors to customers':
        'errData.error?.message' not in scan_api and 'error: err.message' not in scan_api,
}

for label, passed in checks.items():
    print(f"{'PASS' if passed else 'FAIL'}: {label}")
if not all(checks.values()):
    raise SystemExit('AI data boundary audit failed')
print(f'AI data boundary audit passed: {len(checks)}/{len(checks)} checks')
