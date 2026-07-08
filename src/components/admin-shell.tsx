import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { Shield, LayoutDashboard, Users, Settings, ScrollText, LogOut, ArrowLeft, Wallet, DollarSign, Activity, UserCog, ShieldCheck, Plug } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import type { ReactNode } from "react";

const nav: Array<{ to: string; label: string; icon: typeof LayoutDashboard; exact?: boolean }> = [
  { to: "/admin", label: "Overview", icon: LayoutDashboard, exact: true },
  { to: "/admin/merchants", label: "Merchants", icon: Users },
  { to: "/admin/kyc", label: "KYC review", icon: ShieldCheck },
  { to: "/admin/staff", label: "Staff", icon: UserCog },
  { to: "/admin/platform-gateways", label: "Platform gateways", icon: Plug },
  { to: "/admin/payouts", label: "Payouts", icon: Wallet },
  { to: "/admin/fx", label: "FX rates", icon: DollarSign },
  { to: "/admin/incidents", label: "Incidents", icon: Activity },
  { to: "/admin/settings", label: "Platform", icon: Settings },
  { to: "/admin/audit", label: "Audit logs", icon: ScrollText },
];



export function AdminShell({ title, subtitle, children }: { title: string; subtitle?: string; children: ReactNode }) {
  const navigate = useNavigate();
  const { signOut } = useAuth();
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  return (
    <div className="min-h-screen bg-background">
      <div className="grid-radial absolute inset-0 opacity-30" />
      <div className="relative flex min-h-screen">
        <aside className="hidden w-64 shrink-0 border-r border-glass-border bg-card/40 backdrop-blur md:flex md:flex-col">
          <div className="flex h-16 items-center gap-2.5 border-b border-glass-border px-6">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-brand">
              <Shield className="h-4 w-4 text-brand-foreground" strokeWidth={2.5} />
            </span>
            <div className="leading-tight">
              <div className="font-display text-sm font-bold">PayNOC</div>
              <div className="text-[10px] uppercase tracking-wider text-brand">Super Admin</div>
            </div>
          </div>
          <nav className="flex-1 space-y-1 p-3">
            {nav.map((item) => {
              const active = item.exact ? pathname === item.to : pathname.startsWith(item.to);
              return (
                <Link
                  key={item.to}
                  to={item.to}
                  className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition ${
                    active ? "bg-brand/10 text-foreground" : "text-muted-foreground hover:bg-muted hover:text-foreground"
                  }`}
                >
                  <item.icon className="h-4 w-4" />
                  {item.label}
                </Link>
              );
            })}
            <Link
              to="/dashboard"
              className="mt-4 flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-muted-foreground transition hover:bg-muted hover:text-foreground"
            >
              <ArrowLeft className="h-4 w-4" />
              Merchant view
            </Link>
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
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-brand">Super Admin</p>
              <h1 className="mt-1 font-display text-3xl font-bold tracking-tight text-foreground">{title}</h1>
              {subtitle && <p className="mt-2 text-sm text-muted-foreground">{subtitle}</p>}
            </div>
            <div className="mt-8">{children}</div>
          </div>
        </main>
      </div>
    </div>
  );
}
