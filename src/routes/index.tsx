import { createFileRoute, Link } from "@tanstack/react-router";
import {
  ArrowRight,
  Zap,
  Shield,
  Wallet,
  Globe,
  Code2,
  Webhook,
  Layers,
  Lock,
  BarChart3,
  CheckCircle2,
  Server,
} from "lucide-react";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "PayNOC — Self Hosted Merchant Payment Infrastructure" },
      {
        name: "description",
        content:
          "PayNOC is a self-hosted payment infrastructure platform. Merchants keep 100% control of their money — every transaction routes directly to their own gateway account.",
      },
      { property: "og:title", content: "PayNOC — Self Hosted Merchant Payment Infrastructure" },
      {
        property: "og:description",
        content:
          "Own your payment stack. Hosted checkout, APIs, webhooks, and merchant panel — PayNOC never holds merchant funds.",
      },
      { property: "og:type", content: "website" },
    ],
  }),
  component: HomePage,
});

const features = [
  {
    icon: Wallet,
    title: "No Wallet, No Custody",
    body: "PayNOC never holds merchant money. Every payment settles directly into the merchant's own configured account — bKash, Nagad, Stripe, PayPal, bank, crypto — anything.",
  },
  {
    icon: Layers,
    title: "Unlimited Payment Methods",
    body: "bKash, Nagad, Rocket, Upay, Stripe, PayPal, Paddle, Razorpay, crypto wallets, custom gateways. Each merchant configures unlimited methods with priority, fees, and limits.",
  },
  {
    icon: Code2,
    title: "Developer-first APIs",
    body: "REST APIs for checkout, invoices, subscriptions, refunds, and verification. HMAC-signed webhooks, OpenAPI spec, and SDK examples for every language.",
  },
  {
    icon: Webhook,
    title: "Hosted & Embedded Checkout",
    body: "Beautiful hosted checkout out of the box. Or embed via popup, QR, or direct API. Per-merchant branding, custom domains, white-label ready.",
  },
  {
    icon: Shield,
    title: "Bring Your Own Gateway",
    body: "Merchants connect their own official provider credentials. Official APIs, custom connectors, and webhook adapters — no code changes to the platform.",
  },
  {
    icon: Server,
    title: "Self Hosted, Always",
    body: "Deploy on your own infrastructure. No external SaaS lock-in. Full control over data residency, security posture, and compliance.",
  },
];

const stats = [
  { value: "30+", label: "Payment methods" },
  { value: "0%", label: "Merchant custody" },
  { value: "100%", label: "API coverage" },
  { value: "24/7", label: "Real-time webhooks" },
];

function HomePage() {
  return (
    <div className="flex min-h-screen flex-col bg-background">
      <SiteHeader />

      {/* Hero */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 grid-radial opacity-40" />
        <div className="relative mx-auto max-w-7xl px-4 pt-20 pb-24 sm:px-6 lg:px-8 lg:pt-28">
          <div className="mx-auto max-w-3xl text-center">
            <div className="glass mx-auto inline-flex items-center gap-2 rounded-full px-4 py-1.5 text-xs font-medium text-foreground shadow-card">
              <span className="h-1.5 w-1.5 rounded-full bg-brand shadow-glow" />
              Self hosted merchant payment infrastructure
            </div>

            <h1 className="mt-6 font-display text-5xl font-bold leading-[1.05] tracking-tight text-foreground sm:text-6xl lg:text-7xl">
              Own your{" "}
              <span className="text-gradient-brand">payment stack.</span>
              <br className="hidden sm:block" />
              Keep every cent.
            </h1>

            <p className="mx-auto mt-6 max-w-2xl text-lg leading-relaxed text-muted-foreground">
              PayNOC is a production-grade payment platform you host yourself. Merchants receive
              payments directly into their own accounts — we never hold funds, never take custody,
              never touch the settlement.
            </p>

            <div className="mt-9 flex flex-col items-center justify-center gap-3 sm:flex-row">
              <Link
                to="/"
                className="group inline-flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-brand px-6 py-3 text-sm font-semibold text-brand-foreground shadow-glow transition-transform hover:scale-[1.02] sm:w-auto"
              >
                Merchant sign up
                <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
              </Link>
              <Link
                to="/"
                className="glass inline-flex w-full items-center justify-center gap-2 rounded-xl px-6 py-3 text-sm font-semibold text-foreground shadow-card hover:bg-surface-2 sm:w-auto"
              >
                <Lock className="h-4 w-4" />
                Admin sign in
              </Link>
            </div>

            <p className="mt-6 text-xs text-muted-foreground">
              No credit card required · Deploy on your own infra · Coolify & Docker ready
            </p>
          </div>

          {/* Stats strip */}
          <div className="mx-auto mt-20 grid max-w-4xl grid-cols-2 gap-px overflow-hidden rounded-2xl border border-border bg-border shadow-card sm:grid-cols-4">
            {stats.map((s) => (
              <div key={s.label} className="bg-surface px-6 py-6 text-center">
                <div className="font-display text-3xl font-bold tracking-tight text-foreground">
                  {s.value}
                </div>
                <div className="mt-1 text-xs font-medium uppercase tracking-wider text-muted-foreground">
                  {s.label}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Feature grid */}
      <section className="relative border-t border-border bg-surface-2/50">
        <div className="mx-auto max-w-7xl px-4 py-24 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-2xl text-center">
            <h2 className="font-display text-4xl font-bold tracking-tight text-foreground sm:text-5xl">
              Built for merchants who value{" "}
              <span className="text-gradient-brand">control</span>
            </h2>
            <p className="mt-4 text-lg text-muted-foreground">
              Every module is production-grade. No mock APIs, no placeholders, no fake logic.
            </p>
          </div>

          <div className="mt-16 grid gap-5 md:grid-cols-2 lg:grid-cols-3">
            {features.map((f) => (
              <div
                key={f.title}
                className="group relative overflow-hidden rounded-2xl border border-border bg-surface p-6 shadow-card transition-all hover:-translate-y-0.5 hover:shadow-elevated"
              >
                <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-brand/50 to-transparent opacity-0 transition-opacity group-hover:opacity-100" />
                <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-brand/10 text-brand">
                  <f.icon className="h-5 w-5" strokeWidth={2.25} />
                </div>
                <h3 className="mt-5 font-display text-lg font-semibold text-foreground">
                  {f.title}
                </h3>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{f.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* How it works */}
      <section className="border-t border-border">
        <div className="mx-auto max-w-7xl px-4 py-24 sm:px-6 lg:px-8">
          <div className="grid gap-16 lg:grid-cols-2 lg:items-center">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full border border-border bg-surface px-3 py-1 text-xs font-medium text-muted-foreground">
                How it works
              </div>
              <h2 className="mt-4 font-display text-4xl font-bold tracking-tight text-foreground sm:text-5xl">
                Money moves directly to the merchant. Always.
              </h2>
              <p className="mt-5 text-lg leading-relaxed text-muted-foreground">
                PayNOC orchestrates the checkout, verification, and reconciliation flow. But the
                actual funds always land in the merchant's own payment account — never in a PayNOC
                wallet.
              </p>

              <ul className="mt-8 space-y-4">
                {[
                  "Customer picks a method on the merchant's hosted checkout.",
                  "PayNOC creates the payment intent and routes to the merchant's own gateway credentials.",
                  "Funds settle directly into the merchant's account — bank, wallet, or provider.",
                  "PayNOC verifies, logs, fires webhooks, and updates the transaction state.",
                ].map((step, i) => (
                  <li key={i} className="flex gap-3">
                    <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-brand" strokeWidth={2.25} />
                    <span className="text-sm leading-relaxed text-foreground">{step}</span>
                  </li>
                ))}
              </ul>
            </div>

            <div className="relative">
              <div className="glass relative rounded-3xl p-6 shadow-elevated">
                <div className="flex items-center justify-between border-b border-glass-border pb-4">
                  <div className="flex items-center gap-2">
                    <div className="h-2.5 w-2.5 rounded-full bg-destructive/60" />
                    <div className="h-2.5 w-2.5 rounded-full bg-warning/70" />
                    <div className="h-2.5 w-2.5 rounded-full bg-success/70" />
                  </div>
                  <span className="font-mono text-xs text-muted-foreground">
                    paynoc/api/v1/checkout
                  </span>
                </div>
                <pre className="mt-4 overflow-x-auto text-xs leading-relaxed text-foreground/90">
{`POST /api/v1/checkout
{
  "amount": 2500,
  "currency": "BDT",
  "method": "bkash_merchant",
  "customer": {
    "email": "user@example.com",
    "phone": "+8801XXXXXXXXX"
  },
  "success_url": "https://shop.example.com/thanks",
  "cancel_url":  "https://shop.example.com/cart"
}

→ 200 OK
{
  "id": "pay_9f2A_kQ",
  "status": "pending",
  "checkout_url": "https://pay.merchant.com/pay_9f2A_kQ",
  "expires_at": "2026-07-01T12:15:00Z"
}`}
                </pre>
              </div>
              <div className="absolute -inset-4 -z-10 bg-gradient-brand opacity-20 blur-3xl" />
            </div>
          </div>
        </div>
      </section>

      {/* Pillars */}
      <section className="border-t border-border bg-surface-2/50">
        <div className="mx-auto max-w-7xl px-4 py-20 sm:px-6 lg:px-8">
          <div className="grid gap-4 md:grid-cols-4">
            {[
              { icon: Zap, title: "Real-time", body: "Event-driven processing with retry queues." },
              { icon: Globe, title: "Multi-currency", body: "Any currency, any provider, any region." },
              { icon: BarChart3, title: "Analytics", body: "Full reports, exports, and audit trails." },
              { icon: Shield, title: "Hardened", body: "2FA, TOTP, HMAC, RLS, rate-limits, audit logs." },
            ].map((p) => (
              <div key={p.title} className="flex items-start gap-3 rounded-xl bg-surface p-4">
                <p.icon className="mt-0.5 h-5 w-5 shrink-0 text-brand" strokeWidth={2.25} />
                <div>
                  <div className="text-sm font-semibold text-foreground">{p.title}</div>
                  <div className="mt-0.5 text-xs text-muted-foreground">{p.body}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="border-t border-border">
        <div className="mx-auto max-w-5xl px-4 py-24 sm:px-6 lg:px-8">
          <div className="relative overflow-hidden rounded-3xl border border-border bg-surface p-10 text-center shadow-card sm:p-16">
            <div className="absolute inset-0 grid-radial opacity-40" />
            <div className="relative">
              <h2 className="font-display text-3xl font-bold tracking-tight text-foreground sm:text-5xl">
                Ready to run your own payment stack?
              </h2>
              <p className="mx-auto mt-4 max-w-xl text-lg text-muted-foreground">
                Onboard as a merchant, configure your payment methods, and start accepting payments
                directly into your own accounts.
              </p>
              <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
                <Link
                  to="/"
                  className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-brand px-6 py-3 text-sm font-semibold text-brand-foreground shadow-glow transition-transform hover:scale-[1.02] sm:w-auto"
                >
                  Start as merchant
                  <ArrowRight className="h-4 w-4" />
                </Link>
                <Link
                  to="/docs"
                  className="glass inline-flex w-full items-center justify-center gap-2 rounded-xl px-6 py-3 text-sm font-semibold text-foreground shadow-card sm:w-auto"
                >
                  Read the docs
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>

      <SiteFooter />
    </div>
  );
}
