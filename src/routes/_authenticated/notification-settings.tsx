import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { MerchantShell } from "@/components/merchant-shell";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";

export const Route = createFileRoute("/_authenticated/notification-settings")({
  head: () => ({ meta: [{ title: "Notification settings · PayNOC" }] }),
  component: NotifSettingsPage,
});

const EVENTS: Array<{ key: string; label: string; desc: string }> = [
  { key: "invoice.completed", label: "Invoice completed", desc: "A payment was verified as successful." },
  { key: "invoice.failed", label: "Invoice failed", desc: "A payment attempt was rejected or expired." },
  { key: "webhook.failed", label: "Webhook failed", desc: "A webhook delivery to your server failed." },
  { key: "payout.processed", label: "Payout processed", desc: "A settlement/payout was processed." },
];

type Settings = {
  id?: string;
  email_enabled: boolean;
  sms_enabled: boolean;
  inapp_enabled: boolean;
  notify_email: string | null;
  notify_phone: string | null;
  slack_webhook_url: string | null;
  discord_webhook_url: string | null;
  events: Record<string, boolean>;
};

const DEFAULTS: Settings = {
  email_enabled: true,
  sms_enabled: false,
  inapp_enabled: true,
  notify_email: null,
  notify_phone: null,
  slack_webhook_url: null,
  discord_webhook_url: null,
  events: {
    "invoice.completed": true,
    "invoice.failed": true,
    "webhook.failed": true,
    "payout.processed": true,
  },
};

function NotifSettingsPage() {
  const { user } = useAuth();
  const [s, setS] = useState<Settings>(DEFAULTS);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!user) return;
    supabase
      .from("notification_settings")
      .select("*")
      .eq("merchant_id", user.id)
      .maybeSingle()
      .then(({ data }) => {
        if (data) {
          setS({
            id: data.id,
            email_enabled: data.email_enabled,
            sms_enabled: data.sms_enabled,
            inapp_enabled: data.inapp_enabled,
            notify_email: data.notify_email,
            notify_phone: data.notify_phone,
            events: (data.events as Record<string, boolean>) ?? DEFAULTS.events,
          });
        }
      });
  }, [user]);

  async function save() {
    if (!user) return;
    setSaving(true);
    const payload = {
      merchant_id: user.id,
      email_enabled: s.email_enabled,
      sms_enabled: s.sms_enabled,
      inapp_enabled: s.inapp_enabled,
      notify_email: s.notify_email,
      notify_phone: s.notify_phone,
      events: s.events,
    };
    const { error } = await supabase
      .from("notification_settings")
      .upsert(payload, { onConflict: "merchant_id" });
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success("Notification preferences saved");
  }

  return (
    <MerchantShell
      title="Notification settings"
      subtitle="Choose which events send you email, SMS or in-app alerts."
      actions={
        <Button onClick={save} disabled={saving}>
          {saving ? "Saving…" : "Save changes"}
        </Button>
      }
    >
      <div className="space-y-6">
        <section className="rounded-2xl border border-glass-border bg-card/40 p-6 backdrop-blur">
          <h2 className="mb-4 text-sm font-semibold uppercase tracking-wider text-muted-foreground">
            Channels
          </h2>
          <div className="space-y-4">
            <ChannelRow
              label="In-app"
              desc="Show alerts in the PayNOC notifications page."
              checked={s.inapp_enabled}
              onChange={(v) => setS({ ...s, inapp_enabled: v })}
            />
            <ChannelRow
              label="Email"
              desc="Send email notifications via Resend."
              checked={s.email_enabled}
              onChange={(v) => setS({ ...s, email_enabled: v })}
            />
            {s.email_enabled && (
              <input
                placeholder="notifications@yourcompany.com (defaults to account email)"
                value={s.notify_email ?? ""}
                onChange={(e) => setS({ ...s, notify_email: e.target.value || null })}
                className="w-full rounded-lg border border-glass-border bg-card/60 px-3 py-2 text-sm outline-none focus:border-brand"
              />
            )}
            <ChannelRow
              label="SMS"
              desc="Send SMS notifications via GatewayAPI (charges apply)."
              checked={s.sms_enabled}
              onChange={(v) => setS({ ...s, sms_enabled: v })}
            />
            {s.sms_enabled && (
              <input
                placeholder="+8801XXXXXXXXX (defaults to profile phone)"
                value={s.notify_phone ?? ""}
                onChange={(e) => setS({ ...s, notify_phone: e.target.value || null })}
                className="w-full rounded-lg border border-glass-border bg-card/60 px-3 py-2 text-sm outline-none focus:border-brand"
              />
            )}
          </div>
        </section>

        <section className="rounded-2xl border border-glass-border bg-card/40 p-6 backdrop-blur">
          <h2 className="mb-4 text-sm font-semibold uppercase tracking-wider text-muted-foreground">
            Events
          </h2>
          <div className="space-y-4">
            {EVENTS.map((e) => (
              <ChannelRow
                key={e.key}
                label={e.label}
                desc={e.desc}
                checked={s.events[e.key] !== false}
                onChange={(v) => setS({ ...s, events: { ...s.events, [e.key]: v } })}
              />
            ))}
          </div>
        </section>

        <p className="text-xs text-muted-foreground">
          Email uses your Resend connector; SMS uses GatewayAPI. If those integrations are
          not connected, delivery is silently skipped — in-app alerts still work.
        </p>
      </div>
    </MerchantShell>
  );
}

function ChannelRow({
  label,
  desc,
  checked,
  onChange,
}: {
  label: string;
  desc: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <div className="flex items-start justify-between gap-4">
      <div>
        <div className="text-sm font-medium">{label}</div>
        <div className="text-xs text-muted-foreground">{desc}</div>
      </div>
      <Switch checked={checked} onCheckedChange={onChange} />
    </div>
  );
}
