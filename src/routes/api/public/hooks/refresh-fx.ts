import { createFileRoute } from "@tanstack/react-router";
import { assertCronRequest } from "@/lib/cron-auth.server";

// Refreshes platform fx_rates from a free public FX source once per day.
// Merchants with mode='auto' automatically pick up the new rates via
// public.get_effective_fx_rate().
export const Route = createFileRoute("/api/public/hooks/refresh-fx")({
  server: {
    handlers: {
      POST: async ({ request }) => assertCronRequest(request) ?? handle(),
      GET: async ({ request }) => assertCronRequest(request) ?? handle(),
    },
  },
});

async function handle() {
  const { supabaseAdmin } = await import("@/lib/supabase-admin.server");
  // Fetch existing pairs so we only refresh what's configured
  const { data: pairs } = await supabaseAdmin
    .from("fx_rates")
    .select("base_currency, quote_currency");

  let updated = 0;
  const errors: string[] = [];

  for (const p of pairs ?? []) {
    const base = String(p.base_currency).toUpperCase();
    const quote = String(p.quote_currency).toUpperCase();
    try {
      const res = await fetch(
        `https://api.exchangerate.host/latest?base=${base}&symbols=${quote}`,
      );
      const json = (await res.json()) as { rates?: Record<string, number> };
      const rate = json.rates?.[quote];
      if (typeof rate === "number" && rate > 0) {
        await supabaseAdmin
          .from("fx_rates")
          .update({ rate, updated_at: new Date().toISOString() })
          .eq("base_currency", base)
          .eq("quote_currency", quote);
        updated++;
      }
    } catch (e) {
      errors.push(`${base}->${quote}: ${(e as Error).message}`);
    }
  }
  return new Response(JSON.stringify({ ok: true, updated, errors }), {
    headers: { "Content-Type": "application/json" },
  });
}
