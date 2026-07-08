import { createFileRoute } from "@tanstack/react-router";

const BATCH = 100;

function addInterval(from: Date, unit: string, count: number): Date {
  const d = new Date(from);
  if (unit === "day") d.setUTCDate(d.getUTCDate() + count);
  else if (unit === "week") d.setUTCDate(d.getUTCDate() + count * 7);
  else if (unit === "month") d.setUTCMonth(d.getUTCMonth() + count);
  return d;
}

export const Route = createFileRoute("/api/public/hooks/run-recurring")({
  server: {
    handlers: {
      POST: async () => {
        const { supabaseAdmin } = await import("@/lib/supabase-admin.server");
        const nowIso = new Date().toISOString();

        const { data: due, error } = await supabaseAdmin
          .from("recurring_schedules")
          .select("*")
          .eq("is_active", true)
          .lte("next_run_at", nowIso)
          .limit(BATCH);

        if (error) return Response.json({ error: error.message }, { status: 500 });
        if (!due || due.length === 0) return Response.json({ created: 0 });

        let created = 0;
        for (const s of due) {
          const invoiceNumber = `INV-${Date.now()}-${Math.floor(Math.random() * 9999)}`;
          const { data: inv, error: insErr } = await supabaseAdmin
            .from("invoices")
            .insert({
              merchant_id: s.merchant_id,
              invoice_number: invoiceNumber,
              amount: s.amount,
              currency: s.currency,
              customer_name: s.customer_name,
              customer_email: s.customer_email,
              customer_phone: s.customer_phone,
              description: s.description ?? `Recurring: ${s.name}`,
              redirect_url: s.redirect_url,
              status: "pending",
              mode: s.mode,
              metadata: { source: "recurring", schedule_id: s.id },
            })
            .select("id")
            .single();

          if (insErr) {
            console.error("recurring insert error", s.id, insErr.message);
            continue;
          }

          const next = addInterval(new Date(s.next_run_at), s.interval_unit, s.interval_count);
          await supabaseAdmin
            .from("recurring_schedules")
            .update({
              last_run_at: nowIso,
              next_run_at: next.toISOString(),
              runs_count: (s.runs_count ?? 0) + 1,
            })
            .eq("id", s.id);

          try {
            const { dispatchWebhooks } = await import("@/lib/webhooks.server");
            await dispatchWebhooks({
              merchantId: s.merchant_id,
              invoiceId: inv.id,
              event: "invoice.created",
              data: { invoice_id: inv.id, schedule_id: s.id, source: "recurring" },
              mode: (s.mode as "live" | "test") ?? "live",
            });
          } catch (e) {
            console.error("recurring webhook error", e);
          }
          created++;
        }

        return Response.json({ created });
      },
    },
  },
});
