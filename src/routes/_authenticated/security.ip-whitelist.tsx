import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { useActiveMerchant } from "@/hooks/use-active-merchant";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Trash2, Plus, Lock } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/security/ip-whitelist")({
  head: () => ({ meta: [{ title: "IP Whitelist · PayNOC" }] }),
  component: IpWhitelistPage,
});

type Entry = { id: string; ip_address: string; label: string | null; created_at: string };

function IpWhitelistPage() {
  const { user } = useAuth();
  const { merchantId: activeMerchantId } = useActiveMerchant();
  const [rows, setRows] = useState<Entry[]>([]);
  const [ip, setIp] = useState("");
  const [label, setLabel] = useState("");
  const [busy, setBusy] = useState(false);

  const load = async () => {
    if (!user) return;
    const { data } = await supabase
      .from("ip_whitelist")
      .select("id, ip_address, label, created_at")
      .eq("merchant_id", activeMerchantId ?? user.id)
      .order("created_at", { ascending: false });
    setRows((data ?? []) as Entry[]);
  };

  useEffect(() => {
    load();
  }, [user, activeMerchantId]);

  const add = async () => {
    if (!user || !ip.trim()) return;
    setBusy(true);
    const { error } = await supabase
      .from("ip_whitelist")
      .insert({ merchant_id: activeMerchantId ?? user.id, ip_address: ip.trim(), label: label.trim() || null });
    setBusy(false);
    if (error) return toast.error(error.message);
    setIp("");
    setLabel("");
    toast.success("IP added");
    load();
  };

  const remove = async (id: string) => {
    const { error } = await supabase.from("ip_whitelist").delete().eq("id", id);
    if (error) return toast.error(error.message);
    load();
  };

  return (
    <>
      <Card className="p-5">
        <div className="flex items-start gap-2 rounded-lg border border-glass-border bg-muted/30 p-3 text-sm text-muted-foreground">
          <Lock className="mt-0.5 h-4 w-4 shrink-0 text-brand" />
          <p>
            When the list is <strong>empty</strong>, all IPs are allowed. Add one or more IPs to enforce.
            Requests from any other IP will be rejected with HTTP 403.
          </p>
        </div>

        <div className="mt-4 grid gap-2 md:grid-cols-[1fr_1fr_auto]">
          <Input placeholder="203.0.113.42" value={ip} onChange={(e) => setIp(e.target.value)} />
          <Input placeholder="Label (e.g. production server)" value={label} onChange={(e) => setLabel(e.target.value)} />
          <Button onClick={add} disabled={busy || !ip.trim()}>
            <Plus className="mr-1.5 h-4 w-4" /> Add
          </Button>
        </div>

        <div className="mt-6 space-y-2">
          {rows.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">No IPs whitelisted yet.</p>
          ) : (
            rows.map((r) => (
              <div key={r.id} className="flex items-center justify-between rounded-lg border border-glass-border p-3">
                <div>
                  <p className="font-mono text-sm">{r.ip_address}</p>
                  {r.label ? <p className="text-xs text-muted-foreground">{r.label}</p> : null}
                </div>
                <Button size="sm" variant="ghost" onClick={() => remove(r.id)}>
                  <Trash2 className="h-4 w-4 text-destructive" />
                </Button>
              </div>
            ))
          )}
        </div>
      </Card>
    </>
  );
}
