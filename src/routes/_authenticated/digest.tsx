import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { MerchantShell } from "@/components/merchant-shell";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";

export const Route = createFileRoute("/_authenticated/digest")({
  head: () => ({ meta: [{ title: "Email digest · PayNOC" }] }),
  component: DigestPage,
});

function DigestPage() {
  const { user } = useAuth();
  const [enabled, setEnabled] = useState(true);
  const [frequency, setFrequency] = useState("daily");
  const [lastSent, setLastSent] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!user) return;
    (async () => {
      const { data } = await (supabase.from as unknown as (t: string) => {
        select: (c: string) => {
          eq: (c: string, v: unknown) => {
            maybeSingle: () => Promise<{ data: Record<string, unknown> | null }>;
          };
        };
      })("digest_settings")
        .select("*")
        .eq("merchant_id", user.id)
        .maybeSingle();
      if (data) {
        setEnabled(Boolean(data.enabled));
        setFrequency(String(data.frequency ?? "daily"));
        setLastSent((data.last_sent_at as string) ?? null);
      }
    })();
  }, [user]);

  const save = async () => {
    if (!user) return;
    setSaving(true);
    const { error } = await (supabase.from as unknown as (t: string) => {
      upsert: (
        r: Record<string, unknown>,
        o: { onConflict: string },
      ) => Promise<{ error: { message: string } | null }>;
    })("digest_settings").upsert(
      { merchant_id: user.id, enabled, frequency },
      { onConflict: "merchant_id" },
    );
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success("Digest preferences saved");
  };

  return (
    <MerchantShell
      title="Email digest"
      subtitle="Get a periodic email with volume, paid, and failed invoices."
    >
      <Card className="max-w-xl p-6">
        <div className="flex items-center justify-between">
          <div>
            <div className="font-medium">Enable digest</div>
            <div className="text-xs text-muted-foreground">
              Delivered to your notification email.
            </div>
          </div>
          <Switch checked={enabled} onCheckedChange={setEnabled} />
        </div>
        <div className="mt-6">
          <div className="mb-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">
            Frequency
          </div>
          <div className="flex gap-2">
            {["daily", "weekly"].map((f) => (
              <button
                key={f}
                onClick={() => setFrequency(f)}
                className={`rounded-lg border px-4 py-2 text-sm capitalize ${
                  frequency === f
                    ? "border-brand bg-brand/10 text-brand"
                    : "border-glass-border text-muted-foreground"
                }`}
              >
                {f}
              </button>
            ))}
          </div>
        </div>
        {lastSent && (
          <p className="mt-4 text-xs text-muted-foreground">
            Last sent: {new Date(lastSent).toLocaleString()}
          </p>
        )}
        <Button className="mt-6" onClick={save} disabled={saving}>
          {saving ? "Saving…" : "Save"}
        </Button>
      </Card>
    </MerchantShell>
  );
}
