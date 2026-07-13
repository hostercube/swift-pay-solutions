import { createFileRoute } from "@tanstack/react-router";
import { authenticateApiKey, jsonResponse, CORS_HEADERS } from "@/lib/api-auth.server";
import { logApiRequest } from "@/lib/api-log.server";
import type { SmsEvent } from "@/lib/sms-match.server";

/**
 * SMS ingest endpoint for the PayNOC Merchant APK. Every event is
 * matched via the shared pipeline in `sms-match.server.ts`, which
 * records an `sms_event_logs` row (layer + outcome + reason) for
 * every attempt — success, skip, rejection, and no-match alike.
 *
 * Offline: the APK queues events in a local Room DB and retries whenever
 * network is available — this endpoint is idempotent per (merchant, trxid).
 */
async function handlePost(request: Request): Promise<Response> {
  const auth = await authenticateApiKey(request);
  if ("error" in auth) return jsonResponse({ error: auth.error }, auth.status, auth.headers ?? {});
  const started = Date.now();

  let body: { events?: SmsEvent[] };
  try { body = await request.json(); } catch {
    return jsonResponse({ error: "Invalid JSON" }, 400);
  }
  const events = Array.isArray(body.events) ? body.events : [];
  if (events.length === 0) return jsonResponse({ error: "events[] required" }, 400);
  if (events.length > 50) return jsonResponse({ error: "Max 50 events per batch" }, 400);

  const { supabaseAdmin } = await import("@/lib/supabase-admin.server");
  const { matchAndVerify } = await import("@/lib/sms-match.server");

  const results = [];
  for (const ev of events) {
    const r = await matchAndVerify(supabaseAdmin, auth.merchantId, ev, { source: "apk_sms" });
    results.push(r);
  }

  const res = jsonResponse({ ok: true, results });
  logApiRequest({
    merchantId: auth.merchantId, apiKeyId: auth.keyId, request,
    status: res.status, startedAt: started,
  });
  return res;
}

export const Route = createFileRoute("/api/public/v1/sms-events")({
  server: {
    handlers: {
      OPTIONS: async () => new Response(null, { status: 204, headers: CORS_HEADERS }),
      POST: async ({ request }) => handlePost(request),
    },
  },
});
