import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Copy, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { DataTable, type DataTableColumn, type DataTableFilter } from "@/components/data-table";

export const Route = createFileRoute("/_authenticated/security/api-keys")({
  head: () => ({ meta: [{ title: "API keys · PayNOC" }] }),
  component: ApiKeysPage,
});

type Row = {
  id: string;
  name: string;
  environment: string;
  public_key: string;
  is_active: boolean;
  created_at: string;
  last_used_at: string | null;
};

function randomKey(prefix: string) {
  const bytes = new Uint8Array(24);
  crypto.getRandomValues(bytes);
  const hex = Array.from(bytes).map((b) => b.toString(16).padStart(2, "0")).join("");
  return `${prefix}_${hex}`;
}

async function sha256Hex(text: string) {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

function ApiKeysPage() {
  const { user } = useAuth();
  const [rows, setRows] = useState<Row[]>([]);
  const [name, setName] = useState("Default");
  const [env, setEnv] = useState<"test" | "live">("test");
  const [newSecret, setNewSecret] = useState<string | null>(null);

  async function load() {
    if (!user) return;
    const { data } = await supabase
      .from("api_keys")
      .select("id, name, environment, public_key, is_active, created_at, last_used_at")
      .eq("merchant_id", user.id)
      .order("created_at", { ascending: false });
    setRows((data ?? []) as Row[]);
  }
  useEffect(() => { load(); }, [user]);

  async function create() {
    if (!user) return;
    const publicKey = randomKey(env === "live" ? "pk_live" : "pk_test");
    const secret = randomKey(env === "live" ? "sk_live" : "sk_test");
    const secretHash = await sha256Hex(secret);
    const { error } = await supabase.from("api_keys").insert({
      merchant_id: user.id,
      name,
      environment: env,
      public_key: publicKey,
      secret_hash: secretHash,
    });
    if (error) return toast.error(error.message);
    setNewSecret(secret);
    toast.success("API key created — copy the secret now, it won't be shown again.");
    load();
  }

  async function toggle(id: string, is_active: boolean) {
    await supabase.from("api_keys").update({ is_active: !is_active }).eq("id", id);
    load();
  }

  async function remove(id: string) {
    if (!confirm("Delete this key? Integrations using it will stop working.")) return;
    await supabase.from("api_keys").delete().eq("id", id);
    load();
  }

  return (
    <>
      <div className="glass rounded-2xl border border-glass-border p-6">
        <h2 className="font-display text-lg font-semibold">Create key</h2>
        <div className="mt-4 flex flex-wrap items-end gap-3">
          <label className="min-w-[200px] flex-1">
            <div className="mb-1.5 text-xs font-medium uppercase tracking-wider text-muted-foreground">Name</div>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full rounded-lg border border-glass-border bg-card/60 px-3 py-2 text-sm outline-none focus:border-brand"
            />
          </label>
          <label>
            <div className="mb-1.5 text-xs font-medium uppercase tracking-wider text-muted-foreground">Environment</div>
            <select
              value={env}
              onChange={(e) => setEnv(e.target.value as "test" | "live")}
              className="rounded-lg border border-glass-border bg-card/60 px-3 py-2 text-sm outline-none focus:border-brand"
            >
              <option value="test">Test</option>
              <option value="live">Live</option>
            </select>
          </label>
          <button
            onClick={create}
            className="rounded-lg bg-gradient-brand px-4 py-2 text-sm font-semibold text-brand-foreground"
          >
            Generate key
          </button>
        </div>

        {newSecret && (
          <div className="mt-4 rounded-lg border border-brand/40 bg-brand/5 p-4">
            <div className="text-xs font-semibold uppercase tracking-wider text-brand">New secret key — copy now</div>
            <div className="mt-2 flex items-center gap-2">
              <code className="flex-1 truncate rounded-md bg-background/60 px-3 py-2 font-mono text-xs">{newSecret}</code>
              <button
                onClick={() => { navigator.clipboard.writeText(newSecret); toast.success("Copied"); }}
                className="rounded-md border border-glass-border p-2 hover:bg-muted"
              >
                <Copy className="h-4 w-4" />
              </button>
            </div>
          </div>
        )}
      </div>

      <div className="mt-6">
        <DataTable<Row>
          columns={[
            { key: "name", label: "Name", sortable: true, render: (r) => <span className="font-medium">{r.name}</span> },
            { key: "environment", label: "Env", sortable: true, render: (r) => <span className="uppercase text-muted-foreground">{r.environment}</span> },
            {
              key: "public_key",
              label: "Public key",
              render: (r) => (
                <div className="flex items-center gap-2">
                  <code className="font-mono text-xs">{r.public_key}</code>
                  <button
                    onClick={() => { navigator.clipboard.writeText(r.public_key); toast.success("Copied"); }}
                    className="rounded p-1 text-muted-foreground hover:text-foreground"
                  ><Copy className="h-3.5 w-3.5" /></button>
                </div>
              ),
            },
            {
              key: "is_active",
              label: "Status",
              sortable: true,
              accessor: (r) => (r.is_active ? "active" : "disabled"),
              render: (r) => (
                <button
                  onClick={() => toggle(r.id, r.is_active)}
                  className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${
                    r.is_active ? "bg-brand/10 text-brand" : "bg-muted text-muted-foreground"
                  }`}
                >
                  {r.is_active ? "Active" : "Disabled"}
                </button>
              ),
            },
            {
              key: "created_at",
              label: "Created",
              sortable: true,
              accessor: (r) => new Date(r.created_at),
              render: (r) => <span className="text-muted-foreground">{new Date(r.created_at).toLocaleDateString()}</span>,
            },
          ] as DataTableColumn<Row>[]}
          rows={rows}
          rowKey={(r) => r.id}
          emptyMessage="No API keys yet."
          searchable={(r) => `${r.name} ${r.environment} ${r.public_key}`}
          filters={[
            {
              key: "environment",
              label: "Environment",
              options: [
                { value: "test", label: "Test" },
                { value: "live", label: "Live" },
              ],
              match: (r, v) => r.environment === v,
            },
            {
              key: "status",
              label: "Status",
              options: [
                { value: "active", label: "Active" },
                { value: "disabled", label: "Disabled" },
              ],
              match: (r, v) => (v === "active" ? r.is_active : !r.is_active),
            },
          ] as DataTableFilter<Row>[]}
          dateField={(r) => r.created_at}
          actions={(r) => (
            <button onClick={() => remove(r.id)} className="text-destructive hover:opacity-80">
              <Trash2 className="h-4 w-4" />
            </button>
          )}
          exportFilename="api-keys"
        />
      </div>
    </>
  );
}
