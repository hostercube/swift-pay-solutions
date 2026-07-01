-- Promote a user to super_admin (run once after first sign-up).
-- Replace the email below with your own.

INSERT INTO public.user_roles (user_id, role)
SELECT id, 'super_admin'
FROM auth.users
WHERE email = 'you@example.com'
ON CONFLICT (user_id, role) DO NOTHING;
