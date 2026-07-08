import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { AdminShell } from "@/components/admin-shell";
import { supabase } from "@/integrations/supabase/client";
import { Plus, Trash2, Save, ExternalLink, Loader2 } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/admin/platform/plugins")({
  head: () => ({ meta: [{ title: "Plugins · PayNOC Admin" }] }),
  component: AdminPluginsPage,
});

type Plugin = {
  id: string;
  name: string;
  slug: string;
  platform: string;
  description: string | null;
  version: string | null;
  icon_url: string | null;
  download_url: string | null;
  docs_url: string | null;
  repo_url: string | null;
  is_active: boolean;
  sort_order: number;
};

const empty = (): Partial<Plugin> => ({
  name: "",
  slug: "",
  platform: "WordPress",
  description: "",
  version: "1.0.0",
  download_url: "",
  docs_url: "",
  repo_url: "",
  icon_url: "",
  is_active: true,
  sort_order: 0,
});

function AdminPluginsPage() {
  const [rows, setRows] = useState<Plugin[]>([]);
  const [loading, setLoading] = useState(true);
  const [draft, setDraft] = useState<Partial<Plugin>>(empty());
  const [saving, setSaving] = useState(false);

  async function load() {
    setLoading(true);
    const { data, error } = await (supabase.from("platform_plugins" as never) as any)
      .select("*")
      .order("sort_order", { ascending: true });
    if (error) toast.error(error.message);
    setRows((data ?? []) as Plugin[]);
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

  async function create() {
    if (!draft.name || !draft.slug || !draft.platform) {
      toast.error("Name, slug, and platform are required.");
      return;
    }
    setSaving(true);
    const { error } = await (supabase.from("platform_plugins" as never) as any).insert(draft);
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success("Plugin added — it now shows on the public API docs.");
    setDraft(empty());
    load();
  }

  async function update(id: string, patch: Partial<Plugin>) {
    const { error } = await (supabase.from("platform_plugins" as never) as any)
      .update(patch)
      .eq("id", id);
    if (error) return toast.error(error.message);
    load();
  }

  async function remove(id: string) {
    if (!confirm("Delete this plugin listing?")) return;
    const { error } = await (supabase.from("platform_plugins" as never) as any)
      .delete()
      .eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Removed.");
    load();
  }

  return (
    <AdminShell
      title="Plugins & integrations"
      subtitle="Everything you publish here appears live on the public API documentation page under Plugins & SDKs."
    >
      {/* Create */}
      <section className="rounded-2xl border border-glass-border bg-card/40 p-6">
        <h2 className="font-display text-lg font-semibold">Add a new plugin</h2>
        <div className="mt-4 grid gap-3 md:grid-cols-2">
          <Input label="Name" value={draft.name ?? ""} onChange={(v) => setDraft({ ...draft, name: v })} placeholder="PayNOC for WordPress" />
          <Input label="Slug" value={draft.slug ?? ""} onChange={(v) => setDraft({ ...draft, slug: v })} placeholder="wordpress" />
          <Input label="Platform" value={draft.platform ?? ""} onChange={(v) => setDraft({ ...draft, platform: v })} placeholder="WordPress / WHMCS / Shopify" />
          <Input label="Version" value={draft.version ?? ""} onChange={(v) => setDraft({ ...draft, version: v })} placeholder="1.0.0" />
          <Input label="Download URL" value={draft.download_url ?? ""} onChange={(v) => setDraft({ ...draft, download_url: v })} placeholder="https://…/paynoc-wp.zip" />
          <Input label="Docs URL" value={draft.docs_url ?? ""} onChange={(v) => setDraft({ ...draft, docs_url: v })} placeholder="https://docs.paynoc.example/wordpress" />
          <Input label="Repo URL" value={draft.repo_url ?? ""} onChange={(v) => setDraft({ ...draft, repo_url: v })} placeholder="https://github.com/…" />
          <Input label="Icon URL" value={draft.icon_url ?? ""} onChange={(v) => setDraft({ ...draft, icon_url: v })} placeholder="https://…/icon.svg" />
          <div className="md:col-span-2">
            <label className="mb-1 block text-xs font-medium uppercase tracking-wider text-muted-foreground">Description</label>
            <textarea
              value={draft.description ?? ""}
              onChange={(e) => setDraft({ ...draft, description: e.target.value })}
              rows={3}
              className="w-full rounded-lg border border-glass-border bg-background px-3 py-2 text-sm"
              placeholder="One-paragraph pitch — what it does and who it's for."
            />
          </div>
        </div>
        <button
          onClick={create}
          disabled={saving}
          className="mt-5 inline-flex items-center gap-2 rounded-lg bg-gradient-brand px-4 py-2 text-sm font-semibold text-brand-foreground shadow-glow disabled:opacity-60"
        >
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
          Publish plugin
        </button>
      </section>

      {/* List */}
      <section className="mt-8">
        <h2 className="font-display text-lg font-semibold">Published plugins ({rows.length})</h2>
        {loading ? (
          <p className="mt-4 text-sm text-muted-foreground">Loading…</p>
        ) : rows.length === 0 ? (
          <p className="mt-4 text-sm text-muted-foreground">No plugins yet. Add one above.</p>
        ) : (
          <div className="mt-4 space-y-3">
            {rows.map((r) => (
              <PluginRow key={r.id} row={r} onUpdate={update} onRemove={remove} />
            ))}
          </div>
        )}
      </section>
    </AdminShell>
  );
}

function Input({ label, value, onChange, placeholder }: { label: string; value: string; onChange: (v: string) => void; placeholder?: string }) {
  return (
    <div>
      <label className="mb-1 block text-xs font-medium uppercase tracking-wider text-muted-foreground">{label}</label>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full rounded-lg border border-glass-border bg-background px-3 py-2 text-sm"
      />
    </div>
  );
}

function PluginRow({ row, onUpdate, onRemove }: { row: Plugin; onUpdate: (id: string, p: Partial<Plugin>) => void; onRemove: (id: string) => void }) {
  const [local, setLocal] = useState<Plugin>(row);
  const dirty = JSON.stringify(local) !== JSON.stringify(row);
  useEffect(() => setLocal(row), [row]);

  return (
    <div className="rounded-xl border border-glass-border bg-card/40 p-5">
      <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-4 sm:flex sm:items-center sm:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-md bg-brand/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-brand">
              {local.platform}
            </span>
            <span className="font-display font-semibold">{local.name}</span>
            {local.version && <span className="text-xs text-muted-foreground">v{local.version}</span>}
            {!local.is_active && <span className="rounded-md bg-warning/15 px-2 py-0.5 text-[10px] uppercase text-warning">Hidden</span>}
          </div>
          <p className="mt-1 text-sm text-muted-foreground">{local.description}</p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {local.download_url && (
            <a href={local.download_url} target="_blank" rel="noreferrer" className="rounded-md border border-glass-border p-2 text-muted-foreground hover:text-foreground">
              <ExternalLink className="h-4 w-4" />
            </a>
          )}
          <button
            onClick={() => onRemove(local.id)}
            className="rounded-md border border-glass-border p-2 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      </div>

      <div className="mt-4 grid gap-3 md:grid-cols-3">
        <Input label="Name" value={local.name} onChange={(v) => setLocal({ ...local, name: v })} />
        <Input label="Version" value={local.version ?? ""} onChange={(v) => setLocal({ ...local, version: v })} />
        <Input label="Platform" value={local.platform} onChange={(v) => setLocal({ ...local, platform: v })} />
        <Input label="Download URL" value={local.download_url ?? ""} onChange={(v) => setLocal({ ...local, download_url: v })} />
        <Input label="Docs URL" value={local.docs_url ?? ""} onChange={(v) => setLocal({ ...local, docs_url: v })} />
        <Input label="Repo URL" value={local.repo_url ?? ""} onChange={(v) => setLocal({ ...local, repo_url: v })} />
      </div>

      <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
        <label className="flex items-center gap-2 text-sm text-muted-foreground">
          <input
            type="checkbox"
            checked={local.is_active}
            onChange={(e) => setLocal({ ...local, is_active: e.target.checked })}
          />
          Show on public API docs
        </label>
        <div className="flex items-center gap-2">
          <label className="text-xs uppercase text-muted-foreground">Sort</label>
          <input
            type="number"
            value={local.sort_order}
            onChange={(e) => setLocal({ ...local, sort_order: Number(e.target.value) })}
            className="w-20 rounded-md border border-glass-border bg-background px-2 py-1 text-sm"
          />
          <button
            disabled={!dirty}
            onClick={() =>
              onUpdate(local.id, {
                name: local.name,
                platform: local.platform,
                version: local.version,
                description: local.description,
                download_url: local.download_url,
                docs_url: local.docs_url,
                repo_url: local.repo_url,
                icon_url: local.icon_url,
                is_active: local.is_active,
                sort_order: local.sort_order,
              })
            }
            className="inline-flex items-center gap-2 rounded-lg bg-gradient-brand px-3 py-1.5 text-xs font-semibold text-brand-foreground shadow-glow disabled:opacity-40"
          >
            <Save className="h-3.5 w-3.5" /> Save
          </button>
        </div>
      </div>
    </div>
  );
}
