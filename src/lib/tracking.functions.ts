import { createServerFn } from "@tanstack/react-start";
import { createHash } from "crypto";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const sha256 = (v: string | null | undefined) =>
  v ? createHash("sha256").update(v.trim().toLowerCase()).digest("hex") : undefined;

/**
 * Send a Purchase event to Meta's Conversion API for a merchant.
 * Called server-side (webhook / payment completion path).
 */
export const sendMetaCapiPurchase = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({
        merchantId: z.string().uuid(),
        eventId: z.string().min(1),
        value: z.number().nonnegative(),
        currency: z.string().min(3).max(8),
        email: z.string().email().optional(),
        phone: z.string().optional(),
        eventSourceUrl: z.string().url().optional(),
        clientIp: z.string().optional(),
        clientUserAgent: z.string().optional(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { data: cfg, error } = await context.supabase
      .from("profiles")
      .select("meta_pixel_id, meta_capi_token, meta_capi_test_code")
      .eq("id", data.merchantId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!cfg?.meta_pixel_id || !cfg.meta_capi_token) {
      return { skipped: true as const, reason: "not_configured" };
    }
    const url = new URL(
      `https://graph.facebook.com/v20.0/${cfg.meta_pixel_id}/events`,
    );
    url.searchParams.set("access_token", cfg.meta_capi_token);
    const payload = {
      data: [
        {
          event_name: "Purchase",
          event_time: Math.floor(Date.now() / 1000),
          event_id: data.eventId,
          action_source: "website",
          event_source_url: data.eventSourceUrl,
          user_data: {
            em: sha256(data.email),
            ph: sha256(data.phone?.replace(/\D+/g, "")),
            client_ip_address: data.clientIp,
            client_user_agent: data.clientUserAgent,
          },
          custom_data: {
            currency: data.currency,
            value: data.value,
          },
        },
      ],
      ...(cfg.meta_capi_test_code ? { test_event_code: cfg.meta_capi_test_code } : {}),
    };
    const res = await fetch(url.toString(), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const text = await res.text();
    if (!res.ok) {
      return { skipped: false as const, ok: false, status: res.status, body: text };
    }
    return { skipped: false as const, ok: true, status: res.status };
  });
