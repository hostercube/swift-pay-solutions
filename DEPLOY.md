# PayNOC — Coolify Production Deploy (Bangla A→Z)

নতুন Coolify Supabase resource + নতুন PayNOC app deploy করার একদম clean guide।
Domains: `paynoc.bd` (app), `pay.paynoc.bd`, `docs.paynoc.bd`, `api.paynoc.bd`, `db.paynoc.bd` (Supabase Studio)।

---

## Part 0 — Cloudflare DNS (আগে করে রাখো)

সব A record → Coolify server IP, Proxy: **DNS only** (grey cloud)।

| Type | Name | Value |
|---|---|---|
| A | paynoc.bd | `<COOLIFY_IP>` |
| A | pay | `<COOLIFY_IP>` |
| A | docs | `<COOLIFY_IP>` |
| A | api | `<COOLIFY_IP>` |
| A | db | `<COOLIFY_IP>` |

---

## Part 1 — Coolify-এ নতুন Supabase Resource

1. **Projects → New Resource → Databases → Supabase**।
2. Server select করো, deploy করো।
3. Resource তৈরি হলে **Environment Variables (Developer View)** খুলে নিচের block-টা **Add/Update** করো (যেগুলো auto-generate হয়েছে সেগুলো তে হাত দিও না, delete-blocked variable empty রাখো):

```env
# --- Studio & Domain ---
SITE_URL=https://paynoc.bd
API_EXTERNAL_URL=https://db.paynoc.bd
SUPABASE_PUBLIC_URL=https://db.paynoc.bd
STUDIO_DEFAULT_ORGANIZATION=PayNOC
STUDIO_DEFAULT_PROJECT=paynoc

# --- Studio Lock (MUST — না হলে dashboard public হয়ে যাবে) ---
SERVICE_USER_ADMIN=ayman
SERVICE_PASSWORD_ADMIN=<STRONG_PASSWORD_HERE>

# --- Auth ---
DISABLE_SIGNUP=false
ENABLE_EMAIL_SIGNUP=true
ENABLE_EMAIL_AUTOCONFIRM=true
ENABLE_ANONYMOUS_USERS=false
JWT_EXPIRY=3600

# --- Redirects ---
ADDITIONAL_REDIRECT_URLS=https://paynoc.bd,https://pay.paynoc.bd,https://docs.paynoc.bd,https://api.paynoc.bd
```

> Auto-generated রাখবে: `POSTGRES_PASSWORD`, `JWT_SECRET`, `ANON_KEY`, `SERVICE_ROLE_KEY`, `SECRET_KEY_BASE`, `VAULT_ENC_KEY`, `LOGFLARE_*` — এগুলো Coolify manage করে।

4. **Domains tab** → `supabase-kong` service / port `8000`-এ **শুধু** `https://db.paynoc.bd` set করো।
   - `supabase-studio` / port `3000`-এ public domain দেবে না — দিলে password ছাড়া dashboard খুলে যাবে।
   - `supabase-meta`, `supabase-db`, `supabase-auth`, `supabase-rest`, `supabase-storage`, `analytics`—কোনোটায় domain দেবে না।
5. Save → **Redeploy**।
6. Browser incognito/private window থেকে `https://db.paynoc.bd` visit → basic-auth prompt আসতে হবে (username: `ayman`, password: উপরেরটা)।

### 1.1 যদি `https://db.paynoc.bd` password ছাড়া direct dashboard খুলে যায়

এটা app-code/database error না; Coolify routing/variable issue। এই order-এ fix করো:

1. Coolify → Supabase resource → **Domains** tab।
2. `https://db.paynoc.bd` যদি `supabase-studio` / port `3000`-এ থাকে, **remove** করো।
3. `https://db.paynoc.bd` শুধু `supabase-kong` / port `8000`-এ add করো।
4. Developer View env-এ নিচের দুটা exact variable আছে কিনা দেখো — পুরনো `DASHBOARD_USERNAME`/`DASHBOARD_PASSWORD` নয়:

```env
SERVICE_USER_ADMIN=ayman
SERVICE_PASSWORD_ADMIN=<STRONG_PASSWORD_HERE>
```

5. Save → Redeploy/Restart পুরো Supabase stack।
6. Browser cache/basic-auth session clear করতে incognito/private window দিয়ে আবার test করো।

> তোমার দেওয়া `auth`, `storage`, `analytics` logs healthy/normal দেখাচ্ছে; এই direct-access problem সাধারণত domain ভুল service-এ point করা বা `SERVICE_USER_ADMIN`/`SERVICE_PASSWORD_ADMIN` missing থাকার কারণে হয়।

---

## Part 2 — Database Schema Install (একবার)

Coolify → Supabase resource → **db** container → **Terminal** খোলো, তারপর:

```bash
psql -U postgres -d postgres
```

### 2.1 Extensions
```sql
CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;
\q
```

### 2.2 Main schema
Repo থেকে `db/install.sql` copy করে Studio-এর **SQL Editor** এ paste করে Run করো (সহজতম রাস্তা)।
অথবা terminal থেকে:
```bash
cat /path/to/install.sql | psql -U postgres -d postgres
```

"already exists" warning normal — ignore করো।

### 2.3 Storage buckets & policies
Studio SQL Editor-এ `db/storage.sql` paste করে Run।
(এটা `SET ROLE supabase_storage_admin` ব্যবহার করে, তাই ownership error আসবে না।)

### 2.4 Cron jobs
`db/cron/schedule.sql` paste করে Run। এতে digest, payout, recurring, webhook-retry, invoice-expiry cron register হবে।

> ⚠️ Cron SQL-এর ভিতর app-এর public URL hardcoded — deploy করার পর যদি domain বদলাও, cron গুলো re-schedule করতে হবে।

---

## Part 3 — PayNOC App Resource

1. **New Resource → Public Repository** (GitHub link) → Build Pack: **Dockerfile**।
2. Port: `3000`।
3. **Domains tab** → আলাদা আলাদা entry হিসেবে যোগ করো (এক লাইনে একাধিক domain দিলে deploy fail করবে):
   - `https://paynoc.bd`
   - `https://pay.paynoc.bd`
   - `https://docs.paynoc.bd`
   - `https://api.paynoc.bd`

### 3.1 Environment Variables (Developer View — full replace)

`<...>` জায়গায় Supabase resource-এর real value বসাও (Supabase env থেকে copy করবে)।

```env
# --- Runtime ---
NODE_ENV=production
PORT=3000

# --- Public (build + runtime) ---
VITE_SUPABASE_URL=https://db.paynoc.bd
VITE_SUPABASE_PUBLISHABLE_KEY=<ANON_KEY>
VITE_SUPABASE_ANON_KEY=<ANON_KEY>
VITE_SUPABASE_PROJECT_ID=paynoc

# --- Server-only (runtime) ---
SUPABASE_URL=https://db.paynoc.bd
SUPABASE_PUBLISHABLE_KEY=<ANON_KEY>
SUPABASE_ANON_KEY=<ANON_KEY>
SUPABASE_SERVICE_ROLE_KEY=<SERVICE_ROLE_KEY>
SUPABASE_JWT_SECRET=<JWT_SECRET>

# --- App secrets ---
PAYNOC_SECRET=<GENERATE_LONG_RANDOM_64_CHARS>

# --- Optional integrations (empty রাখলেও চলবে) ---
RESEND_API_KEY=
GATEWAYAPI_API_KEY=
LOVABLE_API_KEY=
OPENAI_API_KEY=
```

**Build-time toggle:** শুধু `VITE_*` variables গুলোর জন্য "Available at build time" ON করো। বাকিগুলো runtime-only।

4. **Deploy** press করো।

---

## Part 4 — Super Admin বানাও

Deploy সফল হলে:
1. `https://paynoc.bd/auth` এ যাও → নিজের email দিয়ে sign up করো।
2. Supabase Studio → SQL Editor:

```sql
INSERT INTO public.user_roles (user_id, role)
SELECT id, 'super_admin' FROM auth.users WHERE email = 'you@example.com'
ON CONFLICT DO NOTHING;
```

3. এখন `https://paynoc.bd/ayman-login` দিয়ে admin panel-এ login করো।

---

## Part 5 — Verification Checklist

- [ ] `https://db.paynoc.bd` → basic-auth prompt আসে; direct dashboard খোলে না
- [ ] `https://paynoc.bd` → landing page load হয়
- [ ] `/auth` → signup / login কাজ করে
- [ ] `/ayman-login` → super admin login হয়
- [ ] Merchant dashboard → invoice create হয়
- [ ] `/pay/<invoiceId>` → checkout page render হয়
- [ ] Supabase Studio → `profiles`, `invoices`, `user_roles` tables আছে

---

## Part 6 — Security (Deploy শেষ হলেই করো)

1. Coolify → Supabase → **Rotate** `JWT_SECRET`, `ANON_KEY`, `SERVICE_ROLE_KEY` (যদি chat/repo-তে কখনো leak হয়ে থাকে)।
2. Rotate হওয়ার পর PayNOC app env-এ নতুন keys বসিয়ে redeploy।
3. `PAYNOC_SECRET` কমপক্ষে 64-char random হতে হবে।
4. `DASHBOARD_PASSWORD` strong রাখো।

---

## Troubleshooting

| Error | Fix |
|---|---|
| `must be owner of table objects` | `db/storage.sql` ব্যবহার করো, direct policy CREATE না |
| `permission denied for function pg_read_file` | Studio SQL Editor থেকে schema install করো, terminal `\i` না |
| `Cannot delete environment variable` | Delete না, empty রেখে save |
| Build fail: Node syntax error | Dockerfile ইতিমধ্যে `oven/bun:1.2-alpine` ব্যবহার করে — rebuild |
| `https//pay.paynoc.bd: No such file` | Domains tab-এ প্রতিটা domain আলাদা entry হিসেবে দাও |
| Studio public accessible | Domain শুধু `supabase-kong:8000`-এ দাও, `supabase-studio:3000` থেকে remove করো; env-এ `SERVICE_USER_ADMIN` + `SERVICE_PASSWORD_ADMIN` set করে redeploy |

---

Deploy করার সময় কোন step-এ আটকালে exact error paste করে দাও।
