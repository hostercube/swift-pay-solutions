
-- 1. Widen byo_gateways provider list
ALTER TABLE public.byo_gateways DROP CONSTRAINT IF EXISTS byo_gateways_provider_check;
ALTER TABLE public.byo_gateways ADD CONSTRAINT byo_gateways_provider_check CHECK (provider = ANY (ARRAY[
  'bkash','nagad','rocket','sslcommerz','shurjopay','aamarpay',
  'stripe','paypal','razorpay','paddle','twocheckout',
  'coinbase_commerce','nowpayments','binance_pay'
]));

-- 2. Platform-wide gateways (super-admin managed, merchants can opt-in)
CREATE TABLE IF NOT EXISTS public.platform_gateways (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  provider TEXT NOT NULL UNIQUE,
  mode TEXT NOT NULL DEFAULT 'sandbox' CHECK (mode IN ('sandbox','live')),
  credentials JSONB NOT NULL DEFAULT '{}'::jsonb,
  is_active BOOLEAN NOT NULL DEFAULT true,
  is_enabled_for_merchants BOOLEAN NOT NULL DEFAULT false,
  commission_percent NUMERIC(6,3) NOT NULL DEFAULT 0,
  commission_flat NUMERIC(12,2) NOT NULL DEFAULT 0,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.platform_gateways TO authenticated;
GRANT ALL ON public.platform_gateways TO service_role;
ALTER TABLE public.platform_gateways ENABLE ROW LEVEL SECURITY;

CREATE POLICY "super admin manage platform gateways"
  ON public.platform_gateways FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'super_admin'))
  WITH CHECK (public.has_role(auth.uid(), 'super_admin'));

CREATE POLICY "merchants view enabled platform gateways"
  ON public.platform_gateways FOR SELECT TO authenticated
  USING (is_enabled_for_merchants = true AND is_active = true);

CREATE TRIGGER trg_platform_gateways_upd BEFORE UPDATE ON public.platform_gateways
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 3. Webhook events audit
CREATE TABLE IF NOT EXISTS public.webhook_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  provider TEXT NOT NULL,
  merchant_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  invoice_id UUID REFERENCES public.invoices(id) ON DELETE SET NULL,
  transaction_id UUID REFERENCES public.transactions(id) ON DELETE SET NULL,
  event_type TEXT,
  provider_event_id TEXT,
  raw_body TEXT NOT NULL,
  headers JSONB NOT NULL DEFAULT '{}'::jsonb,
  signature_verified BOOLEAN NOT NULL DEFAULT false,
  processed BOOLEAN NOT NULL DEFAULT false,
  error TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (provider, provider_event_id)
);
GRANT SELECT ON public.webhook_events TO authenticated;
GRANT ALL ON public.webhook_events TO service_role;
ALTER TABLE public.webhook_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "merchant view own webhook events"
  ON public.webhook_events FOR SELECT TO authenticated
  USING (merchant_id = auth.uid() OR public.has_role(auth.uid(), 'super_admin'));

CREATE INDEX IF NOT EXISTS idx_webhook_events_merchant ON public.webhook_events(merchant_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_webhook_events_provider ON public.webhook_events(provider, created_at DESC);

-- 4. Add preferred_gateway pointer to payment_methods
ALTER TABLE public.payment_methods
  ADD COLUMN IF NOT EXISTS gateway_provider TEXT,
  ADD COLUMN IF NOT EXISTS gateway_source TEXT DEFAULT 'manual' CHECK (gateway_source IN ('manual','byo','platform'));
