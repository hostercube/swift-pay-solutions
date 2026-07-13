import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { AdminShell } from "@/components/admin-shell";
import { supabase } from "@/integrations/supabase/client";
import { DataTable, type DataTableColumn, type DataTableFilter } from "@/components/data-table";

export const Route = createFileRoute("/_authenticated/admin/sms-events")({
  head: () => ({ meta: [{ title: "SMS events · Admin" }] }),
  component: SmsEventsPage,
});

type Row = {
  id: string;
  merchant_id: string;
  provider: string | null;
  trx_id: string | null;
  sender: string | null;
  amount: number | null;
  matched_layer: string;
  outcome: string;
  reason: string | null;
  matched_invoice_id: string | null;
  created_at: string;
};

const OUTCOME_TONE: Record<string, string> = {
  verified: "bg-brand/10 text-brand",
  skipped: "bg-muted text-muted-foreground",
  rejected: "bg-destructive/10 text-destructive",
  no_match: "bg-amber-500/10 text-amber-500",
  error: "bg-destructive/10 text-destructive",
};

function SmsEventsPage() {
  const [rows, setRows] = useState<Row[]>([]);
  const [names, setNames] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from("sms_event_logs")
        .select("id, merchant_id, provider, trx_id, sender, amount, matched_layer, outcome, reason, matched_invoice_id, created_at")
        .order("created_at", { ascending: false })
        .limit(500);
      const rowsData = (data ?? []) as Row[];
      setRows(rowsData);
      const merchantIds = Array.from(new Set(rowsData.map((r) => r.merchant_id)));
      if (merchantIds.length > 0) {
        const { data: profs } = await supabase.from("profiles").select("id, business_name, email").in("id", merchantIds);
        const map: Record<string, string> = {};
        (profs ?? []).forEach((p) => (map[p.id] = p.business_name || p.email));
        setNames(map);
      }
      setLoading(false);
    })();
  }, []);

  const columns: DataTableColumn<Row>[] = [
    { key: "created_at", label: "Time", render: (r) => <span className="text-muted-foreground text-xs">{new Date(r.created_at).toLocaleString()}</span> },
    { key: "merchant", label: "Merchant", render: (r) => <span className="text-xs">{names[r.merchant_id] ?? r.merchant_id.slice(0, 8)}</span> },
    { key: "provider", label: "Provider", render: (r) => <span className="uppercase text-xs">{r.provider || "—"}</span> },
    { key: "trx_id", label: "TrxID", render: (r) => <span className="font-mono text-xs">{r.trx_id || "—"}</span> },
    { key: "sender", label: "Sender", render: (r) => <span className="text-muted-foreground text-xs">{r.sender || "—"}</span> },
    { key: "amount", label: "Amount", render: (r) => <>{r.amount != null ? `৳ ${Number(r.amount).toLocaleString()}` : "—"}</> },
    { key: "matched_layer", label: "Layer", render: (r) => <span className="font-mono text-[10px] rounded bg-muted px-1.5 py-0.5">{r.matched_layer}</span> },
    {
      key: "outcome",
      label: "Outcome",
      render: (r) => (
        <span className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${OUTCOME_TONE[r.outcome] ?? "bg-muted"}`}>
          {r.outcome}
        </span>
      ),
    },
    { key: "reason", label: "Reason", render: (r) => <span className="text-xs text-muted-foreground">{r.reason || "—"}</span> },
  ];

  const outcomeOptions = Array.from(new Set(rows.map((r) => r.outcome))).sort().map((s) => ({ value: s, label: s }));
  const layerOptions = Array.from(new Set(rows.map((r) => r.matched_layer))).sort().map((s) => ({ value: s, label: s }));

  const filters: DataTableFilter<Row>[] = [
    { key: "outcome", label: "All outcomes", options: outcomeOptions, match: (r, v) => r.outcome === v },
    { key: "layer", label: "All layers", options: layerOptions, match: (r, v) => r.matched_layer === v },
  ];

  return (
    <AdminShell title="SMS events" subtitle="Every APK SMS ingest with the matching layer (L0–L5), outcome and reason.">
      <DataTable
        columns={columns}
        rows={rows}
        rowKey={(r) => r.id}
        loading={loading}
        emptyMessage="No SMS events logged yet."
        searchable={(r) => `${r.provider ?? ""} ${r.trx_id ?? ""} ${r.sender ?? ""} ${r.reason ?? ""} ${names[r.merchant_id] ?? ""}`}
        filters={filters}
        dateField={(r) => r.created_at}
      />
    </AdminShell>
  );
}
