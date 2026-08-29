import {
  emergencyContactLabel,
  emergencyUrl,
  ensureEmergencyToken,
  getOrCreateWalletPass,
  getWalletSettings,
  googleWalletApprovedForPrivatePass,
  googleWalletConfigured,
  microchipLast4,
  ownedPet,
  rabiesStatus,
  serviceAnimalLabel,
  setProviderObjectId,
  signGoogleWalletJwt,
  walletErrorResponse,
  WalletHttpError,
} from '../_wallet-shared.js';

function localized(value) {
  return { defaultValue: { language: 'en-US', value } };
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  res.setHeader('Cache-Control', 'private, no-store');
  res.setHeader('X-Content-Type-Options', 'nosniff');

  try {
    if (!googleWalletConfigured()) {
      throw new WalletHttpError(503, 'Google Wallet is not configured yet', 'google_wallet_unconfigured');
    }

    // A YourPetPass Wallet QR is a bearer credential to a pet emergency health
    // record. Keep Google issuance dark until Google has explicitly approved
    // the private-pass use case for this issuer account.
    if (!googleWalletApprovedForPrivatePass()) {
      throw new WalletHttpError(
        503,
        'Google Wallet private-pass approval is still pending',
        'google_wallet_private_pass_pending'
      );
    }

    const { user, pet: owned } = await ownedPet(req, req.body?.petId);
    const pet = await ensureEmergencyToken(owned);
    const settings = await getWalletSettings(user.id, pet.id);
    const pass = await getOrCreateWalletPass(user.id, pet.id, 'google');

    const issuerId = process.env.GOOGLE_WALLET_ISSUER_ID;
    const classId = process.env.GOOGLE_WALLET_CLASS_ID;
    const objectId = pass.provider_object_id || `${issuerId}.${pass.serial_number}`;
    if (!pass.provider_object_id) await setProviderObjectId(pass.id, objectId);

    const textModulesData = [
      { id: 'purpose', header: 'YOURPETPASS', body: 'Health & Travel' },
    ];

    if (settings.show_rabies_status) {
      textModulesData.push({ id: 'rabies', header: 'RABIES', body: await rabiesStatus(pet.id) });
    }

    if (settings.show_microchip_last4) {
      const last4 = microchipLast4(pet.microchip);
      if (last4) textModulesData.push({ id: 'microchip', header: 'MICROCHIP', body: `Ends in ${last4}` });
    }

    if (settings.show_service_animal) {
      const serviceLabel = serviceAnimalLabel(pet);
      if (serviceLabel) textModulesData.push({ id: 'service', header: 'CLASSIFICATION', body: serviceLabel });
    }

    if (settings.show_emergency_contact) {
      const contact = emergencyContactLabel(pet);
      if (contact) textModulesData.push({ id: 'emergency', header: 'EMERGENCY CONTACT', body: contact });
    }

    const genericObject = {
      id: objectId,
      classId,
      state: 'ACTIVE',
      genericType: 'GENERIC_TYPE_UNSPECIFIED',
      hexBackgroundColor: '#2C4A38',
      cardTitle: localized('YourPetPass'),
      subheader: localized([pet.species, pet.breed].filter(Boolean).join(' · ') || 'Pet'),
      header: localized(pet.name),
      logo: {
        sourceUri: { uri: 'https://yourpetpass.com/icon-512.png' },
        contentDescription: localized('YourPetPass'),
      },
      barcode: {
        type: 'QR_CODE',
        value: emergencyUrl(pet.emergency_token),
        alternateText: 'Scan for emergency pet record',
      },
      textModulesData,
    };

    const claims = {
      iss: process.env.GOOGLE_WALLET_SERVICE_ACCOUNT_EMAIL,
      aud: 'google',
      typ: 'savetowallet',
      iat: Math.floor(Date.now() / 1000),
      origins: ['https://yourpetpass.com'],
      payload: { genericObjects: [genericObject] },
    };

    const jwt = signGoogleWalletJwt(claims);
    // Google's web-save URL is intended to remain compact. Keeping an upper
    // bound also prevents optional display fields from accidentally creating
    // an unusable save link.
    if (jwt.length > 1800) {
      throw new WalletHttpError(
        500,
        'Google Wallet pass is too large to issue safely',
        'google_wallet_payload_too_large'
      );
    }

    return res.status(200).json({
      url: `https://pay.google.com/gp/v/save/${jwt}`,
      objectId,
    });
  } catch (error) {
    return walletErrorResponse(res, error);
  }
}
