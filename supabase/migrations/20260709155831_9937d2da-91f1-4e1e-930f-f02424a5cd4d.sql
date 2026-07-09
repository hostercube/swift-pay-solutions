
-- ============================================================
-- 1) Storage: tighten payment-assets policies
-- ============================================================
DROP POLICY IF EXISTS payment_assets_public_read ON storage.objects;
DROP POLICY IF EXISTS payment_assets_merchant_read ON storage.objects;

-- Public (anon) can only read QR codes (needed for checkout page)
CREATE POLICY payment_assets_qr_public_read
ON storage.objects FOR SELECT TO anon, authenticated
USING (
  bucket_id = 'payment-assets'
  AND (storage.foldername(name))[1] = 'qr'
);

-- Merchants can read slips ONLY for invoices they own
CREATE POLICY payment_assets_merchant_slip_read
ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'payment-assets'
  AND (storage.foldername(name))[1] = 'slips'
  AND EXISTS (
    SELECT 1 FROM public.invoices i
    WHERE i.id::text = (storage.foldername(name))[2]
      AND (i.merchant_id = auth.uid()
           OR public.merchant_can(auth.uid(), i.merchant_id, 'viewer')
           OR public.has_role(auth.uid(), 'super_admin'))
  )
);

-- Merchants can read their own QR uploads (already covered by public read, but keep explicit for delete/update authorization)

-- ============================================================
-- 2) merchant_fx_rates: remove blanket anon SELECT
-- ============================================================
DROP POLICY IF EXISTS "public read merchant fx" ON public.merchant_fx_rates;
-- Checkout uses get_effective_fx_rate() SECURITY DEFINER; no anon table access needed.

-- ============================================================
-- 3) compute_period_end: set search_path
-- ============================================================
ALTER FUNCTION public.compute_period_end(timestamptz, billing_cycle) SET search_path = public;

-- ============================================================
-- 4) Lock down SECURITY DEFINER function EXECUTE grants
-- ============================================================
-- Revoke default PUBLIC EXECUTE on all our SECURITY DEFINER functions,
-- then re-grant to the roles that actually need to call them.

-- Internal / trigger / cron only — no external callers
REVOKE EXECUTE ON FUNCTION public.handle_new_user()                     FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.activate_team_invites()               FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.activate_admin_staff()                FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.update_updated_at_column()            FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.consume_rate_limit(uuid, integer, integer) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.expire_due_subscriptions()            FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.renew_due_subscriptions()             FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.mark_domain_verified(uuid)            FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.assign_subscription(uuid, uuid, boolean) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.cancel_subscription(uuid)             FROM PUBLIC, anon;

-- Auth/permission helpers — signed-in users only (RLS policies call them)
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, app_role)              FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.is_admin_office(uuid)                 FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.admin_has_perm(uuid, text)            FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.merchant_has_perm(uuid, uuid, text)   FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.merchant_can(uuid, uuid, text)        FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.effective_merchant_role(uuid, uuid)   FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.merchant_has_package_permission(uuid, text) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.get_active_subscription(uuid)         FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.get_effective_fx_rate(uuid, text, text) FROM PUBLIC;

-- Checkout / public-facing functions stay callable by anon (customers browsing checkout).
-- These are intentionally exposed and safely projected:
--   get_public_merchant, get_checkout_brand, get_checkout_invoice,
--   get_checkout_methods, get_checkout_gateways, get_checkout_transactions,
--   get_customer_invoices, apply_discount_code, set_checkout_amount,
--   check_fraud_block, resolve_merchant_domain, get_effective_fx_rate,
--   compute_period_end
