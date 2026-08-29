import { createClient } from '@supabase/supabase-js';
import {
  GitHubOidcError,
  readGitHubOidcBearer,
  verifyGitHubActionsOidc,
} from './_github-actions-oidc.js';

const TEST_ACCOUNTS = Object.freeze({
  primary: {
    email: 'e2e-primary@yourpetpass.com',
    fullName: 'YourPetPass E2E Primary',
  },
  secondary: {
    email: 'e2e-secondary@yourpetpass.com',
    fullName: 'YourPetPass E2E Secondary',
  },
});

function noStore(res) {
  res.setHeader('Cache-Control', 'private, no-store, max-age=0');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('X-Content-Type-Options', 'nosniff');
}

function adminClient() {
  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_KEY) {
    const error = new Error('E2E service unavailable');
    error.status = 503;
    throw error;
  }

  return createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
      detectSessionInUrl: false,
    },
  });
}

async function resetTestData(supabase, userId) {
  const [{ data: docs }, { data: dogs }] = await Promise.all([
    supabase.from('documents').select('file_path').eq('user_id', userId),
    supabase.from('dogs').select('certification_doc_path').eq('user_id', userId),
  ]);

  const storagePaths = [
    ...(docs || []).map(row => row.file_path),
    ...(dogs || []).map(row => row.certification_doc_path),
  ].filter(path => typeof path === 'string' && path.startsWith(`${userId}/`));

  if (storagePaths.length) {
    const { error: storageError } = await supabase.storage.from('documents').remove([...new Set(storagePaths)]);
    if (storageError) console.error('E2E storage cleanup failed:', storageError.message);
  }

  // Trip children and pet health rows are ON DELETE CASCADE. Every delete is
  // additionally scoped by this exact E2E user's UUID so this endpoint can
  // never clean up another customer's records.
  for (const table of ['trips', 'dogs', 'emergency_contacts', 'saved_vets']) {
    const { error } = await supabase.from(table).delete().eq('user_id', userId);
    if (error) throw new Error(`E2E reset failed for ${table}`);
  }

  // The synthetic accounts are permanently non-admin. They are assigned the
  // normal Premium app tier only so production E2E can exercise paid customer
  // paths such as document storage and Emergency QR without touching Stripe.
  const { error: profileError } = await supabase.from('profiles').update({
    subscription_tier: 'premium',
    is_admin: false,
    travel_credits_balance: 0,
  }).eq('id', userId);
  if (profileError) throw new Error('E2E profile reset failed');
}

function actionLinkFrom(data) {
  return data?.properties?.action_link ||
    data?.properties?.actionLink ||
    data?.action_link ||
    data?.actionLink ||
    null;
}

export default async function handler(req, res) {
  noStore(res);
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const token = readGitHubOidcBearer(req);
    const claims = await verifyGitHubActionsOidc(token);

    const role = req.body?.role;
    const account = TEST_ACCOUNTS[role];
    if (!account) return res.status(400).json({ error: 'role must be primary or secondary' });

    const supabase = adminClient();
    const { data, error } = await supabase.auth.admin.generateLink({
      type: 'magiclink',
      email: account.email,
      options: {
        data: {
          full_name: account.fullName,
          e2e_test: true,
        },
        redirectTo: 'https://yourpetpass.com/',
      },
    });
    if (error) throw new Error(`Could not create E2E login link: ${error.message}`);

    const userId = data?.user?.id || data?.properties?.user?.id;
    const actionLink = actionLinkFrom(data);
    if (!userId || !actionLink) throw new Error('Supabase did not return a usable E2E login link');

    if (req.body?.reset === true) await resetTestData(supabase, userId);

    console.info('Authorized E2E login issued', {
      role,
      runId: claims.run_id,
      runAttempt: claims.run_attempt,
      event: claims.event_name,
    });

    return res.status(200).json({
      role,
      userId,
      actionLink,
      expiresSoon: true,
    });
  } catch (error) {
    const status = error instanceof GitHubOidcError ? error.status : (error.status || 500);
    if (status >= 500) console.error('E2E bootstrap error:', error.message);
    return res.status(status).json({ error: status >= 500 ? 'E2E service unavailable' : error.message });
  }
}
