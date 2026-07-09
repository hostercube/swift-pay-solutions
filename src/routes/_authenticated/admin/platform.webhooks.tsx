import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { AdminShell } from "@/components/admin-shell";
import { DataTable, type DataTableColumn } from "@/components/data-table";
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

  return (
    <AdminShell title="Webhook health" subtitle="Every outbound webhook delivery, retries, and failures.">
      <div className="mb-4 grid gap-3 sm:grid-cols-4">
        <Stat label="Total" value={totals.total} />
        <Stat label="Success" value={totals.success} tone="success" />
        <Stat label="Failed" value={totals.failed} tone="destructive" />
        <Stat label="Pending" value={totals.pending} tone="warning" />
      </div>

      <DataTable<Row>
        rows={rows}
        rowKey={(r) => r.id}
        searchable={(r) => `${r.event} ${r.url} ${names[r.merchant_id] ?? r.merchant_id}`}
        dateField={(r) => r.created_at}
        filters={[
          {
            key: "status",
            label: "Status",
            options: [
              { value: "success", label: "Success" },
              { value: "failed", label: "Failed" },
              { value: "pending", label: "Pending" },
            ],
            match: (r, v) => r.status === v,
          },
          {
            key: "http",
            label: "HTTP",
            options: [
              { value: "2xx", label: "2xx" },
              { value: "4xx", label: "4xx" },
              { value: "5xx", label: "5xx" },
              { value: "none", label: "No response" },
            ],
            match: (r, v) => {
              if (v === "none") return r.http_status == null;
              const n = r.http_status ?? 0;
              return v === "2xx" ? n >= 200 && n < 300 : v === "4xx" ? n >= 400 && n < 500 : n >= 500;
            },
          },
        ]}
        toolbar={
          <Button size="sm" variant="outline" onClick={load}>
            <RefreshCcw className="mr-1.5 h-4 w-4" />Refresh
          </Button>
        }
        columns={[
          { key: "when", label: "When", render: (r) => <span className="text-muted-foreground">{new Date(r.created_at).toLocaleString()}</span> },
          { key: "merchant", label: "Merchant", render: (r) => names[r.merchant_id] ?? r.merchant_id.slice(0, 8) },
          { key: "event", label: "Event", render: (r) => <span className="font-mono text-xs">{r.event}</span> },
          { key: "url", label: "URL", render: (r) => <span className="block max-w-xs truncate font-mono text-xs text-muted-foreground" title={r.url}>{r.url}</span> },
          { key: "http", label: "HTTP", render: (r) => r.http_status ?? "—" },
          { key: "attempts", label: "Attempts", render: (r) => r.attempts },
          { key: "status", label: "Status", render: (r) => <Badge variant="outline" className="capitalize">{r.status}</Badge> },
        ] as DataTableColumn<Row>[]}
        actions={(r) => r.status === "failed" ? (
          <Button size="sm" variant="outline" onClick={() => requeue(r.id)}>Retry</Button>
        ) : null}
      />
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
