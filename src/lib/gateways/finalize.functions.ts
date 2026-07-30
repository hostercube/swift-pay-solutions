// Handles the customer-return callback for hosted-checkout gateways.
// Some providers (bKash tokenized, Nagad) don't push signed webhooks —
// after the payer returns to our successUrl we MUST call their capture /
// verify endpoint to actually confirm the payment. Without this the
// invoice sits in "processing" forever.
//
// Called from src/routes/pay.$invoiceId.tsx once, when the return URL
// carries ?paid=1 (or ?cancelled=1).
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const schema = z.object({
  invoiceId: z.string().uuid(),
  cancelled: z.boolean().default(false),
  // Provider return params, forwarded verbatim (paymentID, status,
  // payment_ref_id, order_id, etc.). Kept generic so new gateways slot in.
  params: z.record(z.string(), z.string()).default({}),
});

export const finalizeGatewayReturn = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => schema.parse(d))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/lib/supabase-admin.server");
    const { data: inv } = await supabaseAdmin
      .from("invoices")
      .select("id, merchant_id, amount, currency, status")
      .eq("id", data.invoiceId).maybeSingle();
    if (!inv) return { ok: false, reason: "invoice_not_found" as const };

    // ─── Cancel path: revert optimistic "processing" back to "pending" ───
    if (data.cancelled) {
      if (inv.status === "processing") {
        await supabaseAdmin.from("invoices").update({ status: "pending" }).eq("id", inv.id);
      }
      // Only reject the attempt that was cancelled — a parallel pending attempt
      // (customer retried with another method) must stay alive.
      const cancelRef = data.params.paymentID ?? data.params.paymentId ?? data.params.providerRef;
      let cancelQuery = supabaseAdmin.from("transactions")
        .update({ status: "rejected", note: "Customer cancelled at gateway" })
        .eq("invoice_id", inv.id).eq("status", "pending");
      if (cancelRef) cancelQuery = cancelQuery.eq("provider_txn_id", cancelRef);
      await cancelQuery;
      return { ok: true, status: "cancelled" as const };
    }

    // Already finalized — nothing to do.
    if (inv.status === "completed" || inv.status === "refunded" || inv.status === "failed") {
      return { ok: true, status: inv.status as "completed" | "refunded" | "failed" };
    }

    // ─── bKash tokenized: call /execute to actually capture the payment ───
    const paymentID = data.params.paymentID ?? data.params.paymentId;
    const returnStatus = (data.params.status ?? "").toLowerCase();
    if (paymentID) {
      if (returnStatus === "cancel" || returnStatus === "failure") {
        await supabaseAdmin.from("invoices").update({ status: "pending" }).eq("id", inv.id);
        await supabaseAdmin.from("transactions")
          .update({ status: "rejected", note: `bKash returned ${returnStatus}` })
          .eq("invoice_id", inv.id).eq("provider_txn_id", paymentID);
        return { ok: true, status: "cancelled" as const };
      }
      const { data: gw } = await supabaseAdmin
        .from("byo_gateways")
        .select("credentials, mode")
        .eq("merchant_id", inv.merchant_id).eq("provider", "bkash")
        .maybeSingle();
      const creds = (gw?.credentials as Record<string, string> | null) ?? null;
      if (!creds) return { ok: false, reason: "bkash_creds_missing" as const };
      const { bkashExecute } = await import("@/lib/gateways/finalize.server");
      const exec = await bkashExecute(creds, ((gw?.mode as "sandbox" | "live") ?? "sandbox"), paymentID);
      if (!exec) return { ok: false, reason: "bkash_execute_failed" as const };
      const paid = exec.transactionStatus === "Completed" && exec.statusCode === "0000";
      if (!paid) {
        return { ok: false, reason: exec.errorMessage ?? exec.statusMessage ?? "bkash_not_completed" };
      }
      // Amount / currency sanity check.
      if (exec.amount && Math.abs(Number(exec.amount) - Number(inv.amount)) > 0.01) {
        return { ok: false, reason: "amount_mismatch" as const };
      }
      await supabaseAdmin.from("invoices").update({
        status: "completed", paid_at: new Date().toISOString(),
      }).eq("id", inv.id);
      await supabaseAdmin.from("transactions").update({
        status: "verified", verified_at: new Date().toISOString(),
        provider_txn_id: exec.trxID ?? paymentID,
        note: `bKash execute OK (trxID ${exec.trxID ?? "n/a"})`,
      }).eq("invoice_id", inv.id).eq("provider_txn_id", paymentID);
      return { ok: true, status: "completed" as const, providerTxnId: exec.trxID ?? paymentID };
    }

    // Other providers rely on webhooks — nothing to finalize on return.
    return { ok: true, status: "pending" as const };
  });
