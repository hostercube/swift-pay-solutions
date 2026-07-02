# Coolify a PostgreSQL Setup — Terminal chara, Easy Bangla Guide

> Apnar VPS a Coolify already installed & onek websiet host kora ache — ei guide
> shudhu **PostgreSQL database** setup + PayNOC connect korar jonno. Kono
> `ssh`/`psql`/terminal command lagbe na. Sob Coolify UI theke.

---

## Step 1 — Database create korun (2 minute)

1. Coolify dashboard → **+ New** → **Database** → **PostgreSQL 16**.
2. **Server**: apnar existing VPS select korun.
3. **Name**: `paynoc-db` (ja icche).
4. **Postgres User** / **Password** / **Database Name**: default rakhun,
   otoba `paynoc` / `paynoc` / `paynoc` din — mone rakhun.
5. **Create** click korun.

Coolify auto container start korbe. ~30 second wait korun jotokhon status **Running (green)** hoy.

> **Public port lagbe na** jodi PayNOC app o same Coolify VPS-e host kora hoy —
> internal network e connect hobe. Sudhu external tool (pgAdmin, DBeaver) theke
> connect korle **Network → Public port → Enable** korun.

---

## Step 2 — Connection string ta kothay?

Database page a niche **Connection** section:

```
Internal (app → db, same VPS):
  postgres://paynoc:paynoc@<container-name>:5432/paynoc

Public (external tools, jodi public port enable kora thake):
  postgres://paynoc:paynoc@<vps-ip>:<port>/paynoc
```

Coolify autometic ei string ta dekhay — **Copy** button click korun.

---

## Step 3 — Schema install korun (SQL run) — terminal chara

Ekhaneo terminal lagbe na. **2 ta option**, dutai easy:

### Option A — Coolify built-in SQL runner (recommend)

1. Database detail page → **Terminal** tab → **Postgres** shell.
   (Ei shell Coolify UI er moddhei; local terminal na.)
2. Amader repo theke `db/install.sql` er content paste korun → Enter.
3. Same vabe `db/storage.sql` and `db/cron/schedule.sql` paste korun.

> Jodi `pg_cron`/`pgcrypto` extension missing bole, database → **Settings →
> Extensions** theke enable korun, tarpor abar run.

### Option B — pgAdmin (browser tool, no CLI)

1. https://www.pgadmin.org/download/ theke pgAdmin install korun (Windows/Mac).
2. Add server → Public connection string er info bhorun.
3. Left tree te apnar DB → right-click → **Query Tool**.
4. `db/install.sql` file open → **Run (F5)**.
5. Same ta `db/storage.sql`, tarpor `db/cron/schedule.sql`.

Done — sob table, RLS, function, cron ready.

---

## Step 4 — PayNOC app er sathe connect korun

Coolify e apnar PayNOC application er **Environment Variables** page a jan.
Nicher variables set korun (values Step 2 er connection string theke):

```
DATABASE_URL=postgres://paynoc:paynoc@paynoc-db:5432/paynoc
SUPABASE_URL=<apnar self-hosted supabase URL>
SUPABASE_ANON_KEY=<anon key>
SUPABASE_SERVICE_ROLE_KEY=<service role key>
APEX_DOMAIN=paynoc.bd
```

> **Note:** PayNOC internally Supabase JS client use kore, tai apnar VPS a
> Supabase (Coolify template) o run kora lagbe — ei same PostgreSQL ke Supabase
> er DB hishebe use korte paren. Ekhon jodi shudhu bare Postgres run korte
> chan, Supabase ke same DB point koriye din.

Save → **Redeploy** click korun. GitHub push korle Coolify auto rebuild kore.

---

## Step 5 — First super admin banan

Coolify → Database → **Terminal (Postgres shell)** → paste:

```sql
-- Change email ta apnar signup email er sathe
UPDATE public.user_roles
   SET role = 'super_admin'
 WHERE user_id = (SELECT id FROM auth.users WHERE email = 'you@example.com');
```

Enter. Ekhon `/ayman-login` theke login korle admin panel dekhben.

---

## Common issue quick fix

| Problem | Fix |
|---|---|
| App bole `ECONNREFUSED` | DATABASE_URL a container name thik ache kina check korun (public IP na, internal name). |
| `permission denied for table X` | `db/install.sql` er niche GRANT statement gulo run hoyni — abar run korun. |
| `pg_cron` error | Database → Settings → Extensions → `pg_cron`, `pgcrypto` enable → SQL abar run. |
| Migration duplicate error | Normal — mane already install ache. Skip korun. |

---

## Auto deploy check

GitHub → PayNOC repo push → Coolify webhook trigger → build → live.
Coolify app page → **Deployments** tab a real-time log dekhben.

Byash — apnar payment gateway live!
