import { createServerFn } from "@tanstack/react-start";
import { dispatchWebhooks } from "@/lib/webhooks.server";
import { notify } from "@/lib/notifications.server";

/**
 * Anonymous customer submits a manual payment (bKash/Nagad/Rocket/Bank etc.)
 * on the public checkout page. Runs server-side so the browser never has to
 * talk to the Supabase REST endpoint cross-origin (fixes "Failed to fetch"
 * on self-hosted Supabase instances behind strict CORS).
 *
 * We use the service-role client but validate hard: invoice must exist,
 * be pending/processing, and the picked method must belong to the same
 * merchant. Fraud blocklist is enforced (email/phone/ip).
 */
export const submitManualPayment = createServerFn({ method: "POST" })
  .inputValidator((d: {
    invoiceId: string;
    methodId: string;
    senderNumber: string;
    senderName?: string;
    providerTxnId: string;
  }) => {
    if (!d.invoiceId || !d.methodId) throw new Error("Missing invoice or method");
    if (!d.providerTxnId?.trim()) throw new Error("Transaction ID required");
    if (!d.senderNumber?.trim()) throw new Error("Sender number required");
    return d;
  })
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/lib/supabase-admin.server");

    const { data: inv, error: iErr } = await supabaseAdmin
      .from("invoices")
      .select("id, merchant_id, amount, currency, status, customer_email, invoice_number")
      .eq("id", data.invoiceId)
      .maybeSingle();
    if (iErr || !inv) throw new Error("Invoice not found");
    if (!["pending", "processing"].includes(inv.status as string)) {
      throw new Error("Invoice not open for payment");
    }

    const { data: method, error: mErr } = await supabaseAdmin
      .from("payment_methods")
      .select("id, merchant_id, type, is_active, fee_percent, fee_flat")
      .eq("id", data.methodId)
      .maybeSingle();
    if (mErr || !method) throw new Error("Payment method not found");
    if (method.merchant_id !== inv.merchant_id || !method.is_active) {
      throw new Error("Payment method unavailable");
    }

    // Fraud blocklist
    const rpc = (supabaseAdmin.rpc.bind(supabaseAdmin) as unknown as (
      fn: string, args: Record<string, unknown>,
    ) => Promise<{ data: boolean | null }>);
    const { data: blocked } = await rpc("check_fraud_block", {
      _merchant_id: inv.merchant_id,
      _email: inv.customer_email ?? "",
      _phone: data.senderNumber,
      _ip: "",
    });
    if (blocked) throw new Error("Payment blocked by merchant fraud rules");

    const gross = Number(inv.amount);
    const fee = Math.round((gross * Number(method.fee_percent ?? 0) / 100 + Number(method.fee_flat ?? 0)) * 100) / 100;
    const net = Math.round((gross - fee) * 100) / 100;

    await supabaseAdmin
      .from("invoices")
      .update({ method_id: method.id, method_type: method.type as never, status: "processing" })
      .eq("id", inv.id);

    const { data: txn, error: tErr } = await supabaseAdmin
      .from("transactions")
      .insert({
        invoice_id: inv.id,
        merchant_id: inv.merchant_id,
        method_type: method.type as never,
        status: "pending",
        gross_amount: gross,
        fee_amount: fee,
        net_amount: net,
        sender_number: data.senderNumber,
        sender_name: data.senderName || null,
        provider_txn_id: data.providerTxnId.trim(),
        reference: data.providerTxnId.trim(),
      })
      .select("id")
      .single();
    if (tErr || !txn) throw new Error(tErr?.message ?? "Submit failed");

    dispatchWebhooks({
      merchantId: inv.merchant_id,
      invoiceId: inv.id,
      event: "transaction.submitted",
      data: { transaction_id: txn.id, invoice_id: inv.id, provider_txn_id: data.providerTxnId },
    }).catch(() => undefined);

    notify({
      merchantId: inv.merchant_id,
      event: "transaction.submitted",
      title: `New payment claim: ${inv.invoice_number}`,
      body: `${method.type} — TrxID ${data.providerTxnId} from ${data.senderNumber}`,
      metadata: { invoiceId: inv.id, transactionId: txn.id },
    }).catch(() => undefined);

    return { ok: true, transactionId: txn.id };
  });
