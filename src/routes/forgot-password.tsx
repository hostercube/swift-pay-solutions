import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Shield, Loader2, ArrowLeft } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Turnstile } from "@/components/turnstile";
import { getTurnstileConfig, verifyTurnstile } from "@/lib/turnstile.functions";
import { smsNocNotifyPasswordReset } from "@/lib/smsnoc.functions";

export const Route = createFileRoute("/forgot-password")({
  head: () => ({
    meta: [
      { title: "Reset password · PayNOC" },
      { name: "description", content: "Request a password reset link for your PayNOC account." },
    ],
  }),
  component: ForgotPasswordPage,
});

function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [captcha, setCaptcha] = useState<{ enabled: boolean; siteKey: string } | null>(null);
  const [captchaToken, setCaptchaToken] = useState<string | null>(null);

  useEffect(() => {
    getTurnstileConfig()
      .then(setCaptcha)
      .catch((e) => {
        console.error("[turnstile] getTurnstileConfig failed:", e);
        setCaptcha({ enabled: false, siteKey: "" });
      });
  }, []);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      if (captcha?.enabled) {
        if (!captchaToken) {
          toast.error("Please complete the captcha");
          setLoading(false);
          return;
        }
        const v = await verifyTurnstile({ data: { token: captchaToken } });
        if (!v.ok) {
          toast.error("Captcha verification failed");
          setLoading(false);
          return;
        }
      }
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/reset-password`,
      });
      if (error) throw error;
      smsNocNotifyPasswordReset({
        data: {
          email,
          resetLink: `${window.location.origin}/reset-password`,
        },
      }).catch(() => undefined);
      setSent(true);
      toast.success("Reset link sent — check your inbox");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  }

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
          <h1 className="font-display text-2xl font-bold text-foreground">Forgot password</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Enter your email and we'll send you a link to reset your password.
          </p>

          {sent ? (
            <div className="mt-6 rounded-lg border border-glass-border bg-card/40 p-4 text-sm text-muted-foreground">
              A password reset link has been sent to <b className="text-foreground">{email}</b>.
              Follow the link to set a new password.
            </div>
          ) : (
            <form onSubmit={onSubmit} className="mt-6 space-y-4">
              <label className="block">
                <span className="mb-1.5 block text-xs font-medium uppercase tracking-wider text-muted-foreground">
                  Email
                </span>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full rounded-lg border border-glass-border bg-background/40 px-3 py-2.5 text-sm text-foreground outline-none transition focus:border-brand focus:ring-2 focus:ring-brand/30"
                />
              </label>
              {captcha?.enabled && captcha.siteKey && (
                <Turnstile siteKey={captcha.siteKey} onToken={setCaptchaToken} />
              )}
              <button
                type="submit"
                disabled={loading}
                className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-gradient-brand px-4 py-2.5 text-sm font-semibold text-brand-foreground shadow-glow disabled:opacity-60"
              >
                {loading && <Loader2 className="h-4 w-4 animate-spin" />}
                Send reset link
              </button>
            </form>
          )}

          <div className="mt-6 text-center text-sm text-muted-foreground">
            Remembered it?{" "}
            <Link to="/auth" className="font-semibold text-foreground hover:underline">
              Sign in
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
