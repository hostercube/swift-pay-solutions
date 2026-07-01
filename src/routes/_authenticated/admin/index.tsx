import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { AdminShell } from "@/components/admin-shell";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated/admin/")({
  head: () => ({ meta: [{ title: "Admin overview · PayNOC" }] }),
  component: AdminOverview,
});

type Stats = {
  merchants: number;
  invoices: number;
  transactions: number;
  volume: number;
};

function AdminOverview() {
  const [stats, setStats] = useState<Stats | null>(null);

  useEffect(() => {
    (async () => {
      const [m, i, t, vol] = await Promise.all([
        supabase.from("profiles").select("*", { count: "exact", head: true }),
        supabase.from("invoices").select("*", { count: "exact", head: true }),
        supabase.from("transactions").select("*", { count: "exact", head: true }),
        supabase.from("transactions").select("gross_amount").eq("status", "success"),
      ]);
      const volume = (vol.data ?? []).reduce((s, r) => s + Number(r.gross_amount ?? 0), 0);
      setStats({
        merchants: m.count ?? 0,
        invoices: i.count ?? 0,
        transactions: t.count ?? 0,
        volume,
      });
    })();
  }, []);

  return (
    <AdminShell title="Platform overview" subtitle="Real-time snapshot of everything running on PayNOC.">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Merchants" value={stats?.merchants ?? "—"} />
        <Stat label="Invoices" value={stats?.invoices ?? "—"} />
        <Stat label="Transactions" value={stats?.transactions ?? "—"} />
        <Stat label="Gross volume" value={stats ? `৳ ${stats.volume.toLocaleString()}` : "—"} />
      </div>
    </AdminShell>
  );
}

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="glass rounded-2xl border border-glass-border p-6">
      <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">{label}</p>
      <p className="mt-2 font-display text-3xl font-bold">{value}</p>
    </div>
  );
}
