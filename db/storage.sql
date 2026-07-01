-- =============================================================
-- PayNOC — Storage buckets (self-hosted Supabase)
-- Run this on your self-hosted Supabase after install.sql.
-- If you don't use Supabase Storage, skip this file and wire your own
-- object store (S3/MinIO) in the app.
-- =============================================================

INSERT INTO storage.buckets (id, name, public)
VALUES ('kyc', 'kyc', false)
ON CONFLICT (id) DO NOTHING;

INSERT INTO storage.buckets (id, name, public)
VALUES ('disputes', 'disputes', false)
ON CONFLICT (id) DO NOTHING;

-- Merchant can read/write own folder (path prefix = auth.uid())
DO $$ BEGIN
  CREATE POLICY "kyc owner rw" ON storage.objects
    FOR ALL TO authenticated
    USING (bucket_id = 'kyc' AND (auth.uid()::text = (storage.foldername(name))[1]))
    WITH CHECK (bucket_id = 'kyc' AND (auth.uid()::text = (storage.foldername(name))[1]));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "disputes owner rw" ON storage.objects
    FOR ALL TO authenticated
    USING (bucket_id = 'disputes' AND (auth.uid()::text = (storage.foldername(name))[1]))
    WITH CHECK (bucket_id = 'disputes' AND (auth.uid()::text = (storage.foldername(name))[1]));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
