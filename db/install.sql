-- =============================================================
-- PayNOC — Full database install bundle
-- Run this ONCE on a fresh Postgres (self-hosted Supabase / Coolify)
-- Requires extensions: pgcrypto, pg_cron (optional), pg_net (optional)
-- =============================================================

CREATE EXTENSION IF NOT EXISTS pgcrypto;


-- >>> 20260701094349_6b6345da-add4-449b-bbce-24f19d80f394.sql

-- Roles enum
CREATE TYPE public.app_role AS ENUM ('super_admin', 'admin', 'merchant');

-- Profiles table
CREATE TABLE public.profiles (
  id UUID NOT NULL PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  full_name TEXT,
  business_name TEXT,
  phone TEXT,
  avatar_url TEXT,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','suspended','pending')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- User roles table
CREATE TABLE public.user_roles (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role app_role NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);

GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- has_role security definer
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role)
$$;

-- Policies: profiles
CREATE POLICY "Users view own profile" ON public.profiles
  FOR SELECT TO authenticated
  USING (auth.uid() = id OR public.has_role(auth.uid(), 'super_admin'));

CREATE POLICY "Users update own profile" ON public.profiles
  FOR UPDATE TO authenticated
  USING (auth.uid() = id OR public.has_role(auth.uid(), 'super_admin'))
  WITH CHECK (auth.uid() = id OR public.has_role(auth.uid(), 'super_admin'));

CREATE POLICY "Users insert own profile" ON public.profiles
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = id);

CREATE POLICY "Super admins delete profiles" ON public.profiles
  FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'super_admin'));

-- Policies: user_roles
CREATE POLICY "Users view own roles" ON public.user_roles
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'super_admin'));

CREATE POLICY "Super admins manage roles" ON public.user_roles
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'super_admin'))
  WITH CHECK (public.has_role(auth.uid(), 'super_admin'));

-- updated_at trigger
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER update_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Auto-create profile + default role on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name, business_name, phone)
  VALUES (
    NEW.id,
    NEW.email,
    NEW.raw_user_meta_data->>'full_name',
    NEW.raw_user_meta_data->>'business_name',
    NEW.raw_user_meta_data->>'phone'
  );
  INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'merchant');
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();


-- >>> 20260701094419_1f0fc8d8-2c35-4479-80dc-7742942a45aa.sql

REVOKE EXECUTE ON FUNCTION public.has_role(UUID, public.app_role) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.has_role(UUID, public.app_role) TO service_role;


-- >>> 20260701094452_baaf95e1-1423-4f67-93b6-42b95551a353.sql

REVOKE EXECUTE ON FUNCTION public.update_updated_at_column() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;


-- >>> 20260701094811_f53ac500-fffc-4d6e-81f5-09a05dd45f82.sql

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


-- >>> 20260701095601_f9913049-313e-4888-b30b-d162cdb644fb.sql

CREATE VIEW public.checkout_methods AS
SELECT id, merchant_id, type, label, mode, account_number, account_name,
       instructions, logo_url, fee_percent, fee_flat, min_amount, max_amount, sort_order, is_active
FROM public.payment_methods
WHERE is_active = true;
GRANT SELECT ON public.checkout_methods TO anon, authenticated;

CREATE VIEW public.checkout_invoices AS
SELECT id, merchant_id, invoice_number, amount, currency, status, method_id, method_type,
       customer_name, customer_email, customer_phone, description, redirect_url,
       fee_amount, net_amount, expires_at, created_at
FROM public.invoices;
GRANT SELECT ON public.checkout_invoices TO anon, authenticated;

CREATE POLICY "Public read pending invoices" ON public.invoices
  FOR SELECT TO anon
  USING (status IN ('pending','processing'));
GRANT SELECT ON public.invoices TO anon;

CREATE POLICY "Public start payment" ON public.invoices
  FOR UPDATE TO anon
  USING (status = 'pending')
  WITH CHECK (status IN ('pending','processing'));
GRANT UPDATE ON public.invoices TO anon;

CREATE POLICY "Public submit transactions" ON public.transactions
  FOR INSERT TO anon
  WITH CHECK (
    status = 'pending'
    AND EXISTS (
      SELECT 1 FROM public.invoices i
      WHERE i.id = invoice_id
        AND i.merchant_id = transactions.merchant_id
        AND i.status IN ('pending','processing')
    )
  );
GRANT INSERT ON public.transactions TO anon;

CREATE POLICY "Public read invoice transactions" ON public.transactions
  FOR SELECT TO anon
  USING (
    EXISTS (
      SELECT 1 FROM public.invoices i
      WHERE i.id = invoice_id
        AND i.status IN ('pending','processing','completed')
    )
  );


-- >>> 20260701095631_c7a6dffd-9108-4e76-a0ad-679dd78f718c.sql

ALTER VIEW public.checkout_methods SET (security_invoker = true);
ALTER VIEW public.checkout_invoices SET (security_invoker = true);


-- >>> 20260701100410_ebdf339c-4001-44fc-a0e7-2ff00087f675.sql

-- notifications (in-app)
CREATE TABLE public.notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  merchant_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  event TEXT NOT NULL,
  title TEXT NOT NULL,
  body TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  read_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_notifications_merchant ON public.notifications(merchant_id, created_at DESC);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.notifications TO authenticated;
GRANT ALL ON public.notifications TO service_role;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Merchants view own notifications" ON public.notifications FOR SELECT
  USING (merchant_id = auth.uid() OR public.has_role(auth.uid(), 'super_admin'));
CREATE POLICY "Merchants update own notifications" ON public.notifications FOR UPDATE
  USING (merchant_id = auth.uid());
CREATE POLICY "Service manages notifications" ON public.notifications FOR ALL
  TO service_role USING (true) WITH CHECK (true);

-- notification settings
CREATE TABLE public.notification_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  merchant_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  email_enabled BOOLEAN NOT NULL DEFAULT true,
  sms_enabled BOOLEAN NOT NULL DEFAULT false,
  inapp_enabled BOOLEAN NOT NULL DEFAULT true,
  notify_email TEXT,
  notify_phone TEXT,
  events JSONB NOT NULL DEFAULT '{"invoice.completed":true,"invoice.failed":true,"webhook.failed":true,"payout.processed":true}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.notification_settings TO authenticated;
GRANT ALL ON public.notification_settings TO service_role;
ALTER TABLE public.notification_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Merchants manage own notif settings" ON public.notification_settings FOR ALL
  USING (merchant_id = auth.uid()) WITH CHECK (merchant_id = auth.uid());
CREATE TRIGGER update_notification_settings_updated_at BEFORE UPDATE ON public.notification_settings
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- notification delivery log
CREATE TABLE public.notification_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  merchant_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  channel TEXT NOT NULL, -- email | sms
  event TEXT NOT NULL,
  recipient TEXT NOT NULL,
  subject TEXT,
  body TEXT,
  status TEXT NOT NULL DEFAULT 'pending', -- pending | sent | failed | skipped
  provider TEXT,
  provider_response JSONB,
  error TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_notif_log_merchant ON public.notification_log(merchant_id, created_at DESC);
GRANT SELECT ON public.notification_log TO authenticated;
GRANT ALL ON public.notification_log TO service_role;
ALTER TABLE public.notification_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Merchants view own notif log" ON public.notification_log FOR SELECT
  USING (merchant_id = auth.uid() OR public.has_role(auth.uid(), 'super_admin'));
CREATE POLICY "Service writes notif log" ON public.notification_log FOR ALL
  TO service_role USING (true) WITH CHECK (true);


-- >>> 20260701101206_6ca62692-bbe9-49ca-acb3-7c27d66a6de7.sql

-- ============ PAYOUTS / WITHDRAWALS ============
CREATE TABLE public.payouts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  merchant_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  amount NUMERIC(14,2) NOT NULL CHECK (amount > 0),
  currency TEXT NOT NULL DEFAULT 'BDT',
  method TEXT NOT NULL,
  account_number TEXT NOT NULL,
  account_name TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  admin_note TEXT,
  reference TEXT,
  processed_at TIMESTAMPTZ,
  processed_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.payouts TO authenticated;
GRANT ALL ON public.payouts TO service_role;
ALTER TABLE public.payouts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "merchants read own payouts" ON public.payouts FOR SELECT TO authenticated
  USING (auth.uid() = merchant_id OR public.has_role(auth.uid(), 'super_admin'));
CREATE POLICY "merchants create own payouts" ON public.payouts FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = merchant_id);
CREATE POLICY "super admin manage payouts" ON public.payouts FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'super_admin'));
CREATE TRIGGER trg_payouts_updated BEFORE UPDATE ON public.payouts
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE INDEX idx_payouts_merchant ON public.payouts(merchant_id, created_at DESC);

-- ============ TEAM MEMBERS ============
CREATE TABLE public.team_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  merchant_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  member_email TEXT NOT NULL,
  member_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  role TEXT NOT NULL DEFAULT 'viewer',
  status TEXT NOT NULL DEFAULT 'invited',
  invited_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  accepted_at TIMESTAMPTZ,
  UNIQUE (merchant_id, member_email)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.team_members TO authenticated;
GRANT ALL ON public.team_members TO service_role;
ALTER TABLE public.team_members ENABLE ROW LEVEL SECURITY;
CREATE POLICY "merchant owns team" ON public.team_members FOR ALL TO authenticated
  USING (auth.uid() = merchant_id OR public.has_role(auth.uid(), 'super_admin'))
  WITH CHECK (auth.uid() = merchant_id OR public.has_role(auth.uid(), 'super_admin'));

-- ============ FRAUD RULES / BLOCKLIST ============
CREATE TABLE public.fraud_blocklist (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  merchant_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  block_type TEXT NOT NULL, -- email | phone | ip | sender_number
  value TEXT NOT NULL,
  reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (merchant_id, block_type, value)
);
GRANT SELECT, INSERT, DELETE ON public.fraud_blocklist TO authenticated;
GRANT ALL ON public.fraud_blocklist TO service_role;
ALTER TABLE public.fraud_blocklist ENABLE ROW LEVEL SECURITY;
CREATE POLICY "merchant owns blocklist" ON public.fraud_blocklist FOR ALL TO authenticated
  USING (auth.uid() = merchant_id) WITH CHECK (auth.uid() = merchant_id);

-- ============ FX RATES ============
CREATE TABLE public.fx_rates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  base_currency TEXT NOT NULL,
  quote_currency TEXT NOT NULL,
  rate NUMERIC(18,8) NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (base_currency, quote_currency)
);
GRANT SELECT ON public.fx_rates TO authenticated, anon;
GRANT ALL ON public.fx_rates TO service_role;
ALTER TABLE public.fx_rates ENABLE ROW LEVEL SECURITY;
CREATE POLICY "read fx" ON public.fx_rates FOR SELECT TO authenticated, anon USING (true);
CREATE POLICY "admin write fx" ON public.fx_rates FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'super_admin'))
  WITH CHECK (public.has_role(auth.uid(), 'super_admin'));
INSERT INTO public.fx_rates (base_currency, quote_currency, rate) VALUES
  ('USD', 'BDT', 110.00),
  ('EUR', 'BDT', 120.00),
  ('GBP', 'BDT', 140.00),
  ('INR', 'BDT', 1.32)
ON CONFLICT DO NOTHING;

-- ============ 2FA FLAG (uses Supabase Auth MFA under the hood) ============
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS mfa_enabled BOOLEAN NOT NULL DEFAULT false;


-- >>> 20260701115204_0757ba42-8c47-4681-9094-ecf9301946fd.sql

CREATE OR REPLACE FUNCTION public.check_fraud_block(
  _merchant_id UUID,
  _email TEXT,
  _phone TEXT,
  _ip TEXT
) RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS(
    SELECT 1 FROM public.fraud_blocklist
    WHERE merchant_id = _merchant_id
      AND (
        (block_type = 'email' AND lower(value) = lower(coalesce(_email,'')))
     OR (block_type = 'phone' AND value = coalesce(_phone,''))
     OR (block_type = 'sender_number' AND value = coalesce(_phone,''))
     OR (block_type = 'ip' AND value = coalesce(_ip,''))
      )
  );
$$;

GRANT EXECUTE ON FUNCTION public.check_fraud_block(UUID,TEXT,TEXT,TEXT) TO anon, authenticated;


-- >>> 20260701115251_4337d5a5-5c5c-47f4-a10d-44c337b620fa.sql

CREATE POLICY "Merchants upload own KYC"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'kyc' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "Merchants read own KYC"
  ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'kyc' AND (
      (storage.foldername(name))[1] = auth.uid()::text
      OR public.has_role(auth.uid(), 'super_admin')
    )
  );

CREATE POLICY "Merchants delete own KYC"
  ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'kyc' AND (storage.foldername(name))[1] = auth.uid()::text);


-- >>> 20260701120210_d14681f1-7e1d-4d81-a00d-32e74c1f6342.sql

-- Rate limit persistence
CREATE TABLE IF NOT EXISTS public.rate_limit_buckets (
  key_id UUID PRIMARY KEY REFERENCES public.api_keys(id) ON DELETE CASCADE,
  window_start TIMESTAMPTZ NOT NULL DEFAULT now(),
  count INT NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT ALL ON public.rate_limit_buckets TO service_role;
ALTER TABLE public.rate_limit_buckets ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service only" ON public.rate_limit_buckets FOR ALL USING (false) WITH CHECK (false);

-- Atomic rate-limit RPC: returns remaining count; -1 if blocked
CREATE OR REPLACE FUNCTION public.consume_rate_limit(_key_id UUID, _limit INT, _window_seconds INT)
RETURNS INT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  b public.rate_limit_buckets%ROWTYPE;
BEGIN
  INSERT INTO public.rate_limit_buckets(key_id, window_start, count)
  VALUES (_key_id, now(), 1)
  ON CONFLICT (key_id) DO UPDATE SET
    window_start = CASE WHEN public.rate_limit_buckets.window_start + (_window_seconds || ' seconds')::interval < now()
                        THEN now() ELSE public.rate_limit_buckets.window_start END,
    count = CASE WHEN public.rate_limit_buckets.window_start + (_window_seconds || ' seconds')::interval < now()
                 THEN 1 ELSE public.rate_limit_buckets.count + 1 END,
    updated_at = now()
  RETURNING * INTO b;

  IF b.count > _limit THEN
    RETURN -1;
  END IF;
  RETURN _limit - b.count;
END;
$$;

-- BYO Gateway credentials (encrypted at rest via app-level, stored as jsonb)
CREATE TABLE IF NOT EXISTS public.byo_gateways (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  merchant_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  provider TEXT NOT NULL CHECK (provider IN ('bkash','nagad','sslcommerz','stripe')),
  mode TEXT NOT NULL DEFAULT 'sandbox' CHECK (mode IN ('sandbox','live')),
  credentials JSONB NOT NULL DEFAULT '{}'::jsonb,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (merchant_id, provider)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.byo_gateways TO authenticated;
GRANT ALL ON public.byo_gateways TO service_role;
ALTER TABLE public.byo_gateways ENABLE ROW LEVEL SECURITY;
CREATE POLICY "merchant own byo" ON public.byo_gateways FOR ALL
  USING (auth.uid() = merchant_id) WITH CHECK (auth.uid() = merchant_id);

CREATE TRIGGER byo_gateways_updated_at BEFORE UPDATE ON public.byo_gateways
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


-- >>> 20260701120232_8a25f77a-0492-4f93-92f7-1ce46dacbac3.sql

REVOKE ALL ON FUNCTION public.consume_rate_limit(UUID, INT, INT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.consume_rate_limit(UUID, INT, INT) TO service_role;


-- >>> 20260701120337_d637d88d-efb3-472a-8bce-dcc31eed156a.sql

ALTER TABLE public.team_members ADD COLUMN IF NOT EXISTS member_user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;
CREATE INDEX IF NOT EXISTS idx_team_members_user ON public.team_members(member_user_id);

CREATE OR REPLACE FUNCTION public.activate_team_invites()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.team_members
     SET member_user_id = NEW.id, status = 'active'
   WHERE lower(member_email) = lower(NEW.email)
     AND status = 'pending';
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created_activate_invites ON auth.users;
CREATE TRIGGER on_auth_user_created_activate_invites
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.activate_team_invites();

-- Allow teammates to read their own memberships
DROP POLICY IF EXISTS "team read own memberships" ON public.team_members;
CREATE POLICY "team read own memberships" ON public.team_members
  FOR SELECT TO authenticated
  USING (member_user_id = auth.uid());


-- >>> 20260701121253_b678f2b9-7aed-43c8-8824-46f8c91c7fe7.sql

CREATE OR REPLACE FUNCTION public.effective_merchant_role(_user_id uuid, _merchant_id uuid)
RETURNS text LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT CASE
    WHEN _user_id = _merchant_id THEN 'owner'
    ELSE (SELECT role FROM public.team_members
           WHERE merchant_id = _merchant_id AND member_user_id = _user_id AND status = 'active' LIMIT 1)
  END;
$$;

CREATE OR REPLACE FUNCTION public.merchant_can(_user_id uuid, _merchant_id uuid, _min_role text)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  WITH r AS (SELECT public.effective_merchant_role(_user_id, _merchant_id) AS role)
  SELECT CASE (SELECT role FROM r)
    WHEN 'owner'    THEN true
    WHEN 'admin'    THEN _min_role IN ('viewer','operator','admin')
    WHEN 'operator' THEN _min_role IN ('viewer','operator')
    WHEN 'viewer'   THEN _min_role = 'viewer'
    ELSE false
  END;
$$;

CREATE POLICY "team can view invoices"          ON public.invoices          FOR SELECT TO authenticated
  USING (public.merchant_can(auth.uid(), merchant_id, 'viewer'));
CREATE POLICY "team can view transactions"      ON public.transactions      FOR SELECT TO authenticated
  USING (public.merchant_can(auth.uid(), merchant_id, 'viewer'));
CREATE POLICY "team can view payment_methods"   ON public.payment_methods   FOR SELECT TO authenticated
  USING (public.merchant_can(auth.uid(), merchant_id, 'viewer'));
CREATE POLICY "team can view payouts"           ON public.payouts           FOR SELECT TO authenticated
  USING (public.merchant_can(auth.uid(), merchant_id, 'viewer'));
CREATE POLICY "team can view webhook_endpoints" ON public.webhook_endpoints FOR SELECT TO authenticated
  USING (public.merchant_can(auth.uid(), merchant_id, 'viewer'));
CREATE POLICY "team can view api_keys"          ON public.api_keys          FOR SELECT TO authenticated
  USING (public.merchant_can(auth.uid(), merchant_id, 'admin'));

CREATE POLICY "operators update transactions" ON public.transactions FOR UPDATE TO authenticated
  USING (public.merchant_can(auth.uid(), merchant_id, 'operator'))
  WITH CHECK (public.merchant_can(auth.uid(), merchant_id, 'operator'));
CREATE POLICY "operators update invoices"     ON public.invoices     FOR UPDATE TO authenticated
  USING (public.merchant_can(auth.uid(), merchant_id, 'operator'))
  WITH CHECK (public.merchant_can(auth.uid(), merchant_id, 'operator'));
CREATE POLICY "operators insert invoices"     ON public.invoices     FOR INSERT TO authenticated
  WITH CHECK (public.merchant_can(auth.uid(), merchant_id, 'operator'));

CREATE POLICY "admins manage methods"    ON public.payment_methods   FOR ALL TO authenticated
  USING (public.merchant_can(auth.uid(), merchant_id, 'admin'))
  WITH CHECK (public.merchant_can(auth.uid(), merchant_id, 'admin'));
CREATE POLICY "admins manage webhooks"   ON public.webhook_endpoints FOR ALL TO authenticated
  USING (public.merchant_can(auth.uid(), merchant_id, 'admin'))
  WITH CHECK (public.merchant_can(auth.uid(), merchant_id, 'admin'));
CREATE POLICY "admins manage api_keys"   ON public.api_keys          FOR ALL TO authenticated
  USING (public.merchant_can(auth.uid(), merchant_id, 'admin'))
  WITH CHECK (public.merchant_can(auth.uid(), merchant_id, 'admin'));


-- >>> 20260701121533_9df1dcd3-8e22-4934-9b58-9ec07882b67c.sql

CREATE TABLE public.idempotency_keys (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  merchant_id UUID NOT NULL,
  key TEXT NOT NULL,
  method TEXT NOT NULL,
  path TEXT NOT NULL,
  request_hash TEXT NOT NULL,
  status_code INT NOT NULL,
  response_body JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (merchant_id, key, method, path)
);

GRANT ALL ON public.idempotency_keys TO service_role;

ALTER TABLE public.idempotency_keys ENABLE ROW LEVEL SECURITY;

CREATE POLICY "no client access" ON public.idempotency_keys FOR ALL USING (false) WITH CHECK (false);

CREATE INDEX idempotency_keys_created_idx ON public.idempotency_keys (created_at);


-- >>> 20260701122009_0bf415a9-c48c-462b-9547-cec777778e4e.sql

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


-- >>> 20260701122256_dd2cbf88-6bdb-4a25-9979-e71df064a269.sql

ALTER TABLE public.invoices ADD COLUMN IF NOT EXISTS mode text NOT NULL DEFAULT 'live' CHECK (mode IN ('live','test'));
ALTER TABLE public.transactions ADD COLUMN IF NOT EXISTS mode text NOT NULL DEFAULT 'live' CHECK (mode IN ('live','test'));
ALTER TABLE public.webhook_endpoints ADD COLUMN IF NOT EXISTS mode text NOT NULL DEFAULT 'live' CHECK (mode IN ('live','test'));
CREATE INDEX IF NOT EXISTS idx_invoices_merchant_mode ON public.invoices(merchant_id, mode);
CREATE INDEX IF NOT EXISTS idx_transactions_merchant_mode ON public.transactions(merchant_id, mode);

DROP VIEW IF EXISTS public.checkout_invoices CASCADE;
CREATE VIEW public.checkout_invoices
WITH (security_invoker = true)
AS
SELECT id, merchant_id, invoice_number, amount, currency, status, customer_name,
       customer_email, customer_phone, description, redirect_url, metadata,
       expires_at, created_at, paid_at, mode
FROM public.invoices;
GRANT SELECT ON public.checkout_invoices TO anon, authenticated;


-- >>> 20260701122326_144d5286-4c2b-446d-b6df-a5e765807684.sql

DROP VIEW IF EXISTS public.checkout_invoices CASCADE;
CREATE VIEW public.checkout_invoices
WITH (security_invoker = true)
AS
SELECT id, merchant_id, invoice_number, amount, currency, status,
       method_id, method_type,
       customer_name, customer_email, customer_phone, description,
       redirect_url, metadata, expires_at, created_at, paid_at, mode
FROM public.invoices;
GRANT SELECT ON public.checkout_invoices TO anon, authenticated;


-- >>> 20260701122924_d773a0b5-8a3c-4658-9280-045716977e6a.sql

-- Task 7: Security scan — lock down anon access to base tables.
-- Replace broad anon SELECT policies with SECURITY DEFINER RPCs scoped by invoice id / merchant id.

DROP POLICY IF EXISTS "Public can view checkout branding" ON public.profiles;
DROP POLICY IF EXISTS "Public read pending invoices" ON public.invoices;
DROP POLICY IF EXISTS "Public read invoice transactions" ON public.transactions;

-- Scoped RPCs (require caller to know the invoice UUID).
CREATE OR REPLACE FUNCTION public.get_checkout_invoice(_id uuid)
RETURNS TABLE (
  id uuid, merchant_id uuid, invoice_number text, amount numeric, currency text,
  status invoice_status, method_id uuid, method_type text, customer_name text,
  customer_email text, customer_phone text, description text, redirect_url text,
  metadata jsonb, expires_at timestamptz, created_at timestamptz, paid_at timestamptz, mode text
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT id, merchant_id, invoice_number, amount, currency, status, method_id,
         method_type::text, customer_name, customer_email, customer_phone,
         description, redirect_url, metadata, expires_at, created_at, paid_at, mode::text
  FROM public.invoices
  WHERE id = _id
    AND status IN ('pending','processing','completed','expired','failed')
  LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.get_checkout_methods(_merchant_id uuid)
RETURNS SETOF public.payment_methods
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT * FROM public.payment_methods
  WHERE merchant_id = _merchant_id AND is_active = true
  ORDER BY sort_order ASC;
$$;

CREATE OR REPLACE FUNCTION public.get_checkout_brand(_merchant_id uuid)
RETURNS TABLE (
  merchant_id uuid, business_name text, brand_color text,
  logo_url text, support_email text, checkout_footer text
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT id, business_name, brand_color, logo_url, support_email, checkout_footer
  FROM public.profiles WHERE id = _merchant_id LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.get_checkout_transactions(_invoice_id uuid)
RETURNS TABLE (
  id uuid, status transaction_status, method_type text, gross_amount numeric,
  provider_txn_id text, reference text, created_at timestamptz,
  verified_at timestamptz, note text
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT id, status, method_type::text, gross_amount, provider_txn_id, reference,
         created_at, verified_at, note
  FROM public.transactions WHERE invoice_id = _invoice_id
  ORDER BY created_at DESC;
$$;

REVOKE ALL ON FUNCTION public.get_checkout_invoice(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_checkout_methods(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_checkout_brand(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_checkout_transactions(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_checkout_invoice(uuid) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_checkout_methods(uuid) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_checkout_brand(uuid) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_checkout_transactions(uuid) TO anon, authenticated;


-- >>> 20260701123828_dfda9dfb-e5b5-462b-8a74-3dea5308b124.sql

CREATE TABLE IF NOT EXISTS public.incidents (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  body TEXT,
  severity TEXT NOT NULL DEFAULT 'minor' CHECK (severity IN ('minor','major','critical')),
  status TEXT NOT NULL DEFAULT 'investigating' CHECK (status IN ('investigating','identified','monitoring','resolved')),
  components TEXT[] NOT NULL DEFAULT '{}',
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  resolved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT ON public.incidents TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.incidents TO authenticated;
GRANT ALL ON public.incidents TO service_role;

ALTER TABLE public.incidents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Incidents are public" ON public.incidents FOR SELECT USING (true);
CREATE POLICY "Super admins manage incidents" ON public.incidents FOR ALL
  USING (public.has_role(auth.uid(), 'super_admin'))
  WITH CHECK (public.has_role(auth.uid(), 'super_admin'));

CREATE TRIGGER update_incidents_updated_at BEFORE UPDATE ON public.incidents
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX IF NOT EXISTS idx_incidents_started ON public.incidents(started_at DESC);


-- >>> 20260701124254_e0f75570-ff94-4cc7-bcfd-bf04e0b30512.sql

CREATE TABLE public.api_request_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  merchant_id uuid NOT NULL,
  api_key_id uuid,
  method text NOT NULL,
  path text NOT NULL,
  status_code integer NOT NULL,
  latency_ms integer NOT NULL,
  ip_address text,
  user_agent text,
  error_message text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX api_request_logs_merchant_created_idx ON public.api_request_logs (merchant_id, created_at DESC);

GRANT SELECT ON public.api_request_logs TO authenticated;
GRANT ALL ON public.api_request_logs TO service_role;

ALTER TABLE public.api_request_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Merchant reads own api logs"
ON public.api_request_logs FOR SELECT
TO authenticated
USING (public.merchant_can(auth.uid(), merchant_id, 'viewer'));

CREATE POLICY "Super admin reads all api logs"
ON public.api_request_logs FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'super_admin'));


-- >>> 20260701124649_4a4516c9-7f5d-4f9d-97db-83403b42e5e4.sql

CREATE OR REPLACE FUNCTION public.get_customer_invoices(_email text, _invoice_number text)
RETURNS TABLE(
  id uuid,
  invoice_number text,
  amount numeric,
  currency text,
  status invoice_status,
  description text,
  created_at timestamp with time zone,
  paid_at timestamp with time zone,
  expires_at timestamp with time zone,
  business_name text
)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  WITH proof AS (
    SELECT i.customer_email
    FROM public.invoices i
    WHERE lower(i.customer_email) = lower(_email)
      AND i.invoice_number = _invoice_number
    LIMIT 1
  )
  SELECT i.id, i.invoice_number, i.amount, i.currency, i.status,
         i.description, i.created_at, i.paid_at, i.expires_at,
         p.business_name
  FROM public.invoices i
  LEFT JOIN public.profiles p ON p.id = i.merchant_id
  WHERE EXISTS (SELECT 1 FROM proof)
    AND lower(i.customer_email) = lower(_email)
  ORDER BY i.created_at DESC
  LIMIT 200;
$$;

GRANT EXECUTE ON FUNCTION public.get_customer_invoices(text, text) TO anon, authenticated;


-- >>> 20260701124840_1a60a1d3-2e82-413d-9e03-b0e975336838.sql

CREATE TABLE public.recurring_schedules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  merchant_id uuid NOT NULL,
  name text NOT NULL,
  amount numeric NOT NULL CHECK (amount > 0),
  currency text NOT NULL DEFAULT 'BDT',
  customer_name text,
  customer_email text,
  customer_phone text,
  description text,
  redirect_url text,
  interval_unit text NOT NULL CHECK (interval_unit IN ('day','week','month')),
  interval_count integer NOT NULL DEFAULT 1 CHECK (interval_count > 0),
  next_run_at timestamptz NOT NULL,
  last_run_at timestamptz,
  mode text NOT NULL DEFAULT 'live' CHECK (mode IN ('live','test')),
  is_active boolean NOT NULL DEFAULT true,
  runs_count integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.recurring_schedules TO authenticated;
GRANT ALL ON public.recurring_schedules TO service_role;

ALTER TABLE public.recurring_schedules ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Merchant team can view schedules"
  ON public.recurring_schedules FOR SELECT TO authenticated
  USING (public.merchant_can(auth.uid(), merchant_id, 'viewer'));

CREATE POLICY "Merchant operators can insert schedules"
  ON public.recurring_schedules FOR INSERT TO authenticated
  WITH CHECK (public.merchant_can(auth.uid(), merchant_id, 'operator'));

CREATE POLICY "Merchant operators can update schedules"
  ON public.recurring_schedules FOR UPDATE TO authenticated
  USING (public.merchant_can(auth.uid(), merchant_id, 'operator'))
  WITH CHECK (public.merchant_can(auth.uid(), merchant_id, 'operator'));

CREATE POLICY "Merchant admins can delete schedules"
  ON public.recurring_schedules FOR DELETE TO authenticated
  USING (public.merchant_can(auth.uid(), merchant_id, 'admin'));

CREATE TRIGGER update_recurring_schedules_updated_at
  BEFORE UPDATE ON public.recurring_schedules
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX idx_recurring_due
  ON public.recurring_schedules (next_run_at)
  WHERE is_active = true;


-- >>> 20260701151134_85b76d9d-b18c-4e3e-9b50-b0ef95b4141e.sql

-- 1. Public profile fields
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS slug TEXT UNIQUE,
  ADD COLUMN IF NOT EXISTS public_bio TEXT,
  ADD COLUMN IF NOT EXISTS accept_tips BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS tip_min_amount NUMERIC NOT NULL DEFAULT 10;

CREATE OR REPLACE FUNCTION public.get_public_merchant(_slug TEXT)
RETURNS TABLE(id UUID, business_name TEXT, brand_color TEXT, logo_url TEXT,
              public_bio TEXT, accept_tips BOOLEAN, tip_min_amount NUMERIC,
              support_email TEXT, slug TEXT)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT id, business_name, brand_color, logo_url, public_bio, accept_tips,
         tip_min_amount, support_email, slug
  FROM public.profiles WHERE slug = _slug LIMIT 1;
$$;

-- 2. Digest settings
CREATE TABLE IF NOT EXISTS public.digest_settings (
  merchant_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  frequency TEXT NOT NULL DEFAULT 'daily' CHECK (frequency IN ('daily','weekly','off')),
  enabled BOOLEAN NOT NULL DEFAULT true,
  last_sent_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.digest_settings TO authenticated;
GRANT ALL ON public.digest_settings TO service_role;
ALTER TABLE public.digest_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own digest" ON public.digest_settings FOR ALL
  USING (auth.uid() = merchant_id) WITH CHECK (auth.uid() = merchant_id);

-- 3. Payout auto-schedules
CREATE TABLE IF NOT EXISTS public.payout_schedules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  merchant_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  frequency TEXT NOT NULL CHECK (frequency IN ('weekly','monthly')),
  min_amount NUMERIC NOT NULL DEFAULT 100,
  method TEXT NOT NULL,
  account_number TEXT NOT NULL,
  account_name TEXT,
  next_run_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  enabled BOOLEAN NOT NULL DEFAULT true,
  last_run_at TIMESTAMPTZ,
  runs_count INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.payout_schedules TO authenticated;
GRANT ALL ON public.payout_schedules TO service_role;
ALTER TABLE public.payout_schedules ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own payout schedule" ON public.payout_schedules FOR ALL
  USING (auth.uid() = merchant_id) WITH CHECK (auth.uid() = merchant_id);

-- 4. Discount codes
CREATE TABLE IF NOT EXISTS public.discount_codes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  merchant_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  code TEXT NOT NULL,
  discount_type TEXT NOT NULL CHECK (discount_type IN ('percent','flat')),
  value NUMERIC NOT NULL CHECK (value > 0),
  max_uses INT,
  uses_count INT NOT NULL DEFAULT 0,
  expires_at TIMESTAMPTZ,
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (merchant_id, code)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.discount_codes TO authenticated;
GRANT ALL ON public.discount_codes TO service_role;
ALTER TABLE public.discount_codes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own discount codes" ON public.discount_codes FOR ALL
  USING (auth.uid() = merchant_id) WITH CHECK (auth.uid() = merchant_id);

ALTER TABLE public.invoices
  ADD COLUMN IF NOT EXISTS discount_code TEXT,
  ADD COLUMN IF NOT EXISTS discount_amount NUMERIC NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS display_currency TEXT;

CREATE OR REPLACE FUNCTION public.apply_discount_code(_invoice_id UUID, _code TEXT)
RETURNS TABLE(ok BOOLEAN, message TEXT, new_amount NUMERIC, discount NUMERIC)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  inv public.invoices%ROWTYPE;
  dc  public.discount_codes%ROWTYPE;
  disc NUMERIC := 0;
  base NUMERIC;
BEGIN
  SELECT * INTO inv FROM public.invoices WHERE id = _invoice_id;
  IF NOT FOUND OR inv.status <> 'pending' THEN
    RETURN QUERY SELECT false, 'Invoice not available', 0::numeric, 0::numeric; RETURN;
  END IF;
  SELECT * INTO dc FROM public.discount_codes
    WHERE merchant_id = inv.merchant_id AND lower(code) = lower(_code) AND active = true;
  IF NOT FOUND THEN
    RETURN QUERY SELECT false, 'Invalid code', inv.amount, 0::numeric; RETURN;
  END IF;
  IF dc.expires_at IS NOT NULL AND dc.expires_at < now() THEN
    RETURN QUERY SELECT false, 'Code expired', inv.amount, 0::numeric; RETURN;
  END IF;
  IF dc.max_uses IS NOT NULL AND dc.uses_count >= dc.max_uses THEN
    RETURN QUERY SELECT false, 'Code exhausted', inv.amount, 0::numeric; RETURN;
  END IF;
  base := inv.amount + inv.discount_amount;
  IF dc.discount_type = 'percent' THEN disc := round(base * dc.value / 100, 2);
  ELSE disc := least(dc.value, base); END IF;
  UPDATE public.invoices SET discount_code = dc.code, discount_amount = disc,
    amount = base - disc WHERE id = inv.id;
  UPDATE public.discount_codes SET uses_count = uses_count + 1 WHERE id = dc.id;
  RETURN QUERY SELECT true, 'Applied', base - disc, disc;
END; $$;

-- 5. Disputes
CREATE TABLE IF NOT EXISTS public.disputes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  merchant_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  invoice_id UUID NOT NULL REFERENCES public.invoices(id) ON DELETE CASCADE,
  reason TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open','under_review','won','lost','withdrawn')),
  evidence_url TEXT,
  merchant_note TEXT,
  admin_note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.disputes TO authenticated;
GRANT ALL ON public.disputes TO service_role;
ALTER TABLE public.disputes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "disputes view" ON public.disputes FOR SELECT
  USING (auth.uid() = merchant_id OR public.has_role(auth.uid(), 'super_admin'));
CREATE POLICY "disputes insert" ON public.disputes FOR INSERT
  WITH CHECK (auth.uid() = merchant_id);
CREATE POLICY "disputes update" ON public.disputes FOR UPDATE
  USING (auth.uid() = merchant_id OR public.has_role(auth.uid(), 'super_admin'));

-- Storage policies for disputes bucket
DO $$ BEGIN
  CREATE POLICY "own dispute upload" ON storage.objects FOR INSERT TO authenticated
    WITH CHECK (bucket_id = 'disputes' AND auth.uid()::text = (storage.foldername(name))[1]);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE POLICY "own dispute read" ON storage.objects FOR SELECT TO authenticated
    USING (bucket_id = 'disputes' AND (auth.uid()::text = (storage.foldername(name))[1]
      OR public.has_role(auth.uid(), 'super_admin')));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- 6. Slack/Discord in notification_settings
ALTER TABLE public.notification_settings
  ADD COLUMN IF NOT EXISTS slack_webhook_url TEXT,
  ADD COLUMN IF NOT EXISTS discord_webhook_url TEXT;

-- 7. updated_at triggers
DO $$ BEGIN
  CREATE TRIGGER trg_digest_updated BEFORE UPDATE ON public.digest_settings
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE TRIGGER trg_payout_sched_updated BEFORE UPDATE ON public.payout_schedules
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE TRIGGER trg_discount_updated BEFORE UPDATE ON public.discount_codes
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE TRIGGER trg_disputes_updated BEFORE UPDATE ON public.disputes
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- 8. Cron jobs
DO $$ BEGIN PERFORM cron.unschedule('run-email-digest'); EXCEPTION WHEN OTHERS THEN NULL; END $$;
DO $$ BEGIN PERFORM cron.unschedule('run-payout-schedule'); EXCEPTION WHEN OTHERS THEN NULL; END $$;

SELECT cron.schedule(
  'run-email-digest', '0 * * * *',
  $CRON$
  SELECT net.http_post(
    url:='https://project--5e8aeca1-b0e0-4f04-9f05-437907e3e8bb.lovable.app/api/public/hooks/run-digest',
    headers:='{"Content-Type":"application/json","apikey":"eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNqYmlpbnRvenRpdGtjd2pld3FxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODI4OTUzMzcsImV4cCI6MjA5ODQ3MTMzN30.dQBfK9Aa1VzBSCbxOiJDP5phuFK1w5BgVmJH9HGA5Ug"}'::jsonb,
    body:='{}'::jsonb);
  $CRON$
);

SELECT cron.schedule(
  'run-payout-schedule', '*/30 * * * *',
  $CRON$
  SELECT net.http_post(
    url:='https://project--5e8aeca1-b0e0-4f04-9f05-437907e3e8bb.lovable.app/api/public/hooks/run-payout-schedule',
    headers:='{"Content-Type":"application/json","apikey":"eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNqYmlpbnRvenRpdGtjd2pld3FxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODI4OTUzMzcsImV4cCI6MjA5ODQ3MTMzN30.dQBfK9Aa1VzBSCbxOiJDP5phuFK1w5BgVmJH9HGA5Ug"}'::jsonb,
    body:='{}'::jsonb);
  $CRON$
);


-- =============================================================
-- PayNOC — Addendum (2026-07-02 → 2026-07-08)
-- Idempotent: safe to re-run. Adds: merchant_fx_rates, admin_staff,
-- KYC fields, impersonation_events, platform_gateways, webhook_events,
-- payment_methods gateway columns, team_members.permissions, and the
-- updated handle_new_user() trigger that honours verification_mode.
-- =============================================================

-- ---- Merchant-specific FX overrides ------------------------------------
CREATE TABLE IF NOT EXISTS public.merchant_fx_rates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  merchant_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  base_currency TEXT NOT NULL,
  quote_currency TEXT NOT NULL,
  rate NUMERIC NOT NULL CHECK (rate > 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (merchant_id, base_currency, quote_currency)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.merchant_fx_rates TO authenticated;
GRANT SELECT ON public.merchant_fx_rates TO anon;
GRANT ALL ON public.merchant_fx_rates TO service_role;
ALTER TABLE public.merchant_fx_rates ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "merchant manage own fx" ON public.merchant_fx_rates;
CREATE POLICY "merchant manage own fx" ON public.merchant_fx_rates
  FOR ALL TO authenticated
  USING (merchant_id = auth.uid() OR public.has_role(auth.uid(), 'super_admin'))
  WITH CHECK (merchant_id = auth.uid() OR public.has_role(auth.uid(), 'super_admin'));
DROP POLICY IF EXISTS "public read merchant fx" ON public.merchant_fx_rates;
CREATE POLICY "public read merchant fx" ON public.merchant_fx_rates
  FOR SELECT TO anon USING (true);
DO $$ BEGIN
  CREATE TRIGGER trg_merchant_fx_updated BEFORE UPDATE ON public.merchant_fx_rates
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE OR REPLACE FUNCTION public.get_effective_fx_rate(
  _merchant_id UUID, _base TEXT, _quote TEXT
) RETURNS NUMERIC
LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT COALESCE(
    (SELECT rate FROM public.merchant_fx_rates
       WHERE merchant_id = _merchant_id
         AND upper(base_currency) = upper(_base)
         AND upper(quote_currency) = upper(_quote) LIMIT 1),
    (SELECT rate FROM public.fx_rates
       WHERE upper(base_currency) = upper(_base)
         AND upper(quote_currency) = upper(_quote) LIMIT 1)
  );
$$;

-- ---- Merchant team: checkbox-based permissions -------------------------
ALTER TABLE public.team_members
  ADD COLUMN IF NOT EXISTS permissions TEXT[] NOT NULL DEFAULT '{}';

-- ---- Admin office staff (super_admin managed) --------------------------
CREATE TABLE IF NOT EXISTS public.admin_staff (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT NOT NULL UNIQUE,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT,
  permissions TEXT[] NOT NULL DEFAULT '{}',
  status TEXT NOT NULL DEFAULT 'invited' CHECK (status IN ('invited','active','disabled')),
  invited_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.admin_staff TO authenticated;
GRANT ALL ON public.admin_staff TO service_role;
ALTER TABLE public.admin_staff ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "super_admin manages admin_staff" ON public.admin_staff;
CREATE POLICY "super_admin manages admin_staff" ON public.admin_staff
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'super_admin'))
  WITH CHECK (public.has_role(auth.uid(), 'super_admin'));
DROP POLICY IF EXISTS "staff read own row" ON public.admin_staff;
CREATE POLICY "staff read own row" ON public.admin_staff
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());
DO $$ BEGIN
  CREATE TRIGGER trg_admin_staff_updated BEFORE UPDATE ON public.admin_staff
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE OR REPLACE FUNCTION public.is_admin_office(_user_id UUID)
RETURNS BOOLEAN LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT public.has_role(_user_id, 'super_admin')
      OR EXISTS (SELECT 1 FROM public.admin_staff
                  WHERE user_id = _user_id AND status = 'active');
$$;

CREATE OR REPLACE FUNCTION public.admin_has_perm(_user_id UUID, _perm TEXT)
RETURNS BOOLEAN LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT public.has_role(_user_id, 'super_admin')
      OR EXISTS (SELECT 1 FROM public.admin_staff
                  WHERE user_id = _user_id AND status = 'active'
                    AND _perm = ANY(permissions));
$$;

CREATE OR REPLACE FUNCTION public.merchant_has_perm(_user_id UUID, _merchant_id UUID, _perm TEXT)
RETURNS BOOLEAN LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT _user_id = _merchant_id
      OR EXISTS (SELECT 1 FROM public.team_members
                  WHERE merchant_id = _merchant_id AND member_user_id = _user_id
                    AND status = 'active'
                    AND _perm = ANY(permissions));
$$;

CREATE OR REPLACE FUNCTION public.activate_admin_staff()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  UPDATE public.admin_staff
     SET user_id = NEW.id, status = 'active'
   WHERE lower(email) = lower(NEW.email) AND status = 'invited';
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created_admin_staff ON auth.users;
CREATE TRIGGER on_auth_user_created_admin_staff
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.activate_admin_staff();

-- Lock down helper functions (SECURITY DEFINER stays callable via RLS)
REVOKE ALL ON FUNCTION public.is_admin_office(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_admin_office(UUID) TO authenticated, service_role;
REVOKE ALL ON FUNCTION public.admin_has_perm(UUID, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_has_perm(UUID, TEXT) TO authenticated, service_role;
REVOKE ALL ON FUNCTION public.merchant_has_perm(UUID, UUID, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.merchant_has_perm(UUID, UUID, TEXT) TO authenticated, service_role;
REVOKE EXECUTE ON FUNCTION public.activate_admin_staff() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_effective_fx_rate(UUID, TEXT, TEXT) TO authenticated, anon, service_role;

-- ---- KYC on profiles ---------------------------------------------------
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS kyc_status TEXT NOT NULL DEFAULT 'unverified'
    CHECK (kyc_status IN ('unverified','pending','verified','rejected')),
  ADD COLUMN IF NOT EXISTS kyc_documents JSONB NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS kyc_id_type TEXT,
  ADD COLUMN IF NOT EXISTS kyc_id_number TEXT,
  ADD COLUMN IF NOT EXISTS kyc_business_type TEXT,
  ADD COLUMN IF NOT EXISTS kyc_address TEXT,
  ADD COLUMN IF NOT EXISTS kyc_submitted_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS kyc_reviewed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS kyc_reviewer_note TEXT;

-- ---- Verification mode toggle -----------------------------------------
ALTER TABLE public.platform_settings
  ADD COLUMN IF NOT EXISTS verification_mode TEXT NOT NULL DEFAULT 'manual'
    CHECK (verification_mode IN ('auto','manual'));

-- ---- Impersonation audit ----------------------------------------------
CREATE TABLE IF NOT EXISTS public.impersonation_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  admin_email TEXT NOT NULL,
  target_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  target_email TEXT NOT NULL,
  reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.impersonation_events TO authenticated;
GRANT ALL ON public.impersonation_events TO service_role;
ALTER TABLE public.impersonation_events ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "super_admin sees impersonation" ON public.impersonation_events;
CREATE POLICY "super_admin sees impersonation" ON public.impersonation_events
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'super_admin'));
DROP POLICY IF EXISTS "super_admin writes impersonation" ON public.impersonation_events;
CREATE POLICY "super_admin writes impersonation" ON public.impersonation_events
  FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'super_admin'));

-- ---- Updated signup trigger (honours verification_mode) ---------------
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _mode TEXT;
BEGIN
  SELECT verification_mode INTO _mode FROM public.platform_settings WHERE id = 1;
  INSERT INTO public.profiles (id, email, full_name, business_name, phone, kyc_status)
  VALUES (
    NEW.id,
    NEW.email,
    NEW.raw_user_meta_data->>'full_name',
    NEW.raw_user_meta_data->>'business_name',
    NEW.raw_user_meta_data->>'phone',
    CASE WHEN _mode = 'auto' THEN 'verified' ELSE 'unverified' END
  );
  INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'merchant');
  RETURN NEW;
END;
$$;

-- ---- BYO providers: widen the allow-list -------------------------------
ALTER TABLE public.byo_gateways DROP CONSTRAINT IF EXISTS byo_gateways_provider_check;
ALTER TABLE public.byo_gateways ADD CONSTRAINT byo_gateways_provider_check CHECK (provider = ANY (ARRAY[
  'bkash','nagad','rocket','sslcommerz','shurjopay','aamarpay',
  'stripe','paypal','razorpay','paddle','twocheckout',
  'coinbase_commerce','nowpayments','binance_pay',
  'uddoktapay','piprapay','ownpay'
]));

-- ---- Platform-wide gateways (super-admin managed) ---------------------
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
DROP POLICY IF EXISTS "super admin manage platform gateways" ON public.platform_gateways;
CREATE POLICY "super admin manage platform gateways"
  ON public.platform_gateways FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'super_admin'))
  WITH CHECK (public.has_role(auth.uid(), 'super_admin'));
DROP POLICY IF EXISTS "merchants view enabled platform gateways" ON public.platform_gateways;
CREATE POLICY "merchants view enabled platform gateways"
  ON public.platform_gateways FOR SELECT TO authenticated
  USING (is_enabled_for_merchants = true AND is_active = true);
DO $$ BEGIN
  CREATE TRIGGER trg_platform_gateways_upd BEFORE UPDATE ON public.platform_gateways
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ---- Webhook events audit ---------------------------------------------
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
DROP POLICY IF EXISTS "merchant view own webhook events" ON public.webhook_events;
CREATE POLICY "merchant view own webhook events"
  ON public.webhook_events FOR SELECT TO authenticated
  USING (merchant_id = auth.uid() OR public.has_role(auth.uid(), 'super_admin'));
CREATE INDEX IF NOT EXISTS idx_webhook_events_merchant ON public.webhook_events(merchant_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_webhook_events_provider ON public.webhook_events(provider, created_at DESC);

-- ---- Gateway pointer columns on payment_methods -----------------------
ALTER TABLE public.payment_methods
  ADD COLUMN IF NOT EXISTS gateway_provider TEXT,
  ADD COLUMN IF NOT EXISTS gateway_source TEXT DEFAULT 'manual'
    CHECK (gateway_source IN ('manual','byo','platform'));

-- ---- Seed platform_settings row so verification_mode is readable ------
INSERT INTO public.platform_settings (id) VALUES (1)
ON CONFLICT (id) DO NOTHING;

-- =============================================================
-- End addendum
-- =============================================================
