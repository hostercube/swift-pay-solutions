// Server functions that power the multi-gateway checkout flow.
// Called from the public checkout page (invoice ID + selected gateway).
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const initiateSchema = z.object({
  invoiceId: z.string().uuid(),
  provider: z.string().min(2),
  source: z.enum(["byo", "platform"]).default("byo"),
  successUrl: z.string().url(),
  cancelUrl: z.string().url(),
});

export const initiateGatewayCheckout = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => initiateSchema.parse(d))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { initiateCheckout } = await import("./adapters.server");

    const { data: inv, error: invErr } = await supabaseAdmin
      .from("invoices")
      .select("id, merchant_id, amount, currency, customer_email, customer_name, status")
      .eq("id", data.invoiceId)
      .maybeSingle();
    if (invErr || !inv) throw new Error("Invoice not found");
    if (inv.status !== "pending") throw new Error(`Invoice is ${inv.status}`);

    const table = data.source === "platform" ? "platform_gateways" : "byo_gateways";
    const query = supabaseAdmin.from(table).select("credentials, mode, is_active");
    const { data: gw, error: gwErr } = data.source === "platform"
      ? await query.eq("provider", data.provider).maybeSingle()
      : await query.eq("merchant_id", inv.merchant_id).eq("provider", data.provider).maybeSingle();
    if (gwErr || !gw || !gw.is_active) {
      throw new Error(`${data.provider} is not connected for this merchant`);
    }

    const origin = new URL(data.successUrl).origin;
    const webhookUrl = `${origin}/api/public/webhooks/${data.provider}`;

    const result = await initiateCheckout(data.provider, {
      invoiceId: inv.id,
      amount: Number(inv.amount),
      currency: inv.currency,
      customerEmail: inv.customer_email,
      customerName: inv.customer_name,
      successUrl: data.successUrl,
      cancelUrl: data.cancelUrl,
      webhookUrl,
      creds: (gw.credentials ?? {}) as Record<string, string>,
      mode: gw.mode as "sandbox" | "live",
    });

    // Record a pending transaction pointer so webhook can reconcile.
    await supabaseAdmin.from("transactions").insert({
      invoice_id: inv.id,
      merchant_id: inv.merchant_id,
      status: "pending",
      method_type: data.provider,
      gross_amount: inv.amount,
      provider_txn_id: result.providerRef,
      note: `Gateway checkout initiated (${data.source})`,
    });
    await supabaseAdmin.from("invoices").update({ status: "processing" }).eq("id", inv.id);

    return {
      redirectUrl: result.redirectUrl,
      providerRef: result.providerRef,
      clientSecret: result.clientSecret,
      extra: result.extra,
    };
  });
