import { createFileRoute } from "@tanstack/react-router";
import { assertCronRequest } from "@/lib/cron-auth.server";
import { signPayload } from "@/lib/webhooks.server";

const MAX_ATTEMPTS = 6;
const BATCH = 25;
// Exponential backoff in seconds: 1m, 5m, 30m, 2h, 6h, 24h
const BACKOFF_SECONDS = [60, 300, 1800, 7200, 21600, 86400];

export const Route = createFileRoute("/api/public/hooks/webhook-retry")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const denied = assertCronRequest(request);
        if (denied) return denied;
        const { supabaseAdmin } = await import("@/lib/supabase-admin.server");

        const { data: due, error } = await supabaseAdmin
          .from("webhook_deliveries")
          .select("id, endpoint_id, merchant_id, invoice_id, event, url, payload, attempts")
          .eq("status", "failed")
          .lt("attempts", MAX_ATTEMPTS)
          .lte("next_retry_at", new Date().toISOString())
          .order("next_retry_at", { ascending: true })
          .limit(BATCH);

        if (error) return Response.json({ error: error.message }, { status: 500 });
        if (!due || due.length === 0) return Response.json({ processed: 0 });

        let succeeded = 0;
        let stillFailed = 0;

        for (const d of due) {
          // Fetch fresh signing secret
          const { data: ep } = await supabaseAdmin
            .from("webhook_endpoints")
            .select("signing_secret, is_active")
            .eq("id", d.endpoint_id!)
            .maybeSingle();

          if (!ep || !ep.is_active) {
            await supabaseAdmin
              .from("webhook_deliveries")
              .update({ status: "failed", next_retry_at: null, attempts: MAX_ATTEMPTS })
              .eq("id", d.id);
            continue;
          }

          const ts = Math.floor(Date.now() / 1000);
          const body = JSON.stringify(d.payload);
          const signature = signPayload(ep.signing_secret, body, ts);

          let httpStatus: number | null = null;
          let responseBody: string | null = null;
          let ok = false;
          try {
            const res = await fetch(d.url, {
              method: "POST",
              headers: {
                "content-type": "application/json",
                "x-paynoc-event": d.event,
                "x-paynoc-timestamp": String(ts),
                "x-paynoc-signature": `t=${ts},v1=${signature}`,
                "x-paynoc-retry": String(d.attempts),
              },
              body,
            });
            httpStatus = res.status;
            responseBody = (await res.text()).slice(0, 4000);
            ok = res.ok;
          } catch (err) {
            responseBody = String(err).slice(0, 4000);
          }

          const nextAttempts = d.attempts + 1;
          if (ok) {
            succeeded++;
            await supabaseAdmin
              .from("webhook_deliveries")
              .update({
                status: "success",
                http_status: httpStatus,
                response_body: responseBody,
                attempts: nextAttempts,
                next_retry_at: null,
                delivered_at: new Date().toISOString(),
              })
              .eq("id", d.id);
          } else {
            stillFailed++;
            const idx = Math.min(nextAttempts - 1, BACKOFF_SECONDS.length - 1);
            const exhausted = nextAttempts >= MAX_ATTEMPTS;
            await supabaseAdmin
              .from("webhook_deliveries")
              .update({
                status: "failed",
                http_status: httpStatus,
                response_body: responseBody,
                attempts: nextAttempts,
                next_retry_at: exhausted ? null : new Date(Date.now() + BACKOFF_SECONDS[idx] * 1000).toISOString(),
              })
              .eq("id", d.id);
          }
        }

        return Response.json({ processed: due.length, succeeded, stillFailed });
      },
    },
  },
});
