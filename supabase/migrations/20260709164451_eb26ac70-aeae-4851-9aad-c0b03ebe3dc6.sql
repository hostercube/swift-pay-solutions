
-- ============================================================
-- Security hardening: lock down SECURITY DEFINER functions and
-- restrict payment-slip uploads to real pending invoices.
-- ============================================================

-- 1) Revoke default PUBLIC EXECUTE from all custom functions,
--    then grant back only what each role legitimately needs.
DO $$
DECLARE r record;
BEGIN
  FOR r IN
    SELECT n.nspname, p.proname, pg_get_function_identity_arguments(p.oid) AS args
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
  LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION public.%I(%s) FROM PUBLIC, anon, authenticated',
                   r.proname, r.args);
  END LOOP;
END $$;

-- 2) Public checkout / merchant-lookup RPCs (anon + authenticated)
GRANT EXECUTE ON FUNCTION public.get_public_merchant(text)              TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.resolve_merchant_domain(text)          TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_checkout_invoice(uuid)             TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_checkout_methods(uuid)             TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_checkout_transactions(uuid)        TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_checkout_gateways(uuid)            TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_checkout_brand(uuid)               TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.apply_discount_code(uuid, text)        TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.set_checkout_amount(uuid, numeric)     TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_customer_invoices(text, text)      TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.check_fraud_block(uuid, text, text, text) TO anon, authenticated;

-- 3) Authenticated-only helpers used from the app
GRANT EXECUTE ON FUNCTION public.has_role(uuid, app_role)                       TO authenticated;
GRANT EXECUTE ON FUNCTION public.merchant_can(uuid, uuid, text)                 TO authenticated;
GRANT EXECUTE ON FUNCTION public.merchant_has_perm(uuid, uuid, text)            TO authenticated;
GRANT EXECUTE ON FUNCTION public.merchant_has_package_permission(uuid, text)    TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_has_perm(uuid, text)                     TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_admin_office(uuid)                          TO authenticated;
GRANT EXECUTE ON FUNCTION public.effective_merchant_role(uuid, uuid)            TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_effective_fx_rate(uuid, text, text)        TO authenticated;
GRANT EXECUTE ON FUNCTION public.mark_domain_verified(uuid)                     TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_active_subscription(uuid)                  TO authenticated;
GRANT EXECUTE ON FUNCTION public.cancel_subscription(uuid)                      TO authenticated;

-- 4) Server / cron / trigger only: keep on service_role, deny end users
GRANT EXECUTE ON FUNCTION public.assign_subscription(uuid, uuid, boolean)       TO service_role;
GRANT EXECUTE ON FUNCTION public.expire_due_subscriptions()                     TO service_role;
GRANT EXECUTE ON FUNCTION public.renew_due_subscriptions()                      TO service_role;
GRANT EXECUTE ON FUNCTION public.consume_rate_limit(uuid, integer, integer)    TO service_role;
-- Trigger / internal helpers — service_role only
GRANT EXECUTE ON FUNCTION public.handle_new_user()                              TO service_role;
GRANT EXECUTE ON FUNCTION public.activate_admin_staff()                         TO service_role;
GRANT EXECUTE ON FUNCTION public.activate_team_invites()                        TO service_role;
GRANT EXECUTE ON FUNCTION public.update_updated_at_column()                     TO service_role;
GRANT EXECUTE ON FUNCTION public.compute_period_end(timestamptz, billing_cycle) TO service_role;

-- 5) Tighten payment-slip upload policy: caller can only upload into
--    a folder that maps to a real pending/processing invoice.
DROP POLICY IF EXISTS payment_assets_anon_slip_upload ON storage.objects;

CREATE POLICY payment_assets_slip_upload_for_open_invoice
  ON storage.objects
  FOR INSERT
  TO anon, authenticated
  WITH CHECK (
    bucket_id = 'payment-assets'
    AND (storage.foldername(name))[1] = 'slips'
    AND EXISTS (
      SELECT 1 FROM public.invoices i
      WHERE i.id::text = (storage.foldername(objects.name))[2]
        AND i.status IN ('pending','processing')
    )
  );
