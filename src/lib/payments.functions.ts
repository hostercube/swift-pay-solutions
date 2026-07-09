import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { dispatchWebhooks } from "@/lib/webhooks.server";
import { notify } from "@/lib/notifications.server";
import { assertMerchantRole } from "@/lib/rbac.server";



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
    await assertMerchantRole(supabase, userId, txn.merchant_id, "operator");


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
      mode: ((invoice as { mode?: "live" | "test" }).mode ?? "live"),
    }).catch(() => undefined);


    notify({
      merchantId: txn.merchant_id,
      event: "invoice.completed",
      title: `Payment received: ${(invoice as { invoice_number?: string }).invoice_number ?? invoice.id}`,
      body: `Amount ${(invoice as { currency?: string }).currency ?? ""} ${(invoice as { amount?: number }).amount ?? ""} from ${(invoice as { customer_name?: string }).customer_name ?? "customer"}.`,
      metadata: { invoiceId: invoice.id },
    }).catch(() => undefined);


    return { ok: true };
  });

export const rejectTransaction = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { transactionId: string; note?: string }) => data)
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: txn, error: tErr } = await supabase
      .from("transactions")
      .select("merchant_id")
      .eq("id", data.transactionId)
      .maybeSingle();
    if (tErr) throw new Error(tErr.message);
    if (!txn) throw new Error("Transaction not found");
    await assertMerchantRole(supabase, userId, txn.merchant_id, "operator");
    const { error } = await supabase
      .from("transactions")
      .update({ status: "rejected", note: data.note || null })
      .eq("id", data.transactionId);
    if (error) throw new Error(error.message);
    return { ok: true };

  });

/**
 * Super-admin updates a payout row. When status flips to `processed`, fires the
 * `payout.processed` webhook + merchant notification.
 */
export const updatePayoutStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { payoutId: string; status: "approved" | "processed" | "rejected"; note?: string }) => data)
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    const { data: isAdmin } = await supabase.rpc("has_role", { _user_id: userId, _role: "super_admin" });
    if (!isAdmin) throw new Error("Forbidden");

    const patch = {
      status: data.status,
      admin_note: data.note ?? null,
      ...(data.status === "processed"
        ? { processed_at: new Date().toISOString(), processed_by: userId }
        : { processed_at: null, processed_by: null }),
    };

    const { data: row, error } = await supabase
      .from("payouts")
      .update(patch)
      .eq("id", data.payoutId)
      .select("*")
      .single();
    if (error || !row) throw new Error(error?.message ?? "Payout update failed");

    if (data.status === "processed") {
      dispatchWebhooks({
        merchantId: (row as { merchant_id: string }).merchant_id,
        invoiceId: (row as { id: string }).id,
        event: "payout.processed",
        data: row,
      }).catch(() => undefined);

      notify({
        merchantId: (row as { merchant_id: string }).merchant_id,
        event: "payout.processed",
        title: "Payout processed",
        body: `Amount ৳ ${(row as { amount: number }).amount} sent to ${(row as { method: string }).method}.`,
        metadata: { payoutId: (row as { id: string }).id },
      }).catch(() => undefined);
    }
    return { ok: true };
  });

/** Merchant creates a refund request against a completed invoice. */
export const createRefund = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { invoiceId: string; amount: number; reason?: string }) => data)
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    const { data: inv, error: iErr } = await supabase
      .from("invoices")
      .select("id, merchant_id, amount, currency, status")
      .eq("id", data.invoiceId)
      .maybeSingle();
    if (iErr || !inv) throw new Error(iErr?.message ?? "Invoice not found");
    await assertMerchantRole(supabase, userId, inv.merchant_id, "operator");
    if (inv.status !== "completed") throw new Error("Only completed invoices can be refunded");
    if (data.amount <= 0 || data.amount > Number(inv.amount))
      throw new Error("Invalid refund amount");

    const { supabaseAdmin } = await import("@/lib/supabase-admin.server");
    const insertRefund = (supabaseAdmin.from as unknown as (t: string) => {
      insert: (row: Record<string, unknown>) => {
        select: (s: string) => {
          single: () => Promise<{ data: Record<string, unknown> | null; error: { message: string } | null }>;
        };
      };
    }).bind(supabaseAdmin);
    const { data: refund, error } = await insertRefund("refunds")

      .insert({
        merchant_id: inv.merchant_id,
        invoice_id: inv.id,
        amount: data.amount,
        currency: inv.currency,
        reason: data.reason ?? null,
        status: "requested",
        requested_via: "dashboard",
      })
      .select("*")
      .single();
    if (error) throw new Error(error.message);

    dispatchWebhooks({
      merchantId: inv.merchant_id,
      invoiceId: inv.id,
      event: "refund.requested",
      data: refund ?? { invoice_id: inv.id, amount: data.amount, currency: inv.currency },
    }).catch(() => undefined);

    return { ok: true };
  });

/** Super-admin approves / rejects / processes a refund. Fires webhook on processed. */
export const updateRefundStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { refundId: string; status: "approved" | "processed" | "rejected"; note?: string }) => data)
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: isAdmin } = await supabase.rpc("has_role", { _user_id: userId, _role: "super_admin" });

    // Look up the refund to check ownership; merchants may self-process their own refunds.
    const { data: existing } = await supabase
      .from("refunds")
      .select("merchant_id, status")
      .eq("id", data.refundId)
      .maybeSingle();
    if (!existing) throw new Error("Refund not found");
    const isOwner = (existing as { merchant_id: string }).merchant_id === userId;
    if (!isAdmin && !isOwner) throw new Error("Forbidden");

    const patch: Record<string, unknown> = { status: data.status, admin_note: data.note ?? null };
    if (data.status === "processed") {
      patch.processed_at = new Date().toISOString();
      patch.processed_by = userId;
    }

    const fromLoose = ((supabase.from as unknown as (t: string) => {
      update: (p: Record<string, unknown>) => {
        eq: (col: string, v: string) => {
          select: (s: string) => {
            single: () => Promise<{ data: Record<string, unknown> | null; error: { message: string } | null }>;
          };
        };
      };
    }).bind(supabase);
    const { data: row, error } = await fromLoose("refunds")

      .update(patch)
      .eq("id", data.refundId)
      .select("*")
      .single();
    if (error || !row) throw new Error(error?.message ?? "Refund update failed");

    const merchantId = (row as { merchant_id: string }).merchant_id;
    const invoiceId = (row as { invoice_id: string }).invoice_id;
    const currency = (row as { currency: string }).currency;
    const amount = (row as { amount: number }).amount;
    const refundId = (row as { id: string }).id;

    if (data.status === "approved") {
      dispatchWebhooks({ merchantId, invoiceId, event: "refund.approved", data: row }).catch(() => undefined);
      notify({
        merchantId, event: "refund.approved", title: "Refund approved",
        body: `Refund of ${currency} ${amount} approved and will be processed.`,
        metadata: { refundId },
      }).catch(() => undefined);
    }

    if (data.status === "rejected") {
      dispatchWebhooks({ merchantId, invoiceId, event: "refund.rejected", data: row }).catch(() => undefined);
      notify({
        merchantId, event: "refund.rejected", title: "Refund rejected",
        body: `Refund of ${currency} ${amount} was rejected.`,
        metadata: { refundId },
      }).catch(() => undefined);
    }

    if (data.status === "processed") {
      // Call the actual provider refund endpoint before marking processed.
      const { supabaseAdmin } = await import("@/lib/supabase-admin.server");
      const { refundProvider } = await import("@/lib/gateways/adapters.server");

      // Find original completed transaction to identify provider + txn id.
      const { data: origTxn } = await supabaseAdmin
        .from("transactions")
        .select("provider_txn_id, method_type")
        .eq("invoice_id", invoiceId)
        .eq("status", "verified")
        .maybeSingle();

      const providerName = (origTxn?.method_type as string | undefined) ?? "manual";
      const providerTxnId = origTxn?.provider_txn_id ?? "";

      let providerRefundId: string | null = null;
      let providerResp: unknown = null;

      if (providerName !== "manual" && providerTxnId) {
        // Look up merchant creds for this provider.
        const { data: gw } = await supabaseAdmin
          .from("byo_gateways")
          .select("credentials, mode")
          .eq("merchant_id", merchantId)
          .eq("provider", providerName)
          .maybeSingle();
        if (gw) {
          const res = await refundProvider(providerName, {
            providerTxnId,
            amount: Number(amount),
            currency,
            creds: (gw.credentials as Record<string, string>) ?? {},
            mode: ((gw.mode as string) === "live" ? "live" : "sandbox"),
            reason: data.note ?? undefined,
          });
          providerResp = res.raw ?? { error: res.error };
          if (!res.ok) {
            // Revert refund row status and bubble error up.
            await supabaseAdmin.from("refunds")
              .update({ status: "approved", admin_note: `Provider refund failed: ${res.error}` })
              .eq("id", refundId);
            throw new Error(`Refund failed at provider: ${res.error}`);
          }
          providerRefundId = res.providerRefundId ?? null;
        }
      }

      await supabaseAdmin.from("refunds").update({
        provider: providerName,
        provider_refund_id: providerRefundId,
        provider_response: providerResp as never,
      }).eq("id", refundId);

      // Mark invoice as refunded
      await supabase.from("invoices").update({ status: "refunded" }).eq("id", invoiceId);

      dispatchWebhooks({ merchantId, invoiceId, event: "refund.processed", data: { ...row, provider_refund_id: providerRefundId } }).catch(() => undefined);
      dispatchWebhooks({ merchantId, invoiceId, event: "invoice.refunded", data: { invoice_id: invoiceId, refund_id: refundId, amount, currency, provider_refund_id: providerRefundId } }).catch(() => undefined);

      notify({
        merchantId, event: "refund.processed", title: "Refund processed",
        body: `Refund of ${currency} ${amount} completed.`,
        metadata: { refundId },
      }).catch(() => undefined);
    }
    return { ok: true };
  });

