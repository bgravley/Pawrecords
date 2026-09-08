#!/usr/bin/env python3
from pathlib import Path

path = Path(__file__).resolve().parents[1] / 'src/AffiliatePortal.jsx'
text = path.read_text(encoding='utf-8')

explanation = '<div style={{ fontSize: 11, color: C.muted, marginTop: 3 }}>Customer Payment shows the gross charge or refund. Your commission is calculated from the eligible payment amount after Stripe processing fees.</div>'
duplicated = f'<div><div><div style={{{{ fontWeight: 700, fontSize: 16 }}}}>Transaction Ledger</div>{explanation}</div>{explanation}</div>'
clean = f'<div><div style={{{{ fontWeight: 700, fontSize: 16 }}}}>Transaction Ledger</div>{explanation}</div>'

count = text.count(duplicated)
if count != 1:
    raise SystemExit(f'expected one duplicated ledger explanation, found {count}')
path.write_text(text.replace(duplicated, clean, 1), encoding='utf-8')
print('cleaned duplicate affiliate ledger explanation')
