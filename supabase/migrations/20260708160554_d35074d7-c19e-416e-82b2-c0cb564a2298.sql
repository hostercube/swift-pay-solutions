
-- Enums
DO $$ BEGIN
  CREATE TYPE public.billing_cycle AS ENUM ('monthly','yearly','lifetime');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.subscription_status AS ENUM ('trialing','active','expired','cancelled');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Packages
CREATE TABLE IF NOT EXISTS public.subscription_packages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  slug text NOT NULL UNIQUE,
  description text,
  price numeric(12,2) NOT NULL DEFAULT 0,
  currency text NOT NULL DEFAULT 'BDT',
  billing_cycle public.billing_cycle NOT NULL DEFAULT 'monthly',
  trial_days integer NOT NULL DEFAULT 0,
  features jsonb NOT NULL DEFAULT '[]'::jsonb,
  limits jsonb NOT NULL DEFAULT '{}'::jsonb,
  permissions text[] NOT NULL DEFAULT '{}'::text[],
  is_active boolean NOT NULL DEFAULT true,
  is_public boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.subscription_packages TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.subscription_packages TO authenticated;
GRANT ALL ON public.subscription_packages TO service_role;

ALTER TABLE public.subscription_packages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view active public packages"
  ON public.subscription_packages FOR SELECT
  USING (is_active AND is_public);

CREATE POLICY "Admin office can view all packages"
  ON public.subscription_packages FOR SELECT TO authenticated
  USING (public.is_admin_office(auth.uid()));

CREATE POLICY "Admin office can manage packages"
  ON public.subscription_packages FOR ALL TO authenticated
  USING (public.admin_has_perm(auth.uid(), 'packages'))
  WITH CHECK (public.admin_has_perm(auth.uid(), 'packages'));

CREATE TRIGGER trg_subscription_packages_updated
  BEFORE UPDATE ON public.subscription_packages
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Merchant subscriptions
CREATE TABLE IF NOT EXISTS public.merchant_subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  merchant_id uuid NOT NULL,
  package_id uuid NOT NULL REFERENCES public.subscription_packages(id) ON DELETE RESTRICT,
  status public.subscription_status NOT NULL DEFAULT 'active',
  started_at timestamptz NOT NULL DEFAULT now(),
  current_period_start timestamptz NOT NULL DEFAULT now(),
  current_period_end timestamptz,
  trial_ends_at timestamptz,
  cancelled_at timestamptz,
  auto_renew boolean NOT NULL DEFAULT true,
  last_renewed_at timestamptz,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_active_sub_per_merchant
  ON public.merchant_subscriptions(merchant_id)
  WHERE status IN ('trialing','active');

GRANT SELECT, INSERT, UPDATE, DELETE ON public.merchant_subscriptions TO authenticated;
GRANT ALL ON public.merchant_subscriptions TO service_role;

ALTER TABLE public.merchant_subscriptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Merchant can view own subscription"
  ON public.merchant_subscriptions FOR SELECT TO authenticated
  USING (auth.uid() = merchant_id);

CREATE POLICY "Admin office can view all subscriptions"
  ON public.merchant_subscriptions FOR SELECT TO authenticated
  USING (public.is_admin_office(auth.uid()));

CREATE POLICY "Admin office can manage subscriptions"
  ON public.merchant_subscriptions FOR ALL TO authenticated
  USING (public.admin_has_perm(auth.uid(), 'packages'))
  WITH CHECK (public.admin_has_perm(auth.uid(), 'packages'));

CREATE TRIGGER trg_merchant_subscriptions_updated
  BEFORE UPDATE ON public.merchant_subscriptions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Events log
CREATE TABLE IF NOT EXISTS public.subscription_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  subscription_id uuid REFERENCES public.merchant_subscriptions(id) ON DELETE CASCADE,
  merchant_id uuid NOT NULL,
  package_id uuid REFERENCES public.subscription_packages(id) ON DELETE SET NULL,
  event_type text NOT NULL,
  note text,
  meta jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT ON public.subscription_events TO authenticated;
GRANT ALL ON public.subscription_events TO service_role;

ALTER TABLE public.subscription_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Merchant can view own events"
  ON public.subscription_events FOR SELECT TO authenticated
  USING (auth.uid() = merchant_id OR public.is_admin_office(auth.uid()));

CREATE POLICY "Admin office manage events"
  ON public.subscription_events FOR ALL TO authenticated
  USING (public.admin_has_perm(auth.uid(), 'packages'))
  WITH CHECK (public.admin_has_perm(auth.uid(), 'packages'));

-- Helpers
CREATE OR REPLACE FUNCTION public.compute_period_end(_start timestamptz, _cycle public.billing_cycle)
RETURNS timestamptz LANGUAGE sql IMMUTABLE AS $$
  SELECT CASE _cycle
    WHEN 'monthly'  THEN _start + interval '1 month'
    WHEN 'yearly'   THEN _start + interval '1 year'
    WHEN 'lifetime' THEN NULL
  END;
$$;

CREATE OR REPLACE FUNCTION public.get_active_subscription(_merchant_id uuid)
RETURNS TABLE(
  id uuid, package_id uuid, package_name text, package_slug text,
  status public.subscription_status, billing_cycle public.billing_cycle,
  price numeric, currency text, permissions text[], features jsonb, limits jsonb,
  current_period_start timestamptz, current_period_end timestamptz,
  trial_ends_at timestamptz, auto_renew boolean
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT s.id, s.package_id, p.name, p.slug, s.status, p.billing_cycle,
         p.price, p.currency, p.permissions, p.features, p.limits,
         s.current_period_start, s.current_period_end, s.trial_ends_at, s.auto_renew
  FROM public.merchant_subscriptions s
  JOIN public.subscription_packages p ON p.id = s.package_id
  WHERE s.merchant_id = _merchant_id
    AND s.status IN ('trialing','active')
  ORDER BY s.created_at DESC LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.merchant_has_package_permission(_merchant_id uuid, _perm text)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS(
    SELECT 1 FROM public.merchant_subscriptions s
    JOIN public.subscription_packages p ON p.id = s.package_id
    WHERE s.merchant_id = _merchant_id
      AND s.status IN ('trialing','active')
      AND _perm = ANY(p.permissions)
  );
$$;

CREATE OR REPLACE FUNCTION public.assign_subscription(
  _merchant_id uuid, _package_id uuid, _auto_renew boolean DEFAULT true
) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  pkg public.subscription_packages%ROWTYPE;
  sub_id uuid;
  starts timestamptz := now();
  ends timestamptz;
  trial_end timestamptz;
  init_status public.subscription_status := 'active';
BEGIN
  IF NOT (public.admin_has_perm(auth.uid(), 'packages')
          OR public.has_role(auth.uid(), 'super_admin')) THEN
    RAISE EXCEPTION 'Forbidden';
  END IF;
  SELECT * INTO pkg FROM public.subscription_packages WHERE id = _package_id AND is_active;
  IF NOT FOUND THEN RAISE EXCEPTION 'Package not found or inactive'; END IF;

  IF pkg.trial_days > 0 THEN
    trial_end := starts + make_interval(days => pkg.trial_days);
    init_status := 'trialing';
  END IF;
  ends := public.compute_period_end(COALESCE(trial_end, starts), pkg.billing_cycle);

  -- Deactivate current subs
  UPDATE public.merchant_subscriptions
     SET status = 'cancelled', cancelled_at = now(), auto_renew = false
   WHERE merchant_id = _merchant_id AND status IN ('trialing','active');

  INSERT INTO public.merchant_subscriptions(
    merchant_id, package_id, status, started_at, current_period_start,
    current_period_end, trial_ends_at, auto_renew
  ) VALUES (
    _merchant_id, _package_id, init_status, starts, starts, ends, trial_end, _auto_renew
  ) RETURNING id INTO sub_id;

  INSERT INTO public.subscription_events(subscription_id, merchant_id, package_id, event_type, note)
  VALUES (sub_id, _merchant_id, _package_id, 'assigned',
          format('Assigned %s (%s)', pkg.name, pkg.billing_cycle));

  RETURN sub_id;
END; $$;

-- Cancel
CREATE OR REPLACE FUNCTION public.cancel_subscription(_subscription_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE s public.merchant_subscriptions%ROWTYPE;
BEGIN
  SELECT * INTO s FROM public.merchant_subscriptions WHERE id = _subscription_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Not found'; END IF;
  IF NOT (auth.uid() = s.merchant_id
          OR public.admin_has_perm(auth.uid(), 'packages')
          OR public.has_role(auth.uid(), 'super_admin')) THEN
    RAISE EXCEPTION 'Forbidden';
  END IF;
  UPDATE public.merchant_subscriptions
     SET status = 'cancelled', cancelled_at = now(), auto_renew = false
   WHERE id = _subscription_id;
  INSERT INTO public.subscription_events(subscription_id, merchant_id, package_id, event_type)
  VALUES (s.id, s.merchant_id, s.package_id, 'cancelled');
END; $$;

-- Renew due
CREATE OR REPLACE FUNCTION public.renew_due_subscriptions()
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE r RECORD; n integer := 0; new_end timestamptz;
BEGIN
  FOR r IN
    SELECT s.*, p.billing_cycle
    FROM public.merchant_subscriptions s
    JOIN public.subscription_packages p ON p.id = s.package_id
    WHERE s.status IN ('active','trialing')
      AND s.auto_renew = true
      AND p.billing_cycle <> 'lifetime'
      AND s.current_period_end IS NOT NULL
      AND s.current_period_end <= now()
  LOOP
    new_end := public.compute_period_end(r.current_period_end, r.billing_cycle);
    UPDATE public.merchant_subscriptions
       SET status = 'active',
           current_period_start = r.current_period_end,
           current_period_end = new_end,
           last_renewed_at = now(),
           trial_ends_at = NULL
     WHERE id = r.id;
    INSERT INTO public.subscription_events(subscription_id, merchant_id, package_id, event_type, note)
    VALUES (r.id, r.merchant_id, r.package_id, 'renewed',
            format('Renewed until %s', new_end));
    n := n + 1;
  END LOOP;
  RETURN n;
END; $$;

-- Expire due (no auto-renew or renewal failed)
CREATE OR REPLACE FUNCTION public.expire_due_subscriptions()
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE r RECORD; n integer := 0;
BEGIN
  FOR r IN
    SELECT s.id, s.merchant_id, s.package_id
    FROM public.merchant_subscriptions s
    JOIN public.subscription_packages p ON p.id = s.package_id
    WHERE s.status IN ('active','trialing')
      AND s.auto_renew = false
      AND p.billing_cycle <> 'lifetime'
      AND s.current_period_end IS NOT NULL
      AND s.current_period_end <= now()
  LOOP
    UPDATE public.merchant_subscriptions
       SET status = 'expired'
     WHERE id = r.id;
    INSERT INTO public.subscription_events(subscription_id, merchant_id, package_id, event_type)
    VALUES (r.id, r.merchant_id, r.package_id, 'expired');
    n := n + 1;
  END LOOP;
  RETURN n;
END; $$;
