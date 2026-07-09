
ALTER TABLE public.payment_methods
  ADD COLUMN IF NOT EXISTS qr_code_url TEXT,
  ADD COLUMN IF NOT EXISTS qr_type TEXT,
  ADD COLUMN IF NOT EXISTS bank_name TEXT,
  ADD COLUMN IF NOT EXISTS branch_name TEXT,
  ADD COLUMN IF NOT EXISTS routing_number TEXT,
  ADD COLUMN IF NOT EXISTS swift_code TEXT;

ALTER TABLE public.transactions
  ADD COLUMN IF NOT EXISTS slip_url TEXT,
  ADD COLUMN IF NOT EXISTS bank_reference TEXT;

CREATE OR REPLACE FUNCTION public.get_checkout_methods(_merchant_id uuid)
 RETURNS SETOF payment_methods
 LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$
  SELECT * FROM public.payment_methods
  WHERE merchant_id = _merchant_id AND is_active = true
  ORDER BY sort_order ASC;
$$;
