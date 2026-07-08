-- Safe rerun fix: make policies idempotent when SQL is run on an existing database.

DROP POLICY IF EXISTS "Merchants upload own KYC" ON storage.objects;
CREATE POLICY "Merchants upload own KYC"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'kyc' AND (storage.foldername(name))[1] = auth.uid()::text);

DROP POLICY IF EXISTS "Merchants read own KYC" ON storage.objects;
CREATE POLICY "Merchants read own KYC"
  ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'kyc' AND (
      (storage.foldername(name))[1] = auth.uid()::text
      OR public.has_role(auth.uid(), 'super_admin')
    )
  );

DROP POLICY IF EXISTS "Merchants delete own KYC" ON storage.objects;
CREATE POLICY "Merchants delete own KYC"
  ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'kyc' AND (storage.foldername(name))[1] = auth.uid()::text);

DROP POLICY IF EXISTS "Merchant reads own api logs" ON public.api_request_logs;
CREATE POLICY "Merchant reads own api logs"
  ON public.api_request_logs FOR SELECT TO authenticated
  USING (public.merchant_can(auth.uid(), merchant_id, 'viewer'));

DROP POLICY IF EXISTS "Super admin reads all api logs" ON public.api_request_logs;
CREATE POLICY "Super admin reads all api logs"
  ON public.api_request_logs FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'super_admin'));

DROP POLICY IF EXISTS "Merchant team can view schedules" ON public.recurring_schedules;
CREATE POLICY "Merchant team can view schedules"
  ON public.recurring_schedules FOR SELECT TO authenticated
  USING (public.merchant_can(auth.uid(), merchant_id, 'viewer'));

DROP POLICY IF EXISTS "Merchant operators can insert schedules" ON public.recurring_schedules;
CREATE POLICY "Merchant operators can insert schedules"
  ON public.recurring_schedules FOR INSERT TO authenticated
  WITH CHECK (public.merchant_can(auth.uid(), merchant_id, 'operator'));

DROP POLICY IF EXISTS "Merchant operators can update schedules" ON public.recurring_schedules;
CREATE POLICY "Merchant operators can update schedules"
  ON public.recurring_schedules FOR UPDATE TO authenticated
  USING (public.merchant_can(auth.uid(), merchant_id, 'operator'))
  WITH CHECK (public.merchant_can(auth.uid(), merchant_id, 'operator'));

DROP POLICY IF EXISTS "Merchant admins can delete schedules" ON public.recurring_schedules;
CREATE POLICY "Merchant admins can delete schedules"
  ON public.recurring_schedules FOR DELETE TO authenticated
  USING (public.merchant_can(auth.uid(), merchant_id, 'admin'));