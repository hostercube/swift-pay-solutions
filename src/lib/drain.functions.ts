import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { assertMerchantRole } from "@/lib/rbac.server";

/**
 * Manually trigger the drain/re-verify pipeline for one merchant. Used by
 * the merchant transactions page ("Drain / Re-verify" button) and the
 * admin panel. Replays the merchant's recent unmatched SMS events and
 * drains stale pending transactions past invoice expiry.
 */
export const drainPendingForMerchant = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { merchantId: string }) => data)
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    // Merchants (operator+) can drain their own; super-admin can drain any
    const { data: isAdmin } = await supabase.rpc("has_role", { _user_id: userId, _role: "super_admin" });
    const merchantId = isAdmin ? data.merchantId : userId;
    if (!isAdmin) await assertMerchantRole(supabase, userId, merchantId, "operator");

    const { supabaseAdmin } = await import("@/lib/supabase-admin.server");
    const { matchAndVerify } = await import("@/lib/sms-match.server");

    // Replay last 48h of unmatched SMS for this merchant
    const since = new Date(Date.now() - 48 * 3600_000).toISOString();
    const { data: retryable } = await supabaseAdmin
      .from("sms_event_logs")
      .select("id, merchant_id, provider, trx_id, sender, amount, raw_body, device_id, received_at")
      .eq("merchant_id", merchantId)
      .in("outcome", ["no_match", "error"])
      .gte("created_at", since)
      .order("created_at", { ascending: true })
      .limit(500);

    let replayed = 0, verified = 0;
    for (const row of retryable ?? []) {
      replayed++;
      const r = await matchAndVerify(supabaseAdmin, row.merchant_id, {
        provider: row.provider ?? "",
        raw_body: row.raw_body ?? "",
        trx_id: row.trx_id ?? undefined,
        amount: row.amount ?? undefined,
        sender: row.sender ?? undefined,
        received_at: row.received_at ?? undefined,
        device_id: row.device_id ?? undefined,
      }, { source: "manual" });
      if (r.outcome === "verified") verified++;
    }

    // Drain stale pending txns for THIS merchant only
    const cutoff = new Date(Date.now() - 24 * 3600_000).toISOString();
    const { data: stale } = await supabaseAdmin
      .from("transactions")
      .select("id, invoices!inner(status, expires_at)")
      .eq("merchant_id", merchantId)
      .eq("status", "pending")
      .lt("created_at", cutoff)
      .limit(200);

    const nowIso = new Date().toISOString();
    let drained = 0;
    for (const t of stale ?? []) {
      const inv = (t as unknown as { invoices?: { status?: string; expires_at?: string | null } }).invoices;
      const invExpired = inv?.status && inv.status !== "pending"
        ? true
        : (inv?.expires_at ? inv.expires_at <= nowIso : true);
      if (!invExpired) continue;
      const { data: upd } = await supabaseAdmin
        .from("transactions")
        .update({ status: "rejected", drained_at: nowIso, note: "auto-drained via manual trigger" })
        .eq("id", t.id).eq("status", "pending").select("id");
      if (upd && upd.length > 0) drained++;
    }

    return { ok: true, replayed, verified, drained };
  });

/**
 * Re-verify a single pending transaction — looks up any matching recent
 * SMS event log for the txn's provider_txn_id / sender+amount and pushes
 * it through the pipeline.
 */
export const reverifyTransaction = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { transactionId: string }) => data)
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: txn, error } = await supabase
      .from("transactions")
      .select("id, merchant_id, provider_txn_id, sender_number, gross_amount, status")
      .eq("id", data.transactionId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!txn) throw new Error("Transaction not found");
    if (txn.status !== "pending") throw new Error("Transaction is not pending");
    await assertMerchantRole(supabase, userId, txn.merchant_id, "operator");

    const { supabaseAdmin } = await import("@/lib/supabase-admin.server");
    const { matchAndVerify } = await import("@/lib/sms-match.server");

    // Look for recent SMS logs on this merchant that could plausibly match
    let query = supabaseAdmin
      .from("sms_event_logs")
      .select("provider, trx_id, sender, amount, raw_body, device_id, received_at")
      .eq("merchant_id", txn.merchant_id)
      .in("outcome", ["no_match", "error"])
      .order("created_at", { ascending: false })
      .limit(20);
    if (txn.provider_txn_id) query = query.ilike("trx_id", txn.provider_txn_id);
    const { data: candidates } = await query;

    if (!candidates || candidates.length === 0) {
      return { ok: false, matched: false, reason: "no candidate SMS event found in logs" };
    }
    for (const row of candidates) {
      const r = await matchAndVerify(supabaseAdmin, txn.merchant_id, {
        provider: row.provider ?? "",
        raw_body: row.raw_body ?? "",
        trx_id: row.trx_id ?? undefined,
        amount: row.amount ?? undefined,
        sender: row.sender ?? undefined,
        received_at: row.received_at ?? undefined,
        device_id: row.device_id ?? undefined,
      }, { source: "manual" });
      if (r.outcome === "verified") return { ok: true, matched: true, layer: r.layer };
    }
    return { ok: false, matched: false, reason: "no matching SMS resolved to verified" };
  });

/**
 * Fetch recent sms_event_logs for a merchant (merchant view). Super-admin
 * can pass any merchantId; regular users are constrained by RLS.
 */
export const listSmsEventLogs = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { merchantId?: string; limit?: number; outcome?: string }) => data)
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    let q = supabase
      .from("sms_event_logs")
      .select("id, merchant_id, provider, trx_id, sender, amount, matched_layer, outcome, reason, matched_invoice_id, matched_txn_id, created_at")
      .order("created_at", { ascending: false })
      .limit(Math.min(data.limit ?? 200, 500));
    if (data.merchantId) q = q.eq("merchant_id", data.merchantId);
    if (data.outcome) q = q.eq("outcome", data.outcome);
    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);
    return { rows: rows ?? [] };
  });
