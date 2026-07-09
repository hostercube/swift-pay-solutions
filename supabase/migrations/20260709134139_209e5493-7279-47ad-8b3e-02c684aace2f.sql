
ALTER TABLE public.transactions
  ADD COLUMN IF NOT EXISTS rejected_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS rejected_reason text,
  ADD COLUMN IF NOT EXISTS rejected_at timestamptz;

CREATE UNIQUE INDEX IF NOT EXISTS transactions_merchant_trxid_active_uidx
  ON public.transactions (merchant_id, provider_txn_id)
  WHERE status IN ('pending','verified') AND provider_txn_id IS NOT NULL;
