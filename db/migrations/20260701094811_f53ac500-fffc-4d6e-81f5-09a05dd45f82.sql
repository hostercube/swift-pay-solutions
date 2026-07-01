
-- ============ ENUMS ============
CREATE TYPE public.payment_method_type AS ENUM (
  'bkash','nagad','rocket','upay','tap','mcash','sure_cash','bank_transfer','card','crypto','other'
);
CREATE TYPE public.payment_method_mode AS ENUM ('manual','api');
CREATE TYPE public.invoice_status AS ENUM (
  'pending','processing','completed','failed','expired','refunded','cancelled'
);
CREATE TYPE public.transaction_status AS ENUM ('pending','verified','rejected');
CREATE TYPE public.webhook_delivery_status AS ENUM ('pending','success','failed');

-- ============ PAYMENT METHODS ============
CREATE TABLE public.payment_methods (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  merchant_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  type public.payment_method_type NOT NULL,
  label TEXT NOT NULL,
  mode public.payment_method_mode NOT NULL DEFAULT 'manual',
  account_number TEXT,
  account_name TEXT,
  instructions TEXT,
  credentials JSONB NOT NULL DEFAULT '{}'::jsonb,
  logo_url TEXT,
  fee_percent NUMERIC(6,3) NOT NULL DEFAULT 0,
  fee_flat NUMERIC(12,2) NOT NULL DEFAULT 0,
  min_amount NUMERIC(12,2),
  max_amount NUMERIC(12,2),
  is_active BOOLEAN NOT NULL DEFAULT true,
  sort_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.payment_methods TO authenticated;
GRANT ALL ON public.payment_methods TO service_role;
ALTER TABLE public.payment_methods ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Merchant manage own methods" ON public.payment_methods
  FOR ALL TO authenticated
  USING (merchant_id = auth.uid() OR public.has_role(auth.uid(),'super_admin'))
  WITH CHECK (merchant_id = auth.uid() OR public.has_role(auth.uid(),'super_admin'));

-- ============ API KEYS ============
CREATE TABLE public.api_keys (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  merchant_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  public_key TEXT NOT NULL UNIQUE,
  secret_hash TEXT NOT NULL,
  environment TEXT NOT NULL DEFAULT 'live' CHECK (environment IN ('live','test')),
  last_used_at TIMESTAMPTZ,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.api_keys TO authenticated;
GRANT ALL ON public.api_keys TO service_role;
ALTER TABLE public.api_keys ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Merchant manage own api keys" ON public.api_keys
  FOR ALL TO authenticated
  USING (merchant_id = auth.uid() OR public.has_role(auth.uid(),'super_admin'))
  WITH CHECK (merchant_id = auth.uid() OR public.has_role(auth.uid(),'super_admin'));

-- ============ WEBHOOK ENDPOINTS ============
CREATE TABLE public.webhook_endpoints (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  merchant_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  url TEXT NOT NULL,
  signing_secret TEXT NOT NULL,
  events TEXT[] NOT NULL DEFAULT ARRAY['invoice.completed','invoice.failed'],
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.webhook_endpoints TO authenticated;
GRANT ALL ON public.webhook_endpoints TO service_role;
ALTER TABLE public.webhook_endpoints ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Merchant manage own webhooks" ON public.webhook_endpoints
  FOR ALL TO authenticated
  USING (merchant_id = auth.uid() OR public.has_role(auth.uid(),'super_admin'))
  WITH CHECK (merchant_id = auth.uid() OR public.has_role(auth.uid(),'super_admin'));

-- ============ INVOICES ============
CREATE TABLE public.invoices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  merchant_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  invoice_number TEXT NOT NULL UNIQUE,
  amount NUMERIC(14,2) NOT NULL CHECK (amount >= 0),
  currency TEXT NOT NULL DEFAULT 'BDT',
  status public.invoice_status NOT NULL DEFAULT 'pending',
  method_id UUID REFERENCES public.payment_methods(id) ON DELETE SET NULL,
  method_type public.payment_method_type,
  customer_name TEXT,
  customer_email TEXT,
  customer_phone TEXT,
  description TEXT,
  redirect_url TEXT,
  webhook_url TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  fee_amount NUMERIC(14,2) NOT NULL DEFAULT 0,
  net_amount NUMERIC(14,2) NOT NULL DEFAULT 0,
  paid_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX invoices_merchant_created_idx ON public.invoices(merchant_id, created_at DESC);
CREATE INDEX invoices_status_idx ON public.invoices(status);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.invoices TO authenticated;
GRANT ALL ON public.invoices TO service_role;
ALTER TABLE public.invoices ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Merchant read own invoices" ON public.invoices
  FOR SELECT TO authenticated
  USING (merchant_id = auth.uid() OR public.has_role(auth.uid(),'super_admin'));
CREATE POLICY "Merchant insert own invoices" ON public.invoices
  FOR INSERT TO authenticated
  WITH CHECK (merchant_id = auth.uid() OR public.has_role(auth.uid(),'super_admin'));
CREATE POLICY "Merchant update own invoices" ON public.invoices
  FOR UPDATE TO authenticated
  USING (merchant_id = auth.uid() OR public.has_role(auth.uid(),'super_admin'))
  WITH CHECK (merchant_id = auth.uid() OR public.has_role(auth.uid(),'super_admin'));
CREATE POLICY "Super admin delete invoices" ON public.invoices
  FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(),'super_admin'));

-- ============ TRANSACTIONS ============
CREATE TABLE public.transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id UUID NOT NULL REFERENCES public.invoices(id) ON DELETE CASCADE,
  merchant_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  method_type public.payment_method_type NOT NULL,
  status public.transaction_status NOT NULL DEFAULT 'pending',
  gross_amount NUMERIC(14,2) NOT NULL,
  fee_amount NUMERIC(14,2) NOT NULL DEFAULT 0,
  net_amount NUMERIC(14,2) NOT NULL DEFAULT 0,
  sender_number TEXT,
  sender_name TEXT,
  reference TEXT,
  provider_txn_id TEXT,
  raw_response JSONB NOT NULL DEFAULT '{}'::jsonb,
  verified_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  verified_at TIMESTAMPTZ,
  note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX transactions_merchant_created_idx ON public.transactions(merchant_id, created_at DESC);
CREATE INDEX transactions_invoice_idx ON public.transactions(invoice_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.transactions TO authenticated;
GRANT ALL ON public.transactions TO service_role;
ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Merchant manage own transactions" ON public.transactions
  FOR ALL TO authenticated
  USING (merchant_id = auth.uid() OR public.has_role(auth.uid(),'super_admin'))
  WITH CHECK (merchant_id = auth.uid() OR public.has_role(auth.uid(),'super_admin'));

-- ============ WEBHOOK DELIVERIES ============
CREATE TABLE public.webhook_deliveries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  merchant_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  endpoint_id UUID REFERENCES public.webhook_endpoints(id) ON DELETE SET NULL,
  invoice_id UUID REFERENCES public.invoices(id) ON DELETE SET NULL,
  event TEXT NOT NULL,
  url TEXT NOT NULL,
  payload JSONB NOT NULL,
  status public.webhook_delivery_status NOT NULL DEFAULT 'pending',
  http_status INT,
  response_body TEXT,
  attempts INT NOT NULL DEFAULT 0,
  next_retry_at TIMESTAMPTZ,
  delivered_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX webhook_deliveries_merchant_idx ON public.webhook_deliveries(merchant_id, created_at DESC);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.webhook_deliveries TO authenticated;
GRANT ALL ON public.webhook_deliveries TO service_role;
ALTER TABLE public.webhook_deliveries ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Merchant read own deliveries" ON public.webhook_deliveries
  FOR SELECT TO authenticated
  USING (merchant_id = auth.uid() OR public.has_role(auth.uid(),'super_admin'));
CREATE POLICY "Super admin manage deliveries" ON public.webhook_deliveries
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'super_admin'))
  WITH CHECK (public.has_role(auth.uid(),'super_admin'));

-- ============ AUDIT LOGS ============
CREATE TABLE public.audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  merchant_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  action TEXT NOT NULL,
  resource TEXT,
  resource_id TEXT,
  ip_address TEXT,
  user_agent TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX audit_logs_actor_idx ON public.audit_logs(actor_id, created_at DESC);
GRANT SELECT, INSERT ON public.audit_logs TO authenticated;
GRANT ALL ON public.audit_logs TO service_role;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Actor read own logs" ON public.audit_logs
  FOR SELECT TO authenticated
  USING (actor_id = auth.uid() OR merchant_id = auth.uid() OR public.has_role(auth.uid(),'super_admin'));
CREATE POLICY "Signed in insert audit" ON public.audit_logs
  FOR INSERT TO authenticated
  WITH CHECK (actor_id = auth.uid());

-- ============ PLATFORM SETTINGS ============
CREATE TABLE public.platform_settings (
  id INT PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  brand_name TEXT NOT NULL DEFAULT 'PayNOC',
  support_email TEXT,
  default_fee_percent NUMERIC(6,3) NOT NULL DEFAULT 0,
  default_fee_flat NUMERIC(12,2) NOT NULL DEFAULT 0,
  default_currency TEXT NOT NULL DEFAULT 'BDT',
  allow_signup BOOLEAN NOT NULL DEFAULT true,
  logo_url TEXT,
  settings JSONB NOT NULL DEFAULT '{}'::jsonb,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.platform_settings TO authenticated;
GRANT ALL ON public.platform_settings TO service_role;
ALTER TABLE public.platform_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone signed in read settings" ON public.platform_settings
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "Super admin write settings" ON public.platform_settings
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'super_admin'))
  WITH CHECK (public.has_role(auth.uid(),'super_admin'));

INSERT INTO public.platform_settings (id) VALUES (1) ON CONFLICT (id) DO NOTHING;

-- ============ IP WHITELIST ============
CREATE TABLE public.ip_whitelist (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  merchant_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  ip_address TEXT NOT NULL,
  label TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(merchant_id, ip_address)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.ip_whitelist TO authenticated;
GRANT ALL ON public.ip_whitelist TO service_role;
ALTER TABLE public.ip_whitelist ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Merchant manage own ips" ON public.ip_whitelist
  FOR ALL TO authenticated
  USING (merchant_id = auth.uid() OR public.has_role(auth.uid(),'super_admin'))
  WITH CHECK (merchant_id = auth.uid() OR public.has_role(auth.uid(),'super_admin'));

-- ============ updated_at TRIGGERS ============
CREATE TRIGGER trg_payment_methods_upd BEFORE UPDATE ON public.payment_methods
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_api_keys_upd BEFORE UPDATE ON public.api_keys
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_webhook_endpoints_upd BEFORE UPDATE ON public.webhook_endpoints
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_invoices_upd BEFORE UPDATE ON public.invoices
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_transactions_upd BEFORE UPDATE ON public.transactions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_webhook_deliveries_upd BEFORE UPDATE ON public.webhook_deliveries
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_platform_settings_upd BEFORE UPDATE ON public.platform_settings
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
