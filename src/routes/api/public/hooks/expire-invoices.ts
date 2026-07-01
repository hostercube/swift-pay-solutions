import { createFileRoute } from "@tanstack/react-router";

const BATCH = 200;

export const Route = createFileRoute("/api/public/hooks/expire-invoices")({
  server: {
    handlers: {
      POST: async () => {
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

        const nowIso = new Date().toISOString();

        const { data: due, error } = await supabaseAdmin
          .from("invoices")
          .select("id, merchant_id, mode")
          .eq("status", "pending")
          .not("expires_at", "is", null)
          .lte("expires_at", nowIso)
          .limit(BATCH);

        if (error) return Response.json({ error: error.message }, { status: 500 });
        if (!due || due.length === 0) return Response.json({ expired: 0 });

        const ids = due.map((i) => i.id);
        const { error: upErr } = await supabaseAdmin
          .from("invoices")
          .update({ status: "expired" })
          .in("id", ids)
          .eq("status", "pending");

        if (upErr) return Response.json({ error: upErr.message }, { status: 500 });

        // Fire webhooks (best-effort)
        try {
          const { dispatchWebhooks } = await import("@/lib/webhooks.server");
          for (const inv of due) {
            await dispatchWebhooks({
              merchantId: inv.merchant_id,
              invoiceId: inv.id,
              event: "invoice.expired",
              data: { invoice_id: inv.id },
            });
          }
        } catch (e) {
          console.error("expire webhook error", e);
        }

        return Response.json({ expired: ids.length });
      },
    },
  },
});
