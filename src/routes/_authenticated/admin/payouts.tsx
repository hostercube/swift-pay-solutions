import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { AdminShell } from "@/components/admin-shell";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { useAuth } from "@/hooks/use-auth";

export const Route = createFileRoute("/_authenticated/admin/payouts")({
  head: () => ({ meta: [{ title: "Admin · Payouts" }] }),
  component: AdminPayoutsPage,
});

type Row = {
  id: string;
  merchant_id: string;
  amount: number;
  method: string;
  account_number: string;
  account_name: string | null;
  status: string;
  reference: string | null;
  admin_note: string | null;
  created_at: string;
};

const COLOR: Record<string, string> = {
  pending: "bg-warning/15 text-warning",
  approved: "bg-brand/15 text-brand",
  processed: "bg-success/15 text-success",
  rejected: "bg-destructive/15 text-destructive",
};

function AdminPayoutsPage() {
  const { user } = useAuth();
  const [rows, setRows] = useState<Row[]>([]);
  const [notes, setNotes] = useState<Record<string, string>>({});

  const load = async () => {
    const { data } = await supabase
      .from("payouts")
      .select("id, merchant_id, amount, method, account_number, account_name, status, reference, admin_note, created_at")
      .order("created_at", { ascending: false })
      .limit(200);
    setRows((data ?? []) as Row[]);
  };

  useEffect(() => { load(); }, []);

  const update = async (id: string, status: string) => {
    const { error } = await supabase
      .from("payouts")
      .update({
        status,
        admin_note: notes[id] ?? null,
        processed_at: status === "processed" ? new Date().toISOString() : null,
        processed_by: status === "processed" ? user?.id ?? null : null,
      })
      .eq("id", id);
    if (error) return toast.error(error.message);
    toast.success(`Payout ${status}`);
    load();
  };

  return (
    <AdminShell title="Payout requests" subtitle="Approve, reject, or mark as processed">
      <Card className="overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-muted/30 text-left text-xs uppercase tracking-wide text-muted-foreground">
            <tr>
              <th className="px-4 py-3">Date</th>
              <th className="px-4 py-3">Merchant</th>
              <th className="px-4 py-3">Method</th>
              <th className="px-4 py-3">Account</th>
              <th className="px-4 py-3">Amount</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Note / Action</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr><td colSpan={7} className="p-8 text-center text-muted-foreground">No payout requests</td></tr>
            ) : rows.map((r) => (
              <tr key={r.id} className="border-t border-glass-border align-top">
                <td className="px-4 py-3 text-xs">{new Date(r.created_at).toLocaleString()}</td>
                <td className="px-4 py-3 font-mono text-xs">{r.merchant_id.slice(0, 8)}</td>
                <td className="px-4 py-3 uppercase">{r.method}</td>
                <td className="px-4 py-3 font-mono text-xs">
                  {r.account_number}
                  {r.account_name ? <div className="text-muted-foreground">{r.account_name}</div> : null}
                </td>
                <td className="px-4 py-3">৳ {Number(r.amount).toLocaleString()}</td>
                <td className="px-4 py-3"><Badge className={COLOR[r.status] ?? ""}>{r.status}</Badge></td>
                <td className="px-4 py-3">
                  {r.status === "pending" || r.status === "approved" ? (
                    <div className="space-y-2">
                      <Input
                        placeholder="Note / reference"
                        value={notes[r.id] ?? r.admin_note ?? ""}
                        onChange={(e) => setNotes({ ...notes, [r.id]: e.target.value })}
                        className="h-8"
                      />
                      <div className="flex gap-1">
                        {r.status === "pending" && (
                          <Button size="sm" onClick={() => update(r.id, "approved")}>Approve</Button>
                        )}
                        <Button size="sm" variant="secondary" onClick={() => update(r.id, "processed")}>Mark processed</Button>
                        <Button size="sm" variant="destructive" onClick={() => update(r.id, "rejected")}>Reject</Button>
                      </div>
                    </div>
                  ) : (
                    <p className="text-xs text-muted-foreground">{r.admin_note ?? "—"}</p>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </AdminShell>
  );
}
