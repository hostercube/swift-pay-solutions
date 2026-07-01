
-- notifications (in-app)
CREATE TABLE public.notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  merchant_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  event TEXT NOT NULL,
  title TEXT NOT NULL,
  body TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  read_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_notifications_merchant ON public.notifications(merchant_id, created_at DESC);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.notifications TO authenticated;
GRANT ALL ON public.notifications TO service_role;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Merchants view own notifications" ON public.notifications FOR SELECT
  USING (merchant_id = auth.uid() OR public.has_role(auth.uid(), 'super_admin'));
CREATE POLICY "Merchants update own notifications" ON public.notifications FOR UPDATE
  USING (merchant_id = auth.uid());
CREATE POLICY "Service manages notifications" ON public.notifications FOR ALL
  TO service_role USING (true) WITH CHECK (true);

-- notification settings
CREATE TABLE public.notification_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  merchant_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  email_enabled BOOLEAN NOT NULL DEFAULT true,
  sms_enabled BOOLEAN NOT NULL DEFAULT false,
  inapp_enabled BOOLEAN NOT NULL DEFAULT true,
  notify_email TEXT,
  notify_phone TEXT,
  events JSONB NOT NULL DEFAULT '{"invoice.completed":true,"invoice.failed":true,"webhook.failed":true,"payout.processed":true}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.notification_settings TO authenticated;
GRANT ALL ON public.notification_settings TO service_role;
ALTER TABLE public.notification_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Merchants manage own notif settings" ON public.notification_settings FOR ALL
  USING (merchant_id = auth.uid()) WITH CHECK (merchant_id = auth.uid());
CREATE TRIGGER update_notification_settings_updated_at BEFORE UPDATE ON public.notification_settings
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- notification delivery log
CREATE TABLE public.notification_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  merchant_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  channel TEXT NOT NULL, -- email | sms
  event TEXT NOT NULL,
  recipient TEXT NOT NULL,
  subject TEXT,
  body TEXT,
  status TEXT NOT NULL DEFAULT 'pending', -- pending | sent | failed | skipped
  provider TEXT,
  provider_response JSONB,
  error TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_notif_log_merchant ON public.notification_log(merchant_id, created_at DESC);
GRANT SELECT ON public.notification_log TO authenticated;
GRANT ALL ON public.notification_log TO service_role;
ALTER TABLE public.notification_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Merchants view own notif log" ON public.notification_log FOR SELECT
  USING (merchant_id = auth.uid() OR public.has_role(auth.uid(), 'super_admin'));
CREATE POLICY "Service writes notif log" ON public.notification_log FOR ALL
  TO service_role USING (true) WITH CHECK (true);
