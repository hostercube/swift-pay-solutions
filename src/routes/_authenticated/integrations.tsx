import { createFileRoute, Link, Outlet, useRouterState } from "@tanstack/react-router";
import { CreditCard, Plug, Code2, MessageSquare } from "lucide-react";
import { MerchantShell } from "@/components/merchant-shell";

export const Route = createFileRoute("/_authenticated/integrations")({
  component: IntegrationsLayout,
});

const TABS = [
  { to: "/integrations", label: "Manual channels", icon: CreditCard, exact: true },
  { to: "/integrations/byo", label: "Auto gateways (API)", icon: Plug },
  { to: "/integrations/api", label: "API / Embed", icon: Code2 },
  { to: "/integrations/smsnoc", label: "SMS NOC", icon: MessageSquare },
];

function IntegrationsLayout() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  return (
    <MerchantShell
      title="Payment integrations"
      subtitle="Manual channels, auto gateways, embed and SMS NOC — all in one place."
    >
      <div className="mb-6 flex flex-wrap gap-1 border-b border-glass-border">
        {TABS.map((t) => {
          const active = (t as { exact?: boolean }).exact ? pathname === t.to : pathname.startsWith(t.to);
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
    </MerchantShell>
  );
}
