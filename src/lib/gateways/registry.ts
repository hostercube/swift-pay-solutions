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
  setupSteps?: string[];      // "how to get these credentials", shown in the BYO editor
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
    setupSteps: [
      "Sign a bKash Payment Gateway (PGW) merchant agreement — apply at developer.bka.sh.",
      "Once approved, bKash sends you sandbox + live credentials by email: App Key, App Secret, Username, Password.",
      "Paste all four values here. Start in Sandbox mode until you test one payment end-to-end.",
      "When ready, switch this configuration to Live and re-test with a small amount.",
    ],
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
    setupSteps: [
      "Onboard as a Nagad PGW merchant through your Nagad relationship manager.",
      "Nagad issues a Merchant ID, a Merchant Number, and a Nagad Public Key (PEM).",
      "Generate your own RSA key pair (2048-bit). Share the public key with Nagad; keep the private key secret and paste it into 'Merchant Private Key' below.",
      "Paste Nagad's Public Key into 'Nagad Public Key' (starts with -----BEGIN PUBLIC KEY-----).",
      "Test in sandbox first, then switch this configuration to Live once verified.",
    ],
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
    setupSteps: [
      "Sign up at sslcommerz.com and complete merchant onboarding (trade licence, NID, bank details).",
      "In the Merchant Panel, open Integration → API/IPN. Copy your Store ID and Store Password.",
      "Sandbox credentials are available immediately from developer.sslcommerz.com — use them first.",
      "Set the IPN URL to the webhook URL shown below (in the panel: Integration → IPN Setting).",
      "Switch this configuration to Live once your account is approved.",
    ],
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
    setupSteps: [
      "Register at shurjopay.com.bd and complete KYC.",
      "ShurjoPay will email you a Merchant Username, Password, and a Prefix (e.g. 'sp', 'NOK') tied to your store.",
      "Paste all three. Use the sandbox credentials from engineering.shurjopay.com.bd first.",
      "Switch to Live once your account is approved.",
    ],
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
    id: "upay",
    label: "Upay (UCB)",
    region: "BD",
    currencies: ["BDT"],
    flow: "manual",
    supportsManual: true,
    supportsApi: false,
    fields: [
      { key: "merchant_number", label: "Merchant Upay Number", type: "text", required: true },
    ],
    docsUrl: "https://upaybd.com/",
  },
  {
    id: "tap",
    label: "Tap (Trust Axiata Pay)",
    region: "BD",
    currencies: ["BDT"],
    flow: "manual",
    supportsManual: true,
    supportsApi: false,
    fields: [
      { key: "merchant_number", label: "Merchant Tap Number", type: "text", required: true },
    ],
    docsUrl: "https://tappmfs.com/",
  },
  {
    id: "mcash",
    label: "MCash (IBBL)",
    region: "BD",
    currencies: ["BDT"],
    flow: "manual",
    supportsManual: true,
    supportsApi: false,
    fields: [
      { key: "merchant_number", label: "Merchant MCash Number", type: "text", required: true },
    ],
    docsUrl: "https://www.islamibankbd.com/",
  },
  {
    id: "mycash",
    label: "MyCash (Mercantile)",
    region: "BD",
    currencies: ["BDT"],
    flow: "manual",
    supportsManual: true,
    supportsApi: false,
    fields: [
      { key: "merchant_number", label: "Merchant MyCash Number", type: "text", required: true },
    ],
    docsUrl: "https://www.mblbd.com/",
  },
  {
    id: "dmoney",
    label: "DMoney",
    region: "BD",
    currencies: ["BDT"],
    flow: "manual",
    supportsManual: true,
    supportsApi: false,
    fields: [
      { key: "merchant_number", label: "Merchant DMoney Number", type: "text", required: true },
    ],
    docsUrl: "https://dmoney.com.bd/",
  },
  {
    id: "surecash",
    label: "SureCash",
    region: "BD",
    currencies: ["BDT"],
    flow: "manual",
    supportsManual: true,
    supportsApi: false,
    fields: [
      { key: "merchant_number", label: "Merchant SureCash Number", type: "text", required: true },
    ],
    docsUrl: "https://www.surecash.net/",
  },
  {
    id: "portwallet",
    label: "PortWallet",
    region: "BD",
    currencies: ["BDT", "USD"],
    flow: "hosted_redirect",
    supportsManual: true,
    supportsApi: true,
    supportsWebhook: true,
    fields: [
      { key: "app_key", label: "App Key", type: "text", required: true },
      { key: "app_secret", label: "App Secret", type: "password", required: true },
    ],
    docsUrl: "https://portwallet.com/developer/",
  },
  {
    id: "walletmix",
    label: "WalletMix",
    region: "BD",
    currencies: ["BDT"],
    flow: "hosted_redirect",
    supportsManual: true,
    supportsApi: true,
    supportsWebhook: true,
    fields: [
      { key: "merchant_key", label: "Merchant Key", type: "text", required: true },
      { key: "api_key", label: "API Key", type: "password", required: true },
    ],
    docsUrl: "https://walletmix.com/",
  },
  {
    id: "bank_transfer",
    label: "Bank Transfer (BD)",
    region: "BD",
    currencies: ["BDT"],
    flow: "manual",
    supportsManual: true,
    supportsApi: false,
    fields: [
      { key: "bank_name", label: "Bank Name", type: "text", required: true },
      { key: "account_name", label: "Account Name", type: "text", required: true },
      { key: "account_number", label: "Account Number", type: "text", required: true },
      { key: "branch", label: "Branch", type: "text" },
      { key: "routing_number", label: "Routing Number", type: "text" },
    ],
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
  {
    id: "cryptomus",
    label: "Cryptomus",
    region: "CRYPTO",
    currencies: ["USD", "EUR", "USDT", "USDC", "BTC", "ETH", "BNB", "TRX", "TON"],
    flow: "hosted_redirect",
    supportsApi: true,
    supportsRefund: false,
    supportsWebhook: true,
    fields: [
      { key: "merchant_id", label: "Merchant UUID", type: "text", required: true, help: "From Cryptomus dashboard → Merchant" },
      { key: "payment_api_key", label: "Payment API Key", type: "password", required: true },
    ],
    docsUrl: "https://doc.cryptomus.com/business",
    webhookHint: "Set the webhook URL below in Cryptomus → Payment webhook.",
  },
];

export function getGateway(id: string): GatewaySpec | undefined {
  return GATEWAYS.find((g) => g.id === id);
}

export function gatewaysByRegion(region: GatewayRegion): GatewaySpec[] {
  return GATEWAYS.filter((g) => g.region === region);
}
