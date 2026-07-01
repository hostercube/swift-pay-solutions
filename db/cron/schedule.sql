-- =============================================================
-- PayNOC — Scheduled jobs (pg_cron + pg_net)
-- Run AFTER install.sql, and ONLY on the primary DB where pg_cron lives.
--
-- Replace the placeholders below before running:
--   {{APP_URL}}       e.g. https://pay.yourdomain.com
--   {{ANON_KEY}}      your self-hosted Supabase anon / publishable key
-- =============================================================

CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- Clean previous jobs (safe to re-run)
DO $$ BEGIN
  PERFORM cron.unschedule(jobname) FROM cron.job
  WHERE jobname IN (
    'paynoc-expire-invoices',
    'paynoc-webhook-retry',
    'paynoc-run-recurring',
    'paynoc-run-digest',
    'paynoc-run-payout-schedule'
  );
EXCEPTION WHEN OTHERS THEN NULL; END $$;

SELECT cron.schedule('paynoc-expire-invoices', '*/5 * * * *', $$
  SELECT net.http_post(
    url:='{{APP_URL}}/api/public/hooks/expire-invoices',
    headers:='{"Content-Type":"application/json","apikey":"{{ANON_KEY}}"}'::jsonb,
    body:='{}'::jsonb);
$$);

SELECT cron.schedule('paynoc-webhook-retry', '*/2 * * * *', $$
  SELECT net.http_post(
    url:='{{APP_URL}}/api/public/hooks/webhook-retry',
    headers:='{"Content-Type":"application/json","apikey":"{{ANON_KEY}}"}'::jsonb,
    body:='{}'::jsonb);
$$);

SELECT cron.schedule('paynoc-run-recurring', '*/15 * * * *', $$
  SELECT net.http_post(
    url:='{{APP_URL}}/api/public/hooks/run-recurring',
    headers:='{"Content-Type":"application/json","apikey":"{{ANON_KEY}}"}'::jsonb,
    body:='{}'::jsonb);
$$);

SELECT cron.schedule('paynoc-run-digest', '0 * * * *', $$
  SELECT net.http_post(
    url:='{{APP_URL}}/api/public/hooks/run-digest',
    headers:='{"Content-Type":"application/json","apikey":"{{ANON_KEY}}"}'::jsonb,
    body:='{}'::jsonb);
$$);

SELECT cron.schedule('paynoc-run-payout-schedule', '*/30 * * * *', $$
  SELECT net.http_post(
    url:='{{APP_URL}}/api/public/hooks/run-payout-schedule',
    headers:='{"Content-Type":"application/json","apikey":"{{ANON_KEY}}"}'::jsonb,
    body:='{}'::jsonb);
$$);

-- Inspect:  SELECT jobname, schedule FROM cron.job;
-- Logs:     SELECT * FROM cron.job_run_details ORDER BY start_time DESC LIMIT 20;
