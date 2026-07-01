# PayNOC — Self-hosted deploy (Coolify + GitHub auto-deploy)

Everything you need to run PayNOC on your own Coolify server.

## 0. GitHub ↔ Lovable ↔ Coolify flow

1. In Lovable: **+ menu → GitHub → Connect project**. Every Lovable edit auto-pushes to GitHub.
2. In Coolify: **New Resource → Application → From GitHub**, pick this repo, branch `main`, build pack **Dockerfile**.
3. Coolify's "Auto Deploy on push" is on by default. Push (or Lovable edit) → GitHub → Coolify rebuilds → live.

## 1. Database (Postgres + optional Supabase stack)

Coolify → Databases → Postgres 15+ (or the one-click **Supabase** template if you want Auth/Storage/PostgREST).

Then from your laptop:

```bash
export DATABASE_URL="postgres://postgres:PASS@db.yourdomain.com:5432/postgres"

psql "$DATABASE_URL" -f db/install.sql        # full schema, RLS, RPCs
psql "$DATABASE_URL" -f db/storage.sql        # Supabase Storage buckets (skip if no Supabase)
# edit {{APP_URL}} + {{ANON_KEY}} first:
psql "$DATABASE_URL" -f db/cron/schedule.sql  # scheduled jobs
# after your first sign-up, edit the email inside then run:
psql "$DATABASE_URL" -f db/seed-admin.sql
```

All 30+ tables, roles (`super_admin` / `admin` / `merchant`), RLS policies, and every RPC (`has_role`, `apply_discount_code`, `consume_rate_limit`, `effective_merchant_role`, …) are created here. No further schema setup required.

## 2. App service on Coolify

- **Build pack:** Dockerfile (repo root `Dockerfile`)
- **Port:** `3000`
- **Env vars** (see `.env.example`):
  - `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY`, `VITE_SUPABASE_PROJECT_ID` — also add as **Build Args** so the client bundle bakes them in
  - `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_SERVICE_ROLE_KEY`
  - `RESEND_API_KEY`, `GATEWAYAPI_TOKEN` (optional)
  - `NITRO_PRESET=node-server`

Attach your domain (e.g. `pay.yourdomain.com`) in Coolify. HTTPS is automatic.

## 3. First-user promotion

1. Open the deployed site, sign up (email/password) as yourself.
2. Edit `db/seed-admin.sql`, set your email, `psql -f db/seed-admin.sql`.
3. Refresh — you now see the `/admin` panel.

## 4. Files map

```
Dockerfile              Node server build for Coolify
.env.example            All required environment variables
db/install.sql          One-shot full schema
db/migrations/          24 individual migration files (in order)
db/storage.sql          KYC + disputes buckets + RLS
db/cron/schedule.sql    pg_cron jobs (expire, retry, recurring, digest, payouts)
db/seed-admin.sql       Promote first user to super_admin
```

## 5. What ships out of the box

Tables (30+): profiles, user_roles, team_members, api_keys, api_request_logs, invoices, transactions, payment_methods, byo_gateways, webhook_endpoints, webhook_deliveries, notifications, notification_settings, notification_log, digest_settings, payouts, payout_schedules, discount_codes, disputes, recurring_schedules, fraud_blocklist, fx_rates, ip_whitelist, idempotency_keys, rate_limit_buckets, incidents, platform_settings, audit_logs …

Features: merchant + admin dashboards, hosted checkout `/pay/:id`, public tip-jar `/m/:slug`, customer portal `/portal`, status page `/status`, API reference `/api-reference`, Postman export, bKash/Nagad BYO verifiers, MFA login, RBAC, HMAC webhooks with exponential retry, refunds, disputes with evidence, discounts, multi-currency, recurring invoices, email/SMS/Slack/Discord notifications, invoice PDF, CSV import/export.

## 6. Ongoing edits

- Edit in Lovable → auto-pushes to GitHub → Coolify auto-rebuilds. Nothing manual.
- For a new DB migration Lovable adds later, apply just the new file:
  `psql "$DATABASE_URL" -f db/migrations/<new-timestamp>.sql`
