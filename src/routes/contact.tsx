import { createFileRoute } from "@tanstack/react-router";
import { Mail, MessageSquare, Building2 } from "lucide-react";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";

export const Route = createFileRoute("/contact")({
  head: () => ({
    meta: [
      { title: "Contact — PayNOC" },
      {
        name: "description",
        content:
          "Get in touch with the PayNOC team. Enterprise deployments, custom connectors, and partnership inquiries welcome.",
      },
      { property: "og:title", content: "Contact — PayNOC" },
      {
        property: "og:description",
        content: "Reach the PayNOC team for enterprise deployments and custom integrations.",
      },
    ],
  }),
  component: ContactPage,
});

function ContactPage() {
  return (
    <div className="flex min-h-screen flex-col bg-background">
      <SiteHeader />

      <section className="relative overflow-hidden">
        <div className="absolute inset-0 grid-radial opacity-30" />
        <div className="relative mx-auto max-w-4xl px-4 pt-20 pb-16 sm:px-6 lg:px-8">
          <div className="text-center">
            <div className="glass inline-flex items-center gap-2 rounded-full px-4 py-1.5 text-xs font-medium text-foreground shadow-card">
              Contact
            </div>
            <h1 className="mt-6 font-display text-5xl font-bold tracking-tight text-foreground sm:text-6xl">
              Let's <span className="text-gradient-brand">talk</span>
            </h1>
            <p className="mx-auto mt-5 max-w-xl text-lg text-muted-foreground">
              Enterprise deployment, custom gateway connectors, white-label licensing, or general
              questions — the team is here to help.
            </p>
          </div>
        </div>
      </section>

      <section className="pb-24">
        <div className="mx-auto grid max-w-5xl gap-5 px-4 sm:grid-cols-3 sm:px-6 lg:px-8">
          {[
            {
              icon: Mail,
              title: "Email",
              body: "General inquiries and support",
              value: "hello@paynoc.io",
            },
            {
              icon: Building2,
              title: "Enterprise",
              body: "Custom deployments & licensing",
              value: "enterprise@paynoc.io",
            },
            {
              icon: MessageSquare,
              title: "Community",
              body: "Developer chat and updates",
              value: "chat.paynoc.io",
            },
          ].map((c) => (
            <div
              key={c.title}
              className="rounded-2xl border border-border bg-surface p-6 text-center shadow-card"
            >
              <div className="mx-auto flex h-11 w-11 items-center justify-center rounded-xl bg-brand/10 text-brand">
                <c.icon className="h-5 w-5" strokeWidth={2.25} />
              </div>
              <h3 className="mt-5 font-display text-lg font-semibold text-foreground">
                {c.title}
              </h3>
              <p className="mt-1 text-xs text-muted-foreground">{c.body}</p>
              <p className="mt-3 text-sm font-medium text-foreground">{c.value}</p>
            </div>
          ))}
        </div>

        <div className="mx-auto mt-12 max-w-2xl px-4 sm:px-6">
          <div className="glass rounded-3xl p-8 shadow-elevated">
            <h2 className="font-display text-2xl font-semibold text-foreground">
              Send us a message
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Fill in the form and we'll get back within one business day.
            </p>
            <form className="mt-6 space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="text-xs font-medium text-foreground">Name</label>
                  <input
                    type="text"
                    className="mt-1.5 w-full rounded-lg border border-input bg-surface px-3 py-2 text-sm text-foreground shadow-sm outline-none focus:border-brand focus:ring-2 focus:ring-brand/30"
                    placeholder="Your name"
                  />
                </div>
                <div>
                  <label className="text-xs font-medium text-foreground">Email</label>
                  <input
                    type="email"
                    className="mt-1.5 w-full rounded-lg border border-input bg-surface px-3 py-2 text-sm text-foreground shadow-sm outline-none focus:border-brand focus:ring-2 focus:ring-brand/30"
                    placeholder="you@company.com"
                  />
                </div>
              </div>
              <div>
                <label className="text-xs font-medium text-foreground">Company</label>
                <input
                  type="text"
                  className="mt-1.5 w-full rounded-lg border border-input bg-surface px-3 py-2 text-sm text-foreground shadow-sm outline-none focus:border-brand focus:ring-2 focus:ring-brand/30"
                  placeholder="Your company"
                />
              </div>
              <div>
                <label className="text-xs font-medium text-foreground">Message</label>
                <textarea
                  rows={5}
                  className="mt-1.5 w-full resize-none rounded-lg border border-input bg-surface px-3 py-2 text-sm text-foreground shadow-sm outline-none focus:border-brand focus:ring-2 focus:ring-brand/30"
                  placeholder="Tell us what you're building..."
                />
              </div>
              <button
                type="button"
                className="inline-flex w-full items-center justify-center rounded-xl bg-gradient-brand px-4 py-2.5 text-sm font-semibold text-brand-foreground shadow-glow transition-transform hover:scale-[1.01]"
              >
                Send message
              </button>
              <p className="text-center text-[11px] text-muted-foreground">
                Contact form will be wired to the notification system in a later task.
              </p>
            </form>
          </div>
        </div>
      </section>

      <SiteFooter />
    </div>
  );
}
