#!/usr/bin/env python3
from pathlib import Path

p = Path('src/PawRecord.jsx')
text = p.read_text(encoding='utf-8')
old = 'Upload any vet record, vaccine doc, or service animal cert — AI extracts and saves everything automatically.'
new = 'Upload a vet record, vaccine document, or service animal certificate — AI extracts useful details for you to review before you save them.'
count = text.count(old)
if count != 1:
    raise SystemExit(f'expected stale AI auto-save claim exactly once, found {count}')
text = text.replace(old, new, 1)
p.write_text(text, encoding='utf-8')
print('in-app AI document-scan claim aligned with review-before-save behavior')
