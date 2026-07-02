import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState, useCallback } from "react";
import { toast } from "sonner";
import { Plus, Trash2, Save } from "lucide-react";
import { MerchantShell } from "@/components/merchant-shell";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";

export const Route = createFileRoute("/_authenticated/fx")({
  head: () => ({ meta: [{ title: "Currency rates · PayNOC" }] }),
  component: FxPage,
});

type Row = {
  id: string;
  merchant_id: string;
  base_currency: string;
  quote_currency: string;
  rate: number;
  updated_at: string;
};
type Global = { base_currency: string; quote_currency: string; rate: number };

const CURRENCIES = ["BDT", "USD", "EUR", "GBP", "INR", "AED", "SAR", "MYR", "SGD", "CAD", "AUD"];

function FxPage() {
  const { user } = useAuth();
  const [rows, setRows] = useState<Row[]>([]);
  const [globals, setGlobals] = useState<Global[]>([]);
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [adding, setAdding] = useState({ base_currency: "BDT", quote_currency: "USD", rate: "" });
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    if (!user) return;
    const [{ data: mine }, { data: g }] = await Promise.all([
      supabase.from("merchant_fx_rates").select("*").eq("merchant_id", user.id).order("base_currency"),
      supabase.from("fx_rates").select("base_currency, quote_currency, rate"),
    ]);
    setRows((mine ?? []) as Row[]);
    setGlobals((g ?? []) as Global[]);
  }, [user]);

  useEffect(() => { load(); }, [load]);

  async function saveRow(id: string) {
    const v = Number(drafts[id]);
    if (!v || v <= 0) return toast.error("Invalid rate");
    setBusy(true);
    const { error } = await supabase.from("merchant_fx_rates").update({ rate: v }).eq("id", id);
    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success("Saved");
    setDrafts((d) => { const n = { ...d }; delete n[id]; return n; });
    load();
  }

  async function removeRow(id: string) {
    if (!confirm("Delete this rate?")) return;
    const { error } = await supabase.from("merchant_fx_rates").delete().eq("id", id);
    if (error) return toast.error(error.message);
    load();
  }

  async function addRow() {
    if (!user) return;
    const v = Number(adding.rate);
    if (!v || v <= 0) return toast.error("Enter a valid rate");
    if (adding.base_currency === adding.quote_currency) return toast.error("Choose different currencies");
    setBusy(true);
    const { error } = await supabase.from("merchant_fx_rates").upsert(
      {
        merchant_id: user.id,
        base_currency: adding.base_currency.toUpperCase(),
        quote_currency: adding.quote_currency.toUpperCase(),
        rate: v,
      },
      { onConflict: "merchant_id,base_currency,quote_currency" },
    );
    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success("Rate added");
    setAdding({ base_currency: "BDT", quote_currency: "USD", rate: "" });
    load();
  }

  return (
    <MerchantShell title="Currency rates" subtitle="Set your own FX rates for multi-currency checkout. Falls back to platform default when unset.">
      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2 glass rounded-2xl border border-glass-border p-5">
          <h2 className="font-display text-lg font-semibold">Your rates</h2>
          <p className="mt-1 text-xs text-muted-foreground">
            1 [base] = [rate] × [quote]. Example: 1 BDT = 0.0091 USD.
          </p>

          <div className="mt-4 overflow-hidden rounded-xl border border-glass-border">
            <table className="w-full text-sm">
              <thead className="bg-card/40 text-left text-xs uppercase text-muted-foreground">
                <tr>
                  <th className="px-3 py-2">Base</th>
                  <th className="px-3 py-2">Quote</th>
                  <th className="px-3 py-2">Your rate</th>
                  <th className="px-3 py-2">Updated</th>
                  <th className="px-3 py-2"></th>
                </tr>
              </thead>
              <tbody>
                {rows.length === 0 && (
                  <tr><td colSpan={5} className="px-3 py-6 text-center text-xs text-muted-foreground">No custom rates yet — platform defaults apply.</td></tr>
                )}
                {rows.map((r) => (
                  <tr key={r.id} className="border-t border-glass-border">
                    <td className="px-3 py-2 font-mono">{r.base_currency}</td>
                    <td className="px-3 py-2 font-mono">{r.quote_currency}</td>
                    <td className="px-3 py-2">
                      <input
                        type="number" step="0.0001" min="0"
                        defaultValue={r.rate}
                        onChange={(e) => setDrafts((d) => ({ ...d, [r.id]: e.target.value }))}
                        className="w-32 rounded border border-glass-border bg-background px-2 py-1 font-mono text-xs"
                      />
                    </td>
                    <td className="px-3 py-2 text-xs text-muted-foreground">{new Date(r.updated_at).toLocaleString()}</td>
                    <td className="px-3 py-2 text-right">
                      {drafts[r.id] !== undefined && (
                        <button onClick={() => saveRow(r.id)} disabled={busy} className="mr-2 inline-flex items-center gap-1 rounded-md bg-brand/10 px-2 py-1 text-xs font-semibold text-brand hover:bg-brand/20">
                          <Save className="h-3 w-3" /> Save
                        </button>
                      )}
                      <button onClick={() => removeRow(r.id)} className="text-destructive hover:text-destructive/80">
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="mt-6">
            <h3 className="text-sm font-semibold">Add / override rate</h3>
            <div className="mt-2 grid gap-2 sm:grid-cols-4">
              <select value={adding.base_currency} onChange={(e) => setAdding({ ...adding, base_currency: e.target.value })} className="rounded border border-glass-border bg-background px-2 py-2 text-sm">
                {CURRENCIES.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
              <select value={adding.quote_currency} onChange={(e) => setAdding({ ...adding, quote_currency: e.target.value })} className="rounded border border-glass-border bg-background px-2 py-2 text-sm">
                {CURRENCIES.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
              <input type="number" step="0.0001" min="0" value={adding.rate} onChange={(e) => setAdding({ ...adding, rate: e.target.value })} placeholder="Rate" className="rounded border border-glass-border bg-background px-2 py-2 font-mono text-sm" />
              <button onClick={addRow} disabled={busy} className="inline-flex items-center justify-center gap-1 rounded-md bg-gradient-brand px-3 py-2 text-sm font-semibold text-brand-foreground disabled:opacity-60">
                <Plus className="h-4 w-4" /> Add
              </button>
            </div>
          </div>
        </div>

        <div className="glass rounded-2xl border border-glass-border p-5">
          <h2 className="font-display text-lg font-semibold">Platform defaults</h2>
          <p className="mt-1 text-xs text-muted-foreground">Used when you haven't set a custom rate.</p>
          <ul className="mt-3 space-y-1 text-sm">
            {globals.length === 0 && <li className="text-xs text-muted-foreground">No platform rates configured.</li>}
            {globals.map((g, i) => (
              <li key={i} className="flex justify-between font-mono text-xs">
                <span>{g.base_currency} → {g.quote_currency}</span>
                <span>{g.rate}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </MerchantShell>
  );
}
