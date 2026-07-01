
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
