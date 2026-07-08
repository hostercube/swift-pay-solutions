CREATE TABLE IF NOT EXISTS public.platform_plugins (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  slug text NOT NULL UNIQUE,
  platform text NOT NULL,
  description text,
  version text,
  icon_url text,
  download_url text,
  docs_url text,
  repo_url text,
  is_active boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.platform_plugins TO anon, authenticated;
GRANT ALL ON public.platform_plugins TO service_role;
GRANT INSERT, UPDATE, DELETE ON public.platform_plugins TO authenticated;
ALTER TABLE public.platform_plugins ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "plugins_public_read" ON public.platform_plugins;
CREATE POLICY "plugins_public_read" ON public.platform_plugins FOR SELECT TO anon, authenticated
  USING (is_active = true OR public.has_role(auth.uid(), 'super_admin'));
DROP POLICY IF EXISTS "plugins_admin_write" ON public.platform_plugins;
CREATE POLICY "plugins_admin_write" ON public.platform_plugins FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'super_admin'))
  WITH CHECK (public.has_role(auth.uid(), 'super_admin'));
CREATE INDEX IF NOT EXISTS platform_plugins_active_sort_idx ON public.platform_plugins (is_active, sort_order);
INSERT INTO public.platform_plugins (name, slug, platform, description, version, sort_order) VALUES
  ('PayNOC for WordPress', 'wordpress', 'WordPress', 'Official WordPress plugin — drop-in checkout, WooCommerce gateway, and receipt handling.', '1.0.0', 10),
  ('PayNOC for WHMCS', 'whmcs', 'WHMCS', 'WHMCS payment gateway module — invoice sync, auto-verification, and refund support.', '1.0.0', 20),
  ('PayNOC for Shopify', 'shopify', 'Shopify', 'Shopify custom payment app — hosted checkout redirect and webhook order fulfillment.', '1.0.0', 30)
ON CONFLICT (slug) DO NOTHING;