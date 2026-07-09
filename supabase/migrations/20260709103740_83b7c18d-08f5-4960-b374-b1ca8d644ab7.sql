ALTER TABLE public.refunds ADD COLUMN IF NOT EXISTS provider_refund_id TEXT;
ALTER TABLE public.refunds ADD COLUMN IF NOT EXISTS provider TEXT;
ALTER TABLE public.refunds ADD COLUMN IF NOT EXISTS provider_response JSONB;

-- Prevent same provider TrxID being reused across invoices for the same merchant.
CREATE UNIQUE INDEX IF NOT EXISTS transactions_merchant_provider_txn_uniq
  ON public.transactions (merchant_id, provider_txn_id)
  WHERE provider_txn_id IS NOT NULL AND status <> 'rejected';

-- Idempotency for webhooks: skip duplicate provider events.
CREATE UNIQUE INDEX IF NOT EXISTS webhook_events_provider_event_uniq
  ON public.webhook_events (provider, provider_event_id)
  WHERE provider_event_id IS NOT NULL;
