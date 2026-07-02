# 🌐 PayNOC — Multi-Subdomain Setup (Bangla, Easy Guide)

Ekta app deploy, 4 ta subdomain — sob automatic route hobe.

| Subdomain | Ki hoy | Kotha jay (internal) |
|---|---|---|
| `paynoc.bd` | Main site (landing, login, dashboard) | `/` sob route |
| `pay.paynoc.bd` | Hosted checkout / tip jar / portal | `/pay/<id>`, `/m/<slug>`, `/portal`, `/status` |
| `docs.paynoc.bd` | Documentation + API reference | `/docs`, `/api-reference` |
| `api.paynoc.bd` | REST API endpoints | `/api/*` |

**How it works:** `src/server.ts` e ekta subdomain rewriter add korechhi. Request ashle `Host` header dekhe automatic path prefix add kore. Route file kichu change korte hobe na.

---

## ধাপ ১ — Cloudflare DNS records add koro

Cloudflare dashboard → `paynoc.bd` → **DNS → Records**:

Tomar Coolify server er public IP `XXX.XXX.XXX.XXX` diye ei 4 ta A record add koro:

| Type | Name | Content | Proxy |
|---|---|---|---|
| A | `@` | `XXX.XXX.XXX.XXX` | 🟠 DNS only (Coolify SSL er jonno) |
| A | `www` | `XXX.XXX.XXX.XXX` | 🟠 DNS only |
| A | `pay` | `XXX.XXX.XXX.XXX` | 🟠 DNS only |
| A | `docs` | `XXX.XXX.XXX.XXX` | 🟠 DNS only |
| A | `api` | `XXX.XXX.XXX.XXX` | 🟠 DNS only |

⚠️ **Important:** Prothome sob **DNS only** (grey cloud) rakho. Coolify Let's Encrypt SSL issue korar por chaile Cloudflare proxy (orange cloud) on kore dio.

---

## ধাপ ২ — Coolify e Application er Domains add koro

Coolify → tomar `paynoc` application → **Domains** section e ei 5 ta domain likho (each new line):

```
https://paynoc.bd
https://www.paynoc.bd
https://pay.paynoc.bd
https://docs.paynoc.bd
https://api.paynoc.bd
```

**Save** click koro → Coolify Traefik ke bolbe ei sob hostname ei ekta container e route korte + Let's Encrypt theke wildcard-style SSL cert nite (each subdomain er jonno alada cert issue hobe, auto).

---

## ধাপ ৩ — Environment Variable add koro

App er **Environment Variables** tab e add koro:

```
APEX_DOMAIN=paynoc.bd
```

Ei variable diye `src/server.ts` er rewriter jane kon domain er niche kaj korche. **Redeploy** koro.

---

## ধাপ ৪ — Wait koro (2-5 min) + Test koro

Coolify SSL certificate issue korche — Deploy logs e dekho:
```
✓ Certificate obtained for paynoc.bd
✓ Certificate obtained for pay.paynoc.bd
✓ Certificate obtained for docs.paynoc.bd
✓ Certificate obtained for api.paynoc.bd
```

Test URLs:

| URL | Ki dekhbe |
|---|---|
| `https://paynoc.bd` | Landing page + Sign up / Login |
| `https://paynoc.bd/dashboard` | Merchant dashboard (login er por) |
| `https://pay.paynoc.bd/INVOICE_ID` | Checkout page |
| `https://pay.paynoc.bd/m/YOUR_SLUG` | Tip jar / public merchant page |
| `https://pay.paynoc.bd/portal` | Customer portal |
| `https://docs.paynoc.bd` | Documentation |
| `https://docs.paynoc.bd/api-reference` | Interactive API reference |
| `https://api.paynoc.bd/public/v1/invoices` | REST API |

---

## ধাপ ৫ — Invoice URL update koro (auto)

Notun invoice create korle checkout link **auto** `pay.paynoc.bd` e generate hobe — kichu korte hobe na, karon rewriter transparent.

Tumi merchant panel e ekta setting o rakhte paro: **Base checkout URL** = `https://pay.paynoc.bd`. Ei URL diye API te full link return korbe:

```json
{
  "invoice_id": "abc123",
  "checkout_url": "https://pay.paynoc.bd/abc123"
}
```

---

## 🔧 Cloudflare proxy (orange cloud) on korte chaile

Coolify SSL issue howar por (DNS only e), tarpor Cloudflare proxy on koro. Ei setting o lagbe:

- **SSL/TLS mode:** `Full (strict)` — NOT Flexible
- **Always Use HTTPS:** ON
- **Automatic HTTPS Rewrites:** ON

Cloudflare proxy on korle DDoS protection + caching pabe.

---

## 🆘 Troubleshooting

**Subdomain e "404" ashche:**
- `APEX_DOMAIN` env var set ache kina check koro
- App redeploy koro

**SSL "Not secure" dekhachhe:**
- Cloudflare proxy off (DNS only) rakho prothome
- Coolify Logs e dekho Let's Encrypt error ache kina
- 5-10 min wait koro

**`pay.paynoc.bd` e login page dekhachhe:**
- Rewriter kaj kore ni — build cache clear kore redeploy koro
- Browser DevTools → Network → `Host` header check koro

**Cross-subdomain login work korche na:**
- Supabase auth cookie apex domain e set korte hobe. Supabase client normally localStorage use kore — subdomain aliada session hobe. Ek session cross-subdomain lagle Supabase Auth cookie based flow use korte hobe (advanced).

Sohoj solution: **login/dashboard sudhu main `paynoc.bd`** e rakho, `pay.paynoc.bd` public checkout er jonno (login lage na), `docs.paynoc.bd` public. Etai default flow — kichu extra korte hobe na.

---

## ✅ Summary

1. Cloudflare e 5 ta A record (@, www, pay, docs, api) — sob DNS only
2. Coolify app er Domains e 5 ta URL add
3. `APEX_DOMAIN=paynoc.bd` env var
4. Redeploy → auto SSL → done

**Sob ekta deploy theke chalbe. Extra server / container lagbe na.** 🚀
