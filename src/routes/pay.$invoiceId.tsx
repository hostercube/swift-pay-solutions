import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState, useCallback } from "react";
import { toast } from "sonner";
import { Shield, CheckCircle2, Clock, XCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/pay/$invoiceId")({
  head: () => ({ meta: [{ title: "Checkout · PayNOC" }] }),
  component: CheckoutPage,
});

type Invoice = {
  id: string;
  merchant_id: string;
  invoice_number: string;
  amount: number;
  currency: string;
  status: string;
  method_id: string | null;
  method_type: string | null;
  customer_name: string | null;
  customer_email: string | null;
  description: string | null;
  redirect_url: string | null;
  expires_at: string | null;
};

type Method = {
  id: string;
  merchant_id: string;
  type: string;
  label: string;
  mode: "manual" | "api";
  account_number: string | null;
  account_name: string | null;
  instructions: string | null;
  fee_percent: number;
  fee_flat: number;
  min_amount: number | null;
  max_amount: number | null;
};

type Txn = {
  id: string;
  status: string;
  method_type: string;
  gross_amount: number;
  provider_txn_id: string | null;
  reference: string | null;
  created_at: string;
  verified_at: string | null;
  note: string | null;
};

function CheckoutPage() {
  const { invoiceId } = Route.useParams();
  const [inv, setInv] = useState<Invoice | null>(null);
  const [methods, setMethods] = useState<Method[]>([]);
  const [selected, setSelected] = useState<Method | null>(null);
  const [txns, setTxns] = useState<Txn[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState({ sender_number: "", sender_name: "", provider_txn_id: "" });

  const load = useCallback(async () => {
    const { data: i } = await supabase
      .from("checkout_invoices").select("*").eq("id", invoiceId).maybeSingle();
    setInv((i ?? null) as Invoice | null);
    if (i) {
      const { data: m } = await supabase
        .from("checkout_methods").select("*")
        .eq("merchant_id", (i as Invoice).merchant_id)
        .order("sort_order", { ascending: true });
      setMethods((m ?? []) as Method[]);
      const { data: t } = await supabase
        .from("transactions").select("id, status, method_type, gross_amount, provider_txn_id, reference, created_at, verified_at, note")
        .eq("invoice_id", invoiceId)
        .order("created_at", { ascending: false });
      setTxns((t ?? []) as Txn[]);
    }
    setLoading(false);
  }, [invoiceId]);

  useEffect(() => { load(); }, [load]);

  // Poll for verification if we have a pending txn
  useEffect(() => {
    if (!txns.some((t) => t.status === "pending")) return;
    const id = setInterval(load, 5000);
    return () => clearInterval(id);
  }, [txns, load]);

  function computeFee(m: Method, amount: number) {
    const fee = (amount * Number(m.fee_percent || 0)) / 100 + Number(m.fee_flat || 0);
    return { fee: Number(fee.toFixed(2)), net: Number((amount - fee).toFixed(2)) };
  }

  async function submit() {
    if (!inv || !selected) return;
    if (!form.provider_txn_id.trim()) return toast.error("Enter your Transaction ID");
    if (!form.sender_number.trim()) return toast.error("Enter the number you paid from");
    setSubmitting(true);
    const { fee, net } = computeFee(selected, Number(inv.amount));

    // Attach method + move to processing (best effort)
    await supabase
      .from("invoices")
      .update({ method_id: selected.id, method_type: selected.type as Invoice["method_type"], status: "processing" })
      .eq("id", inv.id);

    const { error } = await supabase.from("transactions").insert({
      invoice_id: inv.id,
      merchant_id: inv.merchant_id,
      method_type: selected.type as Txn["method_type"],
      status: "pending",
      gross_amount: Number(inv.amount),
      fee_amount: fee,
      net_amount: net,
      sender_number: form.sender_number,
      sender_name: form.sender_name || null,
      provider_txn_id: form.provider_txn_id,
      reference: form.provider_txn_id,
    });
    setSubmitting(false);
    if (error) return toast.error(error.message);
    toast.success("Payment submitted — awaiting verification");
    setForm({ sender_number: "", sender_name: "", provider_txn_id: "" });
    load();
  }

  if (loading) {
    return (
      <Shell><div className="text-center text-sm text-muted-foreground">Loading checkout…</div></Shell>
    );
  }
  if (!inv) {
    return (
      <Shell>
        <div className="glass rounded-2xl border border-glass-border p-8 text-center">
          <XCircle className="mx-auto h-10 w-10 text-destructive" />
          <h1 className="mt-3 font-display text-xl font-bold">Invoice unavailable</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            This invoice does not exist, has expired, or has already been settled.
          </p>
        </div>
      </Shell>
    );
  }

  const verified = txns.find((t) => t.status === "verified");
  const pending = txns.find((t) => t.status === "pending");

  if (verified) {
    return (
      <Shell>
        <div className="glass rounded-2xl border border-glass-border p-8 text-center">
          <CheckCircle2 className="mx-auto h-12 w-12 text-brand" />
          <h1 className="mt-3 font-display text-2xl font-bold">Payment confirmed</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Invoice {inv.invoice_number} · {inv.currency} {Number(inv.amount).toLocaleString()}
          </p>
          {inv.redirect_url && (
            <a href={inv.redirect_url} className="mt-6 inline-flex rounded-lg bg-gradient-brand px-4 py-2 text-sm font-semibold text-brand-foreground">
              Continue
            </a>
          )}
        </div>
      </Shell>
    );
  }

  return (
    <Shell>
      <div className="mb-6 flex items-baseline justify-between">
        <div>
          <div className="text-xs uppercase tracking-wider text-muted-foreground">Amount due</div>
          <div className="font-display text-3xl font-bold">
            {inv.currency} {Number(inv.amount).toLocaleString()}
          </div>
          {inv.description && <p className="mt-1 text-sm text-muted-foreground">{inv.description}</p>}
        </div>
        <div className="text-right text-xs text-muted-foreground">
          <div>Invoice</div>
          <div className="font-mono">{inv.invoice_number}</div>
        </div>
      </div>

      {pending && (
        <div className="mb-6 flex items-center gap-3 rounded-xl border border-amber-500/30 bg-amber-500/5 p-4">
          <Clock className="h-5 w-5 text-amber-500" />
          <div className="text-sm">
            Your payment is awaiting merchant verification. This page updates automatically.
          </div>
        </div>
      )}

      {!selected && (
        <div>
          <h2 className="font-display text-lg font-semibold">Select a payment method</h2>
          {methods.length === 0 && (
            <p className="mt-3 text-sm text-muted-foreground">
              The merchant has not configured any payment methods yet.
            </p>
          )}
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            {methods.map((m) => (
              <button
                key={m.id}
                onClick={() => setSelected(m)}
                className="glass rounded-xl border border-glass-border p-4 text-left transition hover:border-brand"
              >
                <div className="flex items-center justify-between">
                  <div className="font-semibold">{m.label}</div>
                  <span className="text-[10px] uppercase tracking-wider text-muted-foreground">{m.type}</span>
                </div>
                <div className="mt-1 text-xs text-muted-foreground">
                  Fee: {m.fee_percent}% + {m.fee_flat}
                </div>
              </button>
            ))}
          </div>
        </div>
      )}

      {selected && (
        <div className="glass rounded-2xl border border-glass-border p-6">
          <div className="flex items-start justify-between">
            <div>
              <div className="text-xs uppercase tracking-wider text-muted-foreground">Pay with</div>
              <div className="font-display text-lg font-semibold">{selected.label}</div>
            </div>
            <button onClick={() => setSelected(null)} className="text-xs text-muted-foreground hover:text-foreground">
              Change
            </button>
          </div>

          <div className="mt-4 rounded-xl border border-glass-border bg-background/40 p-4 text-sm">
            <div className="grid gap-3 sm:grid-cols-2">
              <Info label="Send money to">
                <div className="font-mono">{selected.account_number || "—"}</div>
                {selected.account_name && <div className="text-xs text-muted-foreground">{selected.account_name}</div>}
              </Info>
              <Info label="Exact amount">
                <div className="font-mono">{inv.currency} {Number(inv.amount).toLocaleString()}</div>
              </Info>
            </div>
            {selected.instructions && (
              <div className="mt-3 whitespace-pre-line text-xs text-muted-foreground">
                {selected.instructions}
              </div>
            )}
          </div>

          <div className="mt-5 grid gap-3 sm:grid-cols-2">
            <Field label="Your number">
              <input value={form.sender_number} onChange={(e) => setForm({ ...form, sender_number: e.target.value })} className={inputCls} placeholder="01XXXXXXXXX" />
            </Field>
            <Field label="Your name (optional)">
              <input value={form.sender_name} onChange={(e) => setForm({ ...form, sender_name: e.target.value })} className={inputCls} />
            </Field>
            <Field label="Transaction ID" full>
              <input value={form.provider_txn_id} onChange={(e) => setForm({ ...form, provider_txn_id: e.target.value })} className={inputCls} placeholder="e.g. 8A7BXY123" />
            </Field>
          </div>

          <button
            onClick={submit} disabled={submitting}
            className="mt-6 w-full rounded-lg bg-gradient-brand py-3 text-sm font-semibold text-brand-foreground disabled:opacity-60"
          >
            {submitting ? "Submitting…" : "I have paid — submit for verification"}
          </button>
        </div>
      )}
    </Shell>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative min-h-screen bg-background">
      <div className="grid-radial absolute inset-0 opacity-30" />
      <div className="relative mx-auto max-w-2xl px-4 py-10">
        <div className="mb-8 flex items-center justify-center gap-2">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-brand">
            <Shield className="h-4 w-4 text-brand-foreground" strokeWidth={2.5} />
          </span>
          <span className="font-display text-lg font-bold">PayNOC secure checkout</span>
        </div>
        {children}
        <div className="mt-8 text-center text-[11px] text-muted-foreground">
          Payments are encrypted and processed by the merchant. PayNOC does not hold funds.
        </div>
      </div>
    </div>
  );
}

function Info({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="text-xs uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className="mt-1">{children}</div>
    </div>
  );
}

function Field({ label, children, full }: { label: string; children: React.ReactNode; full?: boolean }) {
  return (
    <label className={full ? "sm:col-span-2" : ""}>
      <div className="mb-1.5 text-xs font-medium uppercase tracking-wider text-muted-foreground">{label}</div>
      {children}
    </label>
  );
}

const inputCls =
  "w-full rounded-lg border border-glass-border bg-card/60 px-3 py-2 text-sm outline-none focus:border-brand";
