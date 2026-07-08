import { createHmac } from "crypto";

export async function sha256Hex(text: string) {
  const { createHash } = await import("crypto");
  return createHash("sha256").update(text).digest("hex");
}

export function signPayload(secret: string, body: string, ts: number) {
  const payload = `${ts}.${body}`;
  return createHmac("sha256", secret).update(payload).digest("hex");
}

/**
 * Fire-and-record webhook deliveries for a given event/invoice.
 * Runs on the server; uses the service-role admin client to bypass RLS
 * so this works both when triggered by an authenticated merchant and
 * when triggered by the public REST API (anon).
 */
export async function dispatchWebhooks(opts: {
  merchantId: string;
  invoiceId: string;
  event: string;
  data: Record<string, unknown>;
  mode?: "live" | "test";
}) {
  const { supabaseAdmin } = await import("@/lib/supabase-admin.server");
  const mode = opts.mode ?? "live";

  const { data: endpoints } = await supabaseAdmin
    .from("webhook_endpoints")
    .select("id, url, signing_secret, events, mode")
    .eq("merchant_id", opts.merchantId)
    .eq("is_active", true)
    .eq("mode", mode);

  const targets = (endpoints ?? []).filter((e) =>
    !e.events || e.events.length === 0 || e.events.includes(opts.event),
  );


  const ts = Math.floor(Date.now() / 1000);
  const body = JSON.stringify({
    event: opts.event,
    created_at: new Date().toISOString(),
    data: opts.data,
  });

  await Promise.all(
    targets.map(async (ep) => {
      const signature = signPayload(ep.signing_secret, body, ts);
      let httpStatus: number | null = null;
      let responseBody: string | null = null;
      let status: "success" | "failed" = "failed";
      try {
        const res = await fetch(ep.url, {
          method: "POST",
          headers: {
            "content-type": "application/json",
            "x-paynoc-event": opts.event,
            "x-paynoc-timestamp": String(ts),
            "x-paynoc-signature": `t=${ts},v1=${signature}`,
          },
          body,
        });
        httpStatus = res.status;
        responseBody = (await res.text()).slice(0, 4000);
        status = res.ok ? "success" : "failed";
      } catch (err) {
        responseBody = String(err).slice(0, 4000);
      }

      const nextRetryAt = status === "failed"
        ? new Date(Date.now() + 60_000).toISOString() // 1 min for first retry
        : null;

      await supabaseAdmin.from("webhook_deliveries").insert({
        merchant_id: opts.merchantId,
        endpoint_id: ep.id,
        invoice_id: opts.invoiceId,
        event: opts.event,
        url: ep.url,
        payload: JSON.parse(body),
        status,
        http_status: httpStatus,
        response_body: responseBody,
        attempts: 1,
        next_retry_at: nextRetryAt,
        delivered_at: status === "success" ? new Date().toISOString() : null,
      });

      if (status === "failed") {
        const { notify } = await import("@/lib/notifications.server");
        await notify({
          merchantId: opts.merchantId,
          event: "webhook.failed",
          title: `Webhook delivery failed`,
          body: `${opts.event} → ${ep.url} (HTTP ${httpStatus ?? "network error"})`,
          metadata: { invoiceId: opts.invoiceId, endpointId: ep.id },
        });
      }
    }),
  );
}
