
CREATE TABLE public.api_request_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  merchant_id uuid NOT NULL,
  api_key_id uuid,
  method text NOT NULL,
  path text NOT NULL,
  status_code integer NOT NULL,
  latency_ms integer NOT NULL,
  ip_address text,
  user_agent text,
  error_message text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX api_request_logs_merchant_created_idx ON public.api_request_logs (merchant_id, created_at DESC);

GRANT SELECT ON public.api_request_logs TO authenticated;
GRANT ALL ON public.api_request_logs TO service_role;

ALTER TABLE public.api_request_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Merchant reads own api logs"
ON public.api_request_logs FOR SELECT
TO authenticated
USING (public.merchant_can(auth.uid(), merchant_id, 'viewer'));

CREATE POLICY "Super admin reads all api logs"
ON public.api_request_logs FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'super_admin'));
