import { createHash } from "crypto";

/**
 * Look up an API key by its secret (Authorization: Bearer sk_... or x-api-key).
 * Returns the merchant_id + environment when the key is active, else null.
 */
export async function authenticateApiKey(request: Request): Promise<
  | { merchantId: string; environment: string; keyId: string }
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

  // Fire-and-forget last_used_at update
  supabaseAdmin
    .from("api_keys")
    .update({ last_used_at: new Date().toISOString() })
    .eq("id", data.id)
    .then(() => undefined);

  return {
    merchantId: data.merchant_id,
    environment: data.environment,
    keyId: data.id,
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
