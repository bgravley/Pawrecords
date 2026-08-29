import { readFile } from 'node:fs/promises';
import { PKPass } from 'passkit-generator';
import {
  appleWalletConfigured,
  decodeBase64Env,
  emergencyContactLabel,
  emergencyUrl,
  ensureEmergencyToken,
  getOrCreateWalletPass,
  getWalletSettings,
  microchipLast4,
  ownedPet,
  rabiesStatus,
  serviceAnimalLabel,
  walletErrorResponse,
  WalletHttpError,
} from '../_wallet-shared.js';

function safeFileName(name) {
  const cleaned = String(name || 'pet').replace(/[^a-z0-9_-]+/gi, '-').replace(/^-+|-+$/g, '');
  return `${cleaned || 'pet'}-yourpetpass.pkpass`;
}

async function iconBuffer() {
  // Static reference keeps the asset traceable by Vercel's function bundler.
  return readFile(new URL('../../public/icon-192.png', import.meta.url));
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  res.setHeader('Cache-Control', 'private, no-store');
  res.setHeader('X-Content-Type-Options', 'nosniff');

  try {
    if (!appleWalletConfigured()) {
      throw new WalletHttpError(503, 'Apple Wallet is not configured yet', 'apple_wallet_unconfigured');
    }

    const { user, pet: owned } = await ownedPet(req, req.body?.petId);
    const pet = await ensureEmergencyToken(owned);
    const settings = await getWalletSettings(user.id, pet.id);
    const walletPass = await getOrCreateWalletPass(user.id, pet.id, 'apple');

    const [icon, wwdr, signerCert, signerKey] = await Promise.all([
      iconBuffer(),
      Promise.resolve(decodeBase64Env('APPLE_WALLET_WWDR_CERT_B64')),
      Promise.resolve(decodeBase64Env('APPLE_WALLET_SIGNER_CERT_B64')),
      Promise.resolve(decodeBase64Env('APPLE_WALLET_SIGNER_KEY_B64')),
    ]);

    if (!wwdr || !signerCert || !signerKey) {
      throw new WalletHttpError(503, 'Apple Wallet certificates are incomplete', 'apple_wallet_certificates_incomplete');
    }

    const pass = new PKPass(
      {
        'icon.png': icon,
        'icon@2x.png': icon,
      },
      {
        wwdr,
        signerCert,
        signerKey,
        ...(process.env.APPLE_WALLET_SIGNER_KEY_PASSPHRASE
          ? { signerKeyPassphrase: process.env.APPLE_WALLET_SIGNER_KEY_PASSPHRASE }
          : {}),
      },
      {
        formatVersion: 1,
        passTypeIdentifier: process.env.APPLE_WALLET_PASS_TYPE_ID,
        teamIdentifier: process.env.APPLE_WALLET_TEAM_ID,
        organizationName: 'YourPetPass',
        description: `${pet.name} Digital Pet Pass`,
        serialNumber: walletPass.serial_number,
        logoText: 'YourPetPass',
        foregroundColor: 'rgb(250, 252, 251)',
        backgroundColor: 'rgb(44, 74, 56)',
        labelColor: 'rgb(201, 168, 76)',
      }
    );

    pass.type = 'generic';
    pass.primaryFields.push({ key: 'pet_name', label: 'PET', value: pet.name });
    pass.secondaryFields.push({
      key: 'identity',
      label: 'HEALTH & TRAVEL',
      value: [pet.species, pet.breed].filter(Boolean).join(' · ') || 'Pet',
    });

    if (settings.show_rabies_status) {
      pass.auxiliaryFields.push({ key: 'rabies', label: 'RABIES', value: await rabiesStatus(pet.id) });
    }

    if (settings.show_microchip_last4) {
      const last4 = microchipLast4(pet.microchip);
      if (last4) pass.auxiliaryFields.push({ key: 'microchip', label: 'MICROCHIP', value: `•••• ${last4}` });
    }

    if (settings.show_service_animal) {
      const serviceLabel = serviceAnimalLabel(pet);
      if (serviceLabel) pass.backFields.push({ key: 'classification', label: 'Classification', value: serviceLabel });
    }

    if (settings.show_emergency_contact) {
      const contact = emergencyContactLabel(pet);
      if (contact) pass.backFields.push({ key: 'emergency_contact', label: 'Emergency Contact', value: contact });
    }

    pass.backFields.push({
      key: 'privacy',
      label: 'About this pass',
      value: 'This card contains basic pet identity and a secure Emergency QR. Full medical records and private documents are not stored in Apple Wallet.',
    });

    pass.setBarcodes({
      message: emergencyUrl(pet.emergency_token),
      format: 'PKBarcodeFormatQR',
      altText: 'Scan for emergency pet record',
      messageEncoding: 'iso-8859-1',
    });

    const buffer = pass.getAsBuffer();
    res.setHeader('Content-Type', 'application/vnd.apple.pkpass');
    res.setHeader('Content-Disposition', `attachment; filename="${safeFileName(pet.name)}"`);
    res.setHeader('Content-Length', String(buffer.length));
    return res.status(200).send(buffer);
  } catch (error) {
    return walletErrorResponse(res, error);
  }
}
