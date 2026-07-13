export type TurnstileSettings = {
  enabled?: boolean;
  site_key?: string;
  secret_key?: string;
};

async function readDbTurnstile(): Promise<TurnstileSettings> {
  try {
    const { supabaseAdmin } = await import("@/lib/supabase-admin.server");
    const { data } = await supabaseAdmin
      .from("platform_settings")
      .select("settings")
      .order("id")
      .limit(1)
      .maybeSingle();
    const s = (data?.settings ?? {}) as { turnstile?: TurnstileSettings };
    return s.turnstile ?? {};
  } catch (e) {
    console.error("[turnstile] readDbTurnstile failed:", e);
    return {};
  }
}

function envTurnstile(): TurnstileSettings {
  const site = process.env.TURNSTILE_SITE_KEY || process.env.VITE_TURNSTILE_SITE_KEY || "";
  const secret = process.env.TURNSTILE_SECRET_KEY || "";
  return {
    enabled: !!(site && secret),
    site_key: site,
    secret_key: secret,
  };
}

export async function resolveTurnstile(): Promise<TurnstileSettings> {
  const db = await readDbTurnstile();
  const env = envTurnstile();
  return {
    enabled: db.enabled ?? env.enabled,
    site_key: db.site_key || env.site_key || "",
    secret_key: db.secret_key || env.secret_key || "",
  };
}