import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { MerchantShell } from "@/components/merchant-shell";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

export const Route = createFileRoute("/_authenticated/payout-schedule")({
  head: () => ({ meta: [{ title: "Payout schedule · PayNOC" }] }),
  component: PayoutSchedulePage,
});

type Row = {
  id: string;
  frequency: string;
  min_amount: number;
  method: string;
  account_number: string;
  account_name: string | null;
  next_run_at: string;
  enabled: boolean;
  last_run_at: string | null;
  runs_count: number;
};

function PayoutSchedulePage() {
  const { user } = useAuth();
  const [rows, setRows] = useState<Row[]>([]);
  const [f, setF] = useState({
    frequency: "weekly",
    min_amount: "500",
    method: "bkash",
    account_number: "",
    account_name: "",
  });
  const [busy, setBusy] = useState(false);

  const load = async () => {
    if (!user) return;
    const { data } = await (supabase.from as unknown as (t: string) => {
      select: (c: string) => {
        eq: (c: string, v: unknown) => Promise<{ data: Row[] | null }>;
      };
    })("payout_schedules")
      .select("*")
      .eq("merchant_id", user.id);
    setRows(data ?? []);
  };
  useEffect(() => {
    load();
  }, [user]);

  const create = async () => {
    if (!user) return;
    if (!f.account_number.trim()) return toast.error("Account number required");
    setBusy(true);
    const next = new Date();
    if (f.frequency === "weekly") next.setUTCDate(next.getUTCDate() + 7);
    else next.setUTCDate(next.getUTCDate() + 30);
    const { error } = await (supabase.from as unknown as (t: string) => {
      insert: (r: Record<string, unknown>) => Promise<{ error: { message: string } | null }>;
    })("payout_schedules").insert({
      merchant_id: user.id,
      frequency: f.frequency,
      min_amount: Number(f.min_amount || 0),
      method: f.method,
      account_number: f.account_number.trim(),
      account_name: f.account_name.trim() || null,
      next_run_at: next.toISOString(),
    });
    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success("Auto payout scheduled");
    setF({ ...f, account_number: "", account_name: "" });
    load();
  };

  const toggle = async (r: Row) => {
    await (supabase.from as unknown as (t: string) => {
      update: (p: Record<string, unknown>) => {
        eq: (c: string, v: unknown) => Promise<{ error: unknown }>;
      };
    })("payout_schedules").update({ enabled: !r.enabled }).eq("id", r.id);
    load();
  };

  const remove = async (id: string) => {
    await (supabase.from as unknown as (t: string) => {
      delete: () => { eq: (c: string, v: unknown) => Promise<{ error: unknown }> };
    })("payout_schedules").delete().eq("id", id);
    load();
  };

  return (
    <MerchantShell
      title="Auto payout schedule"
      subtitle="Automatically request a payout when your balance meets the minimum."
    >
      <Card className="p-5">
        <h3 className="mb-3 font-medium">New schedule</h3>
        <div className="grid gap-2 md:grid-cols-5">
          <select
            className="rounded-md border border-glass-border bg-background px-3 py-2 text-sm"
            value={f.frequency}
            onChange={(e) => setF({ ...f, frequency: e.target.value })}
          >
            <option value="weekly">Weekly</option>
            <option value="monthly">Monthly</option>
          </select>
          <Input
            placeholder="Min amount ৳"
            value={f.min_amount}
            onChange={(e) => setF({ ...f, min_amount: e.target.value })}
          />
          <select
            className="rounded-md border border-glass-border bg-background px-3 py-2 text-sm"
            value={f.method}
            onChange={(e) => setF({ ...f, method: e.target.value })}
          >
            <option value="bkash">bKash</option>
            <option value="nagad">Nagad</option>
            <option value="rocket">Rocket</option>
            <option value="bank">Bank</option>
          </select>
          <Input
            placeholder="Account number"
            value={f.account_number}
            onChange={(e) => setF({ ...f, account_number: e.target.value })}
          />
          <Input
            placeholder="Account name"
            value={f.account_name}
            onChange={(e) => setF({ ...f, account_name: e.target.value })}
          />
        </div>
        <Button className="mt-3" onClick={create} disabled={busy}>
          Add schedule
        </Button>
      </Card>

      <Card className="mt-6 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-muted/30 text-left text-xs uppercase tracking-wide text-muted-foreground">
            <tr>
              <th className="px-4 py-3">Frequency</th>
              <th className="px-4 py-3">Min</th>
              <th className="px-4 py-3">Method</th>
              <th className="px-4 py-3">Account</th>
              <th className="px-4 py-3">Next run</th>
              <th className="px-4 py-3">Runs</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={8} className="p-8 text-center text-muted-foreground">
                  No schedules yet
                </td>
              </tr>
            ) : (
              rows.map((r) => (
                <tr key={r.id} className="border-t border-glass-border">
                  <td className="px-4 py-3">{r.frequency}</td>
                  <td className="px-4 py-3">৳ {Number(r.min_amount).toLocaleString()}</td>
                  <td className="px-4 py-3 uppercase">{r.method}</td>
                  <td className="px-4 py-3 font-mono text-xs">{r.account_number}</td>
                  <td className="px-4 py-3 text-xs">
                    {new Date(r.next_run_at).toLocaleString()}
                  </td>
                  <td className="px-4 py-3">{r.runs_count}</td>
                  <td className="px-4 py-3">
                    <Badge className={r.enabled ? "bg-success/15 text-success" : ""}>
                      {r.enabled ? "active" : "paused"}
                    </Badge>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <button
                      onClick={() => toggle(r)}
                      className="text-xs text-brand hover:underline mr-3"
                    >
                      {r.enabled ? "Pause" : "Resume"}
                    </button>
                    <button
                      onClick={() => remove(r.id)}
                      className="text-xs text-destructive hover:underline"
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </Card>
    </MerchantShell>
  );
}
