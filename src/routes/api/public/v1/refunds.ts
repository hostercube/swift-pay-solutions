import { createFileRoute } from "@tanstack/react-router";
import { createHash } from "crypto";
import { authenticateApiKey, jsonResponse, CORS_HEADERS } from "@/lib/api-auth.server";
import { dispatchWebhooks } from "@/lib/webhooks.server";
import { logApiRequest } from "@/lib/api-log.server";

async function handleGet(request: Request): Promise<Response> {
  const auth = await authenticateApiKey(request);
  if ("error" in auth) return jsonResponse({ error: auth.error }, auth.status);
  const started = Date.now();

  const url = new URL(request.url);
  const limit = Math.min(Number(url.searchParams.get("limit")) || 25, 100);
  const invoiceId = url.searchParams.get("invoice_id");

  const { supabaseAdmin } = await import("@/lib/supabase-admin.server");
  const q = (supabaseAdmin.from as unknown as (t: string) => {
    select: (s: string) => {
      eq: (c: string, v: string) => {
        eq?: (c: string, v: string) => unknown;
        order: (c: string, o: { ascending: boolean }) => {
          limit: (n: number) => Promise<{ data: unknown; error: { message: string } | null }>;
        };
      };
    };
  })("refunds")
    .select("id, invoice_id, amount, currency, reason, status, admin_note, processed_at, created_at")
    .eq("merchant_id", auth.merchantId);

  const scoped = invoiceId
    ? (q as unknown as { eq: (c: string, v: string) => typeof q }).eq("invoice_id", invoiceId)
    : q;

  const { data, error } = await scoped.order("created_at", { ascending: false }).limit(limit);
  const res = error
    ? jsonResponse({ error: error.message }, 500)
    : jsonResponse({ data });
  logApiRequest({
    merchantId: auth.merchantId, apiKeyId: auth.keyId, request,
    status: res.status, startedAt: started, errorMessage: error?.message ?? null,
  });
  return res;
}

async function handlePost(request: Request): Promise<Response> {
  const auth = await authenticateApiKey(request);
  if ("error" in auth) return jsonResponse({ error: auth.error }, auth.status);
  const started = Date.now();

  const finish = (res: Response, err?: string | null) => {
    logApiRequest({
      merchantId: auth.merchantId, apiKeyId: auth.keyId, request,
      status: res.status, startedAt: started, errorMessage: err ?? null,
    });
    return res;
  };

  const rawBody = await request.text();
  let body: Record<string, unknown>;
  try { body = rawBody ? JSON.parse(rawBody) : {}; }
  catch { return finish(jsonResponse({ error: "Invalid JSON body" }, 400), "Invalid JSON"); }

  const idemKey = request.headers.get("idempotency-key")?.trim() || null;
  const url = new URL(request.url);
  const requestHash = createHash("sha256").update(rawBody).digest("hex");
  const { supabaseAdmin } = await import("@/lib/supabase-admin.server");

  if (idemKey) {
    const { data: existing } = await supabaseAdmin
      .from("idempotency_keys")
      .select("request_hash, status_code, response_body")
      .eq("merchant_id", auth.merchantId)
      .eq("key", idemKey)
      .eq("method", "POST")
      .eq("path", url.pathname)
      .maybeSingle();
    if (existing) {
      if (existing.request_hash !== requestHash) {
        return finish(jsonResponse({ error: "Idempotency-Key reused with different payload" }, 409), "Idempotency mismatch");
      }
      return finish(jsonResponse(existing.response_body, existing.status_code, { "idempotent-replay": "true" }));
    }
  }

  const invoiceId = String(body.invoice_id ?? "").trim();
  if (!invoiceId) return finish(jsonResponse({ error: "invoice_id is required" }, 400), "Missing invoice_id");

  // Load invoice — MUST belong to this merchant, be completed, not already refunded
  const { data: inv, error: iErr } = await supabaseAdmin
    .from("invoices")
    .select("id, merchant_id, amount, currency, status")
    .eq("id", invoiceId)
    .eq("merchant_id", auth.merchantId)
    .maybeSingle();
  if (iErr) return finish(jsonResponse({ error: iErr.message }, 500), iErr.message);
  if (!inv) return finish(jsonResponse({ error: "Invoice not found" }, 404), "Not found");
  if (inv.status !== "completed") {
    return finish(jsonResponse({ error: "Only completed invoices can be refunded" }, 400), "Invoice not completed");
  }

  const requestedAmount = body.amount == null ? Number(inv.amount) : Number(body.amount);
  if (!requestedAmount || requestedAmount <= 0 || requestedAmount > Number(inv.amount)) {
    return finish(jsonResponse({ error: "Invalid refund amount" }, 400), "Invalid amount");
  }

  // Prevent over-refunding: sum previously requested/approved/processed refunds
  const existingRefunds = await (supabaseAdmin.from as unknown as (t: string) => {
    select: (s: string) => {
      eq: (c: string, v: string) => Promise<{ data: Array<{ amount: number; status: string }> | null }>;
    };
  })("refunds")
    .select("amount, status")
    .eq("invoice_id", invoiceId);
  const alreadyRefunded = (existingRefunds.data ?? [])
    .filter((r) => r.status !== "rejected")
    .reduce((s, r) => s + Number(r.amount), 0);
  if (alreadyRefunded + requestedAmount > Number(inv.amount)) {
    return finish(
      jsonResponse({ error: `Refund amount exceeds remaining balance (${Number(inv.amount) - alreadyRefunded})` }, 400),
      "Exceeds remaining",
    );
  }

  const { data: refund, error } = await (supabaseAdmin.from as unknown as (t: string) => {
    insert: (row: Record<string, unknown>) => {
      select: (s: string) => {
        single: () => Promise<{ data: Record<string, unknown> | null; error: { message: string } | null }>;
      };
    };
  })("refunds")
    .insert({
      merchant_id: auth.merchantId,
      invoice_id: inv.id,
      amount: requestedAmount,
      currency: inv.currency,
      reason: (body.reason as string) ?? null,
      status: "requested",
      requested_via: "api",
      api_key_id: auth.keyId,
    })
    .select("*")
    .single();

  if (error || !refund) {
    return finish(jsonResponse({ error: error?.message ?? "Refund create failed" }, 500), error?.message ?? "Insert failed");
  }

  dispatchWebhooks({
    merchantId: auth.merchantId,
    invoiceId: inv.id,
    event: "refund.requested",
    data: refund,
  }).catch(() => undefined);

  const responseBody = { data: refund };
  if (idemKey) {
    await supabaseAdmin.from("idempotency_keys").insert({
      merchant_id: auth.merchantId,
      key: idemKey,
      method: "POST",
      path: url.pathname,
      request_hash: requestHash,
      status_code: 201,
      response_body: responseBody as never,
    });
  }
  return finish(jsonResponse(responseBody, 201));
}

export const Route = createFileRoute("/api/public/v1/refunds")({
  server: {
    handlers: {
      OPTIONS: async () => new Response(null, { status: 204, headers: CORS_HEADERS }),
      GET: async ({ request }) => handleGet(request),
      POST: async ({ request }) => handlePost(request),
    },
  },
});
