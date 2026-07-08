// Universal gateway webhook receiver.
// POST /api/public/webhooks/:provider
//
// - Reads raw body (needed for HMAC signature verification).
// - Looks up matching merchant credentials (BYO first, then platform).
// - Verifies signature via adapters.server.
// - Records event in webhook_events (idempotent via provider_event_id).
// - On verified "completed" event, updates the matching transaction/invoice.
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/public/webhooks/$provider")({
  server: {
    handlers: {
      POST: async ({ request, params }) => {
        const provider = params.provider;
        const rawBody = await request.text();
        const headers: Record<string, string> = {};
        request.headers.forEach((v, k) => { headers[k.toLowerCase()] = v; });

        const { supabaseAdmin } = await import("@/lib/supabase-admin.server");
        const { verifyWebhook } = await import("@/lib/gateways/adapters.server");
        const admin = supabaseAdmin as unknown as {
          from: (t: string) => {
            select: (s: string) => {
              eq: (c: string, v: string) => {
                maybeSingle: () => Promise<{ data: Record<string, unknown> | null; error: unknown }>;
                limit: (n: number) => Promise<{ data: Record<string, unknown>[] | null; error: unknown }>;
              };
            };
            insert: (v: object) => Promise<{ error: unknown }>;
            update: (v: object) => { eq: (c: string, v: string) => Promise<{ error: unknown }> };
          };
        };

        // Try to find the merchant creds by scanning byo_gateways for this provider.
        // We loop candidates until one signature verifies (webhook usually maps to
        // one merchant per gateway URL; per-merchant paths can be added later).
        const byoRes = await admin.from("byo_gateways").select("merchant_id, credentials, mode").eq("provider", provider).limit(50);
        const platformRes = await admin.from("platform_gateways").select("merchant_id, credentials, mode").eq("provider", provider).limit(1);
        const candidates = [
          ...(byoRes.data ?? []),
          ...(platformRes.data ?? []).map((r) => ({ ...r, merchant_id: null })),
        ];

        let result: ReturnType<typeof verifyWebhook> | null = null;
        let matched: { merchant_id: string | null; credentials: Record<string, string>; mode: string } | null = null;
        for (const c of candidates) {
          const creds = ((c as { credentials?: Record<string, string> }).credentials) ?? {};
          const mode = ((c as { mode?: string }).mode) ?? "sandbox";
          const r = verifyWebhook(provider, { rawBody, headers, creds, mode: mode as "sandbox" | "live" });
          if (r.verified) {
            result = r;
            matched = { merchant_id: (c as { merchant_id: string | null }).merchant_id, credentials: creds, mode };
            break;
          }
        }

        await admin.from("webhook_events").insert({
          provider,
          merchant_id: matched?.merchant_id ?? null,
          invoice_id: result?.invoiceRef ?? null,
          event_type: result?.eventType ?? null,
          provider_event_id: result?.providerEventId ?? null,
          raw_body: rawBody,
          headers,
          signature_verified: !!result?.verified,
          processed: false,
          error: result?.verified ? null : (result?.reason ?? "no_matching_credentials"),
        });

        if (!result?.verified) {
          return new Response("Invalid signature", { status: 401 });
        }

        // Reconcile with invoice/transaction.
        if (result.invoiceRef && result.status === "completed") {
          await admin.from("invoices").update({
            status: "completed",
            paid_at: new Date().toISOString(),
          }).eq("id", result.invoiceRef);
          if (result.providerTxnId) {
            await admin.from("transactions").update({
              status: "completed",
              verified_at: new Date().toISOString(),
              provider_txn_id: result.providerTxnId,
            }).eq("provider_txn_id", result.providerTxnId);
          }
        } else if (result.invoiceRef && result.status === "failed") {
          await admin.from("invoices").update({ status: "failed" }).eq("id", result.invoiceRef);
        }

        return Response.json({ ok: true });
      },
    },
  },
});
