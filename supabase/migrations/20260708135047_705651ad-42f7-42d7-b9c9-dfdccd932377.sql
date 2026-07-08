-- Harden SECURITY DEFINER functions: remove default PUBLIC/anon EXECUTE
-- and grant EXECUTE only to the roles that actually need it.

-- Trigger functions (never called via RPC)
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.update_updated_at_column() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.activate_team_invites() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.activate_admin_staff() FROM PUBLIC, anon, authenticated;

-- Internal helpers called only by RLS policies / other SECURITY DEFINER fns
REVOKE EXECUTE ON FUNCTION public.admin_has_perm(uuid, text) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.merchant_has_perm(uuid, uuid, text) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.check_fraud_block(uuid, text, text, text) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.consume_rate_limit(uuid, integer, integer) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.get_effective_fx_rate(uuid, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_effective_fx_rate(uuid, text, text) TO authenticated;

-- Role/permission helpers: only signed-in users need to call these
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, app_role) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.effective_merchant_role(uuid, uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.merchant_can(uuid, uuid, text) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.is_admin_office(uuid) FROM PUBLIC, anon;

-- Discount code apply: signed-in checkout path (server function acts as user)
REVOKE EXECUTE ON FUNCTION public.apply_discount_code(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.apply_discount_code(uuid, text) TO authenticated;

-- Customer invoice lookup: keep anon (public portal look-up with proof of ownership)
-- get_public_merchant, get_checkout_*: keep anon (checkout is public)
-- These intentionally remain callable by anon.
