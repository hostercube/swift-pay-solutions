import { useEffect, useMemo, useState } from "react";
import { Zap, Smartphone, CreditCard, Bitcoin, MoreHorizontal } from "lucide-react";
import { getGateway } from "@/lib/gateways/registry";
import { resolveLogoUrl } from "@/lib/logo-url";
import { iconFor } from "./primitives";
import type { Gw, Method } from "./types";

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

/**
 * Right-column method picker — category tabs + instant gateways grid + manual method grid.
 * "Instant" tab lists auto-verified BYO gateways (bKash PGW, SSLCommerz, Stripe, etc.);
 * other tabs list manual payment methods that require the customer to enter a Trx ID.
 */
export function MethodPicker({
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

  const available = useMemo(
    () => CATEGORIES.filter((c) =>
      c.key === "auto" ? autoGateways.length > 0 : grouped[c.key].length > 0,
    ),
    [autoGateways, grouped],
  );

  const [cat, setCat] = useState<CatKey>(available[0]?.key ?? "auto");
  useEffect(() => {
    if (!available.some((c) => c.key === cat)) setCat(available[0]?.key ?? "auto");
  }, [available, cat]);

  if (available.length === 0) {
    return (
      <div className="glass-premium rounded-2xl p-10 text-center">
        <div className="text-sm text-muted-foreground">
          The merchant has not configured any payment methods yet.
        </div>
      </div>
    );
  }

  return (
    <div className="glass-premium rounded-2xl p-5 sm:p-6">
      <div className="mb-5">
        <h2 className="font-display text-lg font-bold">Choose payment method</h2>
        <p className="text-xs text-muted-foreground">Pick a category, then a provider.</p>
      </div>

      {/* Category tabs */}
      <div className="-mx-5 mb-5 flex snap-x gap-2 overflow-x-auto px-5 pb-1 sm:mx-0 sm:px-0 md:grid md:grid-cols-4 lg:grid-cols-5">
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
            const logo = resolveLogoUrl(g.logo_url, g.provider);
            return (
              <button
                key={key}
                disabled={busy || !!redirecting}
                onClick={() => onGateway(g.provider, g.id)}
                className="group relative overflow-hidden rounded-xl border border-glass-border bg-card/50 p-4 text-left transition hover:border-brand hover:shadow-[0_20px_45px_-20px_hsl(var(--brand)/0.55)] disabled:opacity-60"
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="flex min-w-0 items-center gap-2">
                    <span className="grid h-9 w-9 shrink-0 place-items-center overflow-hidden rounded-lg bg-white/90 ring-1 ring-inset ring-brand/20">
                      {logo ? (
                        <img src={logo} alt="" className="h-6 w-6 object-contain" loading="lazy" />
                      ) : (
                        <Zap className="h-4 w-4 text-brand" />
                      )}
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
              className="group flex flex-col items-start gap-2 rounded-xl border border-glass-border bg-card/50 p-3 text-left transition hover:border-brand hover:shadow-[0_20px_45px_-20px_hsl(var(--brand)/0.55)]"
            >
              <span className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-brand/15 text-brand ring-1 ring-inset ring-brand/20">
                {iconFor(m.type)}
              </span>
              <div className="min-w-0 w-full">
                <div className="truncate text-sm font-semibold">{m.label}</div>
                <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{m.type}</div>
              </div>
              <div className="mt-auto text-[10px] text-muted-foreground">
                Fee {m.fee_percent}% + {m.fee_flat}
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
