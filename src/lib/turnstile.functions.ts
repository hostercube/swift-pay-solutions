import { createServerFn } from "@tanstack/react-start";

type TurnstileSettings = {
  enabled?: boolean;
  site_key?: string;
  secret_key?: string;
};

async function loadSettings(): Promise<TurnstileSettings> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data } = await supabaseAdmin
    .from("platform_settings")
    .select("settings")
    .order("id")
    .limit(1)
    .maybeSingle();
  const s = (data?.settings ?? {}) as { turnstile?: TurnstileSettings };
  return s.turnstile ?? {};
}

export const getTurnstileConfig = createServerFn({ method: "GET" }).handler(async () => {
  const t = await loadSettings();
  return { enabled: !!t.enabled && !!t.site_key, siteKey: t.site_key ?? "" };
});

export const verifyTurnstile = createServerFn({ method: "POST" })
  .inputValidator((d: { token: string }) => d)
  .handler(async ({ data }) => {
    const t = await loadSettings();
    if (!t.enabled) return { ok: true };
    if (!t.secret_key) return { ok: false, error: "Turnstile not configured" };
    if (!data.token) return { ok: false, error: "Missing captcha token" };
    const body = new URLSearchParams();
    body.set("secret", t.secret_key);
    body.set("response", data.token);
    const res = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
      method: "POST",
      body,
    });
    const j = (await res.json()) as { success: boolean; "error-codes"?: string[] };
    return { ok: !!j.success, error: j.success ? undefined : (j["error-codes"] ?? []).join(",") };
  });
