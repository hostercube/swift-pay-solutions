import { createFileRoute } from "@tanstack/react-router";
import { BookOpen, Code2, Webhook, Key, Zap, Shield } from "lucide-react";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";

export const Route = createFileRoute("/docs")({
  head: () => ({
    meta: [
      { title: "Documentation — PayNOC" },
      {
        name: "description",
        content:
          "PayNOC developer documentation. REST APIs, webhooks, SDK examples, and integration guides for hosted checkout, invoices, and payment links.",
      },
      { property: "og:title", content: "Documentation — PayNOC" },
      {
        property: "og:description",
        content: "Integrate PayNOC in minutes — REST API, webhooks, SDKs, and connectors.",
      },
    ],
  }),
  component: DocsPage,
});

const sections = [
  {
    icon: Zap,
    title: "Quickstart",
    body: "Deploy PayNOC, create your first merchant, generate an API key, and process a test payment in under 10 minutes.",
  },
  {
    icon: Key,
    title: "Authentication",
    body: "API keys, secret keys, and HMAC signing. Sandbox vs production modes. Rotating and revoking credentials.",
  },
  {
    icon: Code2,
    title: "REST API Reference",
    body: "Every endpoint documented — checkout, invoices, payment links, customers, subscriptions, refunds, verification.",
  },
  {
    icon: Webhook,
    title: "Webhooks",
    body: "Real-time event delivery with HMAC signature verification, automatic retries, and delivery logs.",
  },
  {
    icon: Shield,
    title: "Bring Your Own Gateway",
    body: "Connect official provider credentials. Build custom connectors and webhook adapters without platform changes.",
  },
  {
    icon: BookOpen,
    title: "Integration Guides",
    body: "Hosted checkout, embedded popup, QR codes, invoices, and payment links — step-by-step tutorials for each.",
  },
];

function DocsPage() {
  return (
    <div className="flex min-h-screen flex-col bg-background">
      <SiteHeader />

      <section className="relative overflow-hidden">
        <div className="absolute inset-0 grid-radial opacity-30" />
        <div className="relative mx-auto max-w-7xl px-4 pt-20 pb-12 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-2xl text-center">
            <div className="glass inline-flex items-center gap-2 rounded-full px-4 py-1.5 text-xs font-medium text-foreground shadow-card">
              Documentation
            </div>
            <h1 className="mt-6 font-display text-5xl font-bold tracking-tight text-foreground sm:text-6xl">
              Build with <span className="text-gradient-brand">PayNOC</span>
            </h1>
            <p className="mt-5 text-lg text-muted-foreground">
              Everything you need to integrate PayNOC into your product — from a five-line curl to
              a full white-label deployment.
            </p>
          </div>
        </div>
      </section>

      <section className="pb-16">
        <div className="mx-auto grid max-w-7xl gap-5 px-4 sm:grid-cols-2 sm:px-6 lg:grid-cols-3 lg:px-8">
          {sections.map((s) => (
            <div
              key={s.title}
              className="group rounded-2xl border border-border bg-surface p-6 shadow-card transition-all hover:-translate-y-0.5 hover:shadow-elevated"
            >
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-brand/10 text-brand">
                <s.icon className="h-5 w-5" strokeWidth={2.25} />
              </div>
              <h3 className="mt-5 font-display text-lg font-semibold text-foreground">
                {s.title}
              </h3>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{s.body}</p>
              <div className="mt-4 text-xs font-medium text-muted-foreground">
                Detailed reference coming with the API module.
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="border-t border-border bg-surface-2/50">
        <div className="mx-auto max-w-5xl px-4 py-16 sm:px-6 lg:px-8">
          <h2 className="font-display text-2xl font-semibold text-foreground">
            Example: create a checkout
          </h2>
          <p className="mt-2 text-sm text-muted-foreground">
            Send a signed request to the checkout endpoint. The response includes a hosted checkout
            URL you can redirect the customer to.
          </p>
          <div className="glass mt-6 rounded-2xl p-6 shadow-elevated">
            <pre className="overflow-x-auto text-xs leading-relaxed text-foreground/90">
{`curl -X POST https://your-paynoc.example.com/api/v1/checkout \\
  -H "Authorization: Bearer $PAYNOC_API_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{
    "amount": 2500,
    "currency": "BDT",
    "method": "bkash_merchant",
    "customer": {
      "email": "user@example.com",
      "phone": "+8801XXXXXXXXX"
    },
    "success_url": "https://shop.example.com/thanks",
    "cancel_url":  "https://shop.example.com/cart"
  }'`}
            </pre>
          </div>
        </div>
      </section>

      <SiteFooter />
    </div>
  );
}
