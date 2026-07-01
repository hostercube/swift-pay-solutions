import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { RefreshCw } from "lucide-react";
import { MerchantShell } from "@/components/merchant-shell";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";

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
  const [logs, setLogs] = useState<Log[]>([]);
  const [filter, setFilter] = useState<"all" | "success" | "error">("all");
  const [loading, setLoading] = useState(true);

  const load = async () => {
    if (!user) return;
    setLoading(true);
    let q = supabase
      .from("api_request_logs")
      .select("id, method, path, status_code, latency_ms, ip_address, error_message, created_at")
      .eq("merchant_id", user.id)
      .order("created_at", { ascending: false })
      .limit(200);
    if (filter === "success") q = q.lt("status_code", 400);
    if (filter === "error") q = q.gte("status_code", 400);
    const { data } = await q;
    setLogs((data ?? []) as Log[]);
    setLoading(false);
  };

  useEffect(() => { load(); }, [user, filter]);

  const successCount = logs.filter((l) => l.status_code < 400).length;
  const errorCount = logs.length - successCount;
  const avgLatency = logs.length ? Math.round(logs.reduce((s, l) => s + l.latency_ms, 0) / logs.length) : 0;

  return (
    <MerchantShell title="API logs" subtitle="Recent API requests to your account (last 200).">
      <div className="grid gap-4 sm:grid-cols-3">
        <Stat label="Requests" value={logs.length} />
        <Stat label="Success rate" value={logs.length ? `${Math.round((successCount / logs.length) * 100)}%` : "—"} hint={`${successCount} ok · ${errorCount} err`} />
        <Stat label="Avg latency" value={`${avgLatency} ms`} />
      </div>

      <div className="mt-6 flex items-center justify-between gap-3">
        <div className="inline-flex rounded-lg border border-border p-1">
          {(["all", "success", "error"] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`rounded-md px-3 py-1 text-xs capitalize ${filter === f ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"}`}
            >
              {f}
            </button>
          ))}
        </div>
        <button onClick={load} className="inline-flex items-center gap-2 rounded-lg border border-border px-3 py-1.5 text-xs hover:bg-accent">
          <RefreshCw className="h-3.5 w-3.5" /> Refresh
        </button>
      </div>

      <div className="mt-4 overflow-hidden rounded-2xl border border-border/60 bg-card/60 backdrop-blur">
        <table className="w-full text-sm">
          <thead className="border-b border-border/60 bg-muted/30 text-xs uppercase text-muted-foreground">
            <tr>
              <th className="px-4 py-3 text-left">Time</th>
              <th className="px-4 py-3 text-left">Method</th>
              <th className="px-4 py-3 text-left">Path</th>
              <th className="px-4 py-3 text-left">Status</th>
              <th className="px-4 py-3 text-left">Latency</th>
              <th className="px-4 py-3 text-left">IP</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={6} className="px-4 py-8 text-center text-muted-foreground">Loading…</td></tr>
            ) : logs.length === 0 ? (
              <tr><td colSpan={6} className="px-4 py-8 text-center text-muted-foreground">No API requests yet.</td></tr>
            ) : logs.map((l) => (
              <tr key={l.id} className="border-b border-border/40 last:border-0">
                <td className="px-4 py-2.5 text-xs text-muted-foreground whitespace-nowrap">{new Date(l.created_at).toLocaleString()}</td>
                <td className="px-4 py-2.5"><span className="rounded bg-muted px-1.5 py-0.5 text-xs font-mono">{l.method}</span></td>
                <td className="px-4 py-2.5 font-mono text-xs">{l.path}</td>
                <td className="px-4 py-2.5"><span className={`rounded px-2 py-0.5 text-xs font-medium ${statusTone(l.status_code)}`}>{l.status_code}</span></td>
                <td className="px-4 py-2.5 text-xs">{l.latency_ms} ms</td>
                <td className="px-4 py-2.5 text-xs text-muted-foreground">{l.ip_address ?? "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
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
