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
    setupSteps: [
      "Register at aamarpay.com and complete merchant KYC.",
      "In the AamarPay dashboard → Settings → API, copy your Store ID and Signature Key.",
      "Sandbox creds: store_id 'aamarpaytest' / signature_key 'dbb74894e82415a2f7ff0ec3a97e4183' — use these for testing.",
      "Set the IPN URL to the webhook URL below (Dashboard → Settings → IPN).",
    ],
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
    id: "eps",
    label: "EPS (Easy Payment System)",
    region: "BD",
    currencies: ["BDT"],
    flow: "hosted_redirect",
    supportsApi: true,
    supportsWebhook: true,
    fields: [
      { key: "base_url", label: "Base URL", type: "text", required: true, placeholder: "https://gw.epsbd.com" },
      { key: "merchant_id", label: "Merchant ID", type: "text", required: true },
      { key: "api_key", label: "API Key", type: "password", required: true },
      { key: "webhook_secret", label: "Webhook Secret", type: "password" },
    ],
    docsUrl: "https://epsbd.com/developer",
    webhookHint: "Paste the webhook URL below in EPS Merchant Panel → API → Callback URL.",
    setupSteps: [
      "Sign up at epsbd.com and complete merchant KYC.",
      "In EPS Merchant Panel → API, copy your Merchant ID and API Key.",
      "Paste the webhook URL below in EPS Merchant Panel → API → Callback URL.",
      "Test in sandbox mode first, then switch this configuration to Live.",
    ],
  },
  {
    id: "paystation",
    label: "PayStation",
    region: "BD",
    currencies: ["BDT", "USD"],
    flow: "hosted_redirect",
    supportsApi: true,
    supportsWebhook: true,
    fields: [
      { key: "merchant_id", label: "Merchant ID", type: "text", required: true },
      { key: "password", label: "Merchant Password", type: "password", required: true },
    ],
    docsUrl: "https://api.paystation.com.bd/",
    webhookHint: "Set the callback URL in PayStation Merchant Panel → Settings → Callback.",
    setupSteps: [
      "Register at paystation.com.bd and complete KYC.",
      "PayStation issues a Merchant ID and Password via email after approval.",
      "Paste both credentials below. Sandbox creds are available on request.",
      "Configure the callback URL to the webhook URL shown below.",
    ],
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
    setupSteps: [
      "Install UddoktaPay on your own domain (e.g. https://pay.your-domain.com) or use your existing licensed instance.",
      "Log in to the UddoktaPay admin panel → API Settings and copy your API Key.",
      "Enter the full Base URL (including https://) and the API Key below.",
      "In UddoktaPay admin → Webhook Settings, paste the webhook URL shown below and enable it.",
    ],
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
    setupSteps: [
      "Sign up at piprapay.com and complete merchant verification.",
      "Sandbox: use https://sandbox.piprapay.com and the sandbox API key from your dashboard.",
      "Live: use https://api.piprapay.com and your live API Key from Dashboard → Developers.",
      "Register the webhook URL below in Dashboard → Webhooks so PipraPay can confirm payments.",
    ],
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
    setupSteps: [
      "Deploy OwnPay on your own server or use a licensed hosted instance.",
      "In OwnPay admin → Settings → API, copy the API Key and (recommended) generate a Webhook Secret.",
      "Paste the Base URL (https://...), API Key, and Webhook Secret here.",
      "Register the webhook URL below in OwnPay → Webhooks. PayNOC verifies the X-Signature header on every event.",
    ],
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
    setupSteps: [
      "Create a Stripe account at stripe.com and complete the activation checklist.",
      "In the Dashboard → Developers → API keys, copy the Secret Key (sk_test_… or sk_live_…) and Publishable Key.",
      "Developers → Webhooks → Add endpoint: paste the webhook URL below and select the events you need (payment_intent.succeeded, charge.refunded, etc.).",
      "Copy the Signing Secret (whsec_…) from the created endpoint into 'Webhook Signing Secret'.",
      "Test in Test mode first (sk_test_ keys), then switch this configuration to Live.",
    ],
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

// ── Default logos ────────────────────────────────────────────────
// Map each supported gateway / manual-method type to a public brand
// domain, resolved through Google's S2 favicon service (no auth
// required, globally cached). Merchants can override with their own
// upload via `payment_methods.logo_url` or `byo_gateways.logo_url`.
const LOGO_DOMAINS: Record<string, string> = {
  bkash: "bkash.com",
  nagad: "nagad.com.bd",
  rocket: "dutchbanglabank.com",
  upay: "upaybd.com",
  tap: "tappayments.com",
  mcash: "islamibankbd.com",
  mycash: "mycash.com.bd",
  dmoney: "dmoney.com.bd",
  surecash: "surecash.net",
  sure_cash: "surecash.net",
  sslcommerz: "sslcommerz.com",
  shurjopay: "shurjopay.com.bd",
  aamarpay: "aamarpay.com",
  portwallet: "portwallet.com",
  walletmix: "walletmix.com",
  uddoktapay: "uddoktapay.com",
  piprapay: "piprapay.com",
  ownpay: "ownpay.com.bd",
  eps: "epsbd.com",
  paystation: "paystation.com.bd",
  bank_transfer: "wikipedia.org",
  bangla_qr: "bb.org.bd",
  stripe: "stripe.com",
  paypal: "paypal.com",
  razorpay: "razorpay.com",
  paddle: "paddle.com",
  twocheckout: "2checkout.com",
  coinbase_commerce: "commerce.coinbase.com",
  nowpayments: "nowpayments.io",
  binance_pay: "binance.com",
  cryptomus: "cryptomus.com",
  card: "visa.com",
  crypto: "bitcoin.org",
  other: "wikipedia.org",
};

/** Public logo URL for a gateway id or manual payment-method type. */
export function defaultLogoFor(id: string): string | undefined {
  const domain = LOGO_DOMAINS[id];
  if (!domain) return undefined;
  return `https://www.google.com/s2/favicons?domain=${domain}&sz=128`;
}

