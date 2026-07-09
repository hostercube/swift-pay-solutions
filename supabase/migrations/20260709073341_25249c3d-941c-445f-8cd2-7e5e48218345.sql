
ALTER TABLE public.invoices
  ADD COLUMN IF NOT EXISTS allow_custom_amount BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS min_amount NUMERIC,
  ADD COLUMN IF NOT EXISTS max_amount NUMERIC,
  ADD COLUMN IF NOT EXISTS reusable BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS auto_redirect BOOLEAN NOT NULL DEFAULT true;

DROP FUNCTION IF EXISTS public.get_checkout_invoice(uuid);

CREATE FUNCTION public.get_checkout_invoice(_id uuid)
 RETURNS TABLE(id uuid, merchant_id uuid, invoice_number text, amount numeric, currency text, status invoice_status, method_id uuid, method_type text, customer_name text, customer_email text, customer_phone text, description text, redirect_url text, metadata jsonb, expires_at timestamp with time zone, created_at timestamp with time zone, paid_at timestamp with time zone, mode text, allow_custom_amount boolean, min_amount numeric, max_amount numeric, reusable boolean, auto_redirect boolean)
 LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $function$
  SELECT id, merchant_id, invoice_number, amount, currency, status, method_id,
         method_type::text, customer_name, customer_email, customer_phone,
         description, redirect_url, metadata, expires_at, created_at, paid_at, mode::text,
         allow_custom_amount, min_amount, max_amount, reusable, auto_redirect
  FROM public.invoices
  WHERE id = _id
    AND status IN ('pending','processing','completed','expired','failed')
  LIMIT 1;
$function$;

CREATE OR REPLACE FUNCTION public.set_checkout_amount(_invoice_id uuid, _amount numeric)
 RETURNS TABLE(ok boolean, message text, new_amount numeric)
 LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $function$
DECLARE inv public.invoices%ROWTYPE;
BEGIN
  SELECT * INTO inv FROM public.invoices WHERE id = _invoice_id;
  IF NOT FOUND THEN RETURN QUERY SELECT false, 'Invoice not found', 0::numeric; RETURN; END IF;
  IF NOT inv.allow_custom_amount THEN
    RETURN QUERY SELECT false, 'Custom amount not allowed', inv.amount; RETURN;
  END IF;
  IF inv.status <> 'pending' AND NOT inv.reusable THEN
    RETURN QUERY SELECT false, 'Invoice not open', inv.amount; RETURN;
  END IF;
  IF _amount <= 0 THEN
    RETURN QUERY SELECT false, 'Amount must be greater than 0', inv.amount; RETURN;
  END IF;
  IF inv.min_amount IS NOT NULL AND _amount < inv.min_amount THEN
    RETURN QUERY SELECT false, format('Minimum amount is %s', inv.min_amount), inv.amount; RETURN;
  END IF;
  IF inv.max_amount IS NOT NULL AND _amount > inv.max_amount THEN
    RETURN QUERY SELECT false, format('Maximum amount is %s', inv.max_amount), inv.amount; RETURN;
  END IF;
  UPDATE public.invoices SET amount = _amount WHERE id = _invoice_id;
  RETURN QUERY SELECT true, 'Amount set', _amount;
END;
$function$;
