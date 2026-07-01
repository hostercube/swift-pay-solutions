
DROP VIEW IF EXISTS public.checkout_invoices CASCADE;
CREATE VIEW public.checkout_invoices
WITH (security_invoker = true)
AS
SELECT id, merchant_id, invoice_number, amount, currency, status,
       method_id, method_type,
       customer_name, customer_email, customer_phone, description,
       redirect_url, metadata, expires_at, created_at, paid_at, mode
FROM public.invoices;
GRANT SELECT ON public.checkout_invoices TO anon, authenticated;
