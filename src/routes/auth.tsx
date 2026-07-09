import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Shield, Loader2, ArrowLeft } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Turnstile } from "@/components/turnstile";
import { getTurnstileConfig, verifyTurnstile } from "@/lib/turnstile.functions";
import { smsNocNotifyUserRegistered } from "@/lib/smsnoc.functions";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "Sign in · PayNOC" },
      { name: "description", content: "Sign in or create your PayNOC merchant account." },
    ],
  }),
  component: AuthPage,
});

async function isAdminUser(userId: string): Promise<boolean> {
  const { data } = await supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", userId)
    .in("role", ["super_admin", "admin"]);
  return !!data && data.length > 0;
}

type Mode = "signin" | "signup";

function AuthPage() {
  const navigate = useNavigate();
  const [mode, setMode] = useState<Mode>("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [businessName, setBusinessName] = useState("");
  const [loading, setLoading] = useState(false);

  const [captcha, setCaptcha] = useState<{ enabled: boolean; siteKey: string } | null>(null);
  const [captchaToken, setCaptchaToken] = useState<string | null>(null);

  const [mfaFactorId, setMfaFactorId] = useState<string | null>(null);
  const [mfaChallengeId, setMfaChallengeId] = useState<string | null>(null);
  const [mfaCode, setMfaCode] = useState("");

  useEffect(() => {
    getTurnstileConfig()
      .then(setCaptcha)
      .catch((e) => {
        console.error("[turnstile] getTurnstileConfig failed:", e);
        setCaptcha({ enabled: false, siteKey: "" });
      });
  }, []);

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data }) => {
      if (!data.session) return;
      if (await isAdminUser(data.session.user.id)) {
        await supabase.auth.signOut();
        toast.info("Admins must sign in from the admin portal.");
        navigate({ to: "/ayman-login" });
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
      navigate({ to: "/dashboard" });
    });
  }, [navigate]);

  async function landingForMerchant(userId: string): Promise<"/ayman-login" | "/dashboard"> {
    // Admins are never allowed through the merchant/staff login.
    return (await isAdminUser(userId)) ? "/ayman-login" : "/dashboard";
  }


  async function checkCaptcha(): Promise<boolean> {
    if (!captcha?.enabled) return true;
    if (!captchaToken) {
      toast.error("Please complete the captcha");
      return false;
    }
    const res = await verifyTurnstile({ data: { token: captchaToken } });
    if (!res.ok) {
      toast.error("Captcha verification failed");
      return false;
    }
    return true;
  }

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
    toast.success("Verified");
    const { data: u } = await supabase.auth.getUser();
    navigate({ to: u.user ? await landingForMerchant(u.user.id) : "/dashboard" });
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      if (!(await checkCaptcha())) {
        setLoading(false);
        return;
      }
      if (mode === "signup") {
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: `${window.location.origin}/dashboard`,
            data: { full_name: fullName, business_name: businessName },
          },
        });
        if (error) throw error;
        toast.success("Account created! You're signed in.");
        navigate({ to: "/dashboard" });
      } else {
        const { data: sd, error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;

        const { data: aal } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
        if (aal?.nextLevel === "aal2" && aal.currentLevel === "aal1") {
          const { data: factors } = await supabase.auth.mfa.listFactors();
          const totp = factors?.totp?.[0];
          if (totp) {
            const { data: chal, error: cErr } = await supabase.auth.mfa.challenge({ factorId: totp.id });
            if (cErr) throw cErr;
            setMfaFactorId(totp.id);
            setMfaChallengeId(chal.id);
            toast.info("Enter your 2FA code");
            return;
          }
        }

        toast.success("Welcome back");
        navigate({ to: sd.user ? await landingForMerchant(sd.user.id) : "/dashboard" });
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Authentication failed";
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
        <div className="mb-6 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2.5">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-brand shadow-glow">
              <Shield className="h-5 w-5 text-brand-foreground" strokeWidth={2.5} />
            </span>
            <span className="font-display text-xl font-bold">PayNOC</span>
          </Link>
          <Link
            to="/"
            className="inline-flex items-center gap-1.5 rounded-lg border border-glass-border bg-card/40 px-3 py-1.5 text-xs font-medium text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Back to home
          </Link>
        </div>

        <div className="glass rounded-2xl border border-glass-border p-8">
          {showMfa ? (
            <>
              <h1 className="font-display text-2xl font-bold text-foreground">Two-factor code</h1>
              <p className="mt-1 text-sm text-muted-foreground">
                Open your authenticator app and enter the 6-digit code.
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
              <h1 className="font-display text-2xl font-bold text-foreground">
                {mode === "signin" ? "Sign in" : "Create your merchant account"}
              </h1>
              <p className="mt-1 text-sm text-muted-foreground">
                {mode === "signin"
                  ? "Access your PayNOC dashboard."
                  : "Start accepting payments in minutes."}
              </p>

              <form onSubmit={onSubmit} className="mt-6 space-y-4">
                {mode === "signup" && (
                  <>
                    <Field label="Full name" value={fullName} onChange={setFullName} required />
                    <Field label="Business name" value={businessName} onChange={setBusinessName} required />
                  </>
                )}
                <Field label="Email" type="email" value={email} onChange={setEmail} required />
                <Field
                  label="Password"
                  type="password"
                  value={password}
                  onChange={setPassword}
                  required
                  minLength={8}
                />

                {mode === "signin" && (
                  <div className="text-right">
                    <Link to="/forgot-password" className="text-xs text-brand hover:underline">
                      Forgot password?
                    </Link>
                  </div>
                )}

                {captcha?.enabled && captcha.siteKey && (
                  <Turnstile siteKey={captcha.siteKey} onToken={setCaptchaToken} />
                )}

                <button
                  type="submit"
                  disabled={loading}
                  className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-gradient-brand px-4 py-2.5 text-sm font-semibold text-brand-foreground shadow-glow transition-transform hover:scale-[1.01] disabled:opacity-60"
                >
                  {loading && <Loader2 className="h-4 w-4 animate-spin" />}
                  {mode === "signin" ? "Sign in" : "Create account"}
                </button>
              </form>

              <div className="mt-6 text-center text-sm text-muted-foreground">
                {mode === "signin" ? (
                  <>
                    No account?{" "}
                    <button
                      className="font-semibold text-foreground hover:underline"
                      onClick={() => setMode("signup")}
                    >
                      Sign up
                    </button>
                  </>
                ) : (
                  <>
                    Already registered?{" "}
                    <button
                      className="font-semibold text-foreground hover:underline"
                      onClick={() => setMode("signin")}
                    >
                      Sign in
                    </button>
                  </>
                )}
              </div>
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
