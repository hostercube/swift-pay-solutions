import { createHash } from "crypto";

// In-memory rate limit (per-worker). Best-effort: not a distributed limiter.
const RATE_LIMIT = 120; // requests per window
const WINDOW_MS = 60_000;
const buckets = new Map<string, { count: number; reset: number }>();

function rateLimit(keyId: string) {
  const now = Date.now();
  const b = buckets.get(keyId);
  if (!b || b.reset < now) {
    buckets.set(keyId, { count: 1, reset: now + WINDOW_MS });
    return { ok: true, remaining: RATE_LIMIT - 1 };
  }
  b.count += 1;
  if (b.count > RATE_LIMIT) return { ok: false, remaining: 0, retryAfter: Math.ceil((b.reset - now) / 1000) };
  return { ok: true, remaining: RATE_LIMIT - b.count };
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
  | { merchantId: string; environment: string; keyId: string; ip: string | null }
  | { error: string; status: number }
> {
  const header =
    request.headers.get("authorization")?.replace(/^Bearer\s+/i, "").trim() ||
    request.headers.get("x-api-key")?.trim();

  if (!header) return { error: "Missing API key", status: 401 };
  if (!/^sk_(live|test)_[a-f0-9]{20,}$/i.test(header)) {
    return { error: "Invalid API key format", status: 401 };
  }

  const hash = createHash("sha256").update(header).digest("hex");
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

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

  // Rate limit per key
  const rl = rateLimit(data.id);
  if (!rl.ok) {
    return { error: `Rate limit exceeded, retry in ${rl.retryAfter}s`, status: 429 };
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
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Api-Key",
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
