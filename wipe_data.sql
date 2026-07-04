-- ⚠️ DANGER: This will delete ALL data from your database ⚠️

-- 1. Delete all submissions (optional, as cascade would handle it, but good for clarity)
TRUNCATE TABLE submissions CASCADE;

-- 2. Delete all bounties
TRUNCATE TABLE bounties CASCADE;

-- 3. Delete users (from the users table introduced in supabase_migration_user_id.sql)
TRUNCATE TABLE users CASCADE;

-- 4. Delete all storage objects (if you have uploaded files)
DELETE FROM storage.objects WHERE bucket_id = 'media';
