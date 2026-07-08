ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS ga4_measurement_id text,
  ADD COLUMN IF NOT EXISTS gtm_container_id text,
  ADD COLUMN IF NOT EXISTS meta_pixel_id text,
  ADD COLUMN IF NOT EXISTS meta_capi_token text,
  ADD COLUMN IF NOT EXISTS meta_capi_test_code text,
  ADD COLUMN IF NOT EXISTS tiktok_pixel_id text,
  ADD COLUMN IF NOT EXISTS google_ads_conversion_id text,
  ADD COLUMN IF NOT EXISTS google_ads_conversion_label text,
  ADD COLUMN IF NOT EXISTS custom_head_html text,
  ADD COLUMN IF NOT EXISTS custom_footer_html text,
  ADD COLUMN IF NOT EXISTS seo_meta_description text,
  ADD COLUMN IF NOT EXISTS seo_meta_keywords text;

DROP FUNCTION IF EXISTS public.get_checkout_brand(uuid);
CREATE FUNCTION public.get_checkout_brand(_merchant_id uuid)
RETURNS TABLE(
  merchant_id uuid, business_name text, brand_color text, logo_url text,
  support_email text, checkout_footer text,
  ga4_measurement_id text, gtm_container_id text, meta_pixel_id text,
  tiktok_pixel_id text, google_ads_conversion_id text, google_ads_conversion_label text,
  custom_head_html text, custom_footer_html text
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$
  SELECT id, business_name, brand_color, logo_url, support_email, checkout_footer,
         ga4_measurement_id, gtm_container_id, meta_pixel_id, tiktok_pixel_id,
         google_ads_conversion_id, google_ads_conversion_label,
         custom_head_html, custom_footer_html
  FROM public.profiles WHERE id = _merchant_id LIMIT 1;
$$;
REVOKE EXECUTE ON FUNCTION public.get_checkout_brand(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_checkout_brand(uuid) TO anon, authenticated;

DROP FUNCTION IF EXISTS public.get_public_merchant(text);
CREATE FUNCTION public.get_public_merchant(_slug text)
RETURNS TABLE(
  id uuid, business_name text, brand_color text, logo_url text,
  public_bio text, accept_tips boolean, tip_min_amount numeric,
  support_email text, slug text,
  seo_meta_description text, seo_meta_keywords text,
  ga4_measurement_id text, gtm_container_id text, meta_pixel_id text,
  tiktok_pixel_id text, google_ads_conversion_id text, google_ads_conversion_label text,
  custom_head_html text, custom_footer_html text
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$
  SELECT id, business_name, brand_color, logo_url, public_bio, accept_tips,
         tip_min_amount, support_email, slug,
         seo_meta_description, seo_meta_keywords,
         ga4_measurement_id, gtm_container_id, meta_pixel_id, tiktok_pixel_id,
         google_ads_conversion_id, google_ads_conversion_label,
         custom_head_html, custom_footer_html
  FROM public.profiles WHERE slug = _slug LIMIT 1;
$$;
REVOKE EXECUTE ON FUNCTION public.get_public_merchant(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_public_merchant(text) TO anon, authenticated;
