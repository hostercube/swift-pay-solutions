// Central registry for all payment gateways supported by PayNOC.
// Adapters (checkout initiation + webhook verification) look up by `id`.

export type GatewayField = {
  key: string;
  label: string;
  type: "text" | "password" | "textarea";
  placeholder?: string;
  required?: boolean;
  help?: string;
};

export type GatewayRegion = "BD" | "GLOBAL" | "CRYPTO";

export type GatewayFlow =
  | "hosted_redirect"   // gateway hosts checkout page; we redirect
  | "server_intent"     // create intent server-side, complete via SDK on client
  | "manual"            // customer sends money manually, merchant verifies
  | "invoice_email";    // gateway emails / links customer

export type GatewaySpec = {
  id: string;
  label: string;
  region: GatewayRegion;
  logo?: string;
  currencies: string[];
  flow: GatewayFlow;
  supportsManual?: boolean;   // can also be used in manual verification mode
  supportsApi?: boolean;      // has official API for auto-verification
  supportsPayout?: boolean;
  supportsRefund?: boolean;
  supportsWebhook?: boolean;
  fields: GatewayField[];     // credentials expected for API mode
  docsUrl?: string;
  webhookHint?: string;       // note for merchants (where to paste webhook URL)
};

export const GATEWAYS: GatewaySpec[] = [
  // ── Bangladesh ─────────────────────────────────────────────
  {
    id: "bkash",
    label: "bKash",
    region: "BD",
    currencies: ["BDT"],
    flow: "hosted_redirect",
    supportsManual: true,
    supportsApi: true,
    supportsRefund: true,
    supportsWebhook: true,
    fields: [
      { key: "app_key", label: "App Key", type: "password", required: true },
      { key: "app_secret", label: "App Secret", type: "password", required: true },
      { key: "username", label: "Username", type: "text", required: true },
      { key: "password", label: "Password", type: "password", required: true },
    ],
    docsUrl: "https://developer.bka.sh/docs",
    webhookHint: "bKash uses execute+query API; webhook optional.",
  },
  {
    id: "nagad",
    label: "Nagad",
    region: "BD",
    currencies: ["BDT"],
    flow: "hosted_redirect",
    supportsManual: true,
    supportsApi: true,
    supportsWebhook: true,
    fields: [
      { key: "merchant_id", label: "Merchant ID", type: "text", required: true },
      { key: "merchant_number", label: "Merchant Number", type: "text", required: true },
      { key: "public_key", label: "Nagad Public Key (PEM)", type: "textarea", required: true },
      { key: "private_key", label: "Merchant Private Key (PEM)", type: "textarea", required: true },
    ],
    docsUrl: "https://nagadpg.com/docs",
  },
  {
    id: "rocket",
    label: "Rocket (DBBL)",
    region: "BD",
    currencies: ["BDT"],
    flow: "manual",
    supportsManual: true,
    supportsApi: false,
    fields: [
      { key: "merchant_number", label: "Merchant Rocket Number", type: "text", required: true },
    ],
    docsUrl: "https://www.dutchbanglabank.com/rocket",
  },
  {
    id: "sslcommerz",
    label: "SSLCommerz",
    region: "BD",
    currencies: ["BDT", "USD"],
    flow: "hosted_redirect",
    supportsApi: true,
    supportsRefund: true,
    supportsWebhook: true,
    fields: [
      { key: "store_id", label: "Store ID", type: "text", required: true },
      { key: "store_password", label: "Store Password", type: "password", required: true },
    ],
    docsUrl: "https://developer.sslcommerz.com/",
    webhookHint: "Paste IPN URL in SSLCommerz merchant panel.",
  },
  {
    id: "shurjopay",
    label: "ShurjoPay",
    region: "BD",
    currencies: ["BDT"],
    flow: "hosted_redirect",
    supportsApi: true,
    supportsWebhook: true,
    fields: [
      { key: "merchant_username", label: "Merchant Username", type: "text", required: true },
      { key: "merchant_password", label: "Merchant Password", type: "password", required: true },
      { key: "prefix", label: "Prefix", type: "text", required: true, placeholder: "sp" },
    ],
    docsUrl: "https://engineering.shurjopay.com.bd/",
  },
  {
    id: "aamarpay",
    label: "AamarPay",
    region: "BD",
    currencies: ["BDT"],
    flow: "hosted_redirect",
    supportsApi: true,
    supportsWebhook: true,
    fields: [
      { key: "store_id", label: "Store ID", type: "text", required: true },
      { key: "signature_key", label: "Signature Key", type: "password", required: true },
    ],
    docsUrl: "https://aamarpay.com/developer",
  },
  {

    id: "uddoktapay",
    label: "UddoktaPay",
    region: "BD",
    currencies: ["BDT"],
    flow: "hosted_redirect",
    supportsApi: true,
    supportsWebhook: true,
    fields: [
      { key: "base_url", label: "Base URL", type: "text", required: true, placeholder: "https://pay.your-domain.com", help: "Your UddoktaPay installation URL" },
      { key: "api_key", label: "API Key", type: "password", required: true },
    ],
    docsUrl: "https://uddoktapay.readme.io/reference/overview",
    webhookHint: "Add the webhook URL below in UddoktaPay admin → Webhook Settings.",
  },
  {
    id: "piprapay",
    label: "PipraPay",
    region: "BD",
    currencies: ["BDT", "USD", "INR"],
    flow: "hosted_redirect",
    supportsApi: true,
    supportsWebhook: true,
    fields: [
      { key: "base_url", label: "Base URL", type: "text", required: true, placeholder: "https://sandbox.piprapay.com" },
      { key: "api_key", label: "API Key", type: "password", required: true },
    ],
    docsUrl: "https://docs.piprapay.com/reference/overview",
    webhookHint: "PipraPay sends webhooks with the mh-piprapay-api-key header for verification.",
  },
  {
    id: "ownpay",
    label: "OwnPay (self-hosted)",
    region: "BD",
    currencies: ["BDT", "USD"],
    flow: "hosted_redirect",
    supportsApi: true,
    supportsWebhook: true,
    fields: [
      { key: "base_url", label: "Base URL", type: "text", required: true, placeholder: "https://pay.your-domain.com", help: "Your OwnPay self-hosted instance" },
      { key: "api_key", label: "API Key", type: "password", required: true },
      { key: "webhook_secret", label: "Webhook Secret (HMAC)", type: "password" },
    ],
    docsUrl: "https://ownpay.org/",
    webhookHint: "OwnPay posts JSON with an X-Signature HMAC-SHA256 header.",
  },



  // ── International ──────────────────────────────────────────
  {
    id: "stripe",
    label: "Stripe",
    region: "GLOBAL",
    currencies: ["USD", "EUR", "GBP", "AUD", "CAD", "INR", "BDT"],
    flow: "server_intent",
    supportsApi: true,
    supportsRefund: true,
    supportsWebhook: true,
    fields: [
      { key: "secret_key", label: "Secret Key", type: "password", required: true, placeholder: "sk_live_..." },
      { key: "publishable_key", label: "Publishable Key", type: "text" },
      { key: "webhook_secret", label: "Webhook Signing Secret", type: "password", placeholder: "whsec_..." },
    ],
    docsUrl: "https://stripe.com/docs/api",
  },
  {
    id: "paypal",
    label: "PayPal",
    region: "GLOBAL",
    currencies: ["USD", "EUR", "GBP", "AUD"],
    flow: "hosted_redirect",
    supportsApi: true,
    supportsRefund: true,
    supportsWebhook: true,
    fields: [
      { key: "client_id", label: "Client ID", type: "text", required: true },
      { key: "client_secret", label: "Client Secret", type: "password", required: true },
      { key: "webhook_id", label: "Webhook ID", type: "text" },
    ],
    docsUrl: "https://developer.paypal.com/api/rest/",
  },
  {
    id: "razorpay",
    label: "Razorpay",
    region: "GLOBAL",
    currencies: ["INR", "USD"],
    flow: "server_intent",
    supportsApi: true,
    supportsRefund: true,
    supportsWebhook: true,
    fields: [
      { key: "key_id", label: "Key ID", type: "text", required: true },
      { key: "key_secret", label: "Key Secret", type: "password", required: true },
      { key: "webhook_secret", label: "Webhook Secret", type: "password" },
    ],
    docsUrl: "https://razorpay.com/docs/api/",
  },
  {
    id: "paddle",
    label: "Paddle",
    region: "GLOBAL",
    currencies: ["USD", "EUR", "GBP"],
    flow: "hosted_redirect",
    supportsApi: true,
    supportsWebhook: true,
    fields: [
      { key: "api_key", label: "API Key", type: "password", required: true },
      { key: "webhook_secret", label: "Notification Secret", type: "password" },
    ],
    docsUrl: "https://developer.paddle.com/",
  },
  {
    id: "twocheckout",
    label: "2Checkout (Verifone)",
    region: "GLOBAL",
    currencies: ["USD", "EUR", "GBP", "INR"],
    flow: "hosted_redirect",
    supportsApi: true,
    supportsWebhook: true,
    fields: [
      { key: "merchant_code", label: "Merchant Code", type: "text", required: true },
      { key: "secret_key", label: "Secret Key", type: "password", required: true },
    ],
    docsUrl: "https://verifone.cloud/docs/",
  },

  // ── Crypto ────────────────────────────────────────────────
  {
    id: "coinbase_commerce",
    label: "Coinbase Commerce",
    region: "CRYPTO",
    currencies: ["USD", "USDC", "BTC", "ETH"],
    flow: "hosted_redirect",
    supportsApi: true,
    supportsWebhook: true,
    fields: [
      { key: "api_key", label: "API Key", type: "password", required: true },
      { key: "webhook_shared_secret", label: "Webhook Shared Secret", type: "password", required: true },
    ],
    docsUrl: "https://commerce.coinbase.com/docs/",
  },
  {
    id: "nowpayments",
    label: "NOWPayments",
    region: "CRYPTO",
    currencies: ["USD", "USDT", "BTC", "ETH", "BNB"],
    flow: "hosted_redirect",
    supportsApi: true,
    supportsWebhook: true,
    fields: [
      { key: "api_key", label: "API Key", type: "password", required: true },
      { key: "ipn_secret", label: "IPN Secret", type: "password", required: true },
    ],
    docsUrl: "https://documenter.getpostman.com/view/7907941/S1a32n38",
  },
  {
    id: "binance_pay",
    label: "Binance Pay",
    region: "CRYPTO",
    currencies: ["USDT", "BUSD", "BNB"],
    flow: "hosted_redirect",
    supportsApi: true,
    supportsWebhook: true,
    fields: [
      { key: "api_key", label: "API Key", type: "password", required: true },
      { key: "api_secret", label: "API Secret", type: "password", required: true },
    ],
    docsUrl: "https://developers.binance.com/docs/binance-pay/introduction",
  },
];

export function getGateway(id: string): GatewaySpec | undefined {
  return GATEWAYS.find((g) => g.id === id);
}

export function gatewaysByRegion(region: GatewayRegion): GatewaySpec[] {
  return GATEWAYS.filter((g) => g.region === region);
}
