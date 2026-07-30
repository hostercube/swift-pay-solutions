// Server functions that power the multi-gateway checkout flow.
// Called from the public checkout page (invoice ID + selected gateway).
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const initiateSchema = z.object({
  invoiceId: z.string().uuid(),
  provider: z.string().min(2),
  source: z.enum(["byo", "platform"]).default("byo"),
  configId: z.string().uuid().optional(),
  successUrl: z.string().url(),
  cancelUrl: z.string().url(),
});

export const initiateGatewayCheckout = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => initiateSchema.parse(d))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/lib/supabase-admin.server");
    const { initiateCheckout } = await import("./adapters.server");

    const { data: inv, error: invErr } = await supabaseAdmin
      .from("invoices")
      .select("id, merchant_id, amount, currency, customer_email, customer_name, status")
      .eq("id", data.invoiceId)
      .maybeSingle();
    if (invErr || !inv) throw new Error("Invoice not found");
    if (inv.status !== "pending") throw new Error(`Invoice is ${inv.status}`);

    const admin = supabaseAdmin as unknown as {
      from: (t: string) => {
        select: (s: string) => {
          eq: (c: string, v: string) => {
            eq?: (c: string, v: string) => {
              eq?: (c: string, v: string) => { maybeSingle: () => Promise<{ data: Record<string, unknown> | null; error: unknown }> };
              maybeSingle: () => Promise<{ data: Record<string, unknown> | null; error: unknown }>;
              limit?: (n: number) => { maybeSingle: () => Promise<{ data: Record<string, unknown> | null; error: unknown }> };
              order?: (c: string, o: { ascending: boolean }) => { limit: (n: number) => { maybeSingle: () => Promise<{ data: Record<string, unknown> | null; error: unknown }> } };
            };
            maybeSingle: () => Promise<{ data: Record<string, unknown> | null; error: unknown }>;
          };
        };
        insert: (v: object) => Promise<{ error: unknown }>;
        update: (v: object) => { eq: (c: string, v: string) => Promise<{ error: unknown }> };
      };
    };

    type Gw = { credentials?: Record<string, string>; mode?: string; is_active?: boolean };
    let gw: Gw | null = null;
    if (data.source === "platform") {
      const res = await admin.from("platform_gateways")
        .select("credentials, mode, is_active, provider, commission_percent, commission_flat")
        .eq("provider", data.provider).maybeSingle();
      gw = res.data as Gw | null;
    } else if (data.configId) {
      const res = await admin.from("byo_gateways")
        .select("credentials, mode, is_active, merchant_id, provider")
        .eq("id", data.configId).eq!("merchant_id", inv.merchant_id).maybeSingle();
      gw = res.data as Gw | null;
    } else {
      const res = await admin.from("byo_gateways")
        .select("credentials, mode, is_active, merchant_id, provider")
        .eq("merchant_id", inv.merchant_id).eq!("provider", data.provider)
        .order!("created_at", { ascending: true }).limit(1).maybeSingle();
      gw = res.data as Gw | null;
    }
    if (!gw || !gw.is_active) throw new Error(`${data.provider} is not connected for this merchant`);


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
      creds: gw.credentials ?? {},
      mode: (gw.mode as "sandbox" | "live") ?? "sandbox",
    });

    // Record a pending transaction pointer so webhook can reconcile.
    // method_type is a constrained enum — fall back to "other" for gateways
    // that aren't part of the historical enum (paypal, razorpay, stripe, …).
    const enumTypes = ["bkash","nagad","rocket","upay","tap","mcash","sure_cash","card","bank_transfer","crypto","other"];
    const methodType = enumTypes.includes(data.provider) ? data.provider : "other";
    // Persist fee/net now — completion paths copy these onto the invoice, and a
    // null here silently zeroes out merchant fee accounting.
    const gross = Number(inv.amount);
    const feePercent = Number((gw as { commission_percent?: number }).commission_percent ?? 0);
    const feeFlat = Number((gw as { commission_flat?: number }).commission_flat ?? 0);
    const fee = Math.round(((gross * feePercent) / 100 + feeFlat) * 100) / 100;
    const net = Math.round((gross - fee) * 100) / 100;

    const { error: txnErr } = await admin.from("transactions").insert({
      invoice_id: inv.id,
      merchant_id: inv.merchant_id,
      status: "pending",
      method_type: methodType,
      gross_amount: gross,
      fee_amount: fee,
      net_amount: net,
      provider_txn_id: result.providerRef,
      note: `Gateway checkout initiated (${data.provider}, ${data.source})`,
    });
    if (txnErr) {
      throw new Error("Payment session was created but could not be recorded. Please retry.");
    }
    await admin.from("invoices").update({ status: "processing" }).eq("id", inv.id);

    return {
      redirectUrl: result.redirectUrl ?? null,
      providerRef: result.providerRef,
      clientSecret: result.clientSecret ?? null,
    };
  });

