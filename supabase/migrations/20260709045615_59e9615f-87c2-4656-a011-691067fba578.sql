CREATE OR REPLACE FUNCTION public.get_checkout_gateways(_merchant_id uuid)
RETURNS TABLE(provider text, mode text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT provider, mode::text
  FROM public.byo_gateways
  WHERE merchant_id = _merchant_id AND is_active = true
  ORDER BY created_at ASC;
$$;

GRANT EXECUTE ON FUNCTION public.get_checkout_gateways(uuid) TO anon, authenticated;