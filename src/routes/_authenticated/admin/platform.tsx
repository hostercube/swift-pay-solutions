import { createFileRoute, Link, Outlet, useRouterState } from "@tanstack/react-router";
import { Plug, Package, Webhook, Activity } from "lucide-react";

export const Route = createFileRoute("/_authenticated/admin/platform")({
  component: PlatformLayout,
});

const TABS = [
  { to: "/admin/platform", label: "Gateways", icon: Plug, exact: true },
  { to: "/admin/platform/plugins", label: "Plugins & SDKs", icon: Package },
  { to: "/admin/platform/webhooks", label: "Webhook health", icon: Webhook },
  { to: "/admin/platform/incidents", label: "Incidents", icon: Activity },
];

function PlatformLayout() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  return (
    <div className="mx-auto max-w-6xl p-4 md:p-6">
      <h1 className="font-display text-2xl font-bold mb-4">Platform Ops</h1>
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
    </div>
  );
}
