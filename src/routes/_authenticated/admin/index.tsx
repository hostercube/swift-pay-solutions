import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { AdminShell } from "@/components/admin-shell";
import { supabase } from "@/integrations/supabase/client";
import {
  Users, Receipt, ArrowRightLeft, DollarSign, ShieldCheck, Gavel,
  Package, AlertTriangle, TrendingUp, TrendingDown, Activity,
} from "lucide-react";
import {
  Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis,
  BarChart, Bar, Cell,
} from "recharts";

export const Route = createFileRoute("/_authenticated/admin/")({
  head: () => ({ meta: [{ title: "Admin overview · PayNOC" }] }),
  component: AdminOverview,
});

type Stats = {
  merchants: number;
  merchants7d: number;
  invoices: number;
  transactions: number;
  volume: number;
  volume7d: number;
  volume7dPrev: number;
  pendingKyc: number;
  openDisputes: number;
  openIncidents: number;
  activeSubs: number;
  mrr: number;
  todayTx: number;
  todayVolume: number;
};

type Tx = { created_at: string; gross_amount: number | null; status: string; provider: string | null; merchant_id: string };

function AdminOverview() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [txs, setTxs] = useState<Tx[]>([]);
  const [recentInvoices, setRecentInvoices] = useState<any[]>([]);
  const [topMerchants, setTopMerchants] = useState<Array<{ id: string; name: string; volume: number; count: number }>>([]);
  const [audit, setAudit] = useState<any[]>([]);

  useEffect(() => {
    (async () => {
      const now = new Date();
      const d7 = new Date(now.getTime() - 7 * 864e5).toISOString();
      const d14 = new Date(now.getTime() - 14 * 864e5).toISOString();
      const d30 = new Date(now.getTime() - 30 * 864e5).toISOString();
      const startToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();

      const [m, m7, inv, txAll, tx30, kyc, disp, inc, subs, pkgs, recInv, aud, profs] = await Promise.all([
        supabase.from("profiles").select("*", { count: "exact", head: true }),
        supabase.from("profiles").select("*", { count: "exact", head: true }).gte("created_at", d7),
        supabase.from("invoices").select("*", { count: "exact", head: true }),
        supabase.from("transactions").select("*", { count: "exact", head: true }),
        supabase.from("transactions").select("created_at,gross_amount,status,provider,merchant_id").gte("created_at", d30).order("created_at", { ascending: false }).limit(2000),
        supabase.from("profiles").select("*", { count: "exact", head: true }).eq("kyc_status", "pending"),
        supabase.from("disputes").select("*", { count: "exact", head: true }).in("status", ["open", "under_review"]),
        supabase.from("incidents").select("*", { count: "exact", head: true }).neq("status", "resolved"),
        supabase.from("merchant_subscriptions").select("package_id", { count: "exact" }).eq("status", "active"),
        supabase.from("subscription_packages").select("id,price_bdt,billing_cycle"),
        supabase.from("invoices").select("id,invoice_number,amount,status,created_at,customer_name").order("created_at", { ascending: false }).limit(6),
        supabase.from("audit_logs").select("id,action,entity_type,created_at,actor_id").order("created_at", { ascending: false }).limit(8),
        supabase.from("profiles").select("id,business_name,full_name"),
      ]);

      const txsData = (tx30.data ?? []) as Tx[];
      const verified = txsData.filter(t => t.status === "verified");
      const volume7d = verified.filter(t => t.created_at >= d7).reduce((s, t) => s + Number(t.gross_amount ?? 0), 0);
      const volume7dPrev = verified.filter(t => t.created_at >= d14 && t.created_at < d7).reduce((s, t) => s + Number(t.gross_amount ?? 0), 0);
      const volumeAll = verified.reduce((s, t) => s + Number(t.gross_amount ?? 0), 0);
      const todayTxList = txsData.filter(t => t.created_at >= startToday);
      const todayVolume = todayTxList.filter(t => t.status === "verified").reduce((s, t) => s + Number(t.gross_amount ?? 0), 0);

      // MRR from active subs
      const pkgMap = new Map((pkgs.data ?? []).map((p: any) => [p.id, p]));
      const subsData = subs.data ?? [];
      const mrr = subsData.reduce((s: number, r: any) => {
        const p = pkgMap.get(r.package_id) as any;
        if (!p) return s;
        const price = Number(p.price_bdt ?? 0);
        if (p.billing_cycle === "yearly") return s + price / 12;
        if (p.billing_cycle === "lifetime") return s;
        return s + price;
      }, 0);

      // Top merchants (verified last 30d)
      const nameMap = new Map((profs.data ?? []).map((p: any) => [p.id, p.business_name || p.full_name || p.id.slice(0, 8)]));
      const byMerch = new Map<string, { volume: number; count: number }>();
      verified.forEach(t => {
        const cur = byMerch.get(t.merchant_id) ?? { volume: 0, count: 0 };
        cur.volume += Number(t.gross_amount ?? 0);
        cur.count += 1;
        byMerch.set(t.merchant_id, cur);
      });
      const top = [...byMerch.entries()]
        .map(([id, v]) => ({ id, name: nameMap.get(id) ?? id.slice(0, 8), ...v }))
        .sort((a, b) => b.volume - a.volume)
        .slice(0, 5);

      setStats({
        merchants: m.count ?? 0,
        merchants7d: m7.count ?? 0,
        invoices: inv.count ?? 0,
        transactions: txAll.count ?? 0,
        volume: volumeAll,
        volume7d,
        volume7dPrev,
        pendingKyc: kyc.count ?? 0,
        openDisputes: disp.count ?? 0,
        openIncidents: inc.count ?? 0,
        activeSubs: subs.count ?? 0,
        mrr,
        todayTx: todayTxList.length,
        todayVolume,
      });
      setTxs(txsData);
      setRecentInvoices(recInv.data ?? []);
      setAudit(aud.data ?? []);
      setTopMerchants(top);
    })();
  }, []);

  const chart30 = useMemo(() => {
    const buckets = new Map<string, { date: string; volume: number; count: number }>();
    for (let i = 29; i >= 0; i--) {
      const d = new Date(Date.now() - i * 864e5);
      const key = d.toISOString().slice(0, 10);
      buckets.set(key, { date: key.slice(5), volume: 0, count: 0 });
    }
    txs.filter(t => t.status === "verified").forEach(t => {
      const k = t.created_at.slice(0, 10);
      const b = buckets.get(k);
      if (b) { b.volume += Number(t.gross_amount ?? 0); b.count += 1; }
    });
    return [...buckets.values()];
  }, [txs]);

  const providerBreakdown = useMemo(() => {
    const map = new Map<string, number>();
    txs.filter(t => t.status === "verified").forEach(t => {
      const k = (t.provider || "unknown").toLowerCase();
      map.set(k, (map.get(k) ?? 0) + Number(t.gross_amount ?? 0));
    });
    return [...map.entries()].map(([provider, volume]) => ({ provider, volume })).sort((a, b) => b.volume - a.volume).slice(0, 6);
  }, [txs]);

  const growth = stats && stats.volume7dPrev > 0 ? ((stats.volume7d - stats.volume7dPrev) / stats.volume7dPrev) * 100 : null;

  return (
    <AdminShell title="Platform overview" subtitle="Real-time snapshot of everything running on PayNOC.">
      {/* Alerts */}
      {stats && (stats.pendingKyc > 0 || stats.openDisputes > 0 || stats.openIncidents > 0) && (
        <div className="mb-6 grid gap-3 sm:grid-cols-3">
          {stats.pendingKyc > 0 && (
            <AlertCard to="/admin/kyc" icon={ShieldCheck} label="KYC pending" value={stats.pendingKyc} tone="amber" />
          )}
          {stats.openDisputes > 0 && (
            <AlertCard to="/admin/platform" icon={Gavel} label="Open disputes" value={stats.openDisputes} tone="red" />
          )}
          {stats.openIncidents > 0 && (
            <AlertCard to="/admin/platform/incidents" icon={AlertTriangle} label="Active incidents" value={stats.openIncidents} tone="red" />
          )}
        </div>
      )}

      {/* Primary KPIs */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Kpi label="Gross volume (30d)" value={stats ? `৳ ${Math.round(stats.volume).toLocaleString()}` : "—"} icon={DollarSign} sub={growth != null ? `${growth >= 0 ? "▲" : "▼"} ${Math.abs(growth).toFixed(1)}% vs prev 7d` : undefined} good={growth != null ? growth >= 0 : undefined} />
        <Kpi label="Today" value={stats ? `৳ ${Math.round(stats.todayVolume).toLocaleString()}` : "—"} icon={Activity} sub={stats ? `${stats.todayTx} transactions` : undefined} />
        <Kpi label="Merchants" value={stats?.merchants ?? "—"} icon={Users} sub={stats ? `+${stats.merchants7d} in 7d` : undefined} />
        <Kpi label="MRR (est.)" value={stats ? `৳ ${Math.round(stats.mrr).toLocaleString()}` : "—"} icon={Package} sub={stats ? `${stats.activeSubs} active subs` : undefined} />
      </div>

      <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <MiniStat label="Invoices" value={stats?.invoices ?? "—"} to="/admin/invoices" />
        <MiniStat label="Transactions" value={stats?.transactions ?? "—"} to="/admin/transactions" />
        <MiniStat label="KYC pending" value={stats?.pendingKyc ?? "—"} to="/admin/kyc" />
        <MiniStat label="Open disputes" value={stats?.openDisputes ?? "—"} to="/admin/platform" />
      </div>

      {/* Charts */}
      <div className="mt-8 grid gap-4 lg:grid-cols-3">
        <div className="glass rounded-2xl border border-glass-border p-6 lg:col-span-2">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <h2 className="font-display text-base font-semibold">Volume (30 days)</h2>
              <p className="text-xs text-muted-foreground">Daily verified transaction volume</p>
            </div>
          </div>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chart30}>
                <defs>
                  <linearGradient id="v" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity={0.35} />
                    <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.3} />
                <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => v >= 1000 ? `${Math.round(v / 1000)}k` : String(v)} />
                <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8, fontSize: 12 }} formatter={(v: any) => [`৳ ${Number(v).toLocaleString()}`, "Volume"]} />
                <Area type="monotone" dataKey="volume" stroke="hsl(var(--primary))" fill="url(#v)" strokeWidth={2} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="glass rounded-2xl border border-glass-border p-6">
          <h2 className="mb-4 font-display text-base font-semibold">Top providers</h2>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={providerBreakdown} layout="vertical" margin={{ left: 10 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.3} horizontal={false} />
                <XAxis type="number" tick={{ fontSize: 11 }} tickFormatter={(v) => v >= 1000 ? `${Math.round(v / 1000)}k` : String(v)} />
                <YAxis type="category" dataKey="provider" tick={{ fontSize: 11 }} width={70} />
                <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8, fontSize: 12 }} formatter={(v: any) => [`৳ ${Number(v).toLocaleString()}`, "Volume"]} />
                <Bar dataKey="volume" radius={[0, 6, 6, 0]}>
                  {providerBreakdown.map((_, i) => <Cell key={i} fill="hsl(var(--primary))" fillOpacity={0.85 - i * 0.12} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Feeds */}
      <div className="mt-4 grid gap-4 lg:grid-cols-3">
        <div className="glass rounded-2xl border border-glass-border p-6">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="font-display text-base font-semibold">Top merchants (30d)</h2>
            <Link to="/admin/merchants" className="text-xs text-brand hover:underline">All →</Link>
          </div>
          <div className="space-y-3">
            {topMerchants.length === 0 && <p className="text-sm text-muted-foreground">No verified activity yet.</p>}
            {topMerchants.map((m, i) => (
              <Link key={m.id} to="/admin/merchants/$id" params={{ id: m.id }} className="flex items-center justify-between rounded-lg border border-glass-border/60 p-3 hover:bg-muted/40">
                <div className="flex items-center gap-3">
                  <span className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary">{i + 1}</span>
                  <div>
                    <p className="text-sm font-medium">{m.name}</p>
                    <p className="text-xs text-muted-foreground">{m.count} tx</p>
                  </div>
                </div>
                <p className="font-mono text-sm">৳ {Math.round(m.volume).toLocaleString()}</p>
              </Link>
            ))}
          </div>
        </div>

        <div className="glass rounded-2xl border border-glass-border p-6">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="font-display text-base font-semibold">Recent invoices</h2>
            <Link to="/admin/invoices" className="text-xs text-brand hover:underline">All →</Link>
          </div>
          <div className="space-y-2">
            {recentInvoices.length === 0 && <p className="text-sm text-muted-foreground">No invoices yet.</p>}
            {recentInvoices.map((i) => (
              <div key={i.id} className="flex items-center justify-between rounded-lg border border-glass-border/60 p-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">{i.invoice_number || i.id.slice(0, 8)}</p>
                  <p className="truncate text-xs text-muted-foreground">{i.customer_name || "—"}</p>
                </div>
                <div className="text-right">
                  <p className="font-mono text-sm">৳ {Number(i.amount ?? 0).toLocaleString()}</p>
                  <StatusBadge status={i.status} />
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="glass rounded-2xl border border-glass-border p-6">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="font-display text-base font-semibold">Audit trail</h2>
            <Link to="/admin/audit" className="text-xs text-brand hover:underline">All →</Link>
          </div>
          <div className="space-y-2">
            {audit.length === 0 && <p className="text-sm text-muted-foreground">Nothing logged yet.</p>}
            {audit.map((a) => (
              <div key={a.id} className="rounded-lg border border-glass-border/60 p-3">
                <p className="text-sm font-medium">{a.action}</p>
                <p className="text-xs text-muted-foreground">{a.entity_type} · {new Date(a.created_at).toLocaleString()}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </AdminShell>
  );
}

function Kpi({ label, value, icon: Icon, sub, good }: { label: string; value: string | number; icon: any; sub?: string; good?: boolean }) {
  return (
    <div className="glass rounded-2xl border border-glass-border p-6">
      <div className="flex items-center justify-between">
        <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">{label}</p>
        <Icon className="h-4 w-4 text-muted-foreground" />
      </div>
      <p className="mt-2 font-display text-3xl font-bold">{value}</p>
      {sub && (
        <p className={`mt-1 flex items-center gap-1 text-xs ${good == null ? "text-muted-foreground" : good ? "text-emerald-500" : "text-red-500"}`}>
          {good === true && <TrendingUp className="h-3 w-3" />}
          {good === false && <TrendingDown className="h-3 w-3" />}
          {sub}
        </p>
      )}
    </div>
  );
}

function MiniStat({ label, value, to }: { label: string; value: string | number; to: string }) {
  return (
    <Link to={to} className="glass rounded-xl border border-glass-border p-4 transition hover:border-primary/40">
      <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">{label}</p>
      <p className="mt-1 font-display text-xl font-semibold">{value}</p>
    </Link>
  );
}

function AlertCard({ to, icon: Icon, label, value, tone }: { to: string; icon: any; label: string; value: number; tone: "amber" | "red" }) {
  const cls = tone === "red" ? "border-red-500/30 bg-red-500/5 text-red-500" : "border-amber-500/30 bg-amber-500/5 text-amber-500";
  return (
    <Link to={to} className={`flex items-center justify-between rounded-xl border p-4 transition hover:brightness-110 ${cls}`}>
      <div className="flex items-center gap-3">
        <Icon className="h-5 w-5" />
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider">{label}</p>
          <p className="font-display text-xl font-bold">{value}</p>
        </div>
      </div>
      <span className="text-xs opacity-70">Review →</span>
    </Link>
  );
}

function StatusBadge({ status }: { status: string }) {
  const tone = status === "paid" || status === "verified" ? "bg-emerald-500/10 text-emerald-500"
    : status === "pending" ? "bg-amber-500/10 text-amber-500"
    : status === "failed" || status === "cancelled" ? "bg-red-500/10 text-red-500"
    : "bg-muted text-muted-foreground";
  return <span className={`mt-0.5 inline-block rounded px-1.5 py-0.5 text-[10px] font-medium uppercase ${tone}`}>{status}</span>;
}
