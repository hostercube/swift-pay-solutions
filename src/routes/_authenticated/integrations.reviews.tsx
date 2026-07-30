import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { CheckCircle2, XCircle, Clock, FileText, ExternalLink, RefreshCw } from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { useActiveMerchant } from "@/hooks/use-active-merchant";
import { DataTable, type DataTableColumn } from "@/components/data-table";

export const Route = createFileRoute("/_authenticated/integrations/reviews")({
  head: () => ({ meta: [{ title: "Manual reviews · PayNOC" }] }),
  component: ReviewsPage,
});

type Row = {
  id: string;
  invoice_id: string;
  method_type: string;
  status: string;
  gross_amount: number;
  provider_txn_id: string | null;
  sender_number: string | null;
  sender_name: string | null;
  slip_url: string | null;
  bank_reference: string | null;
  created_at: string;
  verified_at: string | null;
  verified_by: string | null;
  rejected_reason?: string | null;
  rejected_by?: string | null;
  rejected_at?: string | null;
  note: string | null;
  invoices: { invoice_number: string | null; customer_email: string | null; currency: string | null } | null;
};

type Filter = "pending" | "verified" | "rejected" | "all";

function ReviewsPage() {
  const { user } = useAuth();
  const { merchantId: activeMerchantId } = useActiveMerchant();
  const [rows, setRows] = useState<Row[]>([]);
  const [filter, setFilter] = useState<Filter>("pending");
  const [loading, setLoading] = useState(false);
  const [preview, setPreview] = useState<{ url: string; contentType: string | null } | null>(null);

  async function load() {
    if (!user) return;
    setLoading(true);
    let q = supabase
      .from("transactions")
      .select("id, invoice_id, method_type, status, gross_amount, provider_txn_id, sender_number, sender_name, slip_url, bank_reference, created_at, verified_at, verified_by, rejected_reason, rejected_by, rejected_at, note, invoices(invoice_number, customer_email, currency)")
      .eq("merchant_id", activeMerchantId ?? user.id)
      .order("created_at", { ascending: false })
      .limit(200);
    if (filter !== "all") q = q.eq("status", filter);
    const { data, error } = await q;
    setLoading(false);
    if (error) return toast.error(error.message);
    setRows((data ?? []) as unknown as Row[]);
  }
  useEffect(() => { load(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [user, filter]);

  const counts = useMemo(() => {
    const c = { pending: 0, verified: 0, rejected: 0 };
    rows.forEach((r) => {
      if (r.status === "pending") c.pending++;
      else if (r.status === "verified") c.verified++;
      else if (r.status === "rejected") c.rejected++;
    });
    return c;
  }, [rows]);

  async function updateStatus(r: Row, next: "verified" | "rejected") {
    if (!user) return;
    let reason: string | null = null;
    if (next === "rejected") {
      const input = window.prompt("Reason for rejecting this payment? (optional)")?.trim() ?? "";
      reason = input.length ? input.slice(0, 500) : null;
    }
    const nowIso = new Date().toISOString();
    const patch: Record<string, unknown> = next === "verified"
      ? { status: next, verified_at: nowIso, verified_by: user.id }
      : { status: next, rejected_at: nowIso, rejected_by: user.id, rejected_reason: reason };
    const { error } = await supabase.from("transactions").update(patch as never).eq("id", r.id);
    if (error) return toast.error(error.message);
    if (next === "verified") {
      await supabase
        .from("invoices")
        .update({ status: "completed", paid_at: nowIso })
        .eq("id", r.invoice_id);
    }
    toast.success(next === "verified" ? "Marked as paid" : "Rejected");
    load();
  }

  async function openSlip(path: string) {
    const { data, error } = await supabase.storage.from("payment-assets").createSignedUrl(path, 3600);
    if (error || !data?.signedUrl) return toast.error("Could not open slip");
    const isPdf = /\.pdf(\?|$)/i.test(path);
    setPreview({ url: data.signedUrl, contentType: isPdf ? "application/pdf" : "image" });
  }

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-2">
          {(["pending", "verified", "rejected", "all"] as Filter[]).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`rounded-full px-3 py-1.5 text-xs font-semibold capitalize transition ${
                filter === f
                  ? "bg-brand text-brand-foreground"
                  : "border border-glass-border bg-card/40 text-muted-foreground hover:text-foreground"
              }`}
            >
              {f} {f !== "all" && `(${counts[f]})`}
            </button>
          ))}
        </div>
        <button
          onClick={load}
          className="inline-flex items-center gap-1.5 rounded-lg border border-glass-border px-3 py-1.5 text-xs font-semibold hover:border-brand"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} /> Refresh
        </button>
      </div>

      <DataTable<Row>
        rows={rows}
        loading={loading}
        rowKey={(r) => r.id}
        searchable={(r) =>
          `${r.invoices?.invoice_number ?? ""} ${r.invoices?.customer_email ?? ""} ${r.sender_name ?? ""} ${r.sender_number ?? ""} ${r.provider_txn_id ?? ""} ${r.bank_reference ?? ""}`
        }
        dateField={(r) => r.created_at}
        emptyMessage={`No ${filter === "all" ? "" : filter} records.`}
        filters={[
          {
            key: "method",
            label: "Method",
            options: Array.from(new Set(rows.map((r) => r.method_type))).map((m) => ({ value: m, label: m.toUpperCase() })),
            match: (r, v) => r.method_type === v,
          },
        ]}
        columns={[
          {
            key: "invoice",
            label: "Invoice",
            render: (r) => (
              <div>
                <div className="font-mono text-xs">{r.invoices?.invoice_number ?? r.invoice_id.slice(0, 8)}</div>
                <div className="text-[11px] text-muted-foreground">{r.invoices?.customer_email ?? "—"}</div>
              </div>
            ),
          },
          { key: "method", label: "Method", render: (r) => <span className="uppercase text-muted-foreground">{r.method_type}</span> },
          {
            key: "payer",
            label: "Payer",
            render: (r) => (
              <div>
                <div className="text-xs">{r.sender_name || "—"}</div>
                <div className="font-mono text-[11px] text-muted-foreground">{r.sender_number || "—"}</div>
              </div>
            ),
          },
          {
            key: "trxid",
            label: "TrxID",
            render: (r) => (
              <div>
                <div className="font-mono text-xs">{r.provider_txn_id || "—"}</div>
                {r.bank_reference && <div className="text-[11px] text-muted-foreground">ref: {r.bank_reference}</div>}
              </div>
            ),
          },
          { key: "amount", label: "Amount", render: (r) => <span className="font-mono text-xs">{r.invoices?.currency ?? ""} {Number(r.gross_amount).toLocaleString()}</span> },
          {
            key: "slip",
            label: "Slip",
            render: (r) =>
              r.slip_url ? (
                <button onClick={() => openSlip(r.slip_url!)} className="inline-flex items-center gap-1 rounded border border-glass-border bg-background/50 px-2 py-1 text-[11px] hover:border-brand">
                  <FileText className="h-3 w-3" /> View
                </button>
              ) : (
                <span className="text-[11px] text-muted-foreground">—</span>
              ),
          },
          { key: "status", label: "Status", render: (r) => <StatusPill status={r.status} /> },
        ] as DataTableColumn<Row>[]}
        actions={(r) =>
          r.status === "pending" ? (
            <div className="inline-flex gap-1">
              <button onClick={() => updateStatus(r, "verified")} className="inline-flex items-center gap-1 rounded bg-success/15 px-2 py-1 text-[11px] font-semibold text-success hover:bg-success/25">
                <CheckCircle2 className="h-3 w-3" /> Approve
              </button>
              <button onClick={() => updateStatus(r, "rejected")} className="inline-flex items-center gap-1 rounded bg-destructive/15 px-2 py-1 text-[11px] font-semibold text-destructive hover:bg-destructive/25">
                <XCircle className="h-3 w-3" /> Reject
              </button>
            </div>
          ) : (
            <div className="text-right text-[11px] text-muted-foreground">
              <div>
                {r.status === "verified" && r.verified_at ? new Date(r.verified_at).toLocaleString() : null}
                {r.status === "rejected" && r.rejected_at ? new Date(r.rejected_at).toLocaleString() : null}
                {!r.verified_at && !r.rejected_at ? "—" : null}
              </div>
              {r.status === "rejected" && r.rejected_reason && (
                <div className="mt-1 max-w-[220px] whitespace-pre-line rounded bg-destructive/10 px-2 py-1 text-left text-[10px] text-destructive">
                  {r.rejected_reason}
                </div>
              )}
            </div>
          )
        }
      />

      {preview && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4" onClick={() => setPreview(null)}>
          <div className="relative max-h-[90vh] w-full max-w-3xl overflow-hidden rounded-2xl border border-glass-border bg-card" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between border-b border-glass-border p-3">
              <div className="text-sm font-semibold">Bank slip preview</div>
              <a href={preview.url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-xs text-brand hover:underline">
                Open <ExternalLink className="h-3 w-3" />
              </a>
            </div>
            {preview.contentType === "application/pdf" ? (
              <iframe src={preview.url} title="slip" className="h-[80vh] w-full bg-background" />
            ) : (
              <img src={preview.url} alt="Slip" className="max-h-[80vh] w-full object-contain bg-background" />
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function StatusPill({ status }: { status: string }) {
  const map: Record<string, { c: string; icon: React.ReactNode; label: string }> = {
    pending:  { c: "bg-amber-500/15 text-amber-600",   icon: <Clock className="h-3 w-3" />,        label: "Pending" },
    verified: { c: "bg-success/15 text-success",       icon: <CheckCircle2 className="h-3 w-3" />, label: "Paid" },
    rejected: { c: "bg-destructive/15 text-destructive", icon: <XCircle className="h-3 w-3" />,    label: "Rejected" },
  };
  const s = map[status] ?? { c: "bg-muted text-muted-foreground", icon: null, label: status };
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${s.c}`}>
      {s.icon}{s.label}
    </span>
  );
}
