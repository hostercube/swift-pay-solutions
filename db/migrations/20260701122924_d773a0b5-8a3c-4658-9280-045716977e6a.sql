
-- Task 7: Security scan — lock down anon access to base tables.
-- Replace broad anon SELECT policies with SECURITY DEFINER RPCs scoped by invoice id / merchant id.

DROP POLICY IF EXISTS "Public can view checkout branding" ON public.profiles;
DROP POLICY IF EXISTS "Public read pending invoices" ON public.invoices;
DROP POLICY IF EXISTS "Public read invoice transactions" ON public.transactions;

-- Scoped RPCs (require caller to know the invoice UUID).
CREATE OR REPLACE FUNCTION public.get_checkout_invoice(_id uuid)
RETURNS TABLE (
  id uuid, merchant_id uuid, invoice_number text, amount numeric, currency text,
  status invoice_status, method_id uuid, method_type text, customer_name text,
  customer_email text, customer_phone text, description text, redirect_url text,
  metadata jsonb, expires_at timestamptz, created_at timestamptz, paid_at timestamptz, mode text
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT id, merchant_id, invoice_number, amount, currency, status, method_id,
         method_type::text, customer_name, customer_email, customer_phone,
         description, redirect_url, metadata, expires_at, created_at, paid_at, mode::text
  FROM public.invoices
  WHERE id = _id
    AND status IN ('pending','processing','completed','expired','failed')
  LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.get_checkout_methods(_merchant_id uuid)
RETURNS SETOF public.payment_methods
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT * FROM public.payment_methods
  WHERE merchant_id = _merchant_id AND is_active = true
  ORDER BY sort_order ASC;
$$;

CREATE OR REPLACE FUNCTION public.get_checkout_brand(_merchant_id uuid)
RETURNS TABLE (
  merchant_id uuid, business_name text, brand_color text,
  logo_url text, support_email text, checkout_footer text
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT id, business_name, brand_color, logo_url, support_email, checkout_footer
  FROM public.profiles WHERE id = _merchant_id LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.get_checkout_transactions(_invoice_id uuid)
RETURNS TABLE (
  id uuid, status transaction_status, method_type text, gross_amount numeric,
  provider_txn_id text, reference text, created_at timestamptz,
  verified_at timestamptz, note text
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT id, status, method_type::text, gross_amount, provider_txn_id, reference,
         created_at, verified_at, note
  FROM public.transactions WHERE invoice_id = _invoice_id
  ORDER BY created_at DESC;
$$;

REVOKE ALL ON FUNCTION public.get_checkout_invoice(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_checkout_methods(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_checkout_brand(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_checkout_transactions(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_checkout_invoice(uuid) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_checkout_methods(uuid) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_checkout_brand(uuid) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_checkout_transactions(uuid) TO anon, authenticated;
