import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Copy, Trash2 } from "lucide-react";
import { MerchantShell } from "@/components/merchant-shell";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { useActiveMerchant } from "@/hooks/use-active-merchant";
import { DataTable, type DataTableColumn, type DataTableFilter } from "@/components/data-table";

export const Route = createFileRoute("/_authenticated/webhooks")({
  head: () => ({ meta: [{ title: "Webhooks · PayNOC" }] }),
  component: WebhooksPage,
});

const ALL_EVENTS = ["invoice.paid", "invoice.failed", "invoice.expired", "transaction.verified", "transaction.rejected"];

type Row = {
  id: string;
  url: string;
  events: string[];
  signing_secret: string;
  is_active: boolean;
  created_at: string;
  mode: string;
};

function randomSecret() {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return "whsec_" + Array.from(bytes).map((b) => b.toString(16).padStart(2, "0")).join("");
}

function WebhooksPage() {
  const { user } = useAuth();
  const { merchantId: activeMerchantId } = useActiveMerchant();
  const [rows, setRows] = useState<Row[]>([]);
  const [url, setUrl] = useState("");
  const [mode, setMode] = useState<"live" | "test">("live");
  const [selected, setSelected] = useState<string[]>(["invoice.paid", "invoice.failed"]);
  const [loading, setLoading] = useState(true);

  async function load() {
    if (!user) return;
    setLoading(true);
    const { data } = await supabase
      .from("webhook_endpoints")
      .select("id, url, events, signing_secret, is_active, created_at, mode")
      .eq("merchant_id", activeMerchantId ?? user.id)
      .order("created_at", { ascending: false });
    setRows((data ?? []) as Row[]);
    setLoading(false);
  }
  useEffect(() => { load(); }, [user, activeMerchantId]);

  async function create() {
    if (!user) return;
    if (!/^https?:\/\//.test(url)) return toast.error("URL must start with http(s)://");
    if (selected.length === 0) return toast.error("Select at least one event");
    const { error } = await supabase.from("webhook_endpoints").insert({
      merchant_id: activeMerchantId ?? user.id,
      url,
      events: selected,
      signing_secret: randomSecret(),
      mode,
    });
    if (error) return toast.error(error.message);
    setUrl("");
    toast.success("Webhook endpoint added");
    load();
  }

  async function toggle(id: string, is_active: boolean) {
    await supabase.from("webhook_endpoints").update({ is_active: !is_active }).eq("id", id);
    load();
  }

  async function remove(id: string) {
    if (!confirm("Delete this endpoint?")) return;
    await supabase.from("webhook_endpoints").delete().eq("id", id);
    load();
  }

  const columns: DataTableColumn<Row>[] = [
    {
      key: "url",
      label: "URL",
      render: (r) => (
        <div className="font-mono text-xs">
          {r.url}
          {r.mode === "test" && <span className="ml-2 rounded-full bg-amber-500/15 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider text-amber-500">Test</span>}
        </div>
      ),
    },
    { key: "events", label: "Events", render: (r) => <span className="text-xs text-muted-foreground">{r.events.join(", ")}</span> },
    {
      key: "signing_secret",
      label: "Signing secret",
      render: (r) => (
        <div className="flex items-center gap-2">
          <code className="font-mono text-xs">{r.signing_secret.slice(0, 14)}…</code>
          <button
            onClick={() => { navigator.clipboard.writeText(r.signing_secret); toast.success("Copied"); }}
            className="rounded p-1 text-muted-foreground hover:text-foreground"
          ><Copy className="h-3.5 w-3.5" /></button>
        </div>
      ),
    },
    {
      key: "is_active",
      label: "Status",
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
  ];

  const filters: DataTableFilter<Row>[] = [
    { key: "mode", label: "Live + Test", options: [{ value: "live", label: "Live" }, { value: "test", label: "Test" }], match: (r, v) => r.mode === v },
    { key: "state", label: "All states", options: [{ value: "active", label: "Active" }, { value: "disabled", label: "Disabled" }], match: (r, v) => (v === "active" ? r.is_active : !r.is_active) },
    { key: "event", label: "Any event", options: ALL_EVENTS.map((e) => ({ value: e, label: e })), match: (r, v) => r.events.includes(v) },
  ];

  return (
    <MerchantShell title="Webhooks" subtitle="Receive real-time notifications when payments succeed or fail.">
      <div className="glass rounded-2xl border border-glass-border p-6">
        <h2 className="font-display text-lg font-semibold">Add endpoint</h2>
        <div className="mt-4 space-y-4">
          <input
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://your-site.com/api/paynoc-webhook"
            className="w-full rounded-lg border border-glass-border bg-card/60 px-3 py-2 text-sm outline-none focus:border-brand"
          />
          <div className="inline-flex rounded-lg border border-glass-border bg-card/40 p-1 text-xs">
            {(["live","test"] as const).map((m) => (
              <button key={m} onClick={() => setMode(m)}
                className={`rounded-md px-3 py-1.5 font-semibold uppercase tracking-wider ${mode===m ? "bg-brand text-brand-foreground" : "text-muted-foreground hover:text-foreground"}`}>
                {m}
              </button>
            ))}
          </div>
          <div className="flex flex-wrap gap-2">
            {ALL_EVENTS.map((ev) => {
              const on = selected.includes(ev);
              return (
                <button
                  key={ev}
                  onClick={() => setSelected(on ? selected.filter((e) => e !== ev) : [...selected, ev])}
                  className={`rounded-full border px-3 py-1 text-xs transition ${
                    on ? "border-brand bg-brand/10 text-brand" : "border-glass-border text-muted-foreground hover:text-foreground"
                  }`}
                >{ev}</button>
              );
            })}
          </div>
          <button onClick={create} className="rounded-lg bg-gradient-brand px-4 py-2 text-sm font-semibold text-brand-foreground">
            Create endpoint
          </button>
        </div>
      </div>

      <div className="mt-6">
        <DataTable
          columns={columns}
          rows={rows}
          rowKey={(r) => r.id}
          loading={loading}
          emptyMessage="No endpoints yet."
          searchable={(r) => `${r.url} ${r.events.join(" ")}`}
          filters={filters}
          dateField={(r) => r.created_at}
          actions={(r) => (
            <button onClick={() => remove(r.id)} className="text-destructive hover:opacity-80">
              <Trash2 className="h-4 w-4" />
            </button>
          )}
        />
      </div>
    </MerchantShell>
  );
}
