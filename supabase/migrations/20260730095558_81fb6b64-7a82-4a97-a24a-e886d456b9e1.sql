REVOKE EXECUTE ON FUNCTION public.consume_rate_limit(uuid, integer, integer) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.renew_due_subscriptions() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.expire_due_subscriptions() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.check_fraud_block(uuid, text, text, text) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.activate_team_invites() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.activate_admin_staff() FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.consume_rate_limit(uuid, integer, integer) TO service_role;
GRANT EXECUTE ON FUNCTION public.renew_due_subscriptions() TO service_role;
GRANT EXECUTE ON FUNCTION public.expire_due_subscriptions() TO service_role;
GRANT EXECUTE ON FUNCTION public.check_fraud_block(uuid, text, text, text) TO service_role;