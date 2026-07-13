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

type CheckoutStyle = "premium" | "classic" | "neon" | "minimal";
type Profile = {
  full_name: string | null;
  business_name: string | null;
  phone: string | null;
  email: string;
  avatar_url: string | null;
  brand_color: string | null;
  logo_url: string | null;
  support_email: string | null;
  checkout_footer: string | null;
  checkout_style: CheckoutStyle | null;
  custom_head_html: string | null;
  custom_footer_html: string | null;
  slug: string | null;
  public_bio: string | null;
  accept_tips: boolean;
  tip_min_amount: number;
  address: string | null;
  city: string | null;
  state: string | null;
  country: string | null;
  postcode: string | null;
  tax_id: string | null;
  website: string | null;
  timezone: string | null;
  language: string | null;
  date_of_birth: string | null;
};


function SettingsPage() {
  const { user } = useAuth();
  const [p, setP] = useState<Profile | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!user) return;
    supabase
      .from("profiles")
      .select(
        "full_name, business_name, phone, email, avatar_url, brand_color, logo_url, support_email, checkout_footer, checkout_style, custom_head_html, custom_footer_html, slug, public_bio, accept_tips, tip_min_amount, address, city, state, country, postcode, tax_id, website, timezone, language, date_of_birth",
      )
      .eq("id", user.id)
      .maybeSingle()
      .then(({ data }) => setP(data as unknown as Profile | null));
  }, [user]);

  async function save() {
    if (!p || !user) return;
    setSaving(true);
    const { error } = await supabase.from("profiles").update({
      full_name: p.full_name,
      business_name: p.business_name,
      phone: p.phone,
      avatar_url: p.avatar_url,
      brand_color: p.brand_color,
      logo_url: p.logo_url,
      support_email: p.support_email,
      checkout_footer: p.checkout_footer,
      checkout_style: p.checkout_style,
      custom_head_html: p.custom_head_html,
      custom_footer_html: p.custom_footer_html,
      slug: p.slug,
      public_bio: p.public_bio,
      accept_tips: p.accept_tips,
      tip_min_amount: p.tip_min_amount,
      address: p.address,
      city: p.city,
      state: p.state,
      country: p.country,
      postcode: p.postcode,
      tax_id: p.tax_id,
      website: p.website,
      timezone: p.timezone,
      language: p.language,
      date_of_birth: p.date_of_birth,
    } as never).eq("id", user.id);
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

      <div className="glass mt-8 rounded-2xl border border-glass-border p-6">
        <h2 className="font-display text-lg font-semibold">Checkout branding</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Shown on your hosted checkout page (<code className="font-mono text-xs">/pay/&lt;invoice&gt;</code>).
        </p>
        <div className="mt-4 grid gap-6 md:grid-cols-2">
          <Field label="Logo URL">
            <Input value={p.logo_url ?? ""} onChange={(v) => setP({ ...p, logo_url: v })} />
          </Field>
          <Field label="Brand color (hex)">
            <div className="flex items-center gap-2">
              <Input value={p.brand_color ?? ""} onChange={(v) => setP({ ...p, brand_color: v })} />
              <input
                type="color"
                value={p.brand_color || "#6366f1"}
                onChange={(e) => setP({ ...p, brand_color: e.target.value })}
                className="h-9 w-12 cursor-pointer rounded border border-glass-border bg-transparent"
              />
            </div>
          </Field>
          <Field label="Support email (shown to payers)">
            <Input value={p.support_email ?? ""} onChange={(v) => setP({ ...p, support_email: v })} />
          </Field>
          <Field label="Checkout footer text">
            <Input value={p.checkout_footer ?? ""} onChange={(v) => setP({ ...p, checkout_footer: v })} />
          </Field>
        </div>

        <div className="mt-6">
          <div className="mb-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">Checkout style</div>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {([
              { key: "premium", label: "Premium", desc: "Glass, gradient halo", swatch: "bg-gradient-to-br from-brand/40 to-brand-2/20" },
              { key: "classic", label: "Classic", desc: "Light card, minimal chrome", swatch: "bg-white border" },
              { key: "neon",    label: "Neon",    desc: "Dark violet · cyan glow", swatch: "bg-gradient-to-br from-fuchsia-500 via-violet-600 to-cyan-400" },
              { key: "minimal", label: "Minimal", desc: "Flat, borderless, editorial", swatch: "bg-muted" },
            ] as const).map((s) => {
              const active = (p.checkout_style ?? "premium") === s.key;
              return (
                <button
                  key={s.key}
                  type="button"
                  onClick={() => setP({ ...p, checkout_style: s.key })}
                  className={`rounded-xl border p-3 text-left transition ${
                    active ? "border-brand shadow-[0_0_0_1px_var(--color-brand)]" : "border-glass-border hover:border-brand/60"
                  }`}
                >
                  <div className={`mb-2 h-12 w-full rounded-lg ${s.swatch}`} />
                  <div className="text-sm font-semibold">{s.label}</div>
                  <div className="text-[11px] text-muted-foreground">{s.desc}</div>
                </button>
              );
            })}
          </div>
        </div>

        {p.logo_url && (
          <div className="mt-4 flex items-center gap-3 rounded-lg border border-glass-border bg-card/40 p-3">
            <img src={p.logo_url} alt="Logo preview" className="h-10 w-10 rounded object-contain" />
            <span className="text-xs text-muted-foreground">Preview</span>
          </div>
        )}
      </div>

      <div className="glass mt-8 rounded-2xl border border-glass-border p-6">
        <h2 className="font-display text-lg font-semibold">Custom code</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Inject your own HTML / CSS / JS into <code className="font-mono text-xs">/pay/&lt;invoice&gt;</code> and{" "}
          <code className="font-mono text-xs">/m/&lt;slug&gt;</code>. Applies only to your own pages — other merchants are not affected.
          Great for custom fonts, analytics beacons, chat widgets, or overriding the checkout look.
        </p>
        <div className="mt-4 grid gap-4">
          <label className="block">
            <div className="mb-1.5 text-xs font-medium uppercase tracking-wider text-muted-foreground">
              Head HTML — injected inside &lt;head&gt;
            </div>
            <textarea
              value={p.custom_head_html ?? ""}
              onChange={(e) => setP({ ...p, custom_head_html: e.target.value })}
              rows={6}
              spellCheck={false}
              placeholder={`<style>\n  .paynoc-checkout { font-family: 'Poppins', sans-serif; }\n</style>\n<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Poppins" />`}
              className="w-full rounded-lg border border-glass-border bg-card/60 px-3 py-2 font-mono text-xs outline-none focus:border-brand"
            />
          </label>
          <label className="block">
            <div className="mb-1.5 text-xs font-medium uppercase tracking-wider text-muted-foreground">
              Footer HTML — injected before &lt;/body&gt;
            </div>
            <textarea
              value={p.custom_footer_html ?? ""}
              onChange={(e) => setP({ ...p, custom_footer_html: e.target.value })}
              rows={6}
              spellCheck={false}
              placeholder={`<script>\n  // Your custom JS runs on your checkout only\n</script>`}
              className="w-full rounded-lg border border-glass-border bg-card/60 px-3 py-2 font-mono text-xs outline-none focus:border-brand"
            />
          </label>
          <p className="text-[11px] text-muted-foreground">
            ⚠️ Anything you paste here runs on your customers' browsers. Only add code from sources you trust.
          </p>
        </div>
      </div>


      <div className="glass mt-8 rounded-2xl border border-glass-border p-6">
        <h2 className="font-display text-lg font-semibold">Public profile / tip jar</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Share <code className="font-mono text-xs">/m/&lt;slug&gt;</code> so anyone can send
          you a tip or donation.
        </p>
        <div className="mt-4 grid gap-6 md:grid-cols-2">
          <Field label="URL slug (letters, numbers, hyphens)">
            <Input
              value={p.slug ?? ""}
              onChange={(v) =>
                setP({ ...p, slug: v.toLowerCase().replace(/[^a-z0-9-]/g, "").slice(0, 40) })
              }
            />
          </Field>
          <Field label="Minimum tip amount ৳">
            <Input
              value={String(p.tip_min_amount ?? 10)}
              onChange={(v) => setP({ ...p, tip_min_amount: Number(v) || 0 })}
            />
          </Field>
          <label className="flex items-center gap-2 md:col-span-2">
            <input
              type="checkbox"
              checked={p.accept_tips}
              onChange={(e) => setP({ ...p, accept_tips: e.target.checked })}
            />
            <span className="text-sm">Accept public tips</span>
          </label>
          <label className="md:col-span-2">
            <div className="mb-1.5 text-xs font-medium uppercase tracking-wider text-muted-foreground">
              Public bio
            </div>
            <textarea
              value={p.public_bio ?? ""}
              onChange={(e) => setP({ ...p, public_bio: e.target.value })}
              rows={3}
              className="w-full rounded-lg border border-glass-border bg-card/60 px-3 py-2 text-sm outline-none focus:border-brand"
            />
          </label>
        </div>
        {p.slug && (
          <a
            href={`/m/${p.slug}`}
            target="_blank"
            rel="noreferrer"
            className="mt-3 inline-flex text-xs text-brand hover:underline"
          >
            Preview → /m/{p.slug}
          </a>
        )}
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

      <KycUploader />
    </MerchantShell>
  );
}

function KycUploader() {
  const { user } = useAuth();
  const [files, setFiles] = useState<Array<{ name: string; created_at: string }>>([]);
  const [busy, setBusy] = useState(false);

  const refresh = async () => {
    if (!user) return;
    const { data } = await supabase.storage.from("kyc").list(user.id, { limit: 50, sortBy: { column: "created_at", order: "desc" } });
    setFiles((data ?? []).map((f) => ({ name: f.name, created_at: f.created_at ?? "" })));
  };

  useEffect(() => { refresh(); }, [user]);

  const onFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f || !user) return;
    setBusy(true);
    const path = `${user.id}/${Date.now()}-${f.name}`;
    const { error } = await supabase.storage.from("kyc").upload(path, f, { upsert: false });
    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success("Document uploaded");
    refresh();
  };

  const view = async (name: string) => {
    if (!user) return;
    const { data } = await supabase.storage.from("kyc").createSignedUrl(`${user.id}/${name}`, 300);
    if (data?.signedUrl) window.open(data.signedUrl, "_blank");
  };

  const remove = async (name: string) => {
    if (!user) return;
    await supabase.storage.from("kyc").remove([`${user.id}/${name}`]);
    refresh();
  };

  return (
    <div className="glass mt-8 rounded-2xl border border-glass-border p-6">
      <h2 className="font-display text-lg font-semibold">KYC documents</h2>
      <p className="mt-1 text-sm text-muted-foreground">
        Upload business registration, national ID, or address proof. Files are private —
        only you and platform admins can access them.
      </p>
      <label className="mt-4 inline-flex cursor-pointer items-center gap-2 rounded-lg border border-dashed border-glass-border bg-card/60 px-4 py-2 text-sm">
        <input type="file" onChange={onFile} disabled={busy} className="hidden" />
        {busy ? "Uploading…" : "Choose a file to upload"}
      </label>

      <ul className="mt-4 space-y-2 text-sm">
        {files.length === 0 ? (
          <li className="text-muted-foreground">No documents uploaded yet.</li>
        ) : files.map((f) => (
          <li key={f.name} className="flex items-center justify-between rounded-lg border border-glass-border bg-card/40 px-3 py-2">
            <span className="truncate font-mono text-xs">{f.name}</span>
            <div className="flex gap-2">
              <button onClick={() => view(f.name)} className="text-xs text-brand hover:underline">View</button>
              <button onClick={() => remove(f.name)} className="text-xs text-destructive hover:underline">Delete</button>
            </div>
          </li>
        ))}
      </ul>
    </div>
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
