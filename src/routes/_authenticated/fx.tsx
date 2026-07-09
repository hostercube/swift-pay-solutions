import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState, useCallback } from "react";
import { toast } from "sonner";
import { Plus, Trash2, Save, RefreshCw, ChevronLeft, ChevronRight, Search } from "lucide-react";
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
  mode: "auto" | "manual";
  markup_percent: number;
  updated_at: string;
};
type Global = { base_currency: string; quote_currency: string; rate: number; updated_at?: string };

const CURRENCIES = ["BDT", "USD", "EUR", "GBP", "INR", "AED", "SAR", "MYR", "SGD", "CAD", "AUD"];
const PAGE_SIZE = 10;

function FxPage() {
  const { user } = useAuth();
  const [rows, setRows] = useState<Row[]>([]);
  const [globals, setGlobals] = useState<Global[]>([]);
  const [drafts, setDrafts] = useState<Record<string, { rate?: string; markup?: string }>>({});
  const [adding, setAdding] = useState({
    base_currency: "USD",
    quote_currency: "BDT",
    rate: "",
    mode: "manual" as "auto" | "manual",
    markup_percent: "0",
  });
  const [busy, setBusy] = useState(false);
  const [filter, setFilter] = useState("");
  const [modeFilter, setModeFilter] = useState<"all" | "auto" | "manual">("all");
  const [page, setPage] = useState(1);

  const load = useCallback(async () => {
    if (!user) return;
    const [{ data: mine }, { data: g }] = await Promise.all([
      supabase.from("merchant_fx_rates").select("*").eq("merchant_id", user.id).order("base_currency"),
      supabase.from("fx_rates").select("base_currency, quote_currency, rate, updated_at"),
    ]);
    setRows((mine ?? []) as Row[]);
    setGlobals((g ?? []) as Global[]);
  }, [user]);

  useEffect(() => { load(); }, [load]);

  const filtered = useMemo(() => {
    const q = filter.trim().toUpperCase();
    return rows.filter((r) => {
      if (modeFilter !== "all" && r.mode !== modeFilter) return false;
      if (!q) return true;
      return r.base_currency.includes(q) || r.quote_currency.includes(q);
    });
  }, [rows, filter, modeFilter]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const pageRows = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  useEffect(() => { if (page > totalPages) setPage(1); }, [page, totalPages]);

  function globalRate(base: string, quote: string) {
    return globals.find((g) => g.base_currency === base && g.quote_currency === quote)?.rate;
  }

  function effectiveRate(r: Row) {
    if (r.mode === "auto") {
      const g = globalRate(r.base_currency, r.quote_currency);
      if (g == null) return r.rate;
      return g * (1 + Number(r.markup_percent || 0) / 100);
    }
    return r.rate;
  }

  async function saveRow(r: Row) {
    const d = drafts[r.id] ?? {};
    const patch: Partial<Row> = {};
    if (d.rate !== undefined) {
      const v = Number(d.rate);
      if (!v || v <= 0) return toast.error("Invalid rate");
      patch.rate = v;
    }
    if (d.markup !== undefined) {
      const v = Number(d.markup);
      if (Number.isNaN(v)) return toast.error("Invalid markup");
      patch.markup_percent = v;
    }
    if (Object.keys(patch).length === 0) return;
    setBusy(true);
    const { error } = await supabase.from("merchant_fx_rates").update(patch).eq("id", r.id);
    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success("Saved");
    setDrafts((x) => { const n = { ...x }; delete n[r.id]; return n; });
    load();
  }

  async function setMode(r: Row, mode: "auto" | "manual") {
    const { error } = await supabase.from("merchant_fx_rates").update({ mode }).eq("id", r.id);
    if (error) return toast.error(error.message);
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
    if (adding.base_currency === adding.quote_currency) return toast.error("Choose different currencies");
    const payload: Record<string, unknown> = {
      merchant_id: user.id,
      base_currency: adding.base_currency.toUpperCase(),
      quote_currency: adding.quote_currency.toUpperCase(),
      mode: adding.mode,
      markup_percent: Number(adding.markup_percent) || 0,
    };
    if (adding.mode === "manual") {
      const v = Number(adding.rate);
      if (!v || v <= 0) return toast.error("Enter a valid rate");
      payload.rate = v;
    } else {
      // Seed with current platform rate as a placeholder
      const g = globalRate(payload.base_currency as string, payload.quote_currency as string);
      payload.rate = g ?? 1;
    }
    setBusy(true);
    const { error } = await supabase.from("merchant_fx_rates").upsert(payload, {
      onConflict: "merchant_id,base_currency,quote_currency",
    });
    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success("Rate added");
    setAdding({ base_currency: "USD", quote_currency: "BDT", rate: "", mode: "manual", markup_percent: "0" });
    load();
  }

  return (
    <MerchantShell title="Currency rates" subtitle="Choose auto (daily updated market rate + your markup) or manual (you set the rate).">
      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2 glass rounded-2xl border border-glass-border p-5">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="font-display text-lg font-semibold">Your rates</h2>
            <span className="ml-auto text-xs text-muted-foreground">{filtered.length} pair{filtered.length === 1 ? "" : "s"}</span>
          </div>

          {/* Filters */}
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <div className="relative flex-1 min-w-[180px]">
              <Search className="pointer-events-none absolute left-2 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <input
                value={filter}
                onChange={(e) => { setFilter(e.target.value); setPage(1); }}
                placeholder="Filter by currency (e.g. USD)"
                className="w-full rounded border border-glass-border bg-background pl-8 pr-2 py-2 text-sm"
              />
            </div>
            <select
              value={modeFilter}
              onChange={(e) => { setModeFilter(e.target.value as "all" | "auto" | "manual"); setPage(1); }}
              className="rounded border border-glass-border bg-background px-2 py-2 text-sm"
            >
              <option value="all">All modes</option>
              <option value="auto">Auto only</option>
              <option value="manual">Manual only</option>
            </select>
          </div>

          <div className="mt-4 overflow-hidden rounded-xl border border-glass-border">
            <table className="w-full text-sm">
              <thead className="bg-card/40 text-left text-xs uppercase text-muted-foreground">
                <tr>
                  <th className="px-3 py-2">Pair</th>
                  <th className="px-3 py-2">Mode</th>
                  <th className="px-3 py-2">Rate / Markup</th>
                  <th className="px-3 py-2">Effective</th>
                  <th className="px-3 py-2"></th>
                </tr>
              </thead>
              <tbody>
                {pageRows.length === 0 && (
                  <tr><td colSpan={5} className="px-3 py-6 text-center text-xs text-muted-foreground">No rates match — platform defaults apply.</td></tr>
                )}
                {pageRows.map((r) => {
                  const d = drafts[r.id] ?? {};
                  const dirty = d.rate !== undefined || d.markup !== undefined;
                  return (
                    <tr key={r.id} className="border-t border-glass-border align-top">
                      <td className="px-3 py-2 font-mono">{r.base_currency} → {r.quote_currency}</td>
                      <td className="px-3 py-2">
                        <select
                          value={r.mode}
                          onChange={(e) => setMode(r, e.target.value as "auto" | "manual")}
                          className="rounded border border-glass-border bg-background px-2 py-1 text-xs"
                        >
                          <option value="auto">Auto (daily)</option>
                          <option value="manual">Manual</option>
                        </select>
                      </td>
                      <td className="px-3 py-2">
                        {r.mode === "manual" ? (
                          <input
                            type="number" step="0.0001" min="0"
                            defaultValue={r.rate}
                            onChange={(e) => setDrafts((x) => ({ ...x, [r.id]: { ...x[r.id], rate: e.target.value } }))}
                            className="w-32 rounded border border-glass-border bg-background px-2 py-1 font-mono text-xs"
                          />
                        ) : (
                          <div className="flex items-center gap-1 text-xs">
                            <input
                              type="number" step="0.01"
                              defaultValue={r.markup_percent}
                              onChange={(e) => setDrafts((x) => ({ ...x, [r.id]: { ...x[r.id], markup: e.target.value } }))}
                              className="w-20 rounded border border-glass-border bg-background px-2 py-1 font-mono"
                            />
                            <span className="text-muted-foreground">% markup</span>
                          </div>
                        )}
                      </td>
                      <td className="px-3 py-2 font-mono text-xs">
                        {effectiveRate(r).toFixed(4)}
                        <div className="text-[10px] text-muted-foreground">
                          {r.mode === "auto" ? `base ${globalRate(r.base_currency, r.quote_currency) ?? "—"}` : new Date(r.updated_at).toLocaleDateString()}
                        </div>
                      </td>
                      <td className="px-3 py-2 text-right whitespace-nowrap">
                        {dirty && (
                          <button onClick={() => saveRow(r)} disabled={busy} className="mr-2 inline-flex items-center gap-1 rounded-md bg-brand/10 px-2 py-1 text-xs font-semibold text-brand hover:bg-brand/20">
                            <Save className="h-3 w-3" /> Save
                          </button>
                        )}
                        <button onClick={() => removeRow(r.id)} className="text-destructive hover:text-destructive/80">
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {filtered.length > PAGE_SIZE && (
            <div className="mt-3 flex items-center justify-between text-xs text-muted-foreground">
              <span>Page {page} of {totalPages}</span>
              <div className="flex gap-1">
                <button
                  disabled={page <= 1}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  className="inline-flex items-center gap-1 rounded border border-glass-border px-2 py-1 disabled:opacity-40"
                >
                  <ChevronLeft className="h-3 w-3" /> Prev
                </button>
                <button
                  disabled={page >= totalPages}
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  className="inline-flex items-center gap-1 rounded border border-glass-border px-2 py-1 disabled:opacity-40"
                >
                  Next <ChevronRight className="h-3 w-3" />
                </button>
              </div>
            </div>
          )}

          <div className="mt-6">
            <h3 className="text-sm font-semibold">Add / override rate</h3>
            <div className="mt-2 grid gap-2 sm:grid-cols-6">
              <select value={adding.base_currency} onChange={(e) => setAdding({ ...adding, base_currency: e.target.value })} className="rounded border border-glass-border bg-background px-2 py-2 text-sm">
                {CURRENCIES.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
              <select value={adding.quote_currency} onChange={(e) => setAdding({ ...adding, quote_currency: e.target.value })} className="rounded border border-glass-border bg-background px-2 py-2 text-sm">
                {CURRENCIES.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
              <select value={adding.mode} onChange={(e) => setAdding({ ...adding, mode: e.target.value as "auto" | "manual" })} className="rounded border border-glass-border bg-background px-2 py-2 text-sm">
                <option value="manual">Manual</option>
                <option value="auto">Auto (daily)</option>
              </select>
              {adding.mode === "manual" ? (
                <input type="number" step="0.0001" min="0" value={adding.rate} onChange={(e) => setAdding({ ...adding, rate: e.target.value })} placeholder="Rate" className="rounded border border-glass-border bg-background px-2 py-2 font-mono text-sm" />
              ) : (
                <input type="number" step="0.01" value={adding.markup_percent} onChange={(e) => setAdding({ ...adding, markup_percent: e.target.value })} placeholder="Markup %" className="rounded border border-glass-border bg-background px-2 py-2 font-mono text-sm" />
              )}
              <button onClick={addRow} disabled={busy} className="sm:col-span-2 inline-flex items-center justify-center gap-1 rounded-md bg-gradient-brand px-3 py-2 text-sm font-semibold text-brand-foreground disabled:opacity-60">
                <Plus className="h-4 w-4" /> Add pair
              </button>
            </div>
            <p className="mt-2 text-[11px] text-muted-foreground">
              <strong>Auto:</strong> platform daily rate × (1 + your markup %). <strong>Manual:</strong> your exact rate — never auto-updated.
            </p>
          </div>
        </div>

        <div className="glass rounded-2xl border border-glass-border p-5">
          <div className="flex items-center justify-between">
            <h2 className="font-display text-lg font-semibold">Live market rates</h2>
            <RefreshCw className="h-4 w-4 text-muted-foreground" />
          </div>
          <p className="mt-1 text-xs text-muted-foreground">Refreshed daily. Used as the base for Auto-mode pairs.</p>
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
