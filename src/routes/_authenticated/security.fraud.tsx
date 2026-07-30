import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { useActiveMerchant } from "@/hooks/use-active-merchant";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Trash2, ShieldAlert, Plus } from "lucide-react";
import { toast } from "sonner";
import { DataTable, type DataTableColumn, type DataTableFilter } from "@/components/data-table";

export const Route = createFileRoute("/_authenticated/security/fraud")({
  head: () => ({ meta: [{ title: "Fraud Rules · PayNOC" }] }),
  component: FraudPage,
});

type Row = { id: string; block_type: string; value: string; reason: string | null; created_at: string };

function FraudPage() {
  const { user } = useAuth();
  const { merchantId: activeMerchantId } = useActiveMerchant();
  const [rows, setRows] = useState<Row[]>([]);
  const [blockType, setBlockType] = useState("email");
  const [value, setValue] = useState("");
  const [reason, setReason] = useState("");

  const load = async () => {
    if (!user) return;
    const { data } = await supabase
      .from("fraud_blocklist")
      .select("id, block_type, value, reason, created_at")
      .eq("merchant_id", activeMerchantId ?? user.id)
      .order("created_at", { ascending: false });
    setRows((data ?? []) as Row[]);
  };

  useEffect(() => {
    load();
  }, [user, activeMerchantId]);

  const add = async () => {
    if (!user || !value.trim()) return;
    const { error } = await supabase.from("fraud_blocklist").insert({
      merchant_id: activeMerchantId ?? user.id,
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

      <div className="mt-6">
        <DataTable<Row>
          columns={[
            { key: "block_type", label: "Type", sortable: true, render: (r) => <span className="capitalize">{r.block_type.replace("_", " ")}</span> },
            { key: "value", label: "Value", render: (r) => <code className="font-mono text-xs">{r.value}</code> },
            { key: "reason", label: "Reason", render: (r) => <span className="text-xs text-muted-foreground">{r.reason ?? "—"}</span> },
            {
              key: "created_at",
              label: "Added",
              sortable: true,
              accessor: (r) => new Date(r.created_at),
              render: (r) => <span className="text-xs text-muted-foreground">{new Date(r.created_at).toLocaleDateString()}</span>,
            },
          ] as DataTableColumn<Row>[]}
          rows={rows}
          rowKey={(r) => r.id}
          emptyMessage="Blocklist is empty"
          searchable={(r) => `${r.value} ${r.reason ?? ""} ${r.block_type}`}
          filters={[
            {
              key: "block_type",
              label: "Type",
              options: [
                { value: "email", label: "Email" },
                { value: "phone", label: "Phone" },
                { value: "ip", label: "IP address" },
                { value: "sender_number", label: "Sender number" },
              ],
              match: (r, v) => r.block_type === v,
            },
          ] as DataTableFilter<Row>[]}
          dateField={(r) => r.created_at}
          actions={(r) => (
            <Button size="sm" variant="ghost" onClick={() => remove(r.id)}>
              <Trash2 className="h-4 w-4 text-destructive" />
            </Button>
          )}
          exportFilename="fraud-blocklist"
        />
      </div>
    </>
  );
}
