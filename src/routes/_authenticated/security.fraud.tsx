import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Trash2, ShieldAlert, Plus } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/security/fraud")({
  head: () => ({ meta: [{ title: "Fraud Rules · PayNOC" }] }),
  component: FraudPage,
});

type Row = { id: string; block_type: string; value: string; reason: string | null; created_at: string };

function FraudPage() {
  const { user } = useAuth();
  const [rows, setRows] = useState<Row[]>([]);
  const [blockType, setBlockType] = useState("email");
  const [value, setValue] = useState("");
  const [reason, setReason] = useState("");

  const load = async () => {
    if (!user) return;
    const { data } = await supabase
      .from("fraud_blocklist")
      .select("id, block_type, value, reason, created_at")
      .eq("merchant_id", user.id)
      .order("created_at", { ascending: false });
    setRows((data ?? []) as Row[]);
  };

  useEffect(() => {
    load();
  }, [user]);

  const add = async () => {
    if (!user || !value.trim()) return;
    const { error } = await supabase.from("fraud_blocklist").insert({
      merchant_id: user.id,
      block_type: blockType,
      value: value.trim().toLowerCase(),
      reason: reason.trim() || null,
    });
    if (error) return toast.error(error.message);
    toast.success("Blocked");
    setValue("");
    setReason("");
    load();
  };

  const remove = async (id: string) => {
    await supabase.from("fraud_blocklist").delete().eq("id", id);
    load();
  };

  return (
    <>
      <Card className="p-5">
        <div className="mb-3 flex items-start gap-2 rounded-lg border border-glass-border bg-muted/30 p-3 text-sm text-muted-foreground">
          <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0 text-warning" />
          <p>Any incoming payment matching a blocklist entry is auto-rejected at checkout.</p>
        </div>
        <div className="grid gap-2 md:grid-cols-[160px_1fr_1fr_auto]">
          <select
            className="rounded-md border border-glass-border bg-background px-3 py-2 text-sm"
            value={blockType}
            onChange={(e) => setBlockType(e.target.value)}
          >
            <option value="email">Email</option>
            <option value="phone">Phone</option>
            <option value="ip">IP address</option>
            <option value="sender_number">Sender number</option>
          </select>
          <Input placeholder="Value to block" value={value} onChange={(e) => setValue(e.target.value)} />
          <Input placeholder="Reason (optional)" value={reason} onChange={(e) => setReason(e.target.value)} />
          <Button onClick={add} disabled={!value.trim()}>
            <Plus className="mr-1.5 h-4 w-4" /> Add
          </Button>
        </div>
      </Card>

      <Card className="mt-6 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-muted/30 text-left text-xs uppercase tracking-wide text-muted-foreground">
            <tr>
              <th className="px-4 py-3">Type</th>
              <th className="px-4 py-3">Value</th>
              <th className="px-4 py-3">Reason</th>
              <th className="px-4 py-3">Added</th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr><td colSpan={5} className="p-8 text-center text-muted-foreground">Blocklist is empty</td></tr>
            ) : (
              rows.map((r) => (
                <tr key={r.id} className="border-t border-glass-border">
                  <td className="px-4 py-3 capitalize">{r.block_type.replace("_", " ")}</td>
                  <td className="px-4 py-3 font-mono text-xs">{r.value}</td>
                  <td className="px-4 py-3 text-xs text-muted-foreground">{r.reason ?? "—"}</td>
                  <td className="px-4 py-3 text-xs text-muted-foreground">{new Date(r.created_at).toLocaleDateString()}</td>
                  <td className="px-4 py-3 text-right">
                    <Button size="sm" variant="ghost" onClick={() => remove(r.id)}>
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </Card>
    </>
  );
}
