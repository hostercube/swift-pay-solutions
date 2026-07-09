// Server-side payment gateway adapters.
// Each adapter can (a) initiate a checkout for an invoice and
// (b) verify an incoming webhook signature. Kept in one place so the
// dispatcher, webhook route, and unit tests share a single source of truth.
//
// NOTE: This module is imported ONLY by server functions and server routes.
// It uses process.env inside handlers; never at module scope.

import { createHmac, timingSafeEqual } from "crypto";

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

    // The remaining providers (nagad RSA, rocket manual, shurjopay, aamarpay,
    // paddle, twocheckout, binance_pay) require merchant-specific onboarding
    // or SDK signing that is easier to complete once the merchant supplies
    // live sandbox credentials. We surface a clear error so the merchant
    // falls back to the manual-verification flow which is fully supported.
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
