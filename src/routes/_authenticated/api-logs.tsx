import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { RefreshCw } from "lucide-react";
import { MerchantShell } from "@/components/merchant-shell";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { useActiveMerchant } from "@/hooks/use-active-merchant";
import { DataTable, type DataTableColumn, type DataTableFilter } from "@/components/data-table";

export const Route = createFileRoute("/_authenticated/api-logs")({
  head: () => ({ meta: [{ title: "API logs · PayNOC" }] }),
  component: ApiLogsPage,
});

type Log = {
  id: string;
  method: string;
  path: string;
  status_code: number;
  latency_ms: number;
  ip_address: string | null;
  error_message: string | null;
  created_at: string;
};

function statusTone(code: number) {
  if (code >= 500) return "bg-red-500/15 text-red-500";
  if (code >= 400) return "bg-amber-500/15 text-amber-500";
  if (code >= 300) return "bg-sky-500/15 text-sky-500";
  return "bg-emerald-500/15 text-emerald-500";
}

function ApiLogsPage() {
  const { user } = useAuth();
  const { merchantId: activeMerchantId } = useActiveMerchant();
  const [logs, setLogs] = useState<Log[]>([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    if (!user) return;
    setLoading(true);
    const { data } = await supabase
      .from("api_request_logs")
      .select("id, method, path, status_code, latency_ms, ip_address, error_message, created_at")
      .eq("merchant_id", activeMerchantId ?? user.id)
      .order("created_at", { ascending: false })
      .limit(500);
    setLogs((data ?? []) as Log[]);
    setLoading(false);
  };

  useEffect(() => { load(); }, [user, activeMerchantId]);

  const successCount = logs.filter((l) => l.status_code < 400).length;
  const errorCount = logs.length - successCount;
  const avgLatency = logs.length ? Math.round(logs.reduce((s, l) => s + l.latency_ms, 0) / logs.length) : 0;

  const columns: DataTableColumn<Log>[] = [
    { key: "created_at", label: "Time", render: (l) => <span className="text-xs text-muted-foreground whitespace-nowrap">{new Date(l.created_at).toLocaleString()}</span> },
    { key: "method", label: "Method", render: (l) => <span className="rounded bg-muted px-1.5 py-0.5 text-xs font-mono">{l.method}</span> },
    { key: "path", label: "Path", render: (l) => <span className="font-mono text-xs">{l.path}</span> },
    { key: "status_code", label: "Status", render: (l) => <span className={`rounded px-2 py-0.5 text-xs font-medium ${statusTone(l.status_code)}`}>{l.status_code}</span> },
    { key: "latency_ms", label: "Latency", render: (l) => <span className="text-xs">{l.latency_ms} ms</span> },
    { key: "ip_address", label: "IP", render: (l) => <span className="text-xs text-muted-foreground">{l.ip_address ?? "—"}</span> },
  ];

  const filters: DataTableFilter<Log>[] = [
    {
      key: "outcome",
      label: "All outcomes",
      options: [
        { value: "success", label: "Success (2xx/3xx)" },
        { value: "client", label: "Client error (4xx)" },
        { value: "server", label: "Server error (5xx)" },
      ],
      match: (l, v) =>
        v === "success" ? l.status_code < 400 :
        v === "client" ? l.status_code >= 400 && l.status_code < 500 :
        l.status_code >= 500,
    },
    {
      key: "method",
      label: "All methods",
      options: Array.from(new Set(logs.map((l) => l.method))).map((m) => ({ value: m, label: m })),
      match: (l, v) => l.method === v,
    },
  ];

  return (
    <MerchantShell title="API logs" subtitle="Recent API requests to your account.">
      <div className="grid gap-4 sm:grid-cols-3">
        <Stat label="Requests" value={logs.length} />
        <Stat label="Success rate" value={logs.length ? `${Math.round((successCount / logs.length) * 100)}%` : "—"} hint={`${successCount} ok · ${errorCount} err`} />
        <Stat label="Avg latency" value={`${avgLatency} ms`} />
      </div>

      <div className="mt-4 flex justify-end">
        <button onClick={load} className="inline-flex items-center gap-2 rounded-lg border border-border px-3 py-1.5 text-xs hover:bg-accent">
          <RefreshCw className="h-3.5 w-3.5" /> Refresh
        </button>
      </div>

      <div className="mt-4">
        <DataTable
          columns={columns}
          rows={logs}
          rowKey={(l) => l.id}
          loading={loading}
          emptyMessage="No API requests yet."
          searchable={(l) => `${l.method} ${l.path} ${l.ip_address ?? ""} ${l.error_message ?? ""}`}
          filters={filters}
          dateField={(l) => l.created_at}
          pageSize={50}
        />
      </div>
    </MerchantShell>
  );
}

function Stat({ label, value, hint }: { label: string; value: string | number; hint?: string }) {
  return (
    <div className="rounded-2xl border border-border/60 bg-card/60 p-4 backdrop-blur">
      <p className="text-xs uppercase tracking-wider text-muted-foreground">{label}</p>
      <p className="mt-1 font-display text-2xl font-semibold">{value}</p>
      {hint && <p className="mt-0.5 text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}
