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

type BkashExecute = {
  paymentID?: string; trxID?: string; transactionStatus?: string;
  merchantInvoiceNumber?: string; amount?: string; currency?: string;
  statusCode?: string; statusMessage?: string; errorMessage?: string;
};

async function bkashExecute(
  creds: Record<string, string>, mode: "sandbox" | "live", paymentID: string,
): Promise<BkashExecute | null> {
  const base = mode === "live"
    ? "https://tokenized.pay.bka.sh/v1.2.0-beta"
    : "https://tokenized.sandbox.bka.sh/v1.2.0-beta";
  const tokRes = await fetch(`${base}/tokenized/checkout/token/grant`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json", accept: "application/json",
      username: creds.username, password: creds.password,
    },
    body: JSON.stringify({ app_key: creds.app_key, app_secret: creds.app_secret }),
  });
  const tok = (await tokRes.json()) as { id_token?: string };
  if (!tok.id_token) return null;
  const exec = await fetch(`${base}/tokenized/checkout/execute`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json", accept: "application/json",
      Authorization: tok.id_token, "X-App-Key": creds.app_key,
    },
    body: JSON.stringify({ paymentID }),
  });
  return (await exec.json().catch(() => null)) as BkashExecute | null;
}

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
      await supabaseAdmin.from("transactions")
        .update({ status: "rejected", note: "Customer cancelled at gateway" })
        .eq("invoice_id", inv.id).eq("status", "pending");
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
