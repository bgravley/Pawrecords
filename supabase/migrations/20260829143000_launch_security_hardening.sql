-- Launch security hardening for YourPetPass.
-- This migration is intended to be applied only after the matching app code
-- (private file gateway + token-scoped emergency API) is deployed.

-- 1) Private Storage: public bucket downloads bypass RLS, which is not
-- appropriate for medical/travel documents.
update storage.buckets
set public = false
where id = 'documents';

-- Remove permissive authenticated write policies. User-folder policies remain
-- in place and require the first path segment to match auth.uid().
drop policy if exists "Auth users upload documents" on storage.objects;
drop policy if exists "Auth users update documents" on storage.objects;

-- Existing profile/pet images were stored as permanent public Storage URLs.
-- Point those rows through the authenticated same-origin gateway instead.
-- Keep URLs root-relative so both yourpetpass.com and www.yourpetpass.com use
-- the file-session cookie belonging to the hostname the visitor is on.
update public.profiles
set photo_url = regexp_replace(
  photo_url,
  '^https://pqqfwgwbwofzfpzzuilq\.supabase\.co/storage/v1/object/public/documents/',
  '/api/storage-file?path='
)
where photo_url like 'https://pqqfwgwbwofzfpzzuilq.supabase.co/storage/v1/object/public/documents/%';

update public.dogs
set photo_url = regexp_replace(
  photo_url,
  '^https://pqqfwgwbwofzfpzzuilq\.supabase\.co/storage/v1/object/public/documents/',
  '/api/storage-file?path='
)
where photo_url like 'https://pqqfwgwbwofzfpzzuilq.supabase.co/storage/v1/object/public/documents/%';

-- 2) Emergency QR: anonymous users must not be able to enumerate emergency-
-- enabled pets or their underlying health tables directly. The public QR page
-- now uses /api/emergency-record and supplies the exact high-entropy token.
drop policy if exists "Public can view pets with emergency token" on public.dogs;
drop policy if exists "Public can view via dog emergency token" on public.vaccinations;
drop policy if exists "Public can view via dog emergency token" on public.medications;
drop policy if exists "Public can view via dog emergency token" on public.allergies;
drop policy if exists "Public can view via dog emergency token" on public.vet_visits;
drop policy if exists "Public can view via dog emergency token" on public.weights;
drop policy if exists "Public can view via dog emergency token" on public.documents;

-- 3) Trigger-only SECURITY DEFINER functions should not be callable as public
-- RPC endpoints. Revoking EXECUTE does not remove their database triggers.
revoke execute on function public.handle_new_user() from public, anon, authenticated;
revoke execute on function public.notify_new_signup() from public, anon, authenticated;
revoke execute on function public.notify_new_error() from public, anon, authenticated;
