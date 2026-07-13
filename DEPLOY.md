# PayNOC — Coolify Production Deploy (Bangla A→Z)

Domains:
- `paynoc.bd` → PayNOC app
- `pay.paynoc.bd`, `docs.paynoc.bd`, `api.paynoc.bd` → PayNOC app (একই container, আলাদা domain)
- `db.paynoc.com` → backend API gateway (`/auth/v1/*`, `/rest/v1/*`, `/storage/v1/*`)

---

## Auto-Deploy (GitHub → Coolify)

Lovable-এ edit করলে সেটা GitHub-এ push হয়, GitHub push হলে Coolify auto-rebuild করে। দুইটা path — যেকোনো একটা যথেষ্ট, দুইটাই দিলে backup।

### Option A — Coolify built-in GitHub App (recommended, সবচেয়ে সহজ)

1. Coolify → PayNOC app resource → **Source** tab → GitHub App connect করো (একবারই)।
2. একই page-এ **"Auto Deploy on push"** toggle **ON**।
3. Branch = `main` set করো।
4. এখন Lovable-এ যেকোনো edit → GitHub-এ push → Coolify auto-deploy। কিছুই manually করতে হয় না।

### Option B — GitHub Actions workflow (repo-তে already আছে: `.github/workflows/deploy.yml`)

Option A না চাইলে বা backup হিসেবে use করতে চাইলে:

1. Coolify → PayNOC app → **Webhooks** tab → **Deploy webhook URL** copy করো (example: `https://coolify.yourhost.com/api/v1/deploy?uuid=...&force=false`)।
2. Coolify → **Keys & Tokens** → **Create new token** (read+write) → copy।
3. GitHub repo → **Settings → Secrets and variables → Actions → New repository secret**:
   - `COOLIFY_WEBHOOK_URL` = step 1 এর URL
   - `COOLIFY_API_TOKEN` = step 2 এর token
4. `main`-এ push হলে workflow auto-run হবে এবং Coolify-কে deploy trigger করবে। Actions tab-এ status দেখা যাবে।

### Verify auto-deploy

- Lovable-এ একটা ছোট edit করো (e.g. footer text) → GitHub commit হবে → Coolify dashboard-এ new deployment start হতে দেখা যাবে (~30-60 sec)।
- Fail করলে Coolify → app → **Deployments** log check করো।

---



## Part 0 — Cloudflare DNS

সব A record → Coolify server IP, Proxy = **DNS only** (grey cloud)।

| Type | Name | Value |
|---|---|---|
| A | paynoc.bd | `<COOLIFY_IP>` |
| A | pay | `<COOLIFY_IP>` |
| A | docs | `<COOLIFY_IP>` |
| A | api | `<COOLIFY_IP>` |
| A | db | `<COOLIFY_IP>` |

---

## Part 1 — Backend Resource (Coolify template)

### 1.1 Domain mapping (এইটা ঠিক না হলে auth/login fail করবে)

Coolify → backend resource → **Domains** tab:

- `https://db.paynoc.com` **শুধুমাত্র** API gateway/Kong service, port `8000`-এ map করবে।
- `db.paynoc.com/auth/v1/settings` browser/curl থেকে JSON return করতে হবে। HTML/404 এলে domain ভুল service-এ mapped।
- `supabase-studio` / dashboard service-এ `db.paynoc.com` map করবে না। Studio লাগলে আলাদা private/admin domain use করো।
- App যে API gateway use করে, সেটার `/auth/v1` এবং `/rest/v1` basic-auth দিয়ে block করবে না; security RLS + anon/service keys দিয়ে হবে।

Save → **Redeploy** পুরো stack।

### 1.2 Environment Variables (Developer View)

Coolify template auto-generate করে দেয় (POSTGRES_PASSWORD, JWT_SECRET, ANON_KEY, SERVICE_ROLE_KEY, LOGFLARE_* ইত্যাদি) — সেগুলোতে হাত দিবে না। শুধু নিচেরগুলো verify/override করো:

```env
# --- Studio Kong basic-auth (MUST — না হলে db.paynoc.bd public) ---
DASHBOARD_USERNAME=ayman
DASHBOARD_PASSWORD=<STRONG_PASSWORD_32_CHARS>

# Coolify template variant হলে এটাও add করো (দুইটাই safe):
SERVICE_USER_ADMIN=ayman
SERVICE_PASSWORD_ADMIN=<SAME_STRONG_PASSWORD>

# --- URLs ---
SITE_URL=https://paynoc.bd
API_EXTERNAL_URL=https://db.paynoc.com
SUPABASE_PUBLIC_URL=https://db.paynoc.com
GOTRUE_SITE_URL=https://paynoc.bd
ADDITIONAL_REDIRECT_URLS=https://paynoc.bd,https://pay.paynoc.bd,https://docs.paynoc.bd,https://api.paynoc.bd,https://paynoc.bd/auth/callback

# --- Studio branding ---
STUDIO_DEFAULT_ORGANIZATION=PayNOC
STUDIO_DEFAULT_PROJECT=paynoc

# --- Auth ---
DISABLE_SIGNUP=false
ENABLE_EMAIL_SIGNUP=true
ENABLE_EMAIL_AUTOCONFIRM=true
ENABLE_ANONYMOUS_USERS=false
ENABLE_PHONE_SIGNUP=false
ENABLE_PHONE_AUTOCONFIRM=false
JWT_EXPIRY=3600
```

Save → **Redeploy** → `https://db.paynoc.com/auth/v1/settings` open করলে JSON response আসতে হবে।

### 1.3 Login এখনো backend unreachable দেখাচ্ছে? Checklist

1. DNS-এ `db.paynoc.com` Coolify server IP-তে point করছে।
2. Coolify Domains tab-এ `db.paynoc.com` **শুধু** API gateway/Kong `:8000` — PayNOC app বা Studio service-এ না।
3. `curl https://db.paynoc.com/auth/v1/settings` JSON return করে; HTML/404 হলে mapping ভুল।
4. App resource env/build args-এ `VITE_SUPABASE_URL` এবং `SUPABASE_URL` দুটোই `https://db.paynoc.com`।
5. `VITE_SUPABASE_PUBLISHABLE_KEY` / `SUPABASE_PUBLISHABLE_KEY` backend anon key; service-role key browser `VITE_*` variable-এ দেবে না।

---

## Part 2 — Database Schema

Backend SQL editor / psql → schema run করবে।

### 2.1 Extensions
```sql
CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;
```

### 2.2 Schema
Repo থেকে `db/install.sql` পুরো copy → SQL Editor → Run।
তারপর `db/storage.sql` → Run।
তারপর `db/cron/schedule.sql` → Run।

> "already exists" warnings ignore করো।

---

## Part 3 — PayNOC App Resource

Coolify → **New Resource → Public Repository** → Build Pack: **Dockerfile** → Port: `3000`।

### 3.1 Domains
আলাদা আলাদা entry হিসেবে (এক লাইনে multiple দিলে fail করবে):
- `https://paynoc.bd`
- `https://pay.paynoc.bd`
- `https://docs.paynoc.bd`
- `https://api.paynoc.bd`

### 3.2 Environment Variables (Developer View)

Backend resource থেকে actual value copy করে বসাও। `VITE_*` গুলোর জন্য "Available at build time" **ON** করবে।

```env
# --- Runtime ---
NODE_ENV=production
PORT=3000

# --- Frontend (build + runtime, VITE_ prefix = browser-visible) ---
VITE_SUPABASE_URL=https://db.paynoc.com
VITE_SUPABASE_PUBLISHABLE_KEY=<SERVICE_SUPABASEANON_KEY>
VITE_SUPABASE_ANON_KEY=<SERVICE_SUPABASEANON_KEY>
VITE_SUPABASE_PROJECT_ID=paynoc

# --- Server-only (runtime, browser এ যায় না) ---
SUPABASE_URL=https://db.paynoc.com
SUPABASE_PUBLISHABLE_KEY=<SERVICE_SUPABASEANON_KEY>
SUPABASE_ANON_KEY=<SERVICE_SUPABASEANON_KEY>
SUPABASE_SERVICE_ROLE_KEY=<SERVICE_SUPABASESERVICE_KEY>
SUPABASE_JWT_SECRET=<SERVICE_PASSWORD_JWT>
SUPABASE_PROJECT_ID=paynoc

# --- App secret (invoice signing, session) ---
PAYNOC_SECRET=<64_CHAR_RANDOM_openssl_rand_hex_32>

# --- Optional integrations (empty ok) ---
RESEND_API_KEY=
GATEWAYAPI_API_KEY=
LOVABLE_API_KEY=
OPENAI_API_KEY=
```

Deploy → build success হলে `https://paynoc.bd` load হবে।

---

## Part 4 — Super Admin

1. `https://paynoc.bd/auth` → email দিয়ে sign up।
2. Supabase Studio → SQL Editor:
```sql
INSERT INTO public.user_roles (user_id, role)
SELECT id, 'super_admin' FROM auth.users WHERE email = 'you@example.com'
ON CONFLICT DO NOTHING;
```
3. `https://paynoc.bd/ayman-login` → admin panel।

---

## Part 5 — Verification

- [ ] `curl https://db.paynoc.com/auth/v1/settings` → JSON response
- [ ] `https://paynoc.bd` → landing page load
- [ ] `/auth` signup/login কাজ করে
- [ ] `/dashboard` load হয়
- [ ] `/ayman-login` → super admin
- [ ] Invoice create → `/pay/<id>` render হয়

---

## Part 6 — Security (deploy শেষে)

Chat/repo-এ যেসব key leak হয়েছে সব Coolify Supabase → **Rotate**:
- `JWT_SECRET` → auto-regenerates `ANON_KEY` + `SERVICE_ROLE_KEY`
- Rotate করার পর PayNOC app env-এ নতুন keys বসিয়ে redeploy।
- `PAYNOC_SECRET` 64-char random।
- `DASHBOARD_PASSWORD` 32+ char strong।

---

## Troubleshooting

| Error | Fix |
|---|---|
| Login-এ backend unreachable | `db.paynoc.com` API gateway/Kong `:8000` এ mapped; `/auth/v1/settings` JSON; app env/build args একই URL |
| `must be owner of table objects` | `db/storage.sql` ব্যবহার করো |
| `Cannot delete environment variable` | Delete না, empty রেখে save |
| Build fail: Node syntax `parseEnv` | Dockerfile ইতিমধ্যে `oven/bun:1.2-alpine` — rebuild |
| `https//pay.paynoc.bd: No such file` | প্রতিটা domain আলাদা entry |
| Frontend এ `Missing Supabase env` | `VITE_*` variables build-time ON; app redeploy |

---

কোন step-এ আটকালে exact error paste করো।
