CREATE POLICY payment_assets_logos_public_read
ON storage.objects FOR SELECT TO anon, authenticated
USING (
  bucket_id = 'payment-assets'
  AND (storage.foldername(name))[1] = 'logos'
);

CREATE POLICY payment_assets_logos_owner_write
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'payment-assets'
  AND (storage.foldername(name))[1] = 'logos'
  AND (storage.foldername(name))[2] = auth.uid()::text
);

CREATE POLICY payment_assets_logos_owner_update
ON storage.objects FOR UPDATE TO authenticated
USING (
  bucket_id = 'payment-assets'
  AND (storage.foldername(name))[1] = 'logos'
  AND (storage.foldername(name))[2] = auth.uid()::text
);

CREATE POLICY payment_assets_logos_owner_delete
ON storage.objects FOR DELETE TO authenticated
USING (
  bucket_id = 'payment-assets'
  AND (storage.foldername(name))[1] = 'logos'
  AND (storage.foldername(name))[2] = auth.uid()::text
);