import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { MerchantShell } from "@/components/merchant-shell";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Wallet } from "lucide-react";

export const Route = createFileRoute("/_authenticated/payouts")({
  head: () => ({ meta: [{ title: "Payouts · PayNOC" }] }),
  component: PayoutsPage,
});

type Row = {
  id: string;
  amount: number;
  currency: string;
  method: string;
  account_number: string;
  status: string;
  reference: string | null;
  admin_note: string | null;
  created_at: string;
  processed_at: string | null;
};

const STATUS_COLOR: Record<string, string> = {
  pending: "bg-warning/15 text-warning",
  approved: "bg-brand/15 text-brand",
  processed: "bg-success/15 text-success",
  rejected: "bg-destructive/15 text-destructive",
};

function PayoutsPage() {
  const { user } = useAuth();
  const [rows, setRows] = useState<Row[]>([]);
  const [amount, setAmount] = useState("");
  const [method, setMethod] = useState("bkash");
  const [account, setAccount] = useState("");
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [balance, setBalance] = useState(0);

  const load = async () => {
    if (!user) return;
    const [{ data: p }, { data: inv }] = await Promise.all([
      supabase
        .from("payouts")
        .select("id, amount, currency, method, account_number, status, reference, admin_note, created_at, processed_at")
        .eq("merchant_id", user.id)
        .order("created_at", { ascending: false }),
      supabase
        .from("invoices")
        .select("amount, status")
        .eq("merchant_id", user.id)
        .eq("status", "completed"),
    ]);
    setRows((p ?? []) as Row[]);
    const totalPaid = (inv ?? []).reduce((a, r) => a + Number(r.amount), 0);
    const totalPayout = (p ?? []).filter((r) => r.status !== "rejected").reduce((a, r) => a + Number(r.amount), 0);
    setBalance(totalPaid - totalPayout);
  };

  useEffect(() => {
    load();
  }, [user]);

  const request = async () => {
    if (!user) return;
    const amt = Number(amount);
    if (!amt || amt <= 0) return toast.error("Enter valid amount");
    if (amt > balance) return toast.error("Amount exceeds available balance");
    if (!account.trim()) return toast.error("Account number required");
    setBusy(true);
    const { error } = await supabase.from("payouts").insert({
      merchant_id: user.id,
      amount: amt,
      method,
      account_number: account.trim(),
      account_name: name.trim() || null,
    });
    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success("Payout requested");
    setAmount("");
    setAccount("");
    setName("");
    load();
  };

  return (
    <MerchantShell title="Payouts" subtitle="Request withdrawal of your available balance">
      <div className="grid gap-4 md:grid-cols-3">
        <Card className="p-5 md:col-span-1">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Wallet className="h-4 w-4 text-brand" /> Available balance
          </div>
          <p className="mt-2 font-display text-3xl">৳ {balance.toLocaleString()}</p>
          <p className="mt-1 text-xs text-muted-foreground">Paid invoices − requested payouts</p>
        </Card>

        <Card className="p-5 md:col-span-2">
          <h3 className="mb-3 font-medium">Request payout</h3>
          <div className="grid gap-2 md:grid-cols-2">
            <Input placeholder="Amount (BDT)" value={amount} onChange={(e) => setAmount(e.target.value)} />
            <select
              className="rounded-md border border-glass-border bg-background px-3 py-2 text-sm"
              value={method}
              onChange={(e) => setMethod(e.target.value)}
            >
              <option value="bkash">bKash</option>
              <option value="nagad">Nagad</option>
              <option value="rocket">Rocket</option>
              <option value="bank">Bank transfer</option>
            </select>
            <Input placeholder="Account number" value={account} onChange={(e) => setAccount(e.target.value)} />
            <Input placeholder="Account holder name" value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <Button className="mt-3" onClick={request} disabled={busy}>
            Request payout
          </Button>
        </Card>
      </div>

      <Card className="mt-6 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-muted/30 text-left text-xs uppercase tracking-wide text-muted-foreground">
            <tr>
              <th className="px-4 py-3">Date</th>
              <th className="px-4 py-3">Method</th>
              <th className="px-4 py-3">Account</th>
              <th className="px-4 py-3">Amount</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Note</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={6} className="p-8 text-center text-muted-foreground">No payouts yet</td>
              </tr>
            ) : (
              rows.map((r) => (
                <tr key={r.id} className="border-t border-glass-border">
                  <td className="px-4 py-3">{new Date(r.created_at).toLocaleDateString()}</td>
                  <td className="px-4 py-3 uppercase">{r.method}</td>
                  <td className="px-4 py-3 font-mono text-xs">{r.account_number}</td>
                  <td className="px-4 py-3">৳ {Number(r.amount).toLocaleString()}</td>
                  <td className="px-4 py-3">
                    <Badge className={STATUS_COLOR[r.status] ?? ""}>{r.status}</Badge>
                  </td>
                  <td className="px-4 py-3 text-xs text-muted-foreground">{r.admin_note ?? "—"}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </Card>
    </MerchantShell>
  );
}
