DROP POLICY IF EXISTS "Merchants update own refunds" ON public.refunds;
CREATE POLICY "Merchants update own refunds" ON public.refunds FOR UPDATE TO authenticated
  USING (merchant_id = auth.uid())
  WITH CHECK (merchant_id = auth.uid());