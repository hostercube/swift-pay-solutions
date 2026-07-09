import { createHash, randomUUID } from "crypto";

const RATE_LIMIT = 120;
const WINDOW_SECONDS = 60;

export function newRequestId() {
  try { return randomUUID(); } catch { return `req_${Math.random().toString(36).slice(2)}${Date.now().toString(36)}`; }
}



function clientIp(request: Request) {
  return (
    request.headers.get("cf-connecting-ip") ||
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    request.headers.get("x-real-ip") ||
    null
  );
}

/**
 * Authenticate an API key, enforce IP whitelist and rate limit,
 * and audit the call. Returns merchant context or an error response shape.
 */
export async function authenticateApiKey(request: Request): Promise<
  | { merchantId: string; environment: string; keyId: string; ip: string | null; rateLimit: { limit: number; remaining: number; reset: number }; requestId: string }
  | { error: string; status: number; headers?: Record<string, string> }
> {
  const requestId = newRequestId();
  const header =

    request.headers.get("authorization")?.replace(/^Bearer\s+/i, "").trim() ||
    request.headers.get("x-api-key")?.trim();

  if (!header) return { error: "Missing API key", status: 401 };
  if (!/^sk_(live|test)_[a-f0-9]{20,}$/i.test(header)) {
    return { error: "Invalid API key format", status: 401 };
  }

  const hash = createHash("sha256").update(header).digest("hex");
  const { supabaseAdmin } = await import("@/lib/supabase-admin.server");

  const { data, error } = await supabaseAdmin
    .from("api_keys")
    .select("id, merchant_id, environment, is_active")
    .eq("secret_hash", hash)
    .maybeSingle();

  if (error || !data) return { error: "Invalid API key", status: 401 };
  if (!data.is_active) return { error: "API key disabled", status: 401 };

  const ip = clientIp(request);

  // IP whitelist (if any entries exist for this merchant, enforce)
  const { data: whitelist } = await supabaseAdmin
    .from("ip_whitelist")
    .select("ip_address")
    .eq("merchant_id", data.merchant_id);
  if (whitelist && whitelist.length > 0) {
    const allowed = whitelist.some((w) => w.ip_address === ip);
    if (!allowed) return { error: "IP not whitelisted", status: 403 };
  }

  // Persistent per-key rate limit (Postgres-backed, atomic)
  const { data: remaining, error: rlErr } = await supabaseAdmin.rpc("consume_rate_limit", {
    _key_id: data.id,
    _limit: RATE_LIMIT,
    _window_seconds: WINDOW_SECONDS,
  });
  if (rlErr) return { error: "Rate limiter unavailable", status: 500 };
  if ((remaining as number) < 0) {
    return { error: `Rate limit exceeded, retry in ${WINDOW_SECONDS}s`, status: 429 };
  }


  // Fire-and-forget last_used_at + audit
  supabaseAdmin
    .from("api_keys")
    .update({ last_used_at: new Date().toISOString() })
    .eq("id", data.id)
    .then(() => undefined);

  supabaseAdmin
    .from("audit_logs")
    .insert({
      actor_id: data.merchant_id,
      action: "api.request",
      resource: "api_key",
      resource_id: data.id,
      ip_address: ip,
      user_agent: request.headers.get("user-agent"),
      metadata: { path: new URL(request.url).pathname, method: request.method } as never,
    })
    .then(() => undefined);

  return {
    merchantId: data.merchant_id,
    environment: data.environment,
    keyId: data.id,
    ip,
  };
}

export const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Api-Key, Idempotency-Key",
  "Access-Control-Max-Age": "86400",
} as const;

export function jsonResponse(body: unknown, status = 200, extra: HeadersInit = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "content-type": "application/json",
      ...CORS_HEADERS,
      ...extra,
    },
  });
}
