
CREATE OR REPLACE FUNCTION public.effective_merchant_role(_user_id uuid, _merchant_id uuid)
RETURNS text LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT CASE
    WHEN _user_id = _merchant_id THEN 'owner'
    ELSE (SELECT role FROM public.team_members
           WHERE merchant_id = _merchant_id AND member_user_id = _user_id AND status = 'active' LIMIT 1)
  END;
$$;

CREATE OR REPLACE FUNCTION public.merchant_can(_user_id uuid, _merchant_id uuid, _min_role text)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  WITH r AS (SELECT public.effective_merchant_role(_user_id, _merchant_id) AS role)
  SELECT CASE (SELECT role FROM r)
    WHEN 'owner'    THEN true
    WHEN 'admin'    THEN _min_role IN ('viewer','operator','admin')
    WHEN 'operator' THEN _min_role IN ('viewer','operator')
    WHEN 'viewer'   THEN _min_role = 'viewer'
    ELSE false
  END;
$$;

CREATE POLICY "team can view invoices"          ON public.invoices          FOR SELECT TO authenticated
  USING (public.merchant_can(auth.uid(), merchant_id, 'viewer'));
CREATE POLICY "team can view transactions"      ON public.transactions      FOR SELECT TO authenticated
  USING (public.merchant_can(auth.uid(), merchant_id, 'viewer'));
CREATE POLICY "team can view payment_methods"   ON public.payment_methods   FOR SELECT TO authenticated
  USING (public.merchant_can(auth.uid(), merchant_id, 'viewer'));
CREATE POLICY "team can view payouts"           ON public.payouts           FOR SELECT TO authenticated
  USING (public.merchant_can(auth.uid(), merchant_id, 'viewer'));
CREATE POLICY "team can view webhook_endpoints" ON public.webhook_endpoints FOR SELECT TO authenticated
  USING (public.merchant_can(auth.uid(), merchant_id, 'viewer'));
CREATE POLICY "team can view api_keys"          ON public.api_keys          FOR SELECT TO authenticated
  USING (public.merchant_can(auth.uid(), merchant_id, 'admin'));

CREATE POLICY "operators update transactions" ON public.transactions FOR UPDATE TO authenticated
  USING (public.merchant_can(auth.uid(), merchant_id, 'operator'))
  WITH CHECK (public.merchant_can(auth.uid(), merchant_id, 'operator'));
CREATE POLICY "operators update invoices"     ON public.invoices     FOR UPDATE TO authenticated
  USING (public.merchant_can(auth.uid(), merchant_id, 'operator'))
  WITH CHECK (public.merchant_can(auth.uid(), merchant_id, 'operator'));
CREATE POLICY "operators insert invoices"     ON public.invoices     FOR INSERT TO authenticated
  WITH CHECK (public.merchant_can(auth.uid(), merchant_id, 'operator'));

CREATE POLICY "admins manage methods"    ON public.payment_methods   FOR ALL TO authenticated
  USING (public.merchant_can(auth.uid(), merchant_id, 'admin'))
  WITH CHECK (public.merchant_can(auth.uid(), merchant_id, 'admin'));
CREATE POLICY "admins manage webhooks"   ON public.webhook_endpoints FOR ALL TO authenticated
  USING (public.merchant_can(auth.uid(), merchant_id, 'admin'))
  WITH CHECK (public.merchant_can(auth.uid(), merchant_id, 'admin'));
CREATE POLICY "admins manage api_keys"   ON public.api_keys          FOR ALL TO authenticated
  USING (public.merchant_can(auth.uid(), merchant_id, 'admin'))
  WITH CHECK (public.merchant_can(auth.uid(), merchant_id, 'admin'));
