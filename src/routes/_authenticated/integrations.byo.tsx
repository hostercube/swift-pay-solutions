import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";

import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Trash2, Plug, ExternalLink, Check, Settings2, X } from "lucide-react";
import { GATEWAYS, getGateway, gatewaysByRegion } from "@/lib/gateways/registry";

export const Route = createFileRoute("/_authenticated/integrations/byo")({
  head: () => ({ meta: [{ title: "Payment Gateways · PayNOC" }] }),
  component: ByoPage,
});

type Row = {
  id: string;
  provider: string;
  mode: "sandbox" | "live";
  credentials: Record<string, string>;
  is_active: boolean;
  created_at: string;
};

type Draft = { provider: string; mode: "sandbox" | "live"; creds: Record<string, string> };

function ByoPage() {
  const { user } = useAuth();
  const [rows, setRows] = useState<Row[]>([]);
  const [tab, setTab] = useState<"BD" | "GLOBAL" | "CRYPTO">("BD");
  const [draft, setDraft] = useState<Draft | null>(null);
  const [editId, setEditId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = async () => {
    if (!user) return;
    const { data, error } = await supabase
      .from("byo_gateways")
      .select("id, provider, mode, credentials, is_active, created_at")
      .eq("merchant_id", user.id)
      .order("created_at", { ascending: false });
    if (error) toast.error(error.message);
    setRows((data ?? []) as unknown as Row[]);
  };

  useEffect(() => { load(); }, [user]);

  const byProvider = useMemo(() => {
    const map = new Map<string, Row>();
    rows.forEach((r) => map.set(r.provider, r));
    return map;
  }, [rows]);

  const openNew = (providerId: string) => {
    const existing = byProvider.get(providerId);
    setEditId(existing?.id ?? null);
    setDraft({
      provider: providerId,
      mode: existing?.mode ?? "sandbox",
      creds: existing?.credentials ?? {},
    });
  };

  const save = async () => {
    if (!user || !draft) return;
    const spec = getGateway(draft.provider);
    if (!spec) return;
    for (const f of spec.fields) {
      if (f.required && !draft.creds[f.key]?.trim()) return toast.error(`Missing ${f.label}`);
    }
    setBusy(true);
    const { error } = await supabase.from("byo_gateways").upsert(
      {
        merchant_id: user.id,
        provider: draft.provider,
        mode: draft.mode,
        credentials: draft.creds,
        is_active: true,
      },
      { onConflict: "merchant_id,provider" },
    );
    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success(`${spec.label} saved`);
    setDraft(null);
    setEditId(null);
    load();
  };

  const toggleActive = async (r: Row) => {
    const { error } = await supabase
      .from("byo_gateways")
      .update({ is_active: !r.is_active })
      .eq("id", r.id);
    if (error) return toast.error(error.message);
    load();
  };

  const remove = async (id: string) => {
    if (!confirm("Disconnect this gateway?")) return;
    const { error } = await supabase.from("byo_gateways").delete().eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Disconnected");
    load();
  };

  const origin = typeof window !== "undefined" ? window.location.origin : "";
  const filtered = gatewaysByRegion(tab);

  return (
    <div>

      <div className="mb-4 flex gap-2">
        {(["BD", "GLOBAL", "CRYPTO"] as const).map((t) => (
          <Button key={t} size="sm" variant={tab === t ? "default" : "outline"} onClick={() => setTab(t)}>
            {t === "BD" ? "Bangladesh" : t === "GLOBAL" ? "International" : "Crypto"}
          </Button>
        ))}
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {filtered.map((g) => {
          const row = byProvider.get(g.id);
          const connected = !!row;
          return (
            <Card key={g.id} className="flex flex-col gap-3 p-5">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <div className="flex items-center gap-2">
                    <Plug className="h-4 w-4 text-brand" />
                    <span className="font-semibold">{g.label}</span>
                  </div>
                  <div className="mt-1 text-xs text-muted-foreground">
                    {g.currencies.join(" · ")} · {g.flow.replace("_", " ")}
                  </div>
                </div>
                {connected ? (
                  <Badge className="gap-1"><Check className="h-3 w-3" /> Connected</Badge>
                ) : (
                  <Badge variant="outline">Not connected</Badge>
                )}
              </div>

              {connected && row && (
                <div className="flex flex-wrap items-center gap-2 text-xs">
                  <Badge variant={row.mode === "live" ? "default" : "outline"} className="capitalize">{row.mode}</Badge>
                  <Badge variant={row.is_active ? "default" : "outline"}>
                    {row.is_active ? "Enabled" : "Disabled"}
                  </Badge>
                </div>
              )}

              {g.docsUrl && (
                <a
                  href={g.docsUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1 text-xs text-brand hover:underline"
                >
                  Provider docs <ExternalLink className="h-3 w-3" />
                </a>
              )}

              <div className="mt-auto flex flex-wrap gap-2">
                <Button size="sm" onClick={() => openNew(g.id)}>
                  <Settings2 className="mr-1 h-3 w-3" />
                  {connected ? "Edit" : "Connect"}
                </Button>
                {connected && row && (
                  <>
                    <Button size="sm" variant="outline" onClick={() => toggleActive(row)}>
                      {row.is_active ? "Disable" : "Enable"}
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => remove(row.id)}>
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </>
                )}
              </div>
            </Card>
          );
        })}
      </div>

      {draft && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
          onClick={() => setDraft(null)}
        >
          <div
            className="glass max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl border border-glass-border p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <DraftEditor
              draft={draft}
              editing={!!editId}
              onChange={setDraft}
              onSave={save}
              onClose={() => { setDraft(null); setEditId(null); }}
              busy={busy}
              origin={origin}
            />
          </div>
        </div>
      )}
    </div>
  );
}

function DraftEditor({
  draft, editing, onChange, onSave, onClose, busy, origin,
}: {
  draft: Draft;
  editing: boolean;
  onChange: (d: Draft) => void;
  onSave: () => void;
  onClose: () => void;
  busy: boolean;
  origin: string;
}) {
  const spec = getGateway(draft.provider)!;
  return (
    <div>
      <div className="mb-4 flex items-start justify-between">
        <div>
          <div className="text-xs uppercase text-muted-foreground">{editing ? "Edit gateway" : "Connect gateway"}</div>
          <h2 className="font-display text-xl font-semibold">{spec.label}</h2>
        </div>
        <button onClick={onClose} className="text-muted-foreground hover:text-foreground">
          <X className="h-5 w-5" />
        </button>
      </div>

      <div className="mb-4 grid gap-3 sm:grid-cols-2">
        <div>
          <label className="text-xs uppercase text-muted-foreground">Mode</label>
          <select
            className="mt-1 w-full rounded-md border border-glass-border bg-background px-3 py-2 text-sm"
            value={draft.mode}
            onChange={(e) => onChange({ ...draft, mode: e.target.value as "sandbox" | "live" })}
          >
            <option value="sandbox">Sandbox</option>
            <option value="live">Live</option>
          </select>
        </div>
        <div className="text-xs text-muted-foreground">
          Webhook URL to paste in the provider dashboard:
          <div className="mt-1 break-all rounded-md bg-muted px-2 py-1 font-mono text-[11px]">
            {origin}/api/public/webhooks/{spec.id}
          </div>
          {spec.webhookHint && <p className="mt-1 text-[11px]">{spec.webhookHint}</p>}
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        {spec.fields.map((f) =>
          f.type === "textarea" ? (
            <div key={f.key} className="sm:col-span-2">
              <label className="text-xs uppercase text-muted-foreground">
                {f.label} {f.required && <span className="text-destructive">*</span>}
              </label>
              <Textarea
                className="mt-1 min-h-24"
                placeholder={f.placeholder ?? ""}
                value={draft.creds[f.key] ?? ""}
                onChange={(e) => onChange({ ...draft, creds: { ...draft.creds, [f.key]: e.target.value } })}
              />
              {f.help && <p className="mt-1 text-[11px] text-muted-foreground">{f.help}</p>}
            </div>
          ) : (
            <div key={f.key}>
              <label className="text-xs uppercase text-muted-foreground">
                {f.label} {f.required && <span className="text-destructive">*</span>}
              </label>
              <Input
                className="mt-1"
                type={f.type === "password" ? "password" : "text"}
                placeholder={f.placeholder ?? ""}
                value={draft.creds[f.key] ?? ""}
                onChange={(e) => onChange({ ...draft, creds: { ...draft.creds, [f.key]: e.target.value } })}
              />
              {f.help && <p className="mt-1 text-[11px] text-muted-foreground">{f.help}</p>}
            </div>
          ),
        )}
      </div>

      <div className="mt-6 flex justify-end gap-2">
        <Button variant="outline" onClick={onClose}>Cancel</Button>
        <Button onClick={onSave} disabled={busy}>{busy ? "Saving…" : editing ? "Update" : "Connect"}</Button>
      </div>
    </div>
  );
}

// Ensure the registry stays imported even if we later trim unused exports.
void GATEWAYS;
