import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { MerchantShell } from "@/components/merchant-shell";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { DataTable, type DataTableColumn, type DataTableFilter } from "@/components/data-table";
import { Button } from "@/components/ui/button";
import { useServerFn } from "@tanstack/react-start";
import { drainPendingForMerchant, reverifyTransaction } from "@/lib/drain.functions";
import { toast } from "sonner";
import { Loader2, RefreshCw } from "lucide-react";

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
  const [draining, setDraining] = useState(false);
  const [reverifyingId, setReverifyingId] = useState<string | null>(null);
  const drainFn = useServerFn(drainPendingForMerchant);
  const reverifyFn = useServerFn(reverifyTransaction);

  const load = () => {
    if (!user) return;
    setLoading(true);
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
  };

  useEffect(load, [user]);

  const onDrain = async () => {
    if (!user || draining) return;
    setDraining(true);
    try {
      const r = await drainFn({ data: { merchantId: user.id } });
      toast.success(`Drain complete · replayed ${r.replayed}, verified ${r.verified}, drained ${r.drained}`);
      load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Drain failed");
    } finally {
      setDraining(false);
    }
  };

  const onReverify = async (id: string) => {
    setReverifyingId(id);
    try {
      const r = await reverifyFn({ data: { transactionId: id } });
      if (r.matched) toast.success(`Verified via ${r.layer}`);
      else toast.info(r.reason ?? "No match yet");
      load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Re-verify failed");
    } finally {
      setReverifyingId(null);
    }
  };

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
    {
      key: "actions",
      label: "",
      render: (r) => r.status === "pending" ? (
        <Button size="sm" variant="outline" disabled={reverifyingId === r.id} onClick={() => onReverify(r.id)}>
          {reverifyingId === r.id ? <Loader2 className="h-3 w-3 animate-spin" /> : "Re-verify"}
        </Button>
      ) : null,
    },
  ];

  const methodOptions = Array.from(new Set(rows.map((r) => r.method_type))).sort().map((m) => ({ value: m, label: m.toUpperCase() }));
  const statusOptions = Array.from(new Set(rows.map((r) => r.status))).sort().map((s) => ({ value: s, label: s }));

  const filters: DataTableFilter<Row>[] = [
    { key: "status", label: "All statuses", options: statusOptions, match: (r, v) => r.status === v },
    { key: "method", label: "All methods", options: methodOptions, match: (r, v) => r.method_type === v },
  ];

  return (
    <MerchantShell
      title="Transactions"
      subtitle="Payment attempts recorded against your invoices."
      actions={
        <Button variant="outline" size="sm" onClick={onDrain} disabled={draining}>
          {draining ? <Loader2 className="mr-2 h-3 w-3 animate-spin" /> : <RefreshCw className="mr-2 h-3 w-3" />}
          Drain / Re-verify
        </Button>
      }
    >
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
