# PayNOC for WHMCS

Accept bKash, Nagad, Rocket, Cards and all PayNOC-configured methods on your WHMCS billing panel.

## Install

1. Copy the `modules/` folder into your WHMCS root (merge with the existing `modules/gateways/` and `modules/gateways/callback/` directories).
2. In WHMCS admin: **Setup → Payments → Payment Gateways → All Payment Gateways** and activate **PayNOC**.
3. Configure:
   - **API Base URL** — your PayNOC deployment, e.g. `https://paynoc.com` (HTTPS only)
   - **API Key** — from PayNOC → API Keys
   - **Webhook Signing Secret** — from PayNOC → Webhooks
   - **Environment** — Live or Test
4. In your PayNOC dashboard → Webhooks, add this URL:
   ```
   https://YOUR-WHMCS-DOMAIN/modules/gateways/callback/paynoc.php
   ```
   Subscribe to at least `invoice.completed`.

## Features

- Hosted PayNOC checkout (no card data touches WHMCS)
- Multi-currency (passes WHMCS invoice currency through)
- Idempotency-Key on every create-invoice request
- HMAC-SHA256 signature verification with 5-minute replay window
- Admin refund action → calls PayNOC `/refunds` API

## Security notes

- API Key + Webhook Secret are stored in the WHMCS gateway settings table only; never rendered to the browser.
- Callback rejects any request where the timestamp is more than 5 minutes off, or the signature does not match.
- Only `invoice.completed` events mark WHMCS invoices as paid.
