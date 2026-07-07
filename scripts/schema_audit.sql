-- scripts/schema_audit.sql
-- ============================================================================
-- LIVE SUPABASE DIAGNOSTIC QUERIES
-- ============================================================================
-- audit.py (which runs in GitHub Actions) has NO live database connection, so
-- it can only check code against the committed schema_snapshot.json. These
-- queries are the OTHER half: run them in any session that has a live Supabase
-- connection (via the Supabase MCP connector or the SQL editor) to catch the
-- things a static snapshot can't see.
--
-- WHEN TO RUN: after any schema change, before any launch, or whenever the
-- code-side drift check in audit.py flags something.
--
-- Each query is labeled with what a BAD result looks like.
-- ============================================================================


-- 1. REGENERATE THE SNAPSHOT ------------------------------------------------
-- Run this and paste the result into scripts/schema_snapshot.json (grouped by
-- table) whenever the schema changes. This is the source of truth audit.py
-- checks the code against.
SELECT table_name, column_name
FROM information_schema.columns
WHERE table_schema = 'public'
ORDER BY table_name, ordinal_position;


-- 2. handle_new_user TRIGGER HEALTH -----------------------------------------
-- BAD RESULT: the trigger INSERTs a column that no longer exists in profiles,
-- OR is missing the "EXCEPTION WHEN OTHERS" safety net. Either one means new
-- signups (Google + email) fail silently with "Database error saving new user".
-- This is the exact bug that broke all signups on 2026-06-29.
SELECT pg_get_functiondef(oid) AS trigger_def
FROM pg_proc WHERE proname = 'handle_new_user';
-- After viewing: confirm every column in its INSERT list still exists in the
-- profiles snapshot, and that the function body contains
-- "EXCEPTION WHEN OTHERS THEN ... RETURN NEW".


-- 3. OVERSIZED STORAGE OBJECTS ----------------------------------------------
-- BAD RESULT: any rows returned. Profile photos over ~500KB load slowly or
-- appear broken on mobile. Avatars should be compressed to well under 200KB
-- on upload. (On 2026-07-07 there were six 1.3-3MB pet photos causing exactly
-- this "photo won't load" symptom.)
SELECT name,
       round((metadata->>'size')::numeric / 1024) AS kb,
       metadata->>'mimetype' AS type
FROM storage.objects
WHERE (metadata->>'size')::numeric > 500000
ORDER BY (metadata->>'size')::numeric DESC;


-- 4. RLS ENABLED ON EVERY TABLE ---------------------------------------------
-- BAD RESULT: any table with rls_enabled = false. That means its rows are
-- readable/writable by anyone with the anon key — a data leak. Every table
-- holding user data MUST have RLS enabled.
SELECT c.relname AS table_name,
       c.relrowsecurity AS rls_enabled,
       (SELECT count(*) FROM pg_policies p
        WHERE p.tablename = c.relname AND p.schemaname = 'public') AS policy_count
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public' AND c.relkind = 'r'
ORDER BY c.relrowsecurity, c.relname;
-- NOTE: rls_enabled = true with policy_count = 0 is INTENTIONAL and safe for
-- backend-only tables (rate_limit_log, travel_route_cache,
-- newsletter_subscribers, bug_reports) — only the service key touches them.
-- It is a PROBLEM for any table the browser reads/writes directly.


-- 5. STORAGE BUCKET VISIBILITY ----------------------------------------------
-- The "documents" bucket must be public = true, because the app builds public
-- URLs (getPublicUrl) for pet photos. If it's private, every photo 404s.
SELECT id, name, public FROM storage.buckets;


-- 6. ORPHANED PHOTO URLS (optional deeper check) ----------------------------
-- BAD RESULT: a dog has a photo_url but no matching file exists in storage.
-- That shows as a broken image. (Rare, but happens if an upload half-failed.)
SELECT d.id, d.name, d.photo_url
FROM dogs d
WHERE d.photo_url IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM storage.objects o
    WHERE d.photo_url LIKE '%' || o.name
  );
