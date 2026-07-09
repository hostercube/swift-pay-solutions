CREATE OR REPLACE FUNCTION public.claim_first_super_admin()
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _uid uuid := auth.uid();
BEGIN
  IF _uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE role IN ('super_admin', 'admin')
  ) THEN
    RETURN EXISTS (
      SELECT 1
      FROM public.user_roles
      WHERE user_id = _uid
        AND role IN ('super_admin', 'admin')
    );
  END IF;

  INSERT INTO public.user_roles (user_id, role)
  VALUES (_uid, 'super_admin')
  ON CONFLICT (user_id, role) DO NOTHING;

  RETURN true;
END;
$$;

REVOKE ALL ON FUNCTION public.claim_first_super_admin() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.claim_first_super_admin() TO authenticated;
GRANT EXECUTE ON FUNCTION public.claim_first_super_admin() TO service_role;