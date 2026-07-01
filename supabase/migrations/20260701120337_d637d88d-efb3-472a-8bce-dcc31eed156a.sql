
ALTER TABLE public.team_members ADD COLUMN IF NOT EXISTS member_user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;
CREATE INDEX IF NOT EXISTS idx_team_members_user ON public.team_members(member_user_id);

CREATE OR REPLACE FUNCTION public.activate_team_invites()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.team_members
     SET member_user_id = NEW.id, status = 'active'
   WHERE lower(member_email) = lower(NEW.email)
     AND status = 'pending';
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created_activate_invites ON auth.users;
CREATE TRIGGER on_auth_user_created_activate_invites
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.activate_team_invites();

-- Allow teammates to read their own memberships
DROP POLICY IF EXISTS "team read own memberships" ON public.team_members;
CREATE POLICY "team read own memberships" ON public.team_members
  FOR SELECT TO authenticated
  USING (member_user_id = auth.uid());
