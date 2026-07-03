# PayNOC — Final Production Environment Variables (Coolify)

Ei file ta **final clean copy-paste guide**. Coolify e **duita alada resource** ache:

1. **Supabase service** — database/auth/storage backend
2. **PayNOC app** — GitHub theke deploy kora application

⚠️ **Important:** Supabase service er env ar PayNOC app er env mix korba na. Ek resource er env onno resource e paste korle deploy/auth/storage error hobe.

---

## 🔴 Age ei deployment error ta fix koro

Tomar log er main error:

```txt
bash: line 1: https//pay.paynoc.bd: No such file or directory
```

Eta code error na — **Coolify Domains field wrong format**. Tumi multiple domain ek line/ek field e diyecho, tai Coolify internally command ta venge felche.

### ✅ PayNOC app → Domains tab e thik vabe dao

Coolify → **paynoc app** → **Domains** tab:

1. Age existing wrong domain entry delete/clear koro.
2. Tarpor domain gulo **one by one separate entry** hisebe add koro:

```txt
https://paynoc.bd
```

```txt
https://pay.paynoc.bd
```

```txt
https://docs.paynoc.bd
```

```txt
https://api.paynoc.bd
```

❌ Ei vabe ekshathe dio na:

```txt
https://paynoc.bd https//pay.paynoc.bd https://docs.paynoc.bd https://api.paynoc.bd
```

✅ Prottek ta domain alada row/entry hobe. `https://` spelling thik thakbe — `https//` na.

### ✅ NODE_ENV build warning fix

Coolify → **paynoc app** → Environment Variables:

- `NODE_ENV=production` thakbe
- Kintu **Available at Buildtime checkbox OFF** thakbe
- `NODE_ENV` runtime-only hobe

Buildtime ON thakle Coolify warning dibe:

```txt
Build-time environment variable warning: NODE_ENV=production
```

---

---

## 🟦 1) Supabase service env

Path: Coolify → **supabase** service → **Environment Variables** → **Developer view ON**

### Ki korba

1. Existing Supabase service env select all kore replace korte chaile nicher block paste koro.
2. `SERVICE_ROLE_KEY_ASYMMETRIC=` line ta **empty rakho**, delete korba na.
3. Save koro.
4. Supabase service **Restart** koro.

### Copy-paste block — Supabase service only

Ei block ta **puro** paste koro. Coolify auto-generated `SERVICE_*` gulo already ache — sudhu domain + Studio lock + optional gulo confirm koro.

```env
# ==== Auto-generated (already ache, HAAT DEO NA) ====
SERVICE_PASSWORD_JWT=P7Nra2jCxLz0VrhUtvdqhPUPBqleqzj2
SERVICE_SUPABASEANON_KEY=eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJpc3MiOiJzdXBhYmFzZSIsImlhdCI6MTc4Mjk3MTIyMCwiZXhwIjo0OTM4NjQ0ODIwLCJyb2xlIjoiYW5vbiJ9.VMNUv0Jw8D0VJlL4SlOcF8vwa67BgKrqvNiXN1OXYtY
SERVICE_SUPABASESERVICE_KEY=eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJpc3MiOiJzdXBhYmFzZSIsImlhdCI6MTc4Mjk3MTIyMCwiZXhwIjo0OTM4NjQ0ODIwLCJyb2xlIjoic2VydmljZV9yb2xlIn0.ujCJ7YPn79Iq7d9GE-u6HGvFOpUBvwXzc7h3TRskjig
SERVICE_ROLE_KEY_ASYMMETRIC=
SERVICE_USER_ADMIN=yhM1V0E9xrb3Iq0e
SERVICE_PASSWORD_ADMIN=pIcz0BaKyYkIx6grvQxDTOiD7y9Z6XAE
SERVICE_PASSWORD_POSTGRES=mR6sQVbQq6fYuwrGJ2TdLPvnlvbNMXh3
SERVICE_PASSWORD_PGMETACRYPTO=2y7DnA2Pd3zGMakZNu4YdS5Tjdu7AW7Y
SERVICE_PASSWORD_LOGFLARE=imNL2OR1xUoFTTpmn4R9gYTmRD4OGkfJ
SERVICE_PASSWORD_LOGFLAREPRIVATE=iPz7njjDgz9VaR3QzIagQiJZ6FlJ7lXZ
SERVICE_USER_MINIO=Wc0CFNc2HNFyq9dd
SERVICE_PASSWORD_MINIO=P3MzFR75h8KEch5HkzWhjZfNqSaLTsEN
SERVICE_PASSWORD_SUPAVISORSECRET=s2E3U3iBDuYOAeHB1D2n3tsLXNExhIyX
SERVICE_PASSWORD_VAULTENC=6Dxyj5qmaoGec3i5QbG3UJNqicYpm37T

# ==== References (Coolify auto-fill kore, edit koro na) ====
JWT_SECRET=${SERVICE_PASSWORD_JWT}
ANON_KEY=${SERVICE_SUPABASEANON_KEY}
SERVICE_KEY=${SERVICE_SUPABASESERVICE_KEY}
SUPABASE_ANON_KEY=${SERVICE_SUPABASEANON_KEY}
SUPABASE_SERVICE_KEY=${SERVICE_SUPABASESERVICE_KEY}
SUPABASE_SECRET_KEY=
ANON_KEY_ASYMMETRIC=
AUTH_JWT_SECRET=${SERVICE_PASSWORD_JWT}
API_JWT_SECRET=${SERVICE_PASSWORD_JWT}
PGRST_JWT_SECRET=${SERVICE_PASSWORD_JWT}
PGRST_APP_SETTINGS_JWT_SECRET=${SERVICE_PASSWORD_JWT}
GOTRUE_JWT_SECRET=${SERVICE_PASSWORD_JWT}
METRICS_JWT_SECRET=${SERVICE_PASSWORD_JWT}
SECRET_PASSWORD_REALTIME=${SERVICE_PASSWORD_JWT}
PG_META_CRYPTO_KEY=${SERVICE_PASSWORD_PGMETACRYPTO}
CRYPTO_KEY=${SERVICE_PASSWORD_PGMETACRYPTO}
VAULT_ENC_KEY=${SERVICE_PASSWORD_VAULTENC}
SECRET_KEY_BASE=${SERVICE_PASSWORD_SUPAVISORSECRET}
LOGFLARE_API_KEY=${SERVICE_PASSWORD_LOGFLARE}
LOGFLARE_PUBLIC_ACCESS_TOKEN=${SERVICE_PASSWORD_LOGFLARE}
LOGFLARE_PRIVATE_ACCESS_TOKEN=${SERVICE_PASSWORD_LOGFLAREPRIVATE}
POSTGRES_PASSWORD=${SERVICE_PASSWORD_POSTGRES}
PGPASSWORD=${SERVICE_PASSWORD_POSTGRES}
DB_PASSWORD=${SERVICE_PASSWORD_POSTGRES}
PG_META_DB_PASSWORD=${SERVICE_PASSWORD_POSTGRES}
MINIO_ROOT_USER=${SERVICE_USER_MINIO}
MINIO_ROOT_PASSWORD=${SERVICE_PASSWORD_MINIO}
AWS_ACCESS_KEY_ID=${SERVICE_USER_MINIO}
AWS_SECRET_ACCESS_KEY=${SERVICE_PASSWORD_MINIO}

# ==== Studio LOCK (CRITICAL — public access bondho) ====
DASHBOARD_USERNAME=${SERVICE_USER_ADMIN}
DASHBOARD_PASSWORD=${SERVICE_PASSWORD_ADMIN}

# ==== Domain / URLs ====
SERVICE_URL_SUPABASEKONG=https://supabase.paynoc.bd
SERVICE_FQDN_SUPABASEKONG=supabase.paynoc.bd
SERVICE_URL_SUPABASEKONG_8000=https://supabase.paynoc.bd:8000
SERVICE_FQDN_SUPABASEKONG_8000=supabase.paynoc.bd:8000
SUPABASE_PUBLIC_URL=${SERVICE_URL_SUPABASEKONG}
API_EXTERNAL_URL=http://supabase-kong:8000
GOTRUE_SITE_URL=https://pay.paynoc.bd
ADDITIONAL_REDIRECT_URLS=https://pay.paynoc.bd/**,https://paynoc.bd/**
NEXT_PUBLIC_SUPABASE_URL=${SERVICE_URL_SUPABASEKONG}
NEXT_PUBLIC_SUPABASE_ANON_KEY=${SERVICE_SUPABASEANON_KEY}
STORAGE_PUBLIC_URL=${SERVICE_URL_SUPABASEKONG}

# ==== Postgres ====
POSTGRES_HOST=supabase-db
POSTGRES_HOSTNAME=supabase-db
POSTGRES_PORT=5432
POSTGRES_DB=postgres
PGRST_DB_SCHEMAS=public,storage,graphql_public
PGRST_DB_MAX_ROWS=1000
PGRST_DB_EXTRA_SEARCH_PATH=public

# ==== Auth ====
JWT_EXPIRY=3600
DISABLE_SIGNUP=false
ENABLE_EMAIL_SIGNUP=true
ENABLE_EMAIL_AUTOCONFIRM=false
ENABLE_ANONYMOUS_USERS=false
ENABLE_PHONE_SIGNUP=false
ENABLE_PHONE_AUTOCONFIRM=false

# ==== Studio ====
STUDIO_DEFAULT_ORGANIZATION=PayNOC
STUDIO_DEFAULT_PROJECT=PayNOC Production

# ==== Storage / Kong ====
STORAGE_TENANT_ID=storage-single-tenant
IMGPROXY_AUTO_WEBP=true
FUNCTIONS_VERIFY_JWT=false
KONG_STORAGE_CONNECT_TIMEOUT=60
KONG_STORAGE_WRITE_TIMEOUT=3600
KONG_STORAGE_READ_TIMEOUT=3600
KONG_STORAGE_REQUEST_BUFFERING=false
KONG_STORAGE_RESPONSE_BUFFERING=false

# ==== Pooler (Supavisor) ====
POOLER_TENANT_ID=paynoc
POOLER_DEFAULT_POOL_SIZE=20
POOLER_MAX_CLIENT_CONN=100
POOLER_DB_POOL_SIZE=5

# ==== SMTP (optional — email invite/recovery lagbe hole fill koro) ====
SMTP_ADMIN_EMAIL=
SMTP_HOST=
SMTP_PORT=587
SMTP_USER=
SMTP_PASS=
SMTP_SENDER_NAME=PayNOC

# ==== Mailer paths (default rakho) ====
MAILER_URLPATHS_INVITE=/auth/v1/verify
MAILER_URLPATHS_CONFIRMATION=/auth/v1/verify
MAILER_URLPATHS_RECOVERY=/auth/v1/verify
MAILER_URLPATHS_EMAIL_CHANGE=/auth/v1/verify

# ==== OpenAI (Studio SQL assistant — optional) ====
OPENAI_API_KEY=
```

**⚠️ Notes:**
- `SERVICE_ROLE_KEY_ASYMMETRIC` empty rakho — delete kora jabe na (docker-compose reference)
- `DASHBOARD_USERNAME` + `DASHBOARD_PASSWORD` thakar karone `https://supabase.paynoc.bd` open korle browser basic-auth prompt ashbe
- `SMTP_*` khali rakhle o Supabase cholbe, sudhu email invite/password reset kaj korbe na
- Domain `paynoc.bd` er jayga tomar actual domain diye replace koro jodi different hoy
- Supabase service env e `VITE_*`, `APP_URL`, `NITRO_PRESET`, `PORT`, `NODE_ENV`, `RESEND_API_KEY` rakhba na — egulo PayNOC app resource e jabe

---

## 🟩 2) PayNOC app env

Path: Coolify → **paynoc app** → **Environment Variables** → **Developer view ON**

### Ki korba

1. Existing PayNOC app env select all kore replace korte chaile nicher block paste koro.
2. Save korar age **Buildtime checkbox** thik koro:
   - `VITE_SUPABASE_URL` → Buildtime ON
   - `VITE_SUPABASE_PUBLISHABLE_KEY` → Buildtime ON
   - `VITE_SUPABASE_PROJECT_ID` → Buildtime ON
   - Baki sob → Buildtime OFF / runtime only
3. Domains tab e 4 ta domain alada alada entry dao.
4. Deploy koro.

### Copy-paste block — PayNOC app only

Ei ta **notun/pura block** — Supabase er sathe milano nai.

```env
# ==== BUILDTIME (checkbox ON — 3 tai) ====
VITE_SUPABASE_URL=https://supabase.paynoc.bd
VITE_SUPABASE_PUBLISHABLE_KEY=eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJpc3MiOiJzdXBhYmFzZSIsImlhdCI6MTc4Mjk3MTIyMCwiZXhwIjo0OTM4NjQ0ODIwLCJyb2xlIjoiYW5vbiJ9.VMNUv0Jw8D0VJlL4SlOcF8vwa67BgKrqvNiXN1OXYtY
VITE_SUPABASE_PROJECT_ID=self-hosted

# ==== RUNTIME (Buildtime checkbox OFF) ====
SUPABASE_URL=https://supabase.paynoc.bd
SUPABASE_PUBLISHABLE_KEY=eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJpc3MiOiJzdXBhYmFzZSIsImlhdCI6MTc4Mjk3MTIyMCwiZXhwIjo0OTM4NjQ0ODIwLCJyb2xlIjoiYW5vbiJ9.VMNUv0Jw8D0VJlL4SlOcF8vwa67BgKrqvNiXN1OXYtY
SUPABASE_SERVICE_ROLE_KEY=eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJpc3MiOiJzdXBhYmFzZSIsImlhdCI6MTc4Mjk3MTIyMCwiZXhwIjo0OTM4NjQ0ODIwLCJyb2xlIjoic2VydmljZV9yb2xlIn0.ujCJ7YPn79Iq7d9GE-u6HGvFOpUBvwXzc7h3TRskjig
NODE_ENV=production
NITRO_PRESET=node-server
PORT=3000
APP_URL=https://pay.paynoc.bd

# ==== Optional integrations (khali rakhle o cholbe, feature disabled thakbe) ====
RESEND_API_KEY=
GATEWAYAPI_TOKEN=
SLACK_WEBHOOK_URL=
DISCORD_WEBHOOK_URL=
```

### Buildtime checkbox final rule

| Variable | Buildtime checkbox |
| --- | --- |
| `VITE_SUPABASE_URL` | ✅ ON |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | ✅ ON |
| `VITE_SUPABASE_PROJECT_ID` | ✅ ON |
| `SUPABASE_URL` | ❌ OFF |
| `SUPABASE_PUBLISHABLE_KEY` | ❌ OFF |
| `SUPABASE_SERVICE_ROLE_KEY` | ❌ OFF |
| `NODE_ENV` | ❌ OFF |
| `NITRO_PRESET` | ❌ OFF |
| `PORT` | ❌ OFF |
| `APP_URL` | ❌ OFF |
| Optional keys | ❌ OFF |

### Domains tab final rule

PayNOC app → Domains tab e **separate entry** hisebe add koro:

- `https://paynoc.bd`
- `https://pay.paynoc.bd`
- `https://docs.paynoc.bd`
- `https://api.paynoc.bd`

⚠️ Ek line e sob domain dio na. Ek domain ek entry.

---

## ✅ Final verify checklist

- [ ] Supabase service e `DASHBOARD_USERNAME` + `DASHBOARD_PASSWORD` set → `https://supabase.paynoc.bd` khulle browser basic-auth prompt ashbe
- [ ] PayNOC app e `VITE_*` 3ta Buildtime **ON**, baki sob **OFF**
- [ ] PayNOC app Domains tab e 4 ta domain **separate entry** hisebe ache
- [ ] `NODE_ENV=production` runtime-only, Buildtime OFF
- [ ] Supabase service restart kora hoyeche
- [ ] PayNOC app deploy kora hoyeche
- [ ] `https://pay.paynoc.bd` khulle app load hoy, `/auth` e signup kora jay
- [ ] Deploy sesh hole ei chat e paste kora **sob key/password rotate koro** (compromised)

---

## Error hole quick diagnosis

### Error: `https//pay.paynoc.bd: No such file or directory`

Fix: PayNOC app → Domains tab clear kore 4 ta domain alada alada entry dao. `https://` spelling thik koro.

### Warning: `NODE_ENV=production skips devDependencies`

Fix: PayNOC app → Environment Variables → `NODE_ENV` er **Available at Buildtime OFF** koro.

### Error: `SERVICE_ROLE_KEY_ASYMMETRIC delete kora jacche na`

Fix: Delete korba na. Supabase service env e ei line empty rakho:

```env
SERVICE_ROLE_KEY_ASYMMETRIC=
```

### Supabase Studio password chara open hoy

Fix: Supabase service env e ei duita thakte hobe, tarpor service restart:

```env
DASHBOARD_USERNAME=${SERVICE_USER_ADMIN}
DASHBOARD_PASSWORD=${SERVICE_PASSWORD_ADMIN}
```
