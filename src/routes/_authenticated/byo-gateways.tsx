import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { MerchantShell } from "@/components/merchant-shell";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Trash2, Plug, ExternalLink } from "lucide-react";
import { GATEWAYS, gatewaysByRegion } from "@/lib/gateways/registry";

export const Route = createFileRoute("/_authenticated/byo-gateways")({
  head: () => ({ meta: [{ title: "Payment Gateways · PayNOC" }] }),
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

type SbClient = {
  from: (t: string) => {
    select: (s: string) => {
      eq: (c: string, v: string) => { order: (c: string, o: object) => Promise<{ data: Row[] | null }> };
    };
    upsert: (v: object, o: object) => Promise<{ error: { message: string } | null }>;
    delete: () => { eq: (c: string, v: string) => Promise<{ error: { message: string } | null }> };
  };
};

function ByoPage() {
  const { user } = useAuth();
  const [rows, setRows] = useState<Row[]>([]);
  const [provider, setProvider] = useState("bkash");
  const [mode, setMode] = useState<"sandbox" | "live">("sandbox");
  const [creds, setCreds] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [tab, setTab] = useState<"BD" | "GLOBAL" | "CRYPTO">("BD");

  const spec = useMemo(() => GATEWAYS.find((p) => p.id === provider)!, [provider]);
  const client = supabase as unknown as SbClient;

  const load = async () => {
    if (!user) return;
    const { data } = await client
      .from("byo_gateways")
      .select("id, provider, mode, credentials, is_active, created_at")
      .eq("merchant_id", user.id)
      .order("created_at", { ascending: false });
    setRows((data ?? []) as Row[]);
  };

  useEffect(() => { load(); }, [user]);
  useEffect(() => { setCreds({}); }, [provider]);

  const save = async () => {
    if (!user) return;
    for (const f of spec.fields) {
      if (f.required && !creds[f.key]?.trim()) return toast.error(`Missing ${f.label}`);
    }
    setBusy(true);
    const { error } = await client.from("byo_gateways").upsert(
      { merchant_id: user.id, provider, mode, credentials: creds, is_active: true },
      { onConflict: "merchant_id,provider" },
    );
    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success(`${spec.label} connected. Webhook URL will be shown below.`);
    setCreds({}); load();
  };

  const remove = async (id: string) => {
    const { error } = await client.from("byo_gateways").delete().eq("id", id);
    if (error) return toast.error(error.message);
    load();
  };

  const filtered = gatewaysByRegion(tab);
  const origin = typeof window !== "undefined" ? window.location.origin : "";

  return (
    <MerchantShell title="Payment Gateways" subtitle="Connect Bangladesh, international, and crypto gateways. Merchants can mix BYO credentials with platform-managed ones.">
      <div className="mb-4 flex gap-2">
        {(["BD", "GLOBAL", "CRYPTO"] as const).map((t) => (
          <Button key={t} size="sm" variant={tab === t ? "default" : "outline"} onClick={() => { setTab(t); const first = gatewaysByRegion(t)[0]; if (first) setProvider(first.id); }}>
            {t === "BD" ? "Bangladesh" : t === "GLOBAL" ? "International" : "Crypto"}
          </Button>
        ))}
      </div>

      <Card className="p-5">
        <div className="mb-4 flex items-center gap-2">
          <Plug className="h-4 w-4 text-brand" />
          <h3 className="font-medium">Connect gateway</h3>
        </div>
        <div className="grid gap-3 md:grid-cols-[240px_180px_1fr]">
          <select
            className="rounded-md border border-glass-border bg-background px-3 py-2 text-sm"
            value={provider}
            onChange={(e) => setProvider(e.target.value)}
          >
            {filtered.map((p) => <option key={p.id} value={p.id}>{p.label} · {p.currencies.join("/")}</option>)}
          </select>
          <select
            className="rounded-md border border-glass-border bg-background px-3 py-2 text-sm"
            value={mode}
            onChange={(e) => setMode(e.target.value as "sandbox" | "live")}
          >
            <option value="sandbox">Sandbox</option>
            <option value="live">Live</option>
          </select>
          <div className="text-xs text-muted-foreground self-center">
            Flow: <b>{spec.flow.replace("_", " ")}</b>
            {spec.docsUrl && (
              <a className="ml-3 inline-flex items-center gap-1 text-brand" href={spec.docsUrl} target="_blank" rel="noreferrer">
                Docs <ExternalLink className="h-3 w-3" />
              </a>
            )}
          </div>
        </div>

        <div className="mt-4 grid gap-3 md:grid-cols-2">
          {spec.fields.map((f) => (
            f.type === "textarea" ? (
              <Textarea key={f.key} placeholder={f.placeholder ?? f.label} className="md:col-span-2 min-h-24"
                value={creds[f.key] ?? ""} onChange={(e) => setCreds({ ...creds, [f.key]: e.target.value })} />
            ) : (
              <Input key={f.key} placeholder={f.placeholder ?? f.label}
                type={f.type === "password" ? "password" : "text"}
                value={creds[f.key] ?? ""} onChange={(e) => setCreds({ ...creds, [f.key]: e.target.value })} />
            )
          ))}
        </div>

        <div className="mt-4 flex items-center justify-between">
          <div className="text-xs text-muted-foreground">
            Webhook URL: <code className="rounded bg-muted px-2 py-1">{origin}/api/public/webhooks/{spec.id}</code>
            {spec.webhookHint && <span className="ml-2">— {spec.webhookHint}</span>}
          </div>
          <Button onClick={save} disabled={busy}>Save gateway</Button>
        </div>
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
                <td className="px-4 py-3 capitalize">{r.provider.replace("_", " ")}</td>
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
