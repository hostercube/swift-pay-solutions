import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import {
  DEFAULT_PLATFORM_SMSNOC,
  loadPlatformSmsNoc,
  loadPlatformBrandName,
  type PlatformSmsNocConfig,
  sendSms,
  sendEmail,
  sendWhatsApp,
  sendVoice,
  renderTemplate,
} from "@/lib/smsnoc.server";

function serializeResult(r: {
  status: string;
  channel: string;
  http_status?: number;
  provider_response?: unknown;
  error?: string | null;
}) {
  return {
    status: r.status,
    channel: r.channel,
    http_status: r.http_status ?? null,
    provider_response: (() => {
      try {
        return typeof r.provider_response === "string"
          ? r.provider_response
          : JSON.stringify(r.provider_response ?? null);
      } catch {
        return String(r.provider_response ?? "");
      }
    })(),
    error: r.error ?? null,
  };
}

// ---------- Platform (super-admin) config ----------

export const getPlatformSmsNocConfig = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { data: roles } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", userId)
      .in("role", ["super_admin", "admin"]);
    if (!roles || roles.length === 0) throw new Error("Forbidden");
    const cfg = await loadPlatformSmsNoc();
    return cfg;
  });

export const savePlatformSmsNocConfig = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: Partial<PlatformSmsNocConfig>) => d)
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: roles } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", userId)
      .in("role", ["super_admin", "admin"]);
    if (!roles || roles.length === 0) throw new Error("Forbidden");

    const merged: PlatformSmsNocConfig = {
      ...DEFAULT_PLATFORM_SMSNOC,
      ...(await loadPlatformSmsNoc()),
      ...data,
      events: { ...DEFAULT_PLATFORM_SMSNOC.events, ...(data.events ?? {}) },
      templates: { ...DEFAULT_PLATFORM_SMSNOC.templates, ...(data.templates ?? {}) },
    };

    const { supabaseAdmin } = await import("@/lib/supabase-admin.server");
    const { data: row } = await supabaseAdmin
      .from("platform_settings")
      .select("id, settings")
      .order("id")
      .limit(1)
      .maybeSingle();

    if (row?.id) {
      const current = (row.settings ?? {}) as Record<string, unknown>;
      const nextSettings = { ...current, smsnoc: merged };
      const { error } = await supabaseAdmin
        .from("platform_settings")
        .update({ settings: nextSettings })
        .eq("id", row.id);
      if (error) throw new Error(error.message);
    } else {
      const { error } = await supabaseAdmin
        .from("platform_settings")
        .insert({ settings: { smsnoc: merged } });
      if (error) throw new Error(error.message);
    }
    return { ok: true, config: merged };
  });

export const sendPlatformSmsNocTest = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (d: {
      channel: "sms" | "email" | "whatsapp" | "voice";
      to: string;
      message?: string;
    }) => d,
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: roles } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", userId)
      .in("role", ["super_admin", "admin"]);
    if (!roles || roles.length === 0) throw new Error("Forbidden");
    const cfg = await loadPlatformSmsNoc();
    if (!cfg.api_key) throw new Error("Platform SMS NOC API key is not configured");
    const brand = await loadPlatformBrandName();
    const message = data.message || `Test message from ${brand} via SMS NOC.`;
    let result;
    if (data.channel === "sms")
      result = await sendSms({
        apiKey: cfg.api_key,
        to: data.to,
        message,
        senderId: cfg.sender_id || undefined,
      });
    else if (data.channel === "email")
      result = await sendEmail({
        apiKey: cfg.api_key,
        to: data.to,
        subject: `${brand} · SMS NOC test`,
        body: message,
        html: `<p>${message}</p>`,
        configId: cfg.email_config_id || undefined,
        fromName: brand,
      });
    else if (data.channel === "whatsapp")
      result = await sendWhatsApp({
        apiKey: cfg.api_key,
        to: data.to,
        message,
        deviceId: cfg.whatsapp_device_id || undefined,
      });
    else
      result = await sendVoice({ apiKey: cfg.api_key, to: data.to, message });
    return serializeResult(result);
  });

// ---------- Merchant config ----------

export const getMerchantSmsNocConfig = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { data } = await supabase
      .from("merchant_smsnoc_configs")
      .select("*")
      .eq("merchant_id", userId)
      .maybeSingle();
    return data ?? null;
  });

export const saveMerchantSmsNocConfig = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (d: {
      enabled: boolean;
      api_key: string;
      sender_id?: string;
      whatsapp_device_id?: string;
      email_config_id?: string;
      channel_sms: boolean;
      channel_email: boolean;
      channel_whatsapp: boolean;
      channel_voice: boolean;
      notify_on_invoice_created: boolean;
      notify_on_payment_received: boolean;
      notify_on_refund: boolean;
      notify_phone?: string;
      notify_email?: string;
      notify_whatsapp?: string;
    }) => d,
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const payload = {
      merchant_id: userId,
      enabled: !!data.enabled,
      api_key: data.api_key?.trim() || null,
      sender_id: data.sender_id?.trim() || null,
      whatsapp_device_id: data.whatsapp_device_id?.trim() || null,
      email_config_id: data.email_config_id?.trim() || null,
      channel_sms: !!data.channel_sms,
      channel_email: !!data.channel_email,
      channel_whatsapp: !!data.channel_whatsapp,
      channel_voice: !!data.channel_voice,
      notify_on_invoice_created: !!data.notify_on_invoice_created,
      notify_on_payment_received: !!data.notify_on_payment_received,
      notify_on_refund: !!data.notify_on_refund,
      notify_phone: data.notify_phone?.trim() || null,
      notify_email: data.notify_email?.trim() || null,
      notify_whatsapp: data.notify_whatsapp?.trim() || null,
    };
    const { error } = await supabase
      .from("merchant_smsnoc_configs")
      .upsert(payload, { onConflict: "merchant_id" });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const sendMerchantSmsNocTest = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (d: {
      channel: "sms" | "email" | "whatsapp" | "voice";
      to: string;
      message?: string;
    }) => d,
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: cfg } = await supabase
      .from("merchant_smsnoc_configs")
      .select("*")
      .eq("merchant_id", userId)
      .maybeSingle();
    if (!cfg || !cfg.api_key) throw new Error("Configure your SMS NOC API key first");
    const brand = await loadPlatformBrandName();
    const message = data.message || `Test message via ${brand}/SMS NOC.`;
    let result;
    if (data.channel === "sms")
      result = await sendSms({
        apiKey: cfg.api_key,
        to: data.to,
        message,
        senderId: (cfg.sender_id as string) || undefined,
      });
    else if (data.channel === "email")
      result = await sendEmail({
        apiKey: cfg.api_key,
        to: data.to,
        subject: `${brand} · Test`,
        body: message,
        html: `<p>${message}</p>`,
        configId: (cfg.email_config_id as string) || undefined,
      });
    else if (data.channel === "whatsapp")
      result = await sendWhatsApp({
        apiKey: cfg.api_key,
        to: data.to,
        message,
        deviceId: (cfg.whatsapp_device_id as string) || undefined,
      });
    else result = await sendVoice({ apiKey: cfg.api_key, to: data.to, message });
    return serializeResult(result);
  });

// ---------- Public platform-level triggers (called from public pages after auth actions) ----------

export const smsNocNotifyUserRegistered = createServerFn({ method: "POST" })
  .inputValidator((d: { email: string; name?: string; phone?: string }) => d)
  .handler(async ({ data }) => {
    const { notifyPlatform } = await import("@/lib/smsnoc.server");
    await notifyPlatform({
      event: "user_registered",
      recipient: { email: data.email, name: data.name, phone: data.phone },
      vars: { name: data.name ?? "", email: data.email },
    });
    return { ok: true };
  });

export const smsNocNotifyPasswordReset = createServerFn({ method: "POST" })
  .inputValidator((d: { email: string; resetLink: string; name?: string; phone?: string }) => d)
  .handler(async ({ data }) => {
    const { notifyPlatform } = await import("@/lib/smsnoc.server");
    await notifyPlatform({
      event: "password_reset",
      recipient: { email: data.email, name: data.name, phone: data.phone },
      vars: { name: data.name ?? "", reset_link: data.resetLink },
      subject: "Password reset",
    });
    return { ok: true };
  });

// Silences unused import lint
void assertSuperAdminOrPlatformStaff;
void renderTemplate;
