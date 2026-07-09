import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState, useCallback, useRef } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Shield, CheckCircle2, Clock, XCircle, Download, Zap } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { downloadReceipt } from "@/lib/pdf-receipt";
import { MerchantTracking, trackPurchase, type TrackingConfig } from "@/components/merchant-tracking";
import { initiateGatewayCheckout } from "@/lib/gateways/checkout.functions";
import { getGateway } from "@/lib/gateways/registry";

const AUTO_GATEWAYS = new Set([
  "bkash", "sslcommerz", "stripe", "razorpay", "coinbase_commerce",
  "nowpayments", "paypal", "uddoktapay", "piprapay", "ownpay",
]);

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
  mode: string;
  display_currency?: string | null;
  discount_amount?: number | null;
  discount_code?: string | null;
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

type Brand = {
  business_name: string | null;
  brand_color: string | null;
  logo_url: string | null;
  support_email: string | null;
  checkout_footer: string | null;
  ga4_measurement_id?: string | null;
  gtm_container_id?: string | null;
  meta_pixel_id?: string | null;
  tiktok_pixel_id?: string | null;
  google_ads_conversion_id?: string | null;
  google_ads_conversion_label?: string | null;
  custom_head_html?: string | null;
  custom_footer_html?: string | null;
};

function CheckoutPage() {
  const { invoiceId } = Route.useParams();
  const initiateGw = useServerFn(initiateGatewayCheckout);
  const [inv, setInv] = useState<Invoice | null>(null);
  const [brand, setBrand] = useState<Brand | null>(null);
  const [methods, setMethods] = useState<Method[]>([]);
  const [gateways, setGateways] = useState<{ provider: string; mode: string }[]>([]);
  const [selected, setSelected] = useState<Method | null>(null);
  const [redirecting, setRedirecting] = useState<string | null>(null);
  const [txns, setTxns] = useState<Txn[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState({ sender_number: "", sender_name: "", provider_txn_id: "" });
  const [couponInput, setCouponInput] = useState("");
  const [couponBusy, setCouponBusy] = useState(false);
  const [displayCurrency, setDisplayCurrency] = useState<string | null>(null);
  const [fxRate, setFxRate] = useState<number | null>(null);

  const [loadError, setLoadError] = useState<string | null>(null);
  const load = useCallback(async () => {
    const rpc = supabase.rpc.bind(supabase) as unknown as (
      fn: string, args: Record<string, unknown>,
    ) => Promise<{ data: unknown; error: { message: string } | null }>;
    try {
      const { data: invRows, error: invErr } = await rpc("get_checkout_invoice", { _id: invoiceId });
      if (invErr) throw new Error(invErr.message);
      const i = Array.isArray(invRows) ? (invRows[0] ?? null) : null;
      setInv((i ?? null) as Invoice | null);
      if (i) {
        const merchantId = (i as Invoice).merchant_id;
        const [{ data: m }, { data: t }, { data: b }, { data: g }] = await Promise.all([
          rpc("get_checkout_methods", { _merchant_id: merchantId }),
          rpc("get_checkout_transactions", { _invoice_id: invoiceId }),
          rpc("get_checkout_brand", { _merchant_id: merchantId }),
          rpc("get_checkout_gateways", { _merchant_id: merchantId }),
        ]);
        setMethods(((m as Method[]) ?? []));
        setTxns(((t as Txn[]) ?? []));
        setGateways(((g as { provider: string; mode: string }[]) ?? []));
        const brandRow = Array.isArray(b) ? (b[0] ?? null) : b;
        setBrand((brandRow ?? null) as Brand | null);
      }
      setLoadError(null);
    } catch (e) {
      console.error("[checkout] load failed", e);
      setLoadError(e instanceof Error ? e.message : "Failed to load checkout");
    } finally {
      setLoading(false);
    }
  }, [invoiceId]);

  useEffect(() => { load(); }, [load]);

  // Load fx rate whenever a display currency is chosen
  useEffect(() => {
    const cur = displayCurrency ?? inv?.display_currency ?? null;
    if (!cur || cur === (inv?.currency ?? "BDT")) {
      setFxRate(null);
      return;
    }
    (async () => {
      const rpc = supabase.rpc.bind(supabase) as unknown as (
        fn: string, args: Record<string, unknown>,
      ) => Promise<{ data: unknown }>;
      const { data } = await rpc("get_effective_fx_rate", {
        _merchant_id: inv?.merchant_id,
        _base: inv?.currency ?? "BDT",
        _quote: cur,
      });
      const rate = typeof data === "number" ? data : data ? Number(data) : null;
      setFxRate(rate && !Number.isNaN(rate) ? rate : null);
    })();
  }, [displayCurrency, inv?.display_currency, inv?.currency, inv?.merchant_id]);

  async function applyCoupon() {
    if (!inv || !couponInput.trim()) return;
    setCouponBusy(true);
    const rpc = supabase.rpc.bind(supabase) as unknown as (
      fn: string,
      args: Record<string, unknown>,
    ) => Promise<{ data: unknown }>;
    const { data } = await rpc("apply_discount_code", {
      _invoice_id: inv.id,
      _code: couponInput.trim(),
    });
    setCouponBusy(false);
    const row = Array.isArray(data) ? data[0] : null;
    const r = row as { ok?: boolean; message?: string } | null;
    if (r?.ok) {
      toast.success(r.message || "Discount applied");
      setCouponInput("");
      load();
    } else {
      toast.error(r?.message || "Could not apply code");
    }
  }



  // Poll for verification if we have a pending txn
  useEffect(() => {
    if (!txns.some((t) => t.status === "pending")) return;
    const id = setInterval(load, 5000);
    return () => clearInterval(id);
  }, [txns, load]);

  // Iframe embed integration: notify parent window on status changes,
  // and support ?auto_redirect=1 to auto-forward after success.
  useEffect(() => {
    if (typeof window === "undefined" || !inv) return;
    const verified = txns.find((t) => t.status === "verified");
    const pending = txns.find((t) => t.status === "pending");
    const status = verified ? "completed" : pending ? "pending" : inv.status;
    try {
      window.parent?.postMessage(
        {
          source: "paynoc",
          type: "paynoc:status",
          invoiceId: inv.id,
          invoiceNumber: inv.invoice_number,
          status,
          amount: Number(inv.amount),
          currency: inv.currency,
        },
        "*",
      );
    } catch { /* ignore */ }
    if (verified) {
      const params = new URLSearchParams(window.location.search);
      if (params.get("auto_redirect") === "1" && inv.redirect_url) {
        const t = setTimeout(() => { window.top!.location.href = inv.redirect_url!; }, 1500);
        return () => clearTimeout(t);
      }
    }
  }, [txns, inv]);

  // Fire client-side purchase pixel once per completed invoice.
  const firedPurchaseRef = useRef(false);
  useEffect(() => {
    if (firedPurchaseRef.current || !inv || !brand) return;
    const verified = txns.find((t) => t.status === "verified");
    if (!verified) return;
    firedPurchaseRef.current = true;
    trackPurchase(brand as TrackingConfig, {
      value: Number(inv.amount),
      currency: inv.currency,
      transactionId: inv.invoice_number,
    });
  }, [txns, inv, brand]);

  function computeFee(m: Method, amount: number) {
    const fee = (amount * Number(m.fee_percent || 0)) / 100 + Number(m.fee_flat || 0);
    return { fee: Number(fee.toFixed(2)), net: Number((amount - fee).toFixed(2)) };
  }

  async function submit() {
    if (!inv || !selected) return;
    if (!form.provider_txn_id.trim()) return toast.error("Enter your Transaction ID");
    if (!form.sender_number.trim()) return toast.error("Enter the number you paid from");
    setSubmitting(true);

    // Fraud blocklist screen (email + phone; ip is not visible to browser)
    try {
      const rpc = (supabase.rpc.bind(supabase) as unknown as (
        fn: string,
        args: Record<string, unknown>,
      ) => Promise<{ data: boolean | null; error: { message: string } | null }>);
      const { data: blocked } = await rpc("check_fraud_block", {
        _merchant_id: inv.merchant_id,
        _email: inv.customer_email ?? "",
        _phone: form.sender_number,
        _ip: "",
      });
      if (blocked) {
        setSubmitting(false);
        return toast.error("Payment blocked by merchant fraud rules");
      }
    } catch {
      // fail-open: don't block a legitimate customer on RPC hiccup
    }

    const { fee, net } = computeFee(selected, Number(inv.amount));

    // Attach method + move to processing (best effort)
    await supabase
      .from("invoices")
      .update({ method_id: selected.id, method_type: selected.type as never, status: "processing" })
      .eq("id", inv.id);

    const { error } = await supabase.from("transactions").insert({
      invoice_id: inv.id,
      merchant_id: inv.merchant_id,
      method_type: selected.type as never,
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

  async function payViaGateway(provider: string) {
    if (!inv) return;
    setRedirecting(provider);
    try {
      const origin = window.location.origin;
      const res = await initiateGw({
        data: {
          invoiceId: inv.id,
          provider,
          source: "byo",
          successUrl: `${origin}/pay/${inv.id}?paid=1`,
          cancelUrl: `${origin}/pay/${inv.id}?cancelled=1`,
        },
      });
      if (res?.redirectUrl) {
        window.location.href = res.redirectUrl;
      } else {
        toast.success("Payment initiated");
        load();
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Gateway checkout failed");
      setRedirecting(null);
    }
  }



  if (loading) {
    return (
      <Shell brand={brand}><div className="text-center text-sm text-muted-foreground">Loading checkout…</div></Shell>
    );
  }
  if (!inv) {
    return (
      <Shell brand={brand}>
        <div className="glass rounded-2xl border border-glass-border p-8 text-center">
          <XCircle className="mx-auto h-10 w-10 text-destructive" />
          <h1 className="mt-3 font-display text-xl font-bold">Invoice unavailable</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {loadError
              ? `Couldn't reach payments backend: ${loadError}`
              : "This invoice does not exist, has expired, or has already been settled."}
          </p>
          {loadError && (
            <button
              onClick={() => { setLoading(true); load(); }}
              className="mt-4 inline-flex rounded-lg bg-gradient-brand px-4 py-2 text-sm font-semibold text-brand-foreground"
            >
              Retry
            </button>
          )}
        </div>
      </Shell>
    );
  }

  const verified = txns.find((t) => t.status === "verified");
  const pending = txns.find((t) => t.status === "pending");

  if (verified) {
    return (
      <Shell brand={brand}>
        <div className="glass rounded-2xl border border-glass-border p-8 text-center">
          <CheckCircle2 className="mx-auto h-12 w-12 text-brand" />
          <h1 className="mt-3 font-display text-2xl font-bold">Payment confirmed</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Invoice {inv.invoice_number} · {inv.currency} {Number(inv.amount).toLocaleString()}
          </p>
          <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
            <button
              onClick={() =>
                downloadReceipt({
                  invoiceNumber: inv.invoice_number,
                  amount: Number(inv.amount),
                  currency: inv.currency,
                  status: "completed",
                  customerName: inv.customer_name,
                  customerEmail: inv.customer_email,
                  description: inv.description,
                  methodType: verified.method_type,
                  paidAt: verified.verified_at,
                  createdAt: verified.created_at,
                  businessName: brand?.business_name ?? null,
                  supportEmail: brand?.support_email ?? null,
                })
              }
              className="inline-flex items-center gap-2 rounded-lg border border-glass-border px-4 py-2 text-sm font-semibold hover:border-brand"
            >
              <Download className="h-4 w-4" /> Download PDF receipt
            </button>
            {inv.redirect_url && (
              <a
                href={inv.redirect_url}
                className="inline-flex rounded-lg bg-gradient-brand px-4 py-2 text-sm font-semibold text-brand-foreground"
              >
                Continue
              </a>
            )}
          </div>
        </div>
      </Shell>
    );
  }

  const activeDisplayCur = displayCurrency ?? inv.display_currency ?? null;
  const converted =
    fxRate && activeDisplayCur ? Number((Number(inv.amount) * fxRate).toFixed(2)) : null;

  return (
    <Shell brand={brand}>
      {inv.mode === "test" && (
        <div className="mb-4 rounded-xl border border-amber-500/40 bg-amber-500/10 px-4 py-2 text-center text-xs font-bold uppercase tracking-widest text-amber-600">
          Test mode — no real money will be moved
        </div>
      )}
      <div className="mb-6 flex items-baseline justify-between">
        <div>
          <div className="text-xs uppercase tracking-wider text-muted-foreground">Amount due</div>
          <div className="font-display text-3xl font-bold">
            {inv.currency} {Number(inv.amount).toLocaleString()}
          </div>
          {converted != null && (
            <div className="mt-0.5 text-xs text-muted-foreground">
              ≈ {activeDisplayCur} {converted.toLocaleString()} · settled in {inv.currency}
            </div>
          )}
          {(inv.discount_amount ?? 0) > 0 && (
            <div className="mt-0.5 text-xs text-success">
              Discount {inv.discount_code}: −{inv.currency}{" "}
              {Number(inv.discount_amount).toLocaleString()}
            </div>
          )}
          {inv.description && <p className="mt-1 text-sm text-muted-foreground">{inv.description}</p>}
        </div>
        <div className="text-right text-xs text-muted-foreground">
          <div>Invoice</div>
          <div className="font-mono">{inv.invoice_number}</div>
          <select
            value={activeDisplayCur ?? inv.currency}
            onChange={(e) =>
              setDisplayCurrency(e.target.value === inv.currency ? null : e.target.value)
            }
            className="mt-2 rounded border border-glass-border bg-background px-2 py-1 text-xs"
          >
            <option value={inv.currency}>{inv.currency}</option>
            {["USD", "EUR", "GBP", "INR", "AED"].filter((c) => c !== inv.currency).map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
        </div>
      </div>

      {inv.status === "pending" && !pending && (
        <div className="mb-6 flex items-center gap-2 rounded-xl border border-glass-border bg-card/40 p-3">
          <input
            value={couponInput}
            onChange={(e) => setCouponInput(e.target.value)}
            placeholder="Discount code"
            className="flex-1 rounded-md bg-transparent px-2 py-1 text-sm outline-none"
          />
          <button
            onClick={applyCoupon}
            disabled={couponBusy}
            className="rounded-md bg-brand/10 px-3 py-1 text-xs font-semibold text-brand hover:bg-brand/20"
          >
            {couponBusy ? "…" : "Apply"}
          </button>
        </div>
      )}

      {pending && (
        <div className="mb-6 flex items-center gap-3 rounded-xl border border-amber-500/30 bg-amber-500/5 p-4">
          <Clock className="h-5 w-5 text-amber-500" />
          <div className="text-sm">
            Your payment is awaiting merchant verification. This page updates automatically.
          </div>
        </div>
      )}


      {!selected && gateways.length > 0 && (
        <div className="mb-6">
          <h2 className="flex items-center gap-2 font-display text-lg font-semibold">
            <Zap className="h-4 w-4 text-brand" /> Pay online instantly
          </h2>
          <p className="mt-1 text-xs text-muted-foreground">
            Redirects to the merchant's secure gateway. No manual verification needed.
          </p>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            {gateways.map((g) => {
              const spec = getGateway(g.provider);
              const busy = redirecting === g.provider;
              return (
                <button
                  key={g.provider}
                  disabled={busy || !!redirecting}
                  onClick={() => payViaGateway(g.provider)}
                  className="glass rounded-xl border border-glass-border p-4 text-left transition hover:border-brand disabled:opacity-60"
                >
                  <div className="flex items-center justify-between">
                    <div className="font-semibold">{spec?.label ?? g.provider}</div>
                    {g.mode === "sandbox" && (
                      <span className="rounded bg-amber-500/15 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-widest text-amber-600">
                        Test
                      </span>
                    )}
                  </div>
                  <div className="mt-1 text-xs text-muted-foreground">
                    {busy ? "Redirecting…" : `Pay with ${spec?.label ?? g.provider}`}
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {!selected && (
        <div>
          <h2 className="font-display text-lg font-semibold">
            {gateways.length > 0 ? "Or pay manually" : "Select a payment method"}
          </h2>
          {methods.length === 0 && gateways.length === 0 && (
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

function Shell({ children, brand }: { children: React.ReactNode; brand: Brand | null }) {
  const brandColor = brand?.brand_color || null;
  const style = brandColor
    ? ({ ["--brand" as never]: brandColor, ["--brand-2" as never]: brandColor } as React.CSSProperties)
    : undefined;
  const name = brand?.business_name?.trim() || "PayNOC secure checkout";
  return (
    <div className="relative min-h-screen bg-background" style={style}>
      <MerchantTracking config={brand as TrackingConfig | null} />
      <div className="grid-radial absolute inset-0 opacity-30" />
      <div className="relative mx-auto max-w-2xl px-4 py-10">
        <div className="mb-8 flex items-center justify-center gap-2">
          {brand?.logo_url ? (
            <img src={brand.logo_url} alt={name} className="h-9 w-9 rounded-lg object-contain" />
          ) : (
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-brand">
              <Shield className="h-4 w-4 text-brand-foreground" strokeWidth={2.5} />
            </span>
          )}
          <span className="font-display text-lg font-bold">{name}</span>
        </div>
        {children}
        <div className="mt-8 space-y-1 text-center text-[11px] text-muted-foreground">
          {brand?.checkout_footer && <div>{brand.checkout_footer}</div>}
          {brand?.support_email && (
            <div>
              Need help? <a href={`mailto:${brand.support_email}`} className="underline">{brand.support_email}</a>
            </div>
          )}
          <div>Secured by PayNOC · Payments processed by the merchant.</div>
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
