import { Link, useRouterState } from "@tanstack/react-router";
import { Bell, Mail, Settings2 } from "lucide-react";

const TABS: Array<{ to: string; label: string; icon: typeof Bell; exact?: boolean }> = [
  { to: "/notifications", label: "Inbox", icon: Bell, exact: true },
  { to: "/notifications/settings", label: "Settings", icon: Settings2 },
  { to: "/notifications/digest", label: "Email digest", icon: Mail },
];

export function NotificationsTabs() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  return (
    <div className="mb-6 flex flex-wrap gap-1 border-b border-glass-border">
      {TABS.map((t) => {
        const active = t.exact ? pathname === t.to : pathname.startsWith(t.to);
        return (
          <Link
            key={t.to}
            to={t.to as "/notifications"}
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
