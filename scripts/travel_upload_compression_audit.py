#!/usr/bin/env python3
from pathlib import Path

travel = Path('src/Travel.jsx').read_text(encoding='utf-8')
paw = Path('src/PawRecord.jsx').read_text(encoding='utf-8')

checks = [
    ('import { compressImageForUpload } from "./lib/db";' in travel,
     'Travel imports the shared image compression helper'),
    ('const uploadFile = await compressImageForUpload(file);' in travel,
     'Checklist-item travel document images are compressed before upload'),
    ('const uploadFile = await compressImageForUpload(entryDoc.file);' in travel,
     'Entry-document images are compressed before upload'),
    ("upload(path, file, { upsert: true })" not in travel,
     'Checklist-item uploads no longer send the original image file directly'),
    ("upload(path, entryDoc.file, { upsert: true })" not in travel,
     'Entry-document uploads no longer send the original image file directly'),
    ('const uploadFile=await db.compressImageForUpload(certFile);' in paw,
     'Pet certification document images use the shared compression helper'),
    ('upload(path,certFile,{upsert:true})' not in paw,
     'Pet certification uploads no longer send the original image file directly'),
]

failed = [msg for ok, msg in checks if not ok]
for ok, msg in checks:
    print(('PASS' if ok else 'FAIL') + ': ' + msg)

if failed:
    raise SystemExit(f'{len(failed)} travel upload compression audit check(s) failed')

print(f'Travel upload compression audit passed: {len(checks)}/{len(checks)} checks')
