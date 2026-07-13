-- 1. Toggle table
CREATE TABLE IF NOT EXISTS public.gateway_provider_toggles (
  provider text PRIMARY KEY,
  category text NOT NULL CHECK (category IN ('bd','international','crypto','manual')),
  label text NOT NULL,
  enabled boolean NOT NULL DEFAULT true,
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid REFERENCES auth.users(id) ON DELETE SET NULL
);

GRANT SELECT ON public.gateway_provider_toggles TO authenticated;
GRANT SELECT ON public.gateway_provider_toggles TO anon;
GRANT ALL ON public.gateway_provider_toggles TO service_role;

ALTER TABLE public.gateway_provider_toggles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "read toggles" ON public.gateway_provider_toggles;
CREATE POLICY "read toggles" ON public.gateway_provider_toggles
  FOR SELECT TO authenticated, anon USING (true);

DROP POLICY IF EXISTS "super admin manage toggles" ON public.gateway_provider_toggles;
CREATE POLICY "super admin manage toggles" ON public.gateway_provider_toggles
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'super_admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'super_admin'::app_role));

-- 2. Seed
INSERT INTO public.gateway_provider_toggles (provider, category, label) VALUES
  ('bkash','bd','bKash'),
  ('nagad','bd','Nagad'),
  ('rocket','bd','Rocket (DBBL)'),
  ('sslcommerz','bd','SSLCommerz'),
  ('shurjopay','bd','ShurjoPay'),
  ('aamarpay','bd','AamarPay'),
  ('upay','bd','Upay (UCB)'),
  ('tap','bd','Tap (Trust Axiata Pay)'),
  ('mcash','bd','MCash (IBBL)'),
  ('mycash','bd','MyCash (Mercantile)'),
  ('dmoney','bd','DMoney'),
  ('surecash','bd','SureCash'),
  ('sure_cash','manual','SureCash (manual)'),
  ('portwallet','bd','PortWallet'),
  ('walletmix','bd','WalletMix'),
  ('uddoktapay','bd','UddoktaPay'),
  ('piprapay','bd','PipraPay'),
  ('ownpay','bd','OwnPay (self-hosted)'),
  ('eps','bd','EPS (Easy Payment System)'),
  ('paystation','bd','PayStation'),
  ('bank_transfer','manual','Bank Transfer'),
  ('bangla_qr','manual','Bangla QR'),
  ('card','manual','Card (manual)'),
  ('crypto','manual','Crypto (manual)'),
  ('other','manual','Other (manual)'),
  ('stripe','international','Stripe'),
  ('paypal','international','PayPal'),
  ('razorpay','international','Razorpay'),
  ('paddle','international','Paddle'),
  ('twocheckout','international','2Checkout (Verifone)'),
  ('coinbase_commerce','crypto','Coinbase Commerce'),
  ('nowpayments','crypto','NOWPayments'),
  ('binance_pay','crypto','Binance Pay'),
  ('cryptomus','crypto','Cryptomus')
ON CONFLICT (provider) DO NOTHING;

-- 3. Helper
CREATE OR REPLACE FUNCTION public.provider_enabled(_provider text)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT COALESCE((SELECT enabled FROM public.gateway_provider_toggles WHERE provider = _provider), true)
$$;

-- 4. Gate checkout RPCs so disabled providers vanish from customer view
CREATE OR REPLACE FUNCTION public.get_checkout_gateways(_merchant_id uuid)
RETURNS TABLE(id uuid, provider text, mode text, label text, logo_url text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT g.id, g.provider, g.mode::text, g.label, g.logo_url
  FROM public.byo_gateways g
  WHERE g.merchant_id = _merchant_id
    AND g.is_active = true
    AND public.provider_enabled(g.provider)
  ORDER BY g.created_at ASC;
$$;

CREATE OR REPLACE FUNCTION public.get_checkout_methods(_merchant_id uuid)
RETURNS SETOF public.payment_methods
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT m.* FROM public.payment_methods m
  WHERE m.merchant_id = _merchant_id
    AND m.is_active = true
    AND public.provider_enabled(m.type::text)
  ORDER BY m.sort_order ASC;
$$;