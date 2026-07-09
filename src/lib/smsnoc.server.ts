// Server-only SMS NOC (smsnoc.com) provider client.
// Supports SMS, Email, WhatsApp, Voice via a single Bearer-token REST API.
// Never throws — returns a status object so the caller can log & continue.
//
// Docs: https://smsnoc.com/api-docs

const BASE_URL = "https://smsnoc.com/api/v1";

export type SmsNocResult = {
  status: "sent" | "failed" | "skipped";
  provider: "smsnoc";
  channel: "sms" | "email" | "whatsapp" | "voice";
  http_status?: number;
  provider_response?: unknown;
  error?: string | null;
};

type BaseArgs = { apiKey: string };

function normalizePhone(p: string): string {
  // SMS NOC auto-normalizes Bangladesh numbers; we just strip whitespace/dashes.
  return p.replace(/[\s\-()]/g, "");
}

async function call(
  apiKey: string,
  path: string,
  body: Record<string, unknown>,
  channel: SmsNocResult["channel"],
): Promise<SmsNocResult> {
  if (!apiKey) return { status: "skipped", provider: "smsnoc", channel, error: "no_api_key" };
  try {
    const res = await fetch(`${BASE_URL}${path}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify(body),
    });
    const text = await res.text();
    let parsed: unknown = text;
    try {
      parsed = JSON.parse(text);
    } catch {
      /* keep raw */
    }
    return {
      status: res.ok ? "sent" : "failed",
      provider: "smsnoc",
      channel,
      http_status: res.status,
      provider_response: parsed,
      error: res.ok ? null : `HTTP ${res.status}`,
    };
  } catch (e) {
    return {
      status: "failed",
      provider: "smsnoc",
      channel,
      error: (e as Error).message,
    };
  }
}

export async function sendSms(
  args: BaseArgs & { to: string; message: string; senderId?: string },
): Promise<SmsNocResult> {
  return call(
    args.apiKey,
    "/send-sms",
    {
      recipient: normalizePhone(args.to),
      sender_id: args.senderId,
      message: args.message,
    },
    "sms",
  );
}

export async function sendEmail(
  args: BaseArgs & {
    to: string;
    subject: string;
    body: string;
    html?: string;
    configId?: string;
    fromName?: string;
  },
): Promise<SmsNocResult> {
  return call(
    args.apiKey,
    "/send-email",
    {
      recipient: args.to,
      subject: args.subject,
      body: args.html ?? args.body,
      html: args.html ?? undefined,
      config_id: args.configId,
      from_name: args.fromName,
    },
    "email",
  );
}

export async function sendWhatsApp(
  args: BaseArgs & { to: string; message: string; deviceId?: string },
): Promise<SmsNocResult> {
  return call(
    args.apiKey,
    "/send-whatsapp",
    {
      recipient: normalizePhone(args.to),
      device_id: args.deviceId,
      message: args.message,
    },
    "whatsapp",
  );
}

export async function sendVoice(
  args: BaseArgs & { to: string; message: string; callerId?: string },
): Promise<SmsNocResult> {
  return call(
    args.apiKey,
    "/send-voice",
    {
      recipient: normalizePhone(args.to),
      caller_id: args.callerId,
      message: args.message,
    },
    "voice",
  );
}

// -------- Config loaders --------

export type PlatformSmsNocConfig = {
  enabled: boolean;
  api_key: string;
  sender_id: string;
  whatsapp_device_id: string;
  email_config_id: string;
  channel_sms: boolean;
  channel_email: boolean;
  channel_whatsapp: boolean;
  channel_voice: boolean;
  events: Record<string, boolean>;
  templates: Record<string, string>;
};

export const DEFAULT_PLATFORM_SMSNOC: PlatformSmsNocConfig = {
  enabled: false,
  api_key: "",
  sender_id: "",
  whatsapp_device_id: "",
  email_config_id: "",
  channel_sms: true,
  channel_email: true,
  channel_whatsapp: false,
  channel_voice: false,
  events: {
    user_registered: true,
    password_reset: true,
    package_purchased: true,
    subscription_renewed: true,
    subscription_expiring: true,
    subscription_expired: true,
    payment_received: false,
  },
  templates: {
    user_registered: "Hi {{name}}, welcome to {{brand}}! Your account is ready.",
    password_reset:
      "Hi {{name}}, use this link to reset your {{brand}} password: {{reset_link}}",
    package_purchased:
      "Thanks {{name}}! Your {{package_name}} plan is active until {{expires_at}}.",
    subscription_renewed:
      "Your {{brand}} {{package_name}} plan has been renewed. Next renewal: {{expires_at}}.",
    subscription_expiring:
      "Reminder: your {{brand}} {{package_name}} plan expires on {{expires_at}}. Renew to stay active.",
    subscription_expired:
      "Your {{brand}} {{package_name}} plan has expired. Renew any time from your dashboard.",
    payment_received:
      "Payment received: {{currency}} {{amount}} for invoice {{invoice_number}}.",
  },
};

export async function loadPlatformSmsNoc(): Promise<PlatformSmsNocConfig> {
  const { supabaseAdmin } = await import("@/lib/supabase-admin.server");
  const { data } = await supabaseAdmin
    .from("platform_settings")
    .select("settings, brand_name")
    .order("id")
    .limit(1)
    .maybeSingle();
  const s = ((data?.settings ?? {}) as { smsnoc?: Partial<PlatformSmsNocConfig> }).smsnoc ?? {};
  return {
    ...DEFAULT_PLATFORM_SMSNOC,
    ...s,
    events: { ...DEFAULT_PLATFORM_SMSNOC.events, ...(s.events ?? {}) },
    templates: { ...DEFAULT_PLATFORM_SMSNOC.templates, ...(s.templates ?? {}) },
  };
}

export async function loadPlatformBrandName(): Promise<string> {
  const { supabaseAdmin } = await import("@/lib/supabase-admin.server");
  const { data } = await supabaseAdmin
    .from("platform_settings")
    .select("brand_name")
    .order("id")
    .limit(1)
    .maybeSingle();
  return (data?.brand_name as string) || "PayNOC";
}

export function renderTemplate(
  tpl: string,
  vars: Record<string, string | number | undefined | null>,
): string {
  return tpl.replace(/\{\{\s*([\w.]+)\s*\}\}/g, (_, k: string) => {
    const v = vars[k];
    return v === undefined || v === null ? "" : String(v);
  });
}

// -------- Platform-level notification dispatcher --------
// Used for events NOT tied to a merchant (auth signup, password reset, cron subscription events for a specific user).
export async function notifyPlatform(args: {
  event: keyof PlatformSmsNocConfig["events"] | string;
  recipient: { name?: string; email?: string; phone?: string; whatsapp?: string };
  vars?: Record<string, string | number | undefined | null>;
  subject?: string;
  // If provided, overrides the template — otherwise render templates[event].
  bodyOverride?: string;
}) {
  try {
    const cfg = await loadPlatformSmsNoc();
    if (!cfg.enabled || !cfg.api_key) return { skipped: "disabled" };
    if (cfg.events[args.event] === false) return { skipped: "event_off" };

    const brand = await loadPlatformBrandName();
    const vars = {
      brand,
      name: args.recipient.name ?? "",
      email: args.recipient.email ?? "",
      phone: args.recipient.phone ?? "",
      ...(args.vars ?? {}),
    };
    const tpl = cfg.templates[args.event] ?? "";
    const message = args.bodyOverride ?? renderTemplate(tpl, vars);
    if (!message.trim()) return { skipped: "empty_template" };

    const { supabaseAdmin } = await import("@/lib/supabase-admin.server");
    const results: SmsNocResult[] = [];

    if (cfg.channel_sms && args.recipient.phone) {
      const r = await sendSms({
        apiKey: cfg.api_key,
        to: args.recipient.phone,
        message,
        senderId: cfg.sender_id || undefined,
      });
      results.push(r);
      await supabaseAdmin.from("notification_log").insert({
        merchant_id: null as never,
        channel: "sms",
        event: args.event,
        recipient: args.recipient.phone,
        body: message,
        status: r.status,
        provider: "smsnoc",
        provider_response: r.provider_response as never,
        error: r.error ?? null,
      } as never);
    }

    if (cfg.channel_email && args.recipient.email) {
      const subject = args.subject ?? `${brand} · ${String(args.event).replace(/_/g, " ")}`;
      const html = `<div style="font-family:system-ui,sans-serif;max-width:560px;margin:0 auto;padding:24px">
        <h2 style="margin:0 0 12px">${subject}</h2>
        <p style="color:#334;line-height:1.5">${message.replace(/\n/g, "<br/>")}</p>
        <p style="color:#888;font-size:12px;margin-top:24px">— ${brand}</p>
      </div>`;
      const r = await sendEmail({
        apiKey: cfg.api_key,
        to: args.recipient.email,
        subject,
        body: message,
        html,
        configId: cfg.email_config_id || undefined,
        fromName: brand,
      });
      results.push(r);
      await supabaseAdmin.from("notification_log").insert({
        merchant_id: null as never,
        channel: "email",
        event: args.event,
        recipient: args.recipient.email,
        subject,
        body: message,
        status: r.status,
        provider: "smsnoc",
        provider_response: r.provider_response as never,
        error: r.error ?? null,
      } as never);
    }

    if (cfg.channel_whatsapp && (args.recipient.whatsapp || args.recipient.phone)) {
      const to = args.recipient.whatsapp || args.recipient.phone!;
      const r = await sendWhatsApp({
        apiKey: cfg.api_key,
        to,
        message,
        deviceId: cfg.whatsapp_device_id || undefined,
      });
      results.push(r);
      await supabaseAdmin.from("notification_log").insert({
        merchant_id: null as never,
        channel: "whatsapp",
        event: args.event,
        recipient: to,
        body: message,
        status: r.status,
        provider: "smsnoc",
        provider_response: r.provider_response as never,
        error: r.error ?? null,
      } as never);
    }

    if (cfg.channel_voice && args.recipient.phone) {
      const r = await sendVoice({ apiKey: cfg.api_key, to: args.recipient.phone, message });
      results.push(r);
      await supabaseAdmin.from("notification_log").insert({
        merchant_id: null as never,
        channel: "voice",
        event: args.event,
        recipient: args.recipient.phone,
        body: message,
        status: r.status,
        provider: "smsnoc",
        provider_response: r.provider_response as never,
        error: r.error ?? null,
      } as never);
    }

    return { results };
  } catch (e) {
    console.error("[smsnoc] notifyPlatform failed:", e);
    return { error: (e as Error).message };
  }
}

// -------- Merchant-level dispatcher (used from notify() in notifications.server.ts) --------
export type MerchantSmsNocRow = {
  merchant_id: string;
  enabled: boolean;
  api_key: string | null;
  sender_id: string | null;
  whatsapp_device_id: string | null;
  email_config_id: string | null;
  channel_sms: boolean;
  channel_email: boolean;
  channel_whatsapp: boolean;
  channel_voice: boolean;
  notify_on_invoice_created: boolean;
  notify_on_payment_received: boolean;
  notify_on_refund: boolean;
  notify_phone: string | null;
  notify_email: string | null;
  notify_whatsapp: string | null;
  templates: Record<string, string>;
};

const MERCHANT_EVENT_TOGGLE: Record<string, keyof MerchantSmsNocRow | null> = {
  "invoice.created": "notify_on_invoice_created",
  "invoice.completed": "notify_on_payment_received",
  "payment.received": "notify_on_payment_received",
  "refund.processed": "notify_on_refund",
  "refund.approved": "notify_on_refund",
  "refund.rejected": "notify_on_refund",
};

export async function loadMerchantSmsNoc(merchantId: string): Promise<MerchantSmsNocRow | null> {
  const { supabaseAdmin } = await import("@/lib/supabase-admin.server");
  const { data } = await supabaseAdmin
    .from("merchant_smsnoc_configs")
    .select("*")
    .eq("merchant_id", merchantId)
    .maybeSingle();
  return (data as MerchantSmsNocRow | null) ?? null;
}

export async function notifyMerchantViaSmsNoc(args: {
  merchantId: string;
  event: string;
  title: string;
  body: string;
  fallback: { phone?: string | null; email?: string | null };
}): Promise<{ dispatched: boolean; results?: SmsNocResult[] }> {
  try {
    const cfg = await loadMerchantSmsNoc(args.merchantId);
    if (!cfg || !cfg.enabled || !cfg.api_key) return { dispatched: false };

    const toggle = MERCHANT_EVENT_TOGGLE[args.event];
    if (toggle && cfg[toggle] === false) return { dispatched: false };

    const message = `${args.title}\n${args.body}`.trim();
    const { supabaseAdmin } = await import("@/lib/supabase-admin.server");
    const results: SmsNocResult[] = [];

    if (cfg.channel_sms) {
      const to = cfg.notify_phone || args.fallback.phone || "";
      if (to) {
        const r = await sendSms({
          apiKey: cfg.api_key,
          to,
          message: message.slice(0, 300),
          senderId: cfg.sender_id || undefined,
        });
        results.push(r);
        await supabaseAdmin.from("notification_log").insert({
          merchant_id: args.merchantId,
          channel: "sms",
          event: args.event,
          recipient: to,
          body: message,
          status: r.status,
          provider: "smsnoc",
          provider_response: r.provider_response as never,
          error: r.error ?? null,
        } as never);
      }
    }

    if (cfg.channel_email) {
      const to = cfg.notify_email || args.fallback.email || "";
      if (to) {
        const html = `<div style="font-family:system-ui,sans-serif;max-width:560px;margin:0 auto;padding:24px"><h2 style="margin:0 0 12px">${args.title}</h2><p style="color:#334;line-height:1.5">${args.body.replace(/\n/g, "<br/>")}</p></div>`;
        const r = await sendEmail({
          apiKey: cfg.api_key,
          to,
          subject: args.title,
          body: args.body,
          html,
          configId: cfg.email_config_id || undefined,
        });
        results.push(r);
        await supabaseAdmin.from("notification_log").insert({
          merchant_id: args.merchantId,
          channel: "email",
          event: args.event,
          recipient: to,
          subject: args.title,
          body: args.body,
          status: r.status,
          provider: "smsnoc",
          provider_response: r.provider_response as never,
          error: r.error ?? null,
        } as never);
      }
    }

    if (cfg.channel_whatsapp) {
      const to = cfg.notify_whatsapp || cfg.notify_phone || args.fallback.phone || "";
      if (to) {
        const r = await sendWhatsApp({
          apiKey: cfg.api_key,
          to,
          message,
          deviceId: cfg.whatsapp_device_id || undefined,
        });
        results.push(r);
        await supabaseAdmin.from("notification_log").insert({
          merchant_id: args.merchantId,
          channel: "whatsapp",
          event: args.event,
          recipient: to,
          body: message,
          status: r.status,
          provider: "smsnoc",
          provider_response: r.provider_response as never,
          error: r.error ?? null,
        } as never);
      }
    }

    if (cfg.channel_voice) {
      const to = cfg.notify_phone || args.fallback.phone || "";
      if (to) {
        const r = await sendVoice({ apiKey: cfg.api_key, to, message });
        results.push(r);
        await supabaseAdmin.from("notification_log").insert({
          merchant_id: args.merchantId,
          channel: "voice",
          event: args.event,
          recipient: to,
          body: message,
          status: r.status,
          provider: "smsnoc",
          provider_response: r.provider_response as never,
          error: r.error ?? null,
        } as never);
      }
    }

    return { dispatched: true, results };
  } catch (e) {
    console.error("[smsnoc] notifyMerchantViaSmsNoc failed:", e);
    return { dispatched: false };
  }
}
