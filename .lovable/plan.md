## Ha, sob thik ache — tobe 2 ta jaygay bhag korte hobe

Tumi je block ta paste korecho, oita 2 ta alada resource er env — ekshathe eki jaygay dile kaj korbe na.

### Resource 1: `supabase` service (already exists, ei ta chalais na)
Upor er portion (`SERVICE_PASSWORD_JWT` theke `SERVICE_FQDN_SUPABASEKONG_8000` porjonto) — eta **Coolify → Supabase service → Environment Variables** e already ache. Kichu korte hobe na, hath dio na.

### Resource 2: `paynoc` app (ekhane ei 4 ta section only)
Coolify → **notun Application resource banao** (Docker / Nixpacks, GitHub repo connected) → **Environment Variables** tab e SHUDHU nicher ta paste koro:

```env
# Build-time (browser)
VITE_SUPABASE_URL=https://supabase.paynoc.bd
VITE_SUPABASE_PUBLISHABLE_KEY=eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJpc3MiOiJzdXBhYmFzZSIsImlhdCI6MTc4Mjk3MTIyMCwiZXhwIjo0OTM4NjQ0ODIwLCJyb2xlIjoiYW5vbiJ9.VMNUv0Jw8D0VJlL4SlOcF8vwa67BgKrqvNiXN1OXYtY
VITE_SUPABASE_PROJECT_ID=self-hosted

# Runtime (SSR)
SUPABASE_URL=https://supabase.paynoc.bd
SUPABASE_PUBLISHABLE_KEY=eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJpc3MiOiJzdXBhYmFzZSIsImlhdCI6MTc4Mjk3MTIyMCwiZXhwIjo0OTM4NjQ0ODIwLCJyb2xlIjoiYW5vbiJ9.VMNUv0Jw8D0VJlL4SlOcF8vwa67BgKrqvNiXN1OXYtY
SUPABASE_SERVICE_ROLE_KEY=eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJpc3MiOiJzdXBhYmFzZSIsImlhdCI6MTc4Mjk3MTIyMCwiZXhwIjo0OTM4NjQ0ODIwLCJyb2xlIjoic2VydmljZV9yb2xlIn0.ujCJ7YPn79Iq7d9GE-u6HGvFOpUBvwXzc7h3TRskjig

# App runtime
NITRO_PRESET=node-server
PORT=3000
NODE_ENV=production
APP_URL=https://pay.paynoc.bd
```

Notifications er 4 ta (RESEND, GATEWAYAPI, SLACK, DISCORD) — jodi chao pore add korte parbe, ekhon skip.

### Ki ki baki

1. **paynoc app resource banano** (Coolify → New Resource → Public Repository → tomar GitHub repo → Dockerfile detect korbe).
2. Upor er env block ta oi app-er Environment Variables e paste.
3. App resource → **Domains** tab:
   - `https://paynoc.bd`
   - `https://pay.paynoc.bd`
   - `https://docs.paynoc.bd`
   - `https://api.paynoc.bd`
4. **Deploy** button click.
5. Deploy sesh hole `https://paynoc.bd/auth` e sign up koro.
6. Supabase DB terminal e ei SQL run kore nijeke super_admin banao:
   ```sql
   INSERT INTO public.user_roles (user_id, role)
   SELECT id, 'super_admin' FROM auth.users WHERE email='tomar@email.com'
   ON CONFLICT DO NOTHING;
   ```
7. Sob sesh hole `db/cron/schedule.sql` er `{{APP_URL}}` → `https://pay.paynoc.bd` and `{{ANON_KEY}}` → upor er anon key diye replace kore Supabase DB terminal e run.

### ⚠️ Security warning (important)
Tumi public chat e JWT secret, service_role key, postgres/MinIO password sob paste korecho. Ei keys gulo ekhon **compromised**. Deploy verify howar por Coolify → Supabase service → env vars regenerate (notun random password) → restart → tarpor notun anon/service key gulo paynoc app er env e update kore redeploy.

### Confirm

Bolo: **"paynoc app resource banano ache Coolify te?"** — na thakle ami step-by-step wizard er screenshot-guide banai dibo.
