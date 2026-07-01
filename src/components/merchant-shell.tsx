import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import type { ReactNode } from "react";
import {
  Shield,
  LayoutDashboard,
  CreditCard,
  Receipt,
  KeyRound,
  Webhook,
  Settings,
  LogOut,
  Users,
} from "lucide-react";
import { useAuth } from "@/hooks/use-auth";

const nav: Array<{ to: string; label: string; icon: typeof LayoutDashboard; exact?: boolean }> = [
  { to: "/dashboard", label: "Overview", icon: LayoutDashboard, exact: true },
  { to: "/invoices", label: "Invoices", icon: Receipt },
  { to: "/transactions", label: "Transactions", icon: CreditCard },
  { to: "/methods", label: "Payment methods", icon: CreditCard },
  { to: "/api-keys", label: "API keys", icon: KeyRound },
  { to: "/webhooks", label: "Webhooks", icon: Webhook },
  { to: "/settings", label: "Settings", icon: Settings },
];

export function MerchantShell({
  title,
  subtitle,
  actions,
  children,
}: {
  title: string;
  subtitle?: string;
  actions?: ReactNode;
  children: ReactNode;
}) {
  const navigate = useNavigate();
  const { signOut, roles } = useAuth();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const isSuperAdmin = roles.includes("super_admin");

  return (
    <div className="min-h-screen bg-background">
      <div className="grid-radial absolute inset-0 opacity-30" />
      <div className="relative flex min-h-screen">
        <aside className="hidden w-64 shrink-0 border-r border-glass-border bg-card/40 backdrop-blur md:flex md:flex-col">
          <div className="flex h-16 items-center gap-2.5 border-b border-glass-border px-6">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-brand">
              <Shield className="h-4 w-4 text-brand-foreground" strokeWidth={2.5} />
            </span>
            <span className="font-display text-lg font-bold">PayNOC</span>
          </div>
          <nav className="flex-1 space-y-1 p-3">
            {nav.map((item) => {
              const active = item.exact ? pathname === item.to : pathname.startsWith(item.to);
              return (
                <Link
                  key={item.to}
                  to={item.to}
                  className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition ${
                    active
                      ? "bg-brand/10 text-foreground"
                      : "text-muted-foreground hover:bg-muted hover:text-foreground"
                  }`}
                >
                  <item.icon className="h-4 w-4" />
                  {item.label}
                </Link>
              );
            })}
            {isSuperAdmin && (
              <>
                <div className="mt-4 px-3 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                  Admin
                </div>
                <Link
                  to="/admin"
                  className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-brand transition hover:bg-brand/10"
                >
                  <Users className="h-4 w-4" />
                  Super Admin Panel
                </Link>
              </>
            )}
          </nav>
          <button
            onClick={async () => {
              await signOut();
              navigate({ to: "/auth" });
            }}
            className="m-3 inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-muted-foreground transition hover:bg-muted hover:text-foreground"
          >
            <LogOut className="h-4 w-4" />
            Sign out
          </button>
        </aside>

        <main className="flex-1 px-6 py-10 lg:px-10">
          <div className="mx-auto max-w-6xl">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <h1 className="font-display text-3xl font-bold tracking-tight text-foreground">
                  {title}
                </h1>
                {subtitle && <p className="mt-2 text-sm text-muted-foreground">{subtitle}</p>}
              </div>
              {actions}
            </div>
            <div className="mt-8">{children}</div>
          </div>
        </main>
      </div>
    </div>
  );
}
