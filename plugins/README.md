# PayNOC Merchant Plugins

Drop-in plugins so any merchant can accept PayNOC payments on their existing platform.

| Platform    | Path                                | Callback URL (after install)                                                     |
| ----------- | ----------------------------------- | -------------------------------------------------------------------------------- |
| WHMCS       | `whmcs/`                            | `https://YOUR-WHMCS/modules/gateways/callback/paynoc.php`                        |
| WooCommerce | `wordpress/paynoc-for-woocommerce/` | `https://YOUR-SITE/wp-json/paynoc/v1/webhook`                                    |
| Shopify     | `shopify/paynoc-shopify-app/`       | `https://YOUR-BRIDGE/webhooks/shopify/orders-create` + `/webhooks/paynoc`        |

All three plugins share the same security model:

- HMAC-SHA256 webhook signature (`x-paynoc-signature: t=<ts>,v1=<hex>`), verified with a timing-safe compare.
- 5-minute replay window on the signed timestamp.
- HTTPS-only API base URL — refuse to send the API key over cleartext.
- Idempotency-Key header on every invoice/refund create call.
- Multi-currency: passes the platform's order currency through unchanged.
- Refund flow calls PayNOC `/api/public/v1/refunds` directly — funds are returned via the merchant's own gateway, no PayNOC-side payout needed.

See each plugin's `README.md` for step-by-step install.
