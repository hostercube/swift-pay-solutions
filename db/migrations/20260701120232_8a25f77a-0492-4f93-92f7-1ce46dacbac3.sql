
REVOKE ALL ON FUNCTION public.consume_rate_limit(UUID, INT, INT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.consume_rate_limit(UUID, INT, INT) TO service_role;
