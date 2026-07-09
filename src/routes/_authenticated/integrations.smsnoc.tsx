import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { MessageSquare, Send, Loader2, ExternalLink } from "lucide-react";
import {
  getMerchantSmsNocConfig,
  saveMerchantSmsNocConfig,
  sendMerchantSmsNocTest,
} from "@/lib/smsnoc.functions";

export const Route = createFileRoute("/_authenticated/integrations/smsnoc")({
  head: () => ({ meta: [{ title: "SMS NOC · Integrations" }] }),
  component: MerchantSmsNocPage,
});

type Cfg = {
  enabled: boolean;
  api_key: string;
  sender_id: string;
  whatsapp_device_id: string;
  email_config_id: string;
  channel_sms: boolean;
  channel_email: boolean;
  channel_whatsapp: boolean;
  channel_voice: boolean;
  notify_on_invoice_created: boolean;
  notify_on_payment_received: boolean;
  notify_on_refund: boolean;
  notify_phone: string;
  notify_email: string;
  notify_whatsapp: string;
};

const EMPTY: Cfg = {
  enabled: false,
  api_key: "",
  sender_id: "",
  whatsapp_device_id: "",
  email_config_id: "",
  channel_sms: true,
  channel_email: false,
  channel_whatsapp: false,
  channel_voice: false,
  notify_on_invoice_created: false,
  notify_on_payment_received: true,
  notify_on_refund: true,
  notify_phone: "",
  notify_email: "",
  notify_whatsapp: "",
};

function MerchantSmsNocPage() {
  const [c, setC] = useState<Cfg>(EMPTY);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testTo, setTestTo] = useState("");
  const [testChannel, setTestChannel] = useState<"sms" | "email" | "whatsapp" | "voice">("sms");
  const [testing, setTesting] = useState(false);

  useEffect(() => {
    getMerchantSmsNocConfig()
      .then((row) => {
        if (row) {
          setC({
            enabled: !!row.enabled,
            api_key: (row.api_key as string) || "",
            sender_id: (row.sender_id as string) || "",
            whatsapp_device_id: (row.whatsapp_device_id as string) || "",
            email_config_id: (row.email_config_id as string) || "",
            channel_sms: !!row.channel_sms,
            channel_email: !!row.channel_email,
            channel_whatsapp: !!row.channel_whatsapp,
            channel_voice: !!row.channel_voice,
            notify_on_invoice_created: !!row.notify_on_invoice_created,
            notify_on_payment_received: !!row.notify_on_payment_received,
            notify_on_refund: !!row.notify_on_refund,
            notify_phone: (row.notify_phone as string) || "",
            notify_email: (row.notify_email as string) || "",
            notify_whatsapp: (row.notify_whatsapp as string) || "",
          });
        }
      })
      .catch((e) => toast.error(e instanceof Error ? e.message : "Failed to load"))
      .finally(() => setLoading(false));
  }, []);

  async function save() {
    setSaving(true);
    try {
      await saveMerchantSmsNocConfig({ data: c });
      toast.success("SMS NOC integration saved");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }

  async function sendTest() {
    if (!testTo.trim()) return toast.error("Enter a recipient");
    setTesting(true);
    try {
      const r = await sendMerchantSmsNocTest({
        data: { channel: testChannel, to: testTo.trim() },
      });
      if (r.status === "sent") toast.success(`Test ${testChannel} sent`);
      else toast.error(`Test failed: ${r.error || r.provider_response || "unknown"}`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Test failed");
    } finally {
      setTesting(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" /> Loading…
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="glass rounded-2xl border border-glass-border p-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <MessageSquare className="h-5 w-5 text-brand" />
              <h2 className="font-display text-lg font-semibold">Your SMS NOC integration</h2>
            </div>
            <p className="mt-1 text-sm text-muted-foreground">
              Connect your own smsnoc.com account to get instant SMS / Email / WhatsApp
              alerts when payments land, invoices are created, or refunds are processed.
            </p>
            <a
              href="https://smsnoc.com/dashboard/api"
              target="_blank"
              rel="noreferrer"
              className="mt-2 inline-flex items-center gap-1 text-xs text-brand hover:underline"
            >
              Get your API key at smsnoc.com/dashboard/api
              <ExternalLink className="h-3 w-3" />
            </a>
          </div>
          <label className="inline-flex shrink-0 items-center gap-2">
            <input
              type="checkbox"
              checked={c.enabled}
              onChange={(e) => setC({ ...c, enabled: e.target.checked })}
              className="h-4 w-4 rounded"
            />
            <span className="text-sm font-medium">Enabled</span>
          </label>
        </div>

        <div className="mt-4 grid gap-4 md:grid-cols-2">
          <Field label="API key">
            <Input type="password" value={c.api_key} onChange={(v) => setC({ ...c, api_key: v })} />
          </Field>
          <Field label="Sender ID (SMS)">
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
      </div>

      <div className="glass rounded-2xl border border-glass-border p-6">
        <h3 className="font-display text-base font-semibold">Where to send notifications</h3>
        <p className="mt-1 text-sm text-muted-foreground">
          Leave blank to fall back to your profile email/phone.
        </p>
        <div className="mt-4 grid gap-4 md:grid-cols-3">
          <Field label="Phone / SMS">
            <Input value={c.notify_phone} onChange={(v) => setC({ ...c, notify_phone: v })} />
          </Field>
          <Field label="Email">
            <Input value={c.notify_email} onChange={(v) => setC({ ...c, notify_email: v })} />
          </Field>
          <Field label="WhatsApp">
            <Input value={c.notify_whatsapp} onChange={(v) => setC({ ...c, notify_whatsapp: v })} />
          </Field>
        </div>

        <h3 className="mt-6 font-display text-base font-semibold">Channels</h3>
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

        <h3 className="mt-6 font-display text-base font-semibold">Events</h3>
        <div className="mt-2 space-y-2">
          <Toggle
            checked={c.notify_on_payment_received}
            onChange={(v) => setC({ ...c, notify_on_payment_received: v })}
            label="Payment received"
            desc="Fire when an invoice is marked completed."
          />
          <Toggle
            checked={c.notify_on_invoice_created}
            onChange={(v) => setC({ ...c, notify_on_invoice_created: v })}
            label="Invoice created"
            desc="Fire whenever you create a new invoice."
          />
          <Toggle
            checked={c.notify_on_refund}
            onChange={(v) => setC({ ...c, notify_on_refund: v })}
            label="Refund approved / processed / rejected"
            desc="Track refund lifecycle events."
          />
        </div>
      </div>

      <div className="glass rounded-2xl border border-glass-border p-6">
        <h3 className="font-display text-base font-semibold">Send a test</h3>
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

      <div className="flex justify-end">
        <button
          onClick={save}
          disabled={saving}
          className="rounded-lg bg-gradient-brand px-4 py-2 text-sm font-semibold text-brand-foreground disabled:opacity-60"
        >
          {saving ? "Saving…" : "Save changes"}
        </button>
      </div>
    </div>
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

function Toggle({
  checked,
  onChange,
  label,
  desc,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
  desc: string;
}) {
  return (
    <label className="flex items-start gap-3 rounded-lg border border-glass-border bg-card/40 p-3">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="mt-0.5 h-4 w-4"
      />
      <div>
        <div className="text-sm font-medium">{label}</div>
        <div className="text-xs text-muted-foreground">{desc}</div>
      </div>
    </label>
  );
}
