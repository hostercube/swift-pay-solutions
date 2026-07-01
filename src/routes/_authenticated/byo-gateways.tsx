import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { MerchantShell } from "@/components/merchant-shell";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Trash2, Plug } from "lucide-react";

export const Route = createFileRoute("/_authenticated/byo-gateways")({
  head: () => ({ meta: [{ title: "BYO Gateways · PayNOC" }] }),
  component: ByoPage,
});

type Row = {
  id: string;
  provider: string;
  mode: string;
  credentials: Record<string, string>;
  is_active: boolean;
  created_at: string;
};

const PROVIDERS: { value: string; label: string; fields: string[] }[] = [
  { value: "bkash", label: "bKash", fields: ["app_key", "app_secret", "username", "password"] },
  { value: "nagad", label: "Nagad", fields: ["merchant_id", "merchant_number", "public_key", "private_key"] },
  { value: "sslcommerz", label: "SSLCommerz", fields: ["store_id", "store_password"] },
  { value: "stripe", label: "Stripe", fields: ["secret_key", "webhook_secret"] },
];

function ByoPage() {
  const { user } = useAuth();
  const [rows, setRows] = useState<Row[]>([]);
  const [provider, setProvider] = useState("bkash");
  const [mode, setMode] = useState("sandbox");
  const [creds, setCreds] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);

  const spec = PROVIDERS.find((p) => p.value === provider)!;

  const load = async () => {
    if (!user) return;
    const { data } = await (supabase as unknown as {
      from: (t: string) => {
        select: (s: string) => {
          eq: (c: string, v: string) => { order: (c: string, o: object) => Promise<{ data: Row[] | null }> };
        };
      };
    })
      .from("byo_gateways")
      .select("id, provider, mode, credentials, is_active, created_at")
      .eq("merchant_id", user.id)
      .order("created_at", { ascending: false });
    setRows((data ?? []) as Row[]);
  };

  useEffect(() => {
    load();
  }, [user]);

  useEffect(() => {
    setCreds({});
  }, [provider]);

  const save = async () => {
    if (!user) return;
    for (const f of spec.fields) {
      if (!creds[f]?.trim()) return toast.error(`Missing ${f}`);
    }
    setBusy(true);
    const { error } = await (supabase as unknown as {
      from: (t: string) => {
        upsert: (v: object, o: object) => Promise<{ error: { message: string } | null }>;
      };
    })
      .from("byo_gateways")
      .upsert(
        { merchant_id: user.id, provider, mode, credentials: creds, is_active: true },
        { onConflict: "merchant_id,provider" },
      );
    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success("Gateway saved. Auto-verify enabled once credentials are validated.");
    setCreds({});
    load();
  };

  const remove = async (id: string) => {
    const { error } = await (supabase as unknown as {
      from: (t: string) => { delete: () => { eq: (c: string, v: string) => Promise<{ error: { message: string } | null }> } };
    })
      .from("byo_gateways")
      .delete()
      .eq("id", id);
    if (error) return toast.error(error.message);
    load();
  };

  return (
    <MerchantShell title="BYO Gateways" subtitle="Connect your own bKash / Nagad / SSLCommerz / Stripe merchant credentials for automatic verification">
      <Card className="p-5">
        <div className="mb-4 flex items-center gap-2">
          <Plug className="h-4 w-4 text-brand" />
          <h3 className="font-medium">Add / update gateway</h3>
        </div>
        <div className="grid gap-3 md:grid-cols-[180px_180px_1fr_auto]">
          <select
            className="rounded-md border border-glass-border bg-background px-3 py-2 text-sm"
            value={provider}
            onChange={(e) => setProvider(e.target.value)}
          >
            {PROVIDERS.map((p) => <option key={p.value} value={p.value}>{p.label}</option>)}
          </select>
          <select
            className="rounded-md border border-glass-border bg-background px-3 py-2 text-sm"
            value={mode}
            onChange={(e) => setMode(e.target.value)}
          >
            <option value="sandbox">Sandbox</option>
            <option value="live">Live</option>
          </select>
          <div className="md:col-span-2" />
          {spec.fields.map((f) => (
            <Input
              key={f}
              placeholder={f}
              type={/secret|password|key/i.test(f) ? "password" : "text"}
              value={creds[f] ?? ""}
              onChange={(e) => setCreds({ ...creds, [f]: e.target.value })}
              className="md:col-span-2"
            />
          ))}
          <Button onClick={save} disabled={busy} className="md:col-span-4">Save gateway</Button>
        </div>
        <p className="mt-3 text-xs text-muted-foreground">
          Credentials are stored server-side, scoped to your merchant account by RLS. Never share your live keys.
        </p>
      </Card>

      <Card className="mt-6 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-muted/30 text-left text-xs uppercase tracking-wide text-muted-foreground">
            <tr>
              <th className="px-4 py-3">Provider</th>
              <th className="px-4 py-3">Mode</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Added</th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr><td colSpan={5} className="p-8 text-center text-muted-foreground">No gateways connected</td></tr>
            ) : rows.map((r) => (
              <tr key={r.id} className="border-t border-glass-border">
                <td className="px-4 py-3 capitalize">{r.provider}</td>
                <td className="px-4 py-3"><Badge variant={r.mode === "live" ? "default" : "outline"}>{r.mode}</Badge></td>
                <td className="px-4 py-3">{r.is_active ? <Badge>Active</Badge> : <Badge variant="outline">Disabled</Badge>}</td>
                <td className="px-4 py-3 text-xs text-muted-foreground">{new Date(r.created_at).toLocaleDateString()}</td>
                <td className="px-4 py-3 text-right">
                  <Button size="sm" variant="ghost" onClick={() => remove(r.id)}>
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </MerchantShell>
  );
}
