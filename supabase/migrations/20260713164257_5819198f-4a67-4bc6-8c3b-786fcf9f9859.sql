UPDATE public.platform_settings
SET settings = jsonb_set(
  COALESCE(settings, '{}'::jsonb),
  '{turnstile}',
  '{"enabled": false, "site_key": "", "secret_key": ""}'::jsonb,
  true
)
WHERE id = 1;