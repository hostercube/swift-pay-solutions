import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState, useCallback, useRef, useMemo } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import {
  Shield, CheckCircle2, Clock, XCircle, Download, Zap, Copy, Lock,
  Smartphone, CreditCard, Landmark, Bitcoin, MoreHorizontal, ArrowLeft, Sparkles,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { downloadReceipt } from "@/lib/pdf-receipt";
import { MerchantTracking, trackPurchase, type TrackingConfig } from "@/components/merchant-tracking";
import { initiateGatewayCheckout } from "@/lib/gateways/checkout.functions";
import { submitManualPayment } from "@/lib/checkout-submit.functions";
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
  allow_custom_amount?: boolean | null;
  min_amount?: number | null;
  max_amount?: number | null;
  reusable?: boolean | null;
  auto_redirect?: boolean | null;
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

export type CheckoutStyle = "premium" | "classic" | "neon" | "minimal";

type Brand = {
  business_name: string | null;
  brand_color: string | null;
  logo_url: string | null;
  support_email: string | null;
  checkout_footer: string | null;
  checkout_style?: CheckoutStyle | null;
  ga4_measurement_id?: string | null;
  gtm_container_id?: string | null;
  meta_pixel_id?: string | null;
  tiktok_pixel_id?: string | null;
  google_ads_conversion_id?: string | null;
  google_ads_conversion_label?: string | null;
  custom_head_html?: string | null;
  custom_footer_html?: string | null;
};

const STYLES: Record<CheckoutStyle, {
  page: string; card: string; hero: string; ctaBg: string; accentHalo: boolean;
}> = {
  premium: {
    page: "bg-background",
    card: "glass rounded-2xl border border-glass-border",
    hero: "font-display text-4xl font-black tracking-tight sm:text-5xl",
    ctaBg: "bg-gradient-brand shadow-[0_10px_30px_-10px_hsl(var(--brand)/0.6)]",
    accentHalo: true,
  },
  classic: {
    page: "bg-muted/30",
    card: "rounded-xl border border-border bg-card shadow-sm",
    hero: "font-display text-3xl font-bold tracking-tight sm:text-4xl",
    ctaBg: "bg-foreground text-background hover:bg-foreground/90",
    accentHalo: false,
  },
  neon: {
    page: "bg-[#050516] text-[#e6e6ff]",
    card: "rounded-2xl border border-[#7c3aed]/40 bg-[#0b0b24]/80 shadow-[0_0_40px_-10px_rgba(124,58,237,0.55)] backdrop-blur",
    hero: "font-display text-4xl font-black tracking-tight sm:text-5xl bg-gradient-to-r from-fuchsia-400 via-violet-400 to-cyan-300 bg-clip-text text-transparent",
    ctaBg: "bg-gradient-to-r from-fuchsia-500 via-violet-500 to-cyan-400 text-white shadow-[0_0_30px_-4px_rgba(168,85,247,0.7)]",
    accentHalo: true,
  },
  minimal: {
    page: "bg-background",
    card: "rounded-none border-0 border-y border-border bg-transparent sm:rounded-xl sm:border",
    hero: "font-sans text-3xl font-semibold tracking-tight sm:text-4xl",
    ctaBg: "bg-foreground text-background",
    accentHalo: false,
  },
};


function CheckoutPage() {
  const { invoiceId } = Route.useParams();
  const initiateGw = useServerFn(initiateGatewayCheckout);
  const submitManual = useServerFn(submitManualPayment);
  const [inv, setInv] = useState<Invoice | null>(null);
  const [brand, setBrand] = useState<Brand | null>(null);
  const [methods, setMethods] = useState<Method[]>([]);
  const [gateways, setGateways] = useState<{ id?: string; provider: string; mode: string; label?: string | null }[]>([]);
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
        setGateways(((g as { id?: string; provider: string; mode: string; label?: string | null }[]) ?? []));
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
  // and auto-forward after success when the merchant opted in.
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
    if (verified && !inv.reusable && inv.redirect_url) {
      const params = new URLSearchParams(window.location.search);
      const autoRedirect = inv.auto_redirect !== false || params.get("auto_redirect") === "1";
      if (autoRedirect) {
        const t = setTimeout(() => { (window.top ?? window).location.href = inv.redirect_url!; }, 2500);
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
    try {
      await submitManual({
        data: {
          invoiceId: inv.id,
          methodId: selected.id,
          senderNumber: form.sender_number,
          senderName: form.sender_name,
          providerTxnId: form.provider_txn_id,
        },
      });
      toast.success("Payment submitted — awaiting verification");
      setForm({ sender_number: "", sender_name: "", provider_txn_id: "" });
      load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Submit failed");
    } finally {
      setSubmitting(false);
    }
  }


  async function payViaGateway(provider: string, configId?: string) {
    if (!inv) return;
    setRedirecting(configId ?? provider);
    try {
      const origin = window.location.origin;
      const res = await initiateGw({
        data: {
          invoiceId: inv.id,
          provider,
          source: "byo",
          configId,
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
  const isReusable = !!inv.reusable;
  const isPaid = !isReusable && (!!verified || ["completed", "paid"].includes(inv.status));
  const needsAmount = !!inv.allow_custom_amount && Number(inv.amount) <= 0;

  if (isPaid) {
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
                  methodType: verified?.method_type ?? inv.method_type,
                  paidAt: verified?.verified_at ?? null,
                  createdAt: verified?.created_at ?? inv.expires_at ?? new Date().toISOString(),
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

  const autoGateways = gateways.filter((g) => AUTO_GATEWAYS.has(g.provider));
  const trxId = `TXN-${inv.invoice_number}`;
  const style = STYLES[(brand?.checkout_style as CheckoutStyle) ?? "premium"];

  return (
    <Shell brand={brand} inv={inv} trxId={trxId}>
      <div className="grid gap-5 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] lg:gap-6">
        {/* ── Left: Order summary ─────────────────────────── */}
        <aside className="lg:sticky lg:top-6 lg:self-start">
          <div className={`overflow-hidden ${style.card}`}>
            {inv.mode === "test" && (
              <div className="bg-amber-500/15 py-1.5 text-center text-[10px] font-bold uppercase tracking-widest text-amber-600">

                Test mode — no real money will be moved
              </div>
            )}
            <div className="p-5 sm:p-6">
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span className="uppercase tracking-widest">You are paying</span>
                <CopyBtn text={trxId} label="Trx ID" />
              </div>
              <div className="mt-2 flex items-baseline gap-2">
                <span className={style.hero}>
                  {currencySymbol(inv.currency)}{Number(inv.amount).toLocaleString()}
                </span>
                <span className="text-sm font-medium text-muted-foreground">{inv.currency}</span>
              </div>
              {converted != null && (
                <div className="mt-1 text-xs text-muted-foreground">
                  ≈ {activeDisplayCur} {converted.toLocaleString()} · settled in {inv.currency}
                </div>
              )}
              {inv.description && (
                <p className="mt-3 line-clamp-3 text-sm text-muted-foreground">{inv.description}</p>
              )}
            </div>

            <div className="border-t border-glass-border/70 bg-card/30 p-5 sm:p-6">
              <SumRow label="Subtotal" value={`${currencySymbol(inv.currency)}${Number(inv.amount).toLocaleString()}`} />
              {(inv.discount_amount ?? 0) > 0 && (
                <SumRow
                  label={`Discount (${inv.discount_code})`}
                  value={`−${currencySymbol(inv.currency)}${Number(inv.discount_amount).toLocaleString()}`}
                  accent="text-success"
                />
              )}
              <SumRow label="Convenience fee" value={`${currencySymbol(inv.currency)}0.00`} muted />
              <div className="mt-3 flex items-baseline justify-between border-t border-dashed border-glass-border pt-3">
                <span className="text-sm font-semibold">Total amount</span>
                <span className="font-display text-lg font-bold">
                  {currencySymbol(inv.currency)}{Number(inv.amount).toLocaleString()}
                </span>
              </div>

              {inv.status === "pending" && !pending && (
                <div className="mt-4 flex items-center gap-2 rounded-lg border border-glass-border bg-background/60 p-2">
                  <Sparkles className="h-3.5 w-3.5 shrink-0 text-brand" />
                  <input
                    value={couponInput}
                    onChange={(e) => setCouponInput(e.target.value)}
                    placeholder="Have a discount code?"
                    className="min-w-0 flex-1 bg-transparent px-1 py-0.5 text-sm outline-none"
                  />
                  <button
                    onClick={applyCoupon}
                    disabled={couponBusy}
                    className="shrink-0 rounded-md bg-brand/15 px-3 py-1 text-xs font-semibold text-brand hover:bg-brand/25 disabled:opacity-50"
                  >
                    {couponBusy ? "…" : "Apply"}
                  </button>
                </div>
              )}

              <div className="mt-4 flex items-center justify-between text-[11px] text-muted-foreground">
                <span>Display currency</span>
                <select
                  value={activeDisplayCur ?? inv.currency}
                  onChange={(e) => setDisplayCurrency(e.target.value === inv.currency ? null : e.target.value)}
                  className="rounded border border-glass-border bg-background px-2 py-1 text-[11px]"
                >
                  <option value={inv.currency}>{inv.currency}</option>
                  {["USD", "EUR", "GBP", "INR", "AED"].filter((c) => c !== inv.currency).map((c) => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          <div className="mt-3 flex items-center justify-center gap-2 text-[11px] text-muted-foreground">
            <Lock className="h-3 w-3" /> 256-bit encrypted · PCI-aware routing
          </div>
        </aside>

        {/* ── Right: Method picker ────────────────────────── */}
        <section className="min-w-0 space-y-4">
          {isReusable && verified && (
            <div className="glass rounded-2xl border border-success/30 bg-success/5 p-5">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="h-5 w-5 text-success" />
                <div className="font-semibold">Last payment received</div>
              </div>
              <p className="mt-1 text-xs text-muted-foreground">
                This is a reusable link — another customer can pay again below.
              </p>
            </div>
          )}
          {needsAmount ? (
            <AmountSetter
              inv={inv}
              onSet={async (val) => {
                const rpc = supabase.rpc.bind(supabase) as unknown as (
                  fn: string, args: Record<string, unknown>,
                ) => Promise<{ data: unknown }>;
                const { data } = await rpc("set_checkout_amount", { _invoice_id: inv.id, _amount: val });
                const row = Array.isArray(data) ? data[0] : null;
                const r = row as { ok?: boolean; message?: string } | null;
                if (r?.ok) { toast.success("Amount set"); load(); }
                else toast.error(r?.message || "Could not set amount");
              }}
            />
          ) : pending ? (
            <div className="glass rounded-2xl border border-amber-500/30 bg-amber-500/5 p-8 text-center">
              <Clock className="mx-auto h-10 w-10 text-amber-500" />
              <h2 className="mt-3 font-display text-xl font-bold">Awaiting verification</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                We received your payment claim (TrxID <span className="font-mono">{pending.provider_txn_id || pending.reference}</span>).
                This page will update automatically once the merchant confirms — usually within a few minutes.
              </p>
              {inv.redirect_url && (
                <a
                  href={inv.redirect_url}
                  className="mt-5 inline-flex rounded-lg border border-glass-border px-4 py-2 text-sm font-semibold hover:border-brand"
                >
                  Return to merchant
                </a>
              )}
            </div>
          ) : !selected ? (
            <MethodPicker
              autoGateways={autoGateways}
              methods={methods}
              redirecting={redirecting}
              onSelectMethod={setSelected}
              onGateway={payViaGateway}
            />
          ) : (
            <ManualForm
              method={selected}
              inv={inv}
              form={form}
              setForm={setForm}
              onCancel={() => setSelected(null)}
              onSubmit={submit}
              submitting={submitting}
            />
          )}
        </section>
      </div>
    </Shell>
  );
}

function AmountSetter({ inv, onSet }: { inv: Invoice; onSet: (v: number) => void }) {
  const [val, setVal] = useState("");
  const min = inv.min_amount ? Number(inv.min_amount) : 0;
  const max = inv.max_amount ? Number(inv.max_amount) : null;
  return (
    <div className="glass rounded-2xl border border-glass-border p-6 sm:p-8">
      <h2 className="font-display text-xl font-bold">Enter amount to pay</h2>
      <p className="mt-1 text-xs text-muted-foreground">
        {min > 0 && `Min ${currencySymbol(inv.currency)}${min.toLocaleString()}`}
        {min > 0 && max ? " · " : ""}
        {max && `Max ${currencySymbol(inv.currency)}${max.toLocaleString()}`}
      </p>
      <div className="mt-5 flex items-center gap-2">
        <span className="text-2xl font-bold text-muted-foreground">{currencySymbol(inv.currency)}</span>
        <input
          type="number" step="0.01" value={val} onChange={(e) => setVal(e.target.value)}
          placeholder="0.00" autoFocus
          className="flex-1 rounded-lg border border-glass-border bg-card/60 px-4 py-3 font-display text-2xl font-bold outline-none focus:border-brand"
        />
      </div>
      <button
        onClick={() => {
          const n = Number(val);
          if (!n || n <= 0) return toast.error("Enter a valid amount");
          if (min > 0 && n < min) return toast.error(`Minimum is ${min}`);
          if (max && n > max) return toast.error(`Maximum is ${max}`);
          onSet(n);
        }}
        className="mt-5 w-full rounded-xl bg-gradient-brand py-3.5 text-sm font-bold text-brand-foreground shadow-[0_10px_30px_-10px_hsl(var(--brand)/0.6)]"
      >
        Continue
      </button>
    </div>
  );
}

// ─────────────────────────────────────────────────────────
// Sub-components
// ─────────────────────────────────────────────────────────

type CatKey = "auto" | "mobile" | "bank" | "crypto" | "other";
const CATEGORIES: { key: CatKey; label: string; icon: typeof Zap }[] = [
  { key: "auto", label: "Instant", icon: Zap },
  { key: "mobile", label: "Mobile Banking", icon: Smartphone },
  { key: "bank", label: "Cards & Banks", icon: CreditCard },
  { key: "crypto", label: "Crypto", icon: Bitcoin },
  { key: "other", label: "Other", icon: MoreHorizontal },
];

function methodCategory(type: string): CatKey {
  if (["bkash", "nagad", "rocket", "upay", "tap", "mcash", "sure_cash"].includes(type)) return "mobile";
  if (["card", "bank_transfer"].includes(type)) return "bank";
  if (type === "crypto") return "crypto";
  return "other";
}

type Gw = { id?: string; provider: string; mode: string; label?: string | null };

function MethodPicker({
  autoGateways, methods, redirecting, onSelectMethod, onGateway,
}: {
  autoGateways: Gw[];
  methods: Method[];
  redirecting: string | null;
  onSelectMethod: (m: Method) => void;
  onGateway: (p: string, configId?: string) => void;
}) {
  const grouped = useMemo(() => {
    const g: Record<CatKey, Method[]> = { auto: [], mobile: [], bank: [], crypto: [], other: [] };
    methods.forEach((m) => g[methodCategory(m.type)].push(m));
    return g;
  }, [methods]);

  const available = useMemo(() => {
    return CATEGORIES.filter((c) =>
      c.key === "auto" ? autoGateways.length > 0 : grouped[c.key].length > 0,
    );
  }, [autoGateways, grouped]);

  const [cat, setCat] = useState<CatKey>(available[0]?.key ?? "auto");
  useEffect(() => {
    if (!available.some((c) => c.key === cat)) setCat(available[0]?.key ?? "auto");
  }, [available, cat]);

  if (available.length === 0) {
    return (
      <div className="glass rounded-2xl border border-glass-border p-10 text-center">
        <div className="text-sm text-muted-foreground">
          The merchant has not configured any payment methods yet.
        </div>
      </div>
    );
  }

  return (
    <div className="glass rounded-2xl border border-glass-border p-4 sm:p-6">
      <div className="mb-4">
        <h2 className="font-display text-lg font-bold">Choose payment method</h2>
        <p className="text-xs text-muted-foreground">Pick a category, then a provider.</p>
      </div>

      {/* Category tabs: horizontal scroll on mobile, grid on md+ */}
      <div className="-mx-4 mb-5 flex snap-x gap-2 overflow-x-auto px-4 pb-1 sm:mx-0 sm:px-0 md:grid md:grid-cols-4 lg:grid-cols-5">
        {available.map((c) => {
          const active = c.key === cat;
          const Icon = c.icon;
          const count = c.key === "auto" ? autoGateways.length : grouped[c.key].length;
          return (
            <button
              key={c.key}
              onClick={() => setCat(c.key)}
              className={`snap-start shrink-0 rounded-xl border px-3 py-3 text-left transition md:shrink ${
                active
                  ? "border-brand bg-brand/10 shadow-[0_0_0_1px_var(--color-brand)]"
                  : "border-glass-border bg-card/40 hover:border-brand/60"
              }`}
            >
              <Icon className={`h-4 w-4 ${active ? "text-brand" : "text-muted-foreground"}`} />
              <div className={`mt-1 text-xs font-semibold ${active ? "text-foreground" : "text-muted-foreground"}`}>
                {c.label}
              </div>
              <div className="text-[10px] text-muted-foreground">{count} option{count === 1 ? "" : "s"}</div>
            </button>
          );
        })}
      </div>

      {cat === "auto" ? (
        <div className="grid gap-3 sm:grid-cols-2">
          {autoGateways.map((g) => {
            const spec = getGateway(g.provider);
            const key = g.id ?? g.provider;
            const busy = redirecting === key;
            return (
              <button
                key={key}
                disabled={busy || !!redirecting}
                onClick={() => onGateway(g.provider, g.id)}
                className="group relative overflow-hidden rounded-xl border border-glass-border bg-card/50 p-4 text-left transition hover:border-brand hover:shadow-[0_10px_30px_-15px_hsl(var(--brand)/0.4)] disabled:opacity-60"
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="flex min-w-0 items-center gap-2">
                    <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-brand/15 text-brand">
                      <Zap className="h-4 w-4" />
                    </span>
                    <div className="min-w-0">
                      <div className="truncate font-semibold">
                        {g.label || spec?.label || g.provider}
                      </div>
                      <div className="text-[11px] text-muted-foreground">
                        {busy ? "Redirecting…" : g.label ? (spec?.label ?? g.provider) : "Instant · auto-verified"}
                      </div>
                    </div>
                  </div>
                  {g.mode === "sandbox" && (
                    <span className="shrink-0 rounded bg-amber-500/15 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-widest text-amber-600">
                      Test
                    </span>
                  )}
                </div>
              </button>
            );
          })}
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {grouped[cat].map((m) => (
            <button
              key={m.id}
              onClick={() => onSelectMethod(m)}
              className="group flex flex-col items-start gap-2 rounded-xl border border-glass-border bg-card/50 p-3 text-left transition hover:border-brand hover:shadow-[0_10px_30px_-15px_hsl(var(--brand)/0.4)]"
            >
              <span className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-brand/15 text-brand">
                {iconFor(m.type)}
              </span>
              <div className="min-w-0 w-full">
                <div className="truncate text-sm font-semibold">{m.label}</div>
                <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{m.type}</div>
              </div>
              <div className="mt-auto text-[10px] text-muted-foreground">Fee {m.fee_percent}% + {m.fee_flat}</div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function ManualForm({
  method, inv, form, setForm, onCancel, onSubmit, submitting,
}: {
  method: Method;
  inv: Invoice;
  form: { sender_number: string; sender_name: string; provider_txn_id: string };
  setForm: (f: { sender_number: string; sender_name: string; provider_txn_id: string }) => void;
  onCancel: () => void;
  onSubmit: () => void;
  submitting: boolean;
}) {
  return (
    <div className="glass rounded-2xl border border-glass-border p-5 sm:p-6">
      <button onClick={onCancel} className="mb-3 inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-3 w-3" /> Choose another method
      </button>

      <div className="flex items-center gap-3">
        <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-brand/15 text-brand">
          {iconFor(method.type)}
        </span>
        <div className="min-w-0">
          <div className="text-[11px] uppercase tracking-widest text-muted-foreground">Pay with</div>
          <div className="truncate font-display text-lg font-bold">{method.label}</div>
        </div>
      </div>

      <div className="mt-4 rounded-xl border border-brand/20 bg-brand/5 p-4">
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="min-w-0">
            <div className="text-[11px] uppercase tracking-wider text-muted-foreground">Send money to</div>
            <div className="mt-1 flex items-center gap-2">
              <span className="truncate font-mono text-base font-semibold">{method.account_number || "—"}</span>
              {method.account_number && <CopyBtn text={method.account_number} />}
            </div>
            {method.account_name && <div className="truncate text-xs text-muted-foreground">{method.account_name}</div>}
          </div>
          <div className="min-w-0">
            <div className="text-[11px] uppercase tracking-wider text-muted-foreground">Exact amount</div>
            <div className="mt-1 flex items-center gap-2">
              <span className="truncate font-mono text-base font-semibold">
                {currencySymbol(inv.currency)}{Number(inv.amount).toLocaleString()}
              </span>
              <CopyBtn text={String(inv.amount)} />
            </div>
          </div>
        </div>
        {method.instructions && (
          <div className="mt-3 whitespace-pre-line rounded-lg bg-background/40 p-3 text-xs text-muted-foreground">
            {method.instructions}
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
        onClick={onSubmit} disabled={submitting}
        className="mt-6 w-full rounded-xl bg-gradient-brand py-3.5 text-sm font-bold text-brand-foreground shadow-[0_10px_30px_-10px_hsl(var(--brand)/0.6)] transition hover:brightness-110 disabled:opacity-60"
      >
        {submitting ? "Submitting…" : `Confirm & Pay ${currencySymbol(inv.currency)}${Number(inv.amount).toLocaleString()}`}
      </button>
    </div>
  );
}

function SumRow({ label, value, accent, muted }: { label: string; value: string; accent?: string; muted?: boolean }) {
  return (
    <div className="flex items-baseline justify-between py-1 text-sm">
      <span className={muted ? "text-muted-foreground" : "text-foreground/80"}>{label}</span>
      <span className={`font-mono ${accent ?? (muted ? "text-muted-foreground" : "text-foreground")}`}>{value}</span>
    </div>
  );
}

function CopyBtn({ text, label }: { text: string; label?: string }) {
  const [ok, setOk] = useState(false);
  return (
    <button
      type="button"
      onClick={async (e) => {
        e.stopPropagation();
        try { await navigator.clipboard.writeText(text); setOk(true); setTimeout(() => setOk(false), 1200); } catch { /* noop */ }
      }}
      className="inline-flex shrink-0 items-center gap-1 rounded border border-glass-border bg-background/60 px-1.5 py-0.5 text-[10px] text-muted-foreground hover:border-brand hover:text-brand"
    >
      {ok ? <CheckCircle2 className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
      {label ?? (ok ? "Copied" : "Copy")}
    </button>
  );
}

function currencySymbol(code: string) {
  const map: Record<string, string> = { BDT: "৳", USD: "$", EUR: "€", GBP: "£", INR: "₹", AED: "د.إ" };
  return map[code] ?? `${code} `;
}

function iconFor(type: string) {
  if (["bkash", "nagad", "rocket", "upay", "tap", "mcash", "sure_cash"].includes(type))
    return <Smartphone className="h-4 w-4" />;
  if (type === "card") return <CreditCard className="h-4 w-4" />;
  if (type === "bank_transfer") return <Landmark className="h-4 w-4" />;
  if (type === "crypto") return <Bitcoin className="h-4 w-4" />;
  return <MoreHorizontal className="h-4 w-4" />;
}

function Shell({
  children, brand, inv, trxId,
}: { children: React.ReactNode; brand: Brand | null; inv?: Invoice | null; trxId?: string }) {
  const brandColor = brand?.brand_color || null;
  const cssVars = brandColor
    ? ({ ["--brand" as never]: brandColor, ["--brand-2" as never]: brandColor } as React.CSSProperties)
    : undefined;
  const skin = STYLES[(brand?.checkout_style as CheckoutStyle) ?? "premium"];
  const name = brand?.business_name?.trim() || "PayNOC secure checkout";
  return (
    <div className={`relative min-h-screen ${skin.page}`} style={cssVars}>
      <MerchantTracking config={brand as TrackingConfig | null} />
      {skin.accentHalo && <div className="grid-radial absolute inset-0 opacity-30" />}
      {skin.accentHalo && (
        <div
          className="pointer-events-none absolute inset-x-0 top-0 h-72 opacity-40"
          style={{ background: "radial-gradient(ellipse at top, hsl(var(--brand)/0.25), transparent 60%)" }}
        />
      )}

      <div className="relative mx-auto max-w-6xl px-4 py-6 sm:py-10">
        {/* Merchant header */}
        <header className="mb-6 grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 sm:mb-8">
          <div className="flex min-w-0 items-center gap-3">
            {brand?.logo_url ? (
              <img src={brand.logo_url} alt={name} className="h-10 w-10 shrink-0 rounded-xl object-contain ring-1 ring-glass-border" />
            ) : (
              <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-gradient-brand">
                <Shield className="h-5 w-5 text-brand-foreground" strokeWidth={2.5} />
              </span>
            )}
            <div className="min-w-0">
              <div className="truncate font-display text-base font-bold sm:text-lg">{name}</div>
              {trxId && (
                <div className="flex items-center gap-1 text-[11px] text-muted-foreground">
                  <span className="truncate font-mono">Trx ID: {trxId}</span>
                </div>
              )}
            </div>
          </div>
          {inv && (
            <div className="flex shrink-0 items-center gap-1.5 rounded-full border border-glass-border bg-card/60 px-3 py-1.5 text-[11px] font-semibold text-muted-foreground">
              <Lock className="h-3 w-3 text-brand" /> Secure
            </div>
          )}
        </header>

        {children}

        <footer className="mt-10 flex flex-col items-center gap-2 text-center text-[11px] text-muted-foreground sm:flex-row sm:justify-between sm:text-left">
          <div className="flex items-center gap-3">
            {brand?.support_email && (
              <a href={`mailto:${brand.support_email}`} className="hover:underline">Support</a>
            )}
            <a href="#" className="hover:underline">FAQ</a>
          </div>
          <div className="flex items-center gap-1.5">
            <Shield className="h-3 w-3 text-brand" />
            <span>Secured by <span className="font-semibold text-foreground">PayNOC</span> · Payments processed by the merchant</span>
          </div>
        </footer>
        {brand?.checkout_footer && (
          <div className="mt-2 text-center text-[11px] text-muted-foreground">{brand.checkout_footer}</div>
        )}
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
