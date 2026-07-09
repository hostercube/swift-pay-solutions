import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { MerchantShell } from "@/components/merchant-shell";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { createRefund, updateRefundStatus } from "@/lib/payments.functions";
import { DataTable, type DataTableColumn, type DataTableFilter } from "@/components/data-table";

export const Route = createFileRoute("/_authenticated/refunds")({
  head: () => ({ meta: [{ title: "Refunds · PayNOC" }] }),
  component: RefundsPage,
});

type Row = {
  id: string;
  invoice_id: string;
  merchant_id: string;
  amount: number;
  currency: string;
  reason: string | null;
  status: string;
  admin_note: string | null;
  created_at: string;
};

type Invoice = { id: string; invoice_number: string; amount: number; currency: string };

const COLOR: Record<string, string> = {
  requested: "bg-warning/15 text-warning",
  approved: "bg-brand/15 text-brand",
  processed: "bg-success/15 text-success",
  rejected: "bg-destructive/15 text-destructive",
};

function RefundsPage() {
  const { roles } = useAuth();
  const isAdmin = roles.includes("super_admin");
  const [rows, setRows] = useState<Row[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [invoiceId, setInvoiceId] = useState("");
  const [amount, setAmount] = useState("");
  const [reason, setReason] = useState("");
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const createFn = useServerFn(createRefund);
  const updateFn = useServerFn(updateRefundStatus);

  const load = async () => {
    setLoading(true);
    const { data } = await (supabase.from as unknown as (t: string) => {
      select: (s: string) => {
        order: (c: string, o: { ascending: boolean }) => {
          limit: (n: number) => Promise<{ data: Row[] | null }>;
        };
      };
    })("refunds")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(500);
    setRows(data ?? []);
    setLoading(false);

    const { data: inv } = await supabase
      .from("invoices")
      .select("id, invoice_number, amount, currency")
      .eq("status", "completed")
      .order("created_at", { ascending: false })
      .limit(50);
    setInvoices((inv ?? []) as Invoice[]);
  };

  useEffect(() => { load(); }, []);

  const submit = async () => {
    if (!invoiceId || !amount) return toast.error("Pick an invoice and enter an amount");
    try {
      await createFn({ data: { invoiceId, amount: Number(amount), reason: reason || undefined } });
      toast.success("Refund requested");
      setInvoiceId(""); setAmount(""); setReason("");
      load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed");
    }
  };

  const decide = async (id: string, status: "approved" | "processed" | "rejected") => {
    try {
      await updateFn({ data: { refundId: id, status, note: notes[id] } });
      toast.success(`Refund ${status}`);
      load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed");
    }
  };

  const approveAndProcess = async (id: string) => {
    try {
      await updateFn({ data: { refundId: id, status: "approved", note: notes[id] } });
      await updateFn({ data: { refundId: id, status: "processed", note: notes[id] } });
      toast.success("Refund approved & processed");
      load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed");
    }
  };

  const columns: DataTableColumn<Row>[] = [
    { key: "created_at", label: "Date", render: (r) => <span className="text-xs">{new Date(r.created_at).toLocaleString()}</span> },
    { key: "invoice_id", label: "Invoice", render: (r) => <span className="font-mono text-xs">{r.invoice_id.slice(0, 8)}</span> },
    { key: "amount", label: "Amount", render: (r) => <>{r.currency} {Number(r.amount).toLocaleString()}</> },
    { key: "reason", label: "Reason", render: (r) => <span className="text-xs">{r.reason ?? "—"}</span> },
    { key: "status", label: "Status", render: (r) => <Badge className={COLOR[r.status] ?? ""}>{r.status}</Badge> },
    ...(isAdmin ? [{
      key: "action",
      label: "Action",
      render: (r: Row) =>
        r.status === "requested" || r.status === "approved" ? (
          <div className="space-y-2 min-w-[240px]">
            <Input
              placeholder="Note"
              value={notes[r.id] ?? r.admin_note ?? ""}
              onChange={(e) => setNotes({ ...notes, [r.id]: e.target.value })}
              className="h-8"
            />
            <div className="flex flex-wrap gap-1">
              {r.status === "requested" && (
                <>
                  <Button size="sm" onClick={() => decide(r.id, "approved")}>Approve</Button>
                  <Button size="sm" onClick={() => approveAndProcess(r.id)}>Approve & Process</Button>
                </>
              )}
              <Button size="sm" variant="secondary" onClick={() => decide(r.id, "processed")}>Processed</Button>
              <Button size="sm" variant="destructive" onClick={() => decide(r.id, "rejected")}>Reject</Button>
            </div>
          </div>
        ) : (
          <p className="text-xs text-muted-foreground">{r.admin_note ?? "—"}</p>
        ),
    }] : []),
  ];

  const filters: DataTableFilter<Row>[] = [
    { key: "status", label: "All statuses", options: ["requested","approved","processed","rejected"].map((s) => ({ value: s, label: s })), match: (r, v) => r.status === v },
  ];

  return (
    <MerchantShell title="Refunds" subtitle="Request full or partial refunds against completed invoices.">
      <Card className="p-5">
        <h3 className="font-display text-lg font-semibold">Request a refund</h3>
        <div className="mt-3 grid gap-3 sm:grid-cols-4">
          <label className="sm:col-span-2">
            <div className="mb-1 text-xs uppercase text-muted-foreground">Invoice</div>
            <select
              value={invoiceId}
              onChange={(e) => setInvoiceId(e.target.value)}
              className="w-full rounded-lg border border-glass-border bg-card/60 px-3 py-2 text-sm"
            >
              <option value="">Select completed invoice…</option>
              {invoices.map((i) => (
                <option key={i.id} value={i.id}>{i.invoice_number} — {i.currency} {i.amount}</option>
              ))}
            </select>
          </label>
          <label>
            <div className="mb-1 text-xs uppercase text-muted-foreground">Amount</div>
            <Input type="number" step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} />
          </label>
          <div className="flex items-end">
            <Button onClick={submit} className="w-full">Request refund</Button>
          </div>
          <label className="sm:col-span-4">
            <div className="mb-1 text-xs uppercase text-muted-foreground">Reason (optional)</div>
            <Input value={reason} onChange={(e) => setReason(e.target.value)} />
          </label>
        </div>
      </Card>

      <div className="mt-6">
        <DataTable
          columns={columns}
          rows={rows}
          rowKey={(r) => r.id}
          loading={loading}
          emptyMessage="No refunds yet"
          searchable={(r) => `${r.invoice_id} ${r.reason ?? ""} ${r.admin_note ?? ""}`}
          filters={filters}
          dateField={(r) => r.created_at}
        />
      </div>
    </MerchantShell>
  );
}
