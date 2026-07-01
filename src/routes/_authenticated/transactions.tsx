import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { MerchantShell } from "@/components/merchant-shell";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";

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
      .limit(100)
      .then(({ data }) => {
        setRows((data ?? []) as Row[]);
        setLoading(false);
      });
  }, [user]);

  return (
    <MerchantShell title="Transactions" subtitle="Payment attempts recorded against your invoices.">
      <div className="glass overflow-hidden rounded-2xl border border-glass-border">
        <table className="w-full text-sm">
          <thead className="bg-card/40 text-left text-xs uppercase tracking-wider text-muted-foreground">
            <tr>
              <th className="px-4 py-3">Method</th>
              <th className="px-4 py-3">Sender</th>
              <th className="px-4 py-3">Reference</th>
              <th className="px-4 py-3">Gross</th>
              <th className="px-4 py-3">Net</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Time</th>
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr><td colSpan={7} className="px-4 py-8 text-center text-muted-foreground">Loading…</td></tr>
            )}
            {!loading && rows.length === 0 && (
              <tr><td colSpan={7} className="px-4 py-8 text-center text-muted-foreground">
                No transactions yet.
              </td></tr>
            )}
            {rows.map((r) => (
              <tr key={r.id} className="border-t border-glass-border">
                <td className="px-4 py-3 font-medium uppercase">{r.method_type}</td>
                <td className="px-4 py-3 text-muted-foreground">{r.sender_number || "—"}</td>
                <td className="px-4 py-3 font-mono text-xs">{r.reference || "—"}</td>
                <td className="px-4 py-3">৳ {Number(r.gross_amount).toLocaleString()}</td>
                <td className="px-4 py-3">৳ {Number(r.net_amount).toLocaleString()}</td>
                <td className="px-4 py-3">
                  <span className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${
                    r.status === "verified" ? "bg-brand/10 text-brand"
                    : r.status === "rejected" ? "bg-destructive/10 text-destructive"
                    : "bg-amber-500/10 text-amber-500"
                  }`}>{r.status}</span>
                </td>
                <td className="px-4 py-3 text-muted-foreground">{new Date(r.created_at).toLocaleString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </MerchantShell>
  );
}
