import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Check, ArrowRight, Loader2 } from "lucide-react";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/pricing")({
  head: () => ({
    meta: [
      { title: "Pricing — PayNOC" },
      {
        name: "description",
        content:
          "PayNOC pricing plans. Flat licensing, zero per-transaction fees. Choose the plan that fits your business.",
      },
      { property: "og:title", content: "Pricing — PayNOC" },
      {
        property: "og:description",
        content:
          "Self-hosted payment infrastructure with flat licensing. No per-transaction cuts, no merchant custody.",
      },
    ],
  }),
  component: PricingPage,
});

type Pkg = {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  price: number;
  currency: string;
  billing_cycle: "monthly" | "yearly" | "lifetime";
  features: unknown;
  sort_order: number;
  trial_days: number;
};

function cycleLabel(c: Pkg["billing_cycle"]) {
  if (c === "monthly") return "/ month";
  if (c === "yearly") return "/ year";
  return "one-time";
}

function priceLabel(price: number, currency: string) {
  if (price <= 0) return "Free";
  const sym = currency === "USD" ? "$" : currency === "BDT" ? "৳" : `${currency} `;
  return `${sym}${Number(price).toLocaleString()}`;
}

function featureList(f: unknown): string[] {
  if (Array.isArray(f)) return f.filter((x): x is string => typeof x === "string");
  if (f && typeof f === "object") {
    const arr = (f as { items?: unknown }).items;
    if (Array.isArray(arr)) return arr.filter((x): x is string => typeof x === "string");
  }
  return [];
}

function PricingPage() {
  const [pkgs, setPkgs] = useState<Pkg[] | null>(null);

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from("subscription_packages")
        .select("id,name,slug,description,price,currency,billing_cycle,features,sort_order,trial_days")
        .eq("is_active", true)
        .eq("is_public", true)
        .order("sort_order", { ascending: true });
      setPkgs((data ?? []) as Pkg[]);
    })();
  }, []);

  const highlightedIdx = pkgs && pkgs.length > 1 ? Math.floor(pkgs.length / 2) : 0;

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <SiteHeader />

      <section className="relative overflow-hidden">
        <div className="absolute inset-0 grid-radial opacity-30" />
        <div className="relative mx-auto max-w-7xl px-4 pt-20 pb-16 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-2xl text-center">
            <div className="glass inline-flex items-center gap-2 rounded-full px-4 py-1.5 text-xs font-medium text-foreground shadow-card">
              Pricing
            </div>
            <h1 className="mt-6 font-display text-5xl font-bold tracking-tight text-foreground sm:text-6xl">
              Simple plans. <span className="text-gradient-brand">Zero</span> hidden fees.
            </h1>
            <p className="mt-5 text-lg text-muted-foreground">
              Pick the plan that matches your volume. All plans include hosted checkout, webhooks,
              and API access.
            </p>
          </div>
        </div>
      </section>

      <section className="pb-24">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          {pkgs === null ? (
            <div className="flex justify-center py-16">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : pkgs.length === 0 ? (
            <div className="rounded-2xl border border-border bg-surface p-10 text-center text-muted-foreground">
              No packages published yet. Please check back soon.
            </div>
          ) : (
            <div
              className={`grid gap-6 ${
                pkgs.length === 1
                  ? "max-w-md mx-auto"
                  : pkgs.length === 2
                    ? "sm:grid-cols-2 max-w-4xl mx-auto"
                    : "lg:grid-cols-3"
              }`}
            >
              {pkgs.map((t, i) => {
                const highlighted = i === highlightedIdx && pkgs.length > 1;
                const feats = featureList(t.features);
                return (
                  <div
                    key={t.id}
                    className={`relative rounded-3xl border p-8 shadow-card transition-all ${
                      highlighted
                        ? "border-brand/50 bg-surface shadow-elevated ring-1 ring-brand/40"
                        : "border-border bg-surface"
                    }`}
                  >
                    {highlighted && (
                      <div className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-gradient-brand px-3 py-1 text-[11px] font-semibold uppercase tracking-wider text-brand-foreground shadow-glow">
                        Most popular
                      </div>
                    )}
                    <h3 className="font-display text-xl font-semibold text-foreground">{t.name}</h3>
                    {t.description && (
                      <p className="mt-1 text-sm text-muted-foreground">{t.description}</p>
                    )}
                    <div className="mt-6 flex items-baseline gap-1.5">
                      <span className="font-display text-4xl font-bold tracking-tight text-foreground">
                        {priceLabel(t.price, t.currency)}
                      </span>
                      <span className="text-sm text-muted-foreground">
                        {t.price > 0 ? cycleLabel(t.billing_cycle) : ""}
                      </span>
                    </div>
                    {t.trial_days > 0 && (
                      <p className="mt-1 text-xs text-brand">{t.trial_days}-day free trial</p>
                    )}

                    {feats.length > 0 && (
                      <ul className="mt-6 space-y-3">
                        {feats.map((f) => (
                          <li key={f} className="flex items-start gap-2.5 text-sm text-foreground">
                            <Check className="mt-0.5 h-4 w-4 shrink-0 text-brand" strokeWidth={2.5} />
                            {f}
                          </li>
                        ))}
                      </ul>
                    )}

                    <Link
                      to="/auth"
                      search={{ plan: t.slug } as never}
                      className={`mt-8 inline-flex w-full items-center justify-center gap-1.5 rounded-xl px-4 py-2.5 text-sm font-semibold transition-transform hover:scale-[1.01] ${
                        highlighted
                          ? "bg-gradient-brand text-brand-foreground shadow-glow"
                          : "bg-surface-2 text-foreground hover:bg-muted"
                      }`}
                    >
                      {t.price <= 0 ? "Get started" : `Choose ${t.name}`}
                      <ArrowRight className="h-4 w-4" />
                    </Link>
                  </div>
                );
              })}
            </div>
          )}

          <div className="mx-auto mt-16 max-w-3xl px-4 text-center text-sm text-muted-foreground sm:px-6">
            Merchant funds always settle directly into merchant accounts — PayNOC never takes
            custody. Need something bespoke?{" "}
            <Link to="/contact" className="text-brand underline">
              Talk to sales
            </Link>
            .
          </div>
        </div>
      </section>

      <SiteFooter />
    </div>
  );
}
