import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { AdminShell } from "@/components/admin-shell";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { DataTable, type DataTableColumn, type DataTableFilter } from "@/components/data-table";

export const Route = createFileRoute("/_authenticated/admin/transactions")({
  head: () => ({ meta: [{ title: "All transactions · Admin" }] }),
  component: TxPage,
});

type Row = {
  id: string;
  merchant_id: string;
  invoice_id: string | null;
  status: string;
  gross_amount: number | null;
  method_type: string | null;
  provider_txn_id: string | null;
  reference: string | null;
  created_at: string;
};

function TxPage() {
  const [rows, setRows] = useState<Row[]>([]);
  const [names, setNames] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from("transactions")
        .select("id, merchant_id, invoice_id, status, gross_amount, method_type, provider_txn_id, reference, created_at")
        .order("created_at", { ascending: false })
        .limit(1000);
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
    { key: "created_at", label: "When", render: (r) => <span className="text-muted-foreground">{new Date(r.created_at).toLocaleString()}</span> },
    { key: "merchant", label: "Merchant", render: (r) => names[r.merchant_id] ?? <span className="text-muted-foreground">{r.merchant_id.slice(0, 8)}</span> },
    { key: "method_type", label: "Method", render: (r) => <span className="capitalize">{r.method_type?.replace(/_/g, " ") ?? "—"}</span> },
    { key: "gross_amount", label: "Amount", render: (r) => <>৳ {Number(r.gross_amount ?? 0).toLocaleString()}</> },
    { key: "status", label: "Status", render: (r) => <Badge variant="outline" className="capitalize">{r.status}</Badge> },
    { key: "provider_txn_id", label: "Provider ref", render: (r) => <span className="font-mono text-xs text-muted-foreground">{r.provider_txn_id ?? r.reference ?? "—"}</span> },
  ];

  const filters: DataTableFilter<Row>[] = [
    { key: "status", label: "All statuses", options: ["pending", "verified", "failed", "refunded"].map((s) => ({ value: s, label: s })), match: (r, v) => r.status === v },
    {
      key: "method",
      label: "All methods",
      options: Array.from(new Set(rows.map((r) => r.method_type).filter(Boolean) as string[])).sort().map((m) => ({ value: m, label: m })),
      match: (r, v) => r.method_type === v,
    },
  ];

  return (
    <AdminShell title="All transactions" subtitle="Every payment attempt across every merchant.">
      <DataTable
        columns={columns}
        rows={rows}
        rowKey={(r) => r.id}
        loading={loading}
        emptyMessage="No transactions."
        searchable={(r) => `${r.provider_txn_id ?? ""} ${r.reference ?? ""} ${names[r.merchant_id] ?? ""} ${r.merchant_id}`}
        filters={filters}
        dateField={(r) => r.created_at}
        pageSize={50}
      />
    </AdminShell>
  );
}
