import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { AdminShell } from "@/components/admin-shell";
import { supabase } from "@/integrations/supabase/client";
import { saveTurnstileConfig } from "@/lib/turnstile.functions";

export const Route = createFileRoute("/_authenticated/admin/settings")({
  head: () => ({ meta: [{ title: "Platform settings · Admin" }] }),
  component: SettingsPage,
});

type TurnstileCfg = { enabled: boolean; site_key: string; secret_key: string };

type Settings = {
  id: number;
  brand_name: string;
  default_currency: string;
  default_fee_percent: number;
  default_fee_flat: number;
  support_email: string | null;
  logo_url: string | null;
  allow_signup: boolean;
  settings: Record<string, unknown> | null;
  turnstile: TurnstileCfg;
};

const DEFAULT_TS: TurnstileCfg = { enabled: false, site_key: "", secret_key: "" };

function SettingsPage() {
  const [s, setS] = useState<Settings | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    supabase
      .from("platform_settings")
      .select("id, brand_name, default_currency, default_fee_percent, default_fee_flat, support_email, logo_url, allow_signup, settings")
      .order("id")
      .limit(1)
      .maybeSingle()
      .then(({ data, error }) => {
        if (error) toast.error(error.message);
        if (!data) return setS(null);
        const raw = (data.settings ?? {}) as { turnstile?: Partial<TurnstileCfg> };
        setS({
          ...(data as unknown as Omit<Settings, "turnstile">),
          settings: (data.settings ?? {}) as Record<string, unknown>,
          turnstile: { ...DEFAULT_TS, ...(raw.turnstile ?? {}) },
        });
      });
  }, []);

  async function save() {
    if (!s) return;
    setSaving(true);
    try {
      // Save turnstile via privileged server fn (bypasses potential RLS role mismatch)
      await saveTurnstileConfig({
        data: {
          enabled: s.turnstile.enabled,
          site_key: s.turnstile.site_key,
          secret_key: s.turnstile.secret_key,
        },
      });

      const { data: updated, error } = await supabase
        .from("platform_settings")
        .update({
          brand_name: s.brand_name,
          default_currency: s.default_currency,
          default_fee_percent: s.default_fee_percent,
          default_fee_flat: s.default_fee_flat,
          support_email: s.support_email,
          logo_url: s.logo_url,
          allow_signup: s.allow_signup,
        })
        .eq("id", s.id)
        .select("id");
      if (error) throw new Error(error.message);
      if (!updated || updated.length === 0) {
        throw new Error("Not authorized to update platform settings (super_admin required).");
      }
      toast.success("Settings saved");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }

  if (!s) {
    return (
      <AdminShell title="Platform settings">
        <p className="text-sm text-muted-foreground">Loading…</p>
      </AdminShell>
    );
  }

  return (
    <AdminShell title="Platform settings" subtitle="Global branding, default fees, and signup controls.">
      <div className="glass grid gap-6 rounded-2xl border border-glass-border p-6 md:grid-cols-2">
        <Field label="Brand name">
          <Input value={s.brand_name} onChange={(v) => setS({ ...s, brand_name: v })} />
        </Field>
        <Field label="Support email">
          <Input value={s.support_email ?? ""} onChange={(v) => setS({ ...s, support_email: v })} />
        </Field>
        <Field label="Default currency">
          <Input value={s.default_currency} onChange={(v) => setS({ ...s, default_currency: v.toUpperCase() })} />
        </Field>
        <Field label="Logo URL">
          <Input value={s.logo_url ?? ""} onChange={(v) => setS({ ...s, logo_url: v })} />
        </Field>
        <Field label="Default fee (%)">
          <Input
            type="number"
            value={String(s.default_fee_percent)}
            onChange={(v) => setS({ ...s, default_fee_percent: Number(v) || 0 })}
          />
        </Field>
        <Field label="Default fee (flat)">
          <Input
            type="number"
            value={String(s.default_fee_flat)}
            onChange={(v) => setS({ ...s, default_fee_flat: Number(v) || 0 })}
          />
        </Field>
        <label className="flex items-center gap-3 md:col-span-2">
          <input
            type="checkbox"
            checked={s.allow_signup}
            onChange={(e) => setS({ ...s, allow_signup: e.target.checked })}
            className="h-4 w-4 rounded border-glass-border"
          />
          <span className="text-sm">Allow new merchant signups</span>
        </label>
      </div>

      <div className="glass mt-6 rounded-2xl border border-glass-border p-6">
        <div className="flex items-start justify-between gap-6">
          <div>
            <h2 className="font-display text-lg font-semibold">Cloudflare Turnstile CAPTCHA</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Protect sign-in, sign-up, and password reset with Cloudflare Turnstile.
              Get keys at{" "}
              <a
                href="https://dash.cloudflare.com/?to=/:account/turnstile"
                target="_blank"
                rel="noreferrer"
                className="text-brand hover:underline"
              >
                dash.cloudflare.com/turnstile
              </a>
              .
            </p>
          </div>
          <label className="inline-flex shrink-0 items-center gap-2">
            <input
              type="checkbox"
              checked={s.turnstile.enabled}
              onChange={(e) => setS({ ...s, turnstile: { ...s.turnstile, enabled: e.target.checked } })}
              className="h-4 w-4 rounded border-glass-border"
            />
            <span className="text-sm font-medium">Enabled</span>
          </label>
        </div>
        <div className="mt-4 grid gap-4 md:grid-cols-2">
          <Field label="Site key">
            <Input
              value={s.turnstile.site_key}
              onChange={(v) => setS({ ...s, turnstile: { ...s.turnstile, site_key: v } })}
            />
          </Field>
          <Field label="Secret key">
            <Input
              type="password"
              value={s.turnstile.secret_key}
              onChange={(v) => setS({ ...s, turnstile: { ...s.turnstile, secret_key: v } })}
            />
          </Field>
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
      <div className="mb-1.5 text-xs font-medium uppercase tracking-wider text-muted-foreground">{label}</div>
      {children}
    </label>
  );
}

function Input({
  value,
  onChange,
  type = "text",
}: {
  value: string;
  onChange: (v: string) => void;
  type?: string;
}) {
  return (
    <input
      type={type}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="w-full rounded-lg border border-glass-border bg-card/60 px-3 py-2 text-sm outline-none focus:border-brand"
    />
  );
}
