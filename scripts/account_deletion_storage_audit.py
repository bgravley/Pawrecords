#!/usr/bin/env python3
from pathlib import Path

helper = Path('api/_account-deletion.js').read_text(encoding='utf-8')
admin = Path('api/admin-data.js').read_text(encoding='utf-8')
e2e_delete = Path('api/e2e-delete-account.js').read_text(encoding='utf-8')

checks = [
    ("import { createClient } from '@supabase/supabase-js';" in helper,
     'Shared account deletion helper uses the Supabase Storage client'),
    ("export const ACCOUNT_UUID_RE =" in helper and "Invalid targetUserId" in helper,
     'Shared deletion helper validates the target UUID before using it as a Storage prefix'),
    ("export async function listStorageFilesRecursive" in helper and "limit: 1000" in helper,
     'Shared deletion helper recursively enumerates the user Storage tree with bounded batches'),
    ("await bucket.remove(batch)" in helper,
     'Shared deletion helper removes Storage objects through the Storage API'),
    ("Storage cleanup incomplete" in helper,
     'Shared deletion helper verifies the user Storage prefix is empty after removal'),
    ("const removedStorageObjects = await removeUserStorage" in helper,
     'Storage cleanup runs inside the shared deletion path'),
    (helper.index("const removedStorageObjects = await removeUserStorage") <
     helper.index("const profDelRes = await fetch"),
     'Profile deletion is fail-closed behind successful Storage cleanup'),
    ("deleteAccountById" in admin and "from './_account-deletion.js'" in admin,
     'Admin deletion uses the shared account deletion helper'),
    ("deleteAccountById" in e2e_delete and "from './_account-deletion.js'" in e2e_delete,
     'Synthetic deletion verifier exercises the same shared helper'),
    ("E2E_TEST_ACCOUNTS" in e2e_delete and "e2e_test" in e2e_delete,
     'Synthetic deletion verifier is restricted to marked E2E accounts'),
    ("verifyGitHubActionsOidc" in e2e_delete and "readGitHubOidcBearer" in e2e_delete,
     'Synthetic deletion verifier requires GitHub Actions OIDC'),
    ("verifyDeleted" in e2e_delete and "storage_objects" in e2e_delete and "auth_user" in e2e_delete,
     'Synthetic deletion verifier checks database, Storage, and Auth removal'),
]

failed = [msg for ok, msg in checks if not ok]
for ok, msg in checks:
    print(('PASS' if ok else 'FAIL') + ': ' + msg)

if failed:
    raise SystemExit(f'{len(failed)} account deletion storage check(s) failed')

print(f'Account deletion storage audit passed: {len(checks)}/{len(checks)} checks')
