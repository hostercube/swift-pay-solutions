
ALTER TABLE public.invoices ADD COLUMN IF NOT EXISTS mode text NOT NULL DEFAULT 'live' CHECK (mode IN ('live','test'));
ALTER TABLE public.transactions ADD COLUMN IF NOT EXISTS mode text NOT NULL DEFAULT 'live' CHECK (mode IN ('live','test'));
ALTER TABLE public.webhook_endpoints ADD COLUMN IF NOT EXISTS mode text NOT NULL DEFAULT 'live' CHECK (mode IN ('live','test'));
CREATE INDEX IF NOT EXISTS idx_invoices_merchant_mode ON public.invoices(merchant_id, mode);
CREATE INDEX IF NOT EXISTS idx_transactions_merchant_mode ON public.transactions(merchant_id, mode);

DROP VIEW IF EXISTS public.checkout_invoices CASCADE;
CREATE VIEW public.checkout_invoices
WITH (security_invoker = true)
AS
SELECT id, merchant_id, invoice_number, amount, currency, status, customer_name,
       customer_email, customer_phone, description, redirect_url, metadata,
       expires_at, created_at, paid_at, mode
FROM public.invoices;
GRANT SELECT ON public.checkout_invoices TO anon, authenticated;
