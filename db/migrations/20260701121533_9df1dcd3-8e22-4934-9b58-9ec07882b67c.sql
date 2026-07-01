
CREATE TABLE public.idempotency_keys (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  merchant_id UUID NOT NULL,
  key TEXT NOT NULL,
  method TEXT NOT NULL,
  path TEXT NOT NULL,
  request_hash TEXT NOT NULL,
  status_code INT NOT NULL,
  response_body JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (merchant_id, key, method, path)
);

GRANT ALL ON public.idempotency_keys TO service_role;

ALTER TABLE public.idempotency_keys ENABLE ROW LEVEL SECURITY;

CREATE POLICY "no client access" ON public.idempotency_keys FOR ALL USING (false) WITH CHECK (false);

CREATE INDEX idempotency_keys_created_idx ON public.idempotency_keys (created_at);
