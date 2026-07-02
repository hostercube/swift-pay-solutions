# 🚀 PayNOC — Coolify Deployment (Bangla, Step by Step)

Ei guide ta follow korle Lovable → GitHub → Coolify sob **full automation** e chole jabe. Ekbar setup, tarpor Lovable e edit korlei live update hobe.

---

## ✅ Ekhon tumi kothay acho

Screenshot dekhe bujlam:
- Coolify e project **`Paynoc`** create hoyeche
- Postgres database **`paynoc-db`** create hoyeche kintu status **`Exited`** (start hoy ni)
- Username / password already generated

**Ekhon 7 ta step baki** ⬇️

---

## STEP 1 — Database Start koro

1. `paynoc-db` er page e **upore right pashe green `Start` button** ache → click koro
2. 30 second wait koro
3. Status **`Running`** hobe (green dot)

⚠️ Jodi start na hoy → **Logs** tab e error dekho.

---

## STEP 2 — Database Password & Connection String save koro

`paynoc-db` → **Configuration** tab e:

- **Username** copy koro (default: `postgres`)
- **Password** copy koro (long random string)
- **Postgres URL** copy koro — eta 2 ta thake:
  - **Internal URL** (app to database, Coolify network er vitor) — eta app e use korbe
  - **Public URL** (tomar laptop theke connect korte) — eta migration run korte lagbe

**Public URL access er jonno:**
- `paynoc-db` → **Configuration** → scroll down → **"Public Port"** section
- Toggle ON koro → Coolify ekta public port dibe (like `5432`)
- Ekhon tumi tomar laptop theke connect korte parbe

📝 Ekta text file e save kore rakho:
```
DB_USER=postgres
DB_PASSWORD=OuDWSEbT3r9i2Kup8ec2bWw...
DB_HOST=your-server.com
DB_PORT=5432
DATABASE_URL=postgres://postgres:PASSWORD@your-server.com:5432/postgres
```

---

## STEP 3 — Database Schema install koro (laptop theke, ekbar only)

Tomar laptop e terminal khulo (Mac/Linux/WSL):

### 3.1 — `psql` install koro (jodi na thake)
```bash
# Mac
brew install libpq && brew link --force libpq

# Ubuntu/Debian/WSL
sudo apt install postgresql-client -y
```

### 3.2 — Repo clone koro
```bash
git clone https://github.com/YOUR_USERNAME/paynoc.git
cd paynoc
```

### 3.3 — Database URL export koro
```bash
export DATABASE_URL="postgres://postgres:YOUR_PASSWORD@your-server.com:5432/postgres"
```

### 3.4 — Full schema install koro (ek command e sob)
```bash
psql "$DATABASE_URL" -f db/install.sql
```

Ei command **30+ tables, RLS policies, RPC functions, roles** — sob create korbe. 1-2 minute lagbe.

⚠️ Error ashle: `pg_cron` / `pg_net` extension nei — eta normal, cron step e handle hobe.

---

## STEP 4 — App Service Coolify e Deploy koro

### 4.1 — GitHub e Lovable connect koro (jodi ekhono na kore thako)
- Lovable editor er upore **GitHub** button → **Connect to GitHub** → repo create koro
- Ebar theke Lovable er prottek edit auto GitHub e jabe ✅

### 4.2 — Coolify e Application create koro
1. Coolify dashboard → **Projects → Paynoc → production** e jao
2. **+ New Resource** → **Application** click koro
3. **Public Repository** select koro (ba **Private + GitHub App** jodi private repo)
4. Repository URL paste koro: `https://github.com/YOUR_USERNAME/paynoc`
5. **Branch:** `main`
6. **Build Pack:** `Dockerfile` select koro (NOT nixpacks!)
7. **Port:** `3000`
8. **Base Directory:** `/` (root)

### 4.3 — Domain add koro
- **Domains** section e domain likho: `pay.yourdomain.com`
- DNS e A record add koro: `pay` → tomar Coolify server IP
- HTTPS Coolify auto handle korbe (Let's Encrypt)

---

## STEP 5 — Environment Variables add koro

App er **Environment Variables** tab e jao. Ei variables add koro:

### 🏗️ Build Variables (checkbox: **"Build Variable"** on koro)
```
VITE_SUPABASE_URL=https://supabase.yourdomain.com
VITE_SUPABASE_PUBLISHABLE_KEY=eyJhbGc...anon-key
VITE_SUPABASE_PROJECT_ID=self-hosted
```

### ⚙️ Runtime Variables (build variable OFF)
```
SUPABASE_URL=https://supabase.yourdomain.com
SUPABASE_PUBLISHABLE_KEY=eyJhbGc...anon-key
SUPABASE_SERVICE_ROLE_KEY=eyJhbGc...service-role-key
NITRO_PRESET=node-server
PORT=3000

# Optional (email/SMS notification chaile)
RESEND_API_KEY=re_xxxxx
GATEWAYAPI_TOKEN=xxxxx
```

⚠️ **Important:** Tomar full Supabase stack (Auth + API) o lagbe. Coolify e:
- **+ New Resource** → **Services** → **Supabase** template deploy koro
- Otherwise sudhu Postgres e app chalabe na — Auth nei

**Ekhon `Deploy` button click koro** → 3-5 minute wait koro → app live ✅

---

## STEP 6 — Auto Deploy ON koro (Full Automation)

App er **Settings** tab:
- ✅ **Auto Deploy on Git Push** = ON
- ✅ **Preserve Repository During Deployment** = ON (optional)

Coolify automatic GitHub webhook setup kore dibe.

### 🎉 Full Flow ekhon eta:
```
Lovable e edit koro
   ↓ (auto)
GitHub e push
   ↓ (auto webhook)
Coolify build
   ↓ (auto)
Live update on pay.yourdomain.com
```

**Kichu manual korte hobe na!**

---

## STEP 7 — First Admin User banao

1. Deployed site `https://pay.yourdomain.com` e jao
2. **Sign Up** koro (tomar email + password)
3. Laptop e:
```bash
# Email edit koro
nano db/seed-admin.sql
# 'you@example.com' → tomar email diye replace koro

# Run
psql "$DATABASE_URL" -f db/seed-admin.sql
```
4. Site refresh koro → **`/admin`** panel dekhbe ✅

---

## STEP 8 — Cron Jobs setup koro (auto invoice expiry, webhook retry)

```bash
# Editor khulo
nano db/cron/schedule.sql

# Replace koro:
# {{APP_URL}}   →  https://pay.yourdomain.com
# {{ANON_KEY}}  →  tomar anon key

# Run
psql "$DATABASE_URL" -f db/cron/schedule.sql
```

Ei cron jobs auto chalabe:
| Job | Interval |
|---|---|
| Invoice expiry | 5 min |
| Webhook retry | 2 min |
| Recurring invoice | 15 min |
| Email digest | Hourly |
| Payout schedule | 30 min |

---

## 🎯 Ready! Sob Automation:

| Kaj | Auto? |
|---|---|
| Lovable edit → GitHub push | ✅ Auto |
| GitHub push → Coolify deploy | ✅ Auto |
| SSL certificate | ✅ Auto (Let's Encrypt) |
| Database backup | ✅ Coolify Backups tab e schedule |
| Cron jobs | ✅ pg_cron auto |

---

## 🔧 Future e notun DB migration ashle

Lovable jodi notun `db/migrations/xxxxx.sql` add kore:

```bash
git pull
psql "$DATABASE_URL" -f db/migrations/NEW_FILE_NAME.sql
```

Baki sob (app code, features) **auto deploy** hobe. Kichu korte hobe na.

---

## 🆘 Troubleshooting

**Database `Exited` show korche:**
- Logs tab dekho — port conflict / disk space check koro

**App build fail:**
- Environment variables e `VITE_*` gulo **Build Variable** checkbox on ache kina check koro
- Dockerfile use hocche kina confirm koro

**`/admin` dekhchi na:**
- Step 7 er seed-admin.sql run hoyeche kina check koro
- Browser logout → login again

**Cron jobs chalche na:**
- `pg_cron` + `pg_net` extension database e enabled kina: `SELECT * FROM cron.job;`

---

**Sob done? Lovable e edit → GitHub → Coolify auto deploy — ebar just build koro! 🚀**
