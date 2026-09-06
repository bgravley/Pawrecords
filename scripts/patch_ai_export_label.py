#!/usr/bin/env python3
from pathlib import Path

path = Path('src/Travel.jsx')
text = path.read_text(encoding='utf-8')
old = "${i.researched_at ? '<br><small>Checked ' + new Date(i.researched_at).toLocaleDateString() + '</small>' : ''}"
new = "${i.researched_at ? '<br><small>Researched ' + new Date(i.researched_at).toLocaleDateString() + '</small>' : ''}"
count = text.count(old)
if count != 1:
    raise SystemExit(f'Expected exactly one exported Checked label, found {count}')
text = text.replace(old, new, 1)
path.write_text(text, encoding='utf-8')
print('Changed exported AI source date label from Checked to Researched.')
