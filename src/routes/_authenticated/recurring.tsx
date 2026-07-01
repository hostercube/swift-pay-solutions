import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Plus, Trash2, Pause, Play } from "lucide-react";
import { toast } from "sonner";
import { MerchantShell } from "@/components/merchant-shell";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";

export const Route = createFileRoute("/_authenticated/recurring")({
  head: () => ({ meta: [{ title: "Recurring · PayNOC" }] }),
  component: RecurringPage,
});

type Row = {
  id: string;
  name: string;
  amount: number;
  currency: string;
  customer_email: string | null;
  interval_unit: string;
  interval_count: number;
  next_run_at: string;
  last_run_at: string | null;
  is_active: boolean;
  runs_count: number;
  mode: string;
};

function RecurringPage() {
  const { user } = useAuth();
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);

  async function load() {
    if (!user) return;
    setLoading(true);
    const { data } = await supabase
      .from("recurring_schedules")
      .select("id, name, amount, currency, customer_email, interval_unit, interval_count, next_run_at, last_run_at, is_active, runs_count, mode")
      .eq("merchant_id", user.id)
      .order("created_at", { ascending: false });
    setRows((data ?? []) as Row[]);
    setLoading(false);
  }
  useEffect(() => { load(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [user]);

  async function toggle(id: string, active: boolean) {
    const { error } = await supabase.from("recurring_schedules").update({ is_active: !active }).eq("id", id);
    if (error) return toast.error(error.message);
    toast.success(active ? "Paused" : "Resumed");
    load();
  }

  async function remove(id: string) {
    if (!confirm("Delete this recurring schedule?")) return;
    const { error } = await supabase.from("recurring_schedules").delete().eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Deleted");
    load();
  }

  return (
    <MerchantShell
      title="Recurring invoices"
      subtitle="Auto-generate invoices on a daily, weekly, or monthly schedule."
      actions={
        <button
          onClick={() => setShowForm((s) => !s)}
          className="inline-flex items-center gap-2 rounded-lg bg-gradient-brand px-4 py-2 text-sm font-semibold text-brand-foreground"
        >
          <Plus className="h-4 w-4" /> New schedule
        </button>
      }
    >
      {showForm && (
        <NewScheduleForm
          onClose={() => setShowForm(false)}
          onCreated={() => { setShowForm(false); load(); }}
        />
      )}

      <div className="glass overflow-hidden rounded-2xl border border-glass-border">
        <table className="w-full text-sm">
          <thead className="bg-card/40 text-left text-xs uppercase tracking-wider text-muted-foreground">
            <tr>
              <th className="px-4 py-3">Name</th>
              <th className="px-4 py-3">Customer</th>
              <th className="px-4 py-3">Amount</th>
              <th className="px-4 py-3">Every</th>
              <th className="px-4 py-3">Next run</th>
              <th className="px-4 py-3">Runs</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading && (<tr><td colSpan={8} className="px-4 py-8 text-center text-muted-foreground">Loading…</td></tr>)}
            {!loading && rows.length === 0 && (
              <tr><td colSpan={8} className="px-4 py-10 text-center text-muted-foreground">
                No recurring schedules yet.
              </td></tr>
            )}
            {rows.map((r) => (
              <tr key={r.id} className="border-t border-glass-border">
                <td className="px-4 py-3">
                  <div className="font-medium">{r.name}</div>
                  {r.mode === "test" && <span className="text-[9px] font-bold uppercase text-amber-500">Test</span>}
                </td>
                <td className="px-4 py-3 text-muted-foreground">{r.customer_email || "—"}</td>
                <td className="px-4 py-3 font-medium">{r.currency} {Number(r.amount).toLocaleString()}</td>
                <td className="px-4 py-3 text-muted-foreground">{r.interval_count} {r.interval_unit}{r.interval_count > 1 ? "s" : ""}</td>
                <td className="px-4 py-3 text-muted-foreground">{new Date(r.next_run_at).toLocaleString()}</td>
                <td className="px-4 py-3">{r.runs_count}</td>
                <td className="px-4 py-3">
                  <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${r.is_active ? "bg-brand/10 text-brand" : "bg-muted text-muted-foreground"}`}>
                    {r.is_active ? "Active" : "Paused"}
                  </span>
                </td>
                <td className="px-4 py-3 text-right">
                  <div className="inline-flex items-center gap-2">
                    <button onClick={() => toggle(r.id, r.is_active)} className="text-muted-foreground hover:text-foreground" title={r.is_active ? "Pause" : "Resume"}>
                      {r.is_active ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
                    </button>
                    <button onClick={() => remove(r.id)} className="text-muted-foreground hover:text-destructive" title="Delete">
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </MerchantShell>
  );
}

function NewScheduleForm({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const { user } = useAuth();
  const [busy, setBusy] = useState(false);
  const [f, setF] = useState({
    name: "",
    amount: "",
    currency: "BDT",
    customer_name: "",
    customer_email: "",
    description: "",
    interval_unit: "month" as "day" | "week" | "month",
    interval_count: 1,
    start_at: new Date(Date.now() + 60_000).toISOString().slice(0, 16),
    mode: "live" as "live" | "test",
  });

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!user) return;
    setBusy(true);
    const { error } = await supabase.from("recurring_schedules").insert({
      merchant_id: user.id,
      name: f.name,
      amount: Number(f.amount),
      currency: f.currency,
      customer_name: f.customer_name || null,
      customer_email: f.customer_email || null,
      description: f.description || null,
      interval_unit: f.interval_unit,
      interval_count: Number(f.interval_count),
      next_run_at: new Date(f.start_at).toISOString(),
      mode: f.mode,
    });
    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success("Schedule created");
    onCreated();
  }

  const input = "w-full rounded-lg border border-glass-border bg-card/40 px-3 py-2 text-sm outline-none focus:border-brand";
  const label = "text-xs font-semibold uppercase tracking-wider text-muted-foreground";

  return (
    <form onSubmit={submit} className="glass mb-6 grid gap-4 rounded-2xl border border-glass-border p-6 md:grid-cols-2">
      <div className="md:col-span-2">
        <label className={label}>Name</label>
        <input required className={input} value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} placeholder="Monthly SaaS subscription" />
      </div>
      <div>
        <label className={label}>Amount</label>
        <input required type="number" min="0.01" step="0.01" className={input} value={f.amount} onChange={(e) => setF({ ...f, amount: e.target.value })} />
      </div>
      <div>
        <label className={label}>Currency</label>
        <input className={input} value={f.currency} onChange={(e) => setF({ ...f, currency: e.target.value.toUpperCase() })} />
      </div>
      <div>
        <label className={label}>Customer name</label>
        <input className={input} value={f.customer_name} onChange={(e) => setF({ ...f, customer_name: e.target.value })} />
      </div>
      <div>
        <label className={label}>Customer email</label>
        <input type="email" className={input} value={f.customer_email} onChange={(e) => setF({ ...f, customer_email: e.target.value })} />
      </div>
      <div className="md:col-span-2">
        <label className={label}>Description</label>
        <input className={input} value={f.description} onChange={(e) => setF({ ...f, description: e.target.value })} />
      </div>
      <div>
        <label className={label}>Repeat every</label>
        <div className="mt-1 flex gap-2">
          <input type="number" min="1" className={`${input} w-24`} value={f.interval_count} onChange={(e) => setF({ ...f, interval_count: Number(e.target.value) })} />
          <select className={input} value={f.interval_unit} onChange={(e) => setF({ ...f, interval_unit: e.target.value as "day" | "week" | "month" })}>
            <option value="day">Day(s)</option>
            <option value="week">Week(s)</option>
            <option value="month">Month(s)</option>
          </select>
        </div>
      </div>
      <div>
        <label className={label}>First run</label>
        <input required type="datetime-local" className={input} value={f.start_at} onChange={(e) => setF({ ...f, start_at: e.target.value })} />
      </div>
      <div>
        <label className={label}>Mode</label>
        <select className={input} value={f.mode} onChange={(e) => setF({ ...f, mode: e.target.value as "live" | "test" })}>
          <option value="live">Live</option>
          <option value="test">Test</option>
        </select>
      </div>
      <div className="md:col-span-2 flex justify-end gap-2">
        <button type="button" onClick={onClose} className="rounded-lg border border-glass-border px-4 py-2 text-sm">Cancel</button>
        <button type="submit" disabled={busy} className="rounded-lg bg-gradient-brand px-4 py-2 text-sm font-semibold text-brand-foreground disabled:opacity-50">
          {busy ? "Creating…" : "Create schedule"}
        </button>
      </div>
    </form>
  );
}
