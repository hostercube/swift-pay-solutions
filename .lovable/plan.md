
## SMS NOC Integration Plan

Integrate smsnoc.com REST API (`https://smsnoc.com/api/v1`) as a unified notification channel for both the platform (super-admin) and merchants (their own portal).

### 1. Configuration surfaces

**Platform-level** (super-admin → Admin → Settings)
Extend `platform_settings.settings.smsnoc` JSON:
- `api_key`, `default_sender_id`, `default_email_config_id`, `default_whatsapp_device_id`
- Per-channel toggles: `sms`, `email`, `whatsapp`, `voice`
- Per-event toggles + templates for:
  - `user_registered` (welcome)
  - `password_reset` (forgot password)
  - `package_purchased` / `subscription_assigned`
  - `subscription_renewed`
  - `subscription_expiring` (reminder, 3 days before)
  - `subscription_expired`
  - `payment_received` (platform copy, optional)

**Merchant-level** (Dashboard → Integrations → SMS NOC)
New table `merchant_smsnoc_configs`:
- `merchant_id`, `api_key`, `sender_id`, `email_config_id`, `whatsapp_device_id`
- `enabled`, `notify_on_payment_received`, `notify_on_invoice_created`, `notify_on_refund`
- Channel toggles + destination (phone/email/whatsapp)
- Custom template per event

### 2. Backend

- `src/lib/smsnoc.server.ts` — provider client:
  - `sendSms({ apiKey, sender, to, message })` → POST `/send-sms`
  - `sendEmail({ apiKey, configId, to, subject, html })` → POST `/send-email`
  - `sendWhatsApp({ apiKey, deviceId, to, message })` → POST `/send-whatsapp`
  - `sendVoice({ apiKey, callerId, to, message })` → POST `/send-voice`
  - Uses `Authorization: Bearer <apiKey>`, handles 4xx/429/402 gracefully, logs to `notification_log`.
- `src/lib/notifications.server.ts` — extend `notify(event, ctx)`:
  - Look up platform + merchant config, pick channels, render template, dispatch through smsnoc client, log outcome.
- Server functions:
  - `savePlatformSmsnocConfig` (super-admin only)
  - `sendTestSmsnocMessage` (admin + merchant, sends 1 test)
  - `saveMerchantSmsnocConfig` (merchant scope via `requireSupabaseAuth`)
  - `getMerchantSmsnocConfig`

### 3. Event wiring

- **user_registered**: hook in `handle_new_user` trigger flow — call a server fn from auth signup success (`src/routes/auth.tsx`) after `supabase.auth.signUp`.
- **password_reset**: server fn `sendResetLinkWithSmsnoc` in `forgot-password.tsx` (fires after `resetPasswordForEmail` succeeds).
- **subscription_assigned / renewed / expired**: hook into `assign_subscription`, `renew_due_subscriptions`, `expire_due_subscriptions` — extend `run-subscriptions.ts` cron to enqueue notifications.
- **subscription_expiring reminder**: extend cron to select rows where `current_period_end` between now+2d and now+3d and dispatch reminder.
- **payment_received (merchant)**: hook in `payments.functions.ts` and gateway callback path (`webhooks.$provider.ts`) when invoice transitions to `completed`.

### 4. UI

- `src/routes/_authenticated/admin/settings.tsx` — new "SMS NOC" card with API key, sender id, channel/event matrix, "Send test" button.
- `src/routes/_authenticated/integrations.smsnoc.tsx` — merchant page with the same shape scoped to their config + payment-received toggles and destination fields.
- Add "SMS NOC" tile on `integrations.index.tsx`.

### 5. Database migration

- Add JSONB `smsnoc` sub-object handling to existing `platform_settings.settings`.
- New table `merchant_smsnoc_configs` with RLS: owner + team `notifications:manage` can read/write, service_role bypass. Standard GRANTs.
- Reuse `notification_log` for delivery records.

### Technical notes

- Provider auth: `Authorization: Bearer <api_key>` (query param fallback supported).
- Bangladesh MSISDN normalization is server-side by smsnoc, so we pass raw phones through.
- All outbound sends are gated behind per-config `enabled` flag + per-event toggle so nothing sends until super-admin/merchant switches it on.
- Templates use `{{name}}`, `{{amount}}`, `{{invoice_number}}`, `{{package_name}}`, `{{expires_at}}`, `{{reset_link}}` placeholders — rendered server-side.
- Failures never block the primary action (signup/payment/etc.) — logged to `notification_log` with error text and surfaced in the existing notifications settings page.

Ask for approval before I start building.
