
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS checkout_style text NOT NULL DEFAULT 'premium'
  CHECK (checkout_style IN ('premium','classic','neon','minimal'));

DROP FUNCTION IF EXISTS public.get_checkout_brand(uuid);
CREATE FUNCTION public.get_checkout_brand(_merchant_id uuid)
RETURNS TABLE(
  merchant_id uuid, business_name text, brand_color text, logo_url text,
  support_email text, checkout_footer text, checkout_style text,
  ga4_measurement_id text, gtm_container_id text, meta_pixel_id text,
  tiktok_pixel_id text, google_ads_conversion_id text, google_ads_conversion_label text,
  custom_head_html text, custom_footer_html text
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$
  SELECT id, business_name, brand_color, logo_url, support_email, checkout_footer, checkout_style,
         ga4_measurement_id, gtm_container_id, meta_pixel_id, tiktok_pixel_id,
         google_ads_conversion_id, google_ads_conversion_label,
         custom_head_html, custom_footer_html
  FROM public.profiles WHERE id = _merchant_id LIMIT 1;
$$;
REVOKE EXECUTE ON FUNCTION public.get_checkout_brand(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_checkout_brand(uuid) TO anon, authenticated, service_role;
