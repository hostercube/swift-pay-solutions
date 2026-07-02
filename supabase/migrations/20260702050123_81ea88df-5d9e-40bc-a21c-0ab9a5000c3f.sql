
CREATE TABLE public.merchant_fx_rates (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  merchant_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  base_currency text NOT NULL,
  quote_currency text NOT NULL,
  rate numeric NOT NULL CHECK (rate > 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (merchant_id, base_currency, quote_currency)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.merchant_fx_rates TO authenticated;
GRANT SELECT ON public.merchant_fx_rates TO anon;
GRANT ALL ON public.merchant_fx_rates TO service_role;

ALTER TABLE public.merchant_fx_rates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "merchant manage own fx" ON public.merchant_fx_rates
  FOR ALL TO authenticated
  USING (merchant_id = auth.uid() OR has_role(auth.uid(), 'super_admin'))
  WITH CHECK (merchant_id = auth.uid() OR has_role(auth.uid(), 'super_admin'));

CREATE POLICY "public read merchant fx" ON public.merchant_fx_rates
  FOR SELECT TO anon USING (true);

CREATE TRIGGER trg_merchant_fx_updated
  BEFORE UPDATE ON public.merchant_fx_rates
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Resolve rate: merchant override -> global fx_rates -> null
CREATE OR REPLACE FUNCTION public.get_effective_fx_rate(
  _merchant_id uuid, _base text, _quote text
) RETURNS numeric
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
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
