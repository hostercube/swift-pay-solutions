/**
 * Shared SMS matching + logging pipeline used by both the APK ingest
 * endpoint (`/api/public/v1/sms-events`) and the background drain cron
 * (`/api/public/hooks/drain-pending`).
 *
 * Layers:
 *   L0_idempotent      — trx_id already verified/rejected for this merchant.
 *   L1_trxid           — exact (case-insensitive) provider_txn_id match on a pending txn.
 *   L2_sender_amount   — sender last-10 digits + amount ±1 unique match.
 *   L3_amount_mismatch — matched a txn but amount differs by more than 1 (rejected).
 *   L4_no_match        — no pending txn found.
 *   L5_error           — unexpected error while matching.
 */
import type { SupabaseClient } from "@supabase/supabase-js";

export type SmsEvent = {
  provider: string;
  raw_body: string;
  trx_id?: string;
  amount?: number;
  sender?: string;
  received_at?: string;
  device_id?: string;
};

export type MatchResult = {
  trx_id?: string;
  matched: boolean;
  invoice_id?: string;
  txn_id?: string;
  layer: string;
  outcome: "verified" | "skipped" | "rejected" | "no_match" | "error";
  reason?: string;
};

type Txn = {
  id: string; invoice_id: string; merchant_id: string; method_type: string;
  gross_amount: number; fee_amount: number; net_amount: number; status: string;
};

async function logEvent(
  admin: SupabaseClient,
  merchantId: string,
  ev: SmsEvent,
  r: MatchResult,
) {
  try {
    await admin.from("sms_event_logs").insert({
      merchant_id: merchantId,
      provider: ev.provider ?? null,
      trx_id: ev.trx_id ?? null,
      sender: ev.sender ?? null,
      amount: Number.isFinite(ev.amount as number) ? (ev.amount as number) : null,
      raw_body: ev.raw_body ?? null,
      device_id: ev.device_id ?? null,
      matched_layer: r.layer,
      outcome: r.outcome,
      reason: r.reason ?? null,
      matched_txn_id: r.txn_id ?? null,
      matched_invoice_id: r.invoice_id ?? null,
      received_at: ev.received_at ?? null,
    });
  } catch (e) {
    console.error("[sms-match] log failed", e);
  }
}

/**
 * Match a single SMS event against pending txns for one merchant.
 * On successful verification, updates txn+invoice and fires webhook/notify.
 * Always records an sms_event_logs row.
 */
export async function matchAndVerify(
  admin: SupabaseClient,
  merchantId: string,
  ev: SmsEvent,
  opts: { source: "apk_sms" | "drain_cron" | "manual" } = { source: "apk_sms" },
): Promise<MatchResult> {
  const provider = String(ev.provider ?? "").toLowerCase().trim();
  const trxId = String(ev.trx_id ?? "").trim();
  const amount = Number(ev.amount);

  const log = async (r: MatchResult) => { await logEvent(admin, merchantId, ev, r); console.log(`[sms-match] merchant=${merchantId} trx=${trxId} layer=${r.layer} outcome=${r.outcome} reason=${r.reason ?? ""}`); return r; };

  try {
    if (!provider) return await log({ trx_id: trxId, matched: false, layer: "L4_no_match", outcome: "no_match", reason: "missing provider" });

    // L0 — idempotency
    if (trxId) {
      const { data: dup } = await admin
        .from("transactions")
        .select("id, invoice_id, status")
        .eq("merchant_id", merchantId)
        .ilike("provider_txn_id", trxId)
        .in("status", ["verified", "rejected"])
        .maybeSingle();
      if (dup) {
        return await log({
          trx_id: trxId,
          matched: dup.status === "verified",
          invoice_id: dup.invoice_id,
          txn_id: dup.id,
          layer: "L0_idempotent",
          outcome: "skipped",
          reason: dup.status === "verified" ? "already verified" : "trx_id previously rejected",
        });
      }
    }

    // L1 — trxid exact
    let txn: Txn | null = null;
    let layer = "";
    if (trxId) {
      const { data } = await admin
        .from("transactions")
        .select("id, invoice_id, merchant_id, method_type, gross_amount, fee_amount, net_amount, status")
        .eq("merchant_id", merchantId)
        .ilike("provider_txn_id", trxId)
        .eq("status", "pending")
        .maybeSingle();
      if (data) { txn = data as Txn; layer = "L1_trxid"; }
    }

    // L2 — sender + amount fallback
    if (!txn && Number.isFinite(amount) && amount > 0) {
      const senderTail = String(ev.sender ?? "").replace(/\D/g, "").slice(-10);
      let q = admin
        .from("transactions")
        .select("id, invoice_id, merchant_id, method_type, gross_amount, fee_amount, net_amount, status")
        .eq("merchant_id", merchantId)
        .eq("status", "pending")
        .gte("gross_amount", amount - 1)
        .lte("gross_amount", amount + 1)
        .order("created_at", { ascending: false })
        .limit(5);
      if (senderTail.length >= 10) q = q.ilike("sender_number", `%${senderTail}`);
      const { data: candidates } = await q;
      if (candidates && candidates.length === 1) { txn = candidates[0] as Txn; layer = "L2_sender_amount"; }
    }

    if (!txn) return await log({ trx_id: trxId, matched: false, layer: "L4_no_match", outcome: "no_match", reason: "no matching pending txn" });

    // Amount sanity — L3
    if (Number.isFinite(amount) && amount > 0) {
      const diff = Math.abs(amount - Number(txn.gross_amount));
      if (diff > 1) {
        return await log({
          trx_id: trxId, matched: false, invoice_id: txn.invoice_id, txn_id: txn.id,
          layer: "L3_amount_mismatch", outcome: "rejected",
          reason: `amount mismatch (sms ${amount} vs invoice ${txn.gross_amount})`,
        });
      }
    }

    const nowIso = new Date().toISOString();
    const { data: updatedRows } = await admin.from("transactions").update({
      status: "verified",
      verified_at: nowIso,
      provider_txn_id: trxId || undefined,
      raw_response: { source: opts.source, provider, raw: ev.raw_body, device_id: ev.device_id ?? null, layer } as never,
      note: `SMS auto-verified via ${opts.source} (${provider}) [${layer}]`,
    }).eq("id", txn.id).eq("status", "pending").select("id");

    if (!updatedRows || updatedRows.length === 0) {
      return await log({
        trx_id: trxId, matched: true, invoice_id: txn.invoice_id, txn_id: txn.id,
        layer: "L0_idempotent", outcome: "skipped", reason: "already verified (race)",
      });
    }

    const { data: invoice } = await admin.from("invoices").update({
      status: "completed",
      paid_at: nowIso,
      fee_amount: txn.fee_amount,
      net_amount: txn.net_amount,
      method_type: txn.method_type as never,
    }).eq("id", txn.invoice_id).eq("status", "pending").select("*").maybeSingle();

    if (invoice) {
      const { dispatchWebhooks } = await import("@/lib/webhooks.server");
      const { notify } = await import("@/lib/notifications.server");
      dispatchWebhooks({
        merchantId,
        invoiceId: invoice.id,
        event: "invoice.completed",
        data: invoice,
        mode: ((invoice as { mode?: "live" | "test" }).mode ?? "live"),
      }).catch(() => undefined);
      notify({
        merchantId,
        event: "invoice.completed",
        title: `SMS auto-verified: ${(invoice as { invoice_number?: string }).invoice_number ?? ""}`,
        body: `${provider} · TrxID ${trxId} · ${amount || txn.gross_amount} [${layer}]`,
        metadata: { invoiceId: invoice.id, source: opts.source, layer },
      }).catch(() => undefined);
    }

    return await log({
      trx_id: trxId, matched: true, invoice_id: txn.invoice_id, txn_id: txn.id,
      layer, outcome: "verified", reason: `${opts.source}:${provider}`,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return await log({ trx_id: trxId, matched: false, layer: "L5_error", outcome: "error", reason: msg });
  }
}
