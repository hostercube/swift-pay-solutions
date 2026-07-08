import { createFileRoute } from "@tanstack/react-router";

// Auto-creates payout rows for merchants whose schedule is due and whose
// available balance clears their min_amount. Runs every 30 minutes.
export const Route = createFileRoute("/api/public/hooks/run-payout-schedule")({
  server: {
    handlers: {
      POST: async () => handle(),
      GET: async () => handle(),
    },
  },
});

async function handle() {
  const { supabaseAdmin } = await import("@/lib/supabase-admin.server");
  const nowIso = new Date().toISOString();

  const { data: schedules } = await (supabaseAdmin.from as unknown as (t: string) => {
    select: (c: string) => {
      eq: (col: string, v: unknown) => {
        lte: (
          col: string,
          v: unknown,
        ) => Promise<{ data: Array<Record<string, unknown>> | null }>;
      };
    };
  })("payout_schedules")
    .select("*")
    .eq("enabled", true)
    .lte("next_run_at", nowIso);

  let created = 0;
  for (const s of schedules ?? []) {
    const merchantId = String(s.merchant_id);
    const [{ data: paid }, { data: existing }] = await Promise.all([
      supabaseAdmin
        .from("invoices")
        .select("amount")
        .eq("merchant_id", merchantId)
        .eq("status", "completed"),
      supabaseAdmin
        .from("payouts")
        .select("amount, status")
        .eq("merchant_id", merchantId),
    ]);
    const totalPaid = (paid ?? []).reduce((a, r) => a + Number(r.amount), 0);
    const totalPayout = (existing ?? [])
      .filter((r) => r.status !== "rejected")
      .reduce((a, r) => a + Number(r.amount), 0);
    const balance = totalPaid - totalPayout;
    const minAmt = Number(s.min_amount ?? 0);

    if (balance >= minAmt && balance > 0) {
      await supabaseAdmin.from("payouts").insert({
        merchant_id: merchantId,
        amount: balance,
        method: String(s.method),
        account_number: String(s.account_number),
        account_name: (s.account_name as string) ?? null,
      });
      created++;
    }

    // roll next_run_at forward
    const bump = String(s.frequency) === "weekly" ? 7 : 30;
    const next = new Date();
    next.setUTCDate(next.getUTCDate() + bump);

    await (supabaseAdmin.from as unknown as (t: string) => {
      update: (p: Record<string, unknown>) => {
        eq: (c: string, v: unknown) => Promise<{ error: unknown }>;
      };
    })("payout_schedules")
      .update({
        next_run_at: next.toISOString(),
        last_run_at: nowIso,
        runs_count: Number(s.runs_count ?? 0) + 1,
      })
      .eq("id", String(s.id));
  }
  return new Response(JSON.stringify({ ok: true, created }), {
    headers: { "Content-Type": "application/json" },
  });
}
