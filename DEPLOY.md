# PayNOC — Coolify Production Deploy (Bangla A→Z)

Domains:
- `paynoc.bd` → PayNOC app
- `pay.paynoc.bd`, `docs.paynoc.bd`, `api.paynoc.bd` → PayNOC app (একই container, আলাদা domain)
- `db.paynoc.bd` → Supabase Studio (Kong gateway)

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

## Part 1 — Supabase Resource (Coolify template)

### 1.1 Domain mapping (এইটা ঠিক না হলে dashboard public)

Coolify → Supabase resource → **Domains** tab:

- `https://db.paynoc.bd` **শুধুমাত্র** `supabase-kong` service, port `8000`-এ map করবে।
- `supabase-studio` (port `3000`), `supabase-meta`, `supabase-auth`, `supabase-rest`, `supabase-storage`, `analytics`, `supabase-db`, `minio`, `imgproxy`, `vector` — কোনোটার সাথে public domain map করবে না।
- যদি আগে studio:3000 এ domain দেওয়া থাকে, **remove** করো। Studio-তে নিজের কোনো auth নাই — Kong basic-auth দিয়ে protect হয়।

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
API_EXTERNAL_URL=https://db.paynoc.bd
SUPABASE_PUBLIC_URL=https://db.paynoc.bd
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

Save → **Redeploy** → incognito window থেকে `https://db.paynoc.bd` visit করলে browser basic-auth prompt আসবে।

### 1.3 এখনো password ছাড়া ঢুকে যাচ্ছে? Checklist

1. Domains tab-এ `db.paynoc.bd` **শুধু** `supabase-kong:8000` — অন্য কোনো service-এ নাই।
2. `DASHBOARD_USERNAME` + `DASHBOARD_PASSWORD` **উভয়ই** set আছে (empty না)।
3. Save করার পর পুরো Supabase stack **Restart** (শুধু Kong না — full redeploy)।
4. Browser cache clear / incognito window use করো (basic-auth session cached থাকে)।
5. `curl -I https://db.paynoc.bd` চালালে `HTTP/1.1 401 Unauthorized` + `WWW-Authenticate: Basic` header আসতে হবে। 200 আসলে Kong basic-auth active না।

---

## Part 2 — Database Schema

Supabase Studio (`https://db.paynoc.bd`) → login → **SQL Editor**।

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

Supabase resource থেকে actual value copy করে বসাও। `VITE_*` গুলোর জন্য "Available at build time" **ON** করবে।

```env
# --- Runtime ---
NODE_ENV=production
PORT=3000

# --- Frontend (build + runtime, VITE_ prefix = browser-visible) ---
VITE_SUPABASE_URL=https://db.paynoc.bd
VITE_SUPABASE_PUBLISHABLE_KEY=<SERVICE_SUPABASEANON_KEY>
VITE_SUPABASE_ANON_KEY=<SERVICE_SUPABASEANON_KEY>
VITE_SUPABASE_PROJECT_ID=paynoc

# --- Server-only (runtime, browser এ যায় না) ---
SUPABASE_URL=https://db.paynoc.bd
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

- [ ] `curl -I https://db.paynoc.bd` → `401 Unauthorized` (basic-auth prompt)
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
| `db.paynoc.bd` password ছাড়া খোলে | Domain শুধু `supabase-kong:8000` এ; `DASHBOARD_USERNAME`+`DASHBOARD_PASSWORD` set; full stack redeploy; incognito test |
| `must be owner of table objects` | `db/storage.sql` ব্যবহার করো |
| `Cannot delete environment variable` | Delete না, empty রেখে save |
| Build fail: Node syntax `parseEnv` | Dockerfile ইতিমধ্যে `oven/bun:1.2-alpine` — rebuild |
| `https//pay.paynoc.bd: No such file` | প্রতিটা domain আলাদা entry |
| Frontend এ `Missing Supabase env` | `VITE_*` variables build-time ON; app redeploy |

---

কোন step-এ আটকালে exact error paste করো।
