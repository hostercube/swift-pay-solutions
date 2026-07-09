import { createFileRoute } from "@tanstack/react-router";
import { authenticateApiKey, jsonResponse, CORS_HEADERS } from "@/lib/api-auth.server";
import { logApiRequest } from "@/lib/api-log.server";

/**
 * GET /v1/balance
 * Returns an aggregated balance snapshot for the authenticated merchant:
 * total collected (completed invoices), refunded, and net — grouped by currency.
 * Since PayNOC does not custody funds (merchants receive directly to their own
 * gateway accounts), this is an *informational* accounting summary — not a
 * withdrawable wallet.
 */
export const Route = createFileRoute("/api/public/v1/balance")({
  server: {
    handlers: {
      OPTIONS: async () => new Response(null, { status: 204, headers: CORS_HEADERS }),
      GET: async ({ request }) => {
        const auth = await authenticateApiKey(request);
        if ("error" in auth) return jsonResponse({ error: auth.error }, auth.status, auth.headers ?? {});
        const started = Date.now();

        const { supabaseAdmin } = await import("@/lib/supabase-admin.server");

        const [{ data: invoices }, { data: refunds }] = await Promise.all([
          supabaseAdmin
            .from("invoices")
            .select("amount, currency, status")
            .eq("merchant_id", auth.merchantId)
            .eq("status", "completed"),
          supabaseAdmin
            .from("refunds")
            .select("amount, currency, status")
            .eq("merchant_id", auth.merchantId)
            .in("status", ["processed", "approved"]),
        ]);

        const bucket: Record<string, { collected: number; refunded: number; net: number; count: number }> = {};
        for (const r of invoices ?? []) {
          const c = (r.currency || "BDT").toUpperCase();
          bucket[c] ||= { collected: 0, refunded: 0, net: 0, count: 0 };
          bucket[c].collected += Number(r.amount) || 0;
          bucket[c].count += 1;
        }
        for (const r of refunds ?? []) {
          const c = (r.currency || "BDT").toUpperCase();
          bucket[c] ||= { collected: 0, refunded: 0, net: 0, count: 0 };
          bucket[c].refunded += Number(r.amount) || 0;
        }
        const balances = Object.entries(bucket).map(([currency, v]) => ({
          currency,
          collected: v.collected,
          refunded: v.refunded,
          net: v.collected - v.refunded,
          completed_invoice_count: v.count,
        }));

        const res = jsonResponse(
          { data: { balances, note: "Funds settle directly to your connected gateway account. This is an informational summary only." } },
          200,
          { "X-Request-Id": auth.requestId },
        );
        logApiRequest({
          merchantId: auth.merchantId, apiKeyId: auth.keyId, request,
          status: res.status, startedAt: started, errorMessage: null,
        });
        return res;
      },
    },
  },
});
