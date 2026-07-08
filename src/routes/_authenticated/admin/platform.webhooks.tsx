import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { AdminShell } from "@/components/admin-shell";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { RefreshCcw } from "lucide-react";

export const Route = createFileRoute("/_authenticated/admin/platform/webhooks")({
  head: () => ({ meta: [{ title: "Webhook health · Admin" }] }),
  component: WhPage,
});

type Row = {
  id: string;
  merchant_id: string;
  event: string;
  url: string;
  status: string;
  http_status: number | null;
  attempts: number;
  created_at: string;
  next_retry_at: string | null;
};

function WhPage() {
  const [rows, setRows] = useState<Row[]>([]);
  const [names, setNames] = useState<Record<string, string>>({});
  const [status, setStatus] = useState("");

  const load = async () => {
    const { data } = await supabase
      .from("webhook_deliveries")
      .select("id, merchant_id, event, url, status, http_status, attempts, created_at, next_retry_at")
      .order("created_at", { ascending: false })
      .limit(500);
    const r = (data ?? []) as Row[];
    setRows(r);
    const ids = Array.from(new Set(r.map((x) => x.merchant_id)));
    if (ids.length > 0) {
      const { data: profs } = await supabase.from("profiles").select("id, business_name, email").in("id", ids);
      const map: Record<string, string> = {};
      (profs ?? []).forEach((p) => (map[p.id] = p.business_name || p.email));
      setNames(map);
    }
  };
  useEffect(() => { load(); }, []);

  const requeue = async (id: string) => {
    const { error } = await supabase
      .from("webhook_deliveries")
      .update({ status: "pending", next_retry_at: new Date().toISOString() })
      .eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Requeued for retry");
    load();
  };

  const totals = {
    total: rows.length,
    success: rows.filter((r) => r.status === "success").length,
    failed: rows.filter((r) => r.status === "failed").length,
    pending: rows.filter((r) => r.status === "pending").length,
  };
  const filtered = rows.filter((r) => (status ? r.status === status : true));

  return (
    <AdminShell title="Webhook health" subtitle="Every outbound webhook delivery, retries, and failures.">
      <div className="mb-4 grid gap-3 sm:grid-cols-4">
        <Stat label="Total" value={totals.total} />
        <Stat label="Success" value={totals.success} tone="success" />
        <Stat label="Failed" value={totals.failed} tone="destructive" />
        <Stat label="Pending" value={totals.pending} tone="warning" />
      </div>

      <div className="mb-3 flex items-center gap-3">
        <select value={status} onChange={(e) => setStatus(e.target.value)} className="rounded-lg border border-glass-border bg-card/60 px-3 py-2 text-sm">
          <option value="">All</option>
          <option>success</option><option>failed</option><option>pending</option>
        </select>
        <Button size="sm" variant="outline" onClick={load}><RefreshCcw className="mr-1.5 h-4 w-4" />Refresh</Button>
        <span className="text-xs text-muted-foreground">{filtered.length} shown</span>
      </div>

      <div className="glass overflow-x-auto rounded-2xl border border-glass-border">
        <table className="w-full text-sm">
          <thead className="bg-card/40 text-left text-xs uppercase tracking-wider text-muted-foreground">
            <tr>
              <th className="px-4 py-3">When</th>
              <th className="px-4 py-3">Merchant</th>
              <th className="px-4 py-3">Event</th>
              <th className="px-4 py-3">URL</th>
              <th className="px-4 py-3">HTTP</th>
              <th className="px-4 py-3">Attempts</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody>
            {filtered.map((r) => (
              <tr key={r.id} className="border-t border-glass-border">
                <td className="px-4 py-2 text-muted-foreground">{new Date(r.created_at).toLocaleString()}</td>
                <td className="px-4 py-2">{names[r.merchant_id] ?? r.merchant_id.slice(0,8)}</td>
                <td className="px-4 py-2 font-mono text-xs">{r.event}</td>
                <td className="px-4 py-2 max-w-xs truncate font-mono text-xs text-muted-foreground" title={r.url}>{r.url}</td>
                <td className="px-4 py-2">{r.http_status ?? "—"}</td>
                <td className="px-4 py-2">{r.attempts}</td>
                <td className="px-4 py-2"><Badge variant="outline" className="capitalize">{r.status}</Badge></td>
                <td className="px-4 py-2 text-right">
                  {r.status === "failed" && (
                    <Button size="sm" variant="outline" onClick={() => requeue(r.id)}>
                      Retry
                    </Button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </AdminShell>
  );
}

function Stat({ label, value, tone }: { label: string; value: number; tone?: "success" | "destructive" | "warning" }) {
  const toneMap = {
    success: "text-success",
    destructive: "text-destructive",
    warning: "text-warning",
  };
  return (
    <div className="glass rounded-2xl border border-glass-border p-5">
      <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">{label}</p>
      <p className={`mt-1 font-display text-3xl font-bold ${tone ? toneMap[tone] : ""}`}>{value}</p>
    </div>
  );
}
