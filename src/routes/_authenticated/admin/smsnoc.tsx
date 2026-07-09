import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { MessageSquare, Send, Loader2 } from "lucide-react";
import { AdminShell } from "@/components/admin-shell";
import {
  getPlatformSmsNocConfig,
  savePlatformSmsNocConfig,
  sendPlatformSmsNocTest,
} from "@/lib/smsnoc.functions";

export const Route = createFileRoute("/_authenticated/admin/smsnoc")({
  head: () => ({ meta: [{ title: "SMS NOC · Admin" }] }),
  component: SmsNocAdminPage,
});

type Cfg = Awaited<ReturnType<typeof getPlatformSmsNocConfig>>;

const EVENTS: { key: string; label: string; desc: string }[] = [
  { key: "user_registered", label: "New user registration", desc: "Welcome message on signup" },
  { key: "password_reset", label: "Password reset", desc: "Reset link + confirmation" },
  { key: "package_purchased", label: "Package purchased", desc: "Confirmation after plan buy/assign" },
  { key: "subscription_renewed", label: "Subscription renewed", desc: "Auto-renew success" },
  { key: "subscription_expiring", label: "Expiration reminder", desc: "3 days before expiry" },
  { key: "subscription_expired", label: "Subscription expired", desc: "Plan ended" },
  { key: "payment_received", label: "Payment received (platform copy)", desc: "Cc platform on each successful payment" },
];

function SmsNocAdminPage() {
  const [c, setC] = useState<Cfg | null>(null);
  const [saving, setSaving] = useState(false);
  const [testTo, setTestTo] = useState("");
  const [testChannel, setTestChannel] = useState<"sms" | "email" | "whatsapp" | "voice">("sms");
  const [testing, setTesting] = useState(false);

  useEffect(() => {
    getPlatformSmsNocConfig()
      .then(setC)
      .catch((e) => toast.error(e instanceof Error ? e.message : "Failed to load"));
  }, []);

  async function save() {
    if (!c) return;
    setSaving(true);
    try {
      await savePlatformSmsNocConfig({ data: c });
      toast.success("SMS NOC settings saved");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }

  async function sendTest() {
    if (!testTo.trim()) return toast.error("Enter a test recipient");
    setTesting(true);
    try {
      const r = await sendPlatformSmsNocTest({
        data: { channel: testChannel, to: testTo.trim() },
      });
      if (r.status === "sent") toast.success(`Test ${testChannel} dispatched`);
      else toast.error(`Test failed: ${r.error || r.provider_response || "unknown"}`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Test failed");
    } finally {
      setTesting(false);
    }
  }

  if (!c) {
    return (
      <AdminShell title="SMS NOC" subtitle="Loading…">
        <div className="flex items-center gap-2 text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading configuration…
        </div>
      </AdminShell>
    );
  }

  return (
    <AdminShell
      title="SMS NOC"
      subtitle="Send SMS, Email, WhatsApp & Voice notifications for platform events via smsnoc.com."
    >
      <div className="glass rounded-2xl border border-glass-border p-6">
        <div className="flex items-start justify-between gap-6">
          <div>
            <div className="flex items-center gap-2">
              <MessageSquare className="h-5 w-5 text-brand" />
              <h2 className="font-display text-lg font-semibold">Provider credentials</h2>
            </div>
            <p className="mt-1 text-sm text-muted-foreground">
              Create an API key at{" "}
              <a
                href="https://smsnoc.com/dashboard/api"
                target="_blank"
                rel="noreferrer"
                className="text-brand hover:underline"
              >
                smsnoc.com/dashboard/api
              </a>
              . One key covers SMS, Email, WhatsApp and Voice.
            </p>
          </div>
          <label className="inline-flex shrink-0 items-center gap-2">
            <input
              type="checkbox"
              checked={c.enabled}
              onChange={(e) => setC({ ...c, enabled: e.target.checked })}
              className="h-4 w-4 rounded border-glass-border"
            />
            <span className="text-sm font-medium">Enabled</span>
          </label>
        </div>

        <div className="mt-4 grid gap-4 md:grid-cols-2">
          <Field label="API key">
            <Input type="password" value={c.api_key} onChange={(v) => setC({ ...c, api_key: v })} />
          </Field>
          <Field label="Default Sender ID (SMS)">
            <Input value={c.sender_id} onChange={(v) => setC({ ...c, sender_id: v })} />
          </Field>
          <Field label="Email config ID (optional)">
            <Input
              value={c.email_config_id}
              onChange={(v) => setC({ ...c, email_config_id: v })}
            />
          </Field>
          <Field label="WhatsApp device ID (optional)">
            <Input
              value={c.whatsapp_device_id}
              onChange={(v) => setC({ ...c, whatsapp_device_id: v })}
            />
          </Field>
        </div>

        <div className="mt-6">
          <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
            Channels
          </h3>
          <div className="mt-2 grid grid-cols-2 gap-3 md:grid-cols-4">
            {(
              [
                ["channel_sms", "SMS"],
                ["channel_email", "Email"],
                ["channel_whatsapp", "WhatsApp"],
                ["channel_voice", "Voice"],
              ] as const
            ).map(([k, label]) => (
              <label
                key={k}
                className="flex items-center gap-2 rounded-lg border border-glass-border bg-card/40 px-3 py-2"
              >
                <input
                  type="checkbox"
                  checked={c[k] as boolean}
                  onChange={(e) => setC({ ...c, [k]: e.target.checked } as Cfg)}
                  className="h-4 w-4"
                />
                <span className="text-sm">{label}</span>
              </label>
            ))}
          </div>
        </div>
      </div>

      <div className="glass mt-6 rounded-2xl border border-glass-border p-6">
        <h2 className="font-display text-lg font-semibold">Events &amp; templates</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Toggle which platform events fire notifications. Templates support{" "}
          <code className="rounded bg-muted px-1 text-xs">{`{{name}}`}</code>,{" "}
          <code className="rounded bg-muted px-1 text-xs">{`{{brand}}`}</code>,{" "}
          <code className="rounded bg-muted px-1 text-xs">{`{{package_name}}`}</code>,{" "}
          <code className="rounded bg-muted px-1 text-xs">{`{{expires_at}}`}</code>,{" "}
          <code className="rounded bg-muted px-1 text-xs">{`{{reset_link}}`}</code>.
        </p>
        <div className="mt-4 space-y-4">
          {EVENTS.map((ev) => (
            <div
              key={ev.key}
              className="rounded-xl border border-glass-border bg-card/40 p-4"
            >
              <div className="flex items-start justify-between gap-4">
                <div>
                  <div className="text-sm font-semibold">{ev.label}</div>
                  <div className="text-xs text-muted-foreground">{ev.desc}</div>
                </div>
                <label className="inline-flex shrink-0 items-center gap-2">
                  <input
                    type="checkbox"
                    checked={c.events[ev.key] !== false}
                    onChange={(e) =>
                      setC({
                        ...c,
                        events: { ...c.events, [ev.key]: e.target.checked },
                      })
                    }
                    className="h-4 w-4"
                  />
                  <span className="text-xs">On</span>
                </label>
              </div>
              <textarea
                rows={2}
                value={c.templates[ev.key] ?? ""}
                onChange={(e) =>
                  setC({
                    ...c,
                    templates: { ...c.templates, [ev.key]: e.target.value },
                  })
                }
                className="mt-3 w-full rounded-lg border border-glass-border bg-background/40 px-3 py-2 text-sm outline-none focus:border-brand"
              />
            </div>
          ))}
        </div>
      </div>

      <div className="glass mt-6 rounded-2xl border border-glass-border p-6">
        <h2 className="font-display text-lg font-semibold">Send a test</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Verifies your API key and sender/config IDs are working end-to-end.
        </p>
        <div className="mt-4 grid gap-3 md:grid-cols-[160px_1fr_auto]">
          <select
            value={testChannel}
            onChange={(e) => setTestChannel(e.target.value as typeof testChannel)}
            className="rounded-lg border border-glass-border bg-card/60 px-3 py-2 text-sm"
          >
            <option value="sms">SMS</option>
            <option value="email">Email</option>
            <option value="whatsapp">WhatsApp</option>
            <option value="voice">Voice</option>
          </select>
          <Input
            value={testTo}
            onChange={setTestTo}
            placeholder={testChannel === "email" ? "you@example.com" : "01712345678"}
          />
          <button
            onClick={sendTest}
            disabled={testing}
            className="inline-flex items-center gap-2 rounded-lg bg-gradient-brand px-4 py-2 text-sm font-semibold text-brand-foreground disabled:opacity-60"
          >
            {testing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            Send test
          </button>
        </div>
      </div>

      <div className="mt-6 flex justify-end">
        <button
          onClick={save}
          disabled={saving}
          className="rounded-lg bg-gradient-brand px-4 py-2 text-sm font-semibold text-brand-foreground disabled:opacity-60"
        >
          {saving ? "Saving…" : "Save changes"}
        </button>
      </div>
    </AdminShell>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <div className="mb-1.5 text-xs font-medium uppercase tracking-wider text-muted-foreground">
        {label}
      </div>
      {children}
    </label>
  );
}

function Input({
  value,
  onChange,
  type = "text",
  placeholder,
}: {
  value: string;
  onChange: (v: string) => void;
  type?: string;
  placeholder?: string;
}) {
  return (
    <input
      type={type}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      className="w-full rounded-lg border border-glass-border bg-card/60 px-3 py-2 text-sm outline-none focus:border-brand"
    />
  );
}
