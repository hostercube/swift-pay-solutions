-- Merchant BYO gateways: widen provider list to match the full registry
-- so merchants can save Uddoktapay, PipraPay, OwnPay, etc.
ALTER TABLE public.byo_gateways DROP CONSTRAINT IF EXISTS byo_gateways_provider_check;
ALTER TABLE public.byo_gateways ADD CONSTRAINT byo_gateways_provider_check
  CHECK (provider = ANY (ARRAY[
    'bkash','nagad','rocket','sslcommerz','shurjopay','aamarpay',
    'uddoktapay','piprapay','ownpay',
    'stripe','paypal','razorpay','paddle','twocheckout',
    'coinbase_commerce','nowpayments','binance_pay'
  ]));

-- Same widening for platform_gateways so super admins can add the same set.
ALTER TABLE public.platform_gateways DROP CONSTRAINT IF EXISTS platform_gateways_provider_check;
-- (platform_gateways.provider is UNIQUE but was previously constraint-free; nothing to re-add.)
