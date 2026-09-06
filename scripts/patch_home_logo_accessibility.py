#!/usr/bin/env python3
from pathlib import Path

path = Path('src/PawRecord.jsx')
text = path.read_text(encoding='utf-8')
old = '<button onClick={()=>{setSelDog(null);window.scrollTo(0,0);}} style={{background:"none",border:"none",cursor:"pointer",textAlign:"left",padding:0}}>'
new = '<button type="button" aria-label="YourPetPass home" onClick={()=>{setSelDog(null);window.scrollTo(0,0);}} style={{background:"none",border:"none",cursor:"pointer",textAlign:"left",padding:0}}>'
if new in text:
    print('Home logo button already labeled')
elif old in text:
    path.write_text(text.replace(old, new, 1), encoding='utf-8')
    print('Labeled home logo button')
else:
    raise SystemExit('Could not locate home logo button')
