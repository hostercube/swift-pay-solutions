import { createFileRoute } from "@tanstack/react-router";

// Sends daily/weekly summary email digest to each merchant that has one due.
// Cron: every hour at :00. Only runs merchants whose frequency window has elapsed.
export const Route = createFileRoute("/api/public/hooks/run-digest")({
  server: {
    handlers: {
      POST: async () => handle(),
      GET: async () => handle(),
    },
  },
});

async function handle() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { notify } = await import("@/lib/notifications.server");

  const now = Date.now();
  const { data: rows } = await (supabaseAdmin.from as unknown as (t: string) => {
    select: (c: string) => {
      eq: (col: string, v: unknown) => Promise<{ data: Array<Record<string, unknown>> | null }>;
    };
  })("digest_settings").select("merchant_id, frequency, last_sent_at").eq("enabled", true);

  let sent = 0;
  for (const r of rows ?? []) {
    const freq = String(r.frequency ?? "daily");
    if (freq === "off") continue;
    const windowMs = freq === "weekly" ? 7 * 24 * 3600e3 : 24 * 3600e3;
    const last = r.last_sent_at ? new Date(String(r.last_sent_at)).getTime() : 0;
    if (now - last < windowMs) continue;

    const merchantId = String(r.merchant_id);
    const since = new Date(Math.max(last, now - windowMs)).toISOString();

    const { data: invs } = await supabaseAdmin
      .from("invoices")
      .select("amount, status, currency")
      .eq("merchant_id", merchantId)
      .gte("created_at", since);

    const list = invs ?? [];
    const paid = list.filter((i) => i.status === "completed");
    const failed = list.filter((i) => ["failed", "expired"].includes(i.status));
    const volume = paid.reduce((a, i) => a + Number(i.amount), 0);

    await notify({
      merchantId,
      event: "digest",
      title: `PayNOC ${freq} digest`,
      body: [
        `Period: last ${freq === "weekly" ? "7 days" : "24 hours"}`,
        `Invoices created: ${list.length}`,
        `Paid: ${paid.length} · Volume: ৳ ${volume.toLocaleString()}`,
        `Failed / expired: ${failed.length}`,
      ].join("\n"),
      metadata: { period: freq },
    });

    await (supabaseAdmin.from as unknown as (t: string) => {
      update: (p: Record<string, unknown>) => {
        eq: (c: string, v: unknown) => Promise<{ error: unknown }>;
      };
    })("digest_settings")
      .update({ last_sent_at: new Date().toISOString() })
      .eq("merchant_id", merchantId);
    sent++;
  }
  return new Response(JSON.stringify({ ok: true, sent }), {
    headers: { "Content-Type": "application/json" },
  });
}
