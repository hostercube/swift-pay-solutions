-- A2Z permission repair: table grants, function execute permissions, and public tip invoice insert.
-- Safe to re-run.

-- 1) Explicit Data API table grants for public schema tables.
-- Auth-only merchant/admin/user tables: authenticated gets the privileges that RLS can allow; service role gets full access.
GRANT SELECT, INSERT, UPDATE, DELETE ON public.admin_staff TO authenticated;
GRANT ALL ON public.admin_staff TO service_role;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.api_keys TO authenticated;
GRANT ALL ON public.api_keys TO service_role;

GRANT SELECT ON public.api_request_logs TO authenticated;
GRANT ALL ON public.api_request_logs TO service_role;

GRANT SELECT, INSERT ON public.audit_logs TO authenticated;
GRANT ALL ON public.audit_logs TO service_role;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.byo_gateways TO authenticated;
GRANT ALL ON public.byo_gateways TO service_role;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.digest_settings TO authenticated;
GRANT ALL ON public.digest_settings TO service_role;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.discount_codes TO authenticated;
GRANT ALL ON public.discount_codes TO service_role;

GRANT SELECT, INSERT, UPDATE ON public.disputes TO authenticated;
GRANT ALL ON public.disputes TO service_role;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.fraud_blocklist TO authenticated;
GRANT ALL ON public.fraud_blocklist TO service_role;

GRANT SELECT ON public.fx_rates TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.fx_rates TO authenticated;
GRANT ALL ON public.fx_rates TO service_role;

-- Internal service-only tables.
REVOKE ALL ON public.idempotency_keys FROM anon, authenticated;
GRANT ALL ON public.idempotency_keys TO service_role;

GRANT SELECT, INSERT ON public.impersonation_events TO authenticated;
GRANT ALL ON public.impersonation_events TO service_role;

GRANT SELECT ON public.incidents TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.incidents TO authenticated;
GRANT ALL ON public.incidents TO service_role;

-- Public checkout needs anonymous update/insert paths, constrained by RLS below.
GRANT INSERT, UPDATE ON public.invoices TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.invoices TO authenticated;
GRANT ALL ON public.invoices TO service_role;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.ip_whitelist TO authenticated;
GRANT ALL ON public.ip_whitelist TO service_role;

GRANT SELECT ON public.merchant_fx_rates TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.merchant_fx_rates TO authenticated;
GRANT ALL ON public.merchant_fx_rates TO service_role;

GRANT SELECT ON public.notification_log TO authenticated;
GRANT ALL ON public.notification_log TO service_role;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.notification_settings TO authenticated;
GRANT ALL ON public.notification_settings TO service_role;

GRANT SELECT, UPDATE ON public.notifications TO authenticated;
GRANT ALL ON public.notifications TO service_role;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.payment_methods TO authenticated;
GRANT ALL ON public.payment_methods TO service_role;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.payout_schedules TO authenticated;
GRANT ALL ON public.payout_schedules TO service_role;

GRANT SELECT, INSERT, UPDATE ON public.payouts TO authenticated;
GRANT ALL ON public.payouts TO service_role;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.platform_gateways TO authenticated;
GRANT ALL ON public.platform_gateways TO service_role;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.platform_settings TO authenticated;
GRANT ALL ON public.platform_settings TO service_role;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;

REVOKE ALL ON public.rate_limit_buckets FROM anon, authenticated;
GRANT ALL ON public.rate_limit_buckets TO service_role;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.recurring_schedules TO authenticated;
GRANT ALL ON public.recurring_schedules TO service_role;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.team_members TO authenticated;
GRANT ALL ON public.team_members TO service_role;

GRANT INSERT ON public.transactions TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.transactions TO authenticated;
GRANT ALL ON public.transactions TO service_role;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;

GRANT SELECT ON public.webhook_deliveries TO authenticated;
GRANT ALL ON public.webhook_deliveries TO service_role;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.webhook_endpoints TO authenticated;
GRANT ALL ON public.webhook_endpoints TO service_role;

GRANT SELECT ON public.webhook_events TO authenticated;
GRANT ALL ON public.webhook_events TO service_role;

-- 2) Keep the public merchant tip page working without opening invoice reads.
DROP POLICY IF EXISTS "Public can create tip invoices" ON public.invoices;
CREATE POLICY "Public can create tip invoices"
  ON public.invoices
  FOR INSERT
  TO anon
  WITH CHECK (
    status = 'pending'::invoice_status
    AND amount > 0
    AND customer_email IS NOT NULL
    AND mode = 'live'
    AND EXISTS (
      SELECT 1
      FROM public.profiles p
      WHERE p.id = invoices.merchant_id
        AND p.accept_tips = true
        AND invoices.amount >= COALESCE(p.tip_min_amount, 0)
    )
  );

-- 3) Lock down function execution and grant only intentional callers.
-- Trigger/internal functions: no direct browser calls.
REVOKE ALL ON FUNCTION public.activate_admin_staff() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.activate_team_invites() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.update_updated_at_column() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.consume_rate_limit(uuid, integer, integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.activate_admin_staff() TO service_role;
GRANT EXECUTE ON FUNCTION public.activate_team_invites() TO service_role;
GRANT EXECUTE ON FUNCTION public.handle_new_user() TO service_role;
GRANT EXECUTE ON FUNCTION public.update_updated_at_column() TO service_role;
GRANT EXECUTE ON FUNCTION public.consume_rate_limit(uuid, integer, integer) TO service_role;

-- Signed-in role/permission helper functions used by app routes and server functions.
REVOKE ALL ON FUNCTION public.has_role(uuid, public.app_role) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.effective_merchant_role(uuid, uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.merchant_can(uuid, uuid, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.merchant_has_perm(uuid, uuid, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.admin_has_perm(uuid, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.is_admin_office(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.effective_merchant_role(uuid, uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.merchant_can(uuid, uuid, text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.merchant_has_perm(uuid, uuid, text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.admin_has_perm(uuid, text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.is_admin_office(uuid) TO authenticated, service_role;

-- Public checkout / customer portal / public merchant RPCs.
REVOKE ALL ON FUNCTION public.get_checkout_invoice(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.get_checkout_methods(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.get_checkout_brand(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.get_checkout_transactions(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.get_customer_invoices(text, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.get_public_merchant(text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.get_effective_fx_rate(uuid, text, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.apply_discount_code(uuid, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.check_fraud_block(uuid, text, text, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_checkout_invoice(uuid) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_checkout_methods(uuid) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_checkout_brand(uuid) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_checkout_transactions(uuid) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_customer_invoices(text, text) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_public_merchant(text) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_effective_fx_rate(uuid, text, text) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.apply_discount_code(uuid, text) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.check_fraud_block(uuid, text, text, text) TO anon, authenticated, service_role;