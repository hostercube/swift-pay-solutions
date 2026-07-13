
-- Security hardening pass

-- 1. Remove broad anon UPDATE on invoices. State transitions must go through
--    SECURITY DEFINER RPCs / server functions (checkout-submit uses admin).
DROP POLICY IF EXISTS "Public start payment" ON public.invoices;

-- 2. Tighten team member self-read: only active memberships.
DROP POLICY IF EXISTS "team read own memberships" ON public.team_members;
CREATE POLICY "team read own memberships" ON public.team_members
  FOR SELECT TO authenticated
  USING (member_user_id = auth.uid() AND status = 'active');

-- 3. Scope digest_settings policy to authenticated role (defense in depth).
DROP POLICY IF EXISTS "own digest" ON public.digest_settings;
CREATE POLICY "own digest" ON public.digest_settings
  FOR ALL TO authenticated
  USING (auth.uid() = merchant_id)
  WITH CHECK (auth.uid() = merchant_id);
