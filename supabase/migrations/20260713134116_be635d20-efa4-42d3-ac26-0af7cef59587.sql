
-- 1. Package-level allowlist. NULL / empty = all providers allowed.
ALTER TABLE public.subscription_packages
  ADD COLUMN IF NOT EXISTS allowed_providers text[];

-- 2. Per-merchant provider override table (super-admin managed).
CREATE TABLE IF NOT EXISTS public.merchant_provider_grants (
  merchant_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  provider text NOT NULL,
  enabled boolean NOT NULL DEFAULT true,
  note text,
  updated_by uuid,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (merchant_id, provider)
);

GRANT SELECT ON public.merchant_provider_grants TO authenticated;
GRANT ALL ON public.merchant_provider_grants TO service_role;

ALTER TABLE public.merchant_provider_grants ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "merchant reads own grants" ON public.merchant_provider_grants;
CREATE POLICY "merchant reads own grants" ON public.merchant_provider_grants
  FOR SELECT TO authenticated
  USING (auth.uid() = merchant_id OR public.is_admin_office(auth.uid()));

DROP POLICY IF EXISTS "admins manage grants" ON public.merchant_provider_grants;
CREATE POLICY "admins manage grants" ON public.merchant_provider_grants
  FOR ALL TO authenticated
  USING (public.is_admin_office(auth.uid()))
  WITH CHECK (public.is_admin_office(auth.uid()));

CREATE INDEX IF NOT EXISTS merchant_provider_grants_provider_idx
  ON public.merchant_provider_grants(provider);

-- 3. Combined availability check: global toggle AND package allowlist AND merchant grant.
CREATE OR REPLACE FUNCTION public.merchant_provider_available(
  _merchant_id uuid, _provider text
) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  WITH
    g AS (SELECT public.provider_enabled(_provider) AS ok),
    pkg AS (
      SELECT p.allowed_providers
      FROM public.merchant_subscriptions s
      JOIN public.subscription_packages p ON p.id = s.package_id
      WHERE s.merchant_id = _merchant_id
        AND s.status IN ('trialing','active')
      ORDER BY s.created_at DESC
      LIMIT 1
    ),
    grant_row AS (
      SELECT enabled FROM public.merchant_provider_grants
      WHERE merchant_id = _merchant_id AND provider = _provider
      LIMIT 1
    )
  SELECT
    (SELECT ok FROM g)
    AND (
      NOT EXISTS (SELECT 1 FROM pkg WHERE allowed_providers IS NOT NULL AND array_length(allowed_providers,1) > 0)
      OR EXISTS (SELECT 1 FROM pkg WHERE _provider = ANY(allowed_providers))
    )
    AND COALESCE((SELECT enabled FROM grant_row), true);
$$;

REVOKE ALL ON FUNCTION public.merchant_provider_available(uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.merchant_provider_available(uuid, text) TO anon, authenticated;

-- 4. Rewire checkout RPCs to use the combined check.
CREATE OR REPLACE FUNCTION public.get_checkout_methods(_merchant_id uuid)
RETURNS SETOF public.payment_methods
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT m.* FROM public.payment_methods m
  WHERE m.merchant_id = _merchant_id
    AND m.is_active = true
    AND public.merchant_provider_available(_merchant_id, m.type::text)
  ORDER BY m.sort_order ASC;
$$;

CREATE OR REPLACE FUNCTION public.get_checkout_gateways(_merchant_id uuid)
RETURNS TABLE(id uuid, provider text, mode text, label text, logo_url text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT g.id, g.provider, g.mode::text, g.label, g.logo_url
  FROM public.byo_gateways g
  WHERE g.merchant_id = _merchant_id
    AND g.is_active = true
    AND public.merchant_provider_available(_merchant_id, g.provider)
  ORDER BY g.created_at ASC;
$$;
