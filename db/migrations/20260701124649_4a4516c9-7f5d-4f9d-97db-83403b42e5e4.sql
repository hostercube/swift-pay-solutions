
CREATE OR REPLACE FUNCTION public.get_customer_invoices(_email text, _invoice_number text)
RETURNS TABLE(
  id uuid,
  invoice_number text,
  amount numeric,
  currency text,
  status invoice_status,
  description text,
  created_at timestamp with time zone,
  paid_at timestamp with time zone,
  expires_at timestamp with time zone,
  business_name text
)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  WITH proof AS (
    SELECT i.customer_email
    FROM public.invoices i
    WHERE lower(i.customer_email) = lower(_email)
      AND i.invoice_number = _invoice_number
    LIMIT 1
  )
  SELECT i.id, i.invoice_number, i.amount, i.currency, i.status,
         i.description, i.created_at, i.paid_at, i.expires_at,
         p.business_name
  FROM public.invoices i
  LEFT JOIN public.profiles p ON p.id = i.merchant_id
  WHERE EXISTS (SELECT 1 FROM proof)
    AND lower(i.customer_email) = lower(_email)
  ORDER BY i.created_at DESC
  LIMIT 200;
$$;

GRANT EXECUTE ON FUNCTION public.get_customer_invoices(text, text) TO anon, authenticated;
