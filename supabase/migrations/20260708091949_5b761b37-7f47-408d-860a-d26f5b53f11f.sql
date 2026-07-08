
-- 1) Merchant team: granular checkbox permissions on top of role
ALTER TABLE public.team_members
  ADD COLUMN IF NOT EXISTS permissions TEXT[] NOT NULL DEFAULT '{}';

-- 2) Admin office staff: super_admin can grant checkbox-based access to employees
CREATE TABLE IF NOT EXISTS public.admin_staff (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT NOT NULL UNIQUE,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT,
  permissions TEXT[] NOT NULL DEFAULT '{}',
  status TEXT NOT NULL DEFAULT 'invited' CHECK (status IN ('invited','active','disabled')),
  invited_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.admin_staff TO authenticated;
GRANT ALL ON public.admin_staff TO service_role;
ALTER TABLE public.admin_staff ENABLE ROW LEVEL SECURITY;

-- Only super_admin manages the admin office; each staff can read their own row
CREATE POLICY "super_admin manages admin_staff" ON public.admin_staff
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'super_admin'))
  WITH CHECK (public.has_role(auth.uid(), 'super_admin'));

CREATE POLICY "staff read own row" ON public.admin_staff
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());

DO $$ BEGIN
  CREATE TRIGGER trg_admin_staff_updated BEFORE UPDATE ON public.admin_staff
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- 3) Helpers
CREATE OR REPLACE FUNCTION public.is_admin_office(_user_id UUID)
RETURNS BOOLEAN LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT public.has_role(_user_id, 'super_admin')
      OR EXISTS (SELECT 1 FROM public.admin_staff
                  WHERE user_id = _user_id AND status = 'active');
$$;

CREATE OR REPLACE FUNCTION public.admin_has_perm(_user_id UUID, _perm TEXT)
RETURNS BOOLEAN LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT public.has_role(_user_id, 'super_admin')
      OR EXISTS (SELECT 1 FROM public.admin_staff
                  WHERE user_id = _user_id AND status = 'active'
                    AND _perm = ANY(permissions));
$$;

CREATE OR REPLACE FUNCTION public.merchant_has_perm(_user_id UUID, _merchant_id UUID, _perm TEXT)
RETURNS BOOLEAN LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT _user_id = _merchant_id
      OR EXISTS (SELECT 1 FROM public.team_members
                  WHERE merchant_id = _merchant_id AND member_user_id = _user_id
                    AND status = 'active'
                    AND _perm = ANY(permissions));
$$;

-- 4) When invited admin_staff sign up, activate their row
CREATE OR REPLACE FUNCTION public.activate_admin_staff()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  UPDATE public.admin_staff
     SET user_id = NEW.id, status = 'active'
   WHERE lower(email) = lower(NEW.email) AND status = 'invited';
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created_admin_staff ON auth.users;
CREATE TRIGGER on_auth_user_created_admin_staff
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.activate_admin_staff();
