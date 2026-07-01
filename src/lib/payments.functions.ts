import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { dispatchWebhooks } from "@/lib/webhooks.server";

/**
 * Merchant verifies a pending transaction. Marks the txn verified,
 * marks the invoice completed with locked-in fees, and dispatches
 * the `invoice.completed` webhook to the merchant's endpoints.
 */
export const verifyTransaction = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { transactionId: string }) => data)
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    // Load transaction scoped by RLS to this merchant / super-admin
    const { data: txn, error: tErr } = await supabase
      .from("transactions")
      .select("id, invoice_id, merchant_id, method_type, gross_amount, fee_amount, net_amount, status")
      .eq("id", data.transactionId)
      .maybeSingle();
    if (tErr) throw new Error(tErr.message);
    if (!txn) throw new Error("Transaction not found");
    if (txn.status !== "pending") throw new Error("Transaction is not pending");

    const nowIso = new Date().toISOString();

    const { error: uTxn } = await supabase
      .from("transactions")
      .update({ status: "verified", verified_at: nowIso, verified_by: userId })
      .eq("id", txn.id);
    if (uTxn) throw new Error(uTxn.message);

    const { data: invoice, error: uInv } = await supabase
      .from("invoices")
      .update({
        status: "completed",
        paid_at: nowIso,
        fee_amount: txn.fee_amount,
        net_amount: txn.net_amount,
        method_type: txn.method_type,
      })
      .eq("id", txn.invoice_id)
      .select("*")
      .single();
    if (uInv || !invoice) throw new Error(uInv?.message ?? "Invoice update failed");

    // Dispatch webhook (privileged, tolerates failure)
    dispatchWebhooks({
      merchantId: txn.merchant_id,
      invoiceId: invoice.id,
      event: "invoice.completed",
      data: invoice,
    }).catch(() => undefined);

    return { ok: true };
  });

export const rejectTransaction = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { transactionId: string; note?: string }) => data)
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { error } = await supabase
      .from("transactions")
      .update({ status: "rejected", note: data.note || null })
      .eq("id", data.transactionId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
