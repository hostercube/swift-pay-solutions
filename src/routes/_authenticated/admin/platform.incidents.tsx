import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { AdminShell } from "@/components/admin-shell";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Trash2 } from "lucide-react";

export const Route = createFileRoute("/_authenticated/admin/platform/incidents")({
  head: () => ({ meta: [{ title: "Admin · Incidents" }] }),
  component: IncidentsPage,
});

type Incident = {
  id: string;
  title: string;
  body: string | null;
  severity: "minor" | "major" | "critical";
  status: "investigating" | "identified" | "monitoring" | "resolved";
  components: string[];
  started_at: string;
  resolved_at: string | null;
};

const COMPONENTS = ["checkout", "api", "webhooks", "dashboard", "database"];

const fromLoose = supabase.from as unknown as (t: string) => {
  select: (s: string) => { order: (c: string, o: { ascending: boolean }) => Promise<{ data: Incident[] | null }> };
  insert: (v: Record<string, unknown>) => Promise<{ error: { message: string } | null }>;
  update: (v: Record<string, unknown>) => { eq: (c: string, v: string) => Promise<{ error: { message: string } | null }> };
  delete: () => { eq: (c: string, v: string) => Promise<{ error: { message: string } | null }> };
};

function IncidentsPage() {
  const [rows, setRows] = useState<Incident[]>([]);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [severity, setSeverity] = useState<Incident["severity"]>("minor");
  const [components, setComponents] = useState<string[]>([]);

  const load = () => {
    fromLoose("incidents")
      .select("*")
      .order("started_at", { ascending: false })
      .then(({ data }) => setRows(data ?? []));
  };

  useEffect(() => { load(); }, []);

  const toggleComp = (c: string) =>
    setComponents((prev) => (prev.includes(c) ? prev.filter((x) => x !== c) : [...prev, c]));

  const create = async () => {
    if (!title.trim()) return toast.error("Title required");
    const { error } = await fromLoose("incidents").insert({
      title, body: body || null, severity, components, status: "investigating",
    });
    if (error) return toast.error(error.message);
    toast.success("Incident posted");
    setTitle(""); setBody(""); setSeverity("minor"); setComponents([]);
    load();
  };

  const updateStatus = async (id: string, status: Incident["status"]) => {
    const patch: Record<string, unknown> = { status };
    if (status === "resolved") patch.resolved_at = new Date().toISOString();
    const { error } = await fromLoose("incidents").update(patch).eq("id", id);
    if (error) return toast.error(error.message);
    load();
  };

  const remove = async (id: string) => {
    if (!confirm("Delete incident?")) return;
    const { error } = await fromLoose("incidents").delete().eq("id", id);
    if (error) return toast.error(error.message);
    load();
  };

  return (
    <AdminShell title="Incidents" subtitle="Publish and update outages on the public status page">
      <Card className="p-5">
        <h3 className="font-display text-lg font-semibold">Post new incident</h3>
        <div className="mt-3 grid gap-3">
          <Input placeholder="Title (e.g. Checkout latency)" value={title} onChange={(e) => setTitle(e.target.value)} />
          <textarea
            placeholder="Description shown to users"
            value={body}
            onChange={(e) => setBody(e.target.value)}
            className="min-h-[80px] w-full rounded-lg border border-glass-border bg-card/60 px-3 py-2 text-sm"
          />
          <div className="grid gap-3 sm:grid-cols-2">
            <label>
              <div className="mb-1 text-xs uppercase text-muted-foreground">Severity</div>
              <select
                value={severity}
                onChange={(e) => setSeverity(e.target.value as Incident["severity"])}
                className="w-full rounded-lg border border-glass-border bg-card/60 px-3 py-2 text-sm"
              >
                <option value="minor">Minor</option>
                <option value="major">Major</option>
                <option value="critical">Critical</option>
              </select>
            </label>
            <div>
              <div className="mb-1 text-xs uppercase text-muted-foreground">Affected components</div>
              <div className="flex flex-wrap gap-1.5">
                {COMPONENTS.map((c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => toggleComp(c)}
                    className={`rounded-md border px-2 py-1 text-xs capitalize transition ${
                      components.includes(c) ? "border-brand bg-brand/10 text-foreground" : "border-glass-border text-muted-foreground"
                    }`}
                  >
                    {c}
                  </button>
                ))}
              </div>
            </div>
          </div>
          <Button onClick={create}>Publish incident</Button>
        </div>
      </Card>

      <Card className="mt-6 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-muted/30 text-left text-xs uppercase tracking-wide text-muted-foreground">
            <tr>
              <th className="px-4 py-3">Started</th>
              <th className="px-4 py-3">Title</th>
              <th className="px-4 py-3">Severity</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Actions</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr><td colSpan={5} className="p-8 text-center text-muted-foreground">No incidents</td></tr>
            ) : rows.map((r) => (
              <tr key={r.id} className="border-t border-glass-border align-top">
                <td className="px-4 py-3 text-xs">{new Date(r.started_at).toLocaleString()}</td>
                <td className="px-4 py-3">
                  <div className="font-medium">{r.title}</div>
                  {r.body && <div className="text-xs text-muted-foreground">{r.body}</div>}
                  {r.components.length > 0 && (
                    <div className="mt-1 flex flex-wrap gap-1">
                      {r.components.map((c) => (
                        <span key={c} className="rounded bg-muted px-1.5 py-0.5 text-[10px]">{c}</span>
                      ))}
                    </div>
                  )}
                </td>
                <td className="px-4 py-3"><Badge variant="outline">{r.severity}</Badge></td>
                <td className="px-4 py-3"><Badge>{r.status}</Badge></td>
                <td className="px-4 py-3">
                  <div className="flex flex-wrap gap-1">
                    {(["investigating", "identified", "monitoring", "resolved"] as const)
                      .filter((s) => s !== r.status)
                      .map((s) => (
                        <Button key={s} size="sm" variant="outline" onClick={() => updateStatus(r.id, s)}>
                          → {s}
                        </Button>
                      ))}
                    <Button size="sm" variant="destructive" onClick={() => remove(r.id)}>
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </AdminShell>
  );
}
