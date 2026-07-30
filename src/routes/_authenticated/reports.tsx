import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { MerchantShell } from "@/components/merchant-shell";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { useActiveMerchant } from "@/hooks/use-active-merchant";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Download, TrendingUp, PieChart as PieIcon, Activity } from "lucide-react";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  Legend,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from "recharts";

export const Route = createFileRoute("/_authenticated/reports")({
  head: () => ({ meta: [{ title: "Reports · PayNOC" }] }),
  component: ReportsPage,
});

type Row = {
  id: string;
  invoice_number: string;
  amount: number;
  currency: string;
  status: string;
  method_type: string | null;
  customer_name: string | null;
  customer_email: string | null;
  created_at: string;
  paid_at: string | null;
};

const PIE_COLORS = ["#6366f1", "#22c55e", "#f59e0b", "#ec4899", "#06b6d4", "#8b5cf6", "#ef4444", "#14b8a6"];

function toCSV(rows: Row[]) {
  const headers = ["invoice_number", "amount", "currency", "status", "method_type", "customer_name", "customer_email", "created_at", "paid_at"];
  const esc = (v: unknown) => {
    const s = v == null ? "" : String(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  return [headers.join(","), ...rows.map((r) => headers.map((h) => esc((r as never)[h])).join(","))].join("\n");
}

function ReportsPage() {
  const { user } = useAuth();
  const { merchantId: activeMerchantId } = useActiveMerchant();
  const [rows, setRows] = useState<Row[]>([]);
  const [days, setDays] = useState(30);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    const since = new Date(Date.now() - days * 86_400_000).toISOString();
    setLoading(true);
    supabase
      .from("invoices")
      .select("id, invoice_number, amount, currency, status, method_type, customer_name, customer_email, created_at, paid_at")
      .eq("merchant_id", activeMerchantId ?? user.id)
      .gte("created_at", since)
      .order("created_at", { ascending: false })
      .then(({ data }) => {
        setRows((data ?? []) as Row[]);
        setLoading(false);
      });
  }, [user, days, activeMerchantId]);

  const {
    chart, monthly, methodBreakdown, statusBreakdown,
    totalVolume, paidCount, avgTicket, successRate, totalCount,
  } = useMemo(() => {
    const byDay = new Map<string, number>();
    const byMonth = new Map<string, number>();
    const byMethod = new Map<string, { count: number; volume: number }>();
    const byStatus = new Map<string, number>();
    let vol = 0;
    let paid = 0;
    let terminal = 0; // completed + failed + expired + refunded

    for (const r of rows) {
      byStatus.set(r.status, (byStatus.get(r.status) ?? 0) + 1);
      if (["completed", "failed", "expired", "refunded"].includes(r.status)) terminal += 1;

      if (r.status === "completed") {
        const day = (r.paid_at ?? r.created_at).slice(0, 10);
        byDay.set(day, (byDay.get(day) ?? 0) + Number(r.amount));
        const month = day.slice(0, 7);
        byMonth.set(month, (byMonth.get(month) ?? 0) + Number(r.amount));
        vol += Number(r.amount);
        paid += 1;

        const m = r.method_type ?? "unknown";
        const cur = byMethod.get(m) ?? { count: 0, volume: 0 };
        byMethod.set(m, { count: cur.count + 1, volume: cur.volume + Number(r.amount) });
      }
    }

    const chart = Array.from({ length: days }, (_, i) => {
      const d = new Date(Date.now() - (days - 1 - i) * 86_400_000).toISOString().slice(0, 10);
      return { date: d.slice(5), volume: byDay.get(d) ?? 0 };
    });

    const monthly = Array.from(byMonth.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([month, volume]) => ({ month, volume }));

    const methodBreakdown = Array.from(byMethod.entries())
      .map(([name, v]) => ({ name, count: v.count, volume: v.volume }))
      .sort((a, b) => b.volume - a.volume);

    const statusBreakdown = Array.from(byStatus.entries()).map(([name, value]) => ({ name, value }));

    return {
      chart, monthly, methodBreakdown, statusBreakdown,
      totalVolume: vol,
      paidCount: paid,
      totalCount: rows.length,
      avgTicket: paid ? vol / paid : 0,
      successRate: terminal ? (paid / terminal) * 100 : 0,
    };
  }, [rows, days]);

  const download = () => {
    const csv = toCSV(rows);
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `paynoc-invoices-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <MerchantShell
      title="Reports"
      subtitle={`Last ${days} days · ${totalCount} invoices`}
      actions={
        <div className="flex items-center gap-2">
          {[7, 30, 90, 180].map((d) => (
            <Button key={d} size="sm" variant={d === days ? "default" : "outline"} onClick={() => setDays(d)}>
              {d}d
            </Button>
          ))}
          <Button size="sm" variant="outline" onClick={download} disabled={!rows.length}>
            <Download className="mr-1.5 h-4 w-4" /> Export CSV
          </Button>
        </div>
      }
    >
      <div className="grid gap-4 md:grid-cols-4">
        <Card className="p-5">
          <p className="text-xs text-muted-foreground">Gross volume</p>
          <p className="mt-1 font-display text-2xl">৳ {totalVolume.toLocaleString()}</p>
        </Card>
        <Card className="p-5">
          <p className="text-xs text-muted-foreground">Paid invoices</p>
          <p className="mt-1 font-display text-2xl">{paidCount}</p>
        </Card>
        <Card className="p-5">
          <p className="text-xs text-muted-foreground">Average ticket</p>
          <p className="mt-1 font-display text-2xl">৳ {avgTicket.toFixed(0)}</p>
        </Card>
        <Card className="p-5">
          <p className="text-xs text-muted-foreground">Success rate</p>
          <p className="mt-1 font-display text-2xl">{successRate.toFixed(1)}%</p>
        </Card>
      </div>

      <Card className="mt-6 p-5">
        <div className="mb-4 flex items-center gap-2">
          <TrendingUp className="h-4 w-4 text-brand" />
          <h3 className="font-medium">Revenue over time</h3>
        </div>
        <div className="h-72 w-full">
          {loading ? (
            <div className="flex h-full items-center justify-center text-sm text-muted-foreground">Loading…</div>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chart}>
                <defs>
                  <linearGradient id="rev" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="hsl(var(--brand))" stopOpacity={0.5} />
                    <stop offset="100%" stopColor="hsl(var(--brand))" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--glass-border))" />
                <XAxis dataKey="date" stroke="hsl(var(--muted-foreground))" fontSize={11} />
                <YAxis stroke="hsl(var(--muted-foreground))" fontSize={11} />
                <Tooltip
                  contentStyle={{
                    background: "hsl(var(--card))",
                    border: "1px solid hsl(var(--glass-border))",
                    borderRadius: 8,
                    fontSize: 12,
                  }}
                />
                <Area type="monotone" dataKey="volume" stroke="hsl(var(--brand))" fill="url(#rev)" strokeWidth={2} />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </div>
      </Card>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <Card className="p-5">
          <div className="mb-4 flex items-center gap-2">
            <Activity className="h-4 w-4 text-brand" />
            <h3 className="font-medium">Monthly recurring revenue</h3>
          </div>
          <div className="h-64 w-full">
            {monthly.length === 0 ? (
              <div className="flex h-full items-center justify-center text-sm text-muted-foreground">No paid invoices yet</div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={monthly}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--glass-border))" />
                  <XAxis dataKey="month" stroke="hsl(var(--muted-foreground))" fontSize={11} />
                  <YAxis stroke="hsl(var(--muted-foreground))" fontSize={11} />
                  <Tooltip
                    contentStyle={{
                      background: "hsl(var(--card))",
                      border: "1px solid hsl(var(--glass-border))",
                      borderRadius: 8,
                      fontSize: 12,
                    }}
                  />
                  <Bar dataKey="volume" fill="hsl(var(--brand))" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </Card>

        <Card className="p-5">
          <div className="mb-4 flex items-center gap-2">
            <PieIcon className="h-4 w-4 text-brand" />
            <h3 className="font-medium">Status breakdown</h3>
          </div>
          <div className="h-64 w-full">
            {statusBreakdown.length === 0 ? (
              <div className="flex h-full items-center justify-center text-sm text-muted-foreground">No data</div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={statusBreakdown} dataKey="value" nameKey="name" outerRadius={90} label>
                    {statusBreakdown.map((_, i) => (
                      <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                    ))}
                  </Pie>
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                  <Tooltip
                    contentStyle={{
                      background: "hsl(var(--card))",
                      border: "1px solid hsl(var(--glass-border))",
                      borderRadius: 8,
                      fontSize: 12,
                    }}
                  />
                </PieChart>
              </ResponsiveContainer>
            )}
          </div>
        </Card>
      </div>

      <Card className="mt-6 overflow-hidden">
        <div className="border-b border-glass-border p-5">
          <h3 className="font-medium">Payment method performance</h3>
          <p className="text-xs text-muted-foreground">Completed invoices grouped by payment method</p>
        </div>
        <table className="w-full text-sm">
          <thead className="bg-muted/30 text-left text-xs uppercase tracking-wide text-muted-foreground">
            <tr>
              <th className="px-4 py-3">Method</th>
              <th className="px-4 py-3">Transactions</th>
              <th className="px-4 py-3">Volume</th>
              <th className="px-4 py-3">Share</th>
            </tr>
          </thead>
          <tbody>
            {methodBreakdown.length === 0 ? (
              <tr><td colSpan={4} className="p-8 text-center text-muted-foreground">No completed payments yet</td></tr>
            ) : methodBreakdown.map((m) => {
              const share = totalVolume ? (m.volume / totalVolume) * 100 : 0;
              return (
                <tr key={m.name} className="border-t border-glass-border">
                  <td className="px-4 py-3 font-medium capitalize">{m.name}</td>
                  <td className="px-4 py-3">{m.count}</td>
                  <td className="px-4 py-3">৳ {m.volume.toLocaleString()}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <div className="h-1.5 w-24 overflow-hidden rounded-full bg-muted">
                        <div className="h-full bg-brand" style={{ width: `${share}%` }} />
                      </div>
                      <span className="text-xs text-muted-foreground">{share.toFixed(1)}%</span>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </Card>
    </MerchantShell>
  );
}
