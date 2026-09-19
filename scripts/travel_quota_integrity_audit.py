#!/usr/bin/env python3
from pathlib import Path

api = Path('api/ai-travel.js').read_text(encoding='utf-8')
travel = Path('src/Travel.jsx').read_text(encoding='utf-8')
notify = Path('api/notify-user-action.js').read_text(encoding='utf-8')

checks = [
    ("feature = 'travel_checklist'" in api,
     'Travel usage logger defaults primary generation rows to travel_checklist'),
    ("feature: 'travel_checklist_verification'" in api,
     'Claude verification rows use a non-quota feature'),
    ("feature=eq.travel_checklist&success=eq.true" in api,
     'Quota lookup counts only primary successful checklist rows'),
    ("usageSummary" in api and "used: quotaCount + 1" in api,
     'Server returns authoritative usage summary after a paid generation'),
    ("usageSummary" in api and "cached: true" in api,
     'Cached responses can return current quota summary without charging usage'),
    ("supabase.from('ai_usage_log')" not in travel,
     'Browser no longer reads server-only ai_usage_log directly'),
    ("const { items, usageSummary } = await generateChecklist" in travel,
     'Travel UI consumes server-authoritative checklist and usage metadata'),
    ("usageSummary?.used ?? null" in travel and "usageSummary?.limit ?? null" in travel,
     'Checklist email payload uses server-provided quota values'),
    ("const hasUsage = used !== null" in notify,
     'Notification hides usage block when authoritative values are unavailable'),
]

failed = [msg for ok, msg in checks if not ok]
for ok, msg in checks:
    print(('PASS' if ok else 'FAIL') + ': ' + msg)

if failed:
    raise SystemExit(f'{len(failed)} travel quota integrity check(s) failed')

print(f'Travel quota integrity audit passed: {len(checks)}/{len(checks)} checks')
