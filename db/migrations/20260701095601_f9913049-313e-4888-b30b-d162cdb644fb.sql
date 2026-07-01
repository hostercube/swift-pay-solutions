
CREATE VIEW public.checkout_methods AS
SELECT id, merchant_id, type, label, mode, account_number, account_name,
       instructions, logo_url, fee_percent, fee_flat, min_amount, max_amount, sort_order, is_active
FROM public.payment_methods
WHERE is_active = true;
GRANT SELECT ON public.checkout_methods TO anon, authenticated;

CREATE VIEW public.checkout_invoices AS
SELECT id, merchant_id, invoice_number, amount, currency, status, method_id, method_type,
       customer_name, customer_email, customer_phone, description, redirect_url,
       fee_amount, net_amount, expires_at, created_at
FROM public.invoices;
GRANT SELECT ON public.checkout_invoices TO anon, authenticated;

CREATE POLICY "Public read pending invoices" ON public.invoices
  FOR SELECT TO anon
  USING (status IN ('pending','processing'));
GRANT SELECT ON public.invoices TO anon;

CREATE POLICY "Public start payment" ON public.invoices
  FOR UPDATE TO anon
  USING (status = 'pending')
  WITH CHECK (status IN ('pending','processing'));
GRANT UPDATE ON public.invoices TO anon;

CREATE POLICY "Public submit transactions" ON public.transactions
  FOR INSERT TO anon
  WITH CHECK (
    status = 'pending'
    AND EXISTS (
      SELECT 1 FROM public.invoices i
      WHERE i.id = invoice_id
        AND i.merchant_id = transactions.merchant_id
        AND i.status IN ('pending','processing')
    )
  );
GRANT INSERT ON public.transactions TO anon;

CREATE POLICY "Public read invoice transactions" ON public.transactions
  FOR SELECT TO anon
  USING (
    EXISTS (
      SELECT 1 FROM public.invoices i
      WHERE i.id = invoice_id
        AND i.status IN ('pending','processing','completed')
    )
  );
