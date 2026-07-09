import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { MerchantShell } from "@/components/merchant-shell";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { DataTable, type DataTableColumn, type DataTableFilter } from "@/components/data-table";

export const Route = createFileRoute("/_authenticated/transactions")({
  head: () => ({ meta: [{ title: "Transactions · PayNOC" }] }),
  component: TransactionsPage,
});

type Row = {
  id: string;
  method_type: string;
  gross_amount: number;
  fee_amount: number;
  net_amount: number;
  status: string;
  sender_number: string | null;
  reference: string | null;
  created_at: string;
};

const STATUS_TONE: Record<string, string> = {
  verified: "bg-brand/10 text-brand",
  rejected: "bg-destructive/10 text-destructive",
};

function TransactionsPage() {
  const { user } = useAuth();
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    supabase
      .from("transactions")
      .select("id, method_type, gross_amount, fee_amount, net_amount, status, sender_number, reference, created_at")
      .eq("merchant_id", user.id)
      .order("created_at", { ascending: false })
      .limit(500)
      .then(({ data }) => {
        setRows((data ?? []) as Row[]);
        setLoading(false);
      });
  }, [user]);

  const columns: DataTableColumn<Row>[] = [
    { key: "method_type", label: "Method", render: (r) => <span className="font-medium uppercase">{r.method_type}</span> },
    { key: "sender_number", label: "Sender", render: (r) => <span className="text-muted-foreground">{r.sender_number || "—"}</span> },
    { key: "reference", label: "Reference", render: (r) => <span className="font-mono text-xs">{r.reference || "—"}</span> },
    { key: "gross_amount", label: "Gross", render: (r) => <>৳ {Number(r.gross_amount).toLocaleString()}</> },
    { key: "net_amount", label: "Net", render: (r) => <>৳ {Number(r.net_amount).toLocaleString()}</> },
    {
      key: "status",
      label: "Status",
      render: (r) => (
        <span className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${STATUS_TONE[r.status] ?? "bg-amber-500/10 text-amber-500"}`}>
          {r.status}
        </span>
      ),
    },
    { key: "created_at", label: "Time", render: (r) => <span className="text-muted-foreground">{new Date(r.created_at).toLocaleString()}</span> },
  ];

  const methodOptions = Array.from(new Set(rows.map((r) => r.method_type))).sort().map((m) => ({ value: m, label: m.toUpperCase() }));
  const statusOptions = Array.from(new Set(rows.map((r) => r.status))).sort().map((s) => ({ value: s, label: s }));

  const filters: DataTableFilter<Row>[] = [
    { key: "status", label: "All statuses", options: statusOptions, match: (r, v) => r.status === v },
    { key: "method", label: "All methods", options: methodOptions, match: (r, v) => r.method_type === v },
  ];

  return (
    <MerchantShell title="Transactions" subtitle="Payment attempts recorded against your invoices.">
      <DataTable
        columns={columns}
        rows={rows}
        rowKey={(r) => r.id}
        loading={loading}
        emptyMessage="No transactions yet."
        searchable={(r) => `${r.method_type} ${r.sender_number ?? ""} ${r.reference ?? ""}`}
        filters={filters}
        dateField={(r) => r.created_at}
      />
    </MerchantShell>
  );
}
