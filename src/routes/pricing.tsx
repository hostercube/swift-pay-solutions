import { createFileRoute, Link } from "@tanstack/react-router";
import { Check, ArrowRight } from "lucide-react";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";

export const Route = createFileRoute("/pricing")({
  head: () => ({
    meta: [
      { title: "Pricing — PayNOC" },
      {
        name: "description",
        content:
          "Simple, self-hosted pricing for PayNOC. Starter, Growth, and Enterprise plans — no per-transaction fees, no revenue share, no lock-in.",
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

const tiers = [
  {
    name: "Starter",
    price: "$0",
    period: "self hosted",
    tagline: "For solo merchants and small stores.",
    features: [
      "Up to 3 payment methods",
      "Hosted checkout",
      "Manual verification",
      "Webhook delivery",
      "Community support",
    ],
    cta: "Deploy free",
    highlighted: false,
  },
  {
    name: "Growth",
    price: "$49",
    period: "/ month · self hosted",
    tagline: "For growing businesses running multiple merchants.",
    features: [
      "Unlimited payment methods",
      "REST API + Webhooks",
      "Auto verification (BYO gateway)",
      "Payment links + invoices",
      "Multi-currency",
      "Priority email support",
    ],
    cta: "Start Growth trial",
    highlighted: true,
  },
  {
    name: "Enterprise",
    price: "Custom",
    period: "self hosted",
    tagline: "For platforms, PSPs, and high-volume operators.",
    features: [
      "Unlimited merchants + staff",
      "White-label + custom domains",
      "Fraud rules engine",
      "SLA + dedicated support",
      "Custom connectors & SDKs",
      "Compliance & audit assist",
    ],
    cta: "Talk to sales",
    highlighted: false,
  },
];

function PricingPage() {
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
              Flat licensing. <span className="text-gradient-brand">Zero</span> per-transaction fees.
            </h1>
            <p className="mt-5 text-lg text-muted-foreground">
              PayNOC is self-hosted software. You pay for the platform license — never for the
              volume of payments you process.
            </p>
          </div>
        </div>
      </section>

      <section className="pb-24">
        <div className="mx-auto grid max-w-7xl gap-6 px-4 sm:px-6 lg:grid-cols-3 lg:px-8">
          {tiers.map((t) => (
            <div
              key={t.name}
              className={`relative rounded-3xl border p-8 shadow-card transition-all ${
                t.highlighted
                  ? "border-brand/50 bg-surface shadow-elevated ring-1 ring-brand/40"
                  : "border-border bg-surface"
              }`}
            >
              {t.highlighted && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-gradient-brand px-3 py-1 text-[11px] font-semibold uppercase tracking-wider text-brand-foreground shadow-glow">
                  Most popular
                </div>
              )}
              <h3 className="font-display text-xl font-semibold text-foreground">{t.name}</h3>
              <p className="mt-1 text-sm text-muted-foreground">{t.tagline}</p>
              <div className="mt-6 flex items-baseline gap-1.5">
                <span className="font-display text-4xl font-bold tracking-tight text-foreground">
                  {t.price}
                </span>
                <span className="text-sm text-muted-foreground">{t.period}</span>
              </div>

              <ul className="mt-6 space-y-3">
                {t.features.map((f) => (
                  <li key={f} className="flex items-start gap-2.5 text-sm text-foreground">
                    <Check className="mt-0.5 h-4 w-4 shrink-0 text-brand" strokeWidth={2.5} />
                    {f}
                  </li>
                ))}
              </ul>

              <Link
                to="/contact"
                className={`mt-8 inline-flex w-full items-center justify-center gap-1.5 rounded-xl px-4 py-2.5 text-sm font-semibold transition-transform hover:scale-[1.01] ${
                  t.highlighted
                    ? "bg-gradient-brand text-brand-foreground shadow-glow"
                    : "bg-surface-2 text-foreground hover:bg-muted"
                }`}
              >
                {t.cta}
                <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
          ))}
        </div>

        <div className="mx-auto mt-16 max-w-3xl px-4 text-center text-sm text-muted-foreground sm:px-6">
          Every plan is fully self-hosted. Your data, your servers, your rules. Merchant funds
          always settle directly into merchant accounts — PayNOC never takes custody.
        </div>
      </section>

      <SiteFooter />
    </div>
  );
}
