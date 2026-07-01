
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
