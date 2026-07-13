import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

type TurnstileSettings = {
  enabled?: boolean;
  site_key?: string;
  secret_key?: string;
};

export const getTurnstileConfig = createServerFn({ method: "GET" }).handler(async () => {
  const { resolveTurnstile } = await import("@/lib/turnstile.server");
  const t = await resolveTurnstile();
  const siteKey = (t.site_key ?? "").trim();
  // Show captcha whenever a site key is configured AND enabled is true (or unset with env fallback).
  const enabled = !!t.enabled && !!siteKey;
  return { enabled, siteKey };
});

export const verifyTurnstile = createServerFn({ method: "POST" })
  .inputValidator((d: { token: string }) => d)
  .handler(async ({ data }) => {
    const { resolveTurnstile } = await import("@/lib/turnstile.server");
    const t = await resolveTurnstile();
    if (!t.enabled) return { ok: true };
    const secret = (t.secret_key ?? "").trim();
    if (!secret) return { ok: false, error: "Turnstile secret not configured" };
    if (!data.token) return { ok: false, error: "Missing captcha token" };
    const body = new URLSearchParams();
    body.set("secret", secret);
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

    const nextTurnstile = {
      enabled: !!data.enabled,
      site_key: (data.site_key ?? "").trim(),
      secret_key: (data.secret_key ?? "").trim(),
    };

    if (row?.id) {
      const current = (row.settings ?? {}) as Record<string, unknown>;
      const nextSettings = { ...current, turnstile: nextTurnstile };
      const { data: updated, error } = await supabaseAdmin
        .from("platform_settings")
        .update({ settings: nextSettings })
        .eq("id", row.id)
        .select("id");
      if (error) throw new Error(error.message);
      if (!updated || updated.length === 0) {
        throw new Error("Turnstile save affected 0 rows");
      }
    } else {
      // No row yet — insert one so the config actually persists.
      const { error } = await supabaseAdmin
        .from("platform_settings")
        .insert({ settings: { turnstile: nextTurnstile } });
      if (error) throw new Error(error.message);
    }
    return { ok: true, ...nextTurnstile };
  });
