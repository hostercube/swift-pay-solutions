import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ShieldCheck, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export const Route = createFileRoute("/ayman-login")({
  head: () => ({
    meta: [
      { title: "Admin Access · PayNOC" },
      { name: "description", content: "Restricted admin console access." },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  component: AdminLoginPage,
});

async function isAdmin(userId: string): Promise<boolean> {
  const { data } = await supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", userId)
    .in("role", ["super_admin", "admin"]);
  return !!data && data.length > 0;
}

function AdminLoginPage() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const [mfaFactorId, setMfaFactorId] = useState<string | null>(null);
  const [mfaChallengeId, setMfaChallengeId] = useState<string | null>(null);
  const [mfaCode, setMfaCode] = useState("");

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data }) => {
      if (!data.session) return;
      const admin = await isAdmin(data.session.user.id);
      if (!admin) {
        await supabase.auth.signOut();
        return;
      }
      const { data: aal } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
      if (aal?.nextLevel === "aal2" && aal.currentLevel === "aal1") {
        const { data: factors } = await supabase.auth.mfa.listFactors();
        const totp = factors?.totp?.[0];
        if (totp) {
          const { data: chal } = await supabase.auth.mfa.challenge({ factorId: totp.id });
          setMfaFactorId(totp.id);
          setMfaChallengeId(chal?.id ?? null);
          return;
        }
      }
      navigate({ to: "/admin" });
    });
  }, [navigate]);

  async function verifyMfa(e: React.FormEvent) {
    e.preventDefault();
    if (!mfaFactorId || !mfaChallengeId) return;
    setLoading(true);
    const { error } = await supabase.auth.mfa.verify({
      factorId: mfaFactorId,
      challengeId: mfaChallengeId,
      code: mfaCode,
    });
    setLoading(false);
    if (error) return toast.error(error.message);
    navigate({ to: "/admin" });
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      const { data, error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;
      if (!data.user) throw new Error("Sign-in failed");

      const admin = await isAdmin(data.user.id);
      if (!admin) {
        await supabase.auth.signOut();
        throw new Error("This account is not authorized for admin access.");
      }

      const { data: aal } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
      if (aal?.nextLevel === "aal2" && aal.currentLevel === "aal1") {
        const { data: factors } = await supabase.auth.mfa.listFactors();
        const totp = factors?.totp?.[0];
        if (totp) {
          const { data: chal, error: cErr } = await supabase.auth.mfa.challenge({
            factorId: totp.id,
          });
          if (cErr) throw cErr;
          setMfaFactorId(totp.id);
          setMfaChallengeId(chal.id);
          toast.info("Enter your 2FA code");
          return;
        }
      }

      toast.success("Welcome, admin");
      navigate({ to: "/admin" });
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Access denied";
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  }

  const showMfa = !!mfaChallengeId;

  return (
    <div className="relative min-h-screen bg-background">
      <div className="grid-radial absolute inset-0 opacity-40" />
      <div className="relative mx-auto flex min-h-screen max-w-md flex-col justify-center px-6 py-12">
        <Link to="/" className="mb-8 flex items-center gap-2.5">
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-brand shadow-glow">
            <ShieldCheck className="h-5 w-5 text-brand-foreground" strokeWidth={2.5} />
          </span>
          <span className="font-display text-xl font-bold">PayNOC Admin</span>
        </Link>

        <div className="glass rounded-2xl border border-glass-border p-8">
          {showMfa ? (
            <>
              <h1 className="font-display text-2xl font-bold text-foreground">Two-factor code</h1>
              <p className="mt-1 text-sm text-muted-foreground">
                Enter the 6-digit code from your authenticator.
              </p>
              <form onSubmit={verifyMfa} className="mt-6 space-y-4">
                <Field
                  label="Authentication code"
                  value={mfaCode}
                  onChange={setMfaCode}
                  required
                  minLength={6}
                />
                <button
                  type="submit"
                  disabled={loading || mfaCode.length < 6}
                  className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-gradient-brand px-4 py-2.5 text-sm font-semibold text-brand-foreground shadow-glow disabled:opacity-60"
                >
                  {loading && <Loader2 className="h-4 w-4 animate-spin" />}
                  Verify
                </button>
                <button
                  type="button"
                  onClick={async () => {
                    await supabase.auth.signOut();
                    setMfaChallengeId(null);
                    setMfaFactorId(null);
                    setMfaCode("");
                  }}
                  className="w-full text-center text-xs text-muted-foreground hover:underline"
                >
                  Cancel and sign out
                </button>
              </form>
            </>
          ) : (
            <>
              <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-glass-border bg-background/40 px-3 py-1 text-xs font-medium text-muted-foreground">
                <ShieldCheck className="h-3.5 w-3.5" /> Restricted area
              </div>
              <h1 className="font-display text-2xl font-bold text-foreground">
                Admin console access
              </h1>
              <p className="mt-1 text-sm text-muted-foreground">
                Merchants — please use the{" "}
                <Link to="/auth" className="underline hover:text-foreground">
                  merchant sign-in
                </Link>{" "}
                page.
              </p>

              <form onSubmit={onSubmit} className="mt-6 space-y-4">
                <Field
                  label="Admin email"
                  type="email"
                  value={email}
                  onChange={setEmail}
                  required
                />
                <Field
                  label="Password"
                  type="password"
                  value={password}
                  onChange={setPassword}
                  required
                  minLength={8}
                />
                <button
                  type="submit"
                  disabled={loading}
                  className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-gradient-brand px-4 py-2.5 text-sm font-semibold text-brand-foreground shadow-glow disabled:opacity-60"
                >
                  {loading && <Loader2 className="h-4 w-4 animate-spin" />}
                  Sign in to admin
                </button>
              </form>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  type = "text",
  required,
  minLength,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
  required?: boolean;
  minLength?: number;
}) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-xs font-medium uppercase tracking-wider text-muted-foreground">
        {label}
      </span>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        required={required}
        minLength={minLength}
        className="w-full rounded-lg border border-glass-border bg-background/40 px-3 py-2.5 text-sm text-foreground outline-none transition focus:border-brand focus:ring-2 focus:ring-brand/30"
      />
    </label>
  );
}
