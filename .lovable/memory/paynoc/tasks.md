---
name: PayNOC task breakdown
description: Ordered task list. User triggers each with "task N koro". Agent executes only that task per turn.
type: feature
---

# PayNOC — Task Breakdown

User says "task N koro" → agent executes ONLY that task, verifies build, waits for next instruction.

## Task 1 — Foundation & Design System
- Enable Lovable Cloud
- Design tokens in src/styles.css: PayNOC brand palette (Stripe-level, glass/modern), dark+light mode, typography, gradients, shadows
- Update __root.tsx head: title "PayNOC — Self Hosted Merchant Payment Infrastructure", meta description, OG tags
- Landing page (/) with hero, tagline, feature grid, "Merchant Login" + "Admin Login" CTAs
- Public routes shell: /pricing, /docs, /contact (placeholders removed, real marketing copy)

## Task 2 — Auth & Roles
- Email/password + Google auth
- Roles table (super_admin, merchant_owner, merchant_staff, customer) with has_role() security-definer fn
- Profiles table + trigger on signup
- /auth page (login/signup with tab switch)
- _authenticated layout gate
- Sign-in with Google via lovable broker
- 2FA (TOTP) setup UI + enforcement

## Task 3 — Database Schema (core)
Migrations for: merchants, merchant_kyc, merchant_staff, subscription_plans, merchant_subscriptions, api_keys (hashed), webhook_secrets, payment_methods (per-merchant, all fields from spec), customers, invoices, payment_links, transactions, transaction_events, refunds, webhooks_deliveries, api_logs, notification_logs, audit_logs, feature_flags, ip_whitelist, system_settings.
All UUID PK, soft delete, indexes, RLS + GRANTs.

## Task 4 — Super Admin Panel
- /admin layout with sidebar (gated by super_admin role)
- Dashboard (system KPIs, charts)
- Merchants list + detail + approve/suspend/block
- KYC review queue
- Subscription plans CRUD + pricing rules
- Transaction monitoring (all merchants)
- Dispute center
- System settings pages (SMTP, SMS gateway config, feature flags, rate limits, IP whitelist, geo blocking, maintenance mode)
- Audit logs + API logs + Webhook logs viewers
- Email/SMS/Notification template editors

## Task 5 — Merchant Panel
- /dashboard layout (gated merchant_owner/staff)
- Overview dashboard (KPIs, revenue chart, recent transactions)
- Business + personal profile
- KYC upload flow
- API keys management (generate, rotate, revoke; show secret once)
- Webhook secret + webhook endpoints CRUD + test delivery
- Sandbox/production mode toggle
- Staff accounts + granular permissions
- Brand settings (logo, colors, custom domain, white-label)

## Task 6 — Payment Method Manager
- CRUD for all 30+ methods with per-method fields (logo, instructions, account, credentials, URLs, QR, status, priority, currency, fees, limits)
- Encrypted credential storage (server-side crypto)
- Enable/disable + priority ordering
- BYO custom gateway connector schema

## Task 7 — Payment Engine + Hosted Checkout
- Hosted checkout route /pay/$invoiceId (branded per merchant)
- Method picker → instructions → customer submits TrxID / redirect to BYO gateway
- Idempotency, duplicate detection, expiry, timeout
- Transaction state machine + events
- Manual verification queue for merchant
- Auto verification via BYO webhook adapters
- QR checkout (dynamic + static)
- Payment links + invoices UI

## Task 8 — Public REST API + Webhooks
- Server routes under /api/public/v1/* with API-key auth (HMAC)
- Endpoints: create checkout, create invoice, create payment link, verify payment, refund, list transactions, customer + subscription APIs
- Webhook dispatcher with retry + signature (HMAC), delivery logs
- OpenAPI JSON + Swagger UI at /docs/api
- SDK code examples (curl, JS, Python) rendered in docs

## Task 9 — Notifications
- Email adapter interface + SMTP/SES/Mailgun/SendGrid/Postmark/Brevo (config per system/merchant)
- SMS adapter interface + SMSNOC/MIM/REVE/BulkSMSBD/eSMS/Alpha/SMSQ
- Telegram + WhatsApp + in-app notifications
- Template engine (Handlebars-style) + template CRUD
- Notification event bus + delivery logs + retry

## Task 10 — Reports, Analytics, Fraud, Security Hardening
- Merchant reports (revenue, method-wise, currency-wise, refunds, disputes) with CSV export
- Admin analytics (platform-wide)
- Fraud rules engine (velocity, geo, amount thresholds) + review queue
- Rate limiting middleware, IP whitelist enforcement, geo/country blocking
- Full audit trail hooks on every mutation
- Security review pass + docs page for self-hosting notes

## Out of Scope (Lovable limits — document in docs/self-hosting.md)
- Docker Compose / Coolify / Traefik / MinIO / Prometheus / Grafana infra
- Native Android app
- WooCommerce/WHMCS/Shopify/Laravel plugins + Composer/PyPI/multi-language SDKs
- Passkeys (partial — depends on provider support)
