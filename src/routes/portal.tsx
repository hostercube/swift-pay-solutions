import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { Search, ExternalLink, ShieldCheck } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/portal")({
  head: () => ({
    meta: [
      { title: "Customer Portal · PayNOC" },
      { name: "description", content: "Look up your PayNOC invoice history and payment receipts." },
    ],
  }),
  component: PortalPage,
});

type Row = {
  id: string;
  invoice_number: string;
  amount: number;
  currency: string;
  status: string;
  description: string | null;
  created_at: string;
  paid_at: string | null;
  expires_at: string | null;
  business_name: string | null;
};

function PortalPage() {
  const [email, setEmail] = useState("");
  const [invoiceNumber, setInvoiceNumber] = useState("");
  const [rows, setRows] = useState<Row[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function lookup(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setRows(null);
    const { data, error } = await supabase.rpc("get_customer_invoices", {
      _email: email.trim(),
      _invoice_number: invoiceNumber.trim(),
    });
    setLoading(false);
    if (error) { setError(error.message); return; }
    const list = (data ?? []) as Row[];
    if (list.length === 0) {
      setError("No invoices found. Check your email and invoice number.");
      return;
    }
    setRows(list);
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="mx-auto max-w-3xl px-6 py-16">
        <Link to="/" className="text-xs uppercase tracking-widest text-muted-foreground hover:text-foreground">
          ← PayNOC
        </Link>
        <div className="mt-6 flex items-center gap-3">
          <div className="grid h-11 w-11 place-items-center rounded-xl bg-gradient-brand text-brand-foreground">
            <ShieldCheck className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">Customer portal</h1>
            <p className="text-sm text-muted-foreground">View your invoices and download receipts.</p>
          </div>
        </div>

        <form onSubmit={lookup} className="glass mt-8 grid gap-4 rounded-2xl border border-glass-border p-6 md:grid-cols-[1fr_1fr_auto]">
          <div>
            <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Email</label>
            <input
              type="email" required value={email} onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              className="mt-1 w-full rounded-lg border border-glass-border bg-card/40 px-3 py-2 text-sm outline-none focus:border-brand"
            />
          </div>
          <div>
            <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Invoice number</label>
            <input
              required value={invoiceNumber} onChange={(e) => setInvoiceNumber(e.target.value)}
              placeholder="INV-1234"
              className="mt-1 w-full rounded-lg border border-glass-border bg-card/40 px-3 py-2 text-sm font-mono outline-none focus:border-brand"
            />
          </div>
          <div className="md:self-end">
            <button
              type="submit" disabled={loading}
              className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-gradient-brand px-4 py-2 text-sm font-semibold text-brand-foreground disabled:opacity-50"
            >
              <Search className="h-4 w-4" /> {loading ? "Looking up…" : "Look up"}
            </button>
          </div>
          <p className="text-xs text-muted-foreground md:col-span-3">
            Enter your email and any one invoice number we've sent you. We'll show all invoices linked to that email.
          </p>
        </form>

        {error && (
          <div className="mt-4 rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
            {error}
          </div>
        )}

        {rows && rows.length > 0 && (
          <div className="glass mt-6 overflow-hidden rounded-2xl border border-glass-border">
            <div className="border-b border-glass-border px-4 py-3 text-xs text-muted-foreground">
              {rows.length} invoice{rows.length === 1 ? "" : "s"} found
            </div>
            <table className="w-full text-sm">
              <thead className="bg-card/40 text-left text-xs uppercase tracking-wider text-muted-foreground">
                <tr>
                  <th className="px-4 py-3">Invoice</th>
                  <th className="px-4 py-3">Merchant</th>
                  <th className="px-4 py-3">Amount</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Date</th>
                  <th className="px-4 py-3 text-right">Open</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id} className="border-t border-glass-border">
                    <td className="px-4 py-3 font-mono text-xs">{r.invoice_number}</td>
                    <td className="px-4 py-3">{r.business_name || "—"}</td>
                    <td className="px-4 py-3 font-medium">{r.currency} {Number(r.amount).toLocaleString()}</td>
                    <td className="px-4 py-3">
                      <StatusBadge status={r.status} />
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {new Date(r.paid_at ?? r.created_at).toLocaleDateString()}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <a
                        href={`/pay/${r.id}`} target="_blank" rel="noreferrer"
                        className="inline-flex items-center gap-1 text-brand hover:underline"
                      >
                        Open <ExternalLink className="h-3 w-3" />
                      </a>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const tone =
    status === "completed" ? "bg-brand/10 text-brand" :
    status === "failed" || status === "cancelled" || status === "expired" ? "bg-destructive/10 text-destructive" :
    status === "refunded" ? "bg-purple-500/10 text-purple-400" :
    status === "processing" ? "bg-amber-500/10 text-amber-500" :
    "bg-muted text-muted-foreground";
  return (
    <span className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${tone}`}>
      {status}
    </span>
  );
}
