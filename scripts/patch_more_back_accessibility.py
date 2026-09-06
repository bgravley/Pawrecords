#!/usr/bin/env python3
from pathlib import Path

path = Path('src/PawRecord.jsx')
text = path.read_text(encoding='utf-8')
old = 'const backBtn=<button onClick={back} style={{background:"#FFFFFF",border:"1px solid #DCE8E0",borderRadius:8,padding:"6px 8px",color:"#385744"}}><Ic n="chevL" s={16}/></button>;'
new = 'const backBtn=<button type="button" aria-label="Back to More features" onClick={back} style={{background:"#FFFFFF",border:"1px solid #DCE8E0",borderRadius:8,padding:"6px 8px",color:"#385744"}}><Ic n="chevL" s={16}/></button>;'
if new in text:
    print('More back button already labeled')
elif old in text:
    path.write_text(text.replace(old, new, 1), encoding='utf-8')
    print('Labeled More back button')
else:
    raise SystemExit('Could not locate More back button')
