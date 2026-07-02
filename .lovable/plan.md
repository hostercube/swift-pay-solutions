## Ki korbo

Ekta notun single file banabo: **`DEPLOY_NOW_BANGLA.md`** — ei ta hobe tomar "ekhon theke ki ki korte hobe" er complete Bengali checklist. Purano guide gulo (DEPLOY_FINAL.md, DEPLOY_BANGLA.md, etc.) delete korbo na, kintu ei notun ta hobe **single source of truth** — ekta file dekhlei sob steps ache.

## Content structure

Ei file ta e thakbe (Bengali te, screenshot-friendly step numbering):

**Part 1 — Verify (5 min)**
- Coolify → Supabase service running ase kina check
- Supabase Studio (`https://supabase.paynoc.bd`) khule login test
- DB terminal e `\dt public.*` diye tables count check (31 ta thaka uchit)

**Part 2 — Storage buckets fix (jodi baki thake)**
- `db/storage.sql` er content DB terminal e paste (SET ROLE included)

**Part 3 — paynoc app resource banano**
- Coolify → New Resource → Public Repository
- GitHub repo URL
- Build Pack: Dockerfile
- Port: 3000

**Part 4 — Environment Variables**
- Ready-to-paste block (VITE_*, SUPABASE_*, NITRO_PRESET, APP_URL)

**Part 5 — Domains add**
- paynoc.bd, pay.paynoc.bd, docs.paynoc.bd, api.paynoc.bd
- Cloudflare A record verification

**Part 6 — Deploy**
- Deploy button click
- Logs check

**Part 7 — First sign up + admin promote**
- `https://paynoc.bd/auth` e sign up
- DB terminal e `db/seed-admin.sql` (email replace kore)

**Part 8 — Cron jobs schedule**
- `db/cron/schedule.sql` er `{{APP_URL}}` and `{{ANON_KEY}}` replace kore run
- `SELECT jobname FROM cron.job;` diye verify (5 ta job thaka uchit)

**Part 9 — Smoke test**
- Merchant sign up test
- Invoice create test
- Checkout page (`/pay/:id`) test
- API key generate + curl test

**Part 10 — Security cleanup (⚠️ important)**
- Compromised keys (JWT/service_role/postgres/MinIO) rotate karar steps
- Regenerate → restart → paynoc env update → redeploy

**Part 11 — Optional add-ons**
- RESEND_API_KEY (email notifications)
- GATEWAYAPI_TOKEN (SMS)
- SLACK/DISCORD webhooks

Prottek step er sathe:
- ✅ Success ki dekhbe
- ❌ Fail hole ki korbe (common errors)
- Copy-paste ready command/SQL

## Ki file touch korbo

- ✏️ Create: `DEPLOY_NOW_BANGLA.md`
- Baki kono file change hobe na

Approve korle likhe felbo.
