import { createFileRoute, Link, Outlet, useRouterState } from "@tanstack/react-router";
import { CreditCard, Plug, Code2 } from "lucide-react";

export const Route = createFileRoute("/_authenticated/integrations")({
  component: IntegrationsLayout,
});

const TABS = [
  { to: "/integrations", label: "Payment methods", icon: CreditCard, exact: true },
  { to: "/integrations/byo", label: "BYO Gateways", icon: Plug },
  { to: "/integrations/api", label: "API / Embed", icon: Code2 },
] as const;

function IntegrationsLayout() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  return (
    <div className="mx-auto max-w-6xl p-4 md:p-6">
      <h1 className="font-display text-2xl font-bold mb-4">Payment integrations</h1>
      <div className="mb-6 flex flex-wrap gap-1 border-b border-glass-border">
        {TABS.map((t) => {
          const active = t.exact ? pathname === t.to : pathname.startsWith(t.to);
          return (
            <Link
              key={t.to}
              to={t.to}
              className={`inline-flex items-center gap-2 px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
                active
                  ? "border-brand text-foreground"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              }`}
            >
              <t.icon className="h-4 w-4" />
              {t.label}
            </Link>
          );
        })}
      </div>
      <Outlet />
    </div>
  );
}
