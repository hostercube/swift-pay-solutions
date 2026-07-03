# PayNOC — FINAL Production Environment (Coolify)

এই ফাইলটাই এখন final guide. সবচেয়ে বড় কথা: **Supabase service** আর **PayNOC app** — এই দুইটার environment কখনো mix করবে না।

> ⚠️ Security: private password/key এই repo/file/chat-এ রাখবে না। Coolify যেগুলো auto-generate করেছে সেগুলো Coolify-এর env box-এই থাকবে। Deploy successful হলে leaked key/password rotate করবে।

---

## 0) তোমার current error এর root cause

তুমি Supabase service env-এ বারবার **Select all → Replace all** করছো। এতে auto-generated secret/config নষ্ট হচ্ছে বা app env Supabase service-এ ঢুকে যাচ্ছে।

✅ Correct rule:

- **Supabase service:** full replace করো না; শুধু নিচের “Supabase service add/update block” line গুলো add/update করো।
- **PayNOC app:** এখানে full replace করা যাবে; নিচের clean block paste করো।

---

## 1) Supabase service env — Developer View

Path: Coolify → **supabase** service → Environment Variables → **Developer view**

### ✅ কী করবে

1. Supabase service env থেকে নিচের app-only variables থাকলে delete করো:

```env
VITE_SUPABASE_URL
VITE_SUPABASE_PUBLISHABLE_KEY
VITE_SUPABASE_PROJECT_ID
SUPABASE_URL
SUPABASE_PUBLISHABLE_KEY
SUPABASE_SERVICE_ROLE_KEY
NITRO_PRESET
PORT
APP_URL
NODE_ENV
RESEND_API_KEY
GATEWAYAPI_TOKEN
SLACK_WEBHOOK_URL
DISCORD_WEBHOOK_URL
```

2. Coolify auto-generated `SERVICE_*`, `POSTGRES_*`, `MINIO_*`, `KONG_*`, `MAILER_*`, `DASHBOARD_*` variables **delete করবে না**।
3. `SERVICE_ROLE_KEY_ASYMMETRIC=` line থাকলে value empty রাখবে, কিন্তু line delete করবে না।
4. নিচের block এর line গুলো Supabase service env-এ add/update করো।

### ✅ Supabase service add/update block

```env
# ==== Studio LOCK — dashboard public open bondho korbe ====
DASHBOARD_USERNAME=${SERVICE_USER_ADMIN}
DASHBOARD_PASSWORD=${SERVICE_PASSWORD_ADMIN}

# ==== Public domain ====
SERVICE_URL_SUPABASEKONG=https://supabase.paynoc.bd
SERVICE_FQDN_SUPABASEKONG=supabase.paynoc.bd
SUPABASE_PUBLIC_URL=https://supabase.paynoc.bd
API_EXTERNAL_URL=http://supabase-kong:8000
STORAGE_PUBLIC_URL=https://supabase.paynoc.bd

# ==== Auth redirect ====
GOTRUE_SITE_URL=https://pay.paynoc.bd
ADDITIONAL_REDIRECT_URLS=https://pay.paynoc.bd/**,https://paynoc.bd/**

# ==== JWT references — existing generated secrets use korbe ====
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

# ==== Postgres / crypto references ====
POSTGRES_PASSWORD=${SERVICE_PASSWORD_POSTGRES}
PGPASSWORD=${SERVICE_PASSWORD_POSTGRES}
DB_PASSWORD=${SERVICE_PASSWORD_POSTGRES}
PG_META_DB_PASSWORD=${SERVICE_PASSWORD_POSTGRES}
PG_META_CRYPTO_KEY=${SERVICE_PASSWORD_PGMETACRYPTO}
CRYPTO_KEY=${SERVICE_PASSWORD_PGMETACRYPTO}
VAULT_ENC_KEY=${SERVICE_PASSWORD_VAULTENC}
SECRET_KEY_BASE=${SERVICE_PASSWORD_SUPAVISORSECRET}

# ==== Storage/minio references ====
MINIO_ROOT_USER=${SERVICE_USER_MINIO}
MINIO_ROOT_PASSWORD=${SERVICE_PASSWORD_MINIO}
AWS_ACCESS_KEY_ID=${SERVICE_USER_MINIO}
AWS_SECRET_ACCESS_KEY=${SERVICE_PASSWORD_MINIO}
STORAGE_TENANT_ID=storage-single-tenant
IMGPROXY_AUTO_WEBP=true

# ==== PostgREST ====
PGRST_DB_SCHEMAS=public,storage,graphql_public
PGRST_DB_MAX_ROWS=1000
PGRST_DB_EXTRA_SEARCH_PATH=public

# ==== Auth settings ====
JWT_EXPIRY=3600
DISABLE_SIGNUP=false
ENABLE_EMAIL_SIGNUP=true
ENABLE_EMAIL_AUTOCONFIRM=false
ENABLE_ANONYMOUS_USERS=false
ENABLE_PHONE_SIGNUP=false
ENABLE_PHONE_AUTOCONFIRM=false

# ==== Studio labels ====
STUDIO_DEFAULT_ORGANIZATION=PayNOC
STUDIO_DEFAULT_PROJECT=PayNOC Production

# ==== SMTP optional — empty thakle app deploy fail korbe na ====
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
```

### ✅ Supabase save করার পর

1. Save করো
2. Supabase service **Restart** করো
3. Browser এ `https://supabase.paynoc.bd` open করো
4. Basic-auth username/password prompt আসতে হবে — prompt না এলে Studio এখনো public open আছে

---

## 2) PayNOC app env — FULL REPLACE block

Path: Coolify → **PayNOC app** → Environment Variables → **Developer view**

এখানে existing সব select করে replace করা যাবে। নিচের block paste করো।

> `<PASTE_YOUR_...>` placeholder গুলোতে Supabase service env থেকে existing generated value বসাবে। এগুলো chat/repo-তে লিখে রাখবে না।

```env
# ==== BUILDTIME — Buildtime checkbox ON ====
VITE_SUPABASE_URL=https://supabase.paynoc.bd
VITE_SUPABASE_PUBLISHABLE_KEY=<PASTE_YOUR_SERVICE_SUPABASEANON_KEY_VALUE>
VITE_SUPABASE_PROJECT_ID=self-hosted

# ==== RUNTIME — Buildtime checkbox OFF ====
SUPABASE_URL=https://supabase.paynoc.bd
SUPABASE_PUBLISHABLE_KEY=<PASTE_YOUR_SERVICE_SUPABASEANON_KEY_VALUE>
SUPABASE_SERVICE_ROLE_KEY=<PASTE_YOUR_SERVICE_SUPABASESERVICE_KEY_VALUE>
NITRO_PRESET=node-server
PORT=3000
NODE_ENV=production
APP_URL=https://pay.paynoc.bd

# ==== Optional integrations — empty thakle deploy fail korbe na ====
RESEND_API_KEY=
GATEWAYAPI_TOKEN=
SLACK_WEBHOOK_URL=
DISCORD_WEBHOOK_URL=
```

### Buildtime checkbox final

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

## 3) PayNOC app Domains tab — খুব important

Path: Coolify → **PayNOC app** → Domains tab

সব wrong entry clear করে 4টা domain **separate entry** হিসেবে add করো:

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
✅ spelling হবে `https://pay.paynoc.bd`।

---

## 4) Deploy order

1. Supabase service env clean/update
2. Supabase service Restart
3. `https://supabase.paynoc.bd` basic-auth prompt verify
4. PayNOC app env full replace
5. PayNOC app Buildtime checkbox fix
6. PayNOC app Domains separate entry fix
7. PayNOC app Deploy

---

## 5) Common errors

### `bash: line 1: https//pay.paynoc.bd: No such file or directory`

Domains tab wrong. 4টা domain আলাদা entry দাও, এক line এ না। `https://` spelling fix করো।

### `NODE_ENV=production skips devDependencies`

`NODE_ENV` Buildtime checkbox OFF করো। এটা runtime-only।

### `SERVICE_ROLE_KEY_ASYMMETRIC delete kora jacche na`

Line delete করো না। empty value রাখো:

```env
SERVICE_ROLE_KEY_ASYMMETRIC=
```

### Supabase Studio password ছাড়া open হয়

Supabase service env-এ এই দুই line আছে কিনা check করো, তারপর Restart:

```env
DASHBOARD_USERNAME=${SERVICE_USER_ADMIN}
DASHBOARD_PASSWORD=${SERVICE_PASSWORD_ADMIN}
```

---

## 6) Final security step

Deploy successful হলে যেহেতু key/password chat-এ paste হয়েছে, Coolify → Supabase service থেকে keys/password rotate/regenerate করে PayNOC app env-এ নতুন anon/service values update করবে।