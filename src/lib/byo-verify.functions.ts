import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { assertMerchantRole } from "@/lib/rbac.server";
import { dispatchWebhooks } from "@/lib/webhooks.server";
import { notify } from "@/lib/notifications.server";
import { verifyBkash, verifyNagad, verifyUddoktapay } from "@/lib/byo-verify.server";

type Creds = Record<string, string>;

export const byoVerifyTransaction = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { transactionId: string }) => d)
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    const { data: txn, error } = await supabase
      .from("transactions")
      .select("id, invoice_id, merchant_id, method_type, gross_amount, fee_amount, net_amount, status, provider_txn_id")
      .eq("id", data.transactionId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!txn) throw new Error("Transaction not found");
    if (txn.status !== "pending") throw new Error("Transaction not pending");
    if (!txn.provider_txn_id) throw new Error("Missing provider transaction id");
    await assertMerchantRole(supabase, userId, txn.merchant_id, "operator");

    const provider = String(txn.method_type).toLowerCase();
    if (!["bkash", "nagad", "uddoktapay"].includes(provider)) {
      throw new Error(`Auto-verify unsupported for method: ${provider}`);
    }

    // Determine mode from invoice
    const { data: inv } = await supabase
      .from("invoices").select("mode, amount, currency, invoice_number, customer_name")
      .eq("id", txn.invoice_id).maybeSingle();
    const mode = ((inv as { mode?: "live" | "test" } | null)?.mode ?? "live");

    const { data: gw } = await supabase
      .from("byo_gateways")
      .select("credentials")
      .eq("merchant_id", txn.merchant_id)
      .eq("provider", provider)
      .eq("mode", mode)
      .eq("is_active", true)
      .maybeSingle();
    if (!gw) throw new Error(`No active ${provider} (${mode}) gateway configured`);
    const creds = (gw.credentials ?? {}) as Creds;

    const result = provider === "bkash"
      ? await verifyBkash(mode, creds, txn.provider_txn_id)
      : provider === "nagad"
      ? await verifyNagad(mode, creds, txn.provider_txn_id)
      : await verifyUddoktapay(mode, creds, txn.provider_txn_id);

    // Amount sanity check (within 1 unit tolerance)
    if (result.ok && result.amount !== undefined && inv) {
      const diff = Math.abs(result.amount - Number((inv as { amount: number }).amount));
      if (diff > 1) throw new Error(`Amount mismatch: gateway ${result.amount} vs invoice ${(inv as { amount: number }).amount}`);
    }

    if (!result.ok) {
      await supabase.from("transactions")
        .update({ raw_response: result.raw as unknown as never, note: "BYO auto-verify: not completed" })
        .eq("id", txn.id);
      return { ok: false, raw: result.raw };
    }

    const nowIso = new Date().toISOString();
    await supabase.from("transactions").update({
      status: "verified", verified_at: nowIso, verified_by: userId,
      raw_response: result.raw as unknown as never,
      reference: result.providerRef ?? txn.provider_txn_id,
    }).eq("id", txn.id);

    const { data: invoice } = await supabase.from("invoices").update({
      status: "completed", paid_at: nowIso,
      fee_amount: txn.fee_amount, net_amount: txn.net_amount,
      method_type: txn.method_type,
    }).eq("id", txn.invoice_id).select("*").single();

    if (invoice) {
      dispatchWebhooks({
        merchantId: txn.merchant_id, invoiceId: invoice.id,
        event: "invoice.completed", data: invoice, mode,
      }).catch(() => undefined);
      notify({
        merchantId: txn.merchant_id, event: "invoice.completed",
        title: `Payment auto-verified: ${(invoice as { invoice_number?: string }).invoice_number ?? invoice.id}`,
        body: `${provider} ${result.providerRef ?? ""} matched.`,
        metadata: { invoiceId: invoice.id, provider },
      }).catch(() => undefined);
    }

    return { ok: true, providerRef: result.providerRef };
  });
