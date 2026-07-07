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
  'newsletter_subscribers','profiles','rate_limit_log','saved_vets',
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
