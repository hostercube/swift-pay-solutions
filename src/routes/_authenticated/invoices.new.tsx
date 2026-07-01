import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { MerchantShell } from "@/components/merchant-shell";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";

export const Route = createFileRoute("/_authenticated/invoices/new")({
  head: () => ({ meta: [{ title: "New invoice · PayNOC" }] }),
  component: NewInvoicePage,
});

function generateInvoiceNumber() {
  const d = new Date();
  const stamp = `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, "0")}${String(d.getDate()).padStart(2, "0")}`;
  const rand = Math.random().toString(36).slice(2, 8).toUpperCase();
  return `INV-${stamp}-${rand}`;
}

function NewInvoicePage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    amount: "",
    currency: "BDT",
    customer_name: "",
    customer_email: "",
    customer_phone: "",
    description: "",
    redirect_url: "",
    webhook_url: "",
    expires_in_hours: "24",
  });

  function update<K extends keyof typeof form>(k: K, v: string) {
    setForm({ ...form, [k]: v });
  }

  async function submit() {
    if (!user) return;
    const amount = Number(form.amount);
    if (!amount || amount <= 0) return toast.error("Enter a valid amount");
    setSaving(true);
    const expires_at = form.expires_in_hours
      ? new Date(Date.now() + Number(form.expires_in_hours) * 3_600_000).toISOString()
      : null;
    const { data, error } = await supabase
      .from("invoices")
      .insert({
        merchant_id: user.id,
        invoice_number: generateInvoiceNumber(),
        amount,
        currency: form.currency,
        customer_name: form.customer_name || null,
        customer_email: form.customer_email || null,
        customer_phone: form.customer_phone || null,
        description: form.description || null,
        redirect_url: form.redirect_url || null,
        webhook_url: form.webhook_url || null,
        expires_at,
        status: "pending",
      })
      .select("id")
      .single();
    setSaving(false);
    if (error || !data) return toast.error(error?.message ?? "Failed to create invoice");
    toast.success("Invoice created");
    navigate({ to: "/invoices/$id", params: { id: data.id } });
  }

  return (
    <MerchantShell title="New invoice" subtitle="Generate a hosted checkout link you can share with your customer.">
      <div className="glass max-w-3xl rounded-2xl border border-glass-border p-6">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Amount">
            <input
              type="number" step="0.01" value={form.amount}
              onChange={(e) => update("amount", e.target.value)}
              className={inputCls} placeholder="1000.00"
            />
          </Field>
          <Field label="Currency">
            <select value={form.currency} onChange={(e) => update("currency", e.target.value)} className={inputCls}>
              <option>BDT</option><option>USD</option><option>EUR</option><option>INR</option>
            </select>
          </Field>
          <Field label="Customer name">
            <input value={form.customer_name} onChange={(e) => update("customer_name", e.target.value)} className={inputCls} />
          </Field>
          <Field label="Customer email">
            <input type="email" value={form.customer_email} onChange={(e) => update("customer_email", e.target.value)} className={inputCls} />
          </Field>
          <Field label="Customer phone">
            <input value={form.customer_phone} onChange={(e) => update("customer_phone", e.target.value)} className={inputCls} />
          </Field>
          <Field label="Expires in (hours)">
            <input type="number" value={form.expires_in_hours} onChange={(e) => update("expires_in_hours", e.target.value)} className={inputCls} />
          </Field>
          <Field label="Description" full>
            <textarea rows={2} value={form.description} onChange={(e) => update("description", e.target.value)} className={inputCls} />
          </Field>
          <Field label="Redirect URL (after payment)">
            <input value={form.redirect_url} onChange={(e) => update("redirect_url", e.target.value)} className={inputCls} placeholder="https://…" />
          </Field>
          <Field label="Webhook URL (payment event)">
            <input value={form.webhook_url} onChange={(e) => update("webhook_url", e.target.value)} className={inputCls} placeholder="https://…" />
          </Field>
        </div>
        <div className="mt-6 flex justify-end gap-2">
          <button onClick={() => navigate({ to: "/invoices" })} className="rounded-lg border border-glass-border px-4 py-2 text-sm">
            Cancel
          </button>
          <button
            onClick={submit} disabled={saving}
            className="rounded-lg bg-gradient-brand px-4 py-2 text-sm font-semibold text-brand-foreground disabled:opacity-60"
          >
            {saving ? "Creating…" : "Create invoice"}
          </button>
        </div>
      </div>
    </MerchantShell>
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
