import { useState } from "react";
import {
  Copy, CheckCircle2, Smartphone, CreditCard, Landmark, Bitcoin, MoreHorizontal,
} from "lucide-react";
import type { CheckoutStyle } from "./types";

// ─── Style tokens per checkout skin ─────────────────────────────────
export const STYLES: Record<CheckoutStyle, {
  page: string; card: string; hero: string; ctaBg: string; accentHalo: boolean;
}> = {
  premium: {
    page: "bg-background",
    card: "glass-premium rounded-2xl",
    hero:
      "font-display text-4xl font-black tracking-tight tabular-nums sm:text-5xl " +
      "bg-gradient-to-br from-foreground via-foreground to-brand/90 bg-clip-text text-transparent",
    ctaBg:
      "bg-gradient-brand text-brand-foreground shadow-[0_20px_45px_-15px_hsl(var(--brand)/0.55)] " +
      "ring-1 ring-inset ring-brand/40",
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
    card:
      "rounded-2xl border border-[#7c3aed]/40 bg-[#0b0b24]/80 " +
      "shadow-[0_0_40px_-10px_rgba(124,58,237,0.55)] backdrop-blur",
    hero:
      "font-display text-4xl font-black tracking-tight sm:text-5xl " +
      "bg-gradient-to-r from-fuchsia-400 via-violet-400 to-cyan-300 bg-clip-text text-transparent",
    ctaBg:
      "bg-gradient-to-r from-fuchsia-500 via-violet-500 to-cyan-400 text-white " +
      "shadow-[0_0_30px_-4px_rgba(168,85,247,0.7)]",
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

export const inputCls =
  "w-full rounded-lg border border-glass-border bg-card/60 px-3 py-2.5 text-sm outline-none " +
  "transition-colors focus:border-brand focus:ring-2 focus:ring-brand/20";

// ─── Small primitives ──────────────────────────────────────────────
export function SumRow({
  label, value, accent, muted,
}: { label: string; value: string; accent?: string; muted?: boolean }) {
  return (
    <div className="flex items-baseline justify-between py-1 text-sm">
      <span className={muted ? "text-muted-foreground" : "text-foreground/80"}>{label}</span>
      <span className={`font-mono tabular-nums ${accent ?? (muted ? "text-muted-foreground" : "text-foreground")}`}>
        {value}
      </span>
    </div>
  );
}

export function CopyBtn({ text, label }: { text: string; label?: string }) {
  const [ok, setOk] = useState(false);
  return (
    <button
      type="button"
      onClick={async (e) => {
        e.stopPropagation();
        try {
          await navigator.clipboard.writeText(text);
          setOk(true); setTimeout(() => setOk(false), 1200);
        } catch { /* noop */ }
      }}
      className="inline-flex shrink-0 items-center gap-1 rounded-md border border-glass-border bg-background/60 px-1.5 py-0.5 text-[10px] text-muted-foreground transition hover:border-brand hover:text-brand"
    >
      {ok ? <CheckCircle2 className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
      {label ?? (ok ? "Copied" : "Copy")}
    </button>
  );
}

export function Info({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="min-w-0">
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className="mt-1">{children}</div>
    </div>
  );
}

export function Field({
  label, children, full,
}: { label: string; children: React.ReactNode; full?: boolean }) {
  return (
    <label className={full ? "sm:col-span-2" : ""}>
      <div className="mb-1.5 text-xs font-medium uppercase tracking-wider text-muted-foreground">{label}</div>
      {children}
    </label>
  );
}

// ─── Helpers ───────────────────────────────────────────────────────
export function currencySymbol(code: string) {
  const map: Record<string, string> = {
    BDT: "৳", USD: "$", EUR: "€", GBP: "£", INR: "₹", AED: "د.إ",
  };
  return map[code] ?? `${code} `;
}

export function iconFor(type: string) {
  if (["bkash", "nagad", "rocket", "upay", "tap", "mcash", "sure_cash", "bangla_qr"].includes(type))
    return <Smartphone className="h-4 w-4" />;
  if (type === "card") return <CreditCard className="h-4 w-4" />;
  if (type === "bank_transfer") return <Landmark className="h-4 w-4" />;
  if (type === "crypto") return <Bitcoin className="h-4 w-4" />;
  return <MoreHorizontal className="h-4 w-4" />;
}

export function labelForType(t: string) {
  const map: Record<string, string> = {
    bkash: "bKash", nagad: "Nagad", rocket: "Rocket", upay: "Upay",
    tap: "Tap", mcash: "MCash", sure_cash: "SureCash", bangla_qr: "Bangla QR",
  };
  return map[t] ?? t;
}
