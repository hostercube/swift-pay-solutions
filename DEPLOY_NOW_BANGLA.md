# PayNOC — Ekhon Theke Deploy Sesh Kore Fela (Bangla Step-by-Step)

Ei ekta file dekhle sob steps peye jabe. Upor theke niche order maintain koro. Prottek step er sathe ✅ (success indicator) ar ❌ (fail hole ki korbe) deya ache.

---

## Part 1 — Verify (5 minute)

Kaj: Ekhon porjonto ki ki setup ase check kora.

### 1.1 Coolify e Supabase service running?
- Coolify dashboard → Projects → tomar project → **Supabase** service ta "Running" (green) dekhale ✅.
- ❌ Red hole: Supabase service e click → **Restart** button.

### 1.2 Supabase Studio khulcho?
- Browser e: `https://supabase.paynoc.bd`
- Login credentials (env theke):
  - Username: `yhM1V0E9xrb3Iq0e`
  - Password: `pIcz0BaKyYkIx6grvQxDTOiD7y9Z6XAE`
- ✅ Studio dashboard dekha jabe.
- ❌ 502/404 hole: `SERVICE_URL_SUPABASEKONG` env check, Cloudflare A record → server IP point ase kina verify.

### 1.3 Database e tables ache?
Coolify → **supabase-db** service → **Terminal** tab kholo, ei command run koro:

```bash
psql -U postgres -d postgres -c "\dt public.*" | wc -l
```

- ✅ Output **35+** hoile OK (31 table + header + footer)
- ❌ 5 er kom hole: Part 2 e jao (schema install baki).

Detail check:
```bash
psql -U postgres -d postgres -c "SELECT count(*) FROM information_schema.tables WHERE table_schema='public';"
```
Expected: `31` ba tar besi.

---

## Part 2 — Missing schema install (jodi Part 1.3 fail hoy)

Coolify supabase-db terminal e:

```bash
# Extensions
psql -U supabase_admin -d postgres -c "CREATE EXTENSION IF NOT EXISTS pg_cron; CREATE EXTENSION IF NOT EXISTS pg_net; CREATE EXTENSION IF NOT EXISTS pgcrypto;"

# Main schema
psql -U postgres -d postgres -f /path/to/db/install.sql
```

`db/install.sql` file server e nai? Local theke copy:
```bash
# Local machine e:
scp db/install.sql root@your-server-ip:/tmp/
# Server e:
psql -U postgres -d postgres -f /tmp/install.sql
```

"already exists" errors ashle chinta korio na — normal.

---

## Part 3 — Storage buckets (ekhono na hole)

Coolify supabase-db terminal e ei SQL directly paste koro:

```sql
psql -U postgres -d postgres <<'EOF'
INSERT INTO storage.buckets (id, name, public) VALUES ('kyc','kyc',false) ON CONFLICT DO NOTHING;
INSERT INTO storage.buckets (id, name, public) VALUES ('disputes','disputes',false) ON CONFLICT DO NOTHING;

SET ROLE supabase_storage_admin;

DROP POLICY IF EXISTS "kyc owner rw" ON storage.objects;
CREATE POLICY "kyc owner rw" ON storage.objects FOR ALL TO authenticated
  USING (bucket_id='kyc' AND auth.uid()::text = (storage.foldername(name))[1])
  WITH CHECK (bucket_id='kyc' AND auth.uid()::text = (storage.foldername(name))[1]);

DROP POLICY IF EXISTS "disputes owner rw" ON storage.objects;
CREATE POLICY "disputes owner rw" ON storage.objects FOR ALL TO authenticated
  USING (bucket_id='disputes' AND auth.uid()::text = (storage.foldername(name))[1])
  WITH CHECK (bucket_id='disputes' AND auth.uid()::text = (storage.foldername(name))[1]);

RESET ROLE;
EOF
```

✅ "CREATE POLICY" 2 bar dekhale done.

---

## Part 4 — paynoc App Resource banano (Coolify)

1. Coolify dashboard → **+ New Resource**
2. **Public Repository** (ba Private hole GitHub connect kore Private Repository)
3. Repository URL: tomar GitHub repo URL (jekhane ei code ta push kora)
4. Branch: `main`
5. **Build Pack**: `Dockerfile` (auto-detect korar kotha; nahole manually select)
6. **Port**: `3000`
7. Name: `paynoc`
8. **Save** click

✅ Application created but "Not deployed" status.

---

## Part 5 — Environment Variables (paynoc app resource e)

paynoc app → **Environment Variables** tab → **Developer view** on → ei block ta paste:

```env
# Build-time (browser bundle)
VITE_SUPABASE_URL=https://supabase.paynoc.bd
VITE_SUPABASE_PUBLISHABLE_KEY=eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJpc3MiOiJzdXBhYmFzZSIsImlhdCI6MTc4Mjk3MTIyMCwiZXhwIjo0OTM4NjQ0ODIwLCJyb2xlIjoiYW5vbiJ9.VMNUv0Jw8D0VJlL4SlOcF8vwa67BgKrqvNiXN1OXYtY
VITE_SUPABASE_PROJECT_ID=self-hosted

# Runtime (SSR / server functions)
SUPABASE_URL=https://supabase.paynoc.bd
SUPABASE_PUBLISHABLE_KEY=eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJpc3MiOiJzdXBhYmFzZSIsImlhdCI6MTc4Mjk3MTIyMCwiZXhwIjo0OTM4NjQ0ODIwLCJyb2xlIjoiYW5vbiJ9.VMNUv0Jw8D0VJlL4SlOcF8vwa67BgKrqvNiXN1OXYtY
SUPABASE_SERVICE_ROLE_KEY=eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJpc3MiOiJzdXBhYmFzZSIsImlhdCI6MTc4Mjk3MTIyMCwiZXhwIjo0OTM4NjQ0ODIwLCJyb2xlIjoic2VydmljZV9yb2xlIn0.ujCJ7YPn79Iq7d9GE-u6HGvFOpUBvwXzc7h3TRskjig

# App runtime
NITRO_PRESET=node-server
PORT=3000
NODE_ENV=production
APP_URL=https://pay.paynoc.bd
```

**Save**. ✅

---

## Part 6 — Domains add (paynoc app resource e)

paynoc app → **Domains** tab e ei 4 ta add koro:

```
https://paynoc.bd
https://pay.paynoc.bd
https://docs.paynoc.bd
https://api.paynoc.bd
```

### Cloudflare check
Cloudflare DNS e ei 4 tar jonno **A record** thaka lagbe (server IP point kora):
- `paynoc.bd` → server IP (Proxy OFF — DNS only orange cloud grey)
- `pay` → server IP
- `docs` → server IP
- `api` → server IP

✅ Coolify auto SSL (Let's Encrypt) issue korbe deploy howar por.

---

## Part 7 — Deploy

paynoc app → **Deploy** button (top-right) click.

**Logs** tab e real-time build dekha jabe.

✅ Success indicators:
- Build sesh: "Build finished successfully"
- Container running: "Container started"
- Domain e green checkmark

❌ Fail hole common issues:
- **"VITE_SUPABASE_URL is undefined"** → env var save hoyni, Part 5 abar check
- **"Cannot find module"** → `bun.lockb` missing, GitHub e push korte hobe
- **"Port already in use"** → other app 3000 port dhorche, restart Coolify

Deploy sesh: `https://paynoc.bd` browser e kholo. Landing page dekha jabe ✅.

---

## Part 8 — First Signup + Super Admin promote

### 8.1 Sign up
- Browser: `https://paynoc.bd/auth`
- Email + password diye register koro (tomar own email use koro, jemon: `admin@paynoc.bd`)
- ✅ Signup successful message

### 8.2 Super admin banano
Coolify → supabase-db → Terminal:

```bash
psql -U postgres -d postgres <<EOF
INSERT INTO public.user_roles (user_id, role)
SELECT id, 'super_admin'
FROM auth.users
WHERE email = 'admin@paynoc.bd'
ON CONFLICT (user_id, role) DO NOTHING;
EOF
```

⚠️ `'admin@paynoc.bd'` er jaygay tomar signup email dao.

Verify:
```bash
psql -U postgres -d postgres -c "SELECT u.email, r.role FROM public.user_roles r JOIN auth.users u ON u.id=r.user_id WHERE r.role='super_admin';"
```

✅ Tomar email + `super_admin` dekha jabe.

### 8.3 Admin login test
- Browser: `https://paynoc.bd/ayman-login`
- Same email/password → **Admin dashboard** e redirect hoye jabe ✅.

---

## Part 9 — Cron Jobs schedule

Coolify → supabase-db → Terminal:

```bash
psql -U postgres -d postgres <<'EOF'
DO $$ BEGIN
  PERFORM cron.unschedule(jobname) FROM cron.job
  WHERE jobname LIKE 'paynoc-%';
EXCEPTION WHEN OTHERS THEN NULL; END $$;

SELECT cron.schedule('paynoc-expire-invoices', '*/5 * * * *', $c$
  SELECT net.http_post(
    url:='https://pay.paynoc.bd/api/public/hooks/expire-invoices',
    headers:='{"Content-Type":"application/json","apikey":"eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJpc3MiOiJzdXBhYmFzZSIsImlhdCI6MTc4Mjk3MTIyMCwiZXhwIjo0OTM4NjQ0ODIwLCJyb2xlIjoiYW5vbiJ9.VMNUv0Jw8D0VJlL4SlOcF8vwa67BgKrqvNiXN1OXYtY"}'::jsonb,
    body:='{}'::jsonb);
$c$);

SELECT cron.schedule('paynoc-webhook-retry', '*/2 * * * *', $c$
  SELECT net.http_post(
    url:='https://pay.paynoc.bd/api/public/hooks/webhook-retry',
    headers:='{"Content-Type":"application/json","apikey":"eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJpc3MiOiJzdXBhYmFzZSIsImlhdCI6MTc4Mjk3MTIyMCwiZXhwIjo0OTM4NjQ0ODIwLCJyb2xlIjoiYW5vbiJ9.VMNUv0Jw8D0VJlL4SlOcF8vwa67BgKrqvNiXN1OXYtY"}'::jsonb,
    body:='{}'::jsonb);
$c$);

SELECT cron.schedule('paynoc-run-recurring', '*/15 * * * *', $c$
  SELECT net.http_post(
    url:='https://pay.paynoc.bd/api/public/hooks/run-recurring',
    headers:='{"Content-Type":"application/json","apikey":"eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJpc3MiOiJzdXBhYmFzZSIsImlhdCI6MTc4Mjk3MTIyMCwiZXhwIjo0OTM4NjQ0ODIwLCJyb2xlIjoiYW5vbiJ9.VMNUv0Jw8D0VJlL4SlOcF8vwa67BgKrqvNiXN1OXYtY"}'::jsonb,
    body:='{}'::jsonb);
$c$);

SELECT cron.schedule('paynoc-run-digest', '0 * * * *', $c$
  SELECT net.http_post(
    url:='https://pay.paynoc.bd/api/public/hooks/run-digest',
    headers:='{"Content-Type":"application/json","apikey":"eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJpc3MiOiJzdXBhYmFzZSIsImlhdCI6MTc4Mjk3MTIyMCwiZXhwIjo0OTM4NjQ0ODIwLCJyb2xlIjoiYW5vbiJ9.VMNUv0Jw8D0VJlL4SlOcF8vwa67BgKrqvNiXN1OXYtY"}'::jsonb,
    body:='{}'::jsonb);
$c$);

SELECT cron.schedule('paynoc-run-payout-schedule', '*/30 * * * *', $c$
  SELECT net.http_post(
    url:='https://pay.paynoc.bd/api/public/hooks/run-payout-schedule',
    headers:='{"Content-Type":"application/json","apikey":"eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJpc3MiOiJzdXBhYmFzZSIsImlhdCI6MTc4Mjk3MTIyMCwiZXhwIjo0OTM4NjQ0ODIwLCJyb2xlIjoiYW5vbiJ9.VMNUv0Jw8D0VJlL4SlOcF8vwa67BgKrqvNiXN1OXYtY"}'::jsonb,
    body:='{}'::jsonb);
$c$);
EOF
```

Verify:
```bash
psql -U postgres -d postgres -c "SELECT jobname, schedule FROM cron.job WHERE jobname LIKE 'paynoc-%';"
```

✅ 5 ta job list e dekha jabe:
- paynoc-expire-invoices (5 min)
- paynoc-webhook-retry (2 min)
- paynoc-run-recurring (15 min)
- paynoc-run-digest (1 hour)
- paynoc-run-payout-schedule (30 min)

2 minute wait koro tarpor:
```bash
psql -U postgres -d postgres -c "SELECT jobname, status, return_message, start_time FROM cron.job_run_details ORDER BY start_time DESC LIMIT 10;"
```
✅ `status='succeeded'` dekha jabe.

---

## Part 10 — Smoke test (sob thik ache confirm)

### 10.1 Merchant signup
- Notun browser tab (incognito) → `https://paynoc.bd/auth`
- Notun email diye signup
- ✅ Dashboard e redirect

### 10.2 Payment method add
- Dashboard → **Payment Methods** → Add bKash
- Fill: label, account number, fee %
- ✅ Save + list e dekha jabe

### 10.3 Invoice create
- Dashboard → **Invoices** → **New Invoice**
- Amount: 100 BDT, description: "Test"
- ✅ Invoice created, `/pay/:id` URL peye jabe

### 10.4 Checkout test
- `/pay/:id` URL public browser (logged out) e kholo
- ✅ Branded checkout page, payment methods dekha jabe

### 10.5 API test
- Dashboard → **API Keys** → **Generate** (test mode)
- Terminal:
  ```bash
  curl -X POST https://api.paynoc.bd/api/public/v1/invoices \
    -H "Authorization: Bearer sk_test_YOUR_KEY" \
    -H "Content-Type: application/json" \
    -d '{"amount":50,"currency":"BDT","customer_email":"test@test.bd"}'
  ```
- ✅ JSON response with `id` + `checkout_url`

---

## Part 11 — ⚠️ Security cleanup (IMPORTANT — obossho koro)

Tumi chat e ei keys public korecho, ekhon compromised:
- `SERVICE_PASSWORD_JWT`
- `SERVICE_SUPABASESERVICE_KEY`
- `SERVICE_PASSWORD_POSTGRES`
- `SERVICE_PASSWORD_MINIO`
- All other `SERVICE_PASSWORD_*`

### Rotation steps:
1. Coolify → Supabase service → **Environment Variables**
2. Prottek `SERVICE_PASSWORD_*` er value **Regenerate** (or new random 32-char)
3. **Save** → Supabase service **Restart**
4. Notun anon + service_role key gulo copy koro (Supabase Studio → Settings → API)
5. paynoc app → env → `VITE_SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_SERVICE_ROLE_KEY` update
6. paynoc app **Redeploy**
7. Part 9 er cron jobs abar schedule koro notun anon key diye (purano gulo unschedule kore)

---

## Part 12 — Optional add-ons (jokhon dorkar)

### Email notifications (Resend)
- resend.com e signup → API key nao
- paynoc env e: `RESEND_API_KEY=re_xxx`
- Redeploy

### SMS (GatewayAPI)
- gatewayapi.com e signup
- paynoc env e: `GATEWAYAPI_TOKEN=xxx`
- Redeploy

### Slack/Discord alerts
- Slack: incoming webhook URL
- paynoc env: `SLACK_WEBHOOK_URL=https://hooks.slack.com/...`
- Discord: same, `DISCORD_WEBHOOK_URL=...`

---

## Final Checklist

- [ ] Supabase service running (Part 1.1)
- [ ] 31+ public tables (Part 1.3)
- [ ] Storage buckets kyc + disputes (Part 3)
- [ ] paynoc app resource created (Part 4)
- [ ] Env vars saved (Part 5)
- [ ] 4 domains added + Cloudflare A records (Part 6)
- [ ] App deployed + landing page loads (Part 7)
- [ ] First user signed up + promoted to super_admin (Part 8)
- [ ] 5 cron jobs scheduled + running (Part 9)
- [ ] Smoke test passed (Part 10)
- [ ] Leaked secrets rotated (Part 11) ⚠️

Sob check hole tomar PayNOC production ready 🎉

Kono step e atkale bolo — se step er logs/screenshot share korle debug kore dibo.
