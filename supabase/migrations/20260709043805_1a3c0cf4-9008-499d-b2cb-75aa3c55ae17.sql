CREATE TABLE IF NOT EXISTS public.merchant_smsnoc_configs (
  merchant_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  enabled boolean NOT NULL DEFAULT false,
  api_key text,
  sender_id text,
  whatsapp_device_id text,
  email_config_id text,
  channel_sms boolean NOT NULL DEFAULT true,
  channel_email boolean NOT NULL DEFAULT false,
  channel_whatsapp boolean NOT NULL DEFAULT false,
  channel_voice boolean NOT NULL DEFAULT false,
  notify_on_invoice_created boolean NOT NULL DEFAULT false,
  notify_on_payment_received boolean NOT NULL DEFAULT true,
  notify_on_refund boolean NOT NULL DEFAULT true,
  notify_phone text,
  notify_email text,
  notify_whatsapp text,
  templates jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.merchant_smsnoc_configs TO authenticated;
GRANT ALL ON public.merchant_smsnoc_configs TO service_role;

ALTER TABLE public.merchant_smsnoc_configs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Merchant read own smsnoc config"
  ON public.merchant_smsnoc_configs FOR SELECT TO authenticated
  USING (
    auth.uid() = merchant_id
    OR public.merchant_has_perm(auth.uid(), merchant_id, 'notifications:view')
    OR public.merchant_has_perm(auth.uid(), merchant_id, 'notifications:manage')
    OR public.has_role(auth.uid(), 'super_admin')
  );

CREATE POLICY "Merchant write own smsnoc config"
  ON public.merchant_smsnoc_configs FOR INSERT TO authenticated
  WITH CHECK (
    auth.uid() = merchant_id
    OR public.merchant_has_perm(auth.uid(), merchant_id, 'notifications:manage')
  );

CREATE POLICY "Merchant update own smsnoc config"
  ON public.merchant_smsnoc_configs FOR UPDATE TO authenticated
  USING (
    auth.uid() = merchant_id
    OR public.merchant_has_perm(auth.uid(), merchant_id, 'notifications:manage')
  )
  WITH CHECK (
    auth.uid() = merchant_id
    OR public.merchant_has_perm(auth.uid(), merchant_id, 'notifications:manage')
  );

CREATE POLICY "Merchant delete own smsnoc config"
  ON public.merchant_smsnoc_configs FOR DELETE TO authenticated
  USING (
    auth.uid() = merchant_id
    OR public.merchant_has_perm(auth.uid(), merchant_id, 'notifications:manage')
  );

CREATE TRIGGER update_merchant_smsnoc_configs_updated_at
  BEFORE UPDATE ON public.merchant_smsnoc_configs
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();