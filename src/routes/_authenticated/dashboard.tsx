import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { MerchantShell } from "@/components/merchant-shell";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";

export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => ({ meta: [{ title: "Dashboard · PayNOC" }] }),
  component: DashboardPage,
});

type Stats = {
  volume: number;
  paid: number;
  pending: number;
  invoices: number;
};

function DashboardPage() {
  const { user } = useAuth();
  const [profile, setProfile] = useState<{ business_name: string | null; full_name: string | null } | null>(null);
  const [stats, setStats] = useState<Stats | null>(null);

  useEffect(() => {
    if (!user) return;
    (async () => {
      const [p, inv, tx] = await Promise.all([
        supabase.from("profiles").select("business_name, full_name").eq("id", user.id).maybeSingle(),
        supabase.from("invoices").select("id, status", { count: "exact" }).eq("merchant_id", user.id),
        supabase.from("transactions").select("gross_amount, status").eq("merchant_id", user.id),
      ]);
      setProfile(p.data);
      const txs = tx.data ?? [];
      const volume = txs.filter((t) => t.status === "verified").reduce((s, t) => s + Number(t.gross_amount ?? 0), 0);
      const paid = txs.filter((t) => t.status === "verified").length;
      const pending = (inv.data ?? []).filter((i) => i.status === "pending").length;
      setStats({ volume, paid, pending, invoices: inv.count ?? 0 });
    })();
  }, [user]);

  return (
    <MerchantShell
      title={profile?.business_name || profile?.full_name || "Welcome"}
      subtitle="Real-time snapshot of your PayNOC account."
    >
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Gross volume" value={stats ? `৳ ${stats.volume.toLocaleString()}` : "—"} hint="Verified" />
        <Stat label="Successful payments" value={stats?.paid ?? "—"} hint="All time" />
        <Stat label="Pending invoices" value={stats?.pending ?? "—"} hint="Awaiting payment" />
        <Stat label="Total invoices" value={stats?.invoices ?? "—"} hint="All time" />
      </div>

      <div className="mt-8 glass rounded-2xl border border-glass-border p-8">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="font-display text-lg font-semibold">Get started</h2>
            <ol className="mt-4 space-y-3 text-sm text-muted-foreground">
              <li>1. Add business info & payment methods (bKash, Nagad, bank transfer).</li>
              <li>2. Generate API keys and integrate PayNOC checkout on your site.</li>
              <li>3. Add a webhook endpoint to receive payment notifications.</li>
            </ol>
          </div>
          <a href="/onboarding" className="shrink-0 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90">
            Open wizard →
          </a>
        </div>
      </div>
    </MerchantShell>
  );
}

function Stat({ label, value, hint }: { label: string; value: string | number; hint: string }) {
  return (
    <div className="glass rounded-2xl border border-glass-border p-6">
      <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">{label}</p>
      <p className="mt-2 font-display text-3xl font-bold text-foreground">{value}</p>
      <p className="mt-1 text-xs text-muted-foreground">{hint}</p>
    </div>
  );
}
