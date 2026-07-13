# PayNOC Merchant SMS Auto-Verify APK

Premium Kotlin/Jetpack Compose Android app that lives on the merchant's phone,
reads incoming payment SMS (bKash / Nagad / Rocket / Bank), and POSTs the
parsed events to your PayNOC backend for auto-verification.

## Features

- **Multi-merchant**: one install can be linked to one merchant account via API
  key + backend base URL — no hardcoded tenant.
- **Offline queue**: every SMS is persisted in a local Room DB. When the phone
  has no network, events pile up locally and drain automatically via WorkManager
  when connectivity returns.
- **Per-event verification feedback**: the backend response is parsed and each
  SMS row is marked `AUTO-VERIFIED` (matched to an invoice), `UPLOADED` (no
  matching pending invoice), or `FAILED` (bad key / malformed). A heads-up
  notification fires the moment a payment is matched.
- **Retry failed**: one tap re-queues every `FAILED` row (e.g. after rotating a
  bad API key) — no need to reinstall.
- **Battery-friendly**: `SmsReceiver` runs only when SMS arrive; no background
  polling. A 15-min periodic drain covers cold-start / reboot cases.
- **Zero-touch parsing**: regex-based parsers for bKash, Nagad, Rocket, DBBL
  Nexus, and Bangla QR (Bangladesh Bank unified QR) SMS from any bank / MFS.
  Add more in `parsers/SmsParsers.kt`.
- **Idempotent**: backend matches on `(merchant_id, provider_txn_id)`, so
  duplicate SMS deliveries are safe.
- **Premium UI**: Material 3 dark theme, live pending / verified-today / failed
  counters, transaction log with per-row match status.

## How it plugs into PayNOC

1. Merchant logs in on the PayNOC dashboard, creates an API key
   (`Settings → API keys → Create key`).
2. Merchant installs `paynoc-merchant.apk` on the phone that receives payment
   SMS.
3. On first launch: paste **Backend URL** (e.g. `https://paynoc.bd`) and
   **API key** (`sk_live_...`). Grant SMS permission.
4. Any payment SMS is now:
    - captured by `SmsReceiver`
    - parsed by `SmsParsers`
    - saved to Room
    - POSTed to `${BACKEND_URL}/api/public/v1/sms-events`
    - matched against a pending transaction and auto-verified — the merchant
      dashboard flips the invoice to `completed` and fires the webhook.

## Build

```bash
cd android-app
./gradlew assembleRelease
# APK output: app/build/outputs/apk/release/app-release.apk
```

Signing keys: place your `keystore.jks` at `android-app/keystore.jks` and set
`KEYSTORE_PASSWORD`, `KEY_ALIAS`, `KEY_PASSWORD` in `~/.gradle/gradle.properties`
before running `assembleRelease`.

For a public download on the PayNOC site, host the signed APK at
`public/downloads/paynoc-merchant.apk` (create the directory) and link it from
the merchant dashboard.

## Adding a new SMS template

1. Send yourself a real SMS from that provider.
2. Open `parsers/SmsParsers.kt`, add a `Parser` entry with:
    - `senderIds`: known SMS sender IDs (e.g. `"bKash"`, `"NAGAD"`, `"DBBL"`).
    - `regex`: single regex with named groups `trxId`, `amount`, `sender`.
3. Rebuild.

## Security notes

- The API key never leaves EncryptedSharedPreferences on the device.
- All traffic is HTTPS. Certificate pinning is configurable in
  `network/HttpClient.kt`.
- SMS body is uploaded verbatim — merchant sees a permission consent screen on
  install and can revoke at any time from Android Settings.
