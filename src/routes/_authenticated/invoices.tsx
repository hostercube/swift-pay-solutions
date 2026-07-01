import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { MerchantShell } from "@/components/merchant-shell";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";

export const Route = createFileRoute("/_authenticated/invoices")({
  head: () => ({ meta: [{ title: "Invoices · PayNOC" }] }),
  component: InvoicesPage,
});

type Row = {
  id: string;
  invoice_number: string;
  amount: number;
  currency: string;
  customer_name: string | null;
  customer_email: string | null;
  status: string;
  created_at: string;
};

function InvoicesPage() {
  const { user } = useAuth();
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    supabase
      .from("invoices")
      .select("id, invoice_number, amount, currency, customer_name, customer_email, status, created_at")
      .eq("merchant_id", user.id)
      .order("created_at", { ascending: false })
      .limit(100)
      .then(({ data }) => {
        setRows((data ?? []) as Row[]);
        setLoading(false);
      });
  }, [user]);

  return (
    <MerchantShell title="Invoices" subtitle="Your most recent 100 payment requests.">
      <div className="glass overflow-hidden rounded-2xl border border-glass-border">
        <table className="w-full text-sm">
          <thead className="bg-card/40 text-left text-xs uppercase tracking-wider text-muted-foreground">
            <tr>
              <th className="px-4 py-3">Invoice</th>
              <th className="px-4 py-3">Customer</th>
              <th className="px-4 py-3">Amount</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Created</th>
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr><td colSpan={5} className="px-4 py-8 text-center text-muted-foreground">Loading…</td></tr>
            )}
            {!loading && rows.length === 0 && (
              <tr><td colSpan={5} className="px-4 py-8 text-center text-muted-foreground">
                No invoices yet — create one via the API.
              </td></tr>
            )}
            {rows.map((r) => (
              <tr key={r.id} className="border-t border-glass-border">
                <td className="px-4 py-3 font-mono text-xs">{r.invoice_number}</td>
                <td className="px-4 py-3">
                  <div>{r.customer_name || "—"}</div>
                  <div className="text-xs text-muted-foreground">{r.customer_email || ""}</div>
                </td>
                <td className="px-4 py-3 font-medium">
                  {r.currency} {Number(r.amount).toLocaleString()}
                </td>
                <td className="px-4 py-3"><StatusBadge status={r.status} /></td>
                <td className="px-4 py-3 text-muted-foreground">{new Date(r.created_at).toLocaleString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </MerchantShell>
  );
}

function StatusBadge({ status }: { status: string }) {
  const tone =
    status === "completed" ? "bg-brand/10 text-brand" :
    status === "failed" || status === "cancelled" || status === "expired" ? "bg-destructive/10 text-destructive" :
    status === "processing" ? "bg-amber-500/10 text-amber-500" :
    "bg-muted text-muted-foreground";
  return (
    <span className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${tone}`}>
      {status}
    </span>
  );
}
