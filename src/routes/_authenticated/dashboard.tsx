import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import {
  LayoutDashboard,
  CreditCard,
  Wallet,
  Settings,
  Shield,
  LogOut,
  Users,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";

export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => ({
    meta: [{ title: "Dashboard · PayNOC" }],
  }),
  component: DashboardPage,
});

type Profile = {
  full_name: string | null;
  business_name: string | null;
  email: string;
  status: string;
};

function DashboardPage() {
  const navigate = useNavigate();
  const { user, roles, signOut } = useAuth();
  const [profile, setProfile] = useState<Profile | null>(null);

  useEffect(() => {
    if (!user) return;
    supabase
      .from("profiles")
      .select("full_name, business_name, email, status")
      .eq("id", user.id)
      .maybeSingle()
      .then(({ data }) => setProfile(data as Profile | null));
  }, [user]);

  const isSuperAdmin = roles.includes("super_admin");

  async function handleSignOut() {
    await signOut();
    navigate({ to: "/auth" });
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="grid-radial absolute inset-0 opacity-30" />
      <div className="relative flex min-h-screen">
        {/* Sidebar */}
        <aside className="hidden w-64 shrink-0 border-r border-glass-border bg-card/40 backdrop-blur md:flex md:flex-col">
          <div className="flex h-16 items-center gap-2.5 border-b border-glass-border px-6">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-brand">
              <Shield className="h-4 w-4 text-brand-foreground" strokeWidth={2.5} />
            </span>
            <span className="font-display text-lg font-bold">PayNOC</span>
          </div>
          <nav className="flex-1 space-y-1 p-3">
            <NavItem icon={LayoutDashboard} label="Overview" active />
            <NavItem icon={CreditCard} label="Transactions" />
            <NavItem icon={Wallet} label="Payouts" />
            <NavItem icon={Settings} label="Settings" />
            {isSuperAdmin && (
              <>
                <div className="mt-4 px-3 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                  Admin
                </div>
                <Link
                  to="/admin"
                  className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-brand transition hover:bg-brand/10"
                >
                  <Users className="h-4 w-4" />
                  Super Admin Panel
                </Link>
              </>
            )}
          </nav>
          <button
            onClick={handleSignOut}
            className="m-3 inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-muted-foreground transition hover:bg-muted hover:text-foreground"
          >
            <LogOut className="h-4 w-4" />
            Sign out
          </button>
        </aside>

        {/* Main */}
        <main className="flex-1 px-6 py-10 lg:px-10">
          <div className="mx-auto max-w-6xl">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-sm text-muted-foreground">
                  Welcome back
                </p>
                <h1 className="font-display text-3xl font-bold tracking-tight text-foreground">
                  {profile?.business_name || profile?.full_name || "Merchant"}
                </h1>
                <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
                  {roles.map((r) => (
                    <span
                      key={r}
                      className="rounded-full border border-glass-border bg-card/60 px-2.5 py-1 font-medium uppercase tracking-wider text-muted-foreground"
                    >
                      {r.replace("_", " ")}
                    </span>
                  ))}
                  {profile?.status && (
                    <span className="rounded-full bg-brand/10 px-2.5 py-1 font-medium uppercase tracking-wider text-brand">
                      {profile.status}
                    </span>
                  )}
                </div>
              </div>
              <Link
                to="/"
                className="hidden rounded-lg border border-glass-border px-3 py-2 text-sm text-muted-foreground hover:text-foreground md:inline-flex"
              >
                View site
              </Link>
            </div>

            <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <StatCard label="Total volume" value="৳ 0" hint="This month" />
              <StatCard label="Successful payments" value="0" hint="Last 30 days" />
              <StatCard label="Pending payouts" value="৳ 0" hint="Awaiting settlement" />
            </div>

            <div className="mt-8 glass rounded-2xl border border-glass-border p-8">
              <h2 className="font-display text-lg font-semibold">Get started</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Your merchant account is ready. Next steps: configure payment methods,
                generate API keys, and integrate checkout.
              </p>
              <p className="mt-4 text-xs text-muted-foreground">
                Coming next in your dashboard — payment method manager, API keys, and
                webhook configuration.
              </p>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}

function NavItem({
  icon: Icon,
  label,
  active,
}: {
  icon: typeof LayoutDashboard;
  label: string;
  active?: boolean;
}) {
  return (
    <button
      className={`flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition ${
        active
          ? "bg-brand/10 text-foreground"
          : "text-muted-foreground hover:bg-muted hover:text-foreground"
      }`}
    >
      <Icon className="h-4 w-4" />
      {label}
    </button>
  );
}

function StatCard({ label, value, hint }: { label: string; value: string; hint: string }) {
  return (
    <div className="glass rounded-2xl border border-glass-border p-6">
      <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
        {label}
      </p>
      <p className="mt-2 font-display text-3xl font-bold text-foreground">{value}</p>
      <p className="mt-1 text-xs text-muted-foreground">{hint}</p>
    </div>
  );
}
