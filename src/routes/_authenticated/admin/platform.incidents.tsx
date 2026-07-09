import { createFileRoute, useRouter } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { AdminShell } from "@/components/admin-shell";
import { PlatformTabs } from "@/components/platform-tabs";
import { DataTable, type DataTableColumn } from "@/components/data-table";
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
  errorComponent: ({ error, reset }) => {
    const router = useRouter();
    return (
      <AdminShell title="Incidents" subtitle="Something went wrong loading incidents">
        <PlatformTabs />
        <Card className="p-6">
          <div className="text-sm font-medium text-destructive">Failed to load incidents</div>
          <p className="mt-2 whitespace-pre-wrap text-xs text-muted-foreground">
            {error?.message ?? String(error)}
          </p>
          <Button
            className="mt-4"
            variant="outline"
            onClick={() => { reset(); router.invalidate(); }}
          >
            Try again
          </Button>
        </Card>
      </AdminShell>
    );
  },
  notFoundComponent: () => <div className="p-8">Not found</div>,
});

type Severity = "minor" | "major" | "critical";
type Status = "investigating" | "identified" | "monitoring" | "resolved";

type Incident = {
  id: string;
  title: string;
  body: string | null;
  severity: Severity;
  status: Status;
  components: string[];
  started_at: string;
  resolved_at: string | null;
};

const COMPONENTS = ["checkout", "api", "webhooks", "dashboard", "database"];

function IncidentsPage() {
  const qc = useQueryClient();
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [severity, setSeverity] = useState<Severity>("minor");
  const [components, setComponents] = useState<string[]>([]);

  const { data: rows = [], isLoading, error } = useQuery<Incident[]>({
    queryKey: ["admin", "incidents"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("incidents")
        .select("id,title,body,severity,status,components,started_at,resolved_at")
        .order("started_at", { ascending: false });
      if (error) throw new Error(error.message);
      return (data ?? []) as Incident[];
    },
  });

  const refresh = () => qc.invalidateQueries({ queryKey: ["admin", "incidents"] });

  const toggleComp = (c: string) =>
    setComponents((prev) => (prev.includes(c) ? prev.filter((x) => x !== c) : [...prev, c]));

  const createMut = useMutation({
    mutationFn: async () => {
      if (!title.trim()) throw new Error("Title required");
      const { error } = await supabase.from("incidents").insert({
        title: title.trim(),
        body: body.trim() || null,
        severity,
        components,
        status: "investigating",
      });
      if (error) throw new Error(error.message);
    },
    onSuccess: () => {
      toast.success("Incident posted");
      setTitle(""); setBody(""); setSeverity("minor"); setComponents([]);
      refresh();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const statusMut = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: Status }) => {
      const patch: Record<string, unknown> = { status };
      if (status === "resolved") patch.resolved_at = new Date().toISOString();
      else patch.resolved_at = null;
      const { error } = await supabase.from("incidents").update(patch).eq("id", id);
      if (error) throw new Error(error.message);
    },
    onSuccess: refresh,
    onError: (e: Error) => toast.error(e.message),
  });

  const removeMut = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("incidents").delete().eq("id", id);
      if (error) throw new Error(error.message);
    },
    onSuccess: () => { toast.success("Deleted"); refresh(); },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <AdminShell title="Incidents" subtitle="Publish and update outages on the public status page">
      <PlatformTabs />
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
                onChange={(e) => setSeverity(e.target.value as Severity)}
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
          <Button onClick={() => createMut.mutate()} disabled={createMut.isPending}>
            {createMut.isPending ? "Publishing…" : "Publish incident"}
          </Button>
        </div>
      </Card>

      <div className="mt-6">
        {error ? (
          <Card className="p-6 text-sm text-destructive">
            Failed to load: {(error as Error).message}
          </Card>
        ) : (
          <DataTable<Incident>
            rows={rows}
            rowKey={(r) => r.id}
            loading={isLoading}
            searchable={(r) => `${r.title} ${r.body ?? ""} ${(r.components ?? []).join(" ")}`}
            dateField={(r) => r.started_at}
            emptyMessage="No incidents"
            filters={[
              {
                key: "severity",
                label: "Severity",
                options: [
                  { value: "minor", label: "Minor" },
                  { value: "major", label: "Major" },
                  { value: "critical", label: "Critical" },
                ],
                match: (r, v) => r.severity === v,
              },
              {
                key: "status",
                label: "Status",
                options: [
                  { value: "investigating", label: "Investigating" },
                  { value: "identified", label: "Identified" },
                  { value: "monitoring", label: "Monitoring" },
                  { value: "resolved", label: "Resolved" },
                ],
                match: (r, v) => r.status === v,
              },
            ]}
            columns={[
              { key: "started", label: "Started", render: (r) => <span className="text-xs">{new Date(r.started_at).toLocaleString()}</span> },
              {
                key: "title",
                label: "Title",
                render: (r) => (
                  <div>
                    <div className="font-medium">{r.title}</div>
                    {r.body && <div className="text-xs text-muted-foreground">{r.body}</div>}
                    {(r.components ?? []).length > 0 && (
                      <div className="mt-1 flex flex-wrap gap-1">
                        {(r.components ?? []).map((c) => (
                          <span key={c} className="rounded bg-muted px-1.5 py-0.5 text-[10px]">{c}</span>
                        ))}
                      </div>
                    )}
                  </div>
                ),
              },
              { key: "severity", label: "Severity", render: (r) => <Badge variant="outline">{r.severity}</Badge> },
              { key: "status", label: "Status", render: (r) => <Badge>{r.status}</Badge> },
            ] as DataTableColumn<Incident>[]}
            actions={(r) => (
              <div className="flex flex-wrap justify-end gap-1">
                {(["investigating", "identified", "monitoring", "resolved"] as const)
                  .filter((s) => s !== r.status)
                  .map((s) => (
                    <Button key={s} size="sm" variant="outline" onClick={() => statusMut.mutate({ id: r.id, status: s })}>
                      → {s}
                    </Button>
                  ))}
                <Button
                  size="sm"
                  variant="destructive"
                  onClick={() => { if (confirm("Delete incident?")) removeMut.mutate(r.id); }}
                >
                  <Trash2 className="h-3 w-3" />
                </Button>
              </div>
            )}
          />
        )}
      </div>
    </AdminShell>
  );
}
