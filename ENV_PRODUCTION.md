# PayNOC — Final Clean Production Environment

এই ফাইলটা তোমার current requirement অনুযায়ী বানানো: **Supabase service → Environment Variables → Developer View**-এ সব remove/replace করে paste করার জন্য clean final block।

> ⚠️ তুমি keys/password chat-এ paste করেছো, তাই production live হওয়ার পরে অবশ্যই Supabase service-এর generated password/JWT/API keys rotate করবে। এখন deploy complete করার জন্য নিচের block use করো।

---

## A) Supabase service — Developer View FULL REPLACE

Path: Coolify → **Supabase** resource/service → Environment Variables → **Developer View** → সব select → replace → save.

✅ এই block শুধু **Supabase service**-এর জন্য।  
❌ PayNOC app-এর `VITE_*`, `APP_URL`, `NITRO_PRESET`, `PORT`, notification keys এখানে রাখবে না।

```env
# =========================================================
# PayNOC Supabase Service — FULL REPLACE Developer View
# =========================================================

# -------------------------
# Core generated secrets
# -------------------------
SERVICE_PASSWORD_JWT=P7Nra2jCxLz0VrhUtvdqhPUPBqleqzj2
SERVICE_SUPABASEANON_KEY=eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJpc3MiOiJzdXBhYmFzZSIsImlhdCI6MTc4Mjk3MTIyMCwiZXhwIjo0OTM4NjQ0ODIwLCJyb2xlIjoiYW5vbiJ9.VMNUv0Jw8D0VJlL4SlOcF8vwa67BgKrqvNiXN1OXYtY
SERVICE_SUPABASESERVICE_KEY=eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJpc3MiOiJzdXJhYmFzZSIsImlhdCI6MTc4Mjk3MTIyMCwiZXhwIjo0OTM4NjQ0ODIwLCJyb2xlIjoic2VydmljZV9yb2xlIn0.ujCJ7YPn79Iq7d9GE-u6HGvFOpUBvwXzc7h3TRskjig
SERVICE_PASSWORD_POSTGRES=mR6sQVbQq6fYuwrGJ2TdLPvnlvbNMXh3
SERVICE_PASSWORD_ADMIN=pIcz0BaKyYkIx6grvQxDTOiD7y9Z6XAE
SERVICE_USER_ADMIN=yhM1V0E9xrb3Iq0e
SERVICE_PASSWORD_VAULTENC=6Dxyj5qmaoGec3i5QbG3UJNqicYpm37T
SERVICE_PASSWORD_PGMETACRYPTO=2y7DnA2Pd3zGMakZNu4YdS5Tjdu7AW7Y
SERVICE_PASSWORD_LOGFLARE=imNL2OR1xUoFTTpmn4R9gYTmRD4OGkfJ
SERVICE_PASSWORD_LOGFLAREPRIVATE=iPz7njjDgz9VaR3QzIagQiJZ6FlJ7lXZ
SERVICE_USER_MINIO=Wc0CFNc2HNFyq9dd
SERVICE_PASSWORD_MINIO=P3MzFR75h8KEch5HkzWhjZfNqSaLTsEN
SERVICE_PASSWORD_SUPAVISORSECRET=s2E3U3iBDuYOAeHB1D2n3tsLXNExhIyX

# Asymmetric keys disabled/empty for this self-hosted setup
ANON_KEY_ASYMMETRIC=
SERVICE_ROLE_KEY_ASYMMETRIC=
SUPABASE_SECRET_KEY=

# -------------------------
# Studio security lock
# -------------------------
DASHBOARD_USERNAME=${SERVICE_USER_ADMIN}
DASHBOARD_PASSWORD=${SERVICE_PASSWORD_ADMIN}

# -------------------------
# Public Supabase domain / Kong
# -------------------------
SERVICE_FQDN_SUPABASEKONG=supabase.paynoc.bd
SERVICE_URL_SUPABASEKONG=https://supabase.paynoc.bd
SERVICE_FQDN_SUPABASEKONG_8000=supabase.paynoc.bd:8000
SERVICE_URL_SUPABASEKONG_8000=https://supabase.paynoc.bd:8000
SUPABASE_PUBLIC_URL=https://supabase.paynoc.bd
API_EXTERNAL_URL=http://supabase-kong:8000
STORAGE_PUBLIC_URL=https://supabase.paynoc.bd

# -------------------------
# JWT / auth shared secrets
# -------------------------
JWT_SECRET=${SERVICE_PASSWORD_JWT}
ANON_KEY=${SERVICE_SUPABASEANON_KEY}
SERVICE_KEY=${SERVICE_SUPABASESERVICE_KEY}
SUPABASE_ANON_KEY=${SERVICE_SUPABASEANON_KEY}
SUPABASE_SERVICE_KEY=${SERVICE_SUPABASESERVICE_KEY}
AUTH_JWT_SECRET=${SERVICE_PASSWORD_JWT}
API_JWT_SECRET=${SERVICE_PASSWORD_JWT}
PGRST_JWT_SECRET=${SERVICE_PASSWORD_JWT}
PGRST_APP_SETTINGS_JWT_SECRET=${SERVICE_PASSWORD_JWT}
GOTRUE_JWT_SECRET=${SERVICE_PASSWORD_JWT}
METRICS_JWT_SECRET=${SERVICE_PASSWORD_JWT}
SECRET_PASSWORD_REALTIME=${SERVICE_PASSWORD_JWT}

# -------------------------
# App auth URLs
# -------------------------
GOTRUE_SITE_URL=https://pay.paynoc.bd
ADDITIONAL_REDIRECT_URLS=https://pay.paynoc.bd/**,https://paynoc.bd/**,https://docs.paynoc.bd/**,https://api.paynoc.bd/**

# -------------------------
# Database / Postgres
# -------------------------
POSTGRES_HOST=supabase-db
POSTGRES_HOSTNAME=supabase-db
POSTGRES_PORT=5432
POSTGRES_DB=postgres
POSTGRES_PASSWORD=${SERVICE_PASSWORD_POSTGRES}
PGPASSWORD=${SERVICE_PASSWORD_POSTGRES}
DB_PASSWORD=${SERVICE_PASSWORD_POSTGRES}
PG_META_DB_PASSWORD=${SERVICE_PASSWORD_POSTGRES}
PG_META_CRYPTO_KEY=${SERVICE_PASSWORD_PGMETACRYPTO}
CRYPTO_KEY=${SERVICE_PASSWORD_PGMETACRYPTO}
VAULT_ENC_KEY=${SERVICE_PASSWORD_VAULTENC}
SECRET_KEY_BASE=${SERVICE_PASSWORD_SUPAVISORSECRET}

# -------------------------
# Storage / MinIO
# -------------------------
MINIO_ROOT_USER=${SERVICE_USER_MINIO}
MINIO_ROOT_PASSWORD=${SERVICE_PASSWORD_MINIO}
AWS_ACCESS_KEY_ID=${SERVICE_USER_MINIO}
AWS_SECRET_ACCESS_KEY=${SERVICE_PASSWORD_MINIO}
STORAGE_TENANT_ID=storage-single-tenant
IMGPROXY_AUTO_WEBP=true

# -------------------------
# Logflare / analytics
# -------------------------
LOGFLARE_API_KEY=${SERVICE_PASSWORD_LOGFLARE}
LOGFLARE_PUBLIC_ACCESS_TOKEN=${SERVICE_PASSWORD_LOGFLARE}
LOGFLARE_PRIVATE_ACCESS_TOKEN=${SERVICE_PASSWORD_LOGFLAREPRIVATE}

# -------------------------
# PostgREST
# -------------------------
PGRST_DB_SCHEMAS=public,storage,graphql_public
PGRST_DB_MAX_ROWS=1000
PGRST_DB_EXTRA_SEARCH_PATH=public

# -------------------------
# Auth settings
# -------------------------
JWT_EXPIRY=3600
DISABLE_SIGNUP=false
ENABLE_EMAIL_SIGNUP=true
ENABLE_EMAIL_AUTOCONFIRM=false
ENABLE_ANONYMOUS_USERS=false
ENABLE_PHONE_SIGNUP=false
ENABLE_PHONE_AUTOCONFIRM=false
FUNCTIONS_VERIFY_JWT=false

# -------------------------
# Studio labels
# -------------------------
STUDIO_DEFAULT_ORGANIZATION=PayNOC
STUDIO_DEFAULT_PROJECT=PayNOC Production

# -------------------------
# SMTP / mailer optional
# Empty thakle deploy fail korbe na
# -------------------------
SMTP_ADMIN_EMAIL=
SMTP_HOST=
SMTP_PORT=587
SMTP_USER=
SMTP_PASS=
SMTP_SENDER_NAME=PayNOC
MAILER_URLPATHS_INVITE=/auth/v1/verify
MAILER_URLPATHS_CONFIRMATION=/auth/v1/verify
MAILER_URLPATHS_RECOVERY=/auth/v1/verify
MAILER_URLPATHS_EMAIL_CHANGE=/auth/v1/verify
MAILER_TEMPLATES_INVITE=
MAILER_TEMPLATES_CONFIRMATION=
MAILER_TEMPLATES_RECOVERY=
MAILER_TEMPLATES_MAGIC_LINK=
MAILER_TEMPLATES_EMAIL_CHANGE=
MAILER_SUBJECTS_CONFIRMATION=
MAILER_SUBJECTS_RECOVERY=
MAILER_SUBJECTS_MAGIC_LINK=
MAILER_SUBJECTS_EMAIL_CHANGE=
MAILER_SUBJECTS_INVITE=

# -------------------------
# Realtime / Storage gateway timeouts
# -------------------------
KONG_STORAGE_CONNECT_TIMEOUT=60
KONG_STORAGE_WRITE_TIMEOUT=3600
KONG_STORAGE_READ_TIMEOUT=3600
KONG_STORAGE_REQUEST_BUFFERING=false
KONG_STORAGE_RESPONSE_BUFFERING=false

# -------------------------
# Pooler
# -------------------------
POOLER_TENANT_ID=paynoc
POOLER_DEFAULT_POOL_SIZE=20
POOLER_MAX_CLIENT_CONN=100
POOLER_DB_POOL_SIZE=5

# -------------------------
# Studio frontend env used inside Supabase stack
# -------------------------
NEXT_PUBLIC_SUPABASE_URL=${SERVICE_URL_SUPABASEKONG}
NEXT_PUBLIC_SUPABASE_ANON_KEY=${SERVICE_SUPABASEANON_KEY}
```

---

## B) Supabase save করার পরে করো

1. **Save** করো।
2. Supabase resource/service **Restart** করো।
3. Browser থেকে `https://supabase.paynoc.bd` open করো।
4. Username/password prompt আসতে হবে।
   - Username = `SERVICE_USER_ADMIN` value
   - Password = `SERVICE_PASSWORD_ADMIN` value
5. Prompt না এলে `DASHBOARD_USERNAME` / `DASHBOARD_PASSWORD` save হয়েছে কিনা check করে আবার restart করো।

---

## C) PayNOC app — Developer View FULL REPLACE

Path: Coolify → **PayNOC app** → Environment Variables → **Developer View** → সব select → replace → save.

✅ এই block শুধু **PayNOC app**-এর জন্য।  
❌ Supabase service-এর `SERVICE_*`, `POSTGRES_*`, `MINIO_*`, `KONG_*`, `MAILER_*` এখানে paste করবে না।

```env
# =========================================================
# PayNOC App — FULL REPLACE Developer View
# =========================================================

# Buildtime variables — Coolify Buildtime checkbox ON
VITE_SUPABASE_URL=https://supabase.paynoc.bd
VITE_SUPABASE_PUBLISHABLE_KEY=eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJpc3MiOiJzdXJhYmFzZSIsImlhdCI6MTc4Mjk3MTIyMCwiZXhwIjo0OTM4NjQ0ODIwLCJyb2xlIjoiYW5vbiJ9.VMNUv0Jw8D0VJlL4SlOcF8vwa67BgKrqvNiXN1OXYtY
VITE_SUPABASE_PROJECT_ID=self-hosted

# Runtime variables — Coolify Buildtime checkbox OFF
SUPABASE_URL=https://supabase.paynoc.bd
SUPABASE_PUBLISHABLE_KEY=eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJpc3MiOiJzdXJhYmFzZSIsImlhdCI6MTc4Mjk3MTIyMCwiZXhwIjo0OTM4NjQ0ODIwLCJyb2xlIjoiYW5vbiJ9.VMNUv0Jw8D0VJlL4SlOcF8vwa67BgKrqvNiXN1OXYtY
SUPABASE_SERVICE_ROLE_KEY=eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJpc3MiOiJzdXJhYmFzZSIsImlhdCI6MTc4Mjk3MTIyMCwiZXhwIjo0OTM4NjQ0ODIwLCJyb2xlIjoic2VydmljZV9yb2xlIn0.ujCJ7YPn79Iq7d9GE-u6HGvFOpUBvwXzc7h3TRskjig
NITRO_PRESET=node-server
PORT=3000
NODE_ENV=production
APP_URL=https://pay.paynoc.bd

# Optional integrations — empty thakle deploy fail korbe na
RESEND_API_KEY=
GATEWAYAPI_TOKEN=
SLACK_WEBHOOK_URL=
DISCORD_WEBHOOK_URL=
OPENAI_API_KEY=
```

### PayNOC app Buildtime checkbox

| Variable | Buildtime |
| --- | --- |
| `VITE_SUPABASE_URL` | ✅ ON |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | ✅ ON |
| `VITE_SUPABASE_PROJECT_ID` | ✅ ON |
| `SUPABASE_URL` | ❌ OFF |
| `SUPABASE_PUBLISHABLE_KEY` | ❌ OFF |
| `SUPABASE_SERVICE_ROLE_KEY` | ❌ OFF |
| `NITRO_PRESET` | ❌ OFF |
| `PORT` | ❌ OFF |
| `NODE_ENV` | ❌ OFF |
| `APP_URL` | ❌ OFF |
| optional keys | ❌ OFF |

---

## D) Domains tab — deploy error fix

Path: Coolify → **PayNOC app** → Domains tab

সব domain আলাদা আলাদা entry হিসেবে দেবে:

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

❌ এক line এ সব domain দেবে না।  
❌ `https//pay.paynoc.bd` দেবে না।  
✅ ঠিক spelling: `https://pay.paynoc.bd`

---

## E) Final deploy order

1. Supabase service env → section A paste → Save
2. Supabase service → Restart
3. `https://supabase.paynoc.bd` → password prompt verify
4. PayNOC app env → section C paste → Save
5. PayNOC app → Buildtime checkbox ঠিক করো
6. PayNOC app → Domains tab আলাদা 4টা entry দাও
7. PayNOC app → Deploy

---

## F) Common error quick fix

### `bash: line 1: https//pay.paynoc.bd: No such file or directory`

Domains tab wrong. এক line এ সব domain দিয়েছো বা `https://` ভুল। Section D follow করো।

### `NODE_ENV=production skips devDependencies`

`NODE_ENV` Buildtime checkbox OFF করো। এটা runtime-only।

### Supabase Studio password ছাড়া open হয়

Supabase env-এ এই দুই line আছে কিনা check করে restart করো:

```env
DASHBOARD_USERNAME=${SERVICE_USER_ADMIN}
DASHBOARD_PASSWORD=${SERVICE_PASSWORD_ADMIN}
```

### PayNOC app backend/auth error

PayNOC app env-এ `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_SERVICE_ROLE_KEY` আছে কিনা check করো, আর এগুলোর Buildtime OFF রাখো।

---

## G) Security final

Deploy successful হলে leaked values rotate করবে, তারপর PayNOC app env-এ নতুন anon/service keys update করে redeploy করবে।