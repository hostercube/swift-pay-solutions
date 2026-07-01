
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
