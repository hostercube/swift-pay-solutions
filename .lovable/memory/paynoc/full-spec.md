---
name: PayNOC full specification
description: Complete original user brief for PayNOC self-hosted merchant payment infrastructure platform
type: feature
---

# PayNOC — Full Specification

**Project:** PayNOC
**Tagline:** Self Hosted Merchant Payment Infrastructure
**Model:** NOT wallet, NOT aggregator, NEVER holds merchant money. Every merchant receives payments directly into their own accounts.

## Platform Responsibilities
Payment Processing, Verification, Automation, Routing, APIs, Hosted Checkout, Merchant Management, Webhooks, Notifications, Reports, SDKs, Plugins.

## Requested Tech Stack (original)
Frontend: Next.js, React, TS, Tailwind, shadcn
Backend: NestJS, TS
DB: PostgreSQL + Prisma
Cache/Queue: Redis + BullMQ
Realtime: Socket.io
Storage: MinIO
Auth: JWT + refresh + Email OTP + SMS OTP + TOTP + 2FA + Passkeys
Monitoring: Prometheus + Grafana + OpenTelemetry
Deploy: Docker Compose + Coolify + Traefik

**Lovable adaptation:** TanStack Start + React + TS + Tailwind + shadcn + Lovable Cloud (Postgres + Auth + Storage + Server Functions). Docker/Coolify/MinIO/Android native NOT applicable.

## Monorepo layout (original request)
/apps /packages /plugins /sdk /mobile /docs /docker /scripts
Clean Architecture, DDD, SOLID, Repository Pattern, CQRS where needed.

## Super Admin
Dashboard, Merchant Management (Approval, KYC, Verification, Suspension, Blocking), Subscription Plans, Package Management, Pricing Rules, Transaction Monitoring, Fraud Monitoring, Dispute Center, Webhook Logs, API Logs, System Logs, Email Templates, SMS Templates, Notification Templates, Role Permission, Admin Roles, System Settings (SMTP/SMS Gateway/Storage/Redis/Cron/Queues), Backup/Restore (DB + Media), API Keys, Webhooks, Audit Logs, IP Whitelist, Rate Limiting, Geo Blocking, Country Blocking, Maintenance Mode, Feature Flags.

## Merchant Panel
Merchant Registration, Business Profile, Personal Profile, Company Verification, KYC Upload, API Keys, Secret Keys, Webhook Secret, Developer Dashboard, Sandbox, Production Mode, Dashboard, Payments, Transactions, Refunds, Invoices, Customers, Subscriptions, Payment Links, Hosted Checkout, Invoices, QR Checkout, Reports, Analytics, API Logs, Webhook Logs, Notification Logs, Staff Accounts, Permissions, Theme Settings, Brand Settings, Custom Domain, White Label.

## NO WALLET Rule (critical)
No merchant wallet. No settlement request. No withdrawal request. Platform never keeps money. Merchant receives directly into their configured destination.

## Payment Method Manager
Each merchant configures unlimited methods:
bKash Personal/Merchant, Nagad Personal/Merchant, Rocket, Upay, CellFin, Bank Transfer, Visa, Mastercard, Amex, UnionPay, Payoneer, Wise, Stripe, PayPal, Paddle, LemonSqueezy, Razorpay, PhonePe, Google Pay, Apple Pay, Amazon Pay, Paytm, Crypto Wallet, USDT TRC20, USDT BEP20, USDC, Binance Pay, Custom Gateway, Manual Gateway, Offline Payment.

Each method fields: Logo, Display Name, Instructions, Account Number, Merchant Credentials, API Credentials, Webhook URL, Return/Cancel/Success/Failure URLs, QR Code, Status, Priority, Currency, Fees, Limits.

## Bring Your Own Gateway
Merchants connect their own official provider credentials. Support official APIs, configurable custom connectors, custom webhook integrations, custom callback formats. Merchants can build their own integrations without changing platform code.

## Payment Engine
Hosted / Embedded / Popup Checkout, Direct API, Payment Links, Invoices, QR Checkout (Dynamic + Static), Webhook, Callback, Verification, Duplicate Detection, Expired Payment, Retry Queue, Background Queue, Event Driven Processing, Idempotency, Multi Currency, Partial + Full Payment, Payment Timeout, Payment Status Tracking.

## API
REST + Webhook + Checkout + Invoice + Customer + Subscription + Payment + Verification + Refund + Developer APIs. OpenAPI + Swagger + SDK examples.

## Official Plugins (original request; out-of-scope for Lovable)
WooCommerce, WHMCS, Blesta, WordPress, Shopify, Laravel Package, PHP/NodeJS/Python/Go/Java SDK, Flutter/Android SDK, React/NextJS/Vue/Nuxt/Angular SDK, Composer/NPM/PyPI packages, Automatic Installer, One Click Integration.

## SMS System
Universal SMS provider layer. Admin enable/disable. Merchants choose provider. Failover, load balancing, priority routing, sender ID, Unicode, OTP, transactional, marketing.
Adapters: SMSNOC, MIM SMS, REVE Systems SMS, BulkSMSBD, eSMS, Alpha SMS, SMSQ + extensible connector architecture.

## Email System
SMTP, Amazon SES, Mailgun, SendGrid, Postmark, Brevo, Custom SMTP. Templates, Queue, Retry.

## Notification
Email, SMS, WhatsApp, Telegram, Push, In-App.

## Android Application (out-of-scope for Lovable)
Merchant Login, OTP, Fingerprint, Face Unlock, Dashboard, Realtime Notifications, Transaction History, Payment Alerts, QR Scanner/Generator, KYC Upload, Document Scanner, API Key Management, Webhook Test.

## Security
AES encryption, JWT, refresh token, secure session, 2FA, Passkeys, Audit Log, Rate Limiting, Cloudflare support, CSRF, XSS, SQL injection protection, secure headers, encrypted secrets, secrets manager.

## Database
Scalable PostgreSQL schema. UUID PKs. Soft delete. Indexes. Optimized queries. Audit tables. History tables. Versioning.

## UI
Premium Enterprise Dashboard. Stripe-level UI. Modern glass design. Responsive (desktop/tablet/mobile). Dark + light mode. Beautiful charts. Professional analytics. Animations.

## DevOps (original request; out-of-scope for Lovable)
Dockerized. Coolify. Automatic migration. DB seeder. Health checks. Zero downtime. Backup/restore. Production ready.

## Final Requirements
Production-ready. No placeholders. No demo pages. No fake APIs. No mock data. Every module functional. Every CRUD works. Every API works. Every integration extendable. Every plugin installable. Every SDK usable. Self-hosted. Scalable to millions of transactions.
