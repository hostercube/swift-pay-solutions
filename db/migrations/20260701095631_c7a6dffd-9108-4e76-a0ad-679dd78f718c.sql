
ALTER VIEW public.checkout_methods SET (security_invoker = true);
ALTER VIEW public.checkout_invoices SET (security_invoker = true);
