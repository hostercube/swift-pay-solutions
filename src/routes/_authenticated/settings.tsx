import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { MerchantShell } from "@/components/merchant-shell";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";

export const Route = createFileRoute("/_authenticated/settings")({
  head: () => ({ meta: [{ title: "Settings · PayNOC" }] }),
  component: SettingsPage,
});

type Profile = {
  full_name: string | null;
  business_name: string | null;
  phone: string | null;
  email: string;
  avatar_url: string | null;
};

function SettingsPage() {
  const { user } = useAuth();
  const [p, setP] = useState<Profile | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!user) return;
    supabase
      .from("profiles")
      .select("full_name, business_name, phone, email, avatar_url")
      .eq("id", user.id)
      .maybeSingle()
      .then(({ data }) => setP(data as Profile | null));
  }, [user]);

  async function save() {
    if (!p || !user) return;
    setSaving(true);
    const { error } = await supabase.from("profiles").update({
      full_name: p.full_name,
      business_name: p.business_name,
      phone: p.phone,
      avatar_url: p.avatar_url,
    }).eq("id", user.id);
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success("Profile saved");
  }

  if (!p) return <MerchantShell title="Settings"><p className="text-sm text-muted-foreground">Loading…</p></MerchantShell>;

  return (
    <MerchantShell title="Settings" subtitle="Update your merchant profile and contact details.">
      <div className="glass grid gap-6 rounded-2xl border border-glass-border p-6 md:grid-cols-2">
        <Field label="Full name">
          <Input value={p.full_name ?? ""} onChange={(v) => setP({ ...p, full_name: v })} />
        </Field>
        <Field label="Business name">
          <Input value={p.business_name ?? ""} onChange={(v) => setP({ ...p, business_name: v })} />
        </Field>
        <Field label="Email">
          <Input value={p.email} onChange={() => {}} disabled />
        </Field>
        <Field label="Phone">
          <Input value={p.phone ?? ""} onChange={(v) => setP({ ...p, phone: v })} />
        </Field>
        <Field label="Avatar URL">
          <Input value={p.avatar_url ?? ""} onChange={(v) => setP({ ...p, avatar_url: v })} />
        </Field>
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
    </MerchantShell>
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
function Input({ value, onChange, disabled }: { value: string; onChange: (v: string) => void; disabled?: boolean }) {
  return (
    <input
      value={value}
      disabled={disabled}
      onChange={(e) => onChange(e.target.value)}
      className="w-full rounded-lg border border-glass-border bg-card/60 px-3 py-2 text-sm outline-none focus:border-brand disabled:opacity-60"
    />
  );
}
