import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { MerchantShell } from "@/components/merchant-shell";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Download, TrendingUp } from "lucide-react";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
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
  customer_name: string | null;
  customer_email: string | null;
  created_at: string;
  paid_at: string | null;
};

function toCSV(rows: Row[]) {
  const headers = ["invoice_number", "amount", "currency", "status", "customer_name", "customer_email", "created_at", "paid_at"];
  const esc = (v: unknown) => {
    const s = v == null ? "" : String(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  return [headers.join(","), ...rows.map((r) => headers.map((h) => esc((r as never)[h])).join(","))].join("\n");
}

function ReportsPage() {
  const { user } = useAuth();
  const [rows, setRows] = useState<Row[]>([]);
  const [days, setDays] = useState(30);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    const since = new Date(Date.now() - days * 86_400_000).toISOString();
    setLoading(true);
    supabase
      .from("invoices")
      .select("id, invoice_number, amount, currency, status, customer_name, customer_email, created_at, paid_at")
      .eq("merchant_id", user.id)
      .gte("created_at", since)
      .order("created_at", { ascending: false })
      .then(({ data }) => {
        setRows((data ?? []) as Row[]);
        setLoading(false);
      });
  }, [user, days]);

  const { chart, totalVolume, paidCount, avgTicket } = useMemo(() => {
    const byDay = new Map<string, number>();
    let vol = 0;
    let paid = 0;
    for (const r of rows) {
      if (r.status === "completed") {
        const day = (r.paid_at ?? r.created_at).slice(0, 10);
        byDay.set(day, (byDay.get(day) ?? 0) + Number(r.amount));
        vol += Number(r.amount);
        paid += 1;
      }
    }
    const chart = Array.from({ length: days }, (_, i) => {
      const d = new Date(Date.now() - (days - 1 - i) * 86_400_000).toISOString().slice(0, 10);
      return { date: d.slice(5), volume: byDay.get(d) ?? 0 };
    });
    return { chart, totalVolume: vol, paidCount: paid, avgTicket: paid ? vol / paid : 0 };
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
      subtitle={`Last ${days} days`}
      actions={
        <div className="flex items-center gap-2">
          {[7, 30, 90].map((d) => (
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
      <div className="grid gap-4 md:grid-cols-3">
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
    </MerchantShell>
  );
}
