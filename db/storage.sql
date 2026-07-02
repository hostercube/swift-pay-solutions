-- =============================================================
-- PayNOC — Storage buckets (self-hosted Supabase)
-- Run this on your self-hosted Supabase after install.sql.
--
-- NOTE: storage.objects is owned by `supabase_storage_admin`, not `postgres`.
-- Policies must be created while SET ROLE supabase_storage_admin, otherwise
-- you get: ERROR: must be owner of table objects
-- =============================================================

-- Buckets (postgres role can insert)
INSERT INTO storage.buckets (id, name, public)
VALUES ('kyc', 'kyc', false)
ON CONFLICT (id) DO NOTHING;

INSERT INTO storage.buckets (id, name, public)
VALUES ('disputes', 'disputes', false)
ON CONFLICT (id) DO NOTHING;

-- Switch to the storage owner role to create policies
SET ROLE supabase_storage_admin;

DROP POLICY IF EXISTS "kyc owner rw" ON storage.objects;
CREATE POLICY "kyc owner rw" ON storage.objects
  FOR ALL TO authenticated
  USING (bucket_id = 'kyc' AND auth.uid()::text = (storage.foldername(name))[1])
  WITH CHECK (bucket_id = 'kyc' AND auth.uid()::text = (storage.foldername(name))[1]);

DROP POLICY IF EXISTS "disputes owner rw" ON storage.objects;
CREATE POLICY "disputes owner rw" ON storage.objects
  FOR ALL TO authenticated
  USING (bucket_id = 'disputes' AND auth.uid()::text = (storage.foldername(name))[1])
  WITH CHECK (bucket_id = 'disputes' AND auth.uid()::text = (storage.foldername(name))[1]);

RESET ROLE;
