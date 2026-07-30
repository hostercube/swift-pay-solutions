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
  Globe,
  Menu,
  X,
  Search,
  ChevronDown,
} from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { useActiveMerchant } from "@/hooks/use-active-merchant";
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
      { to: "/domains", label: "Custom domains", icon: Globe, perm: "settings" },
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
  const { merchantId: activeMerchantId } = useActiveMerchant();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const isSuperAdmin = roles.includes("super_admin");
  const perms = useMerchantPerms();
  const [isAdminOffice, setIsAdminOffice] = useState(false);
  const [unread, setUnread] = useState(0);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [profile, setProfile] = useState<{ business_name: string | null; full_name: string | null; avatar_url: string | null } | null>(null);

  useEffect(() => {
    if (!user) { setIsAdminOffice(false); return; }
    supabase.rpc("is_admin_office", { _user_id: user.id }).then(({ data }) => {
      setIsAdminOffice(!!data);
    });
    supabase.from("profiles").select("business_name, full_name, avatar_url").eq("id", user.id).maybeSingle()
      .then(({ data }) => setProfile(data as any));
  }, [user]);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    const load = async () => {
      const { count } = await supabase
        .from("notifications")
        .select("id", { count: "exact", head: true })
        .eq("merchant_id", activeMerchantId ?? user.id)
        .is("read_at", null);
      if (!cancelled) setUnread(count ?? 0);
    };
    load();
    const ch = supabase
      .channel("notif-unread")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "notifications", filter: `merchant_id=eq.${activeMerchantId ?? user.id}` },
        () => load(),
      )
      .subscribe();
    return () => {
      cancelled = true;
      supabase.removeChannel(ch);
    };
  }, [user, activeMerchantId]);

  // Close menus on navigation
  useEffect(() => { setMobileOpen(false); setMenuOpen(false); }, [pathname]);

  const displayName = profile?.business_name || profile?.full_name || user?.email?.split("@")[0] || "Account";
  const initials = (displayName || "A").slice(0, 2).toUpperCase();

  const NavBody = () => (
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
  );

  const Brand = () => (
    <Link to="/dashboard" className="flex h-16 items-center gap-2.5 border-b border-glass-border px-6">
      <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-brand">
        <Shield className="h-4 w-4 text-brand-foreground" strokeWidth={2.5} />
      </span>
      <span className="font-display text-lg font-bold">PayNOC</span>
    </Link>
  );

  return (
    <div className="min-h-screen bg-background">
      <div className="grid-radial absolute inset-0 opacity-30" />
      <div className="relative flex min-h-screen">
        {/* Desktop sidebar */}
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

        {/* Mobile drawer */}
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
          {/* Top bar */}
          <header className="sticky top-0 z-30 flex h-14 items-center gap-3 border-b border-glass-border bg-background/80 px-4 backdrop-blur lg:px-6">
            <button onClick={() => setMobileOpen(true)} className="rounded-lg p-2 text-muted-foreground hover:bg-muted md:hidden">
              <Menu className="h-5 w-5" />
            </button>
            <div className="hidden flex-1 sm:block">
              <form
                className="relative max-w-md"
                onSubmit={(e) => {
                  e.preventDefault();
                  const q = search.trim();
                  if (!q) return;
                  navigate({ to: "/invoices", search: { q } });
                }}
              >
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <input
                  type="search"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search invoices by number, name or email..."
                  className="h-9 w-full rounded-lg border border-glass-border bg-card/60 pl-9 pr-3 text-sm placeholder:text-muted-foreground focus:border-primary/40 focus:outline-none"
                />
              </form>
            </div>
            <div className="ml-auto flex items-center gap-1">
              <Link to="/notifications" className="relative rounded-lg p-2 text-muted-foreground transition hover:bg-muted hover:text-foreground" aria-label="Notifications">
                <Bell className="h-5 w-5" />
                {unread > 0 && (
                  <span className="absolute right-1 top-1 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-brand px-1 text-[10px] font-semibold text-brand-foreground">
                    {unread > 99 ? "99+" : unread}
                  </span>
                )}
              </Link>
              <Link to="/settings" className="rounded-lg p-2 text-muted-foreground transition hover:bg-muted hover:text-foreground" aria-label="Settings">
                <Settings className="h-5 w-5" />
              </Link>
              <div className="relative">
                <button
                  onClick={() => setMenuOpen((o) => !o)}
                  className="ml-1 flex items-center gap-2 rounded-lg border border-glass-border bg-card/60 px-2 py-1.5 text-sm hover:bg-muted"
                >
                  {profile?.avatar_url ? (
                    <img src={profile.avatar_url} alt="" className="h-6 w-6 rounded-full object-cover" />
                  ) : (
                    <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary/15 text-[10px] font-semibold text-primary">{initials}</span>
                  )}
                  <span className="hidden max-w-[140px] truncate sm:inline">{displayName}</span>
                  <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
                </button>
                {menuOpen && (
                  <>
                    <div className="fixed inset-0 z-40" onClick={() => setMenuOpen(false)} />
                    <div className="absolute right-0 top-full z-50 mt-2 w-56 overflow-hidden rounded-xl border border-glass-border bg-card shadow-xl">
                      <div className="border-b border-glass-border p-3">
                        <p className="truncate text-sm font-medium">{displayName}</p>
                        <p className="truncate text-xs text-muted-foreground">{user?.email}</p>
                      </div>
                      <div className="p-1 text-sm">
                        <Link to="/settings" className="flex items-center gap-2 rounded-md px-3 py-2 hover:bg-muted"><Settings className="h-4 w-4" /> Account settings</Link>
                        <Link to="/team" className="flex items-center gap-2 rounded-md px-3 py-2 hover:bg-muted"><Users className="h-4 w-4" /> Team</Link>
                        <Link to="/security" className="flex items-center gap-2 rounded-md px-3 py-2 hover:bg-muted"><ShieldCheck className="h-4 w-4" /> Security</Link>
                        {(isSuperAdmin || isAdminOffice) && (
                          <Link to="/admin" className="flex items-center gap-2 rounded-md px-3 py-2 text-brand hover:bg-brand/10"><Shield className="h-4 w-4" /> Admin panel</Link>
                        )}
                        <button
                          onClick={async () => { await signOut(); navigate({ to: "/auth" }); }}
                          className="mt-1 flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-red-500 hover:bg-red-500/10"
                        >
                          <LogOut className="h-4 w-4" /> Sign out
                        </button>
                      </div>
                    </div>
                  </>
                )}
              </div>
            </div>
          </header>

          <main className="flex-1 px-4 py-8 sm:px-6 lg:px-10">
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
    </div>
  );
}

