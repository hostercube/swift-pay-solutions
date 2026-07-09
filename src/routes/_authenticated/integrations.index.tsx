import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Pencil, Trash2, Plus, X } from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";

export const Route = createFileRoute("/_authenticated/integrations/")({
  head: () => ({ meta: [{ title: "Payment methods · PayNOC" }] }),
  component: MethodsPage,
});

type MethodType =
  | "bkash" | "nagad" | "rocket" | "upay" | "tap" | "mcash"
  | "sure_cash" | "bank_transfer" | "card" | "crypto" | "other";
type Mode = "manual" | "api";

type Method = {
  id: string;
  type: MethodType;
  label: string;
  mode: Mode;
  account_number: string | null;
  account_name: string | null;
  instructions: string | null;
  fee_percent: number;
  fee_flat: number;
  min_amount: number | null;
  max_amount: number | null;
  is_active: boolean;
  sort_order: number;
};

const METHOD_TYPES: { value: MethodType; label: string }[] = [
  { value: "bkash", label: "bKash" },
  { value: "nagad", label: "Nagad" },
  { value: "rocket", label: "Rocket" },
  { value: "upay", label: "Upay" },
  { value: "tap", label: "Tap" },
  { value: "mcash", label: "MCash" },
  { value: "sure_cash", label: "SureCash" },
  { value: "bank_transfer", label: "Bank Transfer" },
  { value: "card", label: "Card" },
  { value: "crypto", label: "Crypto" },
  { value: "other", label: "Other" },
];

const EMPTY: Partial<Method> = {
  type: "bkash",
  label: "",
  mode: "manual", // manual only — API/auto verification lives in "Auto gateways" tab
  account_number: "",
  account_name: "",
  instructions: "",
  fee_percent: 0,
  fee_flat: 0,
  min_amount: null,
  max_amount: null,
  is_active: true,
  sort_order: 0,
};


function MethodsPage() {
  const { user } = useAuth();
  const [rows, setRows] = useState<Method[]>([]);
  const [editing, setEditing] = useState<Partial<Method> | null>(null);
  const [loading, setLoading] = useState(false);

  async function load() {
    if (!user) return;
    const { data, error } = await supabase
      .from("payment_methods")
      .select("*")
      .eq("merchant_id", user.id)
      .order("sort_order", { ascending: true })
      .order("created_at", { ascending: false });
    if (error) return toast.error(error.message);
    setRows((data ?? []) as Method[]);
  }
  useEffect(() => { load(); }, [user]);

  async function save() {
    if (!user || !editing) return;
    if (!editing.label?.trim()) return toast.error("Label is required");
    setLoading(true);
    const payload = {
      merchant_id: user.id,
      type: editing.type as MethodType,
      label: editing.label,
      mode: "manual" as Mode,
      account_number: editing.account_number || null,
      account_name: editing.account_name || null,
      instructions: editing.instructions || null,
      fee_percent: Number(editing.fee_percent) || 0,
      fee_flat: Number(editing.fee_flat) || 0,
      min_amount: editing.min_amount != null && editing.min_amount !== ("" as unknown as number) ? Number(editing.min_amount) : null,
      max_amount: editing.max_amount != null && editing.max_amount !== ("" as unknown as number) ? Number(editing.max_amount) : null,
      is_active: !!editing.is_active,
      sort_order: Number(editing.sort_order) || 0,
    };
    const { error } = editing.id
      ? await supabase.from("payment_methods").update(payload).eq("id", editing.id)
      : await supabase.from("payment_methods").insert(payload);
    setLoading(false);
    if (error) return toast.error(error.message);
    toast.success(editing.id ? "Method updated" : "Method created");
    setEditing(null);
    load();
  }

  async function toggle(m: Method) {
    const { error } = await supabase
      .from("payment_methods")
      .update({ is_active: !m.is_active })
      .eq("id", m.id);
    if (error) return toast.error(error.message);
    load();
  }

  async function remove(id: string) {
    if (!confirm("Delete this payment method?")) return;
    const { error } = await supabase.from("payment_methods").delete().eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Method deleted");
    load();
  }

  return (
    <div>

      <div className="mb-4 rounded-xl border border-brand/30 bg-brand/5 p-3 text-xs text-muted-foreground">
        <span className="font-semibold text-foreground">Manual vs Auto:</span> This tab collects proof from the customer &mdash; you approve payments from the Transactions page.
        For fully automated verification via provider APIs (bKash Merchant, SSLCommerz, Stripe, etc.), use the{" "}
        <a href="/integrations/byo" className="font-semibold text-brand hover:underline">Auto gateways (API)</a> tab instead.
      </div>
      <div className="mb-6 flex justify-end">
        <button
          onClick={() => setEditing({ ...EMPTY })}
          className="inline-flex items-center gap-2 rounded-lg bg-gradient-brand px-4 py-2 text-sm font-semibold text-brand-foreground"
        >
          <Plus className="h-4 w-4" /> Add channel
        </button>
      </div>


      <div className="glass overflow-hidden rounded-2xl border border-glass-border">
        <table className="w-full text-sm">
          <thead className="bg-card/40 text-left text-xs uppercase tracking-wider text-muted-foreground">
            <tr>
              <th className="px-4 py-3">Label</th>
              <th className="px-4 py-3">Type</th>
              <th className="px-4 py-3">Mode</th>
              <th className="px-4 py-3">Account</th>
              <th className="px-4 py-3">Fees</th>
              <th className="px-4 py-3">Limits</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr><td colSpan={8} className="px-4 py-10 text-center text-muted-foreground">
                No payment methods yet. Add one to start accepting payments.
              </td></tr>
            )}
            {rows.map((m) => (
              <tr key={m.id} className="border-t border-glass-border">
                <td className="px-4 py-3 font-medium">{m.label}</td>
                <td className="px-4 py-3 uppercase text-muted-foreground">{m.type}</td>
                <td className="px-4 py-3">
                  <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${
                    m.mode === "api" ? "bg-brand/10 text-brand" : "bg-muted text-muted-foreground"
                  }`}>{m.mode}</span>
                </td>
                <td className="px-4 py-3 text-muted-foreground">
                  {m.account_number ? <span className="font-mono text-xs">{m.account_number}</span> : "—"}
                </td>
                <td className="px-4 py-3 text-muted-foreground">
                  {m.fee_percent}% + {m.fee_flat}
                </td>
                <td className="px-4 py-3 text-muted-foreground">
                  {m.min_amount ?? "—"} / {m.max_amount ?? "—"}
                </td>
                <td className="px-4 py-3">
                  <button
                    onClick={() => toggle(m)}
                    className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${
                      m.is_active ? "bg-brand/10 text-brand" : "bg-muted text-muted-foreground"
                    }`}
                  >
                    {m.is_active ? "Active" : "Disabled"}
                  </button>
                </td>
                <td className="px-4 py-3 text-right">
                  <div className="inline-flex items-center gap-2">
                    <button onClick={() => setEditing(m)} className="text-muted-foreground hover:text-foreground">
                      <Pencil className="h-4 w-4" />
                    </button>
                    <button onClick={() => remove(m.id)} className="text-destructive hover:opacity-80">
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {editing && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={() => setEditing(null)}>
          <div
            className="glass max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl border border-glass-border p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-4 flex items-start justify-between">
              <div>
                <h2 className="font-display text-lg font-semibold">
                  {editing.id ? "Edit channel" : "Add manual channel"}
                </h2>
                <p className="text-xs text-muted-foreground">
                  Customer sees your account number + instructions and submits a Transaction ID for verification.
                </p>
              </div>
              <button onClick={() => setEditing(null)} className="text-muted-foreground hover:text-foreground">
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Type" full>
                <select
                  value={editing.type}
                  onChange={(e) => setEditing({ ...editing, type: e.target.value as MethodType })}
                  className={inputCls}
                >
                  {METHOD_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
                </select>
              </Field>

              <Field label="Label" full>
                <input
                  value={editing.label ?? ""}
                  onChange={(e) => setEditing({ ...editing, label: e.target.value })}
                  placeholder="e.g. bKash Personal"
                  className={inputCls}
                />
              </Field>
              <Field label="Account number">
                <input
                  value={editing.account_number ?? ""}
                  onChange={(e) => setEditing({ ...editing, account_number: e.target.value })}
                  placeholder="01XXXXXXXXX"
                  className={inputCls}
                />
              </Field>
              <Field label="Account name">
                <input
                  value={editing.account_name ?? ""}
                  onChange={(e) => setEditing({ ...editing, account_name: e.target.value })}
                  className={inputCls}
                />
              </Field>
              <Field label="Instructions (shown to payer)" full>
                <textarea
                  value={editing.instructions ?? ""}
                  onChange={(e) => setEditing({ ...editing, instructions: e.target.value })}
                  rows={3}
                  placeholder="Send Money to the number above, then paste your Transaction ID."
                  className={inputCls}
                />
              </Field>
              <Field label="Fee %">
                <input
                  type="number" step="0.001"
                  value={editing.fee_percent ?? 0}
                  onChange={(e) => setEditing({ ...editing, fee_percent: e.target.value as unknown as number })}
                  className={inputCls}
                />
              </Field>
              <Field label="Fee flat">
                <input
                  type="number" step="0.01"
                  value={editing.fee_flat ?? 0}
                  onChange={(e) => setEditing({ ...editing, fee_flat: e.target.value as unknown as number })}
                  className={inputCls}
                />
              </Field>
              <Field label="Min amount">
                <input
                  type="number" step="0.01"
                  value={editing.min_amount ?? ""}
                  onChange={(e) => setEditing({ ...editing, min_amount: (e.target.value === "" ? null : e.target.value) as unknown as number })}
                  className={inputCls}
                />
              </Field>
              <Field label="Max amount">
                <input
                  type="number" step="0.01"
                  value={editing.max_amount ?? ""}
                  onChange={(e) => setEditing({ ...editing, max_amount: (e.target.value === "" ? null : e.target.value) as unknown as number })}
                  className={inputCls}
                />
              </Field>
              <Field label="Sort order">
                <input
                  type="number"
                  value={editing.sort_order ?? 0}
                  onChange={(e) => setEditing({ ...editing, sort_order: e.target.value as unknown as number })}
                  className={inputCls}
                />
              </Field>
              <Field label="Enabled">
                <label className="mt-2 inline-flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={!!editing.is_active}
                    onChange={(e) => setEditing({ ...editing, is_active: e.target.checked })}
                  />
                  <span className="text-sm text-muted-foreground">Accept payments via this method</span>
                </label>
              </Field>
            </div>

            <div className="mt-6 flex justify-end gap-2">
              <button onClick={() => setEditing(null)} className="rounded-lg border border-glass-border px-4 py-2 text-sm">Cancel</button>
              <button
                onClick={save}
                disabled={loading}
                className="rounded-lg bg-gradient-brand px-4 py-2 text-sm font-semibold text-brand-foreground disabled:opacity-60"
              >
                {loading ? "Saving…" : "Save method"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

const inputCls =
  "w-full rounded-lg border border-glass-border bg-card/60 px-3 py-2 text-sm outline-none focus:border-brand";

function Field({ label, children, full }: { label: string; children: React.ReactNode; full?: boolean }) {
  return (
    <label className={full ? "sm:col-span-2" : ""}>
      <div className="mb-1.5 text-xs font-medium uppercase tracking-wider text-muted-foreground">{label}</div>
      {children}
    </label>
  );
}
