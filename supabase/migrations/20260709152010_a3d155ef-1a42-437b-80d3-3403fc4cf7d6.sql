
ALTER TABLE public.merchant_fx_rates
  ADD COLUMN IF NOT EXISTS mode text NOT NULL DEFAULT 'manual',
  ADD COLUMN IF NOT EXISTS markup_percent numeric NOT NULL DEFAULT 0;

ALTER TABLE public.merchant_fx_rates
  DROP CONSTRAINT IF EXISTS merchant_fx_rates_mode_check;
ALTER TABLE public.merchant_fx_rates
  ADD CONSTRAINT merchant_fx_rates_mode_check CHECK (mode IN ('auto','manual'));

-- Effective FX: auto mode uses live platform rate * (1 + markup%); manual uses merchant rate.
CREATE OR REPLACE FUNCTION public.get_effective_fx_rate(_merchant_id uuid, _base text, _quote text)
RETURNS numeric
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  WITH m AS (
    SELECT rate, mode, markup_percent
    FROM public.merchant_fx_rates
    WHERE merchant_id = _merchant_id
      AND upper(base_currency) = upper(_base)
      AND upper(quote_currency) = upper(_quote)
    LIMIT 1
  ),
  g AS (
    SELECT rate FROM public.fx_rates
    WHERE upper(base_currency) = upper(_base)
      AND upper(quote_currency) = upper(_quote)
    LIMIT 1
  )
  SELECT COALESCE(
    CASE
      WHEN (SELECT mode FROM m) = 'auto'
        THEN COALESCE((SELECT rate FROM g), (SELECT rate FROM m)) * (1 + COALESCE((SELECT markup_percent FROM m),0) / 100)
      WHEN (SELECT mode FROM m) = 'manual'
        THEN (SELECT rate FROM m)
      ELSE NULL
    END,
    (SELECT rate FROM g)
  );
$$;
