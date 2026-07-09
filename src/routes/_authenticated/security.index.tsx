import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { ShieldCheck, KeyRound } from "lucide-react";

export const Route = createFileRoute("/_authenticated/security/")({
  head: () => ({ meta: [{ title: "Security · PayNOC" }] }),
  component: SecurityPage,
});

type Factor = { id: string; friendly_name?: string | null; factor_type: string; status: string };

function SecurityPage() {
  const { user } = useAuth();
  const [factors, setFactors] = useState<Factor[]>([]);
  const [qr, setQr] = useState<string | null>(null);
  const [factorId, setFactorId] = useState<string | null>(null);
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);

  const load = async () => {
    const { data } = await supabase.auth.mfa.listFactors();
    setFactors([...(data?.totp ?? [])] as Factor[]);
  };

  useEffect(() => {
    load();
  }, [user]);

  const enroll = async () => {
    setBusy(true);
    const { data, error } = await supabase.auth.mfa.enroll({ factorType: "totp", friendlyName: "PayNOC" });
    setBusy(false);
    if (error) return toast.error(error.message);
    setQr(data.totp.qr_code);
    setFactorId(data.id);
  };

  const verify = async () => {
    if (!factorId) return;
    setBusy(true);
    const { data: chal } = await supabase.auth.mfa.challenge({ factorId });
    if (!chal) { setBusy(false); return toast.error("Challenge failed"); }
    const { error } = await supabase.auth.mfa.verify({ factorId, challengeId: chal.id, code });
    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success("2FA enabled");
    await supabase.from("profiles").update({ mfa_enabled: true }).eq("id", user!.id);
    setQr(null);
    setFactorId(null);
    setCode("");
    load();
  };

  const unenroll = async (id: string) => {
    const { error } = await supabase.auth.mfa.unenroll({ factorId: id });
    if (error) return toast.error(error.message);
    await supabase.from("profiles").update({ mfa_enabled: false }).eq("id", user!.id);
    toast.success("2FA disabled");
    load();
  };

  const active = factors.filter((f) => f.status === "verified");

  return (
    <>
      <Card className="p-6">
        <div className="mb-4 flex items-center gap-2">
          <ShieldCheck className="h-5 w-5 text-brand" />
          <h3 className="font-medium">Authenticator app</h3>
        </div>

        {active.length > 0 ? (
          <>
            <p className="text-sm text-success">2FA is active on your account.</p>
            <div className="mt-4 space-y-2">
              {active.map((f) => (
                <div key={f.id} className="flex items-center justify-between rounded-lg border border-glass-border p-3">
                  <div className="flex items-center gap-2 text-sm">
                    <KeyRound className="h-4 w-4 text-brand" />
                    {f.friendly_name ?? "TOTP"}
                  </div>
                  <Button size="sm" variant="ghost" onClick={() => unenroll(f.id)}>Disable</Button>
                </div>
              ))}
            </div>
          </>
        ) : qr ? (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Scan this QR with Google Authenticator / 1Password / Authy, then enter the 6-digit code.
            </p>
            <div className="flex justify-center rounded-lg border border-glass-border bg-white p-4">
              <img src={qr} alt="TOTP QR" className="h-48 w-48" />
            </div>
            <div className="flex gap-2">
              <Input placeholder="123456" value={code} onChange={(e) => setCode(e.target.value)} maxLength={6} />
              <Button onClick={verify} disabled={busy || code.length !== 6}>Verify</Button>
            </div>
          </div>
        ) : (
          <>
            <p className="text-sm text-muted-foreground">
              Add a second factor to protect your account. You'll be asked for a 6-digit code on future sign-ins.
            </p>
            <Button className="mt-4" onClick={enroll} disabled={busy}>Enable 2FA</Button>
          </>
        )}
      </Card>
    </>
  );
}
