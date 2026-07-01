export async function logApiRequest(params: {
  merchantId: string;
  apiKeyId: string | null;
  request: Request;
  status: number;
  startedAt: number;
  errorMessage?: string | null;
}) {
  try {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const url = new URL(params.request.url);
    const ip =
      params.request.headers.get("cf-connecting-ip") ||
      params.request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
      null;
    await supabaseAdmin.from("api_request_logs").insert({
      merchant_id: params.merchantId,
      api_key_id: params.apiKeyId,
      method: params.request.method,
      path: url.pathname,
      status_code: params.status,
      latency_ms: Math.max(0, Date.now() - params.startedAt),
      ip_address: ip,
      user_agent: params.request.headers.get("user-agent"),
      error_message: params.errorMessage ?? null,
    });
  } catch {
    // never break the API response over logging
  }
}
