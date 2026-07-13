import { Lock, Sparkles } from "lucide-react";
import { CopyBtn, currencySymbol, STYLES, SumRow } from "./primitives";
import type { Brand, CheckoutStyle, Invoice, Txn } from "./types";

/**
 * Sticky left-column order summary — amount hero, breakdown, coupon input,
 * display-currency picker, security footer chip.
 */
export function OrderSummary({
  inv, brand, trxId, pending, converted, activeDisplayCur, displayCurrencies,
  couponInput, setCouponInput, couponBusy, onApplyCoupon,
  onChangeDisplayCurrency,
}: {
  inv: Invoice;
  brand: Brand | null;
  trxId: string;
  pending?: Txn | null;
  converted: number | null;
  activeDisplayCur: string | null;
  displayCurrencies: string[];
  couponInput: string;
  setCouponInput: (v: string) => void;
  couponBusy: boolean;
  onApplyCoupon: () => void;
  onChangeDisplayCurrency: (v: string | null) => void;
}) {
  const style = STYLES[(brand?.checkout_style as CheckoutStyle) ?? "premium"];
  const showCoupon = inv.status === "pending" && !pending;

  return (
    <aside className="lg:sticky lg:top-6 lg:self-start">
      <div className={`overflow-hidden ${style.card}`}>
        {inv.mode === "test" && (
          <div className="bg-amber-500/15 py-1.5 text-center text-[10px] font-bold uppercase tracking-widest text-amber-600">
            Test mode — no real money will be moved
          </div>
        )}
        <div className="p-6 sm:p-7">
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span className="uppercase tracking-widest">You are paying</span>
            <CopyBtn text={trxId} label="Trx ID" />
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className={style.hero}>
              {currencySymbol(inv.currency)}{Number(inv.amount).toLocaleString()}
            </span>
            <span className="text-sm font-medium text-muted-foreground">{inv.currency}</span>
          </div>
          {converted != null && activeDisplayCur && (
            <div className="mt-1.5 text-xs text-muted-foreground">
              ≈ {activeDisplayCur} {converted.toLocaleString()} · settled in {inv.currency}
            </div>
          )}
          {inv.description && (
            <p className="mt-4 line-clamp-3 text-sm leading-relaxed text-muted-foreground">
              {inv.description}
            </p>
          )}
        </div>

        <div className="border-t border-glass-border/70 bg-background/30 p-6 sm:p-7">
          <SumRow
            label="Subtotal"
            value={`${currencySymbol(inv.currency)}${Number(inv.amount).toLocaleString()}`}
          />
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
            <span className="font-display text-lg font-bold tabular-nums">
              {currencySymbol(inv.currency)}{Number(inv.amount).toLocaleString()}
            </span>
          </div>

          {showCoupon && (
            <div className="mt-4 flex items-center gap-2 rounded-lg border border-glass-border bg-background/60 p-2">
              <Sparkles className="h-3.5 w-3.5 shrink-0 text-brand" />
              <input
                value={couponInput}
                onChange={(e) => setCouponInput(e.target.value)}
                placeholder="Have a discount code?"
                className="min-w-0 flex-1 bg-transparent px-1 py-0.5 text-sm outline-none"
              />
              <button
                onClick={onApplyCoupon}
                disabled={couponBusy}
                className="shrink-0 rounded-md bg-brand/15 px-3 py-1 text-xs font-semibold text-brand transition hover:bg-brand/25 disabled:opacity-50"
              >
                {couponBusy ? "…" : "Apply"}
              </button>
            </div>
          )}

          <div className="mt-4 flex items-center justify-between text-[11px] text-muted-foreground">
            <span>Display currency</span>
            <select
              value={activeDisplayCur ?? inv.currency}
              onChange={(e) =>
                onChangeDisplayCurrency(e.target.value === inv.currency ? null : e.target.value)
              }
              className="rounded border border-glass-border bg-background px-2 py-1 text-[11px]"
            >
              <option value={inv.currency}>{inv.currency}</option>
              {displayCurrencies.filter((c) => c !== inv.currency).map((c) => (
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
  );
}
