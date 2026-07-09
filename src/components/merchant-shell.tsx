import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { useEffect, useState, type ReactNode } from "react";
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
  Bell,
  BarChart3,
  Lock,
  Wallet,
  ShieldAlert,
  ShieldCheck,
  BookOpen,
  Plug,
  Rocket,
  Repeat,
  Tag,
  Gavel,
  Mail,
  CalendarClock,
  Code2,
} from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";
import { useMerchantPerms } from "@/hooks/use-merchant-perms";
import type { MerchantPerm } from "@/lib/permissions";

type NavItem = { to: string; label: string; icon: typeof LayoutDashboard; exact?: boolean; perm?: MerchantPerm };
type NavGroup = { label: string; items: NavItem[] };

const navGroups: NavGroup[] = [
  {
    label: "Overview",
    items: [
      { to: "/onboarding", label: "Get started", icon: Rocket },
      { to: "/dashboard", label: "Overview", icon: LayoutDashboard, exact: true },
      { to: "/reports", label: "Reports", icon: BarChart3, perm: "reports" },
    ],
  },
  {
    label: "Payments",
    items: [
      { to: "/transactions", label: "Transactions", icon: CreditCard, perm: "transactions" },
      { to: "/invoices", label: "Invoices", icon: Receipt, perm: "invoices" },
      { to: "/recurring", label: "Recurring", icon: Repeat, perm: "invoices" },
      { to: "/discounts", label: "Discount codes", icon: Tag, perm: "invoices" },
      { to: "/refunds", label: "Refunds", icon: Receipt, perm: "refunds" },
      { to: "/disputes", label: "Disputes", icon: Gavel, perm: "disputes" },
    ],
  },
  {
    label: "Money",
    items: [
      { to: "/payouts", label: "Payouts", icon: Wallet, perm: "payouts" },
      { to: "/payout-schedule", label: "Auto payout", icon: CalendarClock, perm: "payouts" },
      { to: "/fx", label: "Currency rates", icon: BarChart3, perm: "settings" },
    ],
  },
  {
    label: "Integrations",
    items: [
      { to: "/integrations", label: "Payment integrations", icon: CreditCard, perm: "methods" },
    ],
  },
  {
    label: "Developers",
    items: [
      { to: "/api-logs", label: "API logs", icon: BookOpen, perm: "api_keys" },
      { to: "/webhooks", label: "Webhooks", icon: Webhook, perm: "webhooks" },
      { to: "/docs", label: "API reference", icon: BookOpen },
    ],
  },
  {
    label: "Security",
    items: [
      { to: "/security", label: "Security", icon: ShieldCheck, perm: "settings" },
      { to: "/kyc", label: "Verification (KYC)", icon: ShieldCheck },
    ],
  },
  {
    label: "Workspace",
    items: [
      { to: "/team", label: "Team", icon: Users, perm: "team" },
      { to: "/notifications", label: "Notifications", icon: Bell },

      { to: "/marketing", label: "Marketing & SEO", icon: BarChart3, perm: "settings" },
      { to: "/settings", label: "Settings", icon: Settings, perm: "settings" },
    ],
  },
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
  const { signOut, roles, user } = useAuth();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const isSuperAdmin = roles.includes("super_admin");
  const perms = useMerchantPerms();
  const [isAdminOffice, setIsAdminOffice] = useState(false);
  const [unread, setUnread] = useState(0);

  useEffect(() => {
    if (!user) { setIsAdminOffice(false); return; }
    supabase.rpc("is_admin_office", { _user_id: user.id }).then(({ data }) => {
      setIsAdminOffice(!!data);
    });
  }, [user]);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    const load = async () => {
      const { count } = await supabase
        .from("notifications")
        .select("id", { count: "exact", head: true })
        .is("read_at", null);
      if (!cancelled) setUnread(count ?? 0);
    };
    load();
    const ch = supabase
      .channel("notif-unread")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "notifications", filter: `merchant_id=eq.${user.id}` },
        () => load(),
      )
      .subscribe();
    return () => {
      cancelled = true;
      supabase.removeChannel(ch);
    };
  }, [user]);

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
          <nav className="flex-1 space-y-4 overflow-y-auto p-3">
            {navGroups.map((group) => {
              const items = group.items.filter((item) => !item.perm || perms.has(item.perm));
              if (items.length === 0) return null;
              return (
                <div key={group.label}>
                  <p className="mb-1 px-3 text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                    {group.label}
                  </p>
                  <div className="space-y-1">
                    {items.map((item) => {
                      const active = item.exact ? pathname === item.to : pathname.startsWith(item.to);
                      const showBadge = item.to === "/notifications" && unread > 0;
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
                          <span className="flex-1">{item.label}</span>
                          {showBadge && (
                            <span className="rounded-full bg-brand px-1.5 py-0.5 text-[10px] font-semibold text-brand-foreground">
                              {unread}
                            </span>
                          )}
                        </Link>
                      );
                    })}
                  </div>
                </div>
              );
            })}
            {(isSuperAdmin || isAdminOffice) && (
              <div>
                <p className="mb-1 px-3 text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                  Admin
                </p>
                <Link
                  to="/admin"
                  className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-brand transition hover:bg-brand/10"
                >
                  <Users className="h-4 w-4" />
                  {isSuperAdmin ? "Super Admin Panel" : "Admin Panel"}
                </Link>
              </div>
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
