import { Link, useRouterState } from "@tanstack/react-router";
import { Plug, Package, Webhook, Activity, Power } from "lucide-react";

const TABS = [
  { to: "/admin/platform", label: "Gateways", icon: Plug, exact: true },
  { to: "/admin/platform/providers", label: "Provider toggles", icon: Power },
  { to: "/admin/platform/plugins", label: "Plugins & SDKs", icon: Package },
  { to: "/admin/platform/webhooks", label: "Webhook health", icon: Webhook },
  { to: "/admin/platform/incidents", label: "Incidents", icon: Activity },
] as const;

export function PlatformTabs() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  return (
    <div className="mb-6 flex flex-wrap gap-1 border-b border-glass-border">
      {TABS.map((t) => {
        const active = "exact" in t && t.exact ? pathname === t.to : pathname.startsWith(t.to);
        return (
          <Link
            key={t.to}
            to={t.to as "/admin/platform"}
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
  );
}
