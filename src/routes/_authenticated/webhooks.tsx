import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Copy, Trash2 } from "lucide-react";
import { MerchantShell } from "@/components/merchant-shell";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";

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
  const [rows, setRows] = useState<Row[]>([]);
  const [url, setUrl] = useState("");
  const [mode, setMode] = useState<"live" | "test">("live");
  const [selected, setSelected] = useState<string[]>(["invoice.paid", "invoice.failed"]);


  async function load() {
    if (!user) return;
    const { data } = await supabase
      .from("webhook_endpoints")
      .select("id, url, events, signing_secret, is_active, created_at")
      .eq("merchant_id", user.id)
      .order("created_at", { ascending: false });
    setRows((data ?? []) as Row[]);
  }
  useEffect(() => { load(); }, [user]);

  async function create() {
    if (!user) return;
    if (!/^https?:\/\//.test(url)) return toast.error("URL must start with http(s)://");
    if (selected.length === 0) return toast.error("Select at least one event");
    const { error } = await supabase.from("webhook_endpoints").insert({
      merchant_id: user.id,
      url,
      events: selected,
      signing_secret: randomSecret(),
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
                >
                  {ev}
                </button>
              );
            })}
          </div>
          <button
            onClick={create}
            className="rounded-lg bg-gradient-brand px-4 py-2 text-sm font-semibold text-brand-foreground"
          >
            Create endpoint
          </button>
        </div>
      </div>

      <div className="glass mt-6 overflow-hidden rounded-2xl border border-glass-border">
        <table className="w-full text-sm">
          <thead className="bg-card/40 text-left text-xs uppercase tracking-wider text-muted-foreground">
            <tr>
              <th className="px-4 py-3">URL</th>
              <th className="px-4 py-3">Events</th>
              <th className="px-4 py-3">Signing secret</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr><td colSpan={5} className="px-4 py-8 text-center text-muted-foreground">No endpoints yet.</td></tr>
            )}
            {rows.map((r) => (
              <tr key={r.id} className="border-t border-glass-border">
                <td className="px-4 py-3 font-mono text-xs">{r.url}</td>
                <td className="px-4 py-3 text-xs text-muted-foreground">{r.events.join(", ")}</td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    <code className="font-mono text-xs">{r.signing_secret.slice(0, 14)}…</code>
                    <button
                      onClick={() => { navigator.clipboard.writeText(r.signing_secret); toast.success("Copied"); }}
                      className="rounded p-1 text-muted-foreground hover:text-foreground"
                    ><Copy className="h-3.5 w-3.5" /></button>
                  </div>
                </td>
                <td className="px-4 py-3">
                  <button
                    onClick={() => toggle(r.id, r.is_active)}
                    className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${
                      r.is_active ? "bg-brand/10 text-brand" : "bg-muted text-muted-foreground"
                    }`}
                  >
                    {r.is_active ? "Active" : "Disabled"}
                  </button>
                </td>
                <td className="px-4 py-3 text-right">
                  <button onClick={() => remove(r.id)} className="text-destructive hover:opacity-80">
                    <Trash2 className="h-4 w-4" />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </MerchantShell>
  );
}
