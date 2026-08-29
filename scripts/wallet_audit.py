#!/usr/bin/env python3
"""Static security/regression checks for YourPetPass Digital Pet Pass Stage 1."""
from pathlib import Path
import json
import re
import sys

ROOT = Path(__file__).resolve().parents[1]
failures = []
passes = []


def check(condition, message):
    (passes if condition else failures).append(message)
    print(f"{'PASS' if condition else 'FAIL'}: {message}")


def text(path):
    p = ROOT / path
    if not p.exists():
        failures.append(f"Required Wallet file exists: {path}")
        return ""
    return p.read_text()


migration = text('supabase/migrations/20260829144500_wallet_stage_one_foundation.sql')
shared = text('api/_wallet-shared.js')
apple = text('api/wallet/apple.js')
google = text('api/wallet/google.js')
config = text('api/wallet/config.js')
paw = text('src/PawRecord.jsx')
package = json.loads(text('package.json') or '{}')

check('alter table public.wallet_settings enable row level security' in migration.lower(), 'wallet_settings has RLS enabled')
check('alter table public.wallet_passes enable row level security' in migration.lower(), 'wallet_passes has RLS enabled')
check(migration.count('(select auth.uid())') >= 8, 'Wallet RLS policies bind rows to auth.uid() ownership')
check('revoke all on public.wallet_settings from anon' in migration.lower(), 'Anonymous Wallet settings access is revoked')
check('revoke all on public.wallet_passes from anon' in migration.lower(), 'Anonymous Wallet pass access is revoked')

check('user_id=eq.${encodeURIComponent(user.id)}' in shared, 'Server ownership lookup scopes pets to the authenticated user')
check('/auth/v1/user' in shared, 'Wallet server validates Supabase user sessions')
check('SUPABASE_SERVICE_KEY' in shared and 'VITE_SUPABASE' not in shared, 'Service role credential remains server-only')
check('ensureEmergencyToken' in shared and "crypto.randomUUID().replace(/-/g, '')" in shared, 'Wallet uses high-entropy emergency tokens')

check("ownedPet(req, req.body?.petId)" in apple, 'Apple issuance verifies pet ownership')
check("application/vnd.apple.pkpass" in apple, 'Apple endpoint returns the Wallet pass MIME type')
check('PKPass' in apple and 'getAsBuffer' in apple and 'setBarcodes' in apple, 'Apple endpoint generates and signs a real pkpass')
check('private files' in apple.lower() and 'full medical records' in apple.lower(), 'Apple pass explicitly excludes private/full medical records')

check("ownedPet(req, req.body?.petId)" in google, 'Google issuance verifies pet ownership')
check('googleWalletApprovedForPrivatePass()' in google, 'Google issuance is gated on private-pass approval')
check("typ: 'savetowallet'" in google and 'signGoogleWalletJwt' in google, 'Google save URL uses a signed Wallet JWT')
check('1800' in google, 'Google Wallet JWT size is bounded')

check("ownedPet(req, petIdFrom(req))" in config, 'Wallet settings endpoint verifies pet ownership')
check('saveWalletSettings' in config and 'getWalletSettings' in config, 'Wallet privacy settings are persisted server-side')

check("This QR code opens <b>{dog.name}'s secure emergency record</b>" in paw, 'QR UI describes the secured emergency record accurately')
check("sees the complete record instantly" not in paw, 'Legacy unrestricted QR claim is removed')
check("links to <b>{dog.name}'s full health record</b>" not in paw, 'Legacy full-health-record QR claim is removed')
check('Digital Pet Pass' in paw and 'Add to Apple Wallet' in paw and 'Add to Google Wallet' in paw, 'Digital Pet Pass UI and provider actions are present')
check('walletConfig?.providers?.enabled' in paw, 'Wallet UI stays hidden until a provider is configured')
check('show_rabies_status' in paw and 'show_microchip_last4' in paw and 'show_service_animal' in paw and 'show_emergency_contact' in paw, 'Wallet optional health/identity fields are explicit opt-ins')

check(package.get('dependencies', {}).get('passkit-generator') == '3.5.7', 'Apple pass generator dependency is pinned exactly')
check(not (ROOT / '.github/workflows/wallet-deps-temp.yml').exists(), 'Temporary Wallet dependency workflow is absent')
check(not (ROOT / '.github/workflows/wallet-ui-temp.yml').exists(), 'Temporary Wallet UI workflow is absent')

client_secret_patterns = [
    'APPLE_WALLET_SIGNER_KEY_B64',
    'GOOGLE_WALLET_PRIVATE_KEY_B64',
    'SUPABASE_SERVICE_KEY',
]
qr_section = re.search(r'const QRSection=.*?const OverviewTab=', paw, re.S)
client_block = qr_section.group(0) if qr_section else paw
for secret_name in client_secret_patterns:
    check(secret_name not in client_block, f'Client QR/Wallet UI does not reference server secret {secret_name}')

print(f"\nWallet audit: {len(passes)} passed, {len(failures)} failed")
if failures:
    sys.exit(1)
