import { createClient } from '@supabase/supabase-js';
import {
  GitHubOidcError,
  readGitHubOidcBearer,
  verifyGitHubActionsOidc,
} from './_github-actions-oidc.js';
import { deleteAccountById, listStorageFilesRecursive } from './_account-deletion.js';
import { E2E_TEST_ACCOUNTS } from './_e2eAccounts.js';

function noStore(res) {
  res.setHeader('Cache-Control', 'private, no-store, max-age=0');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('X-Content-Type-Options', 'nosniff');
}

function adminClient() {
  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_KEY) {
    const error = new Error('E2E deletion service unavailable');
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

async function verifyUser(req) {
  return verifyGitHubActionsOidc(readGitHubOidcBearer(req));
}

async function countOwnedRows(supabase, table, userId) {
  const { count, error } = await supabase
    .from(table)
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId);
  if (error) throw new Error(`Could not verify ${table} deletion: ${error.message}`);
  return count || 0;
}

async function verifyDeleted(supabase, userId) {
  const ownedTables = [
    'dogs',
    'documents',
    'vaccinations',
    'medications',
    'allergies',
    'vet_visits',
    'emergency_contacts',
    'saved_vets',
    'weights',
    'trips',
    'trip_legs',
    'trip_documents',
    'trip_checklist_items',
    'wallet_settings',
    'wallet_passes',
  ];

  const retainedOperationalTables = [
    'activity_log',
    'error_log',
    'ai_usage_log',
    'bug_reports',
  ];

  const remainingRows = {};
  for (const table of [...ownedTables, ...retainedOperationalTables]) {
    const count = await countOwnedRows(supabase, table, userId);
    if (count) remainingRows[table] = count;
  }

  const { count: affiliateCount, error: affiliateError } = await supabase
    .from('affiliates')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId);
  if (affiliateError) throw new Error(`Could not verify affiliate deletion state: ${affiliateError.message}`);
  if (affiliateCount) remainingRows.affiliates = affiliateCount;

  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('id')
    .eq('id', userId)
    .maybeSingle();
  if (profileError) throw new Error(`Could not verify profile deletion: ${profileError.message}`);
  if (profile?.id) remainingRows.profiles = 1;

  const { data: authData, error: authError } = await supabase.auth.admin.getUserById(userId);
  if (authData?.user?.id) remainingRows.auth_user = 1;
  if (authError && !/not found|user not found/i.test(authError.message || '')) {
    const status = Number(authError.status || 0);
    if (status && status !== 404) throw new Error(`Could not verify Auth deletion: ${authError.message}`);
  }

  const storagePaths = await listStorageFilesRecursive(
    supabase.storage.from('documents'),
    userId,
  );
  if (storagePaths.length) remainingRows.storage_objects = storagePaths.length;

  return remainingRows;
}

export default async function handler(req, res) {
  noStore(res);
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const claims = await verifyUser(req);
    const role = req.body?.role;
    const account = E2E_TEST_ACCOUNTS[role];
    if (!account) return res.status(400).json({ error: 'role must be primary or secondary' });

    const supabase = adminClient();
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('id,email,is_admin')
      .eq('email', account.email)
      .maybeSingle();
    if (profileError) throw new Error(`Could not load synthetic profile: ${profileError.message}`);
    if (!profile?.id) return res.status(404).json({ error: 'Synthetic account not found' });
    if (profile.email !== account.email || profile.is_admin === true) {
      return res.status(403).json({ error: 'Synthetic account identity check failed' });
    }

    const { data: authData, error: authError } = await supabase.auth.admin.getUserById(profile.id);
    if (authError || !authData?.user) {
      return res.status(409).json({ error: 'Synthetic Auth account is not in a deletable state' });
    }
    if (
      authData.user.email !== account.email ||
      authData.user.user_metadata?.e2e_test !== true
    ) {
      return res.status(403).json({ error: 'Synthetic Auth marker check failed' });
    }

    const result = await deleteAccountById({
      supabaseUrl: process.env.SUPABASE_URL,
      serviceKey: process.env.SUPABASE_SERVICE_KEY,
      targetUserId: profile.id,
    });

    if (result.partial) {
      throw new Error('Synthetic account deletion was partial');
    }

    const remaining = await verifyDeleted(supabase, profile.id);
    if (Object.keys(remaining).length) {
      throw new Error(`Synthetic deletion verification failed: ${JSON.stringify(remaining)}`);
    }

    console.info('Authorized E2E account deletion verified', {
      role,
      runId: claims.run_id,
      runAttempt: claims.run_attempt,
      event: claims.event_name,
      removedStorageObjects: result.removedStorageObjects,
    });

    return res.status(200).json({
      deleted: true,
      role,
      removedStorageObjects: result.removedStorageObjects,
      verified: true,
    });
  } catch (error) {
    const status = error instanceof GitHubOidcError ? error.status : (error.status || 500);
    if (status >= 500) console.error('E2E account deletion error:', error.message);
    return res.status(status).json({
      error: status >= 500 ? 'E2E deletion service unavailable' : error.message,
    });
  }
}
