
-- SMS event logs: audit every APK SMS ingest with the matching layer & reason
CREATE TABLE public.sms_event_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  merchant_id UUID NOT NULL,
  provider TEXT,
  trx_id TEXT,
  sender TEXT,
  amount NUMERIC,
  raw_body TEXT,
  device_id TEXT,
  matched_layer TEXT NOT NULL, -- L0_idempotent | L1_trxid | L2_sender_amount | L3_amount_mismatch | L4_no_match | L5_error
  outcome TEXT NOT NULL,       -- verified | skipped | rejected | no_match | error
  reason TEXT,
  matched_txn_id UUID,
  matched_invoice_id UUID,
  received_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT ON public.sms_event_logs TO authenticated;
GRANT ALL ON public.sms_event_logs TO service_role;

ALTER TABLE public.sms_event_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Merchants read own sms logs"
  ON public.sms_event_logs FOR SELECT
  TO authenticated
  USING (public.merchant_can(auth.uid(), merchant_id, 'viewer')
      OR public.has_role(auth.uid(), 'super_admin'));

CREATE INDEX sms_event_logs_merchant_created_idx
  ON public.sms_event_logs (merchant_id, created_at DESC);
CREATE INDEX sms_event_logs_outcome_idx
  ON public.sms_event_logs (outcome, created_at DESC);
CREATE INDEX sms_event_logs_trx_idx
  ON public.sms_event_logs (merchant_id, trx_id);

-- Track auto-drained transactions distinctly from normal rejects
ALTER TABLE public.transactions
  ADD COLUMN IF NOT EXISTS drained_at TIMESTAMPTZ;
