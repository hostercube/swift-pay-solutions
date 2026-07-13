import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { trackPurchase, type TrackingConfig } from "@/components/merchant-tracking";
import { initiateGatewayCheckout } from "@/lib/gateways/checkout.functions";
import { finalizeGatewayReturn } from "@/lib/gateways/finalize.functions";
import { submitManualPayment } from "@/lib/checkout-submit.functions";
import { Shell } from "@/components/checkout/Shell";
import { OrderSummary } from "@/components/checkout/OrderSummary";
import { MethodPicker } from "@/components/checkout/MethodPicker";
import { ManualForm } from "@/components/checkout/ManualForm";
import {
  AmountSetter, ErrorPanel, PaidPanel, PendingPanel, ReusableBanner,
} from "@/components/checkout/StatusPanels";
import { AUTO_GATEWAYS, type Brand, type Gw, type Invoice, type ManualFormState, type Method, type Txn } from "@/components/checkout/types";

const DISPLAY_CURRENCIES = ["USD", "EUR", "GBP", "INR", "AED"];

export const Route = createFileRoute("/pay/$invoiceId")({
  head: () => ({ meta: [{ title: "Checkout · PayNOC" }] }),
  component: CheckoutPage,
});

function CheckoutPage() {
  const { invoiceId } = Route.useParams();
  const initiateGw = useServerFn(initiateGatewayCheckout);
  const finalizeReturn = useServerFn(finalizeGatewayReturn);
  const submitManual = useServerFn(submitManualPayment);

  const [inv, setInv] = useState<Invoice | null>(null);
  const [brand, setBrand] = useState<Brand | null>(null);
  const [methods, setMethods] = useState<Method[]>([]);
  const [gateways, setGateways] = useState<Gw[]>([]);
  const [selected, setSelected] = useState<Method | null>(null);
  const [redirecting, setRedirecting] = useState<string | null>(null);
  const [txns, setTxns] = useState<Txn[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState<ManualFormState>({
    sender_number: "", sender_name: "", provider_txn_id: "", bank_reference: "", slip_url: "",
  });
  const [couponInput, setCouponInput] = useState("");
  const [couponBusy, setCouponBusy] = useState(false);
  const [displayCurrency, setDisplayCurrency] = useState<string | null>(null);
  const [fxRate, setFxRate] = useState<number | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  // ─── Data loading (RPCs) ─────────────────────────────────────────
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
        setMethods((m as Method[]) ?? []);
        setTxns((t as Txn[]) ?? []);
        setGateways((g as Gw[]) ?? []);
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

  // ─── FX conversion for display currency ──────────────────────────
  useEffect(() => {
    const cur = displayCurrency ?? inv?.display_currency ?? null;
    if (!cur || cur === (inv?.currency ?? "BDT")) { setFxRate(null); return; }
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

  // ─── Poll while a txn is pending ─────────────────────────────────
  useEffect(() => {
    if (!txns.some((t) => t.status === "pending")) return;
    const id = setInterval(load, 5000);
    return () => clearInterval(id);
  }, [txns, load]);

  // ─── Iframe embed integration + auto-forward on success ──────────
  useEffect(() => {
    if (typeof window === "undefined" || !inv) return;
    const verified = txns.find((t) => t.status === "verified");
    const pending = txns.find((t) => t.status === "pending");
    const status = verified ? "completed" : pending ? "pending" : inv.status;
    try {
      window.parent?.postMessage({
        source: "paynoc", type: "paynoc:status",
        invoiceId: inv.id, invoiceNumber: inv.invoice_number,
        status, amount: Number(inv.amount), currency: inv.currency,
      }, "*");
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

  // ─── Fire client-side purchase pixel once per completed invoice ──
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

  // ─── Actions ─────────────────────────────────────────────────────
  async function applyCoupon() {
    if (!inv || !couponInput.trim()) return;
    setCouponBusy(true);
    const rpc = supabase.rpc.bind(supabase) as unknown as (
      fn: string, args: Record<string, unknown>,
    ) => Promise<{ data: unknown }>;
    const { data } = await rpc("apply_discount_code", {
      _invoice_id: inv.id, _code: couponInput.trim(),
    });
    setCouponBusy(false);
    const row = Array.isArray(data) ? data[0] : null;
    const r = row as { ok?: boolean; message?: string } | null;
    if (r?.ok) { toast.success(r.message || "Discount applied"); setCouponInput(""); load(); }
    else toast.error(r?.message || "Could not apply code");
  }

  async function setCustomAmount(val: number) {
    if (!inv) return;
    const rpc = supabase.rpc.bind(supabase) as unknown as (
      fn: string, args: Record<string, unknown>,
    ) => Promise<{ data: unknown }>;
    const { data } = await rpc("set_checkout_amount", { _invoice_id: inv.id, _amount: val });
    const row = Array.isArray(data) ? data[0] : null;
    const r = row as { ok?: boolean; message?: string } | null;
    if (r?.ok) { toast.success("Amount set"); load(); }
    else toast.error(r?.message || "Could not set amount");
  }

  async function submitManualForm() {
    if (!inv || !selected) return;
    if (!form.provider_txn_id.trim()) return toast.error("Enter your Transaction ID");
    if (!form.sender_number.trim()) return toast.error("Enter the number you paid from");
    if (selected.type === "bank_transfer" && !form.slip_url) {
      return toast.error("Please upload your bank deposit slip");
    }
    setSubmitting(true);
    try {
      await submitManual({
        data: {
          invoiceId: inv.id, methodId: selected.id,
          senderNumber: form.sender_number, senderName: form.sender_name,
          providerTxnId: form.provider_txn_id,
          slipUrl: form.slip_url || undefined,
          bankReference: form.bank_reference || undefined,
        },
      });
      toast.success("Payment submitted — awaiting verification");
      setForm({ sender_number: "", sender_name: "", provider_txn_id: "", bank_reference: "", slip_url: "" });
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
          invoiceId: inv.id, provider, source: "byo", configId,
          successUrl: `${origin}/pay/${inv.id}?paid=1`,
          cancelUrl: `${origin}/pay/${inv.id}?cancelled=1`,
        },
      });
      if (res?.redirectUrl) { window.location.href = res.redirectUrl; }
      else { toast.success("Payment initiated"); load(); }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Gateway checkout failed");
      setRedirecting(null);
    }
  }

  // ─── Derived state ───────────────────────────────────────────────
  const verified = useMemo(() => txns.find((t) => t.status === "verified"), [txns]);
  const pending = useMemo(() => txns.find((t) => t.status === "pending"), [txns]);
  const autoGateways = useMemo(
    () => gateways.filter((g) => AUTO_GATEWAYS.has(g.provider)),
    [gateways],
  );

  // ─── Early returns ───────────────────────────────────────────────
  if (loading) {
    return (
      <Shell brand={brand}>
        <div className="text-center text-sm text-muted-foreground">Loading checkout…</div>
      </Shell>
    );
  }
  if (!inv) {
    return (
      <Shell brand={brand}>
        <ErrorPanel loadError={loadError} onRetry={() => { setLoading(true); load(); }} />
      </Shell>
    );
  }

  const isReusable = !!inv.reusable;
  const isPaid = !isReusable && (!!verified || ["completed", "paid"].includes(inv.status));
  const needsAmount = !!inv.allow_custom_amount && Number(inv.amount) <= 0;

  if (isPaid) {
    return <Shell brand={brand}><PaidPanel inv={inv} brand={brand} verified={verified} /></Shell>;
  }

  const activeDisplayCur = displayCurrency ?? inv.display_currency ?? null;
  const converted = fxRate && activeDisplayCur ? Number((Number(inv.amount) * fxRate).toFixed(2)) : null;
  const trxId = `TXN-${inv.invoice_number}`;

  return (
    <Shell brand={brand} inv={inv} trxId={trxId}>
      <div className="grid gap-5 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] lg:gap-6">
        <OrderSummary
          inv={inv}
          brand={brand}
          trxId={trxId}
          pending={pending}
          converted={converted}
          activeDisplayCur={activeDisplayCur}
          displayCurrencies={DISPLAY_CURRENCIES}
          couponInput={couponInput}
          setCouponInput={setCouponInput}
          couponBusy={couponBusy}
          onApplyCoupon={applyCoupon}
          onChangeDisplayCurrency={setDisplayCurrency}
        />

        <section className="min-w-0 space-y-4">
          {isReusable && verified && <ReusableBanner />}
          {needsAmount ? (
            <AmountSetter inv={inv} onSet={setCustomAmount} />
          ) : pending ? (
            <PendingPanel inv={inv} pending={pending} />
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
              brand={brand}
              form={form}
              setForm={setForm}
              onCancel={() => setSelected(null)}
              onSubmit={submitManualForm}
              submitting={submitting}
              pending={pending ?? null}
            />
          )}
        </section>
      </div>
    </Shell>
  );
}
