import { Shield, Lock } from "lucide-react";
import { MerchantTracking, type TrackingConfig } from "@/components/merchant-tracking";
import { STYLES } from "./primitives";
import type { Brand, CheckoutStyle, Invoice } from "./types";

/**
 * Full-page checkout shell — brand header, ambient halo, footer.
 * Style variant is driven by `brand.checkout_style` ("premium" | "classic" | "neon" | "minimal").
 * `premium` is the tuned Midnight Glass look.
 */
export function Shell({
  children, brand, inv, trxId,
}: {
  children: React.ReactNode;
  brand: Brand | null;
  inv?: Invoice | null;
  trxId?: string;
}) {
  const brandColor = brand?.brand_color || null;
  const cssVars = brandColor
    ? ({ ["--brand" as never]: brandColor, ["--brand-2" as never]: brandColor } as React.CSSProperties)
    : undefined;
  const skin = STYLES[(brand?.checkout_style as CheckoutStyle) ?? "premium"];
  const name = brand?.business_name?.trim() || "PayNOC secure checkout";

  return (
    <div className={`relative min-h-screen ${skin.page}`} style={cssVars}>
      <MerchantTracking config={brand as TrackingConfig | null} />
      {skin.accentHalo && (
        <>
          <div className="grid-radial absolute inset-0 opacity-25" />
          <div
            aria-hidden
            className="pointer-events-none absolute inset-x-0 top-0 h-[420px] opacity-60"
            style={{
              background:
                "radial-gradient(ellipse 80% 50% at 50% 0%, hsl(var(--brand)/0.22), transparent 65%)",
            }}
          />
          <div
            aria-hidden
            className="pointer-events-none absolute -left-40 top-40 h-[500px] w-[500px] rounded-full opacity-30 blur-3xl"
            style={{ background: "radial-gradient(circle, hsl(var(--brand)/0.35), transparent 70%)" }}
          />
        </>
      )}

      <div className="relative mx-auto max-w-6xl px-4 py-6 sm:py-10">
        <header className="mb-6 grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 sm:mb-10">
          <div className="flex min-w-0 items-center gap-3">
            {brand?.logo_url ? (
              <img
                src={brand.logo_url}
                alt={name}
                className="h-11 w-11 shrink-0 rounded-xl object-contain ring-1 ring-glass-border"
              />
            ) : (
              <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-gradient-brand shadow-[0_10px_30px_-10px_hsl(var(--brand)/0.6)]">
                <Shield className="h-5 w-5 text-brand-foreground" strokeWidth={2.5} />
              </span>
            )}
            <div className="min-w-0">
              <div className="truncate font-display text-base font-bold sm:text-lg">{name}</div>
              {trxId && (
                <div className="flex items-center gap-1 text-[11px] text-muted-foreground">
                  <span className="truncate font-mono">Trx ID · {trxId}</span>
                </div>
              )}
            </div>
          </div>
          {inv && (
            <div className="flex shrink-0 items-center gap-1.5 rounded-full border border-glass-border bg-card/60 px-3 py-1.5 text-[11px] font-semibold text-muted-foreground backdrop-blur">
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
