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
  Terminal,
  KeyRound,
  FileCode2,
  Package,
  Sparkles,
} from "lucide-react";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "PayNOC — Self-hosted Merchant Payment Infrastructure" },
      {
        name: "description",
        content:
          "PayNOC is the self-hosted payment orchestration platform. Accept bKash, Nagad, cards, and crypto through your own gateway accounts — no custody, no lock-in, full API control.",
      },
      { property: "og:title", content: "PayNOC — Self-hosted Payment Infrastructure" },
      {
        property: "og:description",
        content:
          "Own your payment stack. Hosted checkout, REST APIs, HMAC webhooks, WordPress / WHMCS / Shopify plugins — PayNOC never holds merchant funds.",
      },
      { property: "og:type", content: "website" },
    ],
  }),
  component: HomePage,
});

const primaryFeatures = [
  {
    icon: Wallet,
    title: "Zero custody, zero risk",
    body: "Every taka lands directly in the merchant's own bKash, Nagad, Stripe, PayPal, or bank account. PayNOC never touches the money.",
  },
  {
    icon: Layers,
    title: "30+ payment methods",
    body: "Mobile wallets, cards, bank rails, and crypto — merchants configure priority, fees, currency scoping and daily caps per method.",
  },
  {
    icon: Code2,
    title: "Developer-grade REST API",
    body: "Idempotent endpoints, HMAC-signed webhooks, OpenAPI 3 spec, Postman collection, and full test-mode parity.",
  },
  {
    icon: Package,
    title: "Plugins that just work",
    body: "Official WordPress, WHMCS and Shopify plugins with one-key configuration. New plugins auto-publish to the docs.",
  },
  {
    icon: Shield,
    title: "Hardened by default",
    body: "TOTP 2FA, per-key IP whitelists, rate limits, audit trails, row-level security, and signed request logs on every endpoint.",
  },
  {
    icon: Server,
    title: "Self-hosted, forever yours",
    body: "Ship on your own infra with Docker or Coolify. No SaaS pricing, no rate ceilings, no data residency surprises.",
  },
];

const stats = [
  { value: "30+", label: "Payment methods" },
  { value: "0%", label: "Merchant custody" },
  { value: "100%", label: "API coverage" },
  { value: "<10s", label: "Webhook delivery" },
];

const steps = [
  {
    n: "01",
    title: "Merchant onboards",
    body: "KYC, brand settings, and gateway credentials — the merchant configures which providers to accept.",
  },
  {
    n: "02",
    title: "Checkout is created",
    body: "Your app POSTs to /v1/invoices. PayNOC returns a signed checkout URL you redirect the buyer to.",
  },
  {
    n: "03",
    title: "Money settles direct",
    body: "The buyer pays through the merchant's own gateway. Funds move directly — PayNOC never touches settlement.",
  },
  {
    n: "04",
    title: "Webhook confirms",
    body: "An HMAC-signed webhook fires within seconds. Retry queues, idempotency, and event log ensure zero loss.",
  },
];

function HomePage() {
  return (
    <div className="flex min-h-screen flex-col bg-background">
      <SiteHeader />

      {/* ============== HERO ============== */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 grid-radial opacity-40" />
        <div className="absolute inset-x-0 top-0 -z-0 mx-auto h-[520px] max-w-6xl bg-gradient-brand opacity-[0.12] blur-3xl" />

        <div className="relative mx-auto grid max-w-7xl gap-14 px-4 pt-20 pb-24 sm:px-6 lg:grid-cols-[1.05fr_0.95fr] lg:items-center lg:gap-10 lg:px-8 lg:pt-28">
          <div>
            <div className="glass inline-flex items-center gap-2 rounded-full px-4 py-1.5 text-xs font-medium text-foreground shadow-card">
              <span className="h-1.5 w-1.5 rounded-full bg-brand shadow-glow" />
              v1.0 · Self-hosted payment orchestration
            </div>

            <h1 className="mt-6 font-display text-5xl font-bold leading-[1.03] tracking-tight text-foreground sm:text-6xl lg:text-[4.25rem]">
              Own your{" "}
              <span className="text-gradient-brand">payment stack.</span>
              <br className="hidden sm:block" />
              Keep every cent.
            </h1>

            <p className="mt-6 max-w-xl text-lg leading-relaxed text-muted-foreground">
              PayNOC is a production-grade payment orchestration platform you deploy on your own
              infrastructure. Merchants receive money directly into their own accounts — we never
              hold funds, never take custody, never touch settlement.
            </p>

            <div className="mt-9 flex flex-wrap items-center gap-3">
              <Link
                to="/auth"
                className="group inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-brand px-6 py-3 text-sm font-semibold text-brand-foreground shadow-glow transition-transform hover:scale-[1.02]"
              >
                Start as a merchant
                <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
              </Link>
              <Link
                to="/api-reference"
                className="glass inline-flex items-center justify-center gap-2 rounded-xl px-6 py-3 text-sm font-semibold text-foreground shadow-card hover:bg-surface-2"
              >
                <FileCode2 className="h-4 w-4" />
                Read the API docs
              </Link>
              <Link
                to="/auth"
                className="inline-flex items-center gap-2 rounded-xl px-4 py-3 text-sm font-medium text-muted-foreground hover:text-foreground"
              >
                <Lock className="h-4 w-4" />
                Admin sign in
              </Link>
            </div>

            <div className="mt-8 flex flex-wrap items-center gap-x-6 gap-y-2 text-xs text-muted-foreground">
              <span className="inline-flex items-center gap-1.5"><CheckCircle2 className="h-3.5 w-3.5 text-success" /> Docker & Coolify ready</span>
              <span className="inline-flex items-center gap-1.5"><CheckCircle2 className="h-3.5 w-3.5 text-success" /> HMAC-signed webhooks</span>
              <span className="inline-flex items-center gap-1.5"><CheckCircle2 className="h-3.5 w-3.5 text-success" /> Test & live modes</span>
            </div>
          </div>

          {/* Hero terminal card */}
          <div className="relative">
            <div className="glass relative rounded-3xl p-1.5 shadow-elevated">
              <div className="rounded-[22px] bg-background/60 p-5">
                <div className="flex items-center justify-between border-b border-glass-border pb-3">
                  <div className="flex items-center gap-2">
                    <div className="h-2.5 w-2.5 rounded-full bg-destructive/60" />
                    <div className="h-2.5 w-2.5 rounded-full bg-warning/70" />
                    <div className="h-2.5 w-2.5 rounded-full bg-success/70" />
                  </div>
                  <span className="inline-flex items-center gap-1.5 font-mono text-[11px] text-muted-foreground">
                    <Terminal className="h-3 w-3" />
                    POST /v1/invoices
                  </span>
                </div>
                <pre className="mt-4 overflow-x-auto font-mono text-[11.5px] leading-relaxed text-foreground/90">
{`curl -X POST https://api.paynoc.dev/v1/invoices \\
  -H "Authorization: Bearer sk_live_..." \\
  -H "Idempotency-Key: 8f14e45f..." \\
  -d '{
    "amount": 2500,
    "currency": "BDT",
    "customer_email": "user@example.com",
    "redirect_url": "https://shop.com/thanks",
    "webhook_url":  "https://shop.com/hooks"
  }'

→ 201 Created
{
  "id": "inv_9f2AkQ",
  "status": "pending",
  "checkout_url": "https://pay.merchant.com/inv_9f2AkQ",
  "expires_at": "2026-07-01T12:15:00Z"
}`}
                </pre>
              </div>
            </div>
            <div className="absolute -inset-6 -z-10 bg-gradient-brand opacity-20 blur-3xl" />
          </div>
        </div>

        {/* Stats strip */}
        <div className="relative mx-auto -mt-8 mb-16 grid max-w-6xl grid-cols-2 gap-px overflow-hidden rounded-2xl border border-border bg-border shadow-card sm:grid-cols-4">
          {stats.map((s) => (
            <div key={s.label} className="bg-surface px-6 py-6 text-center">
              <div className="font-display text-3xl font-bold tracking-tight text-foreground">{s.value}</div>
              <div className="mt-1 text-xs font-medium uppercase tracking-wider text-muted-foreground">{s.label}</div>
            </div>
          ))}
        </div>
      </section>

      {/* ============== FEATURES ============== */}
      <section className="relative border-t border-border bg-surface-2/40">
        <div className="mx-auto max-w-7xl px-4 py-24 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-2xl text-center">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-brand">Why PayNOC</p>
            <h2 className="mt-3 font-display text-4xl font-bold tracking-tight text-foreground sm:text-5xl">
              Built for merchants who value{" "}
              <span className="text-gradient-brand">control</span>
            </h2>
            <p className="mt-4 text-lg text-muted-foreground">
              Every module is production-grade. No mock APIs, no placeholders, no fake logic.
            </p>
          </div>

          <div className="mt-16 grid gap-5 md:grid-cols-2 lg:grid-cols-3">
            {primaryFeatures.map((f) => (
              <div
                key={f.title}
                className="group relative overflow-hidden rounded-2xl border border-border bg-surface p-6 shadow-card transition-all hover:-translate-y-0.5 hover:border-brand/30 hover:shadow-elevated"
              >
                <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-brand/50 to-transparent opacity-0 transition-opacity group-hover:opacity-100" />
                <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-brand/10 text-brand">
                  <f.icon className="h-5 w-5" strokeWidth={2.25} />
                </div>
                <h3 className="mt-5 font-display text-lg font-semibold text-foreground">{f.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{f.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ============== HOW IT WORKS ============== */}
      <section className="border-t border-border">
        <div className="mx-auto max-w-7xl px-4 py-24 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-2xl text-center">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-brand">How it works</p>
            <h2 className="mt-3 font-display text-4xl font-bold tracking-tight text-foreground sm:text-5xl">
              Money moves direct to the merchant. Always.
            </h2>
            <p className="mt-4 text-lg text-muted-foreground">
              PayNOC orchestrates checkout, verification, and reconciliation — funds settle in the
              merchant's own account, not ours.
            </p>
          </div>

          <div className="mt-16 grid gap-5 md:grid-cols-2 lg:grid-cols-4">
            {steps.map((s) => (
              <div key={s.n} className="relative overflow-hidden rounded-2xl border border-border bg-surface p-6">
                <div className="font-mono text-xs font-semibold text-brand">{s.n}</div>
                <h3 className="mt-3 font-display text-lg font-semibold text-foreground">{s.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{s.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ============== DEVELOPER STRIP ============== */}
      <section className="border-t border-border bg-surface-2/40">
        <div className="mx-auto max-w-7xl px-4 py-24 sm:px-6 lg:px-8">
          <div className="grid gap-14 lg:grid-cols-2 lg:items-center">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-brand">For developers</p>
              <h2 className="mt-3 font-display text-4xl font-bold tracking-tight text-foreground sm:text-5xl">
                Ship an integration this afternoon.
              </h2>
              <p className="mt-5 text-lg leading-relaxed text-muted-foreground">
                Everything is REST + JSON. Test-mode keys, idempotent POSTs, HMAC-signed webhooks with
                automatic retries, a Postman collection, and drop-in plugins for the platforms you already run.
              </p>

              <ul className="mt-8 space-y-4">
                {[
                  { icon: KeyRound, title: "Test & live keys", body: "sk_test_ vs sk_live_ — full parity, isolated data, safe to script." },
                  { icon: Webhook, title: "HMAC webhooks + retries", body: "Verified signatures, 24-hour retry ladder, dedupe by event id." },
                  { icon: Package, title: "Plugins for WordPress, WHMCS, Shopify", body: "Published by the platform team — download from the docs page." },
                ].map((row) => (
                  <li key={row.title} className="flex gap-3">
                    <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-brand/10 text-brand">
                      <row.icon className="h-4 w-4" strokeWidth={2.25} />
                    </div>
                    <div>
                      <div className="text-sm font-semibold text-foreground">{row.title}</div>
                      <div className="text-sm text-muted-foreground">{row.body}</div>
                    </div>
                  </li>
                ))}
              </ul>

              <div className="mt-9 flex flex-wrap gap-3">
                <Link
                  to="/api-reference"
                  className="inline-flex items-center gap-2 rounded-xl bg-gradient-brand px-5 py-3 text-sm font-semibold text-brand-foreground shadow-glow"
                >
                  <FileCode2 className="h-4 w-4" />
                  API reference
                </Link>
                <a
                  href="/api/public/v1/postman"
                  className="glass inline-flex items-center gap-2 rounded-xl px-5 py-3 text-sm font-semibold text-foreground shadow-card"
                >
                  <Sparkles className="h-4 w-4" />
                  Download Postman collection
                </a>
              </div>
            </div>

            <div className="relative">
              <div className="glass rounded-3xl p-1.5 shadow-elevated">
                <div className="rounded-[22px] bg-background/60 p-5">
                  <div className="flex items-center justify-between border-b border-glass-border pb-3">
                    <span className="font-mono text-[11px] text-muted-foreground">webhook.verify.js</span>
                    <span className="inline-flex items-center gap-1 rounded-md bg-success/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-success">
                      HMAC · v1
                    </span>
                  </div>
                  <pre className="mt-4 overflow-x-auto font-mono text-[11.5px] leading-relaxed text-foreground/90">
{`import crypto from "node:crypto";

app.post("/hooks/paynoc", (req, res) => {
  const sig = req.header("x-paynoc-signature");
  const ts  = req.header("x-paynoc-timestamp");
  const raw = req.rawBody;

  const expected = crypto
    .createHmac("sha256", process.env.PAYNOC_WEBHOOK_SECRET)
    .update(\`\${ts}.\${raw}\`)
    .digest("hex");

  if (!sig?.includes(expected)) return res.sendStatus(401);

  const event = JSON.parse(raw);
  handle(event);
  res.sendStatus(200);
});`}
                  </pre>
                </div>
              </div>
              <div className="absolute -inset-6 -z-10 bg-gradient-brand opacity-15 blur-3xl" />
            </div>
          </div>
        </div>
      </section>

      {/* ============== PILLARS ============== */}
      <section className="border-t border-border">
        <div className="mx-auto max-w-7xl px-4 py-20 sm:px-6 lg:px-8">
          <div className="grid gap-4 md:grid-cols-4">
            {[
              { icon: Zap, title: "Real-time", body: "Event-driven with retry queues." },
              { icon: Globe, title: "Multi-currency", body: "Any currency, any provider, any region." },
              { icon: BarChart3, title: "Analytics", body: "Full reports, exports, and audit trails." },
              { icon: Shield, title: "Hardened", body: "2FA, HMAC, RLS, rate-limits, audit logs." },
            ].map((p) => (
              <div key={p.title} className="flex items-start gap-3 rounded-xl border border-border bg-surface p-5">
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

      {/* ============== CTA ============== */}
      <section className="border-t border-border bg-surface-2/40">
        <div className="mx-auto max-w-5xl px-4 py-24 sm:px-6 lg:px-8">
          <div className="relative overflow-hidden rounded-3xl border border-border bg-surface p-10 text-center shadow-card sm:p-16">
            <div className="absolute inset-0 grid-radial opacity-40" />
            <div className="absolute inset-x-0 top-0 mx-auto h-40 max-w-lg bg-gradient-brand opacity-20 blur-3xl" />
            <div className="relative">
              <h2 className="font-display text-3xl font-bold tracking-tight text-foreground sm:text-5xl">
                Ready to run your own payment stack?
              </h2>
              <p className="mx-auto mt-4 max-w-xl text-lg text-muted-foreground">
                Onboard as a merchant, configure your gateways, and start accepting payments directly
                into your own accounts — in production, today.
              </p>
              <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
                <Link
                  to="/auth"
                  className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-brand px-6 py-3 text-sm font-semibold text-brand-foreground shadow-glow transition-transform hover:scale-[1.02] sm:w-auto"
                >
                  Start as merchant
                  <ArrowRight className="h-4 w-4" />
                </Link>
                <Link
                  to="/api-reference"
                  className="glass inline-flex w-full items-center justify-center gap-2 rounded-xl px-6 py-3 text-sm font-semibold text-foreground shadow-card sm:w-auto"
                >
                  <FileCode2 className="h-4 w-4" />
                  API reference
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
