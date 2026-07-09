import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { MerchantShell } from "@/components/merchant-shell";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import {
  DollarSign, Activity, Receipt, Clock, TrendingUp, TrendingDown,
  Plus, KeyRound, Webhook, Plug,
} from "lucide-react";
import {
  Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from "recharts";

export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => ({ meta: [{ title: "Dashboard · PayNOC" }] }),
  component: DashboardPage,
});

type Tx = { id: string; created_at: string; gross_amount: number; status: string; method_type: string; invoice_id: string };

function DashboardPage() {
  const { user } = useAuth();
  const [profile, setProfile] = useState<{ business_name: string | null; full_name: string | null } | null>(null);
  const [txs, setTxs] = useState<Tx[]>([]);
  const [recentInvoices, setRecentInvoices] = useState<any[]>([]);
  const [counts, setCounts] = useState<{ invoices: number; pending: number; disputes: number } | null>(null);

  useEffect(() => {
    if (!user) return;
    (async () => {
      const d30 = new Date(Date.now() - 30 * 864e5).toISOString();
      const [p, tx, inv, invCount, pendCount, dispCount] = await Promise.all([
        supabase.from("profiles").select("business_name, full_name").eq("id", user.id).maybeSingle(),
        supabase.from("transactions").select("id,created_at,gross_amount,status,method_type,invoice_id").eq("merchant_id", user.id).gte("created_at", d30).order("created_at", { ascending: false }).limit(500),
        supabase.from("invoices").select("id,invoice_number,amount,status,created_at,customer_name").eq("merchant_id", user.id).order("created_at", { ascending: false }).limit(6),
        supabase.from("invoices").select("*", { count: "exact", head: true }).eq("merchant_id", user.id),
        supabase.from("invoices").select("*", { count: "exact", head: true }).eq("merchant_id", user.id).eq("status", "pending"),
        supabase.from("disputes").select("*", { count: "exact", head: true }).eq("merchant_id", user.id).in("status", ["open", "under_review"]),
      ]);
      setProfile(p.data);
      setTxs((tx.data ?? []) as Tx[]);
      setRecentInvoices(inv.data ?? []);
      setCounts({ invoices: invCount.count ?? 0, pending: pendCount.count ?? 0, disputes: dispCount.count ?? 0 });
    })();
  }, [user]);

  const stats = useMemo(() => {
    const now = Date.now();
    const startToday = new Date(new Date().getFullYear(), new Date().getMonth(), new Date().getDate()).getTime();
    const d7 = now - 7 * 864e5;
    const d14 = now - 14 * 864e5;
    const verified = txs.filter(t => t.status === "verified");
    const sum = (arr: Tx[]) => arr.reduce((s, t) => s + Number(t.gross_amount ?? 0), 0);
    const vol30 = sum(verified);
    const vol7 = sum(verified.filter(t => new Date(t.created_at).getTime() >= d7));
    const vol7prev = sum(verified.filter(t => { const ts = new Date(t.created_at).getTime(); return ts >= d14 && ts < d7; }));
    const today = verified.filter(t => new Date(t.created_at).getTime() >= startToday);
    const successRate = txs.length ? (verified.length / txs.length) * 100 : 0;
    return {
      vol30, vol7, vol7prev, todayVol: sum(today), todayCount: today.length,
      paidAll: verified.length, successRate,
    };
  }, [txs]);

  const chart30 = useMemo(() => {
    const buckets = new Map<string, { date: string; volume: number }>();
    for (let i = 29; i >= 0; i--) {
      const d = new Date(Date.now() - i * 864e5);
      const key = d.toISOString().slice(0, 10);
      buckets.set(key, { date: key.slice(5), volume: 0 });
    }
    txs.filter(t => t.status === "verified").forEach(t => {
      const k = t.created_at.slice(0, 10);
      const b = buckets.get(k);
      if (b) b.volume += Number(t.gross_amount ?? 0);
    });
    return [...buckets.values()];
  }, [txs]);

  const growth = stats.vol7prev > 0 ? ((stats.vol7 - stats.vol7prev) / stats.vol7prev) * 100 : null;

  return (
    <MerchantShell
      title={profile?.business_name || profile?.full_name || "Welcome"}
      subtitle="Real-time snapshot of your PayNOC account."
    >
      {/* KPIs */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Kpi label="Volume (30d)" value={`৳ ${Math.round(stats.vol30).toLocaleString()}`} icon={DollarSign} sub={growth != null ? `${growth >= 0 ? "▲" : "▼"} ${Math.abs(growth).toFixed(1)}% vs prev 7d` : "Verified only"} good={growth != null ? growth >= 0 : undefined} />
        <Kpi label="Today" value={`৳ ${Math.round(stats.todayVol).toLocaleString()}`} icon={Activity} sub={`${stats.todayCount} payments`} />
        <Kpi label="Success rate" value={`${stats.successRate.toFixed(1)}%`} icon={TrendingUp} sub={`${stats.paidAll} verified / ${txs.length} total`} />
        <Kpi label="Pending invoices" value={counts?.pending ?? "—"} icon={Clock} sub={counts ? `${counts.invoices} total invoices` : undefined} />
      </div>

      {/* Chart + Quick actions */}
      <div className="mt-6 grid gap-4 lg:grid-cols-3">
        <div className="glass rounded-2xl border border-glass-border p-6 lg:col-span-2">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <h2 className="font-display text-base font-semibold">Revenue (30 days)</h2>
              <p className="text-xs text-muted-foreground">Verified transaction volume</p>
            </div>
          </div>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chart30}>
                <defs>
                  <linearGradient id="rev" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity={0.35} />
                    <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.3} />
                <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => v >= 1000 ? `${Math.round(v / 1000)}k` : String(v)} />
                <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8, fontSize: 12 }} formatter={(v: any) => [`৳ ${Number(v).toLocaleString()}`, "Volume"]} />
                <Area type="monotone" dataKey="volume" stroke="hsl(var(--primary))" fill="url(#rev)" strokeWidth={2} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="glass rounded-2xl border border-glass-border p-6">
          <h2 className="mb-4 font-display text-base font-semibold">Quick actions</h2>
          <div className="space-y-2">
            <QuickAction to="/invoices/new" icon={Plus} label="Create invoice" desc="Bill a customer instantly" />
            <QuickAction to="/integrations" icon={Plug} label="Connect gateway" desc="Add bKash, Stripe, etc." />
            <QuickAction to="/security/api-keys" icon={KeyRound} label="API keys" desc="Integrate checkout" />
            <QuickAction to="/webhooks" icon={Webhook} label="Webhooks" desc="Receive payment events" />
          </div>
        </div>
      </div>

      {/* Recent activity */}
      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <div className="glass rounded-2xl border border-glass-border p-6">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="font-display text-base font-semibold">Recent transactions</h2>
            <Link to="/transactions" className="text-xs text-brand hover:underline">All →</Link>
          </div>
          <div className="space-y-2">
            {txs.length === 0 && <p className="text-sm text-muted-foreground">No transactions yet.</p>}
            {txs.slice(0, 6).map((t) => (
              <div key={t.id} className="flex items-center justify-between rounded-lg border border-glass-border/60 p-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium capitalize">{t.method_type}</p>
                  <p className="text-xs text-muted-foreground">{new Date(t.created_at).toLocaleString()}</p>
                </div>
                <div className="text-right">
                  <p className="font-mono text-sm">৳ {Number(t.gross_amount).toLocaleString()}</p>
                  <StatusBadge status={t.status} />
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="glass rounded-2xl border border-glass-border p-6">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="font-display text-base font-semibold">Recent invoices</h2>
            <Link to="/invoices" className="text-xs text-brand hover:underline">All →</Link>
          </div>
          <div className="space-y-2">
            {recentInvoices.length === 0 && (
              <div className="rounded-lg border border-dashed border-glass-border p-6 text-center">
                <p className="text-sm text-muted-foreground">No invoices yet.</p>
                <Link to="/invoices/new" className="mt-2 inline-block text-xs text-brand hover:underline">Create your first →</Link>
              </div>
            )}
            {recentInvoices.map((i) => (
              <Link key={i.id} to="/invoices/$id" params={{ id: i.id }} className="flex items-center justify-between rounded-lg border border-glass-border/60 p-3 hover:bg-muted/40">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">{i.invoice_number || i.id.slice(0, 8)}</p>
                  <p className="truncate text-xs text-muted-foreground">{i.customer_name || "—"}</p>
                </div>
                <div className="text-right">
                  <p className="font-mono text-sm">৳ {Number(i.amount ?? 0).toLocaleString()}</p>
                  <StatusBadge status={i.status} />
                </div>
              </Link>
            ))}
          </div>
        </div>
      </div>
    </MerchantShell>
  );
}

function Kpi({ label, value, icon: Icon, sub, good }: { label: string; value: string | number; icon: any; sub?: string; good?: boolean }) {
  return (
    <div className="glass rounded-2xl border border-glass-border p-6">
      <div className="flex items-center justify-between">
        <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">{label}</p>
        <Icon className="h-4 w-4 text-muted-foreground" />
      </div>
      <p className="mt-2 font-display text-3xl font-bold text-foreground">{value}</p>
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

function QuickAction({ to, icon: Icon, label, desc }: { to: string; icon: any; label: string; desc: string }) {
  return (
    <Link to={to} className="flex items-center gap-3 rounded-lg border border-glass-border/60 p-3 transition hover:border-primary/40 hover:bg-muted/40">
      <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
        <Icon className="h-4 w-4" />
      </span>
      <div className="min-w-0">
        <p className="text-sm font-medium">{label}</p>
        <p className="truncate text-xs text-muted-foreground">{desc}</p>
      </div>
    </Link>
  );
}

function StatusBadge({ status }: { status: string }) {
  const tone = status === "paid" || status === "verified" ? "bg-emerald-500/10 text-emerald-500"
    : status === "pending" ? "bg-amber-500/10 text-amber-500"
    : status === "failed" || status === "cancelled" || status === "rejected" ? "bg-red-500/10 text-red-500"
    : "bg-muted text-muted-foreground";
  return <span className={`mt-0.5 inline-block rounded px-1.5 py-0.5 text-[10px] font-medium uppercase ${tone}`}>{status}</span>;
}
