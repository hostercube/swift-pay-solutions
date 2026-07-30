import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { CheckCircle2, Circle, ArrowRight, Building2, CreditCard, FileText, Rocket } from "lucide-react";
import { toast } from "sonner";
import { MerchantShell } from "@/components/merchant-shell";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { useActiveMerchant } from "@/hooks/use-active-merchant";
import { Progress } from "@/components/ui/progress";

export const Route = createFileRoute("/_authenticated/onboarding")({
  head: () => ({ meta: [{ title: "Get started · PayNOC" }] }),
  component: OnboardingPage,
});

type Status = {
  business: boolean;
  method: boolean;
  invoice: boolean;
  webhook: boolean;
};

function OnboardingPage() {
  const { user } = useAuth();
  const { merchantId: activeMerchantId } = useActiveMerchant();
  const navigate = useNavigate();
  const [status, setStatus] = useState<Status | null>(null);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ business_name: "", full_name: "", support_email: "" });

  const load = async () => {
    if (!user) return;
    const [p, m, i, w] = await Promise.all([
      supabase.from("profiles").select("business_name, full_name, support_email").eq("id", user.id).maybeSingle(),
      supabase.from("payment_methods").select("id", { count: "exact", head: true }).eq("merchant_id", activeMerchantId ?? user.id),
      supabase.from("invoices").select("id", { count: "exact", head: true }).eq("merchant_id", activeMerchantId ?? user.id),
      supabase.from("webhook_endpoints").select("id", { count: "exact", head: true }).eq("merchant_id", activeMerchantId ?? user.id),
    ]);
    setStatus({
      business: !!p.data?.business_name,
      method: (m.count ?? 0) > 0,
      invoice: (i.count ?? 0) > 0,
      webhook: (w.count ?? 0) > 0,
    });
    if (p.data) {
      setForm({
        business_name: p.data.business_name ?? "",
        full_name: p.data.full_name ?? "",
        support_email: p.data.support_email ?? user.email ?? "",
      });
    }
  };

  useEffect(() => { load(); }, [user, activeMerchantId]);

  const saveBusiness = async () => {
    if (!user) return;
    if (!form.business_name.trim()) return toast.error("Business name is required");
    setSaving(true);
    const { error } = await supabase.from("profiles").update({
      business_name: form.business_name.trim(),
      full_name: form.full_name.trim() || null,
      support_email: form.support_email.trim() || null,
    }).eq("id", user.id);
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success("Business info saved");
    load();
  };

  const completed = status ? Object.values(status).filter(Boolean).length : 0;
  const total = 4;
  const pct = Math.round((completed / total) * 100);

  return (
    <MerchantShell title="Get started" subtitle="Complete these steps to start accepting payments.">
      <div className="rounded-2xl border border-border/60 bg-card/60 p-6 backdrop-blur">
        <div className="flex items-center justify-between mb-3">
          <div>
            <p className="text-sm text-muted-foreground">Setup progress</p>
            <p className="text-2xl font-semibold">{completed} of {total} complete</p>
          </div>
          {completed === total && (
            <button onClick={() => navigate({ to: "/dashboard" })} className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 inline-flex items-center gap-2">
              <Rocket className="h-4 w-4" /> Go to dashboard
            </button>
          )}
        </div>
        <Progress value={pct} />
      </div>

      <div className="mt-6 grid gap-4">
        <Step
          icon={<Building2 className="h-5 w-5" />}
          done={!!status?.business}
          title="1. Business information"
          desc="Tell us about your business — this appears on your checkout page and receipts."
        >
          <div className="grid gap-3 md:grid-cols-3">
            <Input label="Business name *" value={form.business_name} onChange={(v) => setForm({ ...form, business_name: v })} />
            <Input label="Contact name" value={form.full_name} onChange={(v) => setForm({ ...form, full_name: v })} />
            <Input label="Support email" value={form.support_email} onChange={(v) => setForm({ ...form, support_email: v })} />
          </div>
          <div className="mt-3 flex justify-end">
            <button onClick={saveBusiness} disabled={saving} className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50">
              {saving ? "Saving…" : "Save & continue"}
            </button>
          </div>
        </Step>

        <Step
          icon={<CreditCard className="h-5 w-5" />}
          done={!!status?.method}
          title="2. Add a payment method"
          desc="Add at least one method (bKash, Nagad, bank transfer, card) so customers can pay."
        >
          <Link to="/integrations" className="inline-flex items-center gap-2 rounded-lg border border-border px-4 py-2 text-sm hover:bg-accent">
            Open payment methods <ArrowRight className="h-4 w-4" />
          </Link>
        </Step>

        <Step
          icon={<FileText className="h-5 w-5" />}
          done={!!status?.invoice}
          title="3. Create your first invoice"
          desc="Send a hosted checkout link to a customer — the fastest way to test end-to-end."
        >
          <Link to="/invoices/new" className="inline-flex items-center gap-2 rounded-lg border border-border px-4 py-2 text-sm hover:bg-accent">
            Create invoice <ArrowRight className="h-4 w-4" />
          </Link>
        </Step>

        <Step
          icon={<Rocket className="h-5 w-5" />}
          done={!!status?.webhook}
          title="4. Connect a webhook (optional)"
          desc="Receive real-time events on your server when invoices are paid or refunded."
        >
          <Link to="/webhooks" className="inline-flex items-center gap-2 rounded-lg border border-border px-4 py-2 text-sm hover:bg-accent">
            Configure webhooks <ArrowRight className="h-4 w-4" />
          </Link>
        </Step>
      </div>
    </MerchantShell>
  );
}

function Step({ icon, done, title, desc, children }: { icon: React.ReactNode; done: boolean; title: string; desc: string; children: React.ReactNode }) {
  return (
    <div className={`rounded-2xl border p-5 backdrop-blur transition ${done ? "border-emerald-500/40 bg-emerald-500/5" : "border-border/60 bg-card/60"}`}>
      <div className="flex items-start gap-4">
        <div className={`flex h-10 w-10 items-center justify-center rounded-xl ${done ? "bg-emerald-500/15 text-emerald-500" : "bg-primary/10 text-primary"}`}>
          {done ? <CheckCircle2 className="h-5 w-5" /> : icon}
        </div>
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <h3 className="font-semibold">{title}</h3>
            {done ? (
              <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/15 px-2 py-0.5 text-xs text-emerald-600">
                <CheckCircle2 className="h-3 w-3" /> Done
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">
                <Circle className="h-3 w-3" /> Pending
              </span>
            )}
          </div>
          <p className="mt-1 text-sm text-muted-foreground">{desc}</p>
          <div className="mt-4">{children}</div>
        </div>
      </div>
    </div>
  );
}

function Input({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-medium text-muted-foreground">{label}</span>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary"
      />
    </label>
  );
}
