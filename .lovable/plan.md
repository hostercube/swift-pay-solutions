## Somossha ki

Duita alada issue:

**1. Supabase Studio public** — `https://supabase.paynoc.bd/` khullei password chara Studio dashboard chole aschhe. Ei ta code er bug NA — Coolify Supabase service er Kong dashboard e basic-auth enable kora nai. Fix Coolify env var e (code change nai).

**2. Docker build fail** — 3ta chain problem Dockerfile e:
- `oven/bun:1.1` image e Bun 1.1.45 ache, kintu `bun.lock` file "lockfileVersion 1" (new text format, Bun 1.2+ only) → `InvalidLockfileVersion`, lockfile ignore hoyeche
- Same image e bundled Node 22.6.0, Vite 8 requires Node 20.19+ or 22.12+ → warning
- Build fail: `SyntaxError: Export named 'parseEnv' not found in module 'util'` — ei Node 22.6-e `util.parseEnv` nai, Vite 8 dependency chain ei API expect kore → hard crash
- Dockerfile warnings: Supabase keys `ARG`/`ENV` diye pass hocche (publishable anon key ok public, tobe Docker BuildKit warning die)

## Ki fix korbo

### A) Dockerfile rewrite
- Build stage: `oven/bun:1.1` → **`oven/bun:1.2-alpine`** (Bun 1.2+ new lockfile bujhbe, bundled Node 22.13+ Vite compatible)
- Runtime stage same rakhbo: `node:20-alpine` (chhoto image, prod e Nitro node-server chalabe)
- Publishable/anon keys `ARG` hisebe rakhbo (public keys, safe) tobe SERVICE_ROLE_KEY `ARG` theke bad — ota runtime-only, build e lagena
- `bun install --frozen-lockfile || bun install` rakhbo (fallback)

### B) Supabase Studio lock (chat-only guidance, code na)
Coolify → Supabase service → Environment Variables e ei duita set/verify koro (already ache mostly, kintu Kong e effect nite service restart lage):
```
DASHBOARD_USERNAME=<strong-username>
DASHBOARD_PASSWORD=<strong-password>
```
Save → Supabase service **Restart**. Er por `https://supabase.paynoc.bd` visit korle browser basic-auth prompt dibe. Ei duita set thakleo restart chara Kong reload hoy na — sei jonno public access dekhchile.

Additional hardening (optional): Cloudflare-e `supabase.paynoc.bd` subdomain e Cloudflare Access (Zero Trust) rule diye email-only allow, ba IP whitelist.

### C) `DEPLOY_NOW_BANGLA.md` update
Notun Part 0 (Security first — Studio lock) + Part 11 e Docker build error troubleshooting section add korbo, jate future e same error hole solve kora jay.

## Files change

- ✏️ Edit: `Dockerfile` (bun image bump, service role arg remove)
- ✏️ Edit: `DEPLOY_NOW_BANGLA.md` (Studio lock steps + build error notes)

Kono database/app logic change nai. Approve korle apply korbo, tumi GitHub e push kore Coolify redeploy diyo.
