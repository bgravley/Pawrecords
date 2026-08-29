import {
  getWalletSettings,
  ownedPet,
  publicWalletConfig,
  saveWalletSettings,
  walletErrorResponse,
} from '../_wallet-shared.js';

function petIdFrom(req) {
  return req.method === 'GET' ? req.query?.petId : req.body?.petId;
}

export default async function handler(req, res) {
  if (req.method !== 'GET' && req.method !== 'POST') {
    res.setHeader('Allow', 'GET, POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  res.setHeader('Cache-Control', 'private, no-store');
  res.setHeader('X-Content-Type-Options', 'nosniff');

  try {
    const { user, pet } = await ownedPet(req, petIdFrom(req));
    const settings = req.method === 'POST'
      ? await saveWalletSettings(user.id, pet.id, req.body?.settings || {})
      : await getWalletSettings(user.id, pet.id);

    return res.status(200).json({
      petId: pet.id,
      settings: {
        show_rabies_status: settings.show_rabies_status === true,
        show_microchip_last4: settings.show_microchip_last4 === true,
        show_service_animal: settings.show_service_animal === true,
        show_emergency_contact: settings.show_emergency_contact === true,
      },
      providers: publicWalletConfig(),
    });
  } catch (error) {
    return walletErrorResponse(res, error);
  }
}
