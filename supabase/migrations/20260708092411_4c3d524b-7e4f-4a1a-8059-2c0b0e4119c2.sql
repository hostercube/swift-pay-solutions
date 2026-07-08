
-- 1) KYC fields on profiles
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS kyc_status TEXT NOT NULL DEFAULT 'unverified'
    CHECK (kyc_status IN ('unverified','pending','verified','rejected')),
  ADD COLUMN IF NOT EXISTS kyc_documents JSONB NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS kyc_id_type TEXT,
  ADD COLUMN IF NOT EXISTS kyc_id_number TEXT,
  ADD COLUMN IF NOT EXISTS kyc_business_type TEXT,
  ADD COLUMN IF NOT EXISTS kyc_address TEXT,
  ADD COLUMN IF NOT EXISTS kyc_submitted_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS kyc_reviewed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS kyc_reviewer_note TEXT;

-- 2) Verification mode + signup toggle on platform settings
ALTER TABLE public.platform_settings
  ADD COLUMN IF NOT EXISTS verification_mode TEXT NOT NULL DEFAULT 'manual'
    CHECK (verification_mode IN ('auto','manual'));

-- 3) Admin impersonation audit
CREATE TABLE IF NOT EXISTS public.impersonation_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  admin_email TEXT NOT NULL,
  target_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  target_email TEXT NOT NULL,
  reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.impersonation_events TO authenticated;
GRANT ALL ON public.impersonation_events TO service_role;
ALTER TABLE public.impersonation_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "super_admin sees impersonation" ON public.impersonation_events
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'super_admin'));
CREATE POLICY "super_admin writes impersonation" ON public.impersonation_events
  FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'super_admin'));

-- 4) Update signup trigger to honour verification_mode
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _mode TEXT;
BEGIN
  SELECT verification_mode INTO _mode FROM public.platform_settings WHERE id = 1;
  INSERT INTO public.profiles (id, email, full_name, business_name, phone, kyc_status)
  VALUES (
    NEW.id,
    NEW.email,
    NEW.raw_user_meta_data->>'full_name',
    NEW.raw_user_meta_data->>'business_name',
    NEW.raw_user_meta_data->>'phone',
    CASE WHEN _mode = 'auto' THEN 'verified' ELSE 'unverified' END
  );
  INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'merchant');
  RETURN NEW;
END;
$$;
