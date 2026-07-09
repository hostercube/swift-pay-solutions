import { createFileRoute } from "@tanstack/react-router";
import { authenticateApiKey, jsonResponse, CORS_HEADERS } from "@/lib/api-auth.server";
import { logApiRequest } from "@/lib/api-log.server";
import { dispatchWebhooks } from "@/lib/webhooks.server";
import { notify } from "@/lib/notifications.server";

/**
 * SMS ingest endpoint for the PayNOC Merchant APK.
 *
 * The APK listens for incoming SMS on the merchant's phone (bKash/Nagad/
 * Rocket/Bank), parses out the amount, sender number and transaction id,
 * and POSTs the parsed event here. We match against pending transactions
 * for that merchant and auto-verify on exact provider_txn_id + amount match.
 *
 * Offline: the APK queues events in a local Room DB and retries whenever
 * network is available — this endpoint is idempotent per (merchant, trxid).
 *
 * Body:
 *   {
 *     events: [{
 *       provider: "bkash" | "nagad" | "rocket" | "bank" | "other",
 *       raw_body: string,              // full SMS text
 *       trx_id?: string,               // parsed trxId
 *       amount?: number,               // parsed amount
 *       sender?: string,               // parsed sender number
 *       received_at?: string,          // ISO
 *       device_id?: string,            // APK install UUID
 *     }]
 *   }
 */
type SmsEvent = {
  provider: string;
  raw_body: string;
  trx_id?: string;
  amount?: number;
  sender?: string;
  received_at?: string;
  device_id?: string;
};

async function handlePost(request: Request): Promise<Response> {
  const auth = await authenticateApiKey(request);
  if ("error" in auth) return jsonResponse({ error: auth.error }, auth.status, auth.headers ?? {});
  const started = Date.now();

  let body: { events?: SmsEvent[] };
  try { body = await request.json(); } catch {
    return jsonResponse({ error: "Invalid JSON" }, 400);
  }
  const events = Array.isArray(body.events) ? body.events : [];
  if (events.length === 0) return jsonResponse({ error: "events[] required" }, 400);
  if (events.length > 50) return jsonResponse({ error: "Max 50 events per batch" }, 400);

  const { supabaseAdmin } = await import("@/lib/supabase-admin.server");
  const results: Array<{ trx_id?: string; matched: boolean; invoice_id?: string; reason?: string }> = [];

  for (const ev of events) {
    const provider = String(ev.provider ?? "").toLowerCase().trim();
    const trxId = String(ev.trx_id ?? "").trim();
    const amount = Number(ev.amount);

    if (!provider || !trxId) {
      results.push({ trx_id: trxId, matched: false, reason: "missing provider/trx_id" });
      continue;
    }

    // Look up pending transaction for this merchant with the exact trxId
    const { data: txn } = await supabaseAdmin
      .from("transactions")
      .select("id, invoice_id, merchant_id, method_type, gross_amount, fee_amount, net_amount, status")
      .eq("merchant_id", auth.merchantId)
      .eq("provider_txn_id", trxId)
      .eq("status", "pending")
      .maybeSingle();

    if (!txn) {
      results.push({ trx_id: trxId, matched: false, reason: "no pending txn with this trx_id" });
      continue;
    }

    // Amount sanity — allow 1 unit tolerance
    if (Number.isFinite(amount) && amount > 0) {
      const diff = Math.abs(amount - Number(txn.gross_amount));
      if (diff > 1) {
        results.push({ trx_id: trxId, matched: false, invoice_id: txn.invoice_id, reason: `amount mismatch (${amount} vs ${txn.gross_amount})` });
        continue;
      }
    }

    // Auto-verify
    const nowIso = new Date().toISOString();
    await supabaseAdmin.from("transactions").update({
      status: "verified",
      verified_at: nowIso,
      raw_response: { source: "apk_sms", provider, raw: ev.raw_body, device_id: ev.device_id ?? null } as never,
      note: `SMS auto-verified via APK (${provider})`,
    }).eq("id", txn.id);

    const { data: invoice } = await supabaseAdmin.from("invoices").update({
      status: "completed",
      paid_at: nowIso,
      fee_amount: txn.fee_amount,
      net_amount: txn.net_amount,
      method_type: txn.method_type,
    }).eq("id", txn.invoice_id).select("*").single();

    if (invoice) {
      dispatchWebhooks({
        merchantId: auth.merchantId,
        invoiceId: invoice.id,
        event: "invoice.completed",
        data: invoice,
        mode: ((invoice as { mode?: "live" | "test" }).mode ?? "live"),
      }).catch(() => undefined);
      notify({
        merchantId: auth.merchantId,
        event: "invoice.completed",
        title: `SMS auto-verified: ${(invoice as { invoice_number?: string }).invoice_number ?? ""}`,
        body: `${provider} · TrxID ${trxId} · ${amount || txn.gross_amount}`,
        metadata: { invoiceId: invoice.id, source: "apk_sms" },
      }).catch(() => undefined);
    }

    results.push({ trx_id: trxId, matched: true, invoice_id: txn.invoice_id });
  }

  const res = jsonResponse({ ok: true, results });
  logApiRequest({
    merchantId: auth.merchantId, apiKeyId: auth.keyId, request,
    status: res.status, startedAt: started,
  });
  return res;
}

export const Route = createFileRoute("/api/public/v1/sms-events")({
  server: {
    handlers: {
      OPTIONS: async () => new Response(null, { status: 204, headers: CORS_HEADERS }),
      POST: async ({ request }) => handlePost(request),
    },
  },
});
