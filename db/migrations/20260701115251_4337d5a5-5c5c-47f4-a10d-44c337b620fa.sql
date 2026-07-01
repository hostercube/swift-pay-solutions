
CREATE POLICY "Merchants upload own KYC"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'kyc' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "Merchants read own KYC"
  ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'kyc' AND (
      (storage.foldername(name))[1] = auth.uid()::text
      OR public.has_role(auth.uid(), 'super_admin')
    )
  );

CREATE POLICY "Merchants delete own KYC"
  ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'kyc' AND (storage.foldername(name))[1] = auth.uid()::text);
