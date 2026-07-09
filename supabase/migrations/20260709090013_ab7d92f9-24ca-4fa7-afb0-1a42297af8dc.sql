
-- Merchant white-label domains
CREATE TABLE IF NOT EXISTS public.merchant_domains (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  merchant_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  domain text NOT NULL,
  verify_token text NOT NULL DEFAULT encode(gen_random_bytes(16), 'hex'),
  verified_at timestamptz,
  is_primary boolean NOT NULL DEFAULT false,
  use_for text NOT NULL DEFAULT 'all' CHECK (use_for IN ('checkout','portal','all')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS merchant_domains_domain_key
  ON public.merchant_domains (lower(domain));
CREATE INDEX IF NOT EXISTS merchant_domains_merchant_idx
  ON public.merchant_domains (merchant_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.merchant_domains TO authenticated;
GRANT ALL ON public.merchant_domains TO service_role;

ALTER TABLE public.merchant_domains ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Merchant admins manage their domains"
  ON public.merchant_domains FOR ALL
  TO authenticated
  USING (public.merchant_can(auth.uid(), merchant_id, 'admin'))
  WITH CHECK (public.merchant_can(auth.uid(), merchant_id, 'admin'));

CREATE POLICY "Admin office can view all domains"
  ON public.merchant_domains FOR SELECT
  TO authenticated
  USING (public.is_admin_office(auth.uid()));

CREATE TRIGGER trg_merchant_domains_updated
  BEFORE UPDATE ON public.merchant_domains
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Public resolver: map a hostname to the merchant's slug + branding.
-- Returns nothing if domain is not verified.
CREATE OR REPLACE FUNCTION public.resolve_merchant_domain(_host text)
RETURNS TABLE(merchant_id uuid, slug text, business_name text, use_for text)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT d.merchant_id, p.slug, p.business_name, d.use_for
  FROM public.merchant_domains d
  JOIN public.profiles p ON p.id = d.merchant_id
  WHERE lower(d.domain) = lower(_host)
    AND d.verified_at IS NOT NULL
  LIMIT 1;
$$;

GRANT EXECUTE ON FUNCTION public.resolve_merchant_domain(text) TO anon, authenticated, service_role;

-- Verify by checking TXT record: called by merchant from UI (server fn will
-- perform the DNS lookup and then call this to mark verified).
CREATE OR REPLACE FUNCTION public.mark_domain_verified(_domain_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE d public.merchant_domains%ROWTYPE;
BEGIN
  SELECT * INTO d FROM public.merchant_domains WHERE id = _domain_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Not found'; END IF;
  IF NOT public.merchant_can(auth.uid(), d.merchant_id, 'admin') THEN
    RAISE EXCEPTION 'Forbidden';
  END IF;
  UPDATE public.merchant_domains
     SET verified_at = now(), updated_at = now()
   WHERE id = _domain_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.mark_domain_verified(uuid) TO authenticated, service_role;
