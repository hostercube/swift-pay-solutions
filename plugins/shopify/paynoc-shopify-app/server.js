/**
 * PayNOC ↔ Shopify bridge app.
 *
 * Flow:
 *   1. Merchant sets Shopify's "Manual payment method" (or a Bogus gateway alternative
 *      not usable in production). This bridge instead uses Shopify's `orders/create`
 *      webhook: when a new order is placed with the PayNOC payment source, we create
 *      a PayNOC invoice and email the customer the checkout URL (or return it via
 *      the storefront Thank-You page extension).
 *   2. When PayNOC fires `invoice.completed`, we call Shopify Admin API
 *      `orders/{id}/transactions.json` to record the sale, then close the order.
 *
 * Security:
 *   - Verifies Shopify's `X-Shopify-Hmac-SHA256` header on every webhook.
 *   - Verifies PayNOC's `x-paynoc-signature` (t=<ts>,v1=<hmac>) — timing-safe.
 *   - Rejects PayNOC events older than 5 minutes.
 *   - All secrets live in env vars — never in request/response bodies.
 *
 * Env vars:
 *   PORT                       (default 3000)
 *   PAYNOC_API_BASE            https://paynoc.com
 *   PAYNOC_API_KEY             merchant API key
 *   PAYNOC_WEBHOOK_SECRET      webhook endpoint signing secret
 *   SHOPIFY_STORE              yourshop.myshopify.com
 *   SHOPIFY_ADMIN_TOKEN        Admin API access token (custom app)
 *   SHOPIFY_WEBHOOK_SECRET     Shopify webhook signing secret
 *   PUBLIC_BASE_URL            https://your-bridge-host (for callbacks)
 */
import express from 'express';
import crypto from 'node:crypto';

const {
  PORT = 3000,
  PAYNOC_API_BASE,
  PAYNOC_API_KEY,
  PAYNOC_WEBHOOK_SECRET,
  SHOPIFY_STORE,
  SHOPIFY_ADMIN_TOKEN,
  SHOPIFY_WEBHOOK_SECRET,
  PUBLIC_BASE_URL,
} = process.env;

for (const [k, v] of Object.entries({
  PAYNOC_API_BASE, PAYNOC_API_KEY, PAYNOC_WEBHOOK_SECRET,
  SHOPIFY_STORE, SHOPIFY_ADMIN_TOKEN, SHOPIFY_WEBHOOK_SECRET, PUBLIC_BASE_URL,
})) {
  if (!v) { console.error(`[paynoc-shopify] Missing env var: ${k}`); process.exit(1); }
}
if (!PAYNOC_API_BASE.startsWith('https://')) {
  console.error('[paynoc-shopify] PAYNOC_API_BASE must be https://');
  process.exit(1);
}

const app = express();

/** Preserve raw body — HMAC verification needs the exact bytes. */
app.use(express.json({
  verify: (req, _res, buf) => { req.rawBody = buf; },
  limit: '1mb',
}));

function timingSafeEq(a, b) {
  const ab = Buffer.from(a); const bb = Buffer.from(b);
  return ab.length === bb.length && crypto.timingSafeEqual(ab, bb);
}

function verifyShopify(req) {
  const header = req.get('X-Shopify-Hmac-SHA256') || '';
  const expected = crypto.createHmac('sha256', SHOPIFY_WEBHOOK_SECRET)
    .update(req.rawBody).digest('base64');
  return timingSafeEq(header, expected);
}

function verifyPayNOC(req) {
  const header = req.get('x-paynoc-signature') || '';
  const parts = Object.fromEntries(header.split(',').map(s => s.trim().split('=')));
  const ts = Number(parts.t || 0);
  const sig = String(parts.v1 || '');
  if (!ts || Math.abs(Date.now() / 1000 - ts) > 300) return false;
  const expected = crypto.createHmac('sha256', PAYNOC_WEBHOOK_SECRET)
    .update(`${ts}.${req.rawBody.toString('utf8')}`).digest('hex');
  return timingSafeEq(expected, sig);
}

async function shopifyAdmin(path, init = {}) {
  const res = await fetch(`https://${SHOPIFY_STORE}/admin/api/2024-10${path}`, {
    ...init,
    headers: {
      'X-Shopify-Access-Token': SHOPIFY_ADMIN_TOKEN,
      'Content-Type': 'application/json',
      ...(init.headers || {}),
    },
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`Shopify ${path} ${res.status}: ${text}`);
  return text ? JSON.parse(text) : {};
}

/** Shopify webhook: orders/create → mint PayNOC invoice, tag order with checkout URL. */
app.post('/webhooks/shopify/orders-create', async (req, res) => {
  if (!verifyShopify(req)) return res.status(401).send('bad hmac');
  const order = req.body;

  // Only act on orders using PayNOC as gateway.
  const gateways = Array.isArray(order.payment_gateway_names) ? order.payment_gateway_names : [];
  const usesPayNOC = gateways.some(g => String(g).toLowerCase().includes('paynoc'));
  if (!usesPayNOC) return res.status(200).send('ignored');

  const invoicePayload = {
    amount:         Number(order.total_price),
    currency:       String(order.currency || 'USD').toUpperCase(),
    customer_name:  [order.customer?.first_name, order.customer?.last_name].filter(Boolean).join(' '),
    customer_email: order.email,
    customer_phone: order.phone || order.billing_address?.phone,
    description:    `Shopify Order ${order.name}`,
    reference:      `shopify:${order.id}`,
    redirect_url:   order.order_status_url,
    metadata:       { source: 'shopify', order_id: order.id, order_name: order.name },
  };

  try {
    const resp = await fetch(`${PAYNOC_API_BASE}/api/public/v1/invoices`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${PAYNOC_API_KEY}`,
        'Content-Type': 'application/json',
        'Idempotency-Key': `shopify-${order.id}-${order.total_price}`,
        'User-Agent': 'PayNOC-Shopify-Bridge/1.0',
      },
      body: JSON.stringify(invoicePayload),
    });
    const parsed = await resp.json();
    // API returns { data: { id, checkout_url, ... } }; accept flat shape too.
    const data = parsed?.data && typeof parsed.data === 'object' ? parsed.data : parsed;
    if (!resp.ok || !data?.checkout_url) throw new Error(`PayNOC ${resp.status}: ${JSON.stringify(parsed)}`);

    // Tag the order with the checkout URL so the merchant/customer can find it.
    await shopifyAdmin(`/orders/${order.id}.json`, {
      method: 'PUT',
      body: JSON.stringify({ order: {
        id: order.id,
        note: `PayNOC checkout: ${data.checkout_url}`,
        tags: [...(order.tags?.split(',').map(t => t.trim()).filter(Boolean) ?? []), 'paynoc-pending'].join(', '),
      }}),
    });
    return res.status(200).json({ ok: true, checkout_url: data.checkout_url });
  } catch (err) {
    console.error('[paynoc-shopify] orders-create failed:', err.message);
    return res.status(500).send('error');
  }
});

/** PayNOC webhook: invoice.completed → record Shopify transaction & mark paid. */
app.post('/webhooks/paynoc', async (req, res) => {
  if (!verifyPayNOC(req)) return res.status(401).send('bad signature');
  const { event, data } = req.body || {};
  if (event !== 'invoice.completed') return res.status(200).send('ignored');

  const ref = String(data?.reference || '');
  const orderId = ref.startsWith('shopify:') ? ref.slice(8) : data?.metadata?.order_id;
  if (!orderId) return res.status(200).send('no order ref');

  try {
    await shopifyAdmin(`/orders/${orderId}/transactions.json`, {
      method: 'POST',
      body: JSON.stringify({ transaction: {
        kind: 'capture',
        status: 'success',
        amount: String(data.amount),
        currency: String(data.currency).toUpperCase(),
        gateway: 'paynoc',
        authorization: String(data.id),
      }}),
    });
    return res.status(200).send('ok');
  } catch (err) {
    console.error('[paynoc-shopify] paynoc webhook failed:', err.message);
    return res.status(500).send('error');
  }
});

app.get('/health', (_req, res) => res.json({
  ok: true,
  callbacks: {
    shopify_orders_create: `${PUBLIC_BASE_URL}/webhooks/shopify/orders-create`,
    paynoc_webhook:        `${PUBLIC_BASE_URL}/webhooks/paynoc`,
  },
}));

app.listen(Number(PORT), () => {
  console.log(`[paynoc-shopify] listening on :${PORT}`);
  console.log(`  Shopify webhook URL: ${PUBLIC_BASE_URL}/webhooks/shopify/orders-create`);
  console.log(`  PayNOC  webhook URL: ${PUBLIC_BASE_URL}/webhooks/paynoc`);
});
