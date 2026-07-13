ALTER TABLE public.byo_gateways DROP CONSTRAINT IF EXISTS byo_gateways_provider_check;
ALTER TABLE public.byo_gateways ADD CONSTRAINT byo_gateways_provider_check
  CHECK (provider = ANY (ARRAY[
    'bkash','nagad','rocket','sslcommerz','shurjopay','aamarpay',
    'uddoktapay','piprapay','ownpay','eps','paystation',
    'upay','tap','mcash','mycash','dmoney','surecash','portwallet','walletmix','bank_transfer',
    'stripe','paypal','razorpay','paddle','twocheckout',
    'coinbase_commerce','nowpayments','binance_pay','cryptomus'
  ]));