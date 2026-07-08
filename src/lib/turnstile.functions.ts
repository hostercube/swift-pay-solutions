import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

type TurnstileSettings = {
  enabled?: boolean;
  site_key?: string;
  secret_key?: string;
};

export const getTurnstileConfig = createServerFn({ method: "GET" }).handler(async () => {
  const { supabaseAdmin } = await import("@/lib/supabase-admin.server");
  const { data } = await supabaseAdmin
    .from("platform_settings")
    .select("settings")
    .order("id")
    .limit(1)
    .maybeSingle();
  const s = (data?.settings ?? {}) as { turnstile?: TurnstileSettings };
  const t = s.turnstile ?? {};
  return { enabled: !!t.enabled && !!t.site_key, siteKey: t.site_key ?? "" };
});

export const verifyTurnstile = createServerFn({ method: "POST" })
  .inputValidator((d: { token: string }) => d)
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/lib/supabase-admin.server");
    const { data: row } = await supabaseAdmin
      .from("platform_settings")
      .select("settings")
      .order("id")
      .limit(1)
      .maybeSingle();
    const s = (row?.settings ?? {}) as { turnstile?: TurnstileSettings };
    const t = s.turnstile ?? {};
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

export const saveTurnstileConfig = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { enabled: boolean; site_key: string; secret_key: string }) => d)
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: roles } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", userId)
      .in("role", ["super_admin", "admin"]);
    if (!roles || roles.length === 0) throw new Error("Forbidden");

    const { supabaseAdmin } = await import("@/lib/supabase-admin.server");
    const { data: row } = await supabaseAdmin
      .from("platform_settings")
      .select("id, settings")
      .order("id")
      .limit(1)
      .maybeSingle();
    const id = row?.id ?? 1;
    const current = (row?.settings ?? {}) as Record<string, unknown>;
    const nextSettings = {
      ...current,
      turnstile: {
        enabled: !!data.enabled,
        site_key: (data.site_key ?? "").trim(),
        secret_key: (data.secret_key ?? "").trim(),
      },
    };
    const { error } = await supabaseAdmin
      .from("platform_settings")
      .update({ settings: nextSettings })
      .eq("id", id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
