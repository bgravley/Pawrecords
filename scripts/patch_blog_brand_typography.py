#!/usr/bin/env python3
from pathlib import Path
p=Path('public/blog.html')
t=p.read_text(encoding='utf-8')
old='body{margin:0;background:#FAFCFB;color:#1A2E22;font:16px/1.7 Lora,serif}'
new="body{margin:0;background:#FAFCFB;color:#1A2E22;font-family:'Lora',serif;font-size:16px;line-height:1.7}"
count=t.count(old)
if count != 1:
    raise SystemExit(f'Expected one Pet Guides body shorthand, found {count}')
p.write_text(t.replace(old,new,1),encoding='utf-8')
print('Normalized Pet Guides body typography to explicit Lora declaration.')
