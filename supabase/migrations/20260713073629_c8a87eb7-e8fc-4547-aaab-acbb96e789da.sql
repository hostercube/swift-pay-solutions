
-- Merchant profile extensions
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS address TEXT,
  ADD COLUMN IF NOT EXISTS city TEXT,
  ADD COLUMN IF NOT EXISTS state TEXT,
  ADD COLUMN IF NOT EXISTS country TEXT,
  ADD COLUMN IF NOT EXISTS postcode TEXT,
  ADD COLUMN IF NOT EXISTS tax_id TEXT,
  ADD COLUMN IF NOT EXISTS website TEXT,
  ADD COLUMN IF NOT EXISTS timezone TEXT DEFAULT 'Asia/Dhaka',
  ADD COLUMN IF NOT EXISTS language TEXT DEFAULT 'en',
  ADD COLUMN IF NOT EXISTS date_of_birth DATE,
  ADD COLUMN IF NOT EXISTS mfa_enrolled_at TIMESTAMPTZ;

-- Admin staff extensions
ALTER TABLE public.admin_staff
  ADD COLUMN IF NOT EXISTS phone TEXT,
  ADD COLUMN IF NOT EXISTS avatar_url TEXT,
  ADD COLUMN IF NOT EXISTS department TEXT,
  ADD COLUMN IF NOT EXISTS mfa_enabled BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS mfa_enrolled_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS last_login_at TIMESTAMPTZ;

-- Team member extensions
ALTER TABLE public.team_members
  ADD COLUMN IF NOT EXISTS phone TEXT,
  ADD COLUMN IF NOT EXISTS avatar_url TEXT,
  ADD COLUMN IF NOT EXISTS department TEXT,
  ADD COLUMN IF NOT EXISTS last_login_at TIMESTAMPTZ;

-- Helper: sync mfa_enrolled_at flag from auth.mfa_factors on the user (called by app after enroll/unenroll)
CREATE OR REPLACE FUNCTION public.sync_mfa_state()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _uid uuid := auth.uid();
  _has_factor boolean;
BEGIN
  IF _uid IS NULL THEN RETURN; END IF;

  SELECT EXISTS(
    SELECT 1 FROM auth.mfa_factors
    WHERE user_id = _uid AND status = 'verified'
  ) INTO _has_factor;

  UPDATE public.profiles
     SET mfa_enabled = _has_factor,
         mfa_enrolled_at = CASE WHEN _has_factor AND mfa_enrolled_at IS NULL THEN now()
                                WHEN NOT _has_factor THEN NULL
                                ELSE mfa_enrolled_at END
   WHERE id = _uid;

  UPDATE public.admin_staff
     SET mfa_enabled = _has_factor,
         mfa_enrolled_at = CASE WHEN _has_factor AND mfa_enrolled_at IS NULL THEN now()
                                WHEN NOT _has_factor THEN NULL
                                ELSE mfa_enrolled_at END
   WHERE user_id = _uid;
END;
$$;

GRANT EXECUTE ON FUNCTION public.sync_mfa_state() TO authenticated;
