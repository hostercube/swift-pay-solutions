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
  const [nb, setNb] = useState("USD");
  const [nq, setNq] = useState("BDT");
  const [nr, setNr] = useState("");

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

  const remove = async (id: string) => {
    if (!confirm("Delete this FX pair?")) return;
    const { error } = await supabase.from("fx_rates").delete().eq("id", id);
    if (error) return toast.error(error.message);
    load();
  };

  const addPair = async () => {
    const base = nb.trim().toUpperCase();
    const quote = nq.trim().toUpperCase();
    const rate = Number(nr);
    if (base.length !== 3 || quote.length !== 3) return toast.error("Use 3-letter ISO codes");
    if (!rate || rate <= 0) return toast.error("Rate must be > 0");
    const { error } = await supabase.from("fx_rates").upsert(
      { base_currency: base, quote_currency: quote, rate, updated_at: new Date().toISOString() },
      { onConflict: "base_currency,quote_currency" },
    );
    if (error) return toast.error(error.message);
    toast.success(`${base} → ${quote} saved`);
    setNr("");
    load();
  };

  return (
    <AdminShell title="FX rates" subtitle="Multi-currency conversion. Add any ISO 4217 pair.">
      <Card className="mb-4 p-4">
        <div className="grid gap-3 sm:grid-cols-[100px_100px_1fr_auto] sm:items-end">
          <div>
            <label className="text-xs uppercase text-muted-foreground">Base</label>
            <Input value={nb} onChange={(e) => setNb(e.target.value.toUpperCase())} maxLength={3} />
          </div>
          <div>
            <label className="text-xs uppercase text-muted-foreground">Quote</label>
            <Input value={nq} onChange={(e) => setNq(e.target.value.toUpperCase())} maxLength={3} />
          </div>
          <div>
            <label className="text-xs uppercase text-muted-foreground">Rate (1 base = X quote)</label>
            <Input type="number" step="0.0001" value={nr} onChange={(e) => setNr(e.target.value)} placeholder="e.g. 120.00" />
          </div>
          <Button onClick={addPair}>Add / update pair</Button>
        </div>
      </Card>

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
            {rows.length === 0 ? (
              <tr><td colSpan={4} className="p-8 text-center text-muted-foreground">No FX rates yet. Add a pair above.</td></tr>
            ) : rows.map((r) => (
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
                <td className="px-4 py-3">
                  <div className="flex gap-2">
                    <Button size="sm" onClick={() => save(r.id)}>Save</Button>
                    <Button size="sm" variant="outline" onClick={() => remove(r.id)}>Delete</Button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </AdminShell>
  );
}
