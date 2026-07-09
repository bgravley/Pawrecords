-- ============================================================================
-- db_audit.sql — YourPetPass DATABASE audit
-- ============================================================================
-- The main audit (scripts/audit.py) checks the CODE. It cannot see the database,
-- so it was blind to the worst bugs of the June 2026 session — all of which were
-- schema/database problems the code couldn't reveal:
--
--   * trips table missing 'transportation_type' column  -> trip creation broke
--   * profiles trigger missing 'travel_credits_balance'  -> ALL signups broke
--   * handle_new_user trigger crashing                   -> silent total failure
--
-- This script is run by whoever has the Supabase connection during a review
-- (via the Supabase MCP tools). It surfaces database-level problems the code
-- audit structurally cannot catch. Run each section and compare against the
-- expectations noted in comments.
--
-- HOW TO RUN: execute each query below against the Pawrecords project
-- (project_id: pqqfwgwbwofzfpzzuilq) and review the output against the notes.
-- ============================================================================


-- ── CHECK D1: handle_new_user trigger EXISTS, is attached, and is enabled ───
-- The single most important check. If this trigger is missing, broken, or
-- disabled, EVERY new signup fails silently ("Database error saving new user").
-- Expect: exactly one row, tgenabled = 'O' (enabled), on auth.users.
SELECT
  t.tgname               AS trigger_name,
  t.tgenabled            AS enabled_flag,   -- 'O' = enabled (good), 'D' = disabled (BAD)
  t.tgrelid::regclass    AS attached_to
FROM pg_trigger t
WHERE t.tgname = 'on_auth_user_created';


-- ── CHECK D2: trigger inserts every NON-defaulted profiles column ───────────
-- If profiles has a NOT NULL column with no default that the trigger doesn't
-- populate, every signup will crash. This lists profiles columns that are
-- NOT NULL and have NO default — the trigger MUST supply each of these.
-- Expect: only 'id' (which the trigger always supplies from NEW.id).
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name = 'profiles'
  AND is_nullable = 'NO'
  AND column_default IS NULL
ORDER BY column_name;


-- ── CHECK D3: full handle_new_user definition (eyeball the safety net) ───────
-- Confirm it still ends with the EXCEPTION WHEN OTHERS THEN ... RETURN NEW
-- safety net so a future column mismatch logs instead of breaking signups.
SELECT pg_get_functiondef(oid)
FROM pg_proc
WHERE proname = 'handle_new_user';


-- ── CHECK D4: every table the app writes to actually exists ─────────────────
-- Expect ALL of these to appear. A missing one means a whole feature is broken.
SELECT unnest(ARRAY[
  'activity_log','affiliate_commissions','affiliates','ai_usage_log','allergies',
  'bug_reports','documents','dogs','emergency_contacts','error_log','medications',
  'newsletter_subscribers','prewarm_routes','profiles','rate_limit_log','saved_vets',
  'travel_route_cache','trip_checklist_items','trip_documents','trips',
  'vaccinations','vet_visits','weights'
]) AS expected_table
EXCEPT
SELECT table_name FROM information_schema.tables WHERE table_schema = 'public';
-- Expect: ZERO rows. Any row printed = a table the code needs is MISSING.


-- ── CHECK D5: columns the code writes that must exist (the transportation_type
--             class of bug). If any of these return missing, that feature is
--             broken RIGHT NOW. Expect: zero rows in each EXCEPT result.
-- trips:
SELECT unnest(ARRAY[
  'user_id','name','origin_city','origin_country','destination_city',
  'destination_country','departure_date','return_date','airline','status',
  'pet_ids','notes','flight_number','transportation_type'
]) AS needed_column
EXCEPT SELECT column_name FROM information_schema.columns WHERE table_name = 'trips';

-- dogs:
SELECT unnest(ARRAY[
  'name','species','breed','dob','weight','gender','neutered','microchip',
  'color','emergency_contact','emergency_phone','notes','photo_url','pet_type',
  'certification_doc_path','emergency_token'
]) AS needed_column
EXCEPT SELECT column_name FROM information_schema.columns WHERE table_name = 'dogs';

-- profiles (the columns the code and trigger write):
SELECT unnest(ARRAY[
  'id','email','full_name','avatar_url','subscription_tier','travel_credits_balance',
  'email_notifications','is_admin','phone_country_code','whatsapp_country_code',
  'referral_code_used','photo_url','phone','whatsapp','address','city','state',
  'country','zip','instagram','facebook','twitter','stripe_customer_id',
  'ai_scan_limit_override','ai_travel_limit_override'
]) AS needed_column
EXCEPT SELECT column_name FROM information_schema.columns WHERE table_name = 'profiles';


-- ── CHECK D6: RLS is enabled on every public table (data-privacy guard) ──────
-- Any user-data table WITHOUT row-level security is a potential data leak.
-- Expect: zero rows. Any table listed has RLS turned OFF — review it.
SELECT tablename
FROM pg_tables
WHERE schemaname = 'public'
  AND tablename NOT IN ('travel_route_cache')  -- shared cache, intentionally public-read
  AND tablename NOT IN (
    SELECT c.relname FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public' AND c.relrowsecurity = true
  );


-- ── CHECK D7: the documents storage bucket is public (pet photos load) ───────
-- Expect: public = true. If false, every pet photo / document breaks.
SELECT id, public FROM storage.buckets WHERE id = 'documents';


-- ── CHECK D8: orphaned photo_urls (points at a file that doesn't exist) ──────
-- Rows here have a photo_url saved but no matching file in storage — the pet
-- will show a broken image. Expect: zero rows (or investigate any listed).
SELECT d.id, d.name, d.photo_url
FROM dogs d
WHERE d.photo_url IS NOT NULL
  AND d.photo_url LIKE '%/storage/v1/object/public/documents/%'
  AND NOT EXISTS (
    SELECT 1 FROM storage.objects o
    WHERE o.bucket_id = 'documents'
      AND d.photo_url LIKE '%' || o.name
  );


-- ── CHECK D9: oversized photos in the documents bucket ───────────────────────
-- Added July 2026 after finding 1.3-3MB avatar photos in live storage — the
-- upload path had no client-side compression (fixed in src/lib/imageResize.js,
-- used by both photo upload handlers in PawRecord.jsx). New uploads should
-- land under ~150KB. Expect: zero rows going forward. Any row here uploaded
-- AFTER the imageResize.js fix shipped means a new upload path bypassed it.
SELECT name, (metadata->>'size')::bigint / 1024 AS size_kb, created_at
FROM storage.objects
WHERE bucket_id = 'documents'
  AND (metadata->>'size')::bigint > 500 * 1024
ORDER BY size_kb DESC;


-- ── CHECK D11: auth users with no matching profile row ───────────────────────
-- Added July 2026 after finding 2 real users stuck exactly like this — the
-- account exists in auth (so "sign in instead" is correct) but they have no
-- profile, so the app is unusable for them and they have no way out.
--
-- ROOT CAUSE (fixed July 2026): notify_new_signup/notify_new_error called
-- net.http_post with body cast to ::text, but net.http_post's real signature
-- takes body as JSONB. That raised "function net.http_post(...) does not
-- exist". Because notify_new_signup fires as a trigger ON THE PROFILES INSERT
-- ITSELF (nested inside handle_new_user's own INSERT statement), the
-- unhandled exception rolled back the whole profiles insert via PL/pgSQL's
-- implicit savepoint — even though handle_new_user's own EXCEPTION WHEN
-- OTHERS then quietly swallowed it and let the outer auth.users insert
-- commit. Net effect: auth account created, profile silently never created,
-- 100% reproducible on every signup, zero trace in error_log (error_log
-- inserts hit the identical bug via notify_new_error/on_new_error).
--
-- Expect: zero rows. If this ever returns anything, something is once again
-- interrupting the profiles insert after auth signup succeeds — check
-- Postgres logs (get_logs, service=postgres) for "RAISE LOG" lines from
-- handle_new_user's exception handler, which will show the real underlying
-- error even when it's actually a nested trigger's failure.
--
-- UPDATE July 2026: handle_new_user's exception handler now ALSO writes a
-- row to error_log (context = 'signup_profile_creation') whenever it catches
-- a failure, so this shows up in the admin panel's error log without a
-- manual SQL query. Check there first if this is ever non-empty — it should
-- already tell you which signup failed and why. (user_id is left NULL on
-- these rows since error_log.user_id has a FK to profiles(id), and by
-- definition there's no profile yet when this fires — user_email is used
-- instead, which the admin UI already prefers for display.)
SELECT u.id, u.email, u.created_at, u.raw_app_meta_data->>'provider' AS auth_provider
FROM auth.users u
LEFT JOIN profiles p ON p.id = u.id
WHERE p.id IS NULL AND u.deleted_at IS NULL
ORDER BY u.created_at;


-- ── CHECK D10: SECURITY DEFINER functions without a fixed search_path ────────
-- A SECURITY DEFINER function with a mutable search_path can be hijacked by
-- creating a same-named object earlier in the caller's search_path. Every
-- SECURITY DEFINER function should set search_path explicitly. Expect: zero
-- rows (fixed July 2026 for handle_new_user/notify_new_signup/notify_new_error
-- — if a new SECURITY DEFINER function shows up here, give it a search_path).
SELECT p.proname, p.prosecdef AS is_security_definer, p.proconfig
FROM pg_proc p
JOIN pg_namespace n ON p.pronamespace = n.oid
WHERE n.nspname = 'public'
  AND p.prosecdef = true
  AND (p.proconfig IS NULL OR NOT EXISTS (
    SELECT 1 FROM unnest(p.proconfig) c WHERE c LIKE 'search_path=%'
  ));


-- ── CHECK D12: emergency QR health card can actually see health data ─────────
-- dogs has always had a public "emergency_token IS NOT NULL" read policy,
-- but until July 2026, vaccinations/medications/allergies/vet_visits/
-- weights/documents did not -- meaning the QR Health Card found the pet but
-- silently showed zero vaccines, visits, meds, allergies, weight, or
-- documents to any genuinely anonymous scanner (a vet, a border agent).
-- Only testing while still logged in as the owner would have hidden this,
-- since auth.uid() = user_id would then also match.
-- Expect: all 6 tables present. A missing one means the emergency page is
-- silently blind to that data type again.
SELECT unnest(ARRAY['vaccinations','medications','allergies','vet_visits','weights','documents']) AS expected_table
EXCEPT
SELECT tablename FROM pg_policies
WHERE schemaname = 'public' AND policyname = 'Public can view via dog emergency token';
