import { createFileRoute } from "@tanstack/react-router";
import { authenticateApiKey, jsonResponse, CORS_HEADERS } from "@/lib/api-auth.server";
import { dispatchWebhooks } from "@/lib/webhooks.server";

export const Route = createFileRoute("/api/public/v1/invoices")({
  server: {
    handlers: {
      OPTIONS: async () => new Response(null, { status: 204, headers: CORS_HEADERS }),

      GET: async ({ request }) => {
        const auth = await authenticateApiKey(request);
        if ("error" in auth) return jsonResponse({ error: auth.error }, auth.status);

        const url = new URL(request.url);
        const limit = Math.min(Number(url.searchParams.get("limit")) || 25, 100);

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { data, error } = await supabaseAdmin
          .from("invoices")
          .select("id, invoice_number, amount, currency, status, customer_name, customer_email, description, created_at, paid_at")
          .eq("merchant_id", auth.merchantId)
          .order("created_at", { ascending: false })
          .limit(limit);
        if (error) return jsonResponse({ error: error.message }, 500);

        return jsonResponse({ data });
      },

      POST: async ({ request }) => {
        const auth = await authenticateApiKey(request);
        if ("error" in auth) return jsonResponse({ error: auth.error }, auth.status);

        let body: Record<string, unknown>;
        try { body = await request.json(); }
        catch { return jsonResponse({ error: "Invalid JSON body" }, 400); }

        const amount = Number(body.amount);
        if (!amount || amount <= 0) return jsonResponse({ error: "amount is required and must be > 0" }, 400);

        const currency = String(body.currency ?? "BDT").toUpperCase();
        const stamp = new Date().toISOString().slice(0, 10).replace(/-/g, "");
        const rand = Math.random().toString(36).slice(2, 8).toUpperCase();
        const invoiceNumber = `INV-${stamp}-${rand}`;

        const expiresInHours = body.expires_in_hours ? Number(body.expires_in_hours) : 24;
        const expires_at = expiresInHours > 0
          ? new Date(Date.now() + expiresInHours * 3_600_000).toISOString()
          : null;

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { data, error } = await supabaseAdmin
          .from("invoices")
          .insert({
            merchant_id: auth.merchantId,
            invoice_number: invoiceNumber,
            amount,
            currency,
            customer_name: (body.customer_name as string) ?? null,
            customer_email: (body.customer_email as string) ?? null,
            customer_phone: (body.customer_phone as string) ?? null,
            description: (body.description as string) ?? null,
            redirect_url: (body.redirect_url as string) ?? null,
            webhook_url: (body.webhook_url as string) ?? null,
            metadata: (body.metadata as Record<string, unknown>) ?? {},
            expires_at,
            status: "pending",
          })
          .select("*")
          .single();

        if (error || !data) return jsonResponse({ error: error?.message ?? "Insert failed" }, 500);

        const origin = new URL(request.url).origin;
        const checkoutUrl = `${origin}/pay/${data.id}`;

        // Fire invoice.created webhook (non-blocking)
        dispatchWebhooks({
          merchantId: auth.merchantId,
          invoiceId: data.id,
          event: "invoice.created",
          data: { ...data, checkout_url: checkoutUrl },
        }).catch(() => undefined);

        return jsonResponse({ data: { ...data, checkout_url: checkoutUrl } }, 201);
      },
    },
  },
});
