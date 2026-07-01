# PayNOC — Self-hosted Database Setup (Coolify / Self-hosted Supabase)

All SQL you need to run PayNOC on your own infrastructure lives in this folder.
No Lovable Cloud, no managed Supabase — just Postgres + (optionally) the
self-hosted Supabase stack.

```
db/
├── install.sql          # ← run ONCE on a fresh Postgres. Full schema + RLS + functions.
├── storage.sql          # ← run on self-hosted Supabase for KYC + dispute buckets.
├── cron/schedule.sql    # ← run on the primary DB to enable pg_cron jobs.
└── migrations/          # Individual migration files in chronological order.
```

## 1. Prerequisites

- Postgres 15+ (comes with self-hosted Supabase / Coolify's Supabase template)
- Extensions: `pgcrypto` (required), `pg_cron` + `pg_net` (only if you want
  scheduled jobs — expiry, webhook retry, recurring, digest, auto payout)
- If you use Supabase Auth / Storage / PostgREST: the standard self-hosted
  Supabase stack (Coolify has a one-click template)

## 2. Install the schema

Option A — one shot:

```bash
psql "$DATABASE_URL" -f db/install.sql
```

Option B — apply migrations one by one (recommended if you plan to keep
evolving the schema):

```bash
for f in db/migrations/*.sql; do
  echo ">>> $f"
  psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f "$f"
done
```

## 3. Storage buckets (Supabase only)

If you're running the full self-hosted Supabase stack:

```bash
psql "$DATABASE_URL" -f db/storage.sql
```

Buckets created: `kyc` (private), `disputes` (private).

If you're on plain Postgres without Supabase Storage, plug in your own
S3/MinIO and update the upload code in
`src/routes/_authenticated/disputes.tsx` and the KYC uploader.

## 4. Scheduled jobs

Edit `db/cron/schedule.sql` and replace the two placeholders:

- `{{APP_URL}}` — your deployed PayNOC URL (e.g. `https://pay.yourdomain.com`)
- `{{ANON_KEY}}` — your self-hosted Supabase anon / publishable key

Then:

```bash
psql "$DATABASE_URL" -f db/cron/schedule.sql
```

Verify:

```sql
SELECT jobname, schedule FROM cron.job;
```

## 5. App environment variables (Coolify service)

The Node/Vite app needs these env vars in Coolify:

| Variable                       | Purpose                                       |
|--------------------------------|-----------------------------------------------|
| `VITE_SUPABASE_URL`            | Public URL of your self-hosted Supabase       |
| `VITE_SUPABASE_PUBLISHABLE_KEY`| Anon / publishable key                        |
| `SUPABASE_URL`                 | Same URL (server-side)                        |
| `SUPABASE_PUBLISHABLE_KEY`     | Same anon key (server-side)                   |
| `SUPABASE_SERVICE_ROLE_KEY`    | Service-role key (server-only, never expose)  |
| `RESEND_API_KEY`               | For email notifications & digest (optional)   |
| `GATEWAYAPI_TOKEN`             | For SMS notifications (optional)              |

## 6. Fresh install checklist

1. Spin up Postgres (Coolify → Databases → Postgres, or the Supabase template).
2. `psql -f db/install.sql`
3. `psql -f db/storage.sql` *(Supabase only)*
4. Edit + `psql -f db/cron/schedule.sql` *(optional but recommended)*
5. Deploy the app in Coolify with the env vars above.
6. Sign up the first user → then promote to super_admin:

   ```sql
   INSERT INTO public.user_roles (user_id, role)
   SELECT id, 'super_admin' FROM auth.users WHERE email = 'you@example.com'
   ON CONFLICT DO NOTHING;
   ```

Done. All 30+ tables, RLS policies, RPCs, and cron jobs are ready.

## Re-running

`install.sql` is chronological migrations concatenated. It is NOT fully
idempotent — run it once on a fresh DB. For upgrades, apply only the NEW
files in `db/migrations/` that you haven't run yet (track them yourself or
use `supabase db push` against your self-hosted instance).
