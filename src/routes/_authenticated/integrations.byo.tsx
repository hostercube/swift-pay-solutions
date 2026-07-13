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
import { Trash2, Plug, ExternalLink, Check, Settings2, X, Plus } from "lucide-react";
import { GATEWAYS, getGateway, gatewaysByRegion, defaultLogoFor } from "@/lib/gateways/registry";
import { resolveLogoUrl } from "@/lib/logo-url";
import { useEnabledProviders } from "@/hooks/use-provider-toggles";

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
  label: string | null;
  logo_url: string | null;
  created_at: string;
};

type Draft = {
  id?: string;
  provider: string;
  mode: "sandbox" | "live";
  label: string;
  logo_url: string | null;
  creds: Record<string, string>;
};

function ByoPage() {
  const { user } = useAuth();
  const { isEnabled } = useEnabledProviders();
  const [rows, setRows] = useState<Row[]>([]);
  const [tab, setTab] = useState<"BD" | "GLOBAL" | "CRYPTO">("BD");
  const [q, setQ] = useState("");
  const [conn, setConn] = useState<"" | "connected" | "not">("");
  const [draft, setDraft] = useState<Draft | null>(null);
  const [busy, setBusy] = useState(false);

  const load = async () => {
    if (!user) return;
    const { data, error } = await supabase
      .from("byo_gateways")
      .select("id, provider, mode, credentials, is_active, label, logo_url, created_at")
      .eq("merchant_id", user.id)
      .order("created_at", { ascending: false });
    if (error) toast.error(error.message);
    setRows((data ?? []) as unknown as Row[]);
  };

  useEffect(() => { load(); }, [user]);

  const byProvider = useMemo(() => {
    const map = new Map<string, Row[]>();
    rows.forEach((r) => {
      const arr = map.get(r.provider) ?? [];
      arr.push(r);
      map.set(r.provider, arr);
    });
    return map;
  }, [rows]);

  const openNew = (providerId: string) => {
    setDraft({ provider: providerId, mode: "sandbox", label: "", logo_url: null, creds: {} });
  };

  const openEdit = (r: Row) => {
    setDraft({
      id: r.id,
      provider: r.provider,
      mode: r.mode,
      label: r.label ?? "",
      logo_url: r.logo_url ?? null,
      creds: r.credentials ?? {},
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
    const payload = {
      merchant_id: user.id,
      provider: draft.provider,
      mode: draft.mode,
      label: draft.label.trim() || null,
      logo_url: draft.logo_url,
      credentials: draft.creds,
      is_active: true,
    };
    const { error } = draft.id
      ? await supabase.from("byo_gateways").update(payload).eq("id", draft.id)
      : await supabase.from("byo_gateways").insert(payload);
    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success(`${spec.label} saved`);
    setDraft(null);
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
    if (!confirm("Disconnect this gateway configuration?")) return;
    const { error } = await supabase.from("byo_gateways").delete().eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Disconnected");
    load();
  };

  const origin = typeof window !== "undefined" ? window.location.origin : "";
  const query = q.trim().toLowerCase();
  const filtered = gatewaysByRegion(tab).filter((g) => {
    if (!isEnabled(g.id)) return false;
    if (query && !`${g.label} ${g.id} ${g.currencies.join(" ")}`.toLowerCase().includes(query)) return false;
    if (conn) {
      const has = (byProvider.get(g.id) ?? []).length > 0;
      if (conn === "connected" && !has) return false;
      if (conn === "not" && has) return false;
    }
    return true;
  });

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center gap-2">
        {(["BD", "GLOBAL", "CRYPTO"] as const).map((t) => (
          <Button key={t} size="sm" variant={tab === t ? "default" : "outline"} onClick={() => setTab(t)}>
            {t === "BD" ? "Bangladesh" : t === "GLOBAL" ? "International" : "Crypto"}
          </Button>
        ))}
        <Input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search gateway…"
          className="h-9 max-w-xs"
        />
        <select
          value={conn}
          onChange={(e) => setConn(e.target.value as "" | "connected" | "not")}
          className="h-9 rounded-md border border-glass-border bg-background px-2 text-sm"
        >
          <option value="">All</option>
          <option value="connected">Connected</option>
          <option value="not">Not connected</option>
        </select>
        <span className="ml-auto text-xs text-muted-foreground">{filtered.length} gateways</span>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {filtered.map((g) => {
          const configs = byProvider.get(g.id) ?? [];
          const connected = configs.length > 0;
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
                  <Badge className="gap-1"><Check className="h-3 w-3" /> {configs.length} config{configs.length > 1 ? "s" : ""}</Badge>
                ) : (
                  <Badge variant="outline">Not connected</Badge>
                )}
              </div>

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

              {configs.length > 0 && (
                <div className="flex flex-col gap-2">
                  {configs.map((r) => (
                    <div key={r.id} className="rounded-lg border border-glass-border bg-background/40 p-2.5">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <div className="truncate text-sm font-medium">
                            {r.label || <span className="text-muted-foreground">Unnamed</span>}
                          </div>
                          <div className="mt-1 flex flex-wrap gap-1.5 text-[10px]">
                            <Badge variant={r.mode === "live" ? "default" : "outline"} className="capitalize">{r.mode}</Badge>
                            <Badge variant={r.is_active ? "default" : "outline"}>
                              {r.is_active ? "Enabled" : "Disabled"}
                            </Badge>
                          </div>
                        </div>
                        <div className="flex shrink-0 gap-1">
                          <Button size="sm" variant="ghost" onClick={() => openEdit(r)} className="h-7 px-2">
                            <Settings2 className="h-3.5 w-3.5" />
                          </Button>
                          <Button size="sm" variant="ghost" onClick={() => toggleActive(r)} className="h-7 px-2 text-xs">
                            {r.is_active ? "Off" : "On"}
                          </Button>
                          <Button size="sm" variant="ghost" onClick={() => remove(r.id)} className="h-7 px-2">
                            <Trash2 className="h-3.5 w-3.5 text-destructive" />
                          </Button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              <div className="mt-auto">
                <Button size="sm" onClick={() => openNew(g.id)} variant={connected ? "outline" : "default"} className="w-full">
                  <Plus className="mr-1 h-3.5 w-3.5" />
                  {connected ? "Add another configuration" : "Connect"}
                </Button>
              </div>
            </Card>
          );
        })}
      </div>

      {draft && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm"
          onClick={() => setDraft(null)}
        >
          <div
            className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl border border-glass-border bg-card p-6 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <DraftEditor
              draft={draft}
              onChange={setDraft}
              onSave={save}
              onClose={() => setDraft(null)}
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
  draft, onChange, onSave, onClose, busy, origin,
}: {
  draft: Draft;
  onChange: (d: Draft) => void;
  onSave: () => void;
  onClose: () => void;
  busy: boolean;
  origin: string;
}) {
  const spec = getGateway(draft.provider)!;
  const editing = !!draft.id;
  return (
    <div>
      <div className="mb-4 flex items-start justify-between">
        <div>
          <div className="text-xs uppercase text-muted-foreground">{editing ? "Edit configuration" : "New configuration"}</div>
          <h2 className="font-display text-xl font-semibold">{spec.label}</h2>
        </div>
        <button onClick={onClose} className="text-muted-foreground hover:text-foreground">
          <X className="h-5 w-5" />
        </button>
      </div>

      <div className="mb-4 grid gap-3 sm:grid-cols-2">
        <div>
          <label className="text-xs uppercase text-muted-foreground">Label (shown to customers)</label>
          <Input
            className="mt-1"
            placeholder="e.g. Store A · SSLCommerz"
            value={draft.label}
            onChange={(e) => onChange({ ...draft, label: e.target.value })}
          />
        </div>
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
        <div className="sm:col-span-2">
          <label className="text-xs uppercase text-muted-foreground">Logo (defaults to provider brand)</label>
          <ByoLogoField
            value={draft.logo_url}
            fallbackId={draft.provider}
            onChange={(v) => onChange({ ...draft, logo_url: v })}
          />
        </div>
        <div className="sm:col-span-2 text-xs text-muted-foreground">
          Webhook URL to paste in the provider dashboard:
          <div className="mt-1 break-all rounded-md bg-muted px-2 py-1 font-mono text-[11px]">
            {origin}/api/public/webhooks/{spec.id}
          </div>
          {spec.webhookHint && <p className="mt-1 text-[11px]">{spec.webhookHint}</p>}
        </div>

        {spec.setupSteps && spec.setupSteps.length > 0 && (
          <details className="sm:col-span-2 rounded-lg border border-brand/30 bg-brand/5 p-3 text-sm" open={!editing}>
            <summary className="cursor-pointer select-none font-medium text-brand">
              Where do I get these credentials? — {spec.label} setup guide
            </summary>
            <ol className="mt-3 ml-5 list-decimal space-y-1.5 text-xs leading-relaxed text-muted-foreground">
              {spec.setupSteps.map((s, i) => (
                <li key={i}>{s}</li>
              ))}
            </ol>
            {spec.docsUrl && (
              <a
                href={spec.docsUrl}
                target="_blank"
                rel="noreferrer"
                className="mt-3 inline-flex items-center gap-1 text-xs text-brand hover:underline"
              >
                Open official {spec.label} docs <ExternalLink className="h-3 w-3" />
              </a>
            )}
          </details>
        )}
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
        <Button onClick={onSave} disabled={busy}>{busy ? "Saving…" : editing ? "Update" : "Save"}</Button>
      </div>
    </div>
  );
}

function ByoLogoField({
  value, fallbackId, onChange,
}: {
  value: string | null;
  fallbackId: string;
  onChange: (v: string | null) => void;
}) {
  const { user } = useAuth();
  const [busy, setBusy] = useState(false);
  const preview = resolveLogoUrl(value, fallbackId);
  const isDefault = !value && !!defaultLogoFor(fallbackId);
  return (
    <div className="mt-1 flex flex-wrap items-center gap-3">
      {preview && (
        <img
          src={preview}
          alt="Logo preview"
          className="h-14 w-14 rounded-lg border border-glass-border bg-white/90 object-contain p-1"
        />
      )}
      <label className="inline-flex cursor-pointer items-center gap-2 rounded-lg border border-glass-border bg-card/60 px-3 py-2 text-xs font-semibold hover:border-brand">
        <input
          type="file"
          accept="image/*"
          className="hidden"
          disabled={busy || !user}
          onChange={async (e) => {
            const f = e.target.files?.[0];
            if (!f || !user) return;
            setBusy(true);
            const path = `logos/${user.id}/${crypto.randomUUID()}-${f.name.replace(/[^\w.\-]/g, "_")}`;
            const { error } = await supabase.storage
              .from("payment-assets")
              .upload(path, f, { upsert: false, contentType: f.type });
            setBusy(false);
            if (error) return toast.error(error.message);
            onChange(path);
            toast.success("Logo uploaded");
          }}
        />
        {busy ? "Uploading…" : value ? "Replace logo" : "Upload custom logo"}
      </label>
      {value && (
        <button
          type="button"
          onClick={() => onChange(null)}
          className="text-xs text-destructive hover:underline"
        >
          Reset to default
        </button>
      )}
      <p className="basis-full text-[11px] text-muted-foreground">
        {isDefault
          ? "Using the default provider logo. Upload one to override for this configuration."
          : value
            ? "Custom logo — shown to customers at checkout."
            : "No default logo available; upload one to show at checkout."}
      </p>
    </div>
  );
}

// Ensure the registry stays imported even if we later trim unused exports.
void GATEWAYS;

