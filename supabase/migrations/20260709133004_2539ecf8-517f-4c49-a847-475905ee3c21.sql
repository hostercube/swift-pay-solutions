
DROP POLICY IF EXISTS "payment_assets_public_read" ON storage.objects;
CREATE POLICY "payment_assets_public_read"
ON storage.objects FOR SELECT
TO anon, authenticated
USING (bucket_id = 'payment-assets');
