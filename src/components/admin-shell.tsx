import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import {
  Shield, LayoutDashboard, Users, Settings, ScrollText, LogOut, ArrowLeft,
  DollarSign, UserCog, ShieldCheck, Plug, Package,
  Receipt, ArrowRightLeft, Megaphone, MessageSquare, Menu, X,
} from "lucide-react";
import { useState, type ReactNode } from "react";
import { useAuth } from "@/hooks/use-auth";

const navGroups: Array<{ label: string; items: Array<{ to: string; label: string; icon: typeof LayoutDashboard; exact?: boolean }> }> = [
  {
    label: "Overview",
    items: [
      { to: "/admin", label: "Dashboard", icon: LayoutDashboard, exact: true },
    ],
  },
  {
    label: "Merchants",
    items: [
      { to: "/admin/merchants", label: "Merchants", icon: Users },
      { to: "/admin/kyc", label: "KYC review", icon: ShieldCheck },
    ],
  },
  {
    label: "Money movement",
    items: [
      { to: "/admin/transactions", label: "Transactions", icon: ArrowRightLeft },
      { to: "/admin/invoices", label: "Invoices", icon: Receipt },
      { to: "/admin/fx", label: "FX rates", icon: DollarSign },
    ],
  },
  {
    label: "Platform Ops",
    items: [
      { to: "/admin/platform", label: "Platform Ops", icon: Plug },
      { to: "/admin/packages", label: "Packages", icon: Package },
    ],
  },
  {
    label: "Team & comms",
    items: [
      { to: "/admin/staff", label: "Admin staff", icon: UserCog },
      { to: "/admin/broadcast", label: "Broadcast", icon: Megaphone },
    ],
  },
  {
    label: "System",
    items: [
      { to: "/admin/settings", label: "Platform settings", icon: Settings },
      { to: "/admin/smsnoc", label: "SMS NOC", icon: MessageSquare },
      { to: "/admin/sms-events", label: "SMS events", icon: MessageSquare },
      { to: "/admin/audit", label: "Audit logs", icon: ScrollText },
    ],
  },
];

export function AdminShell({ title, subtitle, children }: { title: string; subtitle?: string; children: ReactNode }) {
  const navigate = useNavigate();
  const { signOut } = useAuth();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const [mobileOpen, setMobileOpen] = useState(false);

  const Brand = () => (
    <div className="flex h-16 items-center gap-2.5 border-b border-glass-border px-6">
      <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-brand">
        <Shield className="h-4 w-4 text-brand-foreground" strokeWidth={2.5} />
      </span>
      <div className="leading-tight">
        <div className="font-display text-sm font-bold">PayNOC</div>
        <div className="text-[10px] uppercase tracking-wider text-brand">Super Admin</div>
      </div>
    </div>
  );

  const NavBody = () => (
    <nav className="flex-1 space-y-4 overflow-y-auto p-3">
      {navGroups.map((g) => (
        <div key={g.label}>
          <p className="mb-1 px-3 text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">{g.label}</p>
          <div className="space-y-1">
            {g.items.map((item) => {
              const active = item.exact ? pathname === item.to : pathname.startsWith(item.to);
              return (
                <Link
                  key={item.to}
                  to={item.to}
                  onClick={() => setMobileOpen(false)}
                  className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition ${
                    active ? "bg-brand/10 text-foreground" : "text-muted-foreground hover:bg-muted hover:text-foreground"
                  }`}
                >
                  <item.icon className="h-4 w-4" />
                  {item.label}
                </Link>
              );
            })}
          </div>
        </div>
      ))}
      <Link
        to="/dashboard"
        onClick={() => setMobileOpen(false)}
        className="mt-4 flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-muted-foreground transition hover:bg-muted hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" />
        Merchant view
      </Link>
    </nav>
  );

  return (
    <div className="min-h-screen bg-background">
      <div className="grid-radial absolute inset-0 opacity-30" />
      <div className="relative flex min-h-screen">
        <aside className="hidden w-64 shrink-0 border-r border-glass-border bg-card/40 backdrop-blur md:flex md:flex-col">
          <Brand />
          <NavBody />
          <button
            onClick={async () => { await signOut(); navigate({ to: "/auth" }); }}
            className="m-3 inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-muted-foreground transition hover:bg-muted hover:text-foreground"
          >
            <LogOut className="h-4 w-4" />
            Sign out
          </button>
        </aside>

        {mobileOpen && (
          <div className="fixed inset-0 z-50 md:hidden">
            <div className="absolute inset-0 bg-background/70 backdrop-blur-sm" onClick={() => setMobileOpen(false)} />
            <aside className="absolute inset-y-0 left-0 flex w-72 flex-col border-r border-glass-border bg-card shadow-xl">
              <div className="flex items-center justify-between border-b border-glass-border pr-3">
                <Brand />
                <button onClick={() => setMobileOpen(false)} className="rounded-lg p-2 text-muted-foreground hover:bg-muted">
                  <X className="h-5 w-5" />
                </button>
              </div>
              <NavBody />
              <button
                onClick={async () => { await signOut(); navigate({ to: "/auth" }); }}
                className="m-3 inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-muted-foreground transition hover:bg-muted hover:text-foreground"
              >
                <LogOut className="h-4 w-4" />
                Sign out
              </button>
            </aside>
          </div>
        )}

        <div className="flex min-w-0 flex-1 flex-col">
          <header className="sticky top-0 z-30 flex h-14 items-center gap-3 border-b border-glass-border bg-background/80 px-4 backdrop-blur md:hidden">
            <button onClick={() => setMobileOpen(true)} className="rounded-lg p-2 text-muted-foreground hover:bg-muted" aria-label="Open menu">
              <Menu className="h-5 w-5" />
            </button>
            <div className="flex items-center gap-2">
              <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-gradient-brand">
                <Shield className="h-4 w-4 text-brand-foreground" strokeWidth={2.5} />
              </span>
              <span className="font-display text-sm font-bold">PayNOC Admin</span>
            </div>
          </header>

          <main className="flex-1 px-4 py-8 sm:px-6 lg:px-10">
            <div className="mx-auto max-w-6xl">
              <div className="min-w-0">
                <p className="text-xs font-semibold uppercase tracking-wider text-brand">Super Admin</p>
                <h1 className="mt-1 font-display text-2xl font-bold tracking-tight text-foreground sm:text-3xl">{title}</h1>
                {subtitle && <p className="mt-2 text-sm text-muted-foreground">{subtitle}</p>}
              </div>
              <div className="mt-8">{children}</div>
            </div>
          </main>
        </div>
      </div>
    </div>
  );
}
