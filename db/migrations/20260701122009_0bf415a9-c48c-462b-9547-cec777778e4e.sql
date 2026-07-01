
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS brand_color text,
  ADD COLUMN IF NOT EXISTS logo_url text,
  ADD COLUMN IF NOT EXISTS support_email text,
  ADD COLUMN IF NOT EXISTS checkout_footer text;

CREATE OR REPLACE VIEW public.checkout_brand
WITH (security_invoker = true) AS
SELECT id AS merchant_id, business_name, brand_color, logo_url, support_email, checkout_footer
FROM public.profiles;

GRANT SELECT ON public.checkout_brand TO anon, authenticated;

-- Ensure anon can read the underlying columns via the invoker view
DROP POLICY IF EXISTS "Public can view checkout branding" ON public.profiles;
CREATE POLICY "Public can view checkout branding"
ON public.profiles FOR SELECT TO anon
USING (true);
