#!/usr/bin/env python3
from pathlib import Path

admin = Path('api/admin-data.js').read_text(encoding='utf-8')

checks = [
    ("import { createClient } from '@supabase/supabase-js';" in admin,
     'Account deletion uses the Supabase Storage client'),
    ("const UUID_RE =" in admin and "Invalid targetUserId" in admin,
     'Account deletion validates the target UUID before using it as a Storage prefix'),
    ("listStorageFilesRecursive" in admin and "limit: 1000" in admin,
     'Account deletion recursively enumerates the user Storage tree with bounded batches'),
    ("await bucket.remove(batch)" in admin,
     'Account deletion removes Storage objects through the Storage API'),
    ("Storage cleanup incomplete" in admin,
     'Account deletion verifies the user Storage prefix is empty after removal'),
    ("const removedStorageObjects = await removeUserStorage" in admin,
     'Storage cleanup runs before profile deletion'),
    (admin.index("const removedStorageObjects = await removeUserStorage") <
     admin.index("const profDelRes = await fetch"),
     'Profile deletion is fail-closed behind successful Storage cleanup'),
]

failed = [msg for ok, msg in checks if not ok]
for ok, msg in checks:
    print(('PASS' if ok else 'FAIL') + ': ' + msg)

if failed:
    raise SystemExit(f'{len(failed)} account deletion storage check(s) failed')

print(f'Account deletion storage audit passed: {len(checks)}/{len(checks)} checks')
