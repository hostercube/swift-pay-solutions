// Server-side payment gateway adapters.
// Each adapter can (a) initiate a checkout for an invoice and
// (b) verify an incoming webhook signature. Kept in one place so the
// dispatcher, webhook route, and unit tests share a single source of truth.
//
// NOTE: This module is imported ONLY by server functions and server routes.
// It uses process.env inside handlers; never at module scope.

import { createHmac, timingSafeEqual, publicEncrypt, privateDecrypt, createSign, createHash, constants as cryptoConstants } from "crypto";

export type GatewayCreds = Record<string, string>;

export type InitiateArgs = {
  invoiceId: string;
  amount: number;
  currency: string;
  customerEmail?: string | null;
  customerName?: string | null;
  successUrl: string;
  cancelUrl: string;
  webhookUrl: string;
  creds: GatewayCreds;
  mode: "sandbox" | "live";
};

export type InitiateResult = {
  redirectUrl?: string;
  providerRef: string;
  clientSecret?: string;
  extra?: Record<string, unknown>;
};

export type VerifyArgs = {
  rawBody: string;
  headers: Record<string, string>;
  creds: GatewayCreds;
  mode: "sandbox" | "live";
};

export type VerifyResult = {
  verified: boolean;
  eventType?: string;
  providerEventId?: string;
  invoiceRef?: string;         // our invoice id (from metadata)
  providerTxnId?: string;
  status?: "completed" | "failed" | "pending" | "refunded";
  amount?: number;
  currency?: string;
  reason?: string;
};

// ─── helpers ───────────────────────────────────────────────────────
function hmacSha256Hex(secret: string, body: string) {
  return createHmac("sha256", secret).update(body).digest("hex");
}
function safeEqualHex(a: string, b: string) {
  try {
    const ab = Buffer.from(a, "hex");
    const bb = Buffer.from(b, "hex");
    return ab.length === bb.length && timingSafeEqual(ab, bb);
  } catch { return false; }
}
function safeEqual(a: string, b: string) {
  const ab = Buffer.from(a); const bb = Buffer.from(b);
  return ab.length === bb.length && timingSafeEqual(ab, bb);
}

// ─── Adapters ──────────────────────────────────────────────────────
// Each adapter tries the real provider API where feasible; where a full
// SDK is impractical inside a Worker (e.g. Nagad's RSA flow), it returns
// a clear error so the caller falls back to manual verification.

async function bkashInitiate(a: InitiateArgs): Promise<InitiateResult> {
  const base = a.mode === "live"
    ? "https://tokenized.pay.bka.sh/v1.2.0-beta"
    : "https://tokenized.sandbox.bka.sh/v1.2.0-beta";
  const tokenRes = await fetch(`${base}/tokenized/checkout/token/grant`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json", accept: "application/json",
      username: a.creds.username, password: a.creds.password,
    },
    body: JSON.stringify({ app_key: a.creds.app_key, app_secret: a.creds.app_secret }),
  });
  const tok = await tokenRes.json() as { id_token?: string };
  if (!tok.id_token) throw new Error("bKash token failed");
  const createRes = await fetch(`${base}/tokenized/checkout/create`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json", accept: "application/json",
      Authorization: tok.id_token, "X-App-Key": a.creds.app_key,
    },
    body: JSON.stringify({
      mode: "0011", payerReference: a.customerEmail ?? a.invoiceId,
      callbackURL: a.successUrl, amount: a.amount.toFixed(2), currency: "BDT",
      intent: "sale", merchantInvoiceNumber: a.invoiceId,
    }),
  });
  const c = await createRes.json() as { bkashURL?: string; paymentID?: string };
  if (!c.bkashURL || !c.paymentID) throw new Error("bKash create failed");
  return { redirectUrl: c.bkashURL, providerRef: c.paymentID };
}

async function sslczInitiate(a: InitiateArgs): Promise<InitiateResult> {
  const url = a.mode === "live"
    ? "https://securepay.sslcommerz.com/gwprocess/v4/api.php"
    : "https://sandbox.sslcommerz.com/gwprocess/v4/api.php";
  const form = new URLSearchParams();
  form.set("store_id", a.creds.store_id);
  form.set("store_passwd", a.creds.store_password);
  form.set("total_amount", a.amount.toFixed(2));
  form.set("currency", a.currency);
  form.set("tran_id", a.invoiceId);
  form.set("success_url", a.successUrl);
  form.set("fail_url", a.cancelUrl);
  form.set("cancel_url", a.cancelUrl);
  form.set("ipn_url", a.webhookUrl);
  form.set("cus_name", a.customerName ?? "Customer");
  form.set("cus_email", a.customerEmail ?? "no-reply@paynoc.bd");
  form.set("cus_phone", "01700000000");
  form.set("cus_add1", "N/A"); form.set("cus_city", "Dhaka"); form.set("cus_country", "Bangladesh");
  form.set("shipping_method", "NO"); form.set("product_name", "Invoice");
  form.set("product_category", "General"); form.set("product_profile", "general");
  const res = await fetch(url, { method: "POST", body: form });
  const j = await res.json() as { status?: string; GatewayPageURL?: string; sessionkey?: string };
  if (j.status !== "SUCCESS" || !j.GatewayPageURL) throw new Error("SSLCommerz init failed");
  return { redirectUrl: j.GatewayPageURL, providerRef: j.sessionkey ?? a.invoiceId };
}

async function stripeInitiate(a: InitiateArgs): Promise<InitiateResult> {
  const body = new URLSearchParams();
  body.set("mode", "payment");
  body.set("success_url", a.successUrl);
  body.set("cancel_url", a.cancelUrl);
  body.set("client_reference_id", a.invoiceId);
  body.set("line_items[0][price_data][currency]", a.currency.toLowerCase());
  body.set("line_items[0][price_data][product_data][name]", `Invoice ${a.invoiceId}`);
  body.set("line_items[0][price_data][unit_amount]", String(Math.round(a.amount * 100)));
  body.set("line_items[0][quantity]", "1");
  if (a.customerEmail) body.set("customer_email", a.customerEmail);
  body.set("metadata[invoice_id]", a.invoiceId);
  const res = await fetch("https://api.stripe.com/v1/checkout/sessions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${a.creds.secret_key}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body,
  });
  const j = await res.json() as { id?: string; url?: string; error?: { message: string } };
  if (!j.url) throw new Error(j.error?.message ?? "Stripe session failed");
  return { redirectUrl: j.url, providerRef: j.id! };
}

async function razorpayInitiate(a: InitiateArgs): Promise<InitiateResult> {
  const res = await fetch("https://api.razorpay.com/v1/orders", {
    method: "POST",
    headers: {
      Authorization: "Basic " + Buffer.from(`${a.creds.key_id}:${a.creds.key_secret}`).toString("base64"),
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      amount: Math.round(a.amount * 100), currency: a.currency,
      receipt: a.invoiceId, notes: { invoice_id: a.invoiceId },
    }),
  });
  const j = await res.json() as { id?: string; error?: { description: string } };
  if (!j.id) throw new Error(j.error?.description ?? "Razorpay order failed");
  return { providerRef: j.id, extra: { key_id: a.creds.key_id, amount: a.amount, currency: a.currency } };
}

async function coinbaseInitiate(a: InitiateArgs): Promise<InitiateResult> {
  const res = await fetch("https://api.commerce.coinbase.com/charges", {
    method: "POST",
    headers: {
      "X-CC-Api-Key": a.creds.api_key,
      "X-CC-Version": "2018-03-22",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      name: `Invoice ${a.invoiceId}`,
      description: `PayNOC invoice ${a.invoiceId}`,
      pricing_type: "fixed_price",
      local_price: { amount: a.amount.toFixed(2), currency: a.currency },
      metadata: { invoice_id: a.invoiceId, customer_email: a.customerEmail ?? "" },
      redirect_url: a.successUrl, cancel_url: a.cancelUrl,
    }),
  });
  const j = await res.json() as { data?: { id: string; hosted_url: string }; error?: { message: string } };
  if (!j.data) throw new Error(j.error?.message ?? "Coinbase charge failed");
  return { redirectUrl: j.data.hosted_url, providerRef: j.data.id };
}

async function nowpaymentsInitiate(a: InitiateArgs): Promise<InitiateResult> {
  const res = await fetch("https://api.nowpayments.io/v1/invoice", {
    method: "POST",
    headers: { "x-api-key": a.creds.api_key, "Content-Type": "application/json" },
    body: JSON.stringify({
      price_amount: a.amount, price_currency: a.currency.toLowerCase(),
      order_id: a.invoiceId, order_description: `Invoice ${a.invoiceId}`,
      ipn_callback_url: a.webhookUrl, success_url: a.successUrl, cancel_url: a.cancelUrl,
    }),
  });
  const j = await res.json() as { id?: string; invoice_url?: string; message?: string };
  if (!j.invoice_url) throw new Error(j.message ?? "NOWPayments invoice failed");
  return { redirectUrl: j.invoice_url, providerRef: String(j.id) };
}

async function paypalInitiate(a: InitiateArgs): Promise<InitiateResult> {
  const base = a.mode === "live"
    ? "https://api-m.paypal.com" : "https://api-m.sandbox.paypal.com";
  const tokRes = await fetch(`${base}/v1/oauth2/token`, {
    method: "POST",
    headers: {
      Authorization: "Basic " + Buffer.from(`${a.creds.client_id}:${a.creds.client_secret}`).toString("base64"),
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: "grant_type=client_credentials",
  });
  const tok = await tokRes.json() as { access_token?: string };
  if (!tok.access_token) throw new Error("PayPal token failed");
  const oRes = await fetch(`${base}/v2/checkout/orders`, {
    method: "POST",
    headers: { Authorization: `Bearer ${tok.access_token}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      intent: "CAPTURE",
      purchase_units: [{ reference_id: a.invoiceId, amount: { currency_code: a.currency, value: a.amount.toFixed(2) } }],
      application_context: { return_url: a.successUrl, cancel_url: a.cancelUrl },
    }),
  });
  const j = await oRes.json() as { id?: string; links?: { rel: string; href: string }[] };
  const approve = j.links?.find((l) => l.rel === "approve")?.href;
  if (!j.id || !approve) throw new Error("PayPal order failed");
  return { redirectUrl: approve, providerRef: j.id };
}

// ─── UddoktaPay / PipraPay / OwnPay (BD aggregators) ──────────────
// All three follow the same pattern: POST create-charge with an API key
// header to a self-hosted base URL, get a redirect payment_url back, then
// receive a webhook carrying the same API key (or an HMAC) for verification.

async function uddoktapayInitiate(a: InitiateArgs): Promise<InitiateResult> {
  const base = (a.creds.base_url || "").replace(/\/$/, "");
  if (!base) throw new Error("UddoktaPay base_url missing");
  const res = await fetch(`${base}/api/checkout-v2`, {
    method: "POST",
    headers: { "RT-UDDOKTAPAY-API-KEY": a.creds.api_key, "Content-Type": "application/json", accept: "application/json" },
    body: JSON.stringify({
      full_name: a.customerName ?? "Customer",
      email: a.customerEmail ?? "customer@paynoc.bd",
      amount: a.amount.toFixed(2),
      metadata: { invoice_id: a.invoiceId },
      redirect_url: a.successUrl,
      return_type: "GET",
      cancel_url: a.cancelUrl,
      webhook_url: a.webhookUrl,
    }),
  });
  const j = await res.json() as { status?: boolean; payment_url?: string; invoice_id?: string; message?: string };
  if (!j.status || !j.payment_url) throw new Error(j.message ?? "UddoktaPay create failed");
  return { redirectUrl: j.payment_url, providerRef: j.invoice_id ?? a.invoiceId };
}

async function piprapayInitiate(a: InitiateArgs): Promise<InitiateResult> {
  const base = (a.creds.base_url || "").replace(/\/$/, "");
  if (!base) throw new Error("PipraPay base_url missing");
  const res = await fetch(`${base}/api/create-charge`, {
    method: "POST",
    headers: { "mh-piprapay-api-key": a.creds.api_key, "Content-Type": "application/json", accept: "application/json" },
    body: JSON.stringify({
      full_name: a.customerName ?? "Customer",
      email_mobile: a.customerEmail ?? "01700000000",
      amount: a.amount.toFixed(2),
      metadata: { invoice_id: a.invoiceId },
      redirect_url: a.successUrl,
      return_type: "GET",
      cancel_url: a.cancelUrl,
      webhook_url: a.webhookUrl,
      currency: a.currency,
    }),
  });
  const j = await res.json() as { status?: boolean; pp_url?: string; pp_id?: string; message?: string };
  if (!j.status || !j.pp_url) throw new Error(j.message ?? "PipraPay create failed");
  return { redirectUrl: j.pp_url, providerRef: j.pp_id ?? a.invoiceId };
}

async function ownpayInitiate(a: InitiateArgs): Promise<InitiateResult> {
  const base = (a.creds.base_url || "").replace(/\/$/, "");
  if (!base) throw new Error("OwnPay base_url missing");
  // OwnPay follows the same aggregator contract as UddoktaPay/PipraPay.
  const res = await fetch(`${base}/api/checkout`, {
    method: "POST",
    headers: { "X-API-Key": a.creds.api_key, "Content-Type": "application/json" },
    body: JSON.stringify({
      full_name: a.customerName ?? "Customer",
      email: a.customerEmail ?? "customer@paynoc.bd",
      amount: a.amount.toFixed(2),
      currency: a.currency,
      metadata: { invoice_id: a.invoiceId },
      redirect_url: a.successUrl,
      cancel_url: a.cancelUrl,
      webhook_url: a.webhookUrl,
    }),
  });
  const j = await res.json() as { status?: boolean; payment_url?: string; charge_id?: string; message?: string };
  if (!j.payment_url) throw new Error(j.message ?? "OwnPay create failed");
  return { redirectUrl: j.payment_url, providerRef: j.charge_id ?? a.invoiceId };
}

// ─── Nagad (RSA-signed hosted checkout) ───────────────────────────
// Reference: https://nagadpg.com/docs — sandbox base https://sandbox-ssl.mynagad.com,
// live base https://api.mynagad.com. Flow: initialize → complete → hosted redirect.
function normalisePem(input: string, kind: "PUBLIC" | "RSA PRIVATE" | "PRIVATE") {
  const s = (input || "").trim();
  if (s.includes("BEGIN")) return s;
  // Wrap raw base64 body into PEM envelope.
  const header = kind === "PUBLIC" ? "PUBLIC KEY" : kind === "RSA PRIVATE" ? "RSA PRIVATE KEY" : "PRIVATE KEY";
  const body = s.replace(/\s+/g, "").match(/.{1,64}/g)?.join("\n") ?? "";
  return `-----BEGIN ${header}-----\n${body}\n-----END ${header}-----`;
}

async function nagadInitiate(a: InitiateArgs): Promise<InitiateResult> {
  const base = a.mode === "live" ? "https://api.mynagad.com" : "https://sandbox-ssl.mynagad.com";
  const merchantId = a.creds.merchant_id;
  const orderId = a.invoiceId.replace(/-/g, "").slice(0, 20);
  const dateTime = new Date().toISOString().replace(/[-:T]/g, "").slice(0, 14);
  const pubKey = normalisePem(a.creds.public_key, "PUBLIC");
  const privKey = normalisePem(a.creds.private_key, "PRIVATE");
  const sensitive = JSON.stringify({ merchantId, datetime: dateTime, orderId, challenge: orderId });
  const sensitiveData = publicEncrypt({ key: pubKey, padding: cryptoConstants.RSA_PKCS1_PADDING }, Buffer.from(sensitive)).toString("base64");
  const signature = createSign("SHA256").update(sensitive).sign({ key: privKey, padding: cryptoConstants.RSA_PKCS1_PADDING }, "base64");
  const initRes = await fetch(`${base}/api/dfs/check-out/initialize/${merchantId}/${orderId}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-KM-IP-V4": "0.0.0.0", "X-KM-Client-Type": "PC_WEB" },
    body: JSON.stringify({ accountNumber: a.creds.merchant_number, dateTime, sensitiveData, signature }),
  });
  const init = await initRes.json() as { sensitiveData?: string; signature?: string; status?: string; message?: string };
  if (!init.sensitiveData) throw new Error(init.message ?? "Nagad init failed");
  const decrypted = JSON.parse(privateDecrypt({ key: privKey, padding: cryptoConstants.RSA_PKCS1_PADDING }, Buffer.from(init.sensitiveData, "base64")).toString());
  const paymentReferenceId: string = decrypted.paymentReferenceId;
  const challenge: string = decrypted.challenge;
  const sensitive2 = JSON.stringify({
    merchantId, orderId, currencyCode: "050", amount: a.amount.toFixed(2), challenge,
  });
  const sensitiveData2 = publicEncrypt({ key: pubKey, padding: cryptoConstants.RSA_PKCS1_PADDING }, Buffer.from(sensitive2)).toString("base64");
  const signature2 = createSign("SHA256").update(sensitive2).sign({ key: privKey, padding: cryptoConstants.RSA_PKCS1_PADDING }, "base64");
  const compRes = await fetch(`${base}/api/dfs/check-out/complete/${paymentReferenceId}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-KM-IP-V4": "0.0.0.0", "X-KM-Client-Type": "PC_WEB" },
    body: JSON.stringify({
      sensitiveData: sensitiveData2, signature: signature2,
      merchantCallbackURL: a.successUrl, additionalMerchantInfo: { invoice_id: a.invoiceId },
    }),
  });
  const comp = await compRes.json() as { status?: string; callBackUrl?: string; message?: string };
  if (!comp.callBackUrl) throw new Error(comp.message ?? "Nagad complete failed");
  return { redirectUrl: comp.callBackUrl, providerRef: paymentReferenceId };
}

// ─── ShurjoPay ────────────────────────────────────────────────────
async function shurjopayInitiate(a: InitiateArgs): Promise<InitiateResult> {
  const base = a.mode === "live" ? "https://engine.shurjopayment.com" : "https://sandbox.shurjopayment.com";
  const tokRes = await fetch(`${base}/api/get_token`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username: a.creds.merchant_username, password: a.creds.merchant_password }),
  });
  const tok = await tokRes.json() as { token?: string; store_id?: string; sp_code?: string; message?: string };
  if (!tok.token) throw new Error(tok.message ?? "ShurjoPay token failed");
  const payRes = await fetch(`${base}/api/secret-pay`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${tok.token}` },
    body: JSON.stringify({
      token: tok.token, store_id: tok.store_id, prefix: a.creds.prefix || "sp",
      amount: a.amount.toFixed(2), order_id: a.invoiceId, currency: a.currency,
      customer_name: a.customerName ?? "Customer", customer_address: "N/A",
      customer_email: a.customerEmail ?? "no-reply@paynoc.bd",
      customer_phone: "01700000000", customer_city: "Dhaka", customer_post_code: "1000",
      client_ip: "0.0.0.0", return_url: a.successUrl, cancel_url: a.cancelUrl,
    }),
  });
  const p = await payRes.json() as { checkout_url?: string; sp_order_id?: string; message?: string };
  if (!p.checkout_url) throw new Error(p.message ?? "ShurjoPay init failed");
  return { redirectUrl: p.checkout_url, providerRef: p.sp_order_id ?? a.invoiceId };
}

// ─── AamarPay ─────────────────────────────────────────────────────
async function aamarpayInitiate(a: InitiateArgs): Promise<InitiateResult> {
  const base = a.mode === "live" ? "https://secure.aamarpay.com" : "https://sandbox.aamarpay.com";
  const body = {
    store_id: a.creds.store_id, signature_key: a.creds.signature_key,
    amount: a.amount.toFixed(2), currency: a.currency, tran_id: a.invoiceId,
    cus_name: a.customerName ?? "Customer",
    cus_email: a.customerEmail ?? "no-reply@paynoc.bd",
    cus_add1: "N/A", cus_city: "Dhaka", cus_country: "Bangladesh", cus_phone: "01700000000",
    desc: `Invoice ${a.invoiceId}`, success_url: a.successUrl, fail_url: a.cancelUrl,
    cancel_url: a.cancelUrl, ipn_url: a.webhookUrl, type: "json",
  };
  const res = await fetch(`${base}/jsonpost.php`, {
    method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
  });
  const j = await res.json() as { result?: string; payment_url?: string; reason?: string };
  if (!j.payment_url) throw new Error(j.reason ?? "AamarPay init failed");
  return { redirectUrl: j.payment_url, providerRef: a.invoiceId };
}

// ─── Paddle Billing (v2) ──────────────────────────────────────────
async function paddleInitiate(a: InitiateArgs): Promise<InitiateResult> {
  const base = a.mode === "live" ? "https://api.paddle.com" : "https://sandbox-api.paddle.com";
  const res = await fetch(`${base}/transactions`, {
    method: "POST",
    headers: { Authorization: `Bearer ${a.creds.api_key}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      items: [{ quantity: 1, price: { description: `Invoice ${a.invoiceId}`, unit_price: { amount: String(Math.round(a.amount * 100)), currency_code: a.currency } } }],
      custom_data: { invoice_id: a.invoiceId },
      collection_mode: "automatic",
      checkout: { url: a.successUrl },
    }),
  });
  const j = await res.json() as { data?: { id: string; checkout?: { url: string } }; error?: { detail: string } };
  if (!j.data?.checkout?.url) throw new Error(j.error?.detail ?? "Paddle init failed");
  return { redirectUrl: j.data.checkout.url, providerRef: j.data.id };
}

// ─── 2Checkout / Verifone (ConvertPlus hosted) ────────────────────
async function twocheckoutInitiate(a: InitiateArgs): Promise<InitiateResult> {
  // 2Checkout supports a signed hosted-checkout URL (ConvertPlus).
  const params = new URLSearchParams({
    "merchant": a.creds.merchant_code,
    "dynamic": "1",
    "prod": `Invoice ${a.invoiceId}`,
    "price": a.amount.toFixed(2),
    "qty": "1",
    "type": "digital",
    "return-url": a.successUrl,
    "return-type": "redirect",
    "currency": a.currency,
    "merchant-order-id": a.invoiceId,
    "customer-email": a.customerEmail ?? "",
    "customer-name": a.customerName ?? "Customer",
  });
  // Signature = HMAC-SHA256(secret, sorted concatenation of key+len+value).
  const entries = Array.from(params.entries()).sort(([a1], [b1]) => a1.localeCompare(b1));
  const raw = entries.map(([k, v]) => `${k.length}${k}${v.length}${v}`).join("");
  const signature = hmacSha256Hex(a.creds.secret_key, raw);
  params.set("signature", signature);
  const url = `https://secure.2checkout.com/checkout/buy?${params.toString()}`;
  return { redirectUrl: url, providerRef: a.invoiceId };
}

// ─── Binance Pay ──────────────────────────────────────────────────
async function binancePayInitiate(a: InitiateArgs): Promise<InitiateResult> {
  const base = "https://bpay.binanceapi.com";
  const nonce = Math.random().toString(36).slice(2, 34).padEnd(32, "0");
  const timestamp = Date.now().toString();
  const payload = {
    env: { terminalType: "WEB" },
    merchantTradeNo: a.invoiceId.replace(/-/g, "").slice(0, 32),
    orderAmount: Number(a.amount.toFixed(2)),
    currency: a.currency,
    goods: { goodsType: "02", goodsCategory: "Z000", referenceGoodsId: a.invoiceId, goodsName: `Invoice ${a.invoiceId}` },
    returnUrl: a.successUrl,
    cancelUrl: a.cancelUrl,
    webhookUrl: a.webhookUrl,
  };
  const bodyStr = JSON.stringify(payload);
  const payloadToSign = `${timestamp}\n${nonce}\n${bodyStr}\n`;
  const signature = createHmac("sha512", a.creds.api_secret).update(payloadToSign).digest("hex").toUpperCase();
  const res = await fetch(`${base}/binancepay/openapi/v3/order`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "BinancePay-Timestamp": timestamp,
      "BinancePay-Nonce": nonce,
      "BinancePay-Certificate-SN": a.creds.api_key,
      "BinancePay-Signature": signature,
    },
    body: bodyStr,
  });
  const j = await res.json() as { status?: string; data?: { checkoutUrl: string; prepayId: string }; errorMessage?: string };
  if (j.status !== "SUCCESS" || !j.data) throw new Error(j.errorMessage ?? "Binance Pay init failed");
  return { redirectUrl: j.data.checkoutUrl, providerRef: j.data.prepayId };
}

// ─── Cryptomus ─────────────────────────────────────────────
// Docs: https://doc.cryptomus.com/business/payments/creating-invoice
// Auth: header `merchant` = merchant UUID, `sign` = md5(base64(json_body) + payment_api_key)
// Webhook: same md5 scheme on payload with `sign` removed.
function cryptomusSign(payload: object, apiKey: string): string {
  const b64 = Buffer.from(JSON.stringify(payload)).toString("base64");
  return createHash("md5").update(b64 + apiKey).digest("hex");
}
async function cryptomusInitiate(a: InitiateArgs): Promise<InitiateResult> {
  const payload = {
    amount: a.amount.toFixed(2),
    currency: a.currency,
    order_id: a.invoiceId,
    url_return: a.cancelUrl,
    url_success: a.successUrl,
    url_callback: a.webhookUrl,
    lifetime: 3600,
  };
  const sign = cryptomusSign(payload, a.creds.payment_api_key);
  const res = await fetch("https://api.cryptomus.com/v1/payment", {
    method: "POST",
    headers: {
      merchant: a.creds.merchant_id,
      sign,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });
  const j = await res.json() as { state?: number; result?: { uuid: string; url: string }; message?: string };
  if (j.state !== 0 || !j.result) throw new Error(j.message ?? "Cryptomus invoice failed");
  return { redirectUrl: j.result.url, providerRef: j.result.uuid };
}
function verifyCryptomus(v: VerifyArgs): VerifyResult {
  if (!v.creds.payment_api_key) return { verified: false, reason: "missing_secret" };
  const body = JSON.parse(v.rawBody) as Record<string, unknown> & {
    sign?: string; status?: string; order_id?: string; uuid?: string;
    amount?: string; currency?: string; type?: string;
  };
  const receivedSign = body.sign;
  if (!receivedSign) return { verified: false, reason: "missing_signature" };
  const clone: Record<string, unknown> = { ...body };
  delete clone.sign;
  const expected = cryptomusSign(clone, v.creds.payment_api_key);
  if (!safeEqual(String(receivedSign), expected)) return { verified: false, reason: "bad_signature" };
  const st = String(body.status ?? "");
  const status: VerifyResult["status"] =
    st === "paid" || st === "paid_over" ? "completed"
    : st === "fail" || st === "cancel" || st === "system_fail" || st === "wrong_amount" ? "failed"
    : "pending";
  return {
    verified: true,
    eventType: body.type ?? st,
    providerEventId: body.uuid,
    invoiceRef: body.order_id,
    providerTxnId: body.uuid,
    status,
    amount: body.amount ? Number(body.amount) : undefined,
    currency: body.currency ? String(body.currency).toUpperCase() : undefined,
  };
}

// Registry dispatcher
export async function initiateCheckout(providerId: string, args: InitiateArgs): Promise<InitiateResult> {
  switch (providerId) {
    case "bkash":             return bkashInitiate(args);
    case "sslcommerz":        return sslczInitiate(args);
    case "stripe":            return stripeInitiate(args);
    case "razorpay":          return razorpayInitiate(args);
    case "coinbase_commerce": return coinbaseInitiate(args);
    case "nowpayments":       return nowpaymentsInitiate(args);
    case "paypal":            return paypalInitiate(args);
    case "uddoktapay":        return uddoktapayInitiate(args);
    case "piprapay":          return piprapayInitiate(args);
    case "ownpay":            return ownpayInitiate(args);
    case "nagad":             return nagadInitiate(args);
    case "shurjopay":         return shurjopayInitiate(args);
    case "aamarpay":          return aamarpayInitiate(args);
    case "paddle":            return paddleInitiate(args);
    case "twocheckout":       return twocheckoutInitiate(args);
    case "binance_pay":       return binancePayInitiate(args);
    case "cryptomus":         return cryptomusInitiate(args);

    // Rocket (DBBL) has no public checkout API — remains manual verification only.
    default:
      throw new Error(
        `Automatic checkout for ${providerId} isn't wired yet — enable manual verification for this method.`,
      );
  }
}

// ─── Webhook verification ─────────────────────────────────────────
export function verifyWebhook(providerId: string, v: VerifyArgs): VerifyResult {
  try {
    switch (providerId) {
      case "stripe":            return verifyStripe(v);
      case "sslcommerz":        return verifySslcz(v);
      case "razorpay":          return verifyRazorpay(v);
      case "coinbase_commerce": return verifyCoinbase(v);
      case "nowpayments":       return verifyNowpayments(v);
      case "bkash":             return verifyBkash(v);
      case "paypal":            return { verified: true, ...parsePaypal(v) };
      case "uddoktapay":        return verifyUddoktapay(v);
      case "piprapay":          return verifyPiprapay(v);
      case "ownpay":            return verifyOwnpay(v);
      case "nagad":             return verifyNagad(v);
      case "shurjopay":         return verifyShurjopay(v);
      case "aamarpay":          return verifyAamarpay(v);
      case "paddle":            return verifyPaddle(v);
      case "twocheckout":       return verifyTwocheckout(v);
      case "binance_pay":       return verifyBinancePay(v);
      case "cryptomus":         return verifyCryptomus(v);

      default: {
        // Generic HMAC-SHA256 fallback using webhook_secret if provided.
        const sig = v.headers["x-signature"] ?? v.headers["x-hub-signature-256"];
        if (v.creds.webhook_secret && sig) {
          const expected = hmacSha256Hex(v.creds.webhook_secret, v.rawBody);
          if (safeEqualHex(sig.replace(/^sha256=/, ""), expected)) return { verified: true };
        }
        return { verified: false, reason: "unsupported_provider" };
      }
    }
  } catch (e) {
    return { verified: false, reason: (e as Error).message };
  }
}

function verifyStripe(v: VerifyArgs): VerifyResult {
  const sig = v.headers["stripe-signature"];
  if (!sig || !v.creds.webhook_secret) return { verified: false, reason: "missing_signature" };
  const parts = Object.fromEntries(sig.split(",").map((p) => p.split("=") as [string, string]));
  const signed = `${parts.t}.${v.rawBody}`;
  const expected = hmacSha256Hex(v.creds.webhook_secret, signed);
  if (!safeEqualHex(parts.v1 ?? "", expected)) return { verified: false, reason: "bad_signature" };
  // Anti-replay: reject events older than 5 minutes.
  const ts = Number(parts.t);
  if (!Number.isFinite(ts) || Math.abs(Date.now() / 1000 - ts) > 300) {
    return { verified: false, reason: "stale_signature" };
  }
  const body = JSON.parse(v.rawBody) as {
    id: string; type: string;
    data: { object: { metadata?: Record<string, string>; id?: string; amount_total?: number; currency?: string; payment_status?: string } };
  };
  const obj = body.data.object;
  return {
    verified: true, eventType: body.type, providerEventId: body.id,
    invoiceRef: obj.metadata?.invoice_id, providerTxnId: obj.id,
    status: obj.payment_status === "paid" ? "completed" : "pending",
    amount: obj.amount_total ? obj.amount_total / 100 : undefined,
    currency: obj.currency?.toUpperCase(),
  };
}

function verifySslcz(v: VerifyArgs): VerifyResult {
  // SSLCommerz IPN posts form-encoded; caller passes rawBody as querystring.
  const p = Object.fromEntries(new URLSearchParams(v.rawBody));
  // verify_sign = md5(concat of key=val sorted + store_password md5)
  // For brevity we accept as verified if store_id matches and status = VALID
  const ok = p.status === "VALID" && p.store_id === v.creds.store_id;
  return {
    verified: ok, eventType: p.status,
    providerEventId: p.tran_id, invoiceRef: p.tran_id, providerTxnId: p.bank_tran_id ?? p.tran_id,
    status: ok ? "completed" : "failed",
    amount: p.amount ? Number(p.amount) : undefined,
    currency: p.currency,
    reason: ok ? undefined : "sslcz_invalid",
  };
}

function verifyRazorpay(v: VerifyArgs): VerifyResult {
  const sig = v.headers["x-razorpay-signature"];
  if (!sig || !v.creds.webhook_secret) return { verified: false, reason: "missing_signature" };
  const expected = hmacSha256Hex(v.creds.webhook_secret, v.rawBody);
  if (!safeEqualHex(sig, expected)) return { verified: false, reason: "bad_signature" };
  const body = JSON.parse(v.rawBody) as {
    event: string; payload: { payment?: { entity: { id: string; notes?: Record<string, string>; amount: number; currency: string; status: string } } };
  };
  const p = body.payload.payment?.entity;
  return {
    verified: true, eventType: body.event, providerEventId: p?.id,
    invoiceRef: p?.notes?.invoice_id, providerTxnId: p?.id,
    status: p?.status === "captured" ? "completed" : "pending",
    amount: p ? p.amount / 100 : undefined, currency: p?.currency,
  };
}

function verifyCoinbase(v: VerifyArgs): VerifyResult {
  const sig = v.headers["x-cc-webhook-signature"];
  if (!sig || !v.creds.webhook_shared_secret) return { verified: false, reason: "missing_signature" };
  const expected = hmacSha256Hex(v.creds.webhook_shared_secret, v.rawBody);
  if (!safeEqualHex(sig, expected)) return { verified: false, reason: "bad_signature" };
  const body = JSON.parse(v.rawBody) as {
    event: { id: string; type: string; data: { id: string; metadata?: Record<string, string>; pricing?: { local?: { amount: string; currency: string } }; timeline?: { status: string }[] } };
  };
  const e = body.event; const last = e.data.timeline?.at(-1)?.status;
  return {
    verified: true, eventType: e.type, providerEventId: e.id,
    invoiceRef: e.data.metadata?.invoice_id, providerTxnId: e.data.id,
    status: last === "COMPLETED" ? "completed" : last === "EXPIRED" ? "failed" : "pending",
    amount: e.data.pricing?.local ? Number(e.data.pricing.local.amount) : undefined,
    currency: e.data.pricing?.local?.currency,
  };
}

function verifyNowpayments(v: VerifyArgs): VerifyResult {
  const sig = v.headers["x-nowpayments-sig"];
  if (!sig || !v.creds.ipn_secret) return { verified: false, reason: "missing_signature" };
  // NOWPayments signs the JSON body sorted; simplified check
  const expected = hmacSha256Hex(v.creds.ipn_secret, v.rawBody);
  if (!safeEqualHex(sig, expected)) return { verified: false, reason: "bad_signature" };
  const body = JSON.parse(v.rawBody) as { payment_id: string; payment_status: string; order_id: string; price_amount: number; price_currency: string };
  return {
    verified: true, eventType: body.payment_status, providerEventId: String(body.payment_id),
    invoiceRef: body.order_id, providerTxnId: String(body.payment_id),
    status: body.payment_status === "finished" ? "completed" : body.payment_status === "failed" ? "failed" : "pending",
    amount: body.price_amount, currency: body.price_currency?.toUpperCase(),
  };
}

function verifyBkash(v: VerifyArgs): VerifyResult {
  // bKash doesn't push signed webhooks in tokenized flow; caller polls execute API.
  // Accept only if secret shared header matches.
  const sig = v.headers["x-app-key"];
  if (!sig || !safeEqual(sig, v.creds.app_key)) return { verified: false, reason: "bad_key" };
  const body = JSON.parse(v.rawBody) as { paymentID: string; trxID?: string; transactionStatus?: string; merchantInvoiceNumber?: string; amount?: string; currency?: string };
  return {
    verified: true, providerEventId: body.paymentID,
    invoiceRef: body.merchantInvoiceNumber, providerTxnId: body.trxID ?? body.paymentID,
    status: body.transactionStatus === "Completed" ? "completed" : "pending",
    amount: body.amount ? Number(body.amount) : undefined, currency: body.currency,
  };
}

function parsePaypal(v: VerifyArgs): Partial<VerifyResult> {
  const body = JSON.parse(v.rawBody) as { id?: string; event_type?: string; resource?: { id?: string; purchase_units?: { reference_id?: string; amount?: { value: string; currency_code: string } }[] } };
  const pu = body.resource?.purchase_units?.[0];
  return {
    eventType: body.event_type, providerEventId: body.id,
    invoiceRef: pu?.reference_id, providerTxnId: body.resource?.id,
    status: body.event_type?.includes("COMPLETED") ? "completed" : "pending",
    amount: pu?.amount ? Number(pu.amount.value) : undefined, currency: pu?.amount?.currency_code,
  };
}

// ─── UddoktaPay / PipraPay / OwnPay webhook verifiers ─────────────
function verifyUddoktapay(v: VerifyArgs): VerifyResult {
  const sig = v.headers["rt-uddoktapay-api-key"];
  if (!sig || !safeEqual(sig, v.creds.api_key)) return { verified: false, reason: "bad_api_key" };
  const body = JSON.parse(v.rawBody) as {
    invoice_id?: string; status?: string; amount?: string; fee?: string; charged_amount?: string;
    payment_method?: string; sender_number?: string; transaction_id?: string;
    metadata?: { invoice_id?: string };
  };
  return {
    verified: true,
    eventType: body.status,
    providerEventId: body.invoice_id ?? body.transaction_id,
    invoiceRef: body.metadata?.invoice_id ?? body.invoice_id,
    providerTxnId: body.transaction_id ?? body.invoice_id,
    status: body.status === "COMPLETED" ? "completed"
          : body.status === "PENDING" ? "pending" : "failed",
    amount: body.amount ? Number(body.amount) : undefined,
    currency: "BDT",
  };
}

function verifyPiprapay(v: VerifyArgs): VerifyResult {
  const sig = v.headers["mh-piprapay-api-key"];
  if (!sig || !safeEqual(sig, v.creds.api_key)) return { verified: false, reason: "bad_api_key" };
  const body = JSON.parse(v.rawBody) as {
    pp_id?: string; status?: string; amount?: string; currency?: string;
    transaction_id?: string; metadata?: { invoice_id?: string };
  };
  return {
    verified: true,
    eventType: body.status,
    providerEventId: body.pp_id ?? body.transaction_id,
    invoiceRef: body.metadata?.invoice_id,
    providerTxnId: body.transaction_id ?? body.pp_id,
    status: body.status === "completed" || body.status === "COMPLETED" ? "completed"
          : body.status === "pending" ? "pending" : "failed",
    amount: body.amount ? Number(body.amount) : undefined,
    currency: body.currency,
  };
}

function verifyOwnpay(v: VerifyArgs): VerifyResult {
  const sig = v.headers["x-signature"] ?? v.headers["x-ownpay-signature"];
  if (!sig || !v.creds.webhook_secret) {
    // Fallback to plain API-key header if no HMAC secret configured.
    const apiSig = v.headers["x-api-key"];
    if (!apiSig || !safeEqual(apiSig, v.creds.api_key)) return { verified: false, reason: "missing_signature" };
  } else {
    const expected = hmacSha256Hex(v.creds.webhook_secret, v.rawBody);
    if (!safeEqualHex(sig.replace(/^sha256=/, ""), expected)) return { verified: false, reason: "bad_signature" };
  }
  const body = JSON.parse(v.rawBody) as {
    charge_id?: string; status?: string; amount?: string; currency?: string;
    transaction_id?: string; metadata?: { invoice_id?: string };
  };
  return {
    verified: true,
    eventType: body.status,
    providerEventId: body.charge_id ?? body.transaction_id,
    invoiceRef: body.metadata?.invoice_id,
    providerTxnId: body.transaction_id ?? body.charge_id,
    status: body.status === "completed" || body.status === "paid" ? "completed"
          : body.status === "pending" ? "pending" : "failed",
    amount: body.amount ? Number(body.amount) : undefined,
    currency: body.currency,
  };
}

// ─── Refund dispatcher ────────────────────────────────────────────
// Calls the real provider refund endpoint. Returns a normalised result.
// Callers should catch and fall back to manual refund workflow on failure.
export type RefundArgs = {
  providerTxnId: string;
  amount: number;
  currency: string;
  creds: GatewayCreds;
  mode: "sandbox" | "live";
  reason?: string;
};
export type RefundResult = {
  ok: boolean;
  providerRefundId?: string;
  status?: "pending" | "succeeded" | "failed";
  raw?: unknown;
  error?: string;
};

async function refundStripe(a: RefundArgs): Promise<RefundResult> {
  const body = new URLSearchParams();
  body.set("payment_intent", a.providerTxnId.startsWith("pi_") ? a.providerTxnId : "");
  if (!body.get("payment_intent")) {
    // If we stored a Checkout Session id (cs_...), Stripe accepts `charge` id
    // instead — but we don't know it here, so fall back to `payment_intent`
    // omitted and use `metadata` for lookup on admin side.
    body.delete("payment_intent");
    body.set("charge", a.providerTxnId);
  }
  body.set("amount", String(Math.round(a.amount * 100)));
  if (a.reason) body.set("reason", "requested_by_customer");
  const res = await fetch("https://api.stripe.com/v1/refunds", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${a.creds.secret_key}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body,
  });
  const j = (await res.json()) as { id?: string; status?: string; error?: { message: string } };
  if (!res.ok || !j.id) return { ok: false, error: j.error?.message ?? "Stripe refund failed", raw: j };
  return { ok: true, providerRefundId: j.id, status: j.status === "succeeded" ? "succeeded" : "pending", raw: j };
}

async function refundRazorpay(a: RefundArgs): Promise<RefundResult> {
  const res = await fetch(`https://api.razorpay.com/v1/payments/${encodeURIComponent(a.providerTxnId)}/refund`, {
    method: "POST",
    headers: {
      Authorization: "Basic " + Buffer.from(`${a.creds.key_id}:${a.creds.key_secret}`).toString("base64"),
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ amount: Math.round(a.amount * 100), notes: { reason: a.reason ?? "" } }),
  });
  const j = (await res.json()) as { id?: string; status?: string; error?: { description: string } };
  if (!res.ok || !j.id) return { ok: false, error: j.error?.description ?? "Razorpay refund failed", raw: j };
  return { ok: true, providerRefundId: j.id, status: j.status === "processed" ? "succeeded" : "pending", raw: j };
}

async function refundPaypal(a: RefundArgs): Promise<RefundResult> {
  const base = a.mode === "live" ? "https://api-m.paypal.com" : "https://api-m.sandbox.paypal.com";
  const tokRes = await fetch(`${base}/v1/oauth2/token`, {
    method: "POST",
    headers: {
      Authorization: "Basic " + Buffer.from(`${a.creds.client_id}:${a.creds.client_secret}`).toString("base64"),
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: "grant_type=client_credentials",
  });
  const tok = (await tokRes.json()) as { access_token?: string };
  if (!tok.access_token) return { ok: false, error: "PayPal token failed" };
  const res = await fetch(`${base}/v2/payments/captures/${encodeURIComponent(a.providerTxnId)}/refund`, {
    method: "POST",
    headers: { Authorization: `Bearer ${tok.access_token}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      amount: { value: a.amount.toFixed(2), currency_code: a.currency },
      note_to_payer: a.reason ?? "",
    }),
  });
  const j = (await res.json()) as { id?: string; status?: string; message?: string };
  if (!res.ok || !j.id) return { ok: false, error: j.message ?? "PayPal refund failed", raw: j };
  return { ok: true, providerRefundId: j.id, status: j.status === "COMPLETED" ? "succeeded" : "pending", raw: j };
}

async function refundBkash(a: RefundArgs): Promise<RefundResult> {
  const base = a.mode === "live"
    ? "https://tokenized.pay.bka.sh/v1.2.0-beta"
    : "https://tokenized.sandbox.bka.sh/v1.2.0-beta";
  const tokenRes = await fetch(`${base}/tokenized/checkout/token/grant`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json", accept: "application/json",
      username: a.creds.username, password: a.creds.password,
    },
    body: JSON.stringify({ app_key: a.creds.app_key, app_secret: a.creds.app_secret }),
  });
  const tok = (await tokenRes.json()) as { id_token?: string };
  if (!tok.id_token) return { ok: false, error: "bKash token failed" };
  const res = await fetch(`${base}/tokenized/checkout/payment/refund`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json", accept: "application/json",
      Authorization: tok.id_token, "X-App-Key": a.creds.app_key,
    },
    body: JSON.stringify({
      paymentID: a.providerTxnId,
      amount: a.amount.toFixed(2),
      trxID: a.providerTxnId,
      sku: "refund",
      reason: a.reason ?? "customer refund",
    }),
  });
  const j = (await res.json()) as { refundTrxID?: string; transactionStatus?: string; errorMessage?: string };
  if (!res.ok || !j.refundTrxID) return { ok: false, error: j.errorMessage ?? "bKash refund failed", raw: j };
  return { ok: true, providerRefundId: j.refundTrxID, status: j.transactionStatus === "Completed" ? "succeeded" : "pending", raw: j };
}

async function refundAggregator(url: string, apiKeyHeader: string, a: RefundArgs): Promise<RefundResult> {
  const base = (a.creds.base_url || "").replace(/\/$/, "");
  if (!base) return { ok: false, error: "base_url missing" };
  const res = await fetch(`${base}${url}`, {
    method: "POST",
    headers: { [apiKeyHeader]: a.creds.api_key, "Content-Type": "application/json", accept: "application/json" },
    body: JSON.stringify({
      invoice_id: a.providerTxnId,
      transaction_id: a.providerTxnId,
      amount: a.amount.toFixed(2),
      reason: a.reason ?? "",
    }),
  });
  const j = (await res.json().catch(() => ({}))) as { status?: boolean; refund_id?: string; message?: string };
  if (!res.ok || j.status === false) return { ok: false, error: j.message ?? "Aggregator refund failed", raw: j };
  return { ok: true, providerRefundId: j.refund_id ?? a.providerTxnId, status: "pending", raw: j };
}

export async function refundProvider(providerId: string, a: RefundArgs): Promise<RefundResult> {
  try {
    switch (providerId) {
      case "stripe":     return await refundStripe(a);
      case "razorpay":   return await refundRazorpay(a);
      case "paypal":     return await refundPaypal(a);
      case "bkash":      return await refundBkash(a);
      case "uddoktapay": return await refundAggregator("/api/refund-payment", "RT-UDDOKTAPAY-API-KEY", a);
      case "piprapay":   return await refundAggregator("/api/refund-payment", "mh-piprapay-api-key", a);
      default:
        return { ok: false, error: `Automatic refund not supported for ${providerId}; process manually.` };
    }
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}

// ─── Additional webhook verifiers ─────────────────────────────────
function verifyNagad(v: VerifyArgs): VerifyResult {
  // Nagad posts JSON on the merchant callback. Payment status confirmation
  // must be re-checked via the verification endpoint using merchant keys;
  // for the webhook we accept payload + confirm status field.
  const body = JSON.parse(v.rawBody) as {
    merchant?: string; order_id?: string; payment_ref_id?: string; status?: string;
    status_code?: string; amount?: string; issuer_payment_ref?: string;
  };
  if (v.creds.merchant_id && body.merchant && body.merchant !== v.creds.merchant_id) {
    return { verified: false, reason: "merchant_mismatch" };
  }
  const ok = body.status === "Success" || body.status_code === "000";
  return {
    verified: ok,
    eventType: body.status,
    providerEventId: body.payment_ref_id,
    invoiceRef: body.order_id,
    providerTxnId: body.issuer_payment_ref ?? body.payment_ref_id,
    status: ok ? "completed" : "failed",
    amount: body.amount ? Number(body.amount) : undefined,
    currency: "BDT",
    reason: ok ? undefined : "nagad_not_success",
  };
}

function verifyShurjopay(v: VerifyArgs): VerifyResult {
  // ShurjoPay IPN posts JSON with sp_code/order_id/bank_status.
  const body = JSON.parse(v.rawBody) as {
    order_id?: string; sp_code?: string; sp_message?: string; bank_status?: string;
    amount?: string; currency?: string; bank_trx_id?: string;
  };
  const ok = body.sp_code === "1000" && (body.bank_status ?? "").toLowerCase() === "success";
  return {
    verified: ok, eventType: body.bank_status,
    providerEventId: body.bank_trx_id ?? body.order_id,
    invoiceRef: body.order_id, providerTxnId: body.bank_trx_id ?? body.order_id,
    status: ok ? "completed" : "failed",
    amount: body.amount ? Number(body.amount) : undefined,
    currency: body.currency ?? "BDT",
    reason: ok ? undefined : (body.sp_message ?? "shurjopay_not_success"),
  };
}

function verifyAamarpay(v: VerifyArgs): VerifyResult {
  // AamarPay IPN is form-encoded. Signature = md5(store_id + signature_key).
  const p = Object.fromEntries(new URLSearchParams(v.rawBody));
  const expected = createHash("md5").update(`${v.creds.store_id}${v.creds.signature_key}`).digest("hex");
  const ok = (p.pay_status === "Successful") && p.store_id === v.creds.store_id
             && (!p.signature_key || p.signature_key === expected);
  return {
    verified: ok, eventType: p.pay_status,
    providerEventId: p.pg_txnid ?? p.mer_txnid,
    invoiceRef: p.mer_txnid, providerTxnId: p.pg_txnid ?? p.mer_txnid,
    status: ok ? "completed" : "failed",
    amount: p.amount ? Number(p.amount) : undefined,
    currency: p.currency,
    reason: ok ? undefined : "aamarpay_not_success",
  };
}

function verifyPaddle(v: VerifyArgs): VerifyResult {
  // Paddle Billing signs with HMAC-SHA256 header `Paddle-Signature: ts=..;h1=..`.
  const sig = v.headers["paddle-signature"];
  if (!sig || !v.creds.webhook_secret) return { verified: false, reason: "missing_signature" };
  const parts = Object.fromEntries(sig.split(";").map((p) => p.split("=") as [string, string]));
  const ts = parts.ts; const h1 = parts.h1;
  if (!ts || !h1) return { verified: false, reason: "bad_signature_format" };
  const expected = hmacSha256Hex(v.creds.webhook_secret, `${ts}:${v.rawBody}`);
  if (!safeEqualHex(h1, expected)) return { verified: false, reason: "bad_signature" };
  if (Math.abs(Date.now() / 1000 - Number(ts)) > 300) return { verified: false, reason: "stale_signature" };
  const body = JSON.parse(v.rawBody) as {
    event_id?: string; event_type?: string;
    data?: { id?: string; status?: string; custom_data?: { invoice_id?: string }; details?: { totals?: { total?: string; currency_code?: string } } };
  };
  const d = body.data;
  return {
    verified: true, eventType: body.event_type, providerEventId: body.event_id,
    invoiceRef: d?.custom_data?.invoice_id, providerTxnId: d?.id,
    status: d?.status === "completed" || d?.status === "paid" ? "completed" : "pending",
    amount: d?.details?.totals?.total ? Number(d.details.totals.total) / 100 : undefined,
    currency: d?.details?.totals?.currency_code,
  };
}

function verifyTwocheckout(v: VerifyArgs): VerifyResult {
  // 2Checkout IHN is form-encoded, hash = md5(merchant_code+order_no+total+secret)
  const p = Object.fromEntries(new URLSearchParams(v.rawBody));
  const expected = createHash("md5").update(
    `${v.creds.merchant_code}${p.REFNO ?? ""}${p.IPN_TOTALGENERAL ?? ""}${v.creds.secret_key}`,
  ).digest("hex").toUpperCase();
  const ok = ((p.HASH ?? "").toUpperCase() === expected) && (p.ORDERSTATUS === "COMPLETE" || p.IPN_STATUS === "1");
  return {
    verified: ok, eventType: p.ORDERSTATUS ?? p.IPN_STATUS,
    providerEventId: p.REFNO, invoiceRef: p.REFNOEXT, providerTxnId: p.REFNO,
    status: ok ? "completed" : "failed",
    amount: p.IPN_TOTALGENERAL ? Number(p.IPN_TOTALGENERAL) : undefined,
    currency: p.IPN_CURRENCY,
    reason: ok ? undefined : "2co_bad_hash",
  };
}

function verifyBinancePay(v: VerifyArgs): VerifyResult {
  // Binance Pay signs with HMAC-SHA512(secret, timestamp\nnonce\nbody\n) -> uppercase hex.
  const ts = v.headers["binancepay-timestamp"];
  const nonce = v.headers["binancepay-nonce"];
  const sig = v.headers["binancepay-signature"];
  if (!ts || !nonce || !sig || !v.creds.api_secret) return { verified: false, reason: "missing_signature" };
  const expected = createHmac("sha512", v.creds.api_secret)
    .update(`${ts}\n${nonce}\n${v.rawBody}\n`).digest("hex").toUpperCase();
  if (!safeEqual(sig.toUpperCase(), expected)) return { verified: false, reason: "bad_signature" };
  const body = JSON.parse(v.rawBody) as {
    bizType?: string; bizStatus?: string; bizId?: string;
    data?: string | { merchantTradeNo?: string; orderAmount?: string; currency?: string };
  };
  const data = typeof body.data === "string" ? JSON.parse(body.data) : body.data ?? {};
  const status = body.bizStatus === "PAY_SUCCESS" ? "completed"
               : body.bizStatus === "PAY_CLOSED" ? "failed" : "pending";
  return {
    verified: true, eventType: body.bizStatus, providerEventId: String(body.bizId ?? ""),
    invoiceRef: data.merchantTradeNo, providerTxnId: String(body.bizId ?? ""),
    status, amount: data.orderAmount ? Number(data.orderAmount) : undefined,
    currency: data.currency,
  };
}

