
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
