// Server-only notifications dispatcher. Writes in-app notifications, and
// (best-effort) sends Email via Resend + SMS via GatewayAPI when secrets exist.
// Never throws — notification failures must not break payment flow.

import { supabaseAdmin } from "@/lib/supabase-admin.server";

type NotifyInput = {
  merchantId: string;
  event: string;
  title: string;
  body?: string;
  metadata?: Record<string, unknown>;
};

async function loadSettings(merchantId: string) {
  const { data } = await supabaseAdmin
    .from("notification_settings")
    .select("*")
    .eq("merchant_id", merchantId)
    .maybeSingle();
  return data;
}

async function loadProfile(merchantId: string) {
  const { data } = await supabaseAdmin
    .from("profiles")
    .select("email, phone, business_name, full_name")
    .eq("id", merchantId)
    .maybeSingle();
  return data;
}

async function sendEmail(to: string, subject: string, body: string) {
  const key = process.env.RESEND_API_KEY;
  const lovableKey = process.env.LOVABLE_API_KEY;
  if (!key || !lovableKey) return { status: "skipped", provider: "resend", error: "no_key" };
  try {
    const res = await fetch("https://connector-gateway.lovable.dev/resend/emails", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${lovableKey}`,
        "X-Connection-Api-Key": key,
      },
      body: JSON.stringify({
        from: "PayNOC <onboarding@resend.dev>",
        to: [to],
        subject,
        html: `<div style="font-family:system-ui,sans-serif;max-width:560px;margin:0 auto;padding:24px"><h2 style="margin:0 0 12px">${subject}</h2><p style="color:#334;line-height:1.5">${body.replace(/\n/g, "<br/>")}</p><p style="color:#888;font-size:12px;margin-top:24px">— PayNOC</p></div>`,
      }),
    });
    const json = await res.json().catch(() => ({}));
    return {
      status: res.ok ? "sent" : "failed",
      provider: "resend",
      provider_response: json,
      error: res.ok ? null : `HTTP ${res.status}`,
    };
  } catch (e) {
    return { status: "failed", provider: "resend", error: (e as Error).message };
  }
}

async function sendSms(to: string, body: string) {
  const key = process.env.GATEWAYAPI_API_KEY;
  const lovableKey = process.env.LOVABLE_API_KEY;
  if (!key || !lovableKey) return { status: "skipped", provider: "gatewayapi", error: "no_key" };
  try {
    const recipient = Number(to.replace(/\D/g, ""));
    const res = await fetch("https://connector-gateway.lovable.dev/gatewayapi/mobile/single", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${lovableKey}`,
        "X-Connection-Api-Key": key,
      },
      body: JSON.stringify({ sender: "PayNOC", recipient, message: body }),
    });
    const json = await res.json().catch(() => ({}));
    return {
      status: res.ok ? "sent" : "failed",
      provider: "gatewayapi",
      provider_response: json,
      error: res.ok ? null : `HTTP ${res.status}`,
    };
  } catch (e) {
    return { status: "failed", provider: "gatewayapi", error: (e as Error).message };
  }
}

export async function notify(input: NotifyInput) {
  const { merchantId, event, title, body = "", metadata = {} } = input;

  // Route through SMS NOC when the merchant has enabled it. Best-effort.
  try {
    const { notifyMerchantViaSmsNoc } = await import("@/lib/smsnoc.server");
    const profileForFallback = await loadProfile(merchantId);
    await notifyMerchantViaSmsNoc({
      merchantId,
      event,
      title,
      body,
      fallback: { phone: profileForFallback?.phone, email: profileForFallback?.email },
    });
  } catch {
    /* swallow */
  }

  try {
    const [settings, profile] = await Promise.all([
      loadSettings(merchantId),
      loadProfile(merchantId),
    ]);

    const events = (settings?.events as Record<string, boolean> | undefined) ?? {};
    const eventOn = events[event] !== false;

    // In-app (default on)
    if (eventOn && (settings?.inapp_enabled ?? true)) {
      await supabaseAdmin.from("notifications").insert({
        merchant_id: merchantId,
        event,
        title,
        body,
        metadata: metadata as never,
      });
    }

    // Email
    if (eventOn && (settings?.email_enabled ?? true)) {
      const to = settings?.notify_email || profile?.email;
      if (to) {
        const r = await sendEmail(to, title, body);
        await supabaseAdmin.from("notification_log").insert({
          merchant_id: merchantId,
          channel: "email",
          event,
          recipient: to,
          subject: title,
          body,
          ...r,
        });
      }
    }

    // SMS
    if (eventOn && settings?.sms_enabled) {
      const to = settings?.notify_phone || profile?.phone;
      if (to) {
        const r = await sendSms(to, `${title}\n${body}`.slice(0, 300));
        await supabaseAdmin.from("notification_log").insert({
          merchant_id: merchantId,
          channel: "sms",
          event,
          recipient: to,
          body,
          ...r,
        });
      }
    }

    // Slack / Discord (best-effort, silent)
    const slackUrl = (settings as { slack_webhook_url?: string } | null)?.slack_webhook_url;
    const discordUrl = (settings as { discord_webhook_url?: string } | null)?.discord_webhook_url;
    if (eventOn && (slackUrl || discordUrl)) {
      const { sendSlack, sendDiscord } = await import("@/lib/webhook-alerts.server");
      if (slackUrl) {
        await sendSlack(slackUrl, title, body);
        await supabaseAdmin.from("notification_log").insert({
          merchant_id: merchantId, channel: "slack", event, recipient: "slack-webhook",
          subject: title, body, status: "sent", provider: "slack",
        } as never);
      }
      if (discordUrl) {
        await sendDiscord(discordUrl, title, body);
        await supabaseAdmin.from("notification_log").insert({
          merchant_id: merchantId, channel: "discord", event, recipient: "discord-webhook",
          subject: title, body, status: "sent", provider: "discord",
        } as never);
      }
    }
  } catch {
    // swallow — notifications must never break the caller
  }
}
