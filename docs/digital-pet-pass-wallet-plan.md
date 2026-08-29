# YourPetPass Digital Pet Pass — Apple Wallet + Google Wallet

Status: Approved for implementation
Priority: Next product feature after launch verification; before Stripe/payment work

## Product goal

Give every pet a YourPetPass Digital Pet Pass that the pet parent can save to Apple Wallet or Google Wallet. The pass is a fast-access identity and emergency-access card, not a copy of the pet's full medical record.

The Wallet pass should reinforce the existing secure Emergency QR architecture:

- Wallet stores a pet-facing summary and a QR code.
- The QR code points to the existing secure YourPetPass emergency URL/token.
- The emergency record remains server-controlled and token-scoped.
- Detailed medical records and uploaded documents stay out of the Wallet pass.

## Where it belongs in the product

Add a new `Digital Pet Pass` section to each pet's QR / emergency-card area in the main pet record screen.

Primary actions:

- Add to Apple Wallet
- Add to Google Wallet
- View Emergency QR
- Regenerate Emergency QR (existing behavior, with warning that previously saved passes must be refreshed/updated)

Do not make Wallet a separate top-level product area. It is an extension of the pet's Emergency / Travel identity.

## Wallet card content — Stage 1

Front / primary display:

- YourPetPass branding
- Pet photo
- Pet name
- Pet type / breed where space allows
- `Health & Travel`
- QR code: `https://yourpetpass.com/emergency/<secure-token>`
- Text: `Scan for emergency pet record`

Optional owner-controlled fields:

- Rabies status: `Current` / `Review needed` (no certificate number on the pass)
- Microchip: last 4 digits only
- Service animal designation: shown only if the owner explicitly enables it
- Emergency contact name / phone only if the owner explicitly enables it

Do not place these on the Wallet card:

- Full vaccine history
- Veterinary notes
- Medication history beyond any future explicitly approved emergency summary
- Uploaded medical documents
- User account ID or pet database ID
- Full microchip number by default
- Private owner/account information

## Stage 1 — Issue Wallet passes

### Apple Wallet

Build an authenticated server endpoint that generates and signs a `.pkpass` file for a pet the signed-in user owns.

Proposed endpoint:

`GET /api/wallet/apple?petId=<id>`

Requirements:

- Apple Developer account
- Wallet Pass Type ID for YourPetPass
- Apple pass-signing certificate/private key
- Apple WWDR certificate as required by the signing library/process
- Secrets stored only in Vercel production environment variables
- `Content-Type: application/vnd.apple.pkpass`

Use a separate random Wallet serial identifier rather than exposing a database record ID as the public pass serial.

The pass QR points only to the existing emergency token URL.

### Google Wallet

Build an authenticated server endpoint that creates/updates the pet's Wallet object and returns a signed `Add to Google Wallet` URL/JWT.

Proposed endpoint:

`POST /api/wallet/google`

Request body:

`{ "petId": "..." }`

Requirements:

- Google Pay & Wallet Console issuer account
- Google Wallet issuer ID
- Service account / signing credentials stored only in Vercel
- YourPetPass Generic Pass class
- Confirm with Google whether the selected pet/emergency fields qualify for standard Generic Pass or require Generic Private Pass approval. If Google classifies the contents as sensitive, use the private-pass path rather than reducing protections.

The pass QR points only to the existing emergency token URL.

## Stage 2 — Live pass updates

Implement after Stage 1 issuance is stable.

### Apple

Implement Apple's Wallet pass-update web service so installed passes can update without the user deleting/re-adding them.

Data model:

- `wallet_passes`
  - id
  - user_id
  - dog_id
  - platform
  - serial_number
  - authentication_token_hash
  - last_updated_at
  - status

- `apple_wallet_devices`
  - device_library_identifier
  - push_token
  - created_at
  - updated_at

- `apple_wallet_registrations`
  - pass_id
  - device_library_identifier

Apple service routes should follow the PassKit update protocol under a dedicated Wallet API namespace.

### Google

Keep a stable Google Wallet object ID per pet/pass. Update the object through the Google Wallet API when approved display fields change.

## Events that should update the saved Wallet pass

- Pet photo changed
- Pet name changed
- Emergency QR token regenerated
- Owner changes which optional Wallet fields are visible
- Emergency contact changed, if displayed
- Rabies status changes, if displayed
- Service-animal designation changed, if displayed

A change to the underlying private medical record should not automatically make new medical detail public in Wallet.

## Security rules

1. Wallet-generation endpoints require an authenticated YourPetPass user.
2. The requested pet must belong to that user.
3. Apple/Google signing credentials stay server-side only.
4. Wallet passes never contain the Supabase service key, auth tokens, raw user IDs, or private document URLs.
5. The QR uses the existing high-entropy emergency token, not a pet database ID.
6. Regenerating the emergency token invalidates the old emergency URL immediately.
7. Any pass-update endpoint must authenticate Apple/Google platform requests according to the respective platform protocol.
8. Owner-controlled visibility preferences must be enforced server-side when the pass is generated or updated.

## UX placement

In the existing QR / Emergency Card area for each pet:

### Digital Pet Pass
`Keep your pet's emergency card one tap away.`

[ Add to Apple Wallet ]
[ Add to Google Wallet ]

Supporting copy:
`The Wallet card contains your pet's basic identity and secure Emergency QR — not their full medical record.`

Only show a platform button when that integration is configured in production. Do not show a dead button that cannot issue a pass.

## Rollout order

### Current launch work — finish first

1. Remove obsolete anonymous Emergency Pet Lookup behavior.
2. Align authentication screen with current brand system.
3. Complete live launch smoke testing.
4. Verify the first production runs of `/api/supabase-health` and `/api/cron-notifications`.

### Wallet Stage 0 — immediately after current launch verification

1. Apple Developer / Pass Type ID setup.
2. Google Wallet issuer setup.
3. Confirm Google Generic vs Generic Private classification for the intended fields.
4. Add production secrets/credentials in Vercel.
5. Finalize Wallet visual template using current YourPetPass brand system.

### Wallet Stage 1 — next engineering feature

1. Add Wallet preference fields/data model.
2. Build Apple pass generator.
3. Build Google Wallet issuer endpoint.
4. Add `Digital Pet Pass` UI to the pet QR/emergency section.
5. Test ownership isolation and QR behavior.
6. Test on physical Apple Wallet and Google Wallet devices.
7. Release to production.

### Wallet Stage 2 — immediately after Stage 1 proves stable

1. Add Apple device registration/update web service.
2. Add Google object update logic.
3. Trigger updates from approved pet/profile changes.
4. Test token regeneration / pass-refresh behavior.
5. Add monitoring and regression tests.

### Stripe

Resume Stripe/payment integration after Wallet Stage 1 unless launch/business timing requires payments to move ahead of Wallet. The Wallet feature does not depend on Stripe.

## Definition of done — Stage 1

- Owner can add the correct pet to Apple Wallet from YourPetPass.
- Owner can add the correct pet to Google Wallet from YourPetPass.
- QR opens only that pet's valid token-scoped emergency record.
- Another signed-in user cannot issue a Wallet pass for someone else's pet.
- No private documents or full medical history are embedded in the pass.
- Emergency token regeneration invalidates the old QR target.
- Apple/Google credentials are not present in client-side bundles or repository files.
- Mobile display matches the YourPetPass brand system.
- Both integrations have automated server tests plus physical-device verification.
