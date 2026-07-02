# 🚀 PayNOC — FINAL Coolify Deploy Checklist (One-Shot)

Ei guide ta ek barite complete deploy — abar kichu korte hobe na. Prottek step tick koro.

---

## ✅ Pre-flight (repo te already ache — verify only)

| File | Purpose | Status |
|---|---|---|
| `Dockerfile` | Node runtime build | ✅ |
| `.env.example` | All required env vars | ✅ |
| `db/install.sql` | **All 24 migrations bundled** (1331 lines) | ✅ |
| `db/storage.sql` | KYC + disputes buckets | ✅ |
| `db/cron/schedule.sql` | 5 auto cron jobs | ✅ |
| `db/seed-admin.sql` | First super_admin promote | ✅ |

---

## STEP 1 — Coolify e 3 ta service create koro (same project)

### 1a. PostgreSQL (already done ✅)
- Name: `paynoc-db` → **Running**
- Internal host: `wysqfkxvagnzkys7xrswos3e`
- Password: `OuDw5EDT3r9i2Kup8ec2bWwLdu0Vws4GlAgWxgnEIJsrTqupHDLBDHHatEk6dHtn`

### 1b. Supabase stack (Auth lagbe — MUST)
`+ New Resource` → **Services** → search **"Supabase"** → deploy.
- Coolify auto ekta full Supabase stack (Auth + PostgREST + Storage + Studio) chalabe
- Notun password/anon key/service role key auto generate hobe → **Configuration** tab theke copy koro
- Sob environment variable Coolify auto set kore

⚠️ Simple hocche: **Supabase template use koro** — sei stack er niche jei Postgres ashbe seta te sob install koro. Alada `paynoc-db` er dorkar nei. (Jodi already ache, delete koro ba unused rakho.)

### 1c. PayNOC App
`+ New Resource` → **Application** → GitHub repo select → branch `main` → **Build Pack: Dockerfile** → **Port: 3000**.

---

## STEP 2 — Schema install (ek bar, forever)

**Supabase stack er Postgres shell kholo** (Coolify → supabase-db → Terminal → psql):

Paste kore Enter, order onujay:

1. `db/install.sql` er full content → paste → Enter (30-60 sec) → **31 tables, RLS, functions ready**
2. `db/storage.sql` → paste → Enter → **kyc + disputes buckets ready**
3. Cron enable:
   ```sql
   CREATE EXTENSION IF NOT EXISTS pg_cron;
   CREATE EXTENSION IF NOT EXISTS pg_net;
   ```
4. `db/cron/schedule.sql` open → find/replace:
   - `{{APP_URL}}` → `https://pay.paynoc.bd`
   - `{{ANON_KEY}}` → Supabase anon key
   → paste → Enter → **5 cron jobs scheduled**

✅ Database 100% ready. Abar chalate hobe na.

---

## STEP 3 — PayNOC App er Environment Variables

Coolify → PayNOC app → **Environment Variables** tab. Ei list exactly copy koro:

### 🏗️ Build Variables (checkbox ✅ **"Build Variable"** ON)
```
VITE_SUPABASE_URL=https://supabase.paynoc.bd
VITE_SUPABASE_PUBLISHABLE_KEY=<supabase anon key>
VITE_SUPABASE_PROJECT_ID=self-hosted
```

### ⚙️ Runtime Variables (Build Variable OFF)
```
SUPABASE_URL=https://supabase.paynoc.bd
SUPABASE_PUBLISHABLE_KEY=<supabase anon key>
SUPABASE_SERVICE_ROLE_KEY=<supabase service role key>
DATABASE_URL=postgres://postgres:<supabase-db-password>@<supabase-db-host>:5432/postgres
APEX_DOMAIN=paynoc.bd
NITRO_PRESET=node-server
PORT=3000

# Optional (email/SMS notification)
RESEND_API_KEY=
GATEWAYAPI_TOKEN=
```

---

## STEP 4 — Domains attach koro (Cloudflare DNS already ready)

Coolify → PayNOC app → **Domains** section, ei 4 ta add koro:

```
https://paynoc.bd          → landing / marketing
https://pay.paynoc.bd      → merchant portal + hosted checkout
https://docs.paynoc.bd     → documentation
https://api.paynoc.bd      → REST API + webhooks
```

Cloudflare a A record already ache → HTTPS Coolify auto (Let's Encrypt).

**Supabase er jonno alada domain:**
```
https://supabase.paynoc.bd → Supabase stack (Auth + PostgREST)
```
Cloudflare a `supabase` A record add koro (same VPS IP).

---

## STEP 5 — Auto Deploy ON

App → **Settings** → ✅ **Auto Deploy on Git Push** enable.

Ebar theke:
```
Lovable edit → GitHub auto push → Coolify auto rebuild → Live
```
Kono manual step nei.

---

## STEP 6 — Deploy button click koro 🚀

3-5 minute build → Green tick → `https://pay.paynoc.bd` live.

---

## STEP 7 — First super_admin banao (deploy er por)

1. `https://pay.paynoc.bd/auth` a jao → **Sign Up** (tomar email + password)
2. Supabase Postgres shell e paste:
```sql
UPDATE public.user_roles SET role = 'super_admin'
WHERE user_id = (SELECT id FROM auth.users WHERE email = 'TOMAR_EMAIL@example.com');
```
3. Refresh → `/ayman-login` a admin panel access.

---

## 🎯 Ekhon Full Automation ON

| Kaj | Auto? |
|---|---|
| Lovable edit → GitHub | ✅ |
| GitHub push → Coolify build | ✅ |
| SSL certificate | ✅ Let's Encrypt |
| Invoice auto-expire (5 min) | ✅ pg_cron |
| Webhook retry (2 min) | ✅ pg_cron |
| Recurring invoices (15 min) | ✅ pg_cron |
| Email digest (hourly) | ✅ pg_cron |
| Payout schedule (30 min) | ✅ pg_cron |
| Database backup | ✅ Coolify Backups tab e schedule |

---

## 🆘 Common Issues & Fix

| Error | Fix |
|---|---|
| App: `Unauthorized: No authorization header` | Env vars a `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY` missing — Step 3 recheck |
| App: `permission denied for table X` | `db/install.sql` complete run hoyni — Step 2.1 abar |
| Build fail: `VITE_SUPABASE_URL undefined` | Build Variable checkbox OFF ache — Step 3 recheck |
| `/ayman-login` a admin dekhchi na | Step 7 SQL run hoyni |
| Cron chalche na | `SELECT * FROM cron.job;` — 0 hole Step 2.4 abar |
| `pg_cron` extension error | Supabase-db → Settings → Extensions enable |

---

## 📌 Future Migration (Lovable notun kichu add korle)

Coolify auto app rebuild korbe. Sudhu notun SQL file thakle:
```
Supabase Postgres shell → db/migrations/<new-timestamp>.sql paste → Enter
```
Baki sob auto.

---

**Ei checklist follow koro ekbar — sob permanent. Deploy koro! 🎉**
