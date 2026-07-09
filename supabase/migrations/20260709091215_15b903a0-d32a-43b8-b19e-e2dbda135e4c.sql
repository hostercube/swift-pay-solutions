
DO $$ BEGIN
  CREATE TYPE public.refund_status AS ENUM ('requested','approved','processed','rejected');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS public.refunds (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  merchant_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  invoice_id uuid NOT NULL REFERENCES public.invoices(id) ON DELETE CASCADE,
  amount numeric(14,2) NOT NULL CHECK (amount > 0),
  currency text NOT NULL,
  reason text,
  status public.refund_status NOT NULL DEFAULT 'requested',
  admin_note text,
  processed_at timestamptz,
  processed_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  requested_via text NOT NULL DEFAULT 'dashboard',
  api_key_id uuid REFERENCES public.api_keys(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS refunds_merchant_idx ON public.refunds(merchant_id, created_at DESC);
CREATE INDEX IF NOT EXISTS refunds_invoice_idx ON public.refunds(invoice_id);

GRANT SELECT, INSERT, UPDATE ON public.refunds TO authenticated;
GRANT ALL ON public.refunds TO service_role;

ALTER TABLE public.refunds ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Merchants view own refunds" ON public.refunds;
CREATE POLICY "Merchants view own refunds" ON public.refunds FOR SELECT TO authenticated
  USING (
    auth.uid() = merchant_id
    OR public.merchant_can(auth.uid(), merchant_id, 'viewer')
    OR public.has_role(auth.uid(), 'super_admin')
    OR public.admin_has_perm(auth.uid(), 'payouts')
  );

DROP POLICY IF EXISTS "Merchants create refunds" ON public.refunds;
CREATE POLICY "Merchants create refunds" ON public.refunds FOR INSERT TO authenticated
  WITH CHECK (
    auth.uid() = merchant_id
    OR public.merchant_can(auth.uid(), merchant_id, 'operator')
  );

DROP POLICY IF EXISTS "Admins update refunds" ON public.refunds;
CREATE POLICY "Admins update refunds" ON public.refunds FOR UPDATE TO authenticated
  USING (
    public.has_role(auth.uid(), 'super_admin')
    OR public.admin_has_perm(auth.uid(), 'payouts')
  )
  WITH CHECK (
    public.has_role(auth.uid(), 'super_admin')
    OR public.admin_has_perm(auth.uid(), 'payouts')
  );

DROP TRIGGER IF EXISTS refunds_updated_at ON public.refunds;
CREATE TRIGGER refunds_updated_at BEFORE UPDATE ON public.refunds
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
