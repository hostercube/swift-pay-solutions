# PayNOC ↔ Shopify Bridge

A small Node service that connects a Shopify store to your PayNOC deployment.

## What it does

- **Shopify → PayNOC:** listens for `orders/create`; when the order uses the "PayNOC" manual payment gateway, it creates a PayNOC hosted-checkout invoice and tags the Shopify order with the checkout URL.
- **PayNOC → Shopify:** listens for `invoice.completed`; records a Shopify transaction and marks the order paid.

## Callback URLs

After deploying (Render / Fly / Railway / your own VPS), your two public URLs are:

```
POST  https://YOUR-BRIDGE-HOST/webhooks/shopify/orders-create
POST  https://YOUR-BRIDGE-HOST/webhooks/paynoc
```

- Register the first one in **Shopify Admin → Settings → Notifications → Webhooks** (event: `Order creation`, format JSON).
- Register the second one in **PayNOC dashboard → Webhooks** (event: `invoice.completed`).

## Setup

1. In Shopify Admin: **Settings → Payments → Manual payment methods → Add manual payment method**. Name it `PayNOC` (the bridge matches on this name).
2. Create a Shopify custom app with **write_orders** scope; copy the Admin API access token and webhook signing secret.
3. `cp .env.example .env` and fill in every variable, then:
   ```bash
   npm install
   npm start
   ```

## Security

- Verifies Shopify's `X-Shopify-Hmac-SHA256` on every incoming Shopify webhook.
- Verifies PayNOC's `x-paynoc-signature` (HMAC-SHA256 over `t.body`) with a 5-minute replay window.
- Requires HTTPS for the PayNOC API base URL.
- All secrets are read from env vars — never logged, never returned in responses.

## Env vars

```
PORT=3000
PAYNOC_API_BASE=https://paynoc.com
PAYNOC_API_KEY=sk_live_...
PAYNOC_WEBHOOK_SECRET=whsec_...
SHOPIFY_STORE=yourshop.myshopify.com
SHOPIFY_ADMIN_TOKEN=shpat_...
SHOPIFY_WEBHOOK_SECRET=...
PUBLIC_BASE_URL=https://your-bridge-host
```
