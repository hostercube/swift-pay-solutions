import { useState } from "react";
import { CheckCircle2, Clock, Download, XCircle } from "lucide-react";
import { toast } from "sonner";
import { downloadReceipt } from "@/lib/pdf-receipt";
import { currencySymbol, STYLES } from "./primitives";
import type { Brand, CheckoutStyle, Invoice, Txn } from "./types";

/** Custom-amount setter shown when the invoice was created with allow_custom_amount */
export function AmountSetter({
  inv, onSet,
}: { inv: Invoice; onSet: (v: number) => void }) {
  const [val, setVal] = useState("");
  const min = inv.min_amount ? Number(inv.min_amount) : 0;
  const max = inv.max_amount ? Number(inv.max_amount) : null;
  return (
    <div className="glass-premium rounded-2xl p-6 sm:p-8">
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
          className="flex-1 rounded-lg border border-glass-border bg-card/60 px-4 py-3 font-display text-2xl font-bold tabular-nums outline-none focus:border-brand"
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
        className="mt-5 w-full rounded-xl bg-gradient-brand py-3.5 text-sm font-bold text-brand-foreground shadow-[0_20px_45px_-15px_hsl(var(--brand)/0.55)]"
      >
        Continue
      </button>
    </div>
  );
}

/** Success panel — shown when the invoice is fully paid */
export function PaidPanel({
  inv, brand, verified,
}: { inv: Invoice; brand: Brand | null; verified?: Txn }) {
  return (
    <div className="glass-premium rounded-2xl p-8 text-center">
      <div className="mx-auto grid h-16 w-16 place-items-center rounded-full bg-brand/15 ring-1 ring-brand/30">
        <CheckCircle2 className="h-8 w-8 text-brand" />
      </div>
      <h1 className="mt-4 font-display text-2xl font-bold">Payment confirmed</h1>
      <p className="mt-1 text-sm text-muted-foreground tabular-nums">
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
          className="inline-flex items-center gap-2 rounded-lg border border-glass-border bg-card/60 px-4 py-2 text-sm font-semibold transition hover:border-brand"
        >
          <Download className="h-4 w-4" /> Download PDF receipt
        </button>
        {inv.redirect_url && (
          <a
            href={inv.redirect_url}
            className="inline-flex rounded-lg bg-gradient-brand px-4 py-2 text-sm font-semibold text-brand-foreground shadow-[0_20px_45px_-15px_hsl(var(--brand)/0.55)]"
          >
            Continue
          </a>
        )}
      </div>
    </div>
  );
}

/** Awaiting-verification panel — polls every 5s (parent) until settled */
export function PendingPanel({
  inv, pending,
}: { inv: Invoice; pending: Txn }) {
  return (
    <div className="glass-premium rounded-2xl p-8 text-center">
      <div className="mx-auto grid h-16 w-16 place-items-center rounded-full bg-amber-500/15 ring-1 ring-amber-500/30">
        <Clock className="h-8 w-8 text-amber-500" />
      </div>
      <h2 className="mt-4 font-display text-xl font-bold">Awaiting verification</h2>
      <p className="mt-1 text-sm text-muted-foreground">
        We received your payment claim (TrxID{" "}
        <span className="font-mono">{pending.provider_txn_id || pending.reference}</span>).
        This page will update automatically once the merchant confirms — usually within a few minutes.
      </p>
      {inv.redirect_url && (
        <a
          href={inv.redirect_url}
          className="mt-5 inline-flex rounded-lg border border-glass-border bg-card/60 px-4 py-2 text-sm font-semibold transition hover:border-brand"
        >
          Return to merchant
        </a>
      )}
    </div>
  );
}

/** Reusable-invoice banner shown above the picker when a prior payment already settled */
export function ReusableBanner() {
  return (
    <div className="glass-premium rounded-2xl border border-success/30 bg-success/5 p-5">
      <div className="flex items-center gap-2">
        <CheckCircle2 className="h-5 w-5 text-success" />
        <div className="font-semibold">Last payment received</div>
      </div>
      <p className="mt-1 text-xs text-muted-foreground">
        This is a reusable link — another customer can pay again below.
      </p>
    </div>
  );
}

/** Load-error panel */
export function ErrorPanel({
  loadError, onRetry,
}: { loadError: string | null; onRetry: () => void }) {
  const style = STYLES.premium;
  return (
    <div className="glass-premium rounded-2xl p-8 text-center">
      <XCircle className="mx-auto h-10 w-10 text-destructive" />
      <h1 className="mt-3 font-display text-xl font-bold">Invoice unavailable</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        {loadError
          ? `Couldn't reach payments backend: ${loadError}`
          : "This invoice does not exist, has expired, or has already been settled."}
      </p>
      {loadError && (
        <button
          onClick={onRetry}
          className={`mt-4 inline-flex rounded-lg px-4 py-2 text-sm font-semibold ${style.ctaBg}`}
        >
          Retry
        </button>
      )}
    </div>
  );
}
