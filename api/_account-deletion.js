import { createClient } from '@supabase/supabase-js';

export const ACCOUNT_UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function listStorageFilesRecursive(bucket, rootPath) {
  const files = [];
  const pending = [rootPath];
  const seenFolders = new Set();

  while (pending.length) {
    const folder = pending.pop();
    if (!folder || seenFolders.has(folder)) continue;
    seenFolders.add(folder);
    if (seenFolders.size > 5000) throw new Error('Storage cleanup exceeded safe folder limit');

    let offset = 0;
    while (true) {
      const { data, error } = await bucket.list(folder, {
        limit: 1000,
        offset,
        sortBy: { column: 'name', order: 'asc' },
      });
      if (error) throw new Error(`Storage list failed for ${folder}: ${error.message}`);

      const entries = Array.isArray(data) ? data : [];
      for (const entry of entries) {
        const path = `${folder}/${entry.name}`;
        if (entry.id === null) pending.push(path);
        else files.push(path);
      }

      if (entries.length < 1000) break;
      offset += entries.length;
    }
  }

  return files;
}

export async function removeUserStorage(supabaseUrl, serviceKey, userId) {
  const storageAdmin = createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
  const bucket = storageAdmin.storage.from('documents');
  const paths = await listStorageFilesRecursive(bucket, userId);

  for (let i = 0; i < paths.length; i += 1000) {
    const batch = paths.slice(i, i + 1000);
    const { error } = await bucket.remove(batch);
    if (error) throw new Error(`Storage cleanup failed: ${error.message}`);
  }

  const remaining = await listStorageFilesRecursive(bucket, userId);
  if (remaining.length) throw new Error(`Storage cleanup incomplete: ${remaining.length} object(s) remain`);
  return paths.length;
}

export async function deleteAccountById({ supabaseUrl, serviceKey, targetUserId }) {
  if (!ACCOUNT_UUID_RE.test(targetUserId || '')) throw new Error('Invalid targetUserId');

  const headers = {
    apikey: serviceKey,
    Authorization: `Bearer ${serviceKey}`,
    'Content-Type': 'application/json',
  };

  const removedStorageObjects = await removeUserStorage(supabaseUrl, serviceKey, targetUserId);

  const affRes = await fetch(`${supabaseUrl}/rest/v1/affiliates?user_id=eq.${encodeURIComponent(targetUserId)}`, {
    method: 'PATCH',
    headers,
    body: JSON.stringify({ status: 'cancelled' }),
  });
  if (!affRes.ok) console.error('Affiliate deactivation failed (non-critical):', affRes.status);

  const profDelRes = await fetch(
    `${supabaseUrl}/rest/v1/profiles?id=eq.${encodeURIComponent(targetUserId)}`,
    { method: 'DELETE', headers },
  );
  if (!profDelRes.ok) {
    const errText = await profDelRes.text().catch(() => '');
    throw new Error(`Failed to delete profile row (${profDelRes.status}): ${errText}`);
  }

  const authDeleteRes = await fetch(
    `${supabaseUrl}/auth/v1/admin/users/${encodeURIComponent(targetUserId)}`,
    {
      method: 'DELETE',
      headers: { apikey: serviceKey, Authorization: `Bearer ${serviceKey}` },
    },
  );

  if (!authDeleteRes.ok && authDeleteRes.status !== 404) {
    const errText = await authDeleteRes.text().catch(() => '');
    return {
      partial: true,
      removedStorageObjects,
      warning: `Account data deleted, but auth login removal failed: ${errText}`,
    };
  }

  return { deleted: true, removedStorageObjects };
}
