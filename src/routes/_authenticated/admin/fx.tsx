import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { AdminShell } from "@/components/admin-shell";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/admin/fx")({
  head: () => ({ meta: [{ title: "Admin · FX Rates" }] }),
  component: FxPage,
});

type Row = { id: string; base_currency: string; quote_currency: string; rate: number; updated_at: string };

function FxPage() {
  const [rows, setRows] = useState<Row[]>([]);
  const [edits, setEdits] = useState<Record<string, string>>({});

  const load = async () => {
    const { data } = await supabase.from("fx_rates").select("*").order("base_currency");
    setRows((data ?? []) as Row[]);
  };

  useEffect(() => { load(); }, []);

  const save = async (id: string) => {
    const v = Number(edits[id]);
    if (!v || v <= 0) return toast.error("Invalid rate");
    const { error } = await supabase.from("fx_rates").update({ rate: v, updated_at: new Date().toISOString() }).eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Updated");
    load();
  };

  return (
    <AdminShell title="FX rates" subtitle="Multi-currency conversion to BDT">
      <Card className="overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-muted/30 text-left text-xs uppercase tracking-wide text-muted-foreground">
            <tr>
              <th className="px-4 py-3">Pair</th>
              <th className="px-4 py-3">Rate</th>
              <th className="px-4 py-3">Updated</th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id} className="border-t border-glass-border">
                <td className="px-4 py-3 font-mono">{r.base_currency} → {r.quote_currency}</td>
                <td className="px-4 py-3">
                  <Input
                    className="h-8 w-32"
                    defaultValue={String(r.rate)}
                    onChange={(e) => setEdits({ ...edits, [r.id]: e.target.value })}
                  />
                </td>
                <td className="px-4 py-3 text-xs text-muted-foreground">{new Date(r.updated_at).toLocaleString()}</td>
                <td className="px-4 py-3"><Button size="sm" onClick={() => save(r.id)}>Save</Button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </AdminShell>
  );
}
