import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { AdminShell } from "@/components/admin-shell";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";

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
  const [q, setQ] = useState("");
  const [status, setStatus] = useState<string>("");

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from("transactions")
        .select("id, merchant_id, invoice_id, status, gross_amount, method_type, provider_txn_id, reference, created_at")
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
    })();
  }, []);

  const filtered = rows.filter((r) => {
    if (status && r.status !== status) return false;
    if (!q) return true;
    const s = q.toLowerCase();
    return (
      (r.provider_txn_id ?? "").toLowerCase().includes(s) ||
      (r.reference ?? "").toLowerCase().includes(s) ||
      (names[r.merchant_id] ?? "").toLowerCase().includes(s)
    );
  });

  return (
    <AdminShell title="All transactions" subtitle="Every payment attempt across every merchant.">
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search by txn id, reference, or merchant…" className="max-w-sm" />
        <select value={status} onChange={(e) => setStatus(e.target.value)} className="rounded-lg border border-glass-border bg-card/60 px-3 py-2 text-sm">
          <option value="">All statuses</option>
          <option>pending</option><option>verified</option><option>failed</option><option>refunded</option>
        </select>
        <span className="text-xs text-muted-foreground">{filtered.length} of {rows.length}</span>
      </div>
      <div className="glass overflow-x-auto rounded-2xl border border-glass-border">
        <table className="w-full text-sm">
          <thead className="bg-card/40 text-left text-xs uppercase tracking-wider text-muted-foreground">
            <tr>
              <th className="px-4 py-3">When</th>
              <th className="px-4 py-3">Merchant</th>
              <th className="px-4 py-3">Method</th>
              <th className="px-4 py-3">Amount</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Provider ref</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((r) => (
              <tr key={r.id} className="border-t border-glass-border">
                <td className="px-4 py-2 text-muted-foreground">{new Date(r.created_at).toLocaleString()}</td>
                <td className="px-4 py-2">{names[r.merchant_id] ?? <span className="text-muted-foreground">{r.merchant_id.slice(0,8)}</span>}</td>
                <td className="px-4 py-2 capitalize">{r.method_type?.replace(/_/g," ") ?? "—"}</td>
                <td className="px-4 py-2">৳ {Number(r.gross_amount ?? 0).toLocaleString()}</td>
                <td className="px-4 py-2"><Badge variant="outline" className="capitalize">{r.status}</Badge></td>
                <td className="px-4 py-2 font-mono text-xs text-muted-foreground">{r.provider_txn_id ?? r.reference ?? "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </AdminShell>
  );
}
