import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { MerchantShell } from "@/components/merchant-shell";
import { DataTable, type DataTableColumn } from "@/components/data-table";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

export const Route = createFileRoute("/_authenticated/discounts")({
  head: () => ({ meta: [{ title: "Discount codes · PayNOC" }] }),
  component: DiscountsPage,
});

type Row = {
  id: string;
  code: string;
  discount_type: string;
  value: number;
  max_uses: number | null;
  uses_count: number;
  expires_at: string | null;
  active: boolean;
};

function DiscountsPage() {
  const { user } = useAuth();
  const [rows, setRows] = useState<Row[]>([]);
  const [form, setForm] = useState({
    code: "",
    discount_type: "percent",
    value: "",
    max_uses: "",
    expires_at: "",
  });
  const [busy, setBusy] = useState(false);

  const load = async () => {
    if (!user) return;
    const { data } = await ((supabase.from as unknown as (t: string) => {
      select: (c: string) => {
        eq: (col: string, v: unknown) => {
          order: (c: string, o: { ascending: boolean }) => Promise<{ data: Row[] | null }>;
        };
      };
    }).bind(supabase))("discount_codes")
      .select("*")
      .eq("merchant_id", user.id)
      .order("created_at", { ascending: false });
    setRows(data ?? []);
  };
  useEffect(() => {
    load();
  }, [user]);

  const create = async () => {
    if (!user) return;
    if (!form.code.trim() || !form.value) return toast.error("Code and value required");
    setBusy(true);
    const { error } = await ((supabase.from as unknown as (t: string) => {
      insert: (r: Record<string, unknown>) => Promise<{ error: { message: string } | null }>;
    }).bind(supabase))("discount_codes").insert({
      merchant_id: user.id,
      code: form.code.trim().toUpperCase(),
      discount_type: form.discount_type,
      value: Number(form.value),
      max_uses: form.max_uses ? Number(form.max_uses) : null,
      expires_at: form.expires_at ? new Date(form.expires_at).toISOString() : null,
    });
    setBusy(false);
    if (error) return toast.error(error.message);
    setForm({ code: "", discount_type: "percent", value: "", max_uses: "", expires_at: "" });
    toast.success("Discount code created");
    load();
  };

  const toggle = async (r: Row) => {
    await ((supabase.from as unknown as (t: string) => {
      update: (p: Record<string, unknown>) => {
        eq: (c: string, v: unknown) => Promise<{ error: unknown }>;
      };
    }).bind(supabase))("discount_codes").update({ active: !r.active }).eq("id", r.id);
    load();
  };

  const remove = async (id: string) => {
    await ((supabase.from as unknown as (t: string) => {
      delete: () => { eq: (c: string, v: unknown) => Promise<{ error: unknown }> };
    }).bind(supabase))("discount_codes").delete().eq("id", id);
    load();
  };

  return (
    <MerchantShell
      title="Discount codes"
      subtitle="Create percent or flat-amount codes payers can apply at checkout."
    >
      <Card className="p-5">
        <h3 className="mb-3 font-medium">New code</h3>
        <div className="grid gap-2 md:grid-cols-5">
          <Input
            placeholder="CODE"
            value={form.code}
            onChange={(e) => setForm({ ...form, code: e.target.value })}
          />
          <select
            className="rounded-md border border-glass-border bg-background px-3 py-2 text-sm"
            value={form.discount_type}
            onChange={(e) => setForm({ ...form, discount_type: e.target.value })}
          >
            <option value="percent">Percent %</option>
            <option value="flat">Flat ৳</option>
          </select>
          <Input
            placeholder="Value"
            value={form.value}
            onChange={(e) => setForm({ ...form, value: e.target.value })}
          />
          <Input
            placeholder="Max uses (blank = ∞)"
            value={form.max_uses}
            onChange={(e) => setForm({ ...form, max_uses: e.target.value })}
          />
          <Input
            type="date"
            value={form.expires_at}
            onChange={(e) => setForm({ ...form, expires_at: e.target.value })}
          />
        </div>
        <Button className="mt-3" onClick={create} disabled={busy}>
          Create code
        </Button>
      </Card>

      <div className="mt-6">
        <DataTable<Row>
          rows={rows}
          rowKey={(r) => r.id}
          searchable={(r) => `${r.code} ${r.discount_type}`}
          emptyMessage="No discount codes yet"
          filters={[
            {
              key: "type",
              label: "Type",
              options: [
                { value: "percent", label: "Percent" },
                { value: "flat", label: "Flat" },
              ],
              match: (r, v) => r.discount_type === v,
            },
            {
              key: "status",
              label: "Status",
              options: [
                { value: "active", label: "Active" },
                { value: "disabled", label: "Disabled" },
              ],
              match: (r, v) => (v === "active" ? r.active : !r.active),
            },
          ]}
          columns={[
            { key: "code", label: "Code", render: (r) => <span className="font-mono">{r.code}</span> },
            { key: "type", label: "Type", render: (r) => r.discount_type },
            { key: "value", label: "Value", render: (r) => (r.discount_type === "percent" ? `${r.value}%` : `৳ ${r.value}`) },
            { key: "uses", label: "Uses", render: (r) => `${r.uses_count}/${r.max_uses ?? "∞"}` },
            { key: "exp", label: "Expires", render: (r) => <span className="text-xs">{r.expires_at ? new Date(r.expires_at).toLocaleDateString() : "—"}</span> },
            {
              key: "status",
              label: "Status",
              render: (r) => <Badge className={r.active ? "bg-success/15 text-success" : ""}>{r.active ? "active" : "disabled"}</Badge>,
            },
          ] as DataTableColumn<Row>[]}
          actions={(r) => (
            <>
              <button onClick={() => toggle(r)} className="text-xs text-brand hover:underline mr-3">
                {r.active ? "Disable" : "Enable"}
              </button>
              <button onClick={() => remove(r.id)} className="text-xs text-destructive hover:underline">
                Delete
              </button>
            </>
          )}
        />
      </div>
    </MerchantShell>
  );
}
