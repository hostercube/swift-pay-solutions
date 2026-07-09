import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { AdminShell } from "@/components/admin-shell";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { DataTable, type DataTableColumn, type DataTableFilter } from "@/components/data-table";

export const Route = createFileRoute("/_authenticated/admin/invoices")({
  head: () => ({ meta: [{ title: "All invoices · Admin" }] }),
  component: InvoicesPage,
});

type Row = {
  id: string;
  merchant_id: string;
  invoice_number: string;
  amount: number;
  currency: string;
  status: string;
  customer_email: string | null;
  created_at: string;
};

function InvoicesPage() {
  const [rows, setRows] = useState<Row[]>([]);
  const [names, setNames] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from("invoices")
        .select("id, merchant_id, invoice_number, amount, currency, status, customer_email, created_at")
        .order("created_at", { ascending: false })
        .limit(1000);
      const rowsData = (data ?? []) as Row[];
      setRows(rowsData);
      const ids = Array.from(new Set(rowsData.map((r) => r.merchant_id)));
      if (ids.length > 0) {
        const { data: profs } = await supabase.from("profiles").select("id, business_name, email").in("id", ids);
        const map: Record<string, string> = {};
        (profs ?? []).forEach((p) => (map[p.id] = p.business_name || p.email));
        setNames(map);
      }
      setLoading(false);
    })();
  }, []);

  const columns: DataTableColumn<Row>[] = [
    { key: "invoice_number", label: "Invoice", render: (r) => <span className="font-mono text-xs">{r.invoice_number}</span> },
    { key: "merchant", label: "Merchant", render: (r) => names[r.merchant_id] ?? <span className="text-muted-foreground">{r.merchant_id.slice(0, 8)}</span> },
    { key: "customer_email", label: "Customer", render: (r) => <span className="text-muted-foreground">{r.customer_email ?? "—"}</span> },
    { key: "amount", label: "Amount", render: (r) => <>{r.currency} {Number(r.amount).toLocaleString()}</> },
    { key: "status", label: "Status", render: (r) => <Badge variant="outline" className="capitalize">{r.status}</Badge> },
    { key: "created_at", label: "Created", render: (r) => <span className="text-muted-foreground">{new Date(r.created_at).toLocaleString()}</span> },
  ];

  const filters: DataTableFilter<Row>[] = [
    {
      key: "status",
      label: "All statuses",
      options: ["pending", "processing", "completed", "failed", "expired", "refunded"].map((s) => ({ value: s, label: s })),
      match: (r, v) => r.status === v,
    },
    {
      key: "currency",
      label: "All currencies",
      options: Array.from(new Set(rows.map((r) => r.currency))).sort().map((c) => ({ value: c, label: c })),
      match: (r, v) => r.currency === v,
    },
  ];

  return (
    <AdminShell title="All invoices" subtitle="Every invoice created on the platform.">
      <DataTable
        columns={columns}
        rows={rows}
        rowKey={(r) => r.id}
        loading={loading}
        emptyMessage="No invoices."
        searchable={(r) => `${r.invoice_number} ${r.customer_email ?? ""} ${names[r.merchant_id] ?? ""} ${r.merchant_id}`}
        filters={filters}
        dateField={(r) => r.created_at}
        pageSize={50}
      />
    </AdminShell>
  );
}
