=== PayNOC for WooCommerce ===
Contributors: paynoc
Tags: woocommerce, payments, bkash, nagad, rocket, bangladesh
Requires at least: 5.8
Tested up to: 6.6
Requires PHP: 7.4
Stable tag: 1.0.0
License: GPLv2 or later

Accept bKash, Nagad, Rocket, Cards and other PayNOC methods in WooCommerce with hosted checkout, multi-currency, and HMAC-signed webhooks.

== Description ==

- Hosted PayNOC checkout — no card data touches your WordPress site
- Multi-currency (uses the WooCommerce order currency as-is)
- Idempotent order creation
- HMAC-SHA256 signed webhooks with 5-minute replay protection
- Full refund support from the WooCommerce order screen

== Installation ==

1. Upload the `paynoc-for-woocommerce` folder to `/wp-content/plugins/`.
2. Activate the plugin.
3. Go to **WooCommerce → Settings → Payments → PayNOC** and configure:
   - API Base URL (HTTPS)
   - API Key
   - Webhook Signing Secret
4. Copy the callback URL shown on the settings screen into PayNOC dashboard → Webhooks.

== Changelog ==

= 1.0.0 =
* First public release.
