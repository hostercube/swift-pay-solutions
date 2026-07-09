
DROP POLICY IF EXISTS "payment_assets_anon_slip_upload" ON storage.objects;
CREATE POLICY "payment_assets_anon_slip_upload"
ON storage.objects FOR INSERT
TO anon, authenticated
WITH CHECK (bucket_id = 'payment-assets' AND (storage.foldername(name))[1] = 'slips');

DROP POLICY IF EXISTS "payment_assets_merchant_qr_upload" ON storage.objects;
CREATE POLICY "payment_assets_merchant_qr_upload"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'payment-assets'
  AND (storage.foldername(name))[1] = 'qr'
  AND (storage.foldername(name))[2] = auth.uid()::text
);

DROP POLICY IF EXISTS "payment_assets_merchant_qr_update" ON storage.objects;
CREATE POLICY "payment_assets_merchant_qr_update"
ON storage.objects FOR UPDATE
TO authenticated
USING (
  bucket_id = 'payment-assets'
  AND (storage.foldername(name))[1] = 'qr'
  AND (storage.foldername(name))[2] = auth.uid()::text
);

DROP POLICY IF EXISTS "payment_assets_merchant_qr_delete" ON storage.objects;
CREATE POLICY "payment_assets_merchant_qr_delete"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'payment-assets'
  AND (storage.foldername(name))[1] = 'qr'
  AND (storage.foldername(name))[2] = auth.uid()::text
);

-- Merchants can read anything in their qr/<id>/ prefix and their invoice slips
DROP POLICY IF EXISTS "payment_assets_merchant_read" ON storage.objects;
CREATE POLICY "payment_assets_merchant_read"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'payment-assets'
  AND (
    ((storage.foldername(name))[1] = 'qr'    AND (storage.foldername(name))[2] = auth.uid()::text)
    OR (storage.foldername(name))[1] = 'slips'
  )
);
