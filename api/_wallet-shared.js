import crypto from 'node:crypto';

const COOKIE_NAME = 'ypp_file_session';
const PET_ID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export class WalletHttpError extends Error {
  constructor(status, message, code = null) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

function requireServerConfig() {
  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_KEY) {
    throw new WalletHttpError(503, 'Wallet service unavailable', 'wallet_server_unconfigured');
  }
}

function readCookie(req, name) {
  const raw = req.headers.cookie || '';
  for (const part of raw.split(';')) {
    const [key, ...rest] = part.trim().split('=');
    if (key === name) return decodeURIComponent(rest.join('='));
  }
  return null;
}

function requestToken(req) {
  const auth = req.headers.authorization || '';
  if (auth.startsWith('Bearer ')) return auth.slice(7);
  return readCookie(req, COOKIE_NAME);
}

export function validPetId(value) {
  return typeof value === 'string' && PET_ID_RE.test(value);
}

async function serviceRequest(path, options = {}) {
  requireServerConfig();
  const headers = {
    apikey: process.env.SUPABASE_SERVICE_KEY,
    Authorization: `Bearer ${process.env.SUPABASE_SERVICE_KEY}`,
    ...(options.body ? { 'Content-Type': 'application/json' } : {}),
    ...(options.headers || {}),
  };

  const response = await fetch(`${process.env.SUPABASE_URL}/rest/v1/${path}`, {
    ...options,
    headers,
  });

  if (!response.ok) {
    const detail = await response.text().catch(() => '');
    console.error('Wallet Supabase request failed:', response.status, path, detail.slice(0, 300));
    throw new WalletHttpError(502, 'Wallet data service unavailable', 'wallet_data_error');
  }

  if (response.status === 204) return null;
  const text = await response.text();
  return text ? JSON.parse(text) : null;
}

export async function authenticatedUser(req) {
  requireServerConfig();
  const token = requestToken(req);
  if (!token) throw new WalletHttpError(401, 'Unauthorized', 'unauthorized');

  const response = await fetch(`${process.env.SUPABASE_URL}/auth/v1/user`, {
    headers: {
      apikey: process.env.SUPABASE_SERVICE_KEY,
      Authorization: `Bearer ${token}`,
    },
  });

  if (!response.ok) throw new WalletHttpError(401, 'Unauthorized', 'unauthorized');
  const user = await response.json();
  if (!user?.id) throw new WalletHttpError(401, 'Unauthorized', 'unauthorized');
  return user;
}

export async function ownedPet(req, petId) {
  if (!validPetId(petId)) throw new WalletHttpError(400, 'Valid petId required', 'invalid_pet_id');
  const user = await authenticatedUser(req);
  const rows = await serviceRequest(
    `dogs?id=eq.${encodeURIComponent(petId)}` +
    `&user_id=eq.${encodeURIComponent(user.id)}` +
    '&select=id,user_id,name,species,breed,microchip,pet_type,emergency_contact,emergency_phone,emergency_phone_code,photo_url,emergency_token&limit=1'
  );
  const pet = rows?.[0];
  if (!pet?.id) throw new WalletHttpError(404, 'Pet not found', 'pet_not_found');
  return { user, pet };
}

export async function ensureEmergencyToken(pet) {
  if (pet.emergency_token && /^[a-f0-9]{32}$/i.test(pet.emergency_token)) return pet;

  const emergencyToken = crypto.randomUUID().replace(/-/g, '');
  const rows = await serviceRequest(`dogs?id=eq.${encodeURIComponent(pet.id)}`, {
    method: 'PATCH',
    headers: { Prefer: 'return=representation' },
    body: JSON.stringify({ emergency_token: emergencyToken }),
  });

  return { ...pet, ...(rows?.[0] || {}), emergency_token: emergencyToken };
}

const DEFAULT_SETTINGS = Object.freeze({
  show_rabies_status: false,
  show_microchip_last4: false,
  show_service_animal: false,
  show_emergency_contact: false,
});

export async function getWalletSettings(userId, dogId) {
  const rows = await serviceRequest(
    `wallet_settings?dog_id=eq.${encodeURIComponent(dogId)}` +
    `&user_id=eq.${encodeURIComponent(userId)}` +
    '&select=dog_id,user_id,show_rabies_status,show_microchip_last4,show_service_animal,show_emergency_contact&limit=1'
  );
  if (rows?.[0]) return rows[0];

  const inserted = await serviceRequest('wallet_settings', {
    method: 'POST',
    headers: { Prefer: 'return=representation' },
    body: JSON.stringify({ user_id: userId, dog_id: dogId, ...DEFAULT_SETTINGS }),
  });
  return inserted?.[0] || { user_id: userId, dog_id: dogId, ...DEFAULT_SETTINGS };
}

export async function saveWalletSettings(userId, dogId, input = {}) {
  const normalized = {
    show_rabies_status: input.show_rabies_status === true,
    show_microchip_last4: input.show_microchip_last4 === true,
    show_service_animal: input.show_service_animal === true,
    show_emergency_contact: input.show_emergency_contact === true,
    updated_at: new Date().toISOString(),
  };

  const current = await serviceRequest(
    `wallet_settings?dog_id=eq.${encodeURIComponent(dogId)}` +
    `&user_id=eq.${encodeURIComponent(userId)}&select=dog_id&limit=1`
  );

  if (current?.[0]) {
    const rows = await serviceRequest(
      `wallet_settings?dog_id=eq.${encodeURIComponent(dogId)}&user_id=eq.${encodeURIComponent(userId)}`,
      {
        method: 'PATCH',
        headers: { Prefer: 'return=representation' },
        body: JSON.stringify(normalized),
      }
    );
    return rows?.[0] || { user_id: userId, dog_id: dogId, ...normalized };
  }

  const rows = await serviceRequest('wallet_settings', {
    method: 'POST',
    headers: { Prefer: 'return=representation' },
    body: JSON.stringify({ user_id: userId, dog_id: dogId, ...DEFAULT_SETTINGS, ...normalized }),
  });
  return rows?.[0] || { user_id: userId, dog_id: dogId, ...normalized };
}

export async function getOrCreateWalletPass(userId, dogId, platform) {
  if (!['apple', 'google'].includes(platform)) {
    throw new WalletHttpError(400, 'Unsupported Wallet platform', 'unsupported_platform');
  }

  const query = `wallet_passes?dog_id=eq.${encodeURIComponent(dogId)}` +
    `&user_id=eq.${encodeURIComponent(userId)}&platform=eq.${platform}` +
    '&select=id,user_id,dog_id,platform,serial_number,provider_object_id,status&limit=1';
  let rows = await serviceRequest(query);
  if (rows?.[0]) return rows[0];

  try {
    rows = await serviceRequest('wallet_passes', {
      method: 'POST',
      headers: { Prefer: 'return=representation' },
      body: JSON.stringify({ user_id: userId, dog_id: dogId, platform }),
    });
    if (rows?.[0]) return rows[0];
  } catch (error) {
    // A simultaneous request can win the unique(dog_id, platform) race.
    // Refetch once before surfacing a failure.
    if (!(error instanceof WalletHttpError)) throw error;
  }

  rows = await serviceRequest(query);
  if (!rows?.[0]) throw new WalletHttpError(502, 'Could not create Wallet pass', 'wallet_pass_create_failed');
  return rows[0];
}

export async function setProviderObjectId(passId, providerObjectId) {
  const rows = await serviceRequest(`wallet_passes?id=eq.${encodeURIComponent(passId)}`, {
    method: 'PATCH',
    headers: { Prefer: 'return=representation' },
    body: JSON.stringify({ provider_object_id: providerObjectId, updated_at: new Date().toISOString() }),
  });
  return rows?.[0] || null;
}

export async function rabiesStatus(dogId) {
  const rows = await serviceRequest(
    `vaccinations?dog_id=eq.${encodeURIComponent(dogId)}` +
    '&name=ilike.*rabies*&select=name,date_given,next_due&order=date_given.desc&limit=1'
  );
  const rabies = rows?.[0];
  if (!rabies?.next_due) return 'Review needed';
  const today = new Date().toISOString().slice(0, 10);
  return rabies.next_due >= today ? 'Current' : 'Review needed';
}

export function emergencyUrl(token) {
  return `https://yourpetpass.com/emergency/${token}`;
}

export function appleWalletConfigured() {
  return Boolean(
    process.env.APPLE_WALLET_PASS_TYPE_ID &&
    process.env.APPLE_WALLET_TEAM_ID &&
    process.env.APPLE_WALLET_SIGNER_CERT_B64 &&
    process.env.APPLE_WALLET_SIGNER_KEY_B64 &&
    process.env.APPLE_WALLET_WWDR_CERT_B64
  );
}

export function googleWalletConfigured() {
  return Boolean(
    process.env.GOOGLE_WALLET_ISSUER_ID &&
    process.env.GOOGLE_WALLET_CLASS_ID &&
    process.env.GOOGLE_WALLET_SERVICE_ACCOUNT_EMAIL &&
    (process.env.GOOGLE_WALLET_PRIVATE_KEY_B64 || process.env.GOOGLE_WALLET_PRIVATE_KEY)
  );
}

export function googleWalletApprovedForPrivatePass() {
  return process.env.GOOGLE_WALLET_PRIVATE_PASS_APPROVED === 'true';
}

export function walletFeatureEnabled() {
  if (process.env.WALLET_FEATURE_ENABLED === 'false') return false;
  return appleWalletConfigured() || (googleWalletConfigured() && googleWalletApprovedForPrivatePass());
}

export function publicWalletConfig() {
  const appleReady = appleWalletConfigured();
  const googleCredentials = googleWalletConfigured();
  const googlePrivateApproved = googleWalletApprovedForPrivatePass();
  return {
    enabled: walletFeatureEnabled(),
    apple: {
      available: appleReady,
    },
    google: {
      available: googleCredentials && googlePrivateApproved,
      credentialsConfigured: googleCredentials,
      privatePassApproved: googlePrivateApproved,
    },
  };
}

export function microchipLast4(value) {
  if (!value) return null;
  const cleaned = String(value).replace(/\s+/g, '');
  if (!cleaned) return null;
  return cleaned.slice(-4);
}

export function serviceAnimalLabel(pet) {
  return pet.pet_type === 'service_animal' ? 'Service Animal' : null;
}

export function emergencyContactLabel(pet) {
  const name = pet.emergency_contact?.trim();
  const phone = pet.emergency_phone?.trim();
  if (!name && !phone) return null;
  const fullPhone = phone ? `${pet.emergency_phone_code || ''} ${phone}`.trim() : null;
  return [name, fullPhone].filter(Boolean).join(' · ');
}

export function decodeBase64Env(name) {
  const value = process.env[name];
  if (!value) return null;
  return Buffer.from(value, 'base64');
}

export function googlePrivateKey() {
  if (process.env.GOOGLE_WALLET_PRIVATE_KEY_B64) {
    return Buffer.from(process.env.GOOGLE_WALLET_PRIVATE_KEY_B64, 'base64').toString('utf8');
  }
  return (process.env.GOOGLE_WALLET_PRIVATE_KEY || '').replace(/\\n/g, '\n');
}

export function signGoogleWalletJwt(claims) {
  const header = { alg: 'RS256', typ: 'JWT' };
  const encode = (value) => Buffer.from(JSON.stringify(value)).toString('base64url');
  const unsigned = `${encode(header)}.${encode(claims)}`;
  const signature = crypto.sign('RSA-SHA256', Buffer.from(unsigned), googlePrivateKey()).toString('base64url');
  return `${unsigned}.${signature}`;
}

export function walletErrorResponse(res, error) {
  const status = error instanceof WalletHttpError ? error.status : 500;
  const message = error instanceof WalletHttpError ? error.message : 'Wallet request failed';
  const body = { error: message };
  if (error instanceof WalletHttpError && error.code) body.code = error.code;
  if (!(error instanceof WalletHttpError)) console.error('Wallet request failed:', error);
  return res.status(status).json(body);
}
