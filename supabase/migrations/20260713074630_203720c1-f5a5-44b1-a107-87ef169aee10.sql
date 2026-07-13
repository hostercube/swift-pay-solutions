ALTER TABLE public.byo_gateways ADD COLUMN IF NOT EXISTS logo_url text;

DROP FUNCTION IF EXISTS public.get_checkout_gateways(uuid);
CREATE OR REPLACE FUNCTION public.get_checkout_gateways(_merchant_id uuid)
RETURNS TABLE(id uuid, provider text, mode text, label text, logo_url text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$
  SELECT id, provider, mode::text, label, logo_url
  FROM public.byo_gateways
  WHERE merchant_id = _merchant_id AND is_active = true
  ORDER BY created_at ASC;
$$;
REVOKE ALL ON FUNCTION public.get_checkout_gateways(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_checkout_gateways(uuid) TO anon, authenticated, service_role;